# Gmail/Calendar Auto-Sourced Interactions + Auto Follow-ups — Design Spec

**Date:** 2026-05-17
**Status:** Approved (pending written-spec review)
**Owner:** Dan Hoeller

## Problem

Logging interactions in job-tracker is 100% manual. The data already exists in
Gmail and Calendar; it is being re-keyed by hand. Every unlogged interaction is
a lost relationship signal and a follow-up reminder that never gets created.

## Goals

1. Auto-source interactions from Gmail and Google Calendar for the single user
   (Dan), keyed off contact emails.
2. Keep the relationship timeline clean and trusted — no junk silently entering
   the real interactions history.
3. Automatically create follow-up reminders for open loops (sent a note /
   had a meeting, no response within a threshold), and auto-cancel them when
   the loop closes.
4. Be designed so opening it up to multiple users later is an *additive*
   change, not a rewrite.

## Non-Goals

- Multi-user support now (single-user; multi-user seams preserved only).
- Real-time / push (Pub/Sub) sync. Daily batch is sufficient.
- Historical backfill. Forward-only from setup date.
- Name-based matching of calendar attendees without an email.
- Replacing Resend for email delivery (out of scope).

## Decisions (resolved during brainstorming)

| # | Decision | Choice |
|---|----------|--------|
| Audience | Single-user now, multi-user later | Single-user; per-user-keyed schema seams kept |
| Token acquisition | One-time local OAuth script vs env var vs in-app | **One-time local script → `google_oauth_tokens` table** |
| Sync runner | New Edge Function, daily | **New Edge Function, daily, same scheduling as `process-email-reminders`** |
| Dedupe / threads | One interaction per thread/event, updated in place | **Yes; idempotent via `external_id` + `source`** |
| Routing | Auto-write vs review | **Confidence-gated**: high-confidence Calendar auto-writes; Gmail always reviewed; any low/no-confidence → review |
| Alias learning | Remember unknown emails on assignment | **Auto-learn into separate `contact_email_aliases` table; contact record never auto-modified** |
| Google API client | Raw `fetch` vs `googleapis` lib | **Raw `fetch`** (matches existing Edge Function pattern) |
| Rule engine location | Same function vs separate | **Same Edge Function, Phase C** |
| Self-cancellation | Cancel auto follow-up when they reply | **Yes, silent cancel + `reminder_logs` entry** |
| Review UI home | Tab vs card vs header | **Card inside Network tab + count badge** |
| Backfill | History vs forward-only | **Forward-only** from setup date |
| Review flow | One-tap accept vs edit-before-commit | **Edit-before-commit**: opens in right-slide panel (reuse `InteractionForm`), all fields incl. notes editable before the real interaction is created |
| Follow-up thresholds | Hardcoded vs user-editable | **User-editable** via a settings UI, persisted in `followup_settings`; spec values are defaults/seeds |
| Token at rest | Plaintext vs encrypted | **Encrypted at the application layer** (AES-256-GCM, key in Edge Function secret); RLS is not sufficient for a mailbox credential |
| Identity (whose email is "mine") | Implicit vs explicit | **Explicit configured list** of owned addresses/send-as aliases, seeded at setup; matching depends on it |
| Auto-followup rate budget | Shared vs separate | **Separate budget** from user-initiated reminders; system-generated followups must not starve manual ones |
| Sync window | Fixed 2-day vs watermark | **Since last successful sync, with a 2-day floor**; watermark persisted per source |
| Direction tracking | Parsed from notes vs structured | **Structured columns** on the interaction; `notes` stays free-editable without breaking the rule engine |

## Architecture

Three cooperating pieces, all reusing existing repo patterns.

### 1. One-time local OAuth setup script

`scripts/google-oauth-setup.ts` (run once, locally). Opens Google consent for
`https://www.googleapis.com/auth/gmail.readonly` and
`https://www.googleapis.com/auth/calendar.readonly` against Dan's own Google
Cloud project in "testing" mode (no Google app verification required for the
project owner). Captures the refresh token, **encrypts it** (see Security),
and upserts the ciphertext into `google_oauth_tokens` keyed by Dan's `user_id`.

The script also prompts for and persists the **owned-identity list** — every
email address that is "Dan's" for matching purposes: the Gmail account, the
Kinetic address, and any Gmail send-as aliases (the script can read the latter
from the Gmail `settings.sendAs` API and pre-fill them for confirmation).
Stored in `sync_identity` (see Data Model). Matching correctness depends
entirely on this list being complete, so it is an explicit setup step, not an
inference.

### 2. New Edge Function: `sync-google-interactions`

Sibling of `supabase/functions/process-email-reminders/`. Same deployment and
scheduling mechanism (to be confirmed during implementation — the existing
function has no in-repo cron; whatever schedules it schedules this too). Runs
daily. Three sequential phases:

- **Phase A — Fetch & match.** Decrypt the refresh token, mint an access token
  once for the run (reuse the cached one if still valid). Pull Gmail threads
  and Calendar events **since the last successful sync watermark for that
  source, with a 2-day floor** (see Sync Window) — fully paginated via
  `nextPageToken`, no silent truncation. For each thread/event, extract
  counterparty email(s), resolve to a contact (batched), classify confidence.
- **Phase B — Write.** High-confidence Calendar → upsert real interaction.
  Gmail (all) and any low/no-confidence → write to review queue.
- **Phase C — Follow-up rule engine.** Detect open loops, create
  self-cancelling reminders, cancel auto-reminders whose loop has closed.

Raw `fetch` to Google REST endpoints (token refresh, Gmail list/get thread,
Calendar list events). No `googleapis` dependency. Pure logic (matching,
classification, rule engine) extracted into testable modules, not buried in the
Deno handler.

### 3. Review UI (Next.js)

A "Detected" card within the existing **Network** tab with a count badge
(e.g. *Detected · 12*). Edit-before-commit flow (see UI section).

### Data flow

```
Google APIs
  → Edge Function: decrypt token → fetch (incremental, paginated)
                  → match (sync_identity + batched contact/alias lookup)
                  → write (interactions / interaction_review_queue)
                  → rule engine (email_reminders, separate budget)
                  → record sync_runs (watermark + counts)
  → Review UI (Network tab card: status + queue)
  → on assign: contact_email_aliases written (with conflict warning)
  → next sync resolves more emails automatically
```

## Security

This feature holds a long-lived credential to the user's entire mailbox and
calendar. It is treated as sensitive infrastructure, not application data.

- **Refresh token encryption at rest.** The Google refresh token is encrypted
  with AES-256-GCM before it ever touches the database. The 256-bit key lives
  only in an Edge Function secret (`GOOGLE_TOKEN_ENC_KEY`) and the local setup
  script's environment — never in the DB, never in the repo, never client-side.
  A per-row random 96-bit IV is stored alongside the ciphertext; the GCM auth
  tag is appended to the ciphertext. RLS restricts the row to service-role;
  encryption protects it even against DB dumps, backups, a leaked service-role
  key, or a SQL-injection path. Decryption happens only inside the Edge
  Function, transiently, to mint an access token.
- **Scope minimization.** `gmail.readonly` and `calendar.readonly` only — no
  send, no modify. The feature can never alter the mailbox.
- **No raw content retention.** Only derived fields are persisted (subject,
  snippet, attendee emails, counts). Full message bodies are never stored.
- **Revocation / kill switch.** A documented procedure: revoke the Google
  OAuth grant, then delete the `google_oauth_tokens` row. Spec includes an
  optional purge routine that also clears pending `interaction_review_queue`
  rows and Google-sourced data on request (single-user today; the seam for a
  future per-user "disconnect & forget" action).
- **Key rotation.** Because the IV is per-row and the key is external, rotating
  `GOOGLE_TOKEN_ENC_KEY` requires re-running the setup script (re-encrypts the
  one token). Documented; acceptable at single-user scale.

## Data Model

Migrations: establish `supabase/migrations/` (does not exist today; no `.sql`
files in repo). Timestamped SQL files, version-controlled. Document the
convention in `CLAUDE.md`.

### New table: `google_oauth_tokens`

```
user_id                 uuid PK references auth.users
refresh_token_encrypted bytea not null   -- AES-256-GCM ciphertext (see Security)
refresh_token_iv        bytea not null   -- per-row random IV/nonce
access_token            text             -- short-lived; acceptable in clear (≤1h, refreshable)
access_expires_at       timestamptz
scopes                  text
error_state             text             -- set when refresh fails (e.g. 'revoked')
created_at              timestamptz default now()
updated_at              timestamptz default now()
```
RLS: service-role only, never client-exposed. The refresh token (a long-lived
bearer credential to the entire mailbox/calendar) is **never stored in
plaintext** — see Security. The short-lived access token is left in clear: it
expires within an hour and is independently re-derivable from the encrypted
refresh token, so it is not a meaningful standalone exposure.

### New table: `sync_identity`

The set of email addresses that are "the user's own" for matching. Without
this, sent mail is misread as inbound and owned aliases look like contacts.

```
user_id     uuid not null references auth.users
email       text not null            -- normalized lowercase, trimmed
created_at  timestamptz default now()
PRIMARY KEY (user_id, email)
```
RLS by `user_id`. Seeded by the OAuth setup script; editable later via the
settings panel (so a new send-as alias can be added without re-running setup).

### New table: `sync_runs`

Observability for the daily automation. Without it, silent failure is the
default failure mode for a job the user depends on.

```
id              uuid PK default gen_random_uuid()
user_id         uuid not null
source          text not null            -- 'gmail' | 'gcal' (one row per source per run)
started_at      timestamptz not null default now()
finished_at     timestamptz
status          text not null            -- 'running' | 'success' | 'partial' | 'failed'
items_seen      integer default 0
items_written   integer default 0
items_queued    integer default 0
items_skipped   integer default 0
followups_created   integer default 0
followups_cancelled integer default 0
error_message   text
sync_watermark  timestamptz              -- the high-water timestamp this run advanced to
```
RLS by `user_id`. The latest `success` row's `sync_watermark` per source is the
incremental cursor for the next run (see Sync Window). The Network card reads
the most recent run to show "Last synced … / N new / ⚠ needs attention".

### New table: `contact_email_aliases`

```
id          uuid PK default gen_random_uuid()
user_id     uuid not null
contact_id  uuid not null references contacts(id) on delete cascade
email       text not null            -- normalized lowercase, trimmed
source      text not null default 'learned'
created_at  timestamptz default now()
UNIQUE (user_id, email)
```
RLS by `user_id`. One alias email maps to exactly one contact. If an email is
already learned for contact A and the user assigns it to contact B, the row is
**moved** — but the review UI must first warn ("`x@y.com` is currently linked
to {A}; assigning to {B} reroutes all future mail from it"), because shared
addresses (team@, assistants, couples) otherwise silently misroute.

### New table: `interaction_review_queue`

```
id                    uuid PK default gen_random_uuid()
user_id               uuid not null
source                text not null            -- 'gmail' | 'gcal'
external_id           text not null            -- gmail thread id / gcal event (occurrence) id
suggested_contact_id  uuid null references contacts(id) on delete set null
counterparty_email    text null
type                  text not null            -- 'email' | 'meeting' | 'video_call'
occurred_at           timestamptz not null
summary               text                     -- subject / event title
notes                 text                     -- snippet / attendees / message count
status                text not null default 'pending'  -- 'pending' | 'accepted' | 'dismissed'
created_at            timestamptz default now()
UNIQUE (user_id, source, external_id)
```
Dismissed rows are retained (status `dismissed`) so re-sync never resurfaces a
dismissed item.

### New table: `followup_settings`

User-editable thresholds for the Phase C rule engine. One row per user
(single-user now; `user_id`-keyed for the multi-user seam). Seeded with the
spec defaults on migration.

```
user_id                       uuid PK references auth.users
enabled                       boolean not null default true   -- master on/off for auto follow-ups
email_no_reply_days           integer not null default 7
meeting_no_followup_days      integer not null default 14
gone_quiet_days               integer not null default 30
max_auto_followups_per_day    integer not null default 10      -- separate from manual reminder cap
updated_at                    timestamptz default now()
```
RLS by `user_id`. The Edge Function reads this row at the start of Phase C; if
no row exists it falls back to the coded defaults (defensive — a missing row
must never disable follow-ups silently). `enabled = false` skips Phase C
entirely (no creation; existing pending auto-reminders are left alone but still
self-cancel on reply).

Validation (enforced in the settings API and DB check constraints): each
threshold an integer between 1 and 365; ordering not enforced (overlapping
windows are handled by the existing "one auto-reminder per contact per open
window" de-dup rule).

### Altered table: `interactions` (additive, nullable — existing rows untouched)

```
+ external_id        text null      -- gmail thread id / gcal event (occurrence) id
+ source             text null      -- 'gmail' | 'gcal' | null (manual entry, unchanged)
+ last_direction     text null      -- 'inbound' | 'outbound' (structured, not parsed from notes)
+ message_count      integer null   -- thread message count (gmail)
+ last_message_at    timestamptz null -- newest message/event time the rule engine reasons on
UNIQUE partial index (user_id, contact_id, source, external_id)
  WHERE external_id IS NOT NULL
```
The `contact_id` is part of the unique key so one Gmail thread involving two
contacts can produce one row per contact without colliding. The partial
predicate keeps existing manual rows (`external_id IS NULL`) out of the index.

`last_direction` / `message_count` / `last_message_at` are **structured
columns**, not text parsed back out of `notes`. The rule engine reads these
exclusively, so the user freely editing `notes` in the review flow can never
corrupt direction detection or self-cancellation. For manual interactions all
three stay null and the rule engine ignores them (manual rows don't get
auto-followups). The human-readable summary line in `notes` is still written
for display, but it is derived output, never an input.

## Matching & Confidence Logic

"Own address" = any email in `sync_identity` (normalized). All comparisons
below use that set, never a single hardcoded address.

For each Gmail thread / Calendar event:

**Extract counterparty email(s):**
- *Gmail*: per message, the address(es) not in `sync_identity` (From if
  inbound; To/Cc if outbound). Direction = inbound when From ∉ identity set,
  outbound when From ∈ identity set. Threads can involve multiple people →
  produce an interaction per matched contact.
- *Calendar*: every attendee whose email ∉ `sync_identity`. Organizer-only /
  no-attendee events → skipped (no counterparty = not a touchpoint).

**Resolve email → contact, batched (in order):**
Collect all counterparty emails for the whole run first, then resolve with
**two queries total** (one `contacts` IN-list, one `contact_email_aliases`
IN-list) into an in-memory map — not a query per item.
1. Exact match on `contacts.email` (normalized lowercase, trimmed).
2. Exact match on `contact_email_aliases.email`.
3. No match → unresolved.

**Confidence → routing:**

| Situation | Confidence | Route |
|-----------|------------|-------|
| Email resolves (primary or learned alias) — Calendar | High | Auto-write interaction |
| Email resolves — Gmail | High-but-Gmail | Review queue, `suggested_contact_id` pre-filled |
| Calendar event, no attendee email or unresolved | Low | Review queue, `suggested_contact_id` null |
| Gmail, email unresolved | Low | Review queue, `suggested_contact_id` null |

`video_call` vs `meeting`: event location/description contains a
Meet/Zoom/Teams link → `video_call`; else `meeting`. Enum values restricted to
the existing interaction enum: `'email' | 'phone' | 'video_call' | 'linkedin'
| 'meeting' | 'other'`.

**Noise floor (skipped entirely, not even queued):** Gmail messages where
Dan's address appears only in Bcc, or sender matches a conservative denylist
(`no-reply`, `noreply`, `notifications@`, `donotreply`, list-unsubscribe header
present). Anything uncertain still goes to review — the denylist is
conservative and never silently drops ambiguous mail.

**Calendar noise floor (skipped entirely, not even queued):**
- Events the user **declined** or marked **tentative** (responseStatus).
- Events the user did not attend per `responseStatus` where they are an
  attendee (not organizer) and never accepted.
- **All-day events** (OOO, holidays, focus blocks) — not a conversation.
- Events with **no non-identity attendee** after identity filtering.

**Recurring-event collapsing (the calendar analogue of thread collapsing):**
A recurring series (e.g. a weekly 1:1) is **one living interaction per series
per contact**, keyed on the recurring-event id — not one row per occurrence.
`last_message_at` advances to the most recent past occurrence; `message_count`
counts occurrences that have happened. Eighty weekly 1:1s = one interaction
that says "recurring — 80 occurrences, last 2026-05-15", not eighty rows. A
single (non-recurring) event remains one interaction keyed on its event id.

**Accepted trade-off:** a calendar invite with only a name (no email) cannot be
auto-matched (name matching too unreliable). It becomes a review item assigned
by hand once; if that person's calendar email is later learned as an alias via
a Gmail match, future events auto-resolve.

## Sync Window & Pagination

The sync is **incremental with a safety floor**, not a fixed lookback:

- Per source, the cursor is the `sync_watermark` of the latest `success`
  `sync_runs` row. Each run queries from `min(watermark, now − 2 days)` — the
  2-day floor absorbs clock skew and late-delivered mail; the watermark
  prevents a **permanent data gap** when a run is missed (e.g. Edge Function
  down for 3 days → next run still covers the gap, not just 2 days).
- First ever run (no prior success row): start from the setup timestamp
  (forward-only; no historical backfill, per Non-Goals).
- Gmail uses `q=after:<epoch>` + full `nextPageToken` pagination; Calendar uses
  `timeMin`/`updatedMin` + `pageToken`. A per-run hard cap (e.g. 2000 items)
  guards against a pathological run; hitting it marks the run `partial` and
  does **not** advance the watermark past the unprocessed point, so the
  remainder is picked up next run rather than lost.
- The watermark advances only on `success`/`partial`-up-to-point; a `failed`
  run leaves it untouched so the next run safely re-covers the window
  (idempotency makes re-processing a no-op).

## Thread Collapsing & Idempotent Upsert

**Gmail — one living interaction per thread per contact:**
- Key: `(user_id, contact_id, 'gmail', thread_id)`.
- First matched message → create: `type:'email'`, `date` = message date,
  structured columns set (`last_direction`, `message_count`,
  `last_message_at`), `summary` = thread subject, `notes` = derived display
  line + latest snippet.
- Subsequent syncs → update in place: advance structured columns, bump `date`,
  refresh the derived `notes` display line + snippet. Subject preserved.
- Gmail fetch uses `format=metadata` (headers only) for direction/threading on
  all messages; the body snippet is pulled only for the latest message that is
  actually written — minimizing API quota and runtime.

**Calendar — one interaction per event/occurrence per contact:**
- Key: `(user_id, contact_id, 'gcal', event_or_occurrence_id)`.
- Re-sync of a changed event updates `summary`/`date`/`notes` in place
  (renamed events, time changes). Never duplicates.

**2-day overlap window:** each daily run looks back ~2 days. Idempotency makes
re-seeing yesterday's items a no-op update.

## Follow-up Rule Engine (Phase C)

Operates only on real `interactions` rows (accepted/auto-written), never queue
items. Runs after sync in the same function.

At the start of Phase C, read the user's `followup_settings` row (fall back to
coded defaults if absent). If `enabled = false`, skip creation entirely
(self-cancellation of existing pending auto-reminders still runs).

"Direction" is read from the structured `last_direction` column (never parsed
from `notes`, which the user may have edited). Calendar `meeting`/`video_call`
= outbound-equivalent (ball in the user's court). The engine only scans
interactions within `max(thresholds)` days of now, so the query is bounded and
indexable on `(user_id, last_message_at)`.

**Open-loop detection (creates reminders).** Thresholds below are the seeded
defaults; the live values come from `followup_settings`:

| Trigger | Threshold (setting) | Reminder |
|---------|---------------------|----------|
| Outbound email, thread last-direction still outbound | `email_no_reply_days` (default 7), no inbound after | "Follow up with {name} — no reply to your note" |
| `meeting` / `video_call` | `meeting_no_followup_days` (default 14), no outbound logged after it | "Send {name} the follow-up from your conversation" |
| Any outbound, no reply | `gone_quiet_days` (default 30) | "Reconnect with {name} — gone quiet" |

- Created via the existing reminder path. Auto-followups draw on a **separate
  daily budget** (`followup_settings.max_auto_followups_per_day`, default 10),
  counted independently from user-initiated reminders, so automation can never
  consume the manual `MAX_DAILY_REMINDERS` allowance and lock the user out of
  creating their own reminders. The shared `MAX_ACTIVE_REMINDERS: 100` cap
  still applies as a global safety ceiling. On any limit → skip, record the
  skipped count on the `sync_runs` row (surfaced in the Network card), never
  throw, never silent.
- Tagged `source: 'auto_followup'`; stores the triggering interaction id.
- Skip if an `auto_followup` reminder already exists for that contact within
  the same open window. Tiers escalate one loop; they do not stack into three
  reminders.

**Self-cancellation:** each run, before creating new ones, for every pending
`auto_followup` reminder: if a qualifying inbound interaction now exists after
the trigger → set reminder `status:'cancelled'`, write `reminder_logs`
(`action:'cancelled'`, `details:{reason:'response_received'}`). Silent, no
fired email. Also cancels if contact deleted or trigger interaction removed.

## Review UI

Card within the **Network** tab, count badge (*Detected · N*). Forward-only,
so the queue starts empty and grows with activity.

A status line at the top of the card reads from the latest `sync_runs` row:
"Last synced 2h ago · 3 new" or, on failure, "⚠ Sync needs attention —
reauthorize Google" (links to the documented re-setup step). This makes silent
failure visible.

**Edit-before-commit flow:** tapping a queue item opens it in the existing
right-slide panel. This **extends** `InteractionForm` (which today has no
contact picker and no alias concept) with a searchable contact picker and the
detected-value seeding — flagged so the plan does not under-scope the UI work.
All fields editable before any real interaction is written:
- **Contact** — suggested (or empty); changeable via searchable picker backed
  by existing `searchContacts` (server-side `ilike`).
- **Type** — pre-filled; changeable to any of the 6 enum values.
- **Date** — pre-filled from message/event.
- **Summary** — pre-filled (subject/title).
- **Notes** — pre-filled (snippet / attendees / count); fully editable.

Actions:
- **Confirm** → create `interactions` row from edited values; mark queue row
  `accepted`; if contact assigned/changed from an unknown email, write/update
  `contact_email_aliases` (auto-learn).
- **Dismiss** → mark `dismissed`; write nothing; learn nothing; never
  resurfaces.
- **Bulk:** "Dismiss all", and "Accept all suggested" — the latter restricted
  to items that have a `suggested_contact_id` (never blind-accepts no-match
  items) and gated behind a confirm step, since it deliberately bypasses the
  edit-before-commit safety. Secondary to the open-and-edit default.

Empty state: "No detected interactions — you're all caught up. New emails and
meetings with your contacts appear here daily." No realtime; refetch on view
and after each action.

**Settings panel.** A right-slide panel (consistent pattern) from the Detected
card header. Two groups:
- *Follow-ups:* master enable toggle; three day-count inputs
  (`email_no_reply_days`, `meeting_no_followup_days`, `gone_quiet_days`) with
  explanatory labels; the per-day auto-followup budget
  (`max_auto_followups_per_day`). Validation mirrors API + DB (integer 1–365;
  budget 0–50). Persists via `GET`/`PUT /api/followup-settings`
  (auth-checked, user-scoped, `/api/reminders` pattern).
- *My email addresses:* the `sync_identity` list — add/remove owned addresses
  and send-as aliases without re-running the setup script. Persists via
  `GET`/`PUT /api/sync-identity`. A clear warning explains that a missing
  address here causes the user's own mail to be misclassified.

Saving takes effect on the next daily sync run.

## Error Handling

- **Token refresh failure** (revoked/expired): structured log, set
  `google_oauth_tokens.error_state`, do not crash; surface "Google connection
  needs reauthorization — re-run the setup script" in the Network card.
- **Google API errors** (429/5xx): exponential backoff with cap. Partial
  progress safe — idempotent writes mean a failed run retries cleanly.
- **Per-item isolation:** a malformed message/event is caught, logged,
  skipped; never aborts the batch.
- **Reminder limits hit:** follow-up creation degrades gracefully (skip +
  log), matching the existing reminder path. Never throws.
- **Time:** all comparisons in UTC; reminders created via the existing path
  which already handles `user_timezone`. The daily run hour is pinned
  deliberately (not 00:00 UTC, which splits the user's evening) — chosen at
  scheduling time and documented.
- **Contact deletion:** `contact_email_aliases` cascade-deletes (FK). Pending
  `interaction_review_queue` rows for that contact have `suggested_contact_id`
  nulled and are additionally **auto-dismissed** (not left dangling with a
  counterparty email pointing at a deleted person). Auto-written interactions
  follow the table's existing contact-deletion behavior (confirmed against
  live schema — see Open Items); pending `auto_followup` reminders for the
  contact self-cancel on the next run (already specified).

## Known v1 Limitations (accepted, documented)

- **Self-cancellation latency:** a follow-up can fire in the morning for a
  reply received overnight, because cancellation runs on the next daily sync.
  Accepted; the alternative (real-time) is an explicit Non-Goal.
- **Name-only calendar invites** are never auto-matched (review-only once).
- **Encryption key rotation** requires re-running the setup script.
- Single Google account per user (no multi-account inbox aggregation in v1).

## Testing

Establish Vitest (named in `CLAUDE.md` as the intended unit framework; no
harness exists yet). Pure logic extracted from the Deno handler into modules so
it is unit-testable without the Deno runtime. Supabase client mocked; Google
API responses fixtured.

- **Matching/confidence:** primary match, alias match, no match,
  multi-recipient threads, no-reply denylist, video-vs-meeting classification.
- **Idempotency:** same thread/event synced twice → exactly one row per
  contact; updates in place.
- **Thread collapsing:** multi-message thread → one row, correct
  last-direction and count.
- **Follow-up rule engine:** each tier fires correctly at the configured
  threshold; custom `followup_settings` values are honored; missing settings
  row falls back to defaults; `enabled = false` skips creation but
  self-cancellation still runs; self-cancellation on inbound reply; no
  duplicate auto-reminders; limit-respecting.
- **Settings API:** validation rejects out-of-range/non-integer values; PUT is
  user-scoped and idempotent.
- **Alias learning:** reassign writes alias; later match resolves via it;
  re-reassign moves (not duplicates) and triggers the conflict warning.
- **Token encryption:** round-trip encrypt→store→decrypt yields the original;
  wrong key fails closed (no plaintext fallback); tampered ciphertext fails
  GCM auth.
- **Identity matching:** sent mail from an owned alias classifies as outbound;
  mail from an alias is never treated as a contact; missing-identity behavior.
- **Sync window:** missed-run gap is covered (watermark, not fixed 2 days);
  pagination exhausts `nextPageToken`; per-run cap → `partial`, watermark not
  over-advanced; failed run leaves watermark untouched.
- **Calendar:** declined/tentative/all-day skipped; recurring series collapses
  to one interaction with correct occurrence count.
- **Budget isolation:** auto-followups exhausting their budget do not block
  manual reminder creation.

## Open Items for Implementation (hard prerequisites for the plan)

These must be resolved before/at the start of implementation — they are
blocking, not optional confirmations:

1. Confirm the exact mechanism scheduling `process-email-reminders` (pg_cron /
   Supabase scheduled trigger / external) and reuse it verbatim for
   `sync-google-interactions`, including the pinned run hour. No second
   scheduling system.
2. Confirm live `interactions` schema: column names, and especially the
   on-delete behavior of its `contact_id` FK (drives the contact-deletion
   handling above).
3. Confirm where the AES key (`GOOGLE_TOKEN_ENC_KEY`) is provisioned — Supabase
   Edge Function secret + local script env — and the exact GCM encoding
   (IV‖ciphertext‖tag layout) so script and Edge Function interoperate.
4. Confirm Gmail API quota headroom for the account at expected volume with the
   `metadata`-then-snippet fetch strategy.

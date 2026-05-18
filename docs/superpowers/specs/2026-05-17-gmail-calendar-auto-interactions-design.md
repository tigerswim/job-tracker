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

## Architecture

Three cooperating pieces, all reusing existing repo patterns.

### 1. One-time local OAuth setup script

`scripts/google-oauth-setup.ts` (run once, locally). Opens Google consent for
`https://www.googleapis.com/auth/gmail.readonly` and
`https://www.googleapis.com/auth/calendar.readonly` against Dan's own Google
Cloud project in "testing" mode (no Google app verification required for the
project owner). Captures the refresh token and upserts it into
`google_oauth_tokens` keyed by Dan's `user_id`.

### 2. New Edge Function: `sync-google-interactions`

Sibling of `supabase/functions/process-email-reminders/`. Same deployment and
scheduling mechanism (to be confirmed during implementation — the existing
function has no in-repo cron; whatever schedules it schedules this too). Runs
daily. Three sequential phases:

- **Phase A — Fetch & match.** Refresh the Google access token from the stored
  refresh token. Pull the last ~2 days of Gmail threads and Calendar events
  (2-day overlap window for safety; idempotency makes re-seeing free). For each
  thread/event, extract counterparty email(s), resolve to a contact, classify
  confidence.
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
  → Edge Function (fetch → match → write → rule engine)
  → Supabase (interactions / interaction_review_queue / email_reminders / contact_email_aliases)
  → Review UI (Network tab card)
  → on assign: contact_email_aliases written
  → next sync resolves more emails automatically
```

## Data Model

Migrations: establish `supabase/migrations/` (does not exist today; no `.sql`
files in repo). Timestamped SQL files, version-controlled. Document the
convention in `CLAUDE.md`.

### New table: `google_oauth_tokens`

```
user_id            uuid PK references auth.users
refresh_token      text not null
access_token       text
access_expires_at  timestamptz
scopes             text
error_state        text          -- set when refresh fails (e.g. 'revoked')
created_at         timestamptz default now()
updated_at         timestamptz default now()
```
RLS: service-role only. Never client-exposed.

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
RLS by `user_id`. One alias email maps to exactly one contact; reassign updates
the existing row rather than duplicating.

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
+ external_id text null     -- gmail thread id / gcal event (occurrence) id
+ source      text null     -- 'gmail' | 'gcal' | null (manual entry, unchanged)
UNIQUE partial index (user_id, contact_id, source, external_id)
  WHERE external_id IS NOT NULL
```
The `contact_id` is part of the unique key so one Gmail thread involving two
contacts can produce one row per contact without colliding. The partial
predicate keeps existing manual rows (`external_id IS NULL`) out of the index.

## Matching & Confidence Logic

For each Gmail thread / Calendar event:

**Extract counterparty email(s):**
- *Gmail*: per message, the address that is not Dan's (From if inbound;
  To/Cc if outbound). Threads can involve multiple people → produce an
  interaction per matched contact.
- *Calendar*: every attendee whose email ≠ Dan's. Organizer-only / no-attendee
  events → skipped (no counterparty = not a touchpoint).

**Resolve email → contact (in order):**
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

**Accepted trade-off:** a calendar invite with only a name (no email) cannot be
auto-matched (name matching too unreliable). It becomes a review item assigned
by hand once; if that person's calendar email is later learned as an alias via
a Gmail match, future events auto-resolve.

## Thread Collapsing & Idempotent Upsert

**Gmail — one living interaction per thread per contact:**
- Key: `(user_id, contact_id, 'gmail', thread_id)`.
- First matched message → create: `type:'email'`, `date` = message date,
  `summary` = thread subject, `notes` = `"Email thread — N message(s), last:
  <inbound|outbound>, <date>\n\n<latest snippet>"`.
- Subsequent syncs → update in place: bump `date` to newest message, rewrite
  count/last-direction line, refresh snippet. Subject preserved.

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

"Direction": from the last-direction recorded in `notes` for Gmail. Calendar
`meeting`/`video_call` = outbound-equivalent (ball in Dan's court).

**Open-loop detection (creates reminders).** Thresholds below are the seeded
defaults; the live values come from `followup_settings`:

| Trigger | Threshold (setting) | Reminder |
|---------|---------------------|----------|
| Outbound email, thread last-direction still outbound | `email_no_reply_days` (default 7), no inbound after | "Follow up with {name} — no reply to your note" |
| `meeting` / `video_call` | `meeting_no_followup_days` (default 14), no outbound logged after it | "Send {name} the follow-up from your conversation" |
| Any outbound, no reply | `gone_quiet_days` (default 30) | "Reconnect with {name} — gone quiet" |

- Created via the existing reminder path; respects `checkReminderLimits`
  (`MAX_ACTIVE_REMINDERS: 100`, `MAX_DAILY_REMINDERS: 15`); on limit → skip +
  log, never throw.
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

**Edit-before-commit flow:** tapping a queue item opens it in the existing
right-slide panel, reusing `InteractionForm` seeded with detected values. All
fields editable before any real interaction is written:
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
- **Bulk:** "Accept all suggested" (commit detected values unchanged) and
  "Dismiss all" for backlog clearing. Secondary to the open-and-edit default.

Empty state: "No detected interactions — you're all caught up. New emails and
meetings with your contacts appear here daily." No realtime; refetch on view
and after each action.

**Follow-up settings.** A small settings panel (right-slide panel, consistent
pattern), reached from the Detected card header (e.g. a gear/"Follow-up
settings" link). Fields: a master enable toggle and three day-count number
inputs (`email_no_reply_days`, `meeting_no_followup_days`, `gone_quiet_days`)
with inline labels explaining each ("Remind me to follow up if there's no reply
to my note after N days"). Client-side validation mirrors the API (integer
1–365). Persists via a new `GET`/`PUT /api/followup-settings` route pair
(auth-checked, user-scoped, same pattern as `/api/reminders`). Saving takes
effect on the next daily sync run.

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
  which already handles `user_timezone`.

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
  re-reassign updates not duplicates.

## Open Items for Implementation

- Confirm the exact mechanism scheduling `process-email-reminders` and reuse it
  verbatim for `sync-google-interactions` (no second scheduling system).
- Confirm `interactions` table column names against live Supabase schema before
  writing the migration.

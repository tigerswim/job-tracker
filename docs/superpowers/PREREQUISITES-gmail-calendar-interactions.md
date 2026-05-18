# Prerequisites — Gmail/Calendar Auto-Sourced Interactions

These must be done by **you** (they need credentials, live DB access, or an
interactive browser consent). They block Phase 3 onward. Phases 0–2 (test
harness, schema SQL file, all pure-logic modules) are already implemented and
committed on branch `worktree-feat+gmail-calendar-interactions`.

Spec:  `docs/superpowers/specs/2026-05-17-gmail-calendar-auto-interactions-design.md`
Plan:  `docs/superpowers/plans/2026-05-17-gmail-calendar-auto-interactions.md`

When all five are done, tell Claude "prerequisites done" and it resumes at
Phase 3.

---

## P1 — Confirm how `process-email-reminders` is scheduled

**Why:** The new `sync-google-interactions` Edge Function must reuse the exact
same scheduling mechanism (no second scheduler). The repo has no in-repo cron
config, so the existing function is scheduled externally.

**What to find:**
- Mechanism: Supabase scheduled trigger / `pg_cron` / external cron (e.g. a
  Netlify scheduled function or GitHub Action hitting the function URL)?
- The exact time it runs.

**Where to look:**
- Supabase Dashboard → Edge Functions → `process-email-reminders` → check for a
  schedule/cron config.
- Supabase Dashboard → Database → Extensions → is `pg_cron` enabled? If so:
  SQL editor → `select * from cron.job;`
- Your Netlify dashboard / any external scheduler you set up.

**Decision needed:** Pick the daily run hour for the new sync. Do **not** use
00:00 UTC (splits your evening). A sensible choice: ~05:00 America/New_York
(i.e. 09:00 or 10:00 UTC depending on DST) so the queue is ready each morning.

**Hand back to Claude:** the mechanism + the chosen run hour.

### ✅ RESOLVED (2026-05-18)

Mechanism: **`pg_cron` + `net.http_post`** to the Edge Function URL with an
`Authorization: Bearer <anon JWT>` header. Two existing jobs:
- `process-email-reminders` — `*/5 * * * *` (every 5 min)
- `cleanup-old-reminders` — `0 2 * * 0` (Sun 02:00 UTC) — daily/weekly style to copy

pg_cron schedules are **UTC**.

**Decided run hour for `sync-google-interactions`: `0 9 * * *`**
(09:00 UTC = 05:00 EDT / 04:00 EST). Clear of both existing jobs; review queue
ready each morning Eastern.

**Implementation notes for the plan (Phase 4):**
- Add a third `cron.job` mirroring the `process-email-reminders` command
  shape: `net.http_post` to
  `https://bpaffcxxhkxchyfhyrwg.supabase.co/functions/v1/sync-google-interactions`
  with the same anon-JWT bearer header, `body := '{}'::jsonb`, schedule
  `0 9 * * *`, jobname `sync-google-interactions`.
- The new function is invoked with the **anon JWT**, so it must NOT require
  user auth. It already operates service-role internally via `SYNC_USER_ID`;
  just ensure it does not reject the anon bearer caller.
- The cron-creation SQL is itself a migration-style script the user runs in
  the Supabase SQL editor (same as the existing jobs were set up); Claude will
  provide it verbatim in Phase 4.

---

## P2 — Confirm live `interactions` (and related) schema

**Why:** The migration alters `interactions` and `email_reminders` and creates
a unique index on `(user_id, contact_id, source, external_id)`. If a column
name differs from assumptions, the migration fails on apply.

**Run in Supabase SQL editor:**
```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'interactions'
order by ordinal_position;

select column_name, data_type
from information_schema.columns
where table_name = 'email_reminders'
order by ordinal_position;

-- on-delete behavior of interactions.contact_id FK
select conname, confdeltype
from pg_constraint
where conrelid = 'interactions'::regclass and contype = 'f';
```
`confdeltype`: `c`=cascade, `n`=set null, `a`=no action, `r`=restrict.

**Hand back to Claude:** the column lists + the `contact_id` FK delete type
(this drives the contact-deletion handling in the spec).

### PARTIAL (2026-05-18)

FK delete behavior confirmed:
- `interactions_contact_id_fkey` → `confdeltype = c` (**CASCADE**)
- `interactions_user_id_fkey` → `confdeltype = c` (CASCADE)

Impact: design holds as written. Deleting a contact cascade-deletes their
interactions (incl. Gmail/Calendar-sourced). Rule engine's "trigger
interaction gone → cancel" path (`shouldSelfCancel`, Task 8) cleans up the
contact's pending auto-followup reminders on the next run. `review_queue`
rows are unaffected by cascade (they use `on delete set null` on
`suggested_contact_id`) — handled separately as already planned. **No
migration change required.**

### ✅ RESOLVED (2026-05-18)

Column lists captured.

`interactions`: id(uuid,NO), user_id(uuid,**YES**), contact_id(uuid,YES),
date(**date**,YES), type(text,NO), summary(text,NO), notes(text,YES),
created_at(timestamptz,YES), updated_at(timestamptz,YES).

`email_reminders`: id, user_id, contact_id, job_id, scheduled_time(tstz),
user_timezone, email_subject, email_body, user_message, status, created_at,
sent_at, error_message — all present; confirms Task 13 must populate
email_subject/email_body/scheduled_time via the existing reminder generator.

**Two findings + the resolution:**

1. **`interactions.date` is type `date` (day-only), sync writes full ISO
   timestamps.** DECISION (user): alter the column to `timestamptz`.
   Verified safe — only code usage is `.order('date', ...)` (sort unaffected);
   no equality/range filters; ContactForm date input coerces fine.
   **MIGRATION CHANGE APPLIED:** added
   `alter table interactions alter column date type timestamptz using date::timestamptz;`
   to `0001_auto_interactions_schema.sql` (commit recorded below).

2. **`interactions.user_id` is nullable.** The partial unique index
   `(user_id, contact_id, source, external_id)` treats NULL as distinct, so a
   soft-deleted synced row (user_id→null) could be re-created as a duplicate
   on next sync. KNOWN EDGE, low severity for single-user (synced rows are not
   soft-deleted). No migration change; documented as an accepted limitation.

P2 fully resolved. No remaining blockers in P2.

---

## P3 — Provision the token encryption key `GOOGLE_TOKEN_ENC_KEY`

**Why:** The Google refresh token is encrypted at rest with AES-256-GCM. The
key is 32 bytes, hex-encoded (64 hex chars). It must exist in BOTH places:
the local setup script's environment AND the Edge Function's secrets. The same
key must be used in both — losing it means re-running OAuth setup.

**Generate the key (run locally, save the output securely — e.g. your password
manager):**
```bash
openssl rand -hex 32
```
That prints 64 hex characters. This is `GOOGLE_TOKEN_ENC_KEY`.

**Set it as a Supabase Edge Function secret:**
```bash
supabase secrets set GOOGLE_TOKEN_ENC_KEY=<the 64-hex value>
```
(Or Supabase Dashboard → Edge Functions → Secrets.)

**Also have it in your local env when you later run the OAuth setup script**
(P5). Easiest: add to a local, gitignored env file or export in the shell:
```bash
export GOOGLE_TOKEN_ENC_KEY=<the 64-hex value>
```

**Do NOT** commit this key anywhere. **Do NOT** paste it into chat.

**Hand back to Claude:** just confirm "key generated and set as Supabase
secret" — do not share the value.

### ✅ RESOLVED (2026-05-18)

User confirmed: key generated and set as Supabase Edge Function secret.
Value not shared (correct — never in chat or git).

**Verification deferred to Phase 4 first run:** correctness of the key
(exactly 64 hex chars, identical in Supabase secret AND local env for P5b)
cannot be checked here. The crypto module fails closed on a wrong/short key
(`hexToBytes` throws if length != 64; GCM decrypt rejects a mismatched key).
So a bad key surfaces immediately as a loud failure at OAuth setup (P5b) or
first Edge Function run — never as silent data corruption. If P5b errors with
a key-length or decrypt error, regenerate per the steps above and re-set both
places.

---

## P4 — Confirm Gmail + Calendar APIs are enabled in Google Cloud

**Why:** The sync calls Gmail and Calendar REST APIs. They must be enabled in
the Google Cloud project whose OAuth client you'll use.

**Steps (Google Cloud Console):**
1. Pick or create a Google Cloud project (your own — single-user, "testing"
   mode, no app verification needed for you as the project owner).
2. APIs & Services → Library → enable **Gmail API** and **Google Calendar
   API**.
3. APIs & Services → OAuth consent screen → User type **External**,
   publishing status **Testing**, and add your Google account
   (danhoeller@gmail.com) under **Test users**.
4. APIs & Services → Credentials → create an **OAuth 2.0 Client ID**, type
   **Desktop app** (the setup script uses a localhost loopback redirect:
   `http://localhost:53682/callback`). Note the **Client ID** and
   **Client secret**.

**Hand back to Claude:** confirm both APIs enabled + test user added. Have the
Client ID / secret ready as env vars for P5 (`GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`) — do not paste them into chat; put them in your local
gitignored env.

### ✅ MOSTLY RESOLVED (2026-05-18) — deviates from assumed "Testing" mode

Actual state (project "Job Tracker", shared with 4 existing OAuth clients):
- Gmail API + Google Calendar API: **enabled** ✅
- New **Desktop** OAuth client created (loopback flow compatible) ✅ — its
  Client ID/secret to be supplied as local env for P5b (not in chat/git).
- OAuth consent screen: **External**, publishing status **In Production**
  (NOT Testing as the plan originally assumed).

Implications of In-Production vs Testing:
- No "Test users" list applies in Production — step 3's test-user add is moot.
- `gmail.readonly` is a Google **restricted scope**. Production External apps
  normally need Google's security assessment for restricted scopes; the common
  exemption is the project owner consenting to their own app. The project's
  other Production clients already call Google APIs successfully for this
  account, so this is expected to work, but verification status was not
  confirmed from here.

OPEN CHECK before P5b: on the OAuth consent screen, confirm there is no
"verification required" block on `gmail.readonly`/`calendar.readonly`. If the
P5b consent shows an "unverified app" interstitial, proceed via
**Advanced → go to {app} (unsafe)** as the project owner — this is the
accepted single-user path; recorded here as a known v1 limitation (single
owner, unverified app, self-consent).

Consent screen "Data access status" showed (2026-05-18): *"Verification is not
required since your app is not requesting any sensitive or restricted
scopes."* This reflects scopes **registered on the consent screen**, NOT the
scopes the setup script requests dynamically at runtime
(`gmail.readonly` restricted, `calendar.readonly` sensitive). Expected P5b
behavior: owner self-consent succeeds via the "unverified app → Advanced →
proceed" path. **Do NOT add these scopes to the consent screen to "fix" this**
— pre-registering restricted scopes would itself trigger a Google
verification requirement we currently don't have. Leave as-is; resolves at
P5b. If P5b instead returns a hard "access blocked / request is invalid",
report it — fallback is keeping the grant owner-only / re-evaluating scope
registration.

---

## P5 — Apply the migration + run OAuth setup (after Phase 3 builds the script)

**Order matters.** P5 happens partly now (migration) and partly after Phase 3
(OAuth script doesn't exist yet).

### P5a — Apply the schema migration (can do now)
The migration file exists:
`supabase/migrations/0001_auto_interactions_schema.sql`

After P2 confirms column names match, apply it:
```bash
supabase db push
```
Verify the 6 new tables exist and the two `interactions` indexes were created.

### P5b — Run OAuth setup (only after Claude completes Phase 3)
Phase 3 creates `scripts/google-oauth-setup.ts` + an `npm run oauth:setup`
script. You'll then run, with these env vars set locally:
```
GOOGLE_CLIENT_ID=...            # from P4
GOOGLE_CLIENT_SECRET=...        # from P4
GOOGLE_TOKEN_ENC_KEY=...        # from P3 (same value as Supabase secret)
NEXT_PUBLIC_SUPABASE_URL=...    # existing
SUPABASE_SERVICE_ROLE_KEY=...   # existing (service role, server-side only)
SYNC_USER_ID=...                # your auth.users id (see below)
```

**Find your `SYNC_USER_ID`** (Supabase SQL editor):
```sql
select id, email from auth.users where email = 'danhoeller@gmail.com';
```

> ⚠️ **Running from a git worktree?** `.env.local` is gitignored, so it is
> **NOT** copied into a worktree when the worktree is created. The OAuth
> script loads `.env.local` from the package root (via `npm run`, mirroring
> `scripts/sync-to-obsidian.ts`). If you run `npm run oauth:setup` from a
> worktree without `.env.local` present there, it fails immediately with
> `Error: Missing env GOOGLE_CLIENT_ID` even though the file exists in the
> main checkout. Fix: copy it into the worktree first (the worktree's
> `.env.local` is also gitignored — verified — so it cannot be committed):
> ```bash
> cp /path/to/main/checkout/.env.local /path/to/worktree/.env.local
> ```
> The copy lives only as long as the worktree; remove the worktree and it
> goes with it. Same machine, same gitignore — no broadened exposure.

Then:
```bash
npm run oauth:setup
```
It opens a Google consent page; approve gmail.readonly + calendar.readonly +
gmail.settings.basic. On success it writes an encrypted token row and seeds
`sync_identity` with your send-as addresses. Verify in Supabase that
`google_oauth_tokens` has one row and `sync_identity` lists all your email
addresses (add any missing ones later via the Settings panel built in Phase 6).

If it errors `Missing env GOOGLE_CLIENT_ID`: that variable isn't visible to
the process. Check, in order: (1) `.env.local` is present in the directory
`npm run` executes from (worktree caveat above); (2) the key is named exactly
`GOOGLE_CLIENT_ID` (not `NEXT_PUBLIC_`-prefixed); (3) no spaces around `=` and
the line isn't commented. Diagnose the name without exposing the value:
`grep -oE '^[A-Z_]*GOOGLE_CLIENT_ID' .env.local`.

---

### ✅ P5a RESOLVED (2026-05-18)

`supabase db push` applied `0001_auto_interactions_schema.sql` cleanly against
the remote (migration list showed local 0001 / empty remote slot — the safe
case; no repair/baseline needed). Verified:
- 6 new tables present: contact_email_aliases, followup_settings,
  google_oauth_tokens, interaction_review_queue, sync_identity, sync_runs.
- interactions.date is now `timestamp with time zone` (the widen fix landed).

P5b (run `npm run oauth:setup`) still pending — the script does not exist
until Phase 3 is built.

---

### ✅ P5b RESOLVED (2026-05-18)

`npm run oauth:setup` completed (from the worktree, after copying `.env.local`
in and adding `SYNC_USER_ID`). Passed the "unverified app → Advanced →
proceed" path as project owner (expected, documented). Encrypted token row
written to `google_oauth_tokens`; `sync_identity` seeded from send-as
addresses.

All prerequisites P1–P5 resolved. Remaining = deploy steps (not prerequisites):
Edge Function deploy + secrets, apply `0002` cron migration, first-run smoke.

---

## ✅ FIRST SUCCESSFUL END-TO-END RUN (2026-05-18)

`curl` invoke → HTTP 200 `{"ok":true,"followups":{"created":0,"cancelled":0}}`.
`sync_runs`:
- gmail: success, seen 13, queued 15, skipped 2 (noise floor)
- gcal: success, seen 4, queued 4, skipped 1941 (all-day/declined/no-external-attendee)
- items_written 0 (Gmail always → review; the 4 gcal attendees had no contact
  match yet → review, by design). followups 0 (no accepted history yet).

Bugs fixed during deploy (all committed on branch):
- shell/paste mechanics (multi-line curl) — operational, not code
- SUPABASE_URL vs NEXT_PUBLIC_ env name
- crypto: Node Buffer → Web-standard btoa/atob (Deno has no Buffer)
- token storage: Buffer→bytea JSON corruption → base64 in text columns
  (migration 0003 + setup script + edge function, 3 coordinated changes)
- migration 0003 ordering: delete rows before altering NOT NULL columns

Cron (migration 0002) is live: daily 09:00 UTC.

Remaining: exercise the review UI in-app (confirm/dismiss queued items,
assign contacts → alias learning), then follow-ups begin accruing.

## Quick checklist

- [ ] P1 — scheduling mechanism + run hour identified
- [ ] P2 — `interactions`/`email_reminders` columns + FK delete type captured
- [ ] P3 — `GOOGLE_TOKEN_ENC_KEY` generated, set as Supabase secret, saved locally
- [ ] P4 — Gmail + Calendar APIs enabled, OAuth client created, test user added
- [ ] P5a — migration applied (`supabase db push`) and verified
- [ ] P5b — (after Phase 3) `npm run oauth:setup` run, token + identity verified

When P1–P4 + P5a are done, tell Claude — it resumes Phase 3 (builds the OAuth
script), then you do P5b, then it continues Phases 4–7.

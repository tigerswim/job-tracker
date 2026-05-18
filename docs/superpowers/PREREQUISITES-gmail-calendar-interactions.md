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

Then:
```bash
npm run oauth:setup
```
It opens a Google consent page; approve gmail.readonly + calendar.readonly +
gmail.settings.basic. On success it writes an encrypted token row and seeds
`sync_identity` with your send-as addresses. Verify in Supabase that
`google_oauth_tokens` has one row and `sync_identity` lists all your email
addresses (add any missing ones later via the Settings panel built in Phase 6).

---

## Quick checklist

- [ ] P1 — scheduling mechanism + run hour identified
- [ ] P2 — `interactions`/`email_reminders` columns + FK delete type captured
- [ ] P3 — `GOOGLE_TOKEN_ENC_KEY` generated, set as Supabase secret, saved locally
- [ ] P4 — Gmail + Calendar APIs enabled, OAuth client created, test user added
- [ ] P5a — migration applied (`supabase db push`) and verified
- [ ] P5b — (after Phase 3) `npm run oauth:setup` run, token + identity verified

When P1–P4 + P5a are done, tell Claude — it resumes Phase 3 (builds the OAuth
script), then you do P5b, then it continues Phases 4–7.

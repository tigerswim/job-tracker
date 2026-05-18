# Follow-up Project: Multi-User Gmail/Calendar Sync

**Status:** Not started. The shipped feature is **single-user by design**.
**Created:** 2026-05-18
**Context:** The Gmail/Calendar auto-interactions feature was built and shipped
single-user (one hardcoded `SYNC_USER_ID`). The schema was deliberately
designed `user_id`-keyed so multi-user is an *additive* project, not a
rewrite — but it is real, substantial work, not a settings toggle.

## Why the current feature is single-user

- The Edge Function `sync-google-interactions` reads exactly one
  `SYNC_USER_ID` env var and syncs only that account.
- The pg_cron job (migration 0002) invokes the function once per schedule
  with no per-user fan-out.
- OAuth setup is a manual local script (`npm run oauth:setup`) run once for
  one Google account; there is no in-app "Connect Google" flow.
- The Google Cloud OAuth client belongs to the owner's project; other users
  hit the unverified-app wall (Google verification exists for exactly this).

A different logged-in user today sees an empty Detected card ("No sync yet")
— not broken, just inert for them.

## What multi-user requires (scope)

1. **In-app Google connect flow.** Replace the local OAuth script with an
   authenticated in-app flow: user clicks "Connect Google", consents,
   the callback encrypts and stores their refresh token in
   `google_oauth_tokens` (already `user_id`-keyed — schema ready). Reuse the
   existing AES-256-GCM `crypto.ts`.
2. **Per-user sync fan-out.** The Edge Function must iterate every user with
   a valid `google_oauth_tokens` row instead of one `SYNC_USER_ID`. Each
   user's `sync_identity`, contacts, aliases, watermark (`sync_runs` is
   already `user_id`-keyed) processed independently. Per-user error
   isolation so one bad token doesn't halt the batch.
3. **Cron / scheduling.** Either the function self-fans-out over all users
   per run, or scheduling becomes per-user. Mind Edge Function execution
   time limits with many users (may need batching/queueing).
4. **Google app verification.** `gmail.readonly` is a restricted scope.
   Production multi-user (non-owner accounts) requires Google's security
   assessment / OAuth verification — a weeks-long external process with
   possible cost. Until then, only test users / owner can consent.
5. **Settings UI.** The Sync & follow-up settings panel and `sync_identity`
   editor are already per-user (RLS by `user_id`) — these mostly work
   as-is once per-user sync exists. The "Connect/Disconnect Google" control
   is the main new UI.
6. **Per-user rate/budget.** `followup_settings.max_auto_followups_per_day`
   is already per-user. Verify the reminder rate-limit interactions hold
   under many users.
7. **Onboarding / empty states.** A user who hasn't connected Google needs a
   clear "Connect Google to enable" state in the Detected card instead of
   the current "No sync yet".

## What is already done (the additive groundwork)

- All feature tables are `user_id`-keyed with RLS (`google_oauth_tokens`,
  `sync_identity`, `contact_email_aliases`, `interaction_review_queue`,
  `followup_settings`, `sync_runs`).
- Token encryption (`crypto.ts`) is per-row, runtime-agnostic, tested.
- Pure matching/rule logic is user-agnostic and unit-tested.
- Review UI / settings panel / APIs are auth-scoped per logged-in user.

The remaining work is concentrated in: the in-app OAuth connect flow, the
sync fan-out loop, scheduling at scale, and (external, gating) Google app
verification.

## Recommended sequencing when picked up

Treat as its own spec → plan → implementation cycle (do NOT bolt onto the
single-user code ad hoc). Google app verification should be started early —
it is the long external pole and blocks real non-owner usage regardless of
how fast the code lands.

---

## Security follow-up: rotate the Supabase anon key (recommended, not urgent)

During development the Supabase **anon** JWT was committed in migration
`0002` (mirrored from the pre-existing `process-email-reminders` cron
pattern). It was removed from `main` via squash-merge (main history is
clean) and moved to Supabase Vault (`0002` rewrite + `0005`). However:

- The key still exists in the abandoned feature branch's git history and in
  GitGuardian's incident record.
- The same anon key was *already* committed in the pre-existing
  `process-email-reminders` cron job before this work.

The anon key is the **public, RLS-gated** client key (shipped to browsers),
not `service_role`, so severity is low. But best practice for any committed
credential is rotation. **Recommended**, deferred by decision (2026-05-18):

### IMPORTANT nuance (discovered 2026-05-18)

Supabase's anon key is a JWT signed by the project's JWT secret. There is no
isolated "rotate anon key only" — rotating it means **rolling the project
JWT secret**, which **also invalidates the `service_role` key**. Every
consumer of *either* key must be updated in a tight window or production
breaks. This is a whole-project credential rotation.

### Complete consumer inventory (must all be updated)

ANON key consumers:
- Frontend / app env: `NEXT_PUBLIC_SUPABASE_ANON_KEY` — local `.env.local`
  AND Netlify environment variables (production).
- Vault secret `sync_cron_anon_key` (used by the `sync-google-interactions`
  cron via migration `0005`).
- **Pre-existing** `process-email-reminders` pg_cron job — hardcoded anon
  JWT in its `cron.command` (NOT Vault; predates this work). Will break the
  email reminder system at cutover if not updated.

SERVICE_ROLE key consumers:
- `.env.local` `SUPABASE_SERVICE_ROLE_KEY` (used by OAuth setup script).
- Supabase Edge Function secrets: `SUPABASE_SERVICE_ROLE_KEY` (and the
  separately-stored `SUPABASE_ANON_KEY` secret).
- Netlify env (if any server-side route uses service role).

Unaffected: `cleanup-old-reminders` cron (pure SQL, no key);
`.env.local.example` (no real keys).

### Ordered runbook (minimize the broken window)

Do these in order. The app/cron is briefly inconsistent between step 1 and
the completion of step 4 — run during low traffic.

1. **Roll the JWT secret.** Supabase Dashboard → Project Settings → API →
   "JWT Settings" → generate new secret. Note: this immediately invalidates
   old anon AND service_role. Copy the **new** anon key and **new**
   service_role key from the same page.
2. **Update Edge Function secrets** (so the deployed sync function keeps
   working): `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<new>` and
   `SUPABASE_ANON_KEY=<new>` (do not paste values in chat — run locally).
3. **Update the Vault secret** for the sync cron:
   `select vault.update_secret((select id from vault.secrets where
   name='sync_cron_anon_key'), '<new anon key>');` then re-apply `0005`
   (`supabase db push`) so the sync cron job is rebuilt with the new key.
4. **Fix the pre-existing `process-email-reminders` cron** (it hardcodes
   the old anon key): reschedule it with the new key. Cleanest: also move it
   to Vault (`select cron.unschedule('process-email-reminders');` then
   reschedule reading from a Vault secret, mirroring the 0002/0005 pattern).
   Minimum viable: reschedule with the new anon JWT inline (but that
   re-introduces the same hardcoded-secret smell — prefer Vault).
5. **Update local `.env.local`**: `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
   `SUPABASE_SERVICE_ROLE_KEY` to the new values.
6. **Update Netlify env vars** (production frontend): same two vars in the
   Netlify dashboard → Site settings → Environment variables.
7. **Redeploy the app** (Netlify) so the frontend ships the new anon key.
8. **Verify**: app loads/auths; `curl` smoke of the sync function returns
   200; manually trigger `process-email-reminders` or wait for its 5-min
   cycle and check `reminder_logs`; check `sync_runs` after a sync.
9. **Resolve the GitGuardian incident** as remediated + rotated.

Not blocking; tracked here so it isn't lost.

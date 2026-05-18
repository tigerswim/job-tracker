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

### CORRECTED APPROACH (2026-05-18) — migrate off legacy keys, do NOT roll the JWT secret

The project is on Supabase's newer API-key model (Dashboard shows
"Publishable and secret API keys" + a "Legacy anon, service_role API keys"
tab + a "Disable legacy API keys" control). Per Supabase docs:

- Legacy `anon`/`service_role` are both derived from the project JWT secret;
  you cannot rotate one without the other, and rolling the legacy JWT secret
  invalidates BOTH and "can cause significant issues in production". This is
  the destructive option and is NOT recommended.
- **Recommended remediation: migrate consumers to the new
  `sb_publishable_...` / `sb_secret_...` keys, then *disable legacy API
  keys*.** Disabling legacy keys makes the leaked legacy anon JWT
  permanently inert — true remediation — WITHOUT a JWT-secret roll.
- New publishable keys are RLS-gated and browser-safe, functionally
  equivalent to the old anon key (anon role unauthenticated, authenticated
  role after login).
- Edge Functions: newer runtime supports the new keys via `auth: 'secret'` /
  `auth: 'publishable'` modes; for pg_cron→function service calls, pass the
  **secret** key on the `apikey` header (keep `verify_jwt` default; do NOT
  blanket `--no-verify-jwt`).

### Consumer inventory (all must move to new keys before disabling legacy)

Publishable-key (browser/anon) consumers:
- Frontend env `NEXT_PUBLIC_SUPABASE_ANON_KEY` → new `sb_publishable_...`
  (local `.env.local` AND Netlify env). Confirm the supabase-js client
  accepts the publishable key in the project's client-init code.
- `sync-google-interactions` cron: today uses Vault `sync_cron_anon_key`
  via `0005`. Switch to the new secret key + `apikey` header (service call,
  not a browser context — secret is appropriate). New migration `0006` to
  reschedule; update/replace the Vault secret accordingly.
- Pre-existing `process-email-reminders` cron: hardcoded legacy anon JWT in
  `cron.command`. Reschedule to use the new secret key from Vault (mirror
  the 0002/0005 pattern; do NOT re-hardcode).

Secret-key (server/service_role) consumers:
- `.env.local` `SUPABASE_SERVICE_ROLE_KEY` (OAuth setup script) → new
  `sb_secret_...`.
- Edge Function secrets `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_ANON_KEY` →
  new secret/publishable.
- Any server-side route using service role (audit `src/app/api/**` +
  Netlify server env).

Unaffected: `cleanup-old-reminders` (pure SQL); `.env.local.example`.

### Ordered runbook (no JWT-secret roll; legacy stays valid until step 7)

Because legacy keys keep working until explicitly disabled, this can be done
WITHOUT a hard cutover window — migrate consumers incrementally, verify,
then disable legacy last.

1. Dashboard → API Keys → "Publishable and secret API keys" → create a
   **publishable** key and a **secret** key. Copy both (store securely; never
   in chat/git).
2. Verify client compatibility: confirm `@supabase/supabase-js` version in
   use accepts `sb_publishable_...` for the browser client and
   `sb_secret_...` server-side (check supabase-js docs for the installed
   version; older versions may need an upgrade — assess before proceeding).
3. Update Edge Function secrets to the new keys (`supabase secrets set ...`).
4. Migration `0006`: reschedule BOTH crons (`sync-google-interactions`,
   `process-email-reminders`) to call the function with the new **secret**
   key on the `apikey` header, sourced from a Vault secret. Redeploy the
   sync function if its invocation/auth handling needs adjustment for the
   new key mode; re-verify with a manual curl + `sync_runs`.
5. Update `.env.local` + Netlify env to the new publishable/secret keys.
6. Redeploy the app (Netlify); verify auth/login, data loads, an API route,
   and both crons run green (`reminder_logs`, `sync_runs`).
7. **Only after all consumers verified on new keys**: Dashboard → "Disable
   legacy API keys". This is what neutralizes the leaked legacy anon key.
8. Resolve the GitGuardian incident as remediated (legacy key disabled).

### Status

Plan corrected and reviewed 2026-05-18; **execution deferred** by decision —
run in a low-traffic window. This is now its own small project (touches
client init, both crons, edge-function auth mode, prod env) — treat the
runbook above as the spec. Not blocking; the leaked key is the public
RLS-gated legacy anon key (low severity) and remains so until disabled here.

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

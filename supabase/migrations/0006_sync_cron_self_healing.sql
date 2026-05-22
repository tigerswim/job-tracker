-- 0006 makes the sync-google-interactions cron schedule SELF-HEALING.
--
-- ROOT CAUSE this migration fixes (observed 2026-05-22): the
-- sync-google-interactions cron job was silently absent for an extended
-- period — every sync_runs row was a manual invocation, none at 09:00 UTC.
--
-- Two latent bugs in 0002/0005 caused this:
--   1. `cron.unschedule(name)` RAISES an exception when the job does not
--      exist. In 0005 the unschedule runs before the schedule; if 0005 was
--      applied while no cron job existed (because 0002 skipped scheduling
--      on a missing Vault secret), the exception aborted the whole DO block
--      and `cron.schedule` never ran — leaving no job, silently.
--   2. Nothing ever re-asserted the schedule afterwards, so a missing job
--      stayed missing until someone noticed syncs had stopped.
--
-- This migration:
--   (a) registers the cron job idempotently, guarding the unschedule so a
--       missing job is not an error; and
--   (b) installs a monthly watchdog cron that re-asserts the daily job, so
--       if it ever disappears again it self-repairs within ~1 month instead
--       of silently never running.
--
-- The anon key still comes from Vault secret `sync_cron_anon_key` (never in
-- committed source). Unlike 0002/0005, if the secret is missing this
-- migration RAISES rather than silently skipping — a missing secret is a
-- setup error that should fail loudly, not leave a half-configured system.

-- Reusable, idempotent scheduler. Safe to call repeatedly. Used both here
-- and by the watchdog below.
create or replace function public.ensure_sync_google_cron()
returns void
language plpgsql
security definer
as $fn$
declare
  anon_key text;
begin
  select decrypted_secret into anon_key
  from vault.decrypted_secrets
  where name = 'sync_cron_anon_key';

  if anon_key is null then
    raise exception
      'Vault secret sync_cron_anon_key missing — provision it before applying 0006 '
      '(see migration 0005 header for vault.create_secret syntax).';
  end if;

  -- Guarded unschedule: cron.unschedule() errors if the job is absent, so
  -- only call it when the job actually exists.
  if exists (select 1 from cron.job where jobname = 'sync-google-interactions') then
    perform cron.unschedule('sync-google-interactions');
  end if;

  perform cron.schedule(
    'sync-google-interactions',
    '0 9 * * *',
    format($job$
      select net.http_post(
        url := 'https://bpaffcxxhkxchyfhyrwg.supabase.co/functions/v1/sync-google-interactions',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer %s'
        ),
        body := '{}'::jsonb
      ) as request_id;
    $job$, anon_key)
  );

  raise notice 'sync-google-interactions cron ensured (0 9 * * *).';
end;
$fn$;

-- (a) Register the daily job now.
select public.ensure_sync_google_cron();

-- (b) Monthly watchdog: re-asserts the daily job on the 1st of each month at
-- 08:00 UTC (one hour before the daily run, so a repair takes effect same
-- day). Idempotent — re-running ensure_sync_google_cron() just rewrites the
-- existing schedule. Guarded unschedule for the watchdog itself, too.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'sync-google-cron-watchdog') then
    perform cron.unschedule('sync-google-cron-watchdog');
  end if;

  perform cron.schedule(
    'sync-google-cron-watchdog',
    '0 8 1 * *',
    'select public.ensure_sync_google_cron();'
  );

  raise notice 'sync-google-cron-watchdog installed (0 8 1 * *).';
end $$;

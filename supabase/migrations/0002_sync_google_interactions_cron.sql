-- Schedule the daily Gmail/Calendar sync via pg_cron.
-- Run hour: 09:00 UTC (= 05:00 ET). Idempotent: unschedule if exists first.
--
-- The function is invoked with the Supabase anon key (RLS-gated; the function
-- runs service-role internally via SYNC_USER_ID). The key is NOT hardcoded
-- here — it is read at job-build time from Supabase Vault secret
-- 'sync_cron_anon_key'. Provision it once (service-role / SQL editor):
--
--   select vault.create_secret(
--     '<anon JWT>', 'sync_cron_anon_key',
--     'Anon key used by the sync-google-interactions pg_cron job');
--
-- (Migration 0005 ensures this and (re)schedules against the live DB.)

do $$
begin
  perform cron.unschedule('sync-google-interactions');
exception when others then null;
end $$;

do $$
declare
  anon_key text;
begin
  select decrypted_secret into anon_key
  from vault.decrypted_secrets
  where name = 'sync_cron_anon_key';

  if anon_key is null then
    raise notice 'Vault secret sync_cron_anon_key not found; skipping schedule. Provision it then run migration 0005.';
    return;
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
end $$;

-- 0002 originally hardcoded the Supabase anon JWT in the cron job body
-- (flagged by secret scanning). This migration moves it to Supabase Vault
-- and reschedules the LIVE cron job to read it from there, so no JWT is
-- stored in committed migration source.
--
-- The anon key is the public, RLS-gated client key (not service_role) — low
-- sensitivity, but it should not live in version control regardless.
--
-- IMPORTANT: this migration does NOT contain the key. Provision the Vault
-- secret ONCE before/with applying this (service-role; SQL editor or psql):
--
--   select vault.create_secret(
--     '<paste anon JWT here>',
--     'sync_cron_anon_key',
--     'Anon key used by the sync-google-interactions pg_cron job');
--
-- If the secret already exists this migration just reschedules; if it does
-- not exist yet, the reschedule is skipped with a notice (provision then
-- re-run).

do $$
declare
  anon_key text;
begin
  select decrypted_secret into anon_key
  from vault.decrypted_secrets
  where name = 'sync_cron_anon_key';

  if anon_key is null then
    raise notice 'Vault secret sync_cron_anon_key missing — provision it (see header) then re-apply. Existing cron job left unchanged.';
    return;
  end if;

  perform cron.unschedule('sync-google-interactions');

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

  raise notice 'sync-google-interactions cron rescheduled to use Vault secret.';
end $$;

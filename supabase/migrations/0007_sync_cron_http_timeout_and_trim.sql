-- 0007 hardens public.ensure_sync_google_cron() against two failures observed
-- on 2026-05-26, both of which produced silent "cron looks healthy but
-- sync_runs has no rows" behavior:
--
--   (a) The Vault secret `sync_cron_anon_key` had embedded whitespace from
--       how it was pasted, so the Authorization header was rejected by
--       Supabase with 401 UNAUTHORIZED_INVALID_JWT_FORMAT every morning.
--       Fix: trim() the secret on read and reject anything that doesn't
--       look like a JWT (eyJ-prefixed, two dots, no whitespace).
--
--   (b) The cron's net.http_post() call had no explicit timeout, falling
--       back to pg_net's 5s default. A real Gmail+Calendar sync runs
--       8-12s, so the HTTP client disconnected mid-execution and the
--       Edge Function aborted before writing a sync_runs row. Fix: bake
--       timeout_milliseconds := 60000 into the cron command (the Edge
--       Function's own wall-clock limit is 60s, so this matches it).
--
-- Both checks fail loudly at schedule-time. A future bad paste of the
-- Vault secret will raise rather than silently 401 every morning.

create or replace function public.ensure_sync_google_cron()
returns void
language plpgsql
security definer
as $fn$
declare
  anon_key text;
begin
  select trim(both from decrypted_secret) into anon_key
  from vault.decrypted_secrets
  where name = 'sync_cron_anon_key';

  if anon_key is null or anon_key = '' then
    raise exception
      'Vault secret sync_cron_anon_key missing or empty — provision it before '
      'applying this migration (see 0005 header for vault.create_secret syntax).';
  end if;

  -- JWT shape sanity check: header.payload.signature, base64url-ish chars only.
  -- A valid Supabase anon key looks like `eyJ...eyJ...`<sig>` with exactly
  -- two dots and no whitespace. Catching this here converts a silent 401
  -- every morning into a loud failure at schedule time.
  if anon_key !~ '^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$' then
    raise exception
      'Vault secret sync_cron_anon_key does not look like a valid JWT '
      '(expected eyJ-prefixed, three dot-separated base64url segments, no '
      'whitespace). Re-paste it from Supabase Dashboard → Project Settings → '
      'API → anon public.';
  end if;

  -- Guarded unschedule: cron.unschedule() errors if the job is absent.
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
        body := '{}'::jsonb,
        timeout_milliseconds := 60000
      ) as request_id;
    $job$, anon_key)
  );

  raise notice 'sync-google-interactions cron ensured (0 9 * * *, 60s HTTP timeout).';
end;
$fn$;

-- Re-assert the daily job using the hardened function. This rewrites the
-- baked-in command with the trimmed secret and the 60s timeout.
select public.ensure_sync_google_cron();

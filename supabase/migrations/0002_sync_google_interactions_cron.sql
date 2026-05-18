-- Schedule the daily Gmail/Calendar sync via pg_cron, mirroring the
-- process-email-reminders job pattern (net.http_post with anon JWT bearer).
-- Run hour: 09:00 UTC (= 05:00 ET). Idempotent: unschedule if exists first.
do $$
begin
  perform cron.unschedule('sync-google-interactions');
exception when others then null;
end $$;

select cron.schedule(
  'sync-google-interactions',
  '0 9 * * *',
  $$
  select net.http_post(
    url := 'https://bpaffcxxhkxchyfhyrwg.supabase.co/functions/v1/sync-google-interactions',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwYWZmY3h4aGt4Y2h5Zmh5cndnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyMzQxMDEsImV4cCI6MjA2OTgxMDEwMX0.IieaoT6EU8O4ZlDXESrRkldBOfH2lCkBuhXIK2HnagU"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);

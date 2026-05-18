-- google_oauth_tokens: encrypted Google refresh token (service-role only)
create table if not exists google_oauth_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token_encrypted bytea not null,
  refresh_token_iv bytea not null,
  access_token text,
  access_expires_at timestamptz,
  scopes text,
  error_state text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table google_oauth_tokens enable row level security;
-- no policies => service-role only (RLS denies anon/auth by default)

-- sync_identity: addresses that are "the user's own"
create table if not exists sync_identity (
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, email)
);
alter table sync_identity enable row level security;
create policy sync_identity_owner on sync_identity
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- contact_email_aliases: learned email -> contact mappings
create table if not exists contact_email_aliases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  email text not null,
  source text not null default 'learned',
  created_at timestamptz not null default now(),
  unique (user_id, email)
);
alter table contact_email_aliases enable row level security;
create policy contact_email_aliases_owner on contact_email_aliases
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- interaction_review_queue: pending detected interactions
create table if not exists interaction_review_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null,
  external_id text not null,
  suggested_contact_id uuid references contacts(id) on delete set null,
  counterparty_email text,
  type text not null,
  occurred_at timestamptz not null,
  summary text,
  notes text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  unique (user_id, source, external_id)
);
alter table interaction_review_queue enable row level security;
create policy review_queue_owner on interaction_review_queue
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- followup_settings: user-editable rule-engine thresholds
create table if not exists followup_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  email_no_reply_days integer not null default 7
    check (email_no_reply_days between 1 and 365),
  meeting_no_followup_days integer not null default 14
    check (meeting_no_followup_days between 1 and 365),
  gone_quiet_days integer not null default 30
    check (gone_quiet_days between 1 and 365),
  max_auto_followups_per_day integer not null default 10
    check (max_auto_followups_per_day between 0 and 50),
  updated_at timestamptz not null default now()
);
alter table followup_settings enable row level security;
create policy followup_settings_owner on followup_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- sync_runs: observability + incremental watermark
create table if not exists sync_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null,
  items_seen integer not null default 0,
  items_written integer not null default 0,
  items_queued integer not null default 0,
  items_skipped integer not null default 0,
  followups_created integer not null default 0,
  followups_cancelled integer not null default 0,
  error_message text,
  sync_watermark timestamptz
);
alter table sync_runs enable row level security;
create policy sync_runs_owner on sync_runs
  for select using (auth.uid() = user_id);

-- interactions: widen `date` to timestamptz so synced Gmail/Calendar
-- interactions retain time-of-day (existing manual rows coerce to midnight;
-- only existing usage is ORDER BY date, which is unaffected). Confirmed
-- against live schema 2026-05-18 (was type `date`).
alter table interactions
  alter column date type timestamptz using date::timestamptz;

-- interactions: additive columns + idempotency index
alter table interactions add column if not exists external_id text;
alter table interactions add column if not exists source text;
alter table interactions add column if not exists last_direction text;
alter table interactions add column if not exists message_count integer;
alter table interactions add column if not exists last_message_at timestamptz;

create unique index if not exists interactions_external_uidx
  on interactions (user_id, contact_id, source, external_id)
  where external_id is not null;

create index if not exists interactions_followup_idx
  on interactions (user_id, last_message_at)
  where external_id is not null;

-- reminders: tag + linkage for auto-followups (additive)
alter table email_reminders add column if not exists source text;
alter table email_reminders add column if not exists trigger_interaction_id uuid;

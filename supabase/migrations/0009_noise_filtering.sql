-- 0009_noise_filtering.sql
-- blocked_senders: per-user dismiss-and-learn suppression rules
create table if not exists blocked_senders (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  pattern      text not null,
  pattern_type text not null check (pattern_type in ('sender', 'domain')),
  created_at   timestamptz not null default now()
);

create index if not exists blocked_senders_user_id_idx on blocked_senders(user_id);

create unique index if not exists blocked_senders_user_pattern_uidx
  on blocked_senders(user_id, pattern, pattern_type);

alter table blocked_senders enable row level security;

create policy "users manage own blocked senders"
  on blocked_senders for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- interaction_review_queue: add skipped status + skipped_until column
alter table interaction_review_queue
  drop constraint if exists interaction_review_queue_status_check;

alter table interaction_review_queue
  add constraint interaction_review_queue_status_check
  check (status in ('pending', 'accepted', 'dismissed', 'skipped'));

alter table interaction_review_queue
  add column if not exists skipped_until timestamptz;

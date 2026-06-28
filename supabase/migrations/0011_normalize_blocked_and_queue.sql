-- 0011_normalize_blocked_and_queue.sql
-- Fix dirty counterparty_email (raw "Name <email>" headers) and malformed
-- blocked_senders patterns introduced before the parseEmailAddress fix, then
-- retroactively dismiss already-queued items matching a block rule.
-- Idempotent: re-running on already-clean data is a no-op.

-- Helper: extract a bare lowercased email from a raw header-ish string.
create or replace function pg_temp.bare_email(raw text) returns text as $$
  select case
    when raw ~ '<[^>]+>' then lower(trim(substring(raw from '<([^>]+)>')))
    else regexp_replace(lower(trim(raw)), '>+$', '')
  end;
$$ language sql immutable;

-- 1. Normalize queue counterparty_email to bare email.
update interaction_review_queue
set counterparty_email = pg_temp.bare_email(counterparty_email)
where counterparty_email is not null
  and counterparty_email <> pg_temp.bare_email(counterparty_email);

-- 2. Normalize blocked_senders patterns.
--    sender  → bare email
--    domain  → strip brackets, leading @, trailing '>'
update blocked_senders
set pattern = pg_temp.bare_email(pattern)
where pattern_type = 'sender'
  and pattern <> pg_temp.bare_email(pattern);

update blocked_senders
set pattern = regexp_replace(replace(replace(lower(trim(pattern)), '<', ''), '>', ''), '^@', '')
where pattern_type = 'domain'
  and pattern <> regexp_replace(replace(replace(lower(trim(pattern)), '<', ''), '>', ''), '^@', '');

-- 3. Drop unparseable / now-empty patterns and de-dup collisions.
delete from blocked_senders
where pattern is null or trim(pattern) = ''
   or (pattern_type = 'sender' and pattern not like '%@%');

-- De-dup: keep the earliest row per (user_id, pattern, pattern_type).
delete from blocked_senders b
using blocked_senders b2
where b.user_id = b2.user_id
  and b.pattern = b2.pattern
  and b.pattern_type = b2.pattern_type
  and (b.created_at > b2.created_at
       or (b.created_at = b2.created_at and b.ctid > b2.ctid));

-- 4. Retroactively dismiss pending/skipped rows that now match a rule.
update interaction_review_queue q
set status = 'dismissed'
where q.status in ('pending', 'skipped')
  and (
    exists (
      select 1 from blocked_senders s
      where s.user_id = q.user_id and s.pattern_type = 'sender'
        and s.pattern = lower(trim(q.counterparty_email))
    )
    or exists (
      select 1 from blocked_senders d
      where d.user_id = q.user_id and d.pattern_type = 'domain'
        and d.pattern = split_part(lower(trim(q.counterparty_email)), '@', 2)
    )
  );

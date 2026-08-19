-- Thread-reply detection.
--
-- Two defects fixed here, both rooted in the review queue being keyed by Gmail
-- THREAD id alone:
--
-- 1. Multi-counterparty collision. normalizeThread() returns one entry PER
--    counterparty (it collects every non-own address across From/To/Cc), but
--    all of them carry externalId = thread.id. With a unique key of
--    (user_id, source, external_id) a thread with three counterparties had
--    three entries competing for ONE row: first wins, the rest were silently
--    dropped. Widen the key to include counterparty_email.
--
-- 2. Accepted threads muted forever. interactions upserts on
--    (user_id, contact_id, source, external_id) where external_id is the
--    THREAD id, so accepting the same thread twice UPDATED one interaction
--    instead of appending. Store the newest Gmail message id so the accept
--    path can key interactions per message and build a real timeline.
--
-- counterparty_email is nullable and NULLs are distinct in a unique index, so
-- the replacement key coalesces it — otherwise the same thread could insert
-- unbounded duplicate rows whenever the counterparty could not be resolved.

alter table interaction_review_queue
  add column if not exists last_message_id text;

-- Drop the old table-level unique constraint (created inline in 0001).
-- Looked up by column set rather than by name: a hardcoded name that does not
-- match would make `drop constraint if exists` a silent no-op, leaving the old
-- key in place and defeating fix #1 with no error to notice.
do $$
declare
  c text;
begin
  select con.conname into c
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace ns on ns.oid = rel.relnamespace
  where ns.nspname = 'public'
    and rel.relname = 'interaction_review_queue'
    and con.contype = 'u'
    and (
      select array_agg(att.attname::text order by att.attname::text)
      from unnest(con.conkey) k
      join pg_attribute att
        on att.attrelid = con.conrelid and att.attnum = k
    ) = array['external_id', 'source', 'user_id'];

  if c is not null then
    execute format('alter table interaction_review_queue drop constraint %I', c);
  end if;
end $$;

create unique index if not exists review_queue_thread_counterparty_uidx
  on interaction_review_queue
  (user_id, source, external_id, coalesce(counterparty_email, ''));

-- Supports the per-run lookup the sync does before deciding insert/reopen/skip.
create index if not exists review_queue_status_occurred_idx
  on interaction_review_queue (user_id, status, occurred_at desc);

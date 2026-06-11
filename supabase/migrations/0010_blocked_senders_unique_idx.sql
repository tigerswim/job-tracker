-- 0010_blocked_senders_unique_idx.sql
-- dedup guard: prevent duplicate blocked_sender rules per user
create unique index if not exists blocked_senders_user_pattern_uidx
  on blocked_senders(user_id, pattern, pattern_type);

-- Migration 0008: add followup_snoozed_until to contacts
-- Enables per-contact snooze of auto-followup reminders.
-- The Edge Function filters contacts with followup_snoozed_until > now()
-- before generating auto-followup reminders.
-- Apply manually in Supabase SQL editor if not using supabase db push.

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS followup_snoozed_until timestamptz;

-- Partial index: only index snoozed contacts (most contacts will be NULL/unsnoozed)
CREATE INDEX IF NOT EXISTS contacts_followup_snooze_idx
  ON contacts (user_id, followup_snoozed_until)
  WHERE followup_snoozed_until IS NOT NULL;

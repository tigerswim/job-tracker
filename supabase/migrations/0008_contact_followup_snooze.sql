-- Migration 0008: add followup_snoozed_until to contacts
-- Apply manually in Supabase SQL editor:
--   ALTER TABLE contacts ADD COLUMN followup_snoozed_until timestamptz;
ALTER TABLE contacts ADD COLUMN followup_snoozed_until timestamptz;

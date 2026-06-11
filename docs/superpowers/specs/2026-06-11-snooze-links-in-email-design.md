# Snooze Links in Auto-Followup Emails

**Date:** 2026-06-11  
**Status:** Approved

## Problem

Auto-followup reminder emails arrive with only "Open Job Tracker" and "View Contact" buttons. To snooze a contact's follow-up reminders, the user must navigate into the app and find the snooze control on the contact modal — two extra steps.

The snooze infrastructure already exists end-to-end: `sync-google-interactions` builds HMAC-signed snooze links (1w / 1m / 3m / indefinite) and stores them in `email_reminders.email_body`. The bug is that `process-email-reminders` always calls `generateEmailContent()`, which rebuilds the email from scratch and discards `email_body`.

## Solution

**Option A (chosen):** Pass through `email_body` for `auto_followup` reminders.

When `reminder.source === 'auto_followup'` and `reminder.email_body` is non-empty, use `email_body` as the HTML body and `email_subject` as the subject — skip `generateEmailContent()`. Otherwise fall through to the existing template logic.

## Changes

### `supabase/functions/process-email-reminders/index.ts`

1. Add `source?: string` to the `EmailReminder` interface.
2. In the reminder processing loop, before calling `generateEmailContent()`, add:
   ```ts
   if (reminder.source === 'auto_followup' && reminder.email_body) {
     emailContent = { subject: reminder.email_subject, body: reminder.email_body }
   } else {
     emailContent = generateEmailContent(reminder, contactInfo, jobInfo)
   }
   ```

No other files change. No schema migration needed. No changes to `sync-google-interactions`.

## Out of Scope

- Snooze links on manually-scheduled reminders (not requested)
- Redesigning the auto-followup email template

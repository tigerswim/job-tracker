# Snooze Links in Auto-Followup Emails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make auto-followup reminder emails include inline snooze links (1w / 1m / 3m / indefinite) so the user can snooze a contact's follow-up without opening the app.

**Architecture:** `sync-google-interactions` already builds HMAC-signed snooze links and stores them in `email_reminders.email_body`. The bug is that `process-email-reminders` always calls `generateEmailContent()`, which rebuilds the email HTML from scratch and discards `email_body`. The fix is a single conditional: when `source === 'auto_followup'` and `email_body` is non-empty, use those fields directly instead of regenerating.

**Tech Stack:** Deno (Supabase Edge Functions), TypeScript

---

### Task 1: Pass through `email_body` for auto-followup reminders

**Files:**
- Modify: `supabase/functions/process-email-reminders/index.ts`

**Context:**  
The `EmailReminder` interface (line 7) is missing the `source` field — add it so the conditional can read it.  
The processing loop calls `generateEmailContent(reminder, contactInfo, jobInfo)` at line 120 — wrap it with the conditional.

- [ ] **Step 1: Add `source` to the `EmailReminder` interface**

In `supabase/functions/process-email-reminders/index.ts`, find the interface at line 7:

```typescript
interface EmailReminder {
  id: string
  user_id: string
  contact_id?: string
  job_id?: string
  scheduled_time: string
  user_timezone: string
  email_subject: string
  email_body: string
  user_message: string
  status: string
  created_at: string
  updated_at: string
}
```

Add `source?: string` after `status`:

```typescript
interface EmailReminder {
  id: string
  user_id: string
  contact_id?: string
  job_id?: string
  scheduled_time: string
  user_timezone: string
  email_subject: string
  email_body: string
  user_message: string
  status: string
  source?: string
  created_at: string
  updated_at: string
}
```

- [ ] **Step 2: Replace the `generateEmailContent` call with a conditional**

Find this block around line 119–123:

```typescript
        // Generate email content
        const emailContent = generateEmailContent(reminder, contactInfo, jobInfo)
```

Replace with:

```typescript
        // Generate email content
        // Auto-followup reminders have snooze links pre-built in email_body — use them directly.
        const emailContent = (reminder.source === 'auto_followup' && reminder.email_body)
          ? { subject: reminder.email_subject, body: reminder.email_body }
          : generateEmailContent(reminder, contactInfo, jobInfo)
```

- [ ] **Step 3: Verify no TypeScript errors**

Run:
```bash
cd "/Volumes/Mac Mini 2TB SSD/Dan/Personal Projects/job-tracker"
npx tsc --noEmit
```
Expected: no errors (Edge Function files use Deno types so tsc may skip them — that's fine; confirm the file has no obvious syntax issues by inspection).

- [ ] **Step 4: Commit**

```bash
cd "/Volumes/Mac Mini 2TB SSD/Dan/Personal Projects/job-tracker"
git add supabase/functions/process-email-reminders/index.ts
git commit -m "fix: pass through snooze links in auto-followup reminder emails

Auto-followup reminders have HMAC-signed snooze links pre-built in
email_body by sync-google-interactions. process-email-reminders was
discarding this and regenerating the email from scratch. Now it uses
email_body directly for auto_followup source reminders.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Deploy the updated Edge Function

- [ ] **Step 1: Deploy to Supabase**

```bash
cd "/Volumes/Mac Mini 2TB SSD/Dan/Personal Projects/job-tracker"
npx supabase functions deploy process-email-reminders
```

Expected output: deployment success message with function URL.

- [ ] **Step 2: Verify the next auto-followup email contains snooze links**

Wait for the next daily sync run (05:00 ET), or manually trigger `sync-google-interactions` from the Supabase dashboard to create a test auto-followup reminder, then let `process-email-reminders` send it. The resulting email should show four snooze links below the follow-up message:

```
Snooze follow-up reminders for this contact:
1 week   1 month   3 months   Indefinitely
```

Clicking any link should load a plain HTML confirmation page ("Follow-up snoozed — reminders for "Name" are snoozed for X.") and update `contacts.followup_snoozed_until` without requiring login.

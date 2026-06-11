# Detected Queue Noise Filtering

**Date:** 2026-06-11
**Status:** Approved

## Problem

The Detected box in the Network tab surfaces all Gmail threads that pass the minimal `no-reply` sender check. In practice this includes newsletters, subscription emails, ATS recruiting platform mail, and LinkedIn digests — content the user never wants as an Interaction. The user must manually dismiss each one, which creates friction and makes the queue hard to act on.

## Goals

- Suppress obvious noise before it enters the review queue (heuristic pre-filter)
- Let the user teach the system to suppress a sender or domain permanently (dismiss-and-learn)
- Let the user defer uncertain items to review later (skip for now)

## Architecture

Three independent layers, each additive on top of the existing sync pipeline.

### Layer 1: Heuristic Pre-filter

**Location:** `src/lib/google-sync/gmail.ts` (vendored copy stays in sync per existing convention)

Expand the existing `NOISE` sender regex to cover:

- ATS/recruiting platforms: `lever.co`, `greenhouse.io`, `workday.com`, `jobvite.com`, `smartrecruiters.com`, `taleo.net`, `icims.com`, `myworkday.com`
- Newsletter platforms: `substack.com`, `mailchimp.com`, `sendgrid.net`, `campaign-archive.com`, `constantcontact.com`, `klaviyo.com`, `beehiiv.com`
- LinkedIn automation: `@linkedin.com` subjects matching digest/alert patterns
- Generic automated-mail signals in sender address: `digest`, `alert`, `update`, `weekly`, `monthly`, `newsletter`

Add a new `NOISE_SUBJECT` regex applied to thread subjects:
- `(weekly|daily|monthly)\s+(digest|roundup|update|newsletter)`
- `job alert`, `jobs you may like`, `people also viewed`
- `unsubscribe`, `view in browser`, `you'?re receiving this`

A thread is suppressed (returns `[]` from `normalizeThread`) if the sender OR subject matches. No DB calls, fully unit-testable.

### Layer 2: Blocked Senders (Dismiss-and-Learn)

**New table:**
```sql
blocked_senders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users,
  pattern     text not null,   -- email address or bare domain
  pattern_type text not null,  -- 'sender' | 'domain'
  created_at  timestamptz not null default now()
)
```
RLS: `user_id = auth.uid()`.

**Sync integration:** In `syncGmail` (Edge Function `index.ts`), after `normalizeThread` returns results, check each counterparty email against the user's `blocked_senders` rows before calling `upsertReviewQueue`. Blocked items increment `skipped` and are not queued.

**Loading blocked senders:** Load once per sync run alongside `loadContext()` — a single `select pattern, pattern_type from blocked_senders where user_id = $1` query. Build a `Set<string>` for domains and a `Set<string>` for exact addresses. Check is O(1) per thread.

**Dismiss UI:** `ReviewItemPanel` gets an expanded dismiss flow:
- "Dismiss this sender" — blocks exact address, sets item `status = 'dismissed'`
- "Dismiss this domain" — blocks the whole domain, sets item `status = 'dismissed'`
- "Dismiss" (plain) — dismisses just this item, no future blocking

**API:** `POST /api/review-queue/[id]/dismiss`
```ts
body: { blockPattern?: string; patternType?: 'sender' | 'domain' }
```
Sets `status = 'dismissed'` on the queue item; if `blockPattern` provided, inserts a `blocked_senders` row. Returns `{ ok: true }`.

### Layer 3: Skip for Now

**Schema change:** `interaction_review_queue` gains:
- `status` gains value `'skipped'` (existing enum or check constraint)
- `skipped_until timestamptz` — nullable, set on skip

**Queue API change:** `GET /api/review-queue` filter changes from `status = 'pending'` to:
```sql
status = 'pending'
OR (status = 'skipped' AND skipped_until <= now())
```

**Skip API:** `POST /api/review-queue/[id]/skip`
Sets `status = 'skipped'`, `skipped_until = now() + interval '7 days'`. Returns `{ ok: true }`.

**UI:** `ReviewItemPanel` adds a "Skip for now" button alongside Accept/Dismiss options. No other UI changes.

## Data Flow

```
Gmail thread fetched
  → normalizeThread (sender + subject heuristics) → [] = skip
  → check blocked_senders (domain + address) → skip
  → upsertReviewQueue (status = 'pending')

User in ReviewItemPanel:
  Accept  → status = 'accepted', creates Interaction
  Dismiss (plain) → status = 'dismissed'
  Dismiss + block sender → status = 'dismissed', insert blocked_senders (sender)
  Dismiss + block domain → status = 'dismissed', insert blocked_senders (domain)
  Skip    → status = 'skipped', skipped_until = now() + 7d
```

## Files Touched

| File | Change |
|------|--------|
| `src/lib/google-sync/gmail.ts` | Expand `NOISE` regex; add `NOISE_SUBJECT` regex |
| `supabase/functions/sync-google-interactions/_shared/gmail.ts` | Vendored copy — same changes |
| `supabase/functions/sync-google-interactions/index.ts` | Load `blocked_senders` in `loadContext`; check before `upsertReviewQueue` |
| `supabase/migrations/0009_noise_filtering.sql` | New `blocked_senders` table; add `skipped` status + `skipped_until` to `interaction_review_queue` |
| `src/app/api/review-queue/route.ts` | Update GET filter to include re-surfaced skipped items |
| `src/app/api/review-queue/[id]/route.ts` | Add dismiss (with optional block) and skip actions |
| `src/components/ReviewItemPanel.tsx` | Add Skip button; expand Dismiss into three options |
| `src/lib/google-sync/__tests__/gmail.test.ts` | Tests for expanded heuristics |

## Testing

- Unit tests for new `NOISE` patterns and `NOISE_SUBJECT` regex covering known ATS/newsletter domains and subject patterns
- Unit tests for `blocked_senders` check logic (domain match, sender match, no match)
- Manual verification: run sync, confirm newsletters no longer appear; dismiss-and-learn a sender, confirm it doesn't re-appear next sync; skip an item, confirm it re-surfaces after 7 days

## Out of Scope

- LLM-based classification
- Gmail label integration
- Managing/viewing the blocked senders list (blocked senders accumulate silently; a management UI is a follow-up)
- Configurable skip duration (fixed at 7 days for v1)

# Plan: Detect replies on already-reviewed Gmail threads

Status: proposed, not implemented
Date: 2026-08-19

## The bug

A contact's 2026-08-18 email never appeared in the Detected card. The sync
fetched it; the write step discarded it.

Two design choices collide:

1. `src/lib/google-sync/gmail.ts:69` — `externalId: thread.id`. One queue row
   per Gmail **thread**, not per message.
2. `supabase/functions/sync-google-interactions/index.ts:149-154` — the queue
   upsert uses `onConflict: 'user_id,source,external_id'` with
   `ignoreDuplicates: true`.

Accepting a thread once permanently occupies that slot. Every later reply on
the thread re-fetches, re-normalizes, and is then silently dropped.

Evidence:
- Queue row `374669b6…` for thread `19f4223464a32cc0`: `status: accepted`,
  `occurred_at: 2026-07-08`. The live thread now has 12 messages, newest
  2026-08-18T20:41:44Z (message `1a0169c1042aeb6c`).
- The contact's Aug 10, Aug 13, and Aug 18 replies all hit that dead slot.
- 529 gmail queue rows / 529 distinct `external_id` — exactly one row per
  thread, confirming thread-granularity.
- 89 accepted rows total; ~75 distinct accepted gmail threads. Each is
  permanently muted for all future replies.

`items_queued` did not reveal this: the counter increments before the write
and never checks whether the row landed. The Aug 19 run reported
`items_queued: 5` while suppressing this thread entirely.

## Two findings from investigation

### 1. `lastMessageAt` is usable

`normalizeThread` (`gmail.ts`) already computes `lastAt` from the newest
message and sets it on every returned entry, plus `messageCount` and
`lastDirection`. The re-open comparison has the data it needs. No change
required to compute it.

### 2. Thread-keyed `interactions` blocks a real timeline — this is the blocker

`interactions` upserts on `(user_id, contact_id, source, external_id)`
(unique index `interactions_external_uidx`, migration 0004), and `external_id`
is the thread ID. Accepting the same thread twice **updates one interaction
row** rather than appending.

So option 3 alone gets a re-opened card, but accepting it **overwrites** the
July interaction instead of adding an August one. The contact's timeline would still
show a single entry. Getting a real timeline requires per-message
`external_id` on `interactions` — part of option 1.

### Also found: multi-counterparty threads collide

`normalizeThread` returns **one entry per counterparty** (it collects every
non-own address across From/To/Cc), but all share `externalId: thread.id`.
With `onConflict: 'user_id,source,external_id'` — no counterparty column —
a thread with 3 counterparties produces 3 entries competing for **one** row.
First wins, other two silently dropped. Thread `19f4223464a32cc0` hits this:
message `19ff8f0eca4f5f66` is addressed to two of the user's own addresses.

This is a pre-existing bug, independent of the reply issue, and it must be
resolved in the same change because both live in the same conflict key.

## Design

Keep the queue thread-grained (low review volume); make `interactions`
message-grained (real timeline).

### Status semantics

| Status | On new message in thread | Rationale |
|---|---|---|
| `dismissed` | stays dismissed, always | preserves newsletter muting + `blocked_senders` dismiss-and-learn |
| `accepted` | re-open → `pending`, refresh contents | the fix; an active conversation stays tracked |
| `pending` | refresh contents in place | card shows newest message, not a stale one |
| `skipped` | leave alone while `skipped_until` is in the future | a 7-day snooze is deliberate; a new message must not cancel it |

`skipped` was nearly missed. `PATCH { action: 'skip' }` sets a 7-day timer and
`GET /api/review-queue` already re-surfaces the row when it expires. Treat it
as sticky until then.

### Changes

**A. Queue conflict key includes counterparty**

Migration `0012`: add unique index on
`(user_id, source, external_id, counterparty_email)`, drop the old
`(user_id, source, external_id)` unique. Update `upsertReviewQueue`'s
`onConflict` to match. Fixes the multi-counterparty collision.

Backfill risk: existing rows are one-per-thread, so the new index cannot
collide on current data. Safe.

**B. Conditional re-open replaces `ignoreDuplicates`**

`ignoreDuplicates: true` cannot express "update only when newer" — it is
all-or-nothing. Replace with an explicit read-then-write in
`upsertReviewQueue`:

- select existing row by the 4-part key
- no row → insert `pending`
- `dismissed` → return
- `skipped` and `skipped_until > now()` → return
- `accepted` or `pending`, and `n.lastMessageAt > row.occurred_at` → update
  `status='pending'`, refresh `summary`/`notes`/`occurred_at`/
  `last_message_at`/`message_count`/`last_direction`
- otherwise → return

The final "otherwise" branch is what keeps all ~75 accepted threads from
re-queueing on the very next run.

**C. Per-message `external_id` on interactions**

So accepting a re-opened thread appends rather than overwrites.

- `normalizeThread` carries the newest message's Gmail message ID as a new
  field (e.g. `lastMessageId`) alongside the existing thread `externalId`.
- Queue rows store it in a new `last_message_id` column (migration `0012`).
- `POST /api/review-queue/[id]` writes `interactions.external_id` as the
  **message** ID rather than the thread ID.

Existing interactions keep thread-ID `external_id` values; they simply stop
being upsert targets for new messages. No rewrite of history needed.

Calendar sync is unaffected — its `external_id` is the event ID, already
one-per-occurrence.

**D. Honest counters**

`items_queued` counts actual inserts. Add `items_reopened`. Both derive from
what step B actually did, so a suppressed write can never again report as
queued.

## Backfill

One-time script, run after deploy, for the ~75 accepted gmail threads: fetch
each thread, compare newest message against stored `occurred_at`, re-open
those that are behind.

Bound it — `occurred_at >= now() - interval '90 days'` — so this does not
dump the full backlog into the Detected card at once. Count first, then
decide whether to widen. The affected thread (July 8) falls inside 90 days.

## Tests

Extend `src/lib/google-sync/__tests__/` (39 tests currently, all passing):

- accepted + newer message → re-opens `pending`
- accepted + no newer message → unchanged (the no-op that prevents mass
  re-queue)
- dismissed + newer message → stays dismissed
- skipped, timer live + newer message → stays skipped
- skipped, timer expired + newer message → re-opens
- multi-counterparty thread → one row per counterparty, none dropped
- accepting two messages on one thread → two interactions, not one
- regression fixture: the 12-message thread above → Aug 18 surfaces

Remember `src/lib/google-sync/` is **vendored** into the Edge Function's
`_shared/`. Both copies must stay byte-identical;
`scripts/check-vendored-sync.sh` enforces this and runs first in `npm test`.

## Deploy

The Edge Function deploys **separately** from the app. A Netlify deploy does
not update it. After changing anything under
`supabase/functions/sync-google-interactions/` (including vendored `_shared/`):

```
supabase db push
supabase functions deploy sync-google-interactions
```

Manual trigger to verify without waiting for 09:00 UTC cron:

```
curl -s -X POST "$URL/functions/v1/sync-google-interactions" \
  -H "Authorization: Bearer $ANON_KEY"
```

## Verification

1. `npm test` green (incl. vendored-drift check).
2. Manual trigger; confirm a fresh `sync_runs` row with non-zero
   `items_reopened`.
3. The Aug 18 message appears in the Detected card.
4. Accept it → his contact shows a **new** interaction dated Aug 18, with the
   July 8 one intact.
5. Confirm no newsletter/dismissed sender reappears.

## Sequencing

Steps A + C share migration `0012`; B depends on A's conflict key; D is
independent. Suggested order: A → B → C → D → backfill.

## Open question

Volume. An active exchange now yields one card per inbound message —
the thread above had 4 inbound, so 4 cards over six weeks instead of 1.
Current queue is 11 pending, so the increase is modest, but it is the real
tradeoff of this design. If it proves noisy, the follow-up is collapsing
consecutive unreviewed messages on one thread into a single card showing the
newest — which reintroduces some thread-granularity, deliberately and only in
the UI layer.

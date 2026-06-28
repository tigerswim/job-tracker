# Blocked-sender email normalization & retroactive sweep

**Date:** 2026-06-28
**Status:** Approved

## Problem

The Detected card in the Network tab surfaces conversations the user has
already Blocked. Verified against live data (project `bpaffcxxhkxchyfhyrwg`):
**18 pending `interaction_review_queue` rows are from senders/domains that
already have a `blocked_senders` rule.**

### Root cause

`normalizeThread` in `src/lib/google-sync/gmail.ts` builds the counterparty
list from message headers. The `From` header is pushed **raw** and only passed
through `normalizeEmail` (which merely lowercases/trims — it does not extract
the address from a `Name <email>` header):

```ts
const everyone = [
  m.headers.From, ...parseAddrs(m.headers.To), ...parseAddrs(m.headers.Cc),
].map(normalizeEmail)
```

So `counterpartyEmail` is stored as the full raw header, e.g.
`every <hello@example.com>` instead of `hello@example.com`.

This single bug cascades into three observable failures:

1. **Dirty queue data** — `counterparty_email` holds `Name <email>`, not a
   bare address.
2. **Broken domain extraction** — `isBlocked()` does `email.split('@')[1]`,
   which on `every <hello@example.com>` yields `example.com>` (trailing `>`).
3. **Fragile blocking** — block rules captured from the same dirty source
   sometimes match by coincidence (both sides equally broken) and sometimes
   don't. A *clean* future email (`hello@example.com`) would NOT match a stored
   sender pattern `every <hello@example.com>`, so blocked senders can leak back.

Compounding this: blocking only filters at **insert time**. Rows already in
the queue when a block rule is created are never re-evaluated, so even a
correct match doesn't remove the backlog.

## Goals

- `counterparty_email` is always a bare, lowercased email address.
- Block patterns are stored normalized (bare email for `sender`, clean domain
  for `domain`) so matching is exact and predictable.
- Dismiss-with-block retroactively dismisses already-queued items from the
  same sender/domain.
- Existing dirty data (queue rows + malformed patterns + 18 stale pending
  rows) is cleaned up via a one-time migration.

## Non-goals

- Calendar normalization — `normalizeEvent` uses structured `attendee.email`
  values, which are already bare addresses.
- Changes to the noise-filter regex or confidence-gating logic.
- Fuzzy/substring matching — explicitly rejected in favor of exact match on
  normalized values.

## Design

### Part 1 — `parseEmailAddress` helper (`src/lib/google-sync/identity.ts`)

New tested pure function:

```ts
export function parseEmailAddress(raw: string): string {
  const m = raw.match(/<([^>]+)>/)
  const candidate = (m ? m[1] : raw).trim().toLowerCase().replace(/>+$/, '')
  return candidate.includes('@') ? candidate : ''
}
```

Behavior:
- `Name <e@x.com>` → `e@x.com`
- `"Last, First" <e@x.com>` → `e@x.com`
- `e@x.com` → `e@x.com`
- `e@x.com>` → `e@x.com` (strips trailing `>`)
- `Some Name` (no `@`) → `''`
- `''` → `''`

This lives in `identity.ts` (pure logic) and is **vendored** into the Edge
Function's `_shared/` dir; `scripts/check-vendored-sync.sh` enforces parity.

### Part 2 — Fix Gmail normalization (`src/lib/google-sync/gmail.ts`)

Route the `From` header (and To/Cc, for consistency) through
`parseEmailAddress` so `counterpartyEmail` is always a bare email. `parseAddrs`
is updated to use `parseEmailAddress` instead of its inline regex +
`normalizeEmail`.

### Part 3 — Normalize block patterns on write (`src/app/api/review-queue/[id]/route.ts`, PATCH)

When inserting into `blocked_senders`:
- `sender` → store `parseEmailAddress(blockPattern)`; if it yields `''`, fall
  back to the trimmed/lowercased input (preserves current behavior for odd
  inputs rather than silently storing nothing).
- `domain` → strip any `<>`, leading `@`, and trailing `>` to a clean domain;
  keep the existing "must not include @" validation (applied after strip).

### Part 4 — Retroactive sweep on dismiss-with-block

After the block-rule insert succeeds, dismiss matching queued rows for the
authenticated user:

- `sender` → `.eq('counterparty_email', cleanEmail)` (post-migration the
  column is bare, so exact match works).
- `domain` → suffix match on `@<domain>`. Use `.ilike('counterparty_email',
  '%@' + domain)` — the `@` anchor prevents `example.com` from matching
  `notexample.com`.
- Scope: `.in('status', ['pending', 'skipped']).eq('user_id', user.id)`.

Best-effort: log on error, don't fail the request (the block rule already
persisted and the primary row is already dismissed).

### Part 5 — One-time data-cleanup migration (`supabase/migrations/0011_normalize_blocked_and_queue.sql`)

1. **Queue:** rewrite `counterparty_email` to bare email for all rows —
   regex-extract `<...>` when present, else strip a trailing `>`, lowercase,
   trim.
2. **Patterns:** normalize `blocked_senders.pattern` the same way (bare email
   for `sender`, clean domain for `domain`). Dedup collisions — the
   `blocked_senders_user_pattern_uidx` unique index already prevents
   duplicates; the migration rebuilds via an upsert/dedup CTE and drops rows
   that normalize to an empty/invalid value (logged via `RAISE NOTICE`).
3. **Stale sweep:** set `status = 'dismissed'` on `pending`/`skipped` queue
   rows whose (now-clean) `counterparty_email` matches any normalized
   `blocked_senders` rule for the same user.

The migration is idempotent (safe to re-run; normalizing an already-bare value
is a no-op).

## Testing (TDD)

- **`identity.test.ts`** — `parseEmailAddress`: display-name header, quoted
  comma display name, bare email, trailing `>`, no-`@` → `''`, empty string.
- **`gmail.test.ts`** — `normalizeThread` produces a bare `counterpartyEmail`
  when `From` carries a display name.
- **Migration / API verification** — re-run the diagnostic SQL after applying:
  expect **0** `pending` rows whose `counterparty_email` matches a
  `blocked_senders` rule.

## Verification query (acceptance)

```sql
with p as (
  select id, lower(trim(counterparty_email)) as cpe
  from interaction_review_queue where status = 'pending'
),
s as (select lower(trim(pattern)) pat from blocked_senders where pattern_type='sender'),
d as (select lower(trim(pattern)) pat from blocked_senders where pattern_type='domain')
select count(*) as still_leaking
from p
where exists (select 1 from s where s.pat = p.cpe)
   or exists (select 1 from d where d.pat = split_part(p.cpe,'@',2));
-- expect 0
```

# Blocked-sender Email Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `counterparty_email` always a bare email so blocked senders are reliably suppressed from the Detected card, including retroactive cleanup of already-queued items.

**Architecture:** Add a tested `parseEmailAddress` helper to the pure-logic layer (`src/lib/google-sync/identity.ts`), use it to normalize Gmail `From`/To/Cc parsing, normalize block patterns on write + retroactively sweep the queue in the review-queue API, and ship a one-time SQL migration that cleans existing dirty data. Pure logic is mirrored into the Edge Function's `_shared/` dir and parity is enforced by `scripts/check-vendored-sync.sh`.

**Tech Stack:** TypeScript, Next.js App Router API routes, Supabase (PostgreSQL), Deno Edge Functions, Vitest.

## Global Constraints

- Pure logic in `src/lib/google-sync/*.ts` MUST be byte-identical to `supabase/functions/sync-google-interactions/_shared/*.ts`, except vendored copies import with `.ts` suffixes (`from './types.ts'`). Enforced by `scripts/check-vendored-sync.sh`, which runs first in `npm test`.
- All emails compared after lowercasing + trimming.
- Migrations: timestamped SQL in `supabase/migrations/`, applied via `supabase db push`. Next number is `0011`.
- API routes verify ownership via `eq('user_id', user.id)` before any write.
- Git commit messages end with: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

### Task 1: `parseEmailAddress` helper

**Files:**
- Modify: `src/lib/google-sync/identity.ts`
- Modify: `supabase/functions/sync-google-interactions/_shared/identity.ts` (vendored copy — keep byte-identical modulo `.ts` import suffix)
- Test: `src/lib/google-sync/__tests__/identity.test.ts`

**Interfaces:**
- Produces: `parseEmailAddress(raw: string): string` — extracts a bare lowercased email from a `Name <email>` header or bare string; strips a trailing `>`; returns `''` when no `@` is present.

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/google-sync/__tests__/identity.test.ts` (update the import on line 2 to include `parseEmailAddress`):

```ts
import { normalizeEmail, isOwn, classifyDirection, parseEmailAddress } from '../identity'
```

Add a new describe block:

```ts
describe('parseEmailAddress', () => {
  it('extracts bare email from a display-name header', () => {
    expect(parseEmailAddress('Acme <hello@example.com>')).toBe('hello@example.com')
  })
  it('extracts from a quoted comma display name', () => {
    expect(parseEmailAddress('"Doe, Jane" <jane.doe@example.com>'))
      .toBe('jane.doe@example.com')
  })
  it('passes through a bare email lowercased and trimmed', () => {
    expect(parseEmailAddress('  Ashley@Example.COM ')).toBe('ashley@example.com')
  })
  it('strips a trailing angle bracket', () => {
    expect(parseEmailAddress('hello@example.com>')).toBe('hello@example.com')
  })
  it('returns empty string when there is no @', () => {
    expect(parseEmailAddress('Some Name')).toBe('')
  })
  it('returns empty string for empty input', () => {
    expect(parseEmailAddress('')).toBe('')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/google-sync/__tests__/identity.test.ts`
Expected: FAIL — `parseEmailAddress is not a function` / not exported.

- [ ] **Step 3: Implement `parseEmailAddress` in `src/lib/google-sync/identity.ts`**

Add after `normalizeEmail`:

```ts
export function parseEmailAddress(raw: string): string {
  const m = raw.match(/<([^>]+)>/)
  const candidate = (m ? m[1] : raw).trim().toLowerCase().replace(/>+$/, '')
  return candidate.includes('@') ? candidate : ''
}
```

- [ ] **Step 4: Mirror into the vendored copy**

Add the identical function to `supabase/functions/sync-google-interactions/_shared/identity.ts` (this file uses `from './types.ts'` on line 1; the function body has no imports so it is byte-identical).

- [ ] **Step 5: Run tests + drift check to verify they pass**

Run: `npx vitest run src/lib/google-sync/__tests__/identity.test.ts && bash scripts/check-vendored-sync.sh`
Expected: tests PASS; drift check prints nothing and exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/google-sync/identity.ts supabase/functions/sync-google-interactions/_shared/identity.ts src/lib/google-sync/__tests__/identity.test.ts
git commit -m "feat: add parseEmailAddress helper for bare-email extraction

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Use `parseEmailAddress` in Gmail normalization

**Files:**
- Modify: `src/lib/google-sync/gmail.ts:37-43` (`parseAddrs`), `:61-66` (counterparty collection)
- Modify: `supabase/functions/sync-google-interactions/_shared/gmail.ts` (vendored copy)
- Test: `src/lib/google-sync/__tests__/gmail.test.ts`

**Interfaces:**
- Consumes: `parseEmailAddress` from Task 1.
- Produces: `normalizeThread(...)` now sets `counterpartyEmail` to a bare email even when the `From` header carries a display name.

- [ ] **Step 1: Write the failing test**

Add to `src/lib/google-sync/__tests__/gmail.test.ts` (inside the `describe('gmail', ...)` block):

```ts
it('extracts a bare counterparty email from a display-name From header', () => {
  const t = {
    id: 'thr2',
    messages: [
      { headers: { From: 'me@gmail.com', To: 'Acme <hello@example.com>', Subject: 'Q', Date: '2026-05-01T10:00:00Z' } },
      { headers: { From: 'Acme <hello@example.com>', To: 'me@gmail.com', Subject: 'Re: Q', Date: '2026-05-02T10:00:00Z' } },
    ],
  }
  const out = normalizeThread(t, identity)
  expect(out).toHaveLength(1)
  expect(out[0].counterpartyEmail).toBe('hello@example.com')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/google-sync/__tests__/gmail.test.ts -t "bare counterparty"`
Expected: FAIL — `counterpartyEmail` is `'every <hello@example.com>'`, not `'hello@example.com'`.

- [ ] **Step 3: Update `parseAddrs` and the counterparty collection in `src/lib/google-sync/gmail.ts`**

Change the import on line 1 to add `parseEmailAddress`:

```ts
import { normalizeEmail, isOwn, classifyDirection, parseEmailAddress } from './identity'
```

Replace `parseAddrs` (lines 37-43) with:

```ts
function parseAddrs(v?: string): string[] {
  if (!v) return []
  return v.split(',').map(s => parseEmailAddress(s)).filter(Boolean)
}
```

Replace the counterparty collection loop (lines 61-66) so the `From` header is parsed too:

```ts
  for (const m of sorted) {
    const everyone = [
      parseEmailAddress(m.headers.From),
      ...parseAddrs(m.headers.To), ...parseAddrs(m.headers.Cc),
    ]
    for (const e of everyone) if (e && !isOwn(e, identity)) counterparties.add(e)
  }
```

(Note: `isOwn`/`classifyDirection` still receive the raw `From` header elsewhere in the file — that is fine, `isOwn` already calls `normalizeEmail` and the noise/direction checks tolerate the wrapper. Leave lines 52 and 67 unchanged.)

- [ ] **Step 4: Mirror into the vendored copy**

Apply the identical edits to `supabase/functions/sync-google-interactions/_shared/gmail.ts` (its import line uses `from './identity.ts'`).

- [ ] **Step 5: Run tests + drift check to verify they pass**

Run: `npm test`
Expected: drift check passes; all gmail + identity tests PASS, including the new one.

- [ ] **Step 6: Commit**

```bash
git add src/lib/google-sync/gmail.ts supabase/functions/sync-google-interactions/_shared/gmail.ts src/lib/google-sync/__tests__/gmail.test.ts
git commit -m "fix: parse bare counterparty email from Gmail From/To/Cc headers

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Normalize block patterns on write + retroactive sweep

**Files:**
- Modify: `src/app/api/review-queue/[id]/route.ts:93-116` (the `dismiss` branch of `PATCH`)

**Interfaces:**
- Consumes: nothing from earlier tasks (the API route does not import the pure-logic layer; it inlines a small normalizer to avoid a server/edge bundling dependency).
- Produces: dismiss-with-block stores a normalized pattern and dismisses already-queued matching rows.

This task has no unit test harness for API routes in this repo (the existing tests are Vitest over pure logic only). Verification is via the live diagnostic SQL in Task 5. Implement carefully and commit.

- [ ] **Step 1: Replace the `dismiss` branch in `src/app/api/review-queue/[id]/route.ts`**

Replace the entire `if (body.action === 'dismiss') { ... }` block (lines 93-116) with:

```ts
  if (body.action === 'dismiss') {
    if (body.patternType && !['sender', 'domain'].includes(body.patternType)) {
      return NextResponse.json({ error: 'invalid patternType' }, { status: 400 })
    }
    await supa.from('interaction_review_queue')
      .update({ status: 'dismissed' }).eq('id', id).eq('user_id', user.id)

    if (body.blockPattern && body.patternType) {
      // Normalize the pattern so it matches the bare counterparty_email values.
      // sender: extract bare email from a possible "Name <email>" header.
      // domain: strip brackets, leading @, and trailing '>'.
      let safe: string
      if (body.patternType === 'sender') {
        const m = body.blockPattern.match(/<([^>]+)>/)
        const bare = (m ? m[1] : body.blockPattern).trim().toLowerCase().replace(/>+$/, '')
        safe = bare.includes('@') ? bare : body.blockPattern.trim().toLowerCase()
      } else {
        safe = body.blockPattern.trim().toLowerCase().replace(/[<>]/g, '').replace(/^@/, '')
      }

      if (body.patternType === 'domain' && safe.includes('@')) {
        return NextResponse.json({ error: 'domain pattern must not include @' }, { status: 400 })
      }

      if (safe) {
        const { error: insertErr } = await supa.from('blocked_senders').insert({
          user_id: user.id,
          pattern: safe,
          pattern_type: body.patternType,
        })
        if (insertErr && insertErr.code !== '23505') {
          console.error('blocked_senders insert failed:', insertErr.message)
        }

        // Retroactively dismiss already-queued items from this sender/domain.
        // sender → exact match; domain → '%@<domain>' so 'example.com' doesn't
        // match 'notexample.com'. Best-effort: log but don't fail the request.
        let sweep = supa.from('interaction_review_queue')
          .update({ status: 'dismissed' })
          .eq('user_id', user.id)
          .in('status', ['pending', 'skipped'])
        sweep = body.patternType === 'sender'
          ? sweep.eq('counterparty_email', safe)
          : sweep.ilike('counterparty_email', `%@${safe}`)
        const { error: sweepErr } = await sweep
        if (sweepErr) console.error('block sweep failed:', sweepErr.message)
      }
    }
    return NextResponse.json({ ok: true })
  }
```

- [ ] **Step 2: Type-check the route**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors in `src/app/api/review-queue/[id]/route.ts`. (Pre-existing errors elsewhere are tolerated — confirm none are newly introduced in this file.)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/review-queue/[id]/route.ts
git commit -m "feat: normalize block pattern on write and sweep queued matches

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: One-time data-cleanup migration

**Files:**
- Create: `supabase/migrations/0011_normalize_blocked_and_queue.sql`

**Interfaces:**
- Consumes: nothing. Pure SQL run against the live DB.
- Produces: clean `counterparty_email` on all queue rows, normalized `blocked_senders` patterns, and dismissal of stale matching rows.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0011_normalize_blocked_and_queue.sql`:

```sql
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
  and b.created_at > b2.created_at;

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
```

- [ ] **Step 2: Apply the migration**

Run: `supabase db push`
Expected: migration `0011` applies without error.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0011_normalize_blocked_and_queue.sql
git commit -m "feat: migration to normalize counterparty_email and block patterns

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Acceptance verification

**Files:** none (verification only).

- [ ] **Step 1: Run the acceptance query against the live DB**

Run this SQL (via the Supabase MCP `execute_sql` against project `bpaffcxxhkxchyfhyrwg`):

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
```

Expected: `still_leaking = 0`.

- [ ] **Step 2: Confirm pending count dropped and no clean emails were mangled**

```sql
select status, count(*) from interaction_review_queue group by status order by count desc;
select counterparty_email from interaction_review_queue
where counterparty_email like '%<%' or counterparty_email like '%>%' limit 10;
```

Expected: second query returns 0 rows (no remaining bracketed values).

- [ ] **Step 3: Full test suite**

Run: `npm test`
Expected: all tests pass; vendored-drift check passes.
```

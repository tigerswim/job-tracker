# Detected Queue Noise Filtering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce noise in the Detected queue by pre-filtering known newsletter/ATS senders, persisting per-user blocked senders, and adding a skip-for-now action.

**Architecture:** Three additive layers on the existing sync pipeline: (1) expand heuristic regexes in `gmail.ts` so noise never enters the queue; (2) add a `blocked_senders` DB table populated via a dismiss-and-learn UI; (3) add `skipped` status + `skipped_until` to the queue table so items can be deferred 7 days.

**Tech Stack:** TypeScript/Next.js 15 App Router, Supabase (PostgreSQL + Edge Functions), Vitest, Tailwind CSS 4

---

## File Map

| File | Role |
|------|------|
| `src/lib/google-sync/gmail.ts` | Expand `NOISE` sender regex; add `NOISE_SUBJECT` regex + apply in `normalizeThread` |
| `supabase/functions/sync-google-interactions/_shared/gmail.ts` | Vendored copy — identical changes (see vendoring note below) |
| `supabase/functions/sync-google-interactions/index.ts` | Load `blocked_senders` in `loadContext`; check each counterparty before `upsertReviewQueue` |
| `supabase/migrations/0009_noise_filtering.sql` | `blocked_senders` table + RLS; add `'skipped'` to queue status check; add `skipped_until` column |
| `src/app/api/review-queue/route.ts` | Update GET filter to surface re-queued skipped items |
| `src/app/api/review-queue/[id]/route.ts` | Replace `DELETE` with `POST /dismiss`; add `POST /skip` |
| `src/components/ReviewItemPanel.tsx` | Expand dismiss into three options; add Skip button |
| `src/lib/google-sync/__tests__/gmail.test.ts` | Tests for all new noise patterns |

**Vendoring rule:** `src/lib/google-sync/gmail.ts` and `supabase/functions/sync-google-interactions/_shared/gmail.ts` must stay byte-identical (modulo `.ts` import suffixes). After every edit to the source file, copy it to the vendored path. `npm test` runs `scripts/check-vendored-sync.sh` to enforce this.

---

### Task 1: Expand heuristic noise filters in `gmail.ts`

**Files:**
- Modify: `src/lib/google-sync/gmail.ts`
- Modify (vendored): `supabase/functions/sync-google-interactions/_shared/gmail.ts`
- Modify: `src/lib/google-sync/__tests__/gmail.test.ts`

- [ ] **Step 1: Write failing tests for new noise patterns**

Add these cases to `src/lib/google-sync/__tests__/gmail.test.ts` inside the existing `describe('gmail', ...)` block, after the existing `isNoiseSender` tests:

```typescript
  // --- expanded sender noise ---
  it('flags ATS platform senders', () => {
    expect(isNoiseSender('apply@lever.co')).toBe(true)
    expect(isNoiseSender('no-reply@greenhouse.io')).toBe(true)
    expect(isNoiseSender('alerts@jobvite.com')).toBe(true)
    expect(isNoiseSender('noreply@smartrecruiters.com')).toBe(true)
    expect(isNoiseSender('recruiting@taleo.net')).toBe(true)
    expect(isNoiseSender('apply@icims.com')).toBe(true)
    expect(isNoiseSender('careers@workday.com')).toBe(true)
    expect(isNoiseSender('noreply@myworkday.com')).toBe(true)
  })
  it('flags newsletter platform senders', () => {
    expect(isNoiseSender('hello@substack.com')).toBe(true)
    expect(isNoiseSender('updates@mailchimp.com')).toBe(true)
    expect(isNoiseSender('bounce@sendgrid.net')).toBe(true)
    expect(isNoiseSender('digest@constantcontact.com')).toBe(true)
    expect(isNoiseSender('hello@klaviyo.com')).toBe(true)
    expect(isNoiseSender('newsletter@beehiiv.com')).toBe(true)
    expect(isNoiseSender('no-reply@campaign-archive.com')).toBe(true)
  })
  it('flags generic automated-mail senders', () => {
    expect(isNoiseSender('weekly@company.com')).toBe(true)
    expect(isNoiseSender('digest@company.com')).toBe(true)
    expect(isNoiseSender('newsletter@company.com')).toBe(true)
    expect(isNoiseSender('alerts@company.com')).toBe(true)
    expect(isNoiseSender('monthly@company.com')).toBe(true)
  })
  it('does not flag real senders', () => {
    expect(isNoiseSender('jane@lever.example.com')).toBe(false)
    expect(isNoiseSender('hiring-manager@acme.com')).toBe(false)
  })

  // --- subject noise ---
  it('suppresses threads with noisy subjects even from real-looking senders', () => {
    const noisyThread = {
      id: 'thr-noise',
      messages: [{
        headers: {
          From: 'news@acme.com', To: 'me@gmail.com',
          Subject: 'Weekly Digest: top stories this week',
          Date: '2026-05-01T10:00:00Z',
        },
        payload: { mimeType: 'text/plain', body: { data: btoa('content').replace(/\+/g,'-').replace(/\//g,'_') } },
      }],
    }
    expect(normalizeThread(noisyThread, identity)).toHaveLength(0)
  })
  it('suppresses job-alert subjects', () => {
    const t = {
      id: 'thr-jobalert',
      messages: [{
        headers: { From: 'jobs@linkedin.com', To: 'me@gmail.com', Subject: 'Job alert: 5 new senior engineer roles', Date: '2026-05-01T10:00:00Z' },
        payload: { mimeType: 'text/plain', body: { data: btoa('x').replace(/\+/g,'-').replace(/\//g,'_') } },
      }],
    }
    expect(normalizeThread(t, identity)).toHaveLength(0)
  })
  it('suppresses unsubscribe-containing subjects', () => {
    const t = {
      id: 'thr-unsub',
      messages: [{
        headers: { From: 'news@co.com', To: 'me@gmail.com', Subject: 'Click to unsubscribe from this list', Date: '2026-05-01T10:00:00Z' },
        payload: { mimeType: 'text/plain', body: { data: btoa('x').replace(/\+/g,'-').replace(/\//g,'_') } },
      }],
    }
    expect(normalizeThread(t, identity)).toHaveLength(0)
  })
  it('does not suppress legitimate subjects', () => {
    const t = {
      id: 'thr-legit',
      messages: [{
        headers: { From: 'alice@acme.com', To: 'me@gmail.com', Subject: 'Following up on our conversation', Date: '2026-05-01T10:00:00Z' },
        payload: { mimeType: 'text/plain', body: { data: btoa('Hi').replace(/\+/g,'-').replace(/\//g,'_') } },
      }],
    }
    expect(normalizeThread(t, identity)).toHaveLength(1)
  })
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --reporter=verbose 2>&1 | grep -A3 "FAIL\|flags ATS\|flags newsletter\|flags generic\|noisy subjects\|job-alert\|unsubscribe-contain\|does not suppress"
```

Expected: multiple failures — `isNoiseSender` returns false for ATS/newsletter domains, `normalizeThread` returns results for noisy subjects.

- [ ] **Step 3: Expand `NOISE` and add `NOISE_SUBJECT` in `src/lib/google-sync/gmail.ts`**

Replace the top of the file through the end of `isNoiseSender`:

```typescript
import { normalizeEmail, isOwn, classifyDirection } from './identity'
import type { NormalizedInteraction } from './types'

const NOISE = /(^|[._-])(no-?reply|noreply|notifications?|donotreply|digest|alert|weekly|monthly|newsletter)@|@(lever\.co|greenhouse\.io|workday\.com|myworkday\.com|jobvite\.com|smartrecruiters\.com|taleo\.net|icims\.com|substack\.com|mailchimp\.com|sendgrid\.net|campaign-archive\.com|constantcontact\.com|klaviyo\.com|beehiiv\.com)/i

const NOISE_SUBJECT = /(weekly|daily|monthly)\s+(digest|roundup|update|newsletter)|job\s+alert|jobs\s+you\s+may\s+like|people\s+also\s+viewed|unsubscribe|view\s+in\s+browser|you'?re\s+receiving\s+this/i

const BODY_TRUNCATE = 800

export function isNoiseSender(from: string): boolean {
  return NOISE.test(normalizeEmail(from))
}

export function isNoiseSubject(subject: string): boolean {
  return NOISE_SUBJECT.test(subject)
}
```

- [ ] **Step 4: Apply `NOISE_SUBJECT` check in `normalizeThread`**

In `normalizeThread`, after the existing `isNoiseSender` check, add a subject check. Replace:

```typescript
  if (isNoiseSender(last.headers.From) && !isOwn(last.headers.From, identity)) {
    return []
  }
```

with:

```typescript
  if (isNoiseSender(last.headers.From) && !isOwn(last.headers.From, identity)) {
    return []
  }
  const subject = sorted[0].headers.Subject ?? '(no subject)'
  if (isNoiseSubject(subject)) {
    return []
  }
```

Also remove the `const subject = ...` line further down (it's now declared above). The full updated `normalizeThread` function after the change:

```typescript
export function normalizeThread(
  thread: RawThread, identity: Set<string>
): NormalizedInteraction[] {
  const sorted = [...thread.messages].sort(
    (a, b) => Date.parse(a.headers.Date) - Date.parse(b.headers.Date)
  )
  const last = sorted[sorted.length - 1]
  if (isNoiseSender(last.headers.From) && !isOwn(last.headers.From, identity)) {
    return []
  }
  const subject = sorted[0].headers.Subject ?? '(no subject)'
  if (isNoiseSubject(subject)) {
    return []
  }
  // collect counterparties across all messages
  const counterparties = new Set<string>()
  for (const m of sorted) {
    const everyone = [
      m.headers.From, ...parseAddrs(m.headers.To), ...parseAddrs(m.headers.Cc),
    ].map(normalizeEmail)
    for (const e of everyone) if (!isOwn(e, identity) && e) counterparties.add(e)
  }
  const lastDir = classifyDirection(last.headers.From, identity)
  const lastAt = new Date(last.headers.Date).toISOString()
  return [...counterparties].map(cp => ({
    source: 'gmail' as const,
    externalId: thread.id,
    counterpartyEmail: cp,
    type: 'email' as const,
    occurredAt: new Date(sorted[0].headers.Date).toISOString(),
    summary: subject,
    notes: `Email thread — ${sorted.length} message(s), last: ${lastDir}, ${lastAt}\n\n${last.payload ? extractPlainText(last.payload) : ''}`.trimEnd(),
    lastDirection: lastDir,
    messageCount: sorted.length,
    lastMessageAt: lastAt,
  }))
}
```

- [ ] **Step 5: Sync to vendored copy**

```bash
cp "src/lib/google-sync/gmail.ts" "supabase/functions/sync-google-interactions/_shared/gmail.ts"
```

- [ ] **Step 6: Run tests**

```bash
npm test
```

Expected: all tests pass including the new ones. The vendored-drift check (`scripts/check-vendored-sync.sh`) should also pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/google-sync/gmail.ts \
        supabase/functions/sync-google-interactions/_shared/gmail.ts \
        src/lib/google-sync/__tests__/gmail.test.ts
git commit -m "feat: expand noise heuristics — ATS/newsletter sender + subject filters"
```

---

### Task 2: Database migration — `blocked_senders` table + skip columns

**Files:**
- Create: `supabase/migrations/0009_noise_filtering.sql`

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/0009_noise_filtering.sql` with this content:

```sql
-- 0009_noise_filtering.sql
-- blocked_senders: per-user dismiss-and-learn suppression rules
create table if not exists blocked_senders (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  pattern      text not null,
  pattern_type text not null check (pattern_type in ('sender', 'domain')),
  created_at   timestamptz not null default now()
);

create index if not exists blocked_senders_user_id_idx on blocked_senders(user_id);

alter table blocked_senders enable row level security;

create policy "users manage own blocked senders"
  on blocked_senders for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- interaction_review_queue: add skipped status + skipped_until column
alter table interaction_review_queue
  drop constraint if exists interaction_review_queue_status_check;

alter table interaction_review_queue
  add constraint interaction_review_queue_status_check
  check (status in ('pending', 'accepted', 'dismissed', 'skipped'));

alter table interaction_review_queue
  add column if not exists skipped_until timestamptz;
```

- [ ] **Step 2: Apply the migration**

```bash
npx supabase db push
```

Expected output ends with: `Finished supabase db push.`

If you get a "constraint already exists" error, verify that the existing check constraint is named `interaction_review_queue_status_check` in your Supabase schema — if it has a different name, update the `drop constraint` line accordingly.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0009_noise_filtering.sql
git commit -m "feat: add blocked_senders table and skipped status to review queue"
```

---

### Task 3: Load blocked senders in Edge Function sync

**Files:**
- Modify: `supabase/functions/sync-google-interactions/index.ts`

- [ ] **Step 1: Add `BlockedSenders` type and `isBlocked` helper**

After the `const supa = ...` line at the top of `index.ts`, add:

```typescript
interface BlockedSenders { domains: Set<string>; senders: Set<string> }

function isBlocked(email: string, blocked: BlockedSenders): boolean {
  const lower = email.toLowerCase().trim()
  if (blocked.senders.has(lower)) return true
  const domain = lower.split('@')[1]
  return domain ? blocked.domains.has(domain) : false
}
```

- [ ] **Step 2: Load blocked senders in `loadContext`**

Replace the existing `loadContext` function:

```typescript
async function loadContext() {
  const { data: identityRows } = await supa.from('sync_identity')
    .select('email').eq('user_id', RUN_USER)
  const identity = new Set((identityRows ?? []).map(r => r.email))
  const { data: contacts } = await supa.from('contacts')
    .select('id,email').eq('user_id', RUN_USER)
  const { data: aliases } = await supa.from('contact_email_aliases')
    .select('contact_id,email').eq('user_id', RUN_USER)
  const map = buildMatchMap(contacts ?? [], aliases ?? [])
  const { data: blockedRows } = await supa.from('blocked_senders')
    .select('pattern,pattern_type').eq('user_id', RUN_USER)
  const blocked: BlockedSenders = { domains: new Set(), senders: new Set() }
  for (const r of blockedRows ?? []) {
    if (r.pattern_type === 'domain') blocked.domains.add(r.pattern.toLowerCase().trim())
    else blocked.senders.add(r.pattern.toLowerCase().trim())
  }
  return { identity, map, blocked }
}
```

- [ ] **Step 3: Use `blocked` in `syncGmail`**

In `syncGmail`, the `ctx` parameter now carries `blocked`. Update the inner loop to skip blocked counterparties. Replace the existing inner loop body:

```typescript
        const norm = normalizeThread(thread, ctx.identity)
        if (norm.length === 0) { skipped++; continue }
        seen++
        for (const n of norm) {
          const contactId = n.counterpartyEmail
            ? resolveContact(n.counterpartyEmail, ctx.map) : null
          if (n.counterpartyEmail && isBlocked(n.counterpartyEmail, ctx.blocked)) {
            skipped++; continue
          }
          await upsertReviewQueue(n, contactId); queued++
        }
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/sync-google-interactions/index.ts
git commit -m "feat: skip blocked senders during gmail sync"
```

---

### Task 4: Update review queue GET API for skipped items

**Files:**
- Modify: `src/app/api/review-queue/route.ts`

- [ ] **Step 1: Update the GET filter**

Replace the `supabase.from(...)` query in the GET handler:

```typescript
  const { data } = await supa.from('interaction_review_queue')
    .select('*, suggested_contact:contacts!suggested_contact_id(name,email)')
    .eq('user_id', user.id)
    .or(`status.eq.pending,and(status.eq.skipped,skipped_until.lte.${new Date().toISOString()})`)
    .order('occurred_at', { ascending: false })
```

The full updated file:

```typescript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET() {
  const cookieStore = await cookies()
  const supa = createRouteHandlerClient({ cookies: () => cookieStore })
  const { data: { user } } = await supa.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data } = await supa.from('interaction_review_queue')
    .select('*, suggested_contact:contacts!suggested_contact_id(name,email)')
    .eq('user_id', user.id)
    .or(`status.eq.pending,and(status.eq.skipped,skipped_until.lte.${new Date().toISOString()})`)
    .order('occurred_at', { ascending: false })
  const items = (data ?? []).map((row: any) => ({
    ...row,
    suggested_contact_name: row.suggested_contact?.name ?? null,
  }))
  return NextResponse.json({ items })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/review-queue/route.ts
git commit -m "feat: surface re-queued skipped items in review queue GET"
```

---

### Task 5: Add dismiss-and-learn + skip API endpoints

**Files:**
- Modify: `src/app/api/review-queue/[id]/route.ts`

The existing file has `POST` (accept) and `DELETE` (dismiss, no block). We replace `DELETE` with a `POST /dismiss` endpoint and add `POST /skip`. Since Next.js App Router doesn't support sub-path routing within a single route file, we use a `?action=` query param approach on new `PATCH` requests, keeping the existing `POST` (accept) and `DELETE` (plain dismiss, no block) as-is for backwards compatibility, and adding a `PATCH` handler for the new actions.

- [ ] **Step 1: Add `PATCH` handler for dismiss-with-block and skip**

Append to `src/app/api/review-queue/[id]/route.ts` (keep all existing code, add after the `DELETE` export):

```typescript
export async function PATCH(req: Request,
  { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cookieStore = await cookies()
  const supa = createRouteHandlerClient({ cookies: () => cookieStore })
  const { data: { user } } = await supa.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json() as {
    action: 'dismiss' | 'skip'
    blockPattern?: string
    patternType?: 'sender' | 'domain'
  }

  if (body.action === 'skip') {
    const skippedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    await supa.from('interaction_review_queue')
      .update({ status: 'skipped', skipped_until: skippedUntil })
      .eq('id', id).eq('user_id', user.id)
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'dismiss') {
    await supa.from('interaction_review_queue')
      .update({ status: 'dismissed' }).eq('id', id).eq('user_id', user.id)
    if (body.blockPattern && body.patternType) {
      const safe = body.blockPattern.trim().toLowerCase()
      if (safe) {
        await supa.from('blocked_senders').insert({
          user_id: user.id,
          pattern: safe,
          pattern_type: body.patternType,
        })
      }
    }
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/review-queue/[id]/route.ts
git commit -m "feat: add dismiss-with-block and skip-for-now API actions"
```

---

### Task 6: Update `ReviewItemPanel` UI

**Files:**
- Modify: `src/components/ReviewItemPanel.tsx`

The current panel has two buttons: Confirm and Dismiss. We expand dismiss into three options (plain / block sender / block domain) via a dropdown, and add a Skip button.

- [ ] **Step 1: Add dismiss state and new action functions**

Replace the entire file:

```typescript
'use client'
import { useEffect, useState } from 'react'

interface Props {
  item: { id: string; type: string; summary: string; notes: string
    occurred_at: string; counterparty_email: string | null
    suggested_contact_id: string | null; suggested_contact_name: string | null }
  onClose: () => void
  onDone: () => void
}
interface ContactLite { id: string; name: string; email?: string }

export function ReviewItemPanel({ item, onClose, onDone }: Props) {
  const [contactId, setContactId] = useState(item.suggested_contact_id ?? '')
  const [type, setType] = useState(item.type)
  const [date, setDate] = useState(item.occurred_at.slice(0, 10))
  const [summary, setSummary] = useState(item.summary)
  const [notes, setNotes] = useState(item.notes)
  const [search, setSearch] = useState(item.suggested_contact_name ?? '')
  const [results, setResults] = useState<ContactLite[]>([])
  const [showDismissMenu, setShowDismissMenu] = useState(false)

  useEffect(() => {
    if (search.length < 2) { setResults([]); return }
    const t = setTimeout(async () => {
      const r = await fetch(`/api/contacts?search=${encodeURIComponent(search)}`)
        .then(x => x.json())
      setResults(r.contacts ?? r ?? [])
    }, 250)
    return () => clearTimeout(t)
  }, [search])

  async function confirm() {
    await fetch(`/api/review-queue/${item.id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contact_id: contactId, type, date, summary, notes,
        learn_alias: !!item.counterparty_email,
      }),
    })
    onDone()
  }

  async function dismiss(blockPattern?: string, patternType?: 'sender' | 'domain') {
    await fetch(`/api/review-queue/${item.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'dismiss', blockPattern, patternType }),
    })
    onDone()
  }

  async function skip() {
    await fetch(`/api/review-queue/${item.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'skip' }),
    })
    onDone()
  }

  const senderDomain = item.counterparty_email?.split('@')[1] ?? null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative w-full max-w-[760px] bg-white h-full overflow-y-auto p-6 animate-slide-in-right">
        <div className="flex justify-between mb-4">
          <h3 className="text-lg font-semibold">Review detected interaction</h3>
          <button onClick={onClose}>✕</button>
        </div>

        <label className="block text-sm font-medium">Contact</label>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search contacts…" className="w-full border rounded p-2 mb-1" />
        {results.length > 0 && (
          <ul className="border rounded mb-2 max-h-40 overflow-y-auto">
            {results.map(c => (
              <li key={c.id}>
                <button className="w-full text-left p-2 hover:bg-slate-50"
                  onClick={() => { setContactId(c.id); setSearch(c.name); setResults([]) }}>
                  {c.name} {c.email ? `· ${c.email}` : ''}
                </button>
              </li>
            ))}
          </ul>
        )}
        {!contactId && <p className="text-xs text-amber-600 mb-2">No contact selected — required to confirm.</p>}

        <label className="block text-sm font-medium mt-3">Type</label>
        <select value={type} onChange={e => setType(e.target.value)}
          className="w-full border rounded p-2 mb-3">
          {['email','phone','video_call','linkedin','meeting','other']
            .map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <label className="block text-sm font-medium">Date</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="w-full border rounded p-2 mb-3" />

        <label className="block text-sm font-medium">Summary</label>
        <input value={summary} onChange={e => setSummary(e.target.value)}
          className="w-full border rounded p-2 mb-3" />

        <label className="block text-sm font-medium">Notes</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)}
          rows={6} className="w-full border rounded p-2 mb-4" />

        <div className="flex gap-2 flex-wrap">
          <button disabled={!contactId} onClick={confirm}
            className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-40">
            Confirm
          </button>

          <div className="relative">
            <button onClick={() => setShowDismissMenu(v => !v)}
              className="border px-4 py-2 rounded">
              Dismiss ▾
            </button>
            {showDismissMenu && (
              <div className="absolute bottom-full mb-1 left-0 bg-white border rounded shadow-lg z-10 min-w-[220px]">
                <button onClick={() => dismiss()}
                  className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm">
                  Dismiss this item
                </button>
                {item.counterparty_email && (
                  <button onClick={() => dismiss(item.counterparty_email!, 'sender')}
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm">
                    Block {item.counterparty_email}
                  </button>
                )}
                {senderDomain && (
                  <button onClick={() => dismiss(senderDomain, 'domain')}
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm">
                    Block all from @{senderDomain}
                  </button>
                )}
              </div>
            )}
          </div>

          <button onClick={skip}
            className="border px-4 py-2 rounded text-slate-500">
            Skip for now
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ReviewItemPanel.tsx
git commit -m "feat: expand dismiss options (plain/block sender/block domain) + skip for now"
```

---

### Task 7: Manual verification

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify heuristic pre-filter (unit test confirmation)**

```bash
npm test -- --reporter=verbose 2>&1 | grep -E "PASS|FAIL|gmail"
```

Expected: all gmail tests pass.

- [ ] **Step 3: Verify skip works in the UI**

Open the app at `http://localhost:3001`, go to the Network tab, open the Detected card. Open any pending item. Click "Skip for now". Confirm the item disappears from the list. It will re-appear after 7 days (or you can manually set `skipped_until` to a past timestamp in the Supabase table editor to verify re-surfacing).

- [ ] **Step 4: Verify dismiss-and-learn works in the UI**

Open the Detected card, open a pending item with a counterparty email. Click "Dismiss ▾". Verify the dropdown shows:
- "Dismiss this item"
- "Block [email]"
- "Block all from @[domain]"

Click "Block all from @[domain]". Confirm the item disappears. Check the `blocked_senders` table in the Supabase dashboard to confirm a row was inserted with `pattern_type = 'domain'`.

- [ ] **Step 5: Commit any final fixes if needed, then push**

```bash
npm test
git push
```

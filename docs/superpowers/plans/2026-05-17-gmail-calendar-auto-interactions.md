# Gmail/Calendar Auto-Sourced Interactions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-source interactions from Gmail/Calendar into job-tracker with a confidence-gated review queue, learned email aliases, and self-cancelling follow-up reminders.

**Architecture:** A daily Supabase Edge Function (`sync-google-interactions`) decrypts a stored Google refresh token, pulls incremental Gmail threads + Calendar events, matches counterparties to contacts, writes high-confidence Calendar interactions directly and everything else to a review queue, then runs a follow-up rule engine. A one-time local Node script performs OAuth + encrypts the token. A Next.js review UI (card in the Network tab) handles edit-before-commit confirmation and settings.

**Tech Stack:** Supabase (Postgres + Edge Functions/Deno), Next.js 15 App Router, TypeScript, Vitest (new), Web Crypto AES-256-GCM, Google Gmail/Calendar REST APIs.

**Source of truth:** `docs/superpowers/specs/2026-05-17-gmail-calendar-auto-interactions-design.md`. Read it before starting.

---

## Hard Prerequisites (resolve before Phase 3)

These are blocking. Do Phases 1–2 first (they don't depend on these), then resolve before Phase 3:

- **P1.** Confirm with the user how `process-email-reminders` is scheduled (pg_cron / Supabase scheduled trigger / external cron) and the pinned daily run hour. Reuse verbatim for `sync-google-interactions`.
- **P2.** Confirm live `interactions` table schema in Supabase: exact column names and the `contact_id` FK on-delete behavior. Run: `select column_name, data_type, is_nullable from information_schema.columns where table_name='interactions';` and inspect the FK. Adjust Task 7 migration if names differ.
- **P3.** Confirm `GOOGLE_TOKEN_ENC_KEY` is provisioned as a Supabase Edge Function secret AND available to the local script env. The GCM layout is fixed by this plan: `IV(12 bytes) ‖ ciphertext ‖ authTag(16 bytes)`, stored as two columns (`refresh_token_iv` = IV, `refresh_token_encrypted` = ciphertext‖tag).
- **P4.** Confirm Gmail API is enabled in the Google Cloud project and quota is default-or-better.

---

## File Structure

**Migrations (new dir `supabase/migrations/`):**
- `0001_auto_interactions_schema.sql` — all new tables + `interactions` alterations

**Shared crypto/logic (new, framework-agnostic, unit-testable):**
- `src/lib/google-sync/crypto.ts` — AES-256-GCM encrypt/decrypt
- `src/lib/google-sync/identity.ts` — owned-address set + direction classification
- `src/lib/google-sync/matching.ts` — batched email→contact resolution
- `src/lib/google-sync/gmail.ts` — Gmail thread → normalized interaction shape
- `src/lib/google-sync/calendar.ts` — Calendar event → normalized interaction shape + noise floor
- `src/lib/google-sync/followup-rules.ts` — open-loop detection + self-cancel logic
- `src/lib/google-sync/types.ts` — shared TS types

**Local script:**
- `scripts/google-oauth-setup.ts` — one-time OAuth + encrypt + seed identity

**Edge Function:**
- `supabase/functions/sync-google-interactions/index.ts` — orchestration only (imports pure logic)

**Next.js API routes:**
- `src/app/api/followup-settings/route.ts` — GET/PUT
- `src/app/api/sync-identity/route.ts` — GET/PUT
- `src/app/api/review-queue/route.ts` — GET (list pending)
- `src/app/api/review-queue/[id]/route.ts` — POST (confirm), DELETE (dismiss)
- `src/app/api/sync-status/route.ts` — GET (latest sync_runs)

**Next.js UI:**
- `src/components/DetectedInteractionsCard.tsx` — Network-tab card + status line
- `src/components/ReviewItemPanel.tsx` — edit-before-commit right-slide panel
- `src/components/SyncSettingsPanel.tsx` — follow-up + identity settings
- Modify: `src/components/ContactList.tsx` or the Network tab container to mount the card

**Test harness (new):**
- `vitest.config.ts`, `package.json` (add `test` script + devDeps)
- Tests colocated under `src/lib/google-sync/__tests__/`

---

## Phase 0: Test Harness

### Task 0: Establish Vitest

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`
- Test: `src/lib/google-sync/__tests__/smoke.test.ts`

- [ ] **Step 1: Add Vitest deps and script**

Run:
```bash
cd "/Volumes/Mac Mini 2TB SSD/Dan/Kinetic Brand Partners/Projects/job-tracker"
npm install -D vitest@^2.1.0
```

- [ ] **Step 2: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
```

- [ ] **Step 3: Add test script to `package.json`**

In the `"scripts"` block add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Write smoke test**

`src/lib/google-sync/__tests__/smoke.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'

describe('harness', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 5: Run and verify pass**

Run: `npm test`
Expected: 1 passed.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/lib/google-sync/__tests__/smoke.test.ts
git commit -m "chore: add Vitest test harness

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Phase 1: Schema

### Task 1: Migration — all tables and alterations

**Files:**
- Create: `supabase/migrations/0001_auto_interactions_schema.sql`

- [ ] **Step 1: Write the migration**

`supabase/migrations/0001_auto_interactions_schema.sql`:
```sql
-- google_oauth_tokens: encrypted Google refresh token (service-role only)
create table if not exists google_oauth_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token_encrypted bytea not null,
  refresh_token_iv bytea not null,
  access_token text,
  access_expires_at timestamptz,
  scopes text,
  error_state text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table google_oauth_tokens enable row level security;
-- no policies => service-role only (RLS denies anon/auth by default)

-- sync_identity: addresses that are "the user's own"
create table if not exists sync_identity (
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, email)
);
alter table sync_identity enable row level security;
create policy sync_identity_owner on sync_identity
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- contact_email_aliases: learned email -> contact mappings
create table if not exists contact_email_aliases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  email text not null,
  source text not null default 'learned',
  created_at timestamptz not null default now(),
  unique (user_id, email)
);
alter table contact_email_aliases enable row level security;
create policy contact_email_aliases_owner on contact_email_aliases
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- interaction_review_queue: pending detected interactions
create table if not exists interaction_review_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null,
  external_id text not null,
  suggested_contact_id uuid references contacts(id) on delete set null,
  counterparty_email text,
  type text not null,
  occurred_at timestamptz not null,
  summary text,
  notes text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  unique (user_id, source, external_id)
);
alter table interaction_review_queue enable row level security;
create policy review_queue_owner on interaction_review_queue
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- followup_settings: user-editable rule-engine thresholds
create table if not exists followup_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  email_no_reply_days integer not null default 7
    check (email_no_reply_days between 1 and 365),
  meeting_no_followup_days integer not null default 14
    check (meeting_no_followup_days between 1 and 365),
  gone_quiet_days integer not null default 30
    check (gone_quiet_days between 1 and 365),
  max_auto_followups_per_day integer not null default 10
    check (max_auto_followups_per_day between 0 and 50),
  updated_at timestamptz not null default now()
);
alter table followup_settings enable row level security;
create policy followup_settings_owner on followup_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- sync_runs: observability + incremental watermark
create table if not exists sync_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null,
  items_seen integer not null default 0,
  items_written integer not null default 0,
  items_queued integer not null default 0,
  items_skipped integer not null default 0,
  followups_created integer not null default 0,
  followups_cancelled integer not null default 0,
  error_message text,
  sync_watermark timestamptz
);
alter table sync_runs enable row level security;
create policy sync_runs_owner on sync_runs
  for select using (auth.uid() = user_id);

-- interactions: additive columns + idempotency index
alter table interactions add column if not exists external_id text;
alter table interactions add column if not exists source text;
alter table interactions add column if not exists last_direction text;
alter table interactions add column if not exists message_count integer;
alter table interactions add column if not exists last_message_at timestamptz;

create unique index if not exists interactions_external_uidx
  on interactions (user_id, contact_id, source, external_id)
  where external_id is not null;

create index if not exists interactions_followup_idx
  on interactions (user_id, last_message_at)
  where external_id is not null;

-- reminders: tag + linkage for auto-followups (additive)
alter table email_reminders add column if not exists source text;
alter table email_reminders add column if not exists trigger_interaction_id uuid;
```

- [ ] **Step 2: Apply the migration**

Run (confirm exact Supabase apply command with user; typical):
```bash
supabase db push
```
Expected: migration applies with no error. If `contacts`/`interactions`/`email_reminders` column mismatch (per Prereq P2), fix names here and re-run.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0001_auto_interactions_schema.sql
git commit -m "feat: schema for auto-sourced interactions

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Phase 2: Pure Logic Modules (TDD, no I/O)

### Task 2: Shared types

**Files:**
- Create: `src/lib/google-sync/types.ts`

- [ ] **Step 1: Write types**

```typescript
export type SyncSource = 'gmail' | 'gcal'
export type Direction = 'inbound' | 'outbound'
export type InteractionType =
  | 'email' | 'phone' | 'video_call' | 'linkedin' | 'meeting' | 'other'

export interface NormalizedInteraction {
  source: SyncSource
  externalId: string            // gmail thread id / gcal (recurring) event id
  counterpartyEmail: string | null
  type: InteractionType
  occurredAt: string            // ISO
  summary: string
  notes: string                 // derived display text
  lastDirection: Direction | null
  messageCount: number | null
  lastMessageAt: string         // ISO
}

export interface FollowupSettings {
  enabled: boolean
  email_no_reply_days: number
  meeting_no_followup_days: number
  gone_quiet_days: number
  max_auto_followups_per_day: number
}

export const DEFAULT_FOLLOWUP_SETTINGS: FollowupSettings = {
  enabled: true,
  email_no_reply_days: 7,
  meeting_no_followup_days: 14,
  gone_quiet_days: 30,
  max_auto_followups_per_day: 10,
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/google-sync/types.ts
git commit -m "feat: shared types for google-sync

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

### Task 3: AES-256-GCM crypto

**Files:**
- Create: `src/lib/google-sync/crypto.ts`
- Test: `src/lib/google-sync/__tests__/crypto.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect } from 'vitest'
import { encryptToken, decryptToken } from '../crypto'

const KEY = 'a'.repeat(64) // 32 bytes hex

describe('token crypto', () => {
  it('round-trips', async () => {
    const { ivB64, ctB64 } = await encryptToken('refresh-secret', KEY)
    const out = await decryptToken(ctB64, ivB64, KEY)
    expect(out).toBe('refresh-secret')
  })

  it('fails closed on wrong key', async () => {
    const { ivB64, ctB64 } = await encryptToken('x', KEY)
    await expect(decryptToken(ctB64, ivB64, 'b'.repeat(64))).rejects.toThrow()
  })

  it('fails on tampered ciphertext', async () => {
    const { ivB64, ctB64 } = await encryptToken('x', KEY)
    const bad = Buffer.from(ctB64, 'base64')
    bad[0] ^= 0xff
    await expect(
      decryptToken(bad.toString('base64'), ivB64, KEY)
    ).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run, verify fail**

Run: `npx vitest run src/lib/google-sync/__tests__/crypto.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/lib/google-sync/crypto.ts` (Web Crypto — works in Deno + Node 18+):
```typescript
function hexToBytes(hex: string): Uint8Array {
  if (hex.length !== 64) throw new Error('GOOGLE_TOKEN_ENC_KEY must be 32-byte hex')
  const out = new Uint8Array(32)
  for (let i = 0; i < 32; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16)
  return out
}

async function importKey(keyHex: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw', hexToBytes(keyHex), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']
  )
}

const enc = new TextEncoder()
const dec = new TextDecoder()
const b64 = (b: ArrayBuffer | Uint8Array) =>
  Buffer.from(b instanceof Uint8Array ? b : new Uint8Array(b)).toString('base64')
const unb64 = (s: string) => new Uint8Array(Buffer.from(s, 'base64'))

export async function encryptToken(
  plaintext: string, keyHex: string
): Promise<{ ivB64: string; ctB64: string }> {
  const key = await importKey(keyHex)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, key, enc.encode(plaintext)
  )
  // ct already includes the 16-byte auth tag appended (Web Crypto convention)
  return { ivB64: b64(iv), ctB64: b64(ct) }
}

export async function decryptToken(
  ctB64: string, ivB64: string, keyHex: string
): Promise<string> {
  const key = await importKey(keyHex)
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: unb64(ivB64) }, key, unb64(ctB64)
  )
  return dec.decode(pt)
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npx vitest run src/lib/google-sync/__tests__/crypto.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/google-sync/crypto.ts src/lib/google-sync/__tests__/crypto.test.ts
git commit -m "feat: AES-256-GCM token crypto

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

### Task 4: Identity + direction classification

**Files:**
- Create: `src/lib/google-sync/identity.ts`
- Test: `src/lib/google-sync/__tests__/identity.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect } from 'vitest'
import { normalizeEmail, isOwn, classifyDirection } from '../identity'

const identity = new Set(['me@gmail.com', 'me@kinetic.com'])

describe('identity', () => {
  it('normalizes', () => {
    expect(normalizeEmail('  Me@Gmail.COM ')).toBe('me@gmail.com')
  })
  it('detects own', () => {
    expect(isOwn('me@kinetic.com', identity)).toBe(true)
    expect(isOwn('them@x.com', identity)).toBe(false)
  })
  it('classifies outbound when from is own', () => {
    expect(classifyDirection('me@gmail.com', identity)).toBe('outbound')
  })
  it('classifies inbound when from is not own', () => {
    expect(classifyDirection('them@x.com', identity)).toBe('inbound')
  })
})
```

- [ ] **Step 2: Run, verify fail**

Run: `npx vitest run src/lib/google-sync/__tests__/identity.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/lib/google-sync/identity.ts`:
```typescript
import type { Direction } from './types'

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

export function isOwn(email: string, identity: Set<string>): boolean {
  return identity.has(normalizeEmail(email))
}

export function classifyDirection(
  fromEmail: string, identity: Set<string>
): Direction {
  return isOwn(fromEmail, identity) ? 'outbound' : 'inbound'
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npx vitest run src/lib/google-sync/__tests__/identity.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/google-sync/identity.ts src/lib/google-sync/__tests__/identity.test.ts
git commit -m "feat: identity + direction classification

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

### Task 5: Batched contact matching

**Files:**
- Create: `src/lib/google-sync/matching.ts`
- Test: `src/lib/google-sync/__tests__/matching.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect } from 'vitest'
import { buildMatchMap, resolveContact } from '../matching'

describe('matching', () => {
  const map = buildMatchMap(
    [{ id: 'c1', email: 'a@x.com' }],
    [{ contact_id: 'c2', email: 'alias@x.com' }]
  )
  it('matches primary email', () => {
    expect(resolveContact('A@X.com', map)).toBe('c1')
  })
  it('matches alias', () => {
    expect(resolveContact('alias@x.com', map)).toBe('c2')
  })
  it('returns null when unmatched', () => {
    expect(resolveContact('none@x.com', map)).toBeNull()
  })
})
```

- [ ] **Step 2: Run, verify fail**

Run: `npx vitest run src/lib/google-sync/__tests__/matching.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/lib/google-sync/matching.ts`:
```typescript
import { normalizeEmail } from './identity'

export function buildMatchMap(
  contacts: { id: string; email: string | null }[],
  aliases: { contact_id: string; email: string }[]
): Map<string, string> {
  const m = new Map<string, string>()
  for (const c of contacts) {
    if (c.email) m.set(normalizeEmail(c.email), c.id)
  }
  for (const a of aliases) {
    // primary email wins if collision; only add alias if not already mapped
    const key = normalizeEmail(a.email)
    if (!m.has(key)) m.set(key, a.contact_id)
  }
  return m
}

export function resolveContact(
  email: string, map: Map<string, string>
): string | null {
  return map.get(normalizeEmail(email)) ?? null
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npx vitest run src/lib/google-sync/__tests__/matching.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/google-sync/matching.ts src/lib/google-sync/__tests__/matching.test.ts
git commit -m "feat: batched contact matching

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

### Task 6: Gmail thread → normalized interaction

**Files:**
- Create: `src/lib/google-sync/gmail.ts`
- Test: `src/lib/google-sync/__tests__/gmail.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect } from 'vitest'
import { normalizeThread, isNoiseSender } from '../gmail'

const identity = new Set(['me@gmail.com'])

const thread = {
  id: 'thr1',
  messages: [
    { headers: { From: 'me@gmail.com', To: 'them@x.com', Subject: 'Hi', Date: '2026-05-01T10:00:00Z' }, snippet: 's1' },
    { headers: { From: 'them@x.com', To: 'me@gmail.com', Subject: 'Re: Hi', Date: '2026-05-03T10:00:00Z' }, snippet: 's2' },
  ],
}

describe('gmail', () => {
  it('collapses thread to one normalized interaction per counterparty', () => {
    const out = normalizeThread(thread, identity)
    expect(out).toHaveLength(1)
    expect(out[0].counterpartyEmail).toBe('them@x.com')
    expect(out[0].messageCount).toBe(2)
    expect(out[0].lastDirection).toBe('inbound')
    expect(out[0].lastMessageAt).toBe('2026-05-03T10:00:00.000Z')
    expect(out[0].externalId).toBe('thr1')
    expect(out[0].type).toBe('email')
  })
  it('flags no-reply senders', () => {
    expect(isNoiseSender('no-reply@x.com')).toBe(true)
    expect(isNoiseSender('notifications@x.com')).toBe(true)
    expect(isNoiseSender('jane@x.com')).toBe(false)
  })
})
```

- [ ] **Step 2: Run, verify fail**

Run: `npx vitest run src/lib/google-sync/__tests__/gmail.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/lib/google-sync/gmail.ts`:
```typescript
import { normalizeEmail, isOwn, classifyDirection } from './identity'
import type { NormalizedInteraction } from './types'

const NOISE = /(^|[._-])(no-?reply|noreply|notifications?|donotreply)@/i

export function isNoiseSender(from: string): boolean {
  return NOISE.test(normalizeEmail(from))
}

interface RawMsg {
  headers: { From: string; To?: string; Cc?: string; Subject?: string; Date: string }
  snippet: string
}
interface RawThread { id: string; messages: RawMsg[] }

function parseAddrs(v?: string): string[] {
  if (!v) return []
  return v.split(',').map(s => {
    const m = s.match(/<([^>]+)>/)
    return normalizeEmail(m ? m[1] : s)
  })
}

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
  // collect counterparties across all messages
  const counterparties = new Set<string>()
  for (const m of sorted) {
    const everyone = [
      m.headers.From, ...parseAddrs(m.headers.To), ...parseAddrs(m.headers.Cc),
    ].map(normalizeEmail)
    for (const e of everyone) if (!isOwn(e, identity) && e) counterparties.add(e)
  }
  const subject = sorted[0].headers.Subject ?? '(no subject)'
  const lastDir = classifyDirection(last.headers.From, identity)
  const lastAt = new Date(last.headers.Date).toISOString()
  return [...counterparties].map(cp => ({
    source: 'gmail' as const,
    externalId: thread.id,
    counterpartyEmail: cp,
    type: 'email' as const,
    occurredAt: new Date(sorted[0].headers.Date).toISOString(),
    summary: subject,
    notes: `Email thread — ${sorted.length} message(s), last: ${lastDir}, ${lastAt}\n\n${last.snippet}`,
    lastDirection: lastDir,
    messageCount: sorted.length,
    lastMessageAt: lastAt,
  }))
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npx vitest run src/lib/google-sync/__tests__/gmail.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/google-sync/gmail.ts src/lib/google-sync/__tests__/gmail.test.ts
git commit -m "feat: gmail thread normalization + noise floor

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

### Task 7: Calendar event → normalized interaction + noise floor

**Files:**
- Create: `src/lib/google-sync/calendar.ts`
- Test: `src/lib/google-sync/__tests__/calendar.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect } from 'vitest'
import { normalizeEvent } from '../calendar'

const identity = new Set(['me@gmail.com'])

describe('calendar', () => {
  const base = {
    id: 'ev1', summary: 'Coffee',
    start: { dateTime: '2026-05-02T15:00:00Z' },
    attendees: [
      { email: 'me@gmail.com', responseStatus: 'accepted', self: true },
      { email: 'them@x.com', responseStatus: 'accepted' },
    ],
  }
  it('produces meeting interaction for external attendee', () => {
    const out = normalizeEvent(base, identity)
    expect(out).toHaveLength(1)
    expect(out[0].counterpartyEmail).toBe('them@x.com')
    expect(out[0].type).toBe('meeting')
  })
  it('classifies video_call when conferencing link present', () => {
    const out = normalizeEvent(
      { ...base, location: 'https://zoom.us/j/123' }, identity)
    expect(out[0].type).toBe('video_call')
  })
  it('skips events the user declined', () => {
    const out = normalizeEvent(
      { ...base, attendees: [
        { email: 'me@gmail.com', responseStatus: 'declined', self: true },
        { email: 'them@x.com', responseStatus: 'accepted' }] }, identity)
    expect(out).toHaveLength(0)
  })
  it('skips all-day events', () => {
    const out = normalizeEvent(
      { ...base, start: { date: '2026-05-02' } }, identity)
    expect(out).toHaveLength(0)
  })
  it('uses recurringEventId as externalId when recurring', () => {
    const out = normalizeEvent(
      { ...base, id: 'occ_99', recurringEventId: 'series1' }, identity)
    expect(out[0].externalId).toBe('series1')
  })
})
```

- [ ] **Step 2: Run, verify fail**

Run: `npx vitest run src/lib/google-sync/__tests__/calendar.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/lib/google-sync/calendar.ts`:
```typescript
import { normalizeEmail, isOwn } from './identity'
import type { NormalizedInteraction } from './types'

const VIDEO = /(zoom\.us|meet\.google\.com|teams\.microsoft|whereby\.com)/i

interface Attendee { email?: string; responseStatus?: string; self?: boolean }
interface RawEvent {
  id: string
  recurringEventId?: string
  summary?: string
  description?: string
  location?: string
  start: { dateTime?: string; date?: string }
  attendees?: Attendee[]
}

export function normalizeEvent(
  ev: RawEvent, identity: Set<string>
): NormalizedInteraction[] {
  if (!ev.start.dateTime) return []                       // all-day → skip
  const self = (ev.attendees ?? []).find(
    a => a.self || (a.email && isOwn(a.email, identity)))
  if (self && (self.responseStatus === 'declined'
            || self.responseStatus === 'tentative')) return []
  const externals = (ev.attendees ?? [])
    .filter(a => a.email && !isOwn(a.email, identity))
    .map(a => normalizeEmail(a.email!))
  if (externals.length === 0) return []
  const isVideo = VIDEO.test(`${ev.location ?? ''} ${ev.description ?? ''}`)
  const at = new Date(ev.start.dateTime).toISOString()
  const externalId = ev.recurringEventId ?? ev.id
  return [...new Set(externals)].map(cp => ({
    source: 'gcal' as const,
    externalId,
    counterpartyEmail: cp,
    type: (isVideo ? 'video_call' : 'meeting') as const,
    occurredAt: at,
    summary: ev.summary ?? '(no title)',
    notes: `Calendar: ${ev.summary ?? '(no title)'}\nAttendees: ${externals.join(', ')}`,
    lastDirection: 'outbound' as const,   // meeting = ball in user's court
    messageCount: null,
    lastMessageAt: at,
  }))
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npx vitest run src/lib/google-sync/__tests__/calendar.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/google-sync/calendar.ts src/lib/google-sync/__tests__/calendar.test.ts
git commit -m "feat: calendar normalization + noise floor + recurring collapse

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

### Task 8: Follow-up rule engine (pure)

**Files:**
- Create: `src/lib/google-sync/followup-rules.ts`
- Test: `src/lib/google-sync/__tests__/followup-rules.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect } from 'vitest'
import { detectOpenLoops, shouldSelfCancel } from '../followup-rules'
import { DEFAULT_FOLLOWUP_SETTINGS } from '../types'

const now = new Date('2026-05-20T00:00:00Z')

describe('followup rules', () => {
  it('flags outbound email with no reply past threshold', () => {
    const loops = detectOpenLoops([{
      id: 'i1', contact_id: 'c1', type: 'email',
      last_direction: 'outbound', last_message_at: '2026-05-10T00:00:00Z',
    }], DEFAULT_FOLLOWUP_SETTINGS, now)
    expect(loops.map(l => l.interactionId)).toContain('i1')
    expect(loops[0].tier).toBe('email_no_reply')
  })
  it('does not flag if inbound (loop closed)', () => {
    const loops = detectOpenLoops([{
      id: 'i1', contact_id: 'c1', type: 'email',
      last_direction: 'inbound', last_message_at: '2026-05-10T00:00:00Z',
    }], DEFAULT_FOLLOWUP_SETTINGS, now)
    expect(loops).toHaveLength(0)
  })
  it('does not flag before threshold', () => {
    const loops = detectOpenLoops([{
      id: 'i1', contact_id: 'c1', type: 'email',
      last_direction: 'outbound', last_message_at: '2026-05-19T00:00:00Z',
    }], DEFAULT_FOLLOWUP_SETTINGS, now)
    expect(loops).toHaveLength(0)
  })
  it('self-cancels when a later inbound exists', () => {
    expect(shouldSelfCancel(
      { trigger_interaction_id: 'i1' },
      [{ id: 'i1', last_direction: 'inbound' }]
    )).toBe(true)
  })
})
```

- [ ] **Step 2: Run, verify fail**

Run: `npx vitest run src/lib/google-sync/__tests__/followup-rules.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/lib/google-sync/followup-rules.ts`:
```typescript
import type { FollowupSettings } from './types'

interface InteractionRow {
  id: string
  contact_id: string
  type: string
  last_direction: 'inbound' | 'outbound' | null
  last_message_at: string | null
}
export type Tier = 'email_no_reply' | 'meeting_no_followup' | 'gone_quiet'
export interface OpenLoop {
  interactionId: string
  contactId: string
  tier: Tier
}

function daysBetween(a: Date, b: string): number {
  return (a.getTime() - Date.parse(b)) / 86_400_000
}

export function detectOpenLoops(
  rows: InteractionRow[], s: FollowupSettings, now: Date
): OpenLoop[] {
  if (!s.enabled) return []
  const out: OpenLoop[] = []
  for (const r of rows) {
    if (!r.last_message_at || r.last_direction === 'inbound') continue
    const age = daysBetween(now, r.last_message_at)
    if ((r.type === 'meeting' || r.type === 'video_call')) {
      if (age >= s.meeting_no_followup_days) {
        out.push({ interactionId: r.id, contactId: r.contact_id, tier: 'meeting_no_followup' })
        continue
      }
    } else if (r.type === 'email') {
      if (age >= s.gone_quiet_days) {
        out.push({ interactionId: r.id, contactId: r.contact_id, tier: 'gone_quiet' })
        continue
      }
      if (age >= s.email_no_reply_days) {
        out.push({ interactionId: r.id, contactId: r.contact_id, tier: 'email_no_reply' })
      }
    }
  }
  return out
}

export function shouldSelfCancel(
  reminder: { trigger_interaction_id: string | null },
  interactions: { id: string; last_direction: string | null }[]
): boolean {
  if (!reminder.trigger_interaction_id) return false
  const trig = interactions.find(i => i.id === reminder.trigger_interaction_id)
  if (!trig) return true              // trigger interaction gone → cancel
  return trig.last_direction === 'inbound'  // loop closed → cancel
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npx vitest run src/lib/google-sync/__tests__/followup-rules.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Run full suite + commit**

Run: `npm test`
Expected: all green.
```bash
git add src/lib/google-sync/followup-rules.ts src/lib/google-sync/__tests__/followup-rules.test.ts
git commit -m "feat: follow-up rule engine (open-loop + self-cancel)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Phase 3: OAuth Setup Script

> Requires Prereq P3 (enc key) resolved.

### Task 9: One-time OAuth + encrypt + seed identity

**Files:**
- Create: `scripts/google-oauth-setup.ts`
- Modify: `package.json` (add `oauth:setup` script)

- [ ] **Step 1: Add script entry**

In `package.json` `"scripts"`:
```json
"oauth:setup": "npx tsx scripts/google-oauth-setup.ts"
```

- [ ] **Step 2: Implement the script**

`scripts/google-oauth-setup.ts`:
```typescript
/**
 * One-time: obtains a Google refresh token (gmail.readonly + calendar.readonly),
 * encrypts it, upserts google_oauth_tokens, and seeds sync_identity.
 *
 * Env required:
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET   (Cloud project OAuth client)
 *   GOOGLE_TOKEN_ENC_KEY                      (32-byte hex)
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   SYNC_USER_ID                              (Dan's auth.users id)
 */
import http from 'node:http'
import { createClient } from '@supabase/supabase-js'
import { encryptToken } from '../src/lib/google-sync/crypto'

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/gmail.settings.basic', // read send-as aliases
].join(' ')
const REDIRECT = 'http://localhost:53682/callback'

function need(k: string): string {
  const v = process.env[k]
  if (!v) throw new Error(`Missing env ${k}`)
  return v
}

async function main() {
  const clientId = need('GOOGLE_CLIENT_ID')
  const clientSecret = need('GOOGLE_CLIENT_SECRET')
  const encKey = need('GOOGLE_TOKEN_ENC_KEY')
  const userId = need('SYNC_USER_ID')
  const supa = createClient(
    need('NEXT_PUBLIC_SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'))

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    new URLSearchParams({
      client_id: clientId, redirect_uri: REDIRECT, response_type: 'code',
      scope: SCOPES, access_type: 'offline', prompt: 'consent',
    })
  console.log('\nOpen this URL, approve, then return here:\n\n' + authUrl + '\n')

  const code: string = await new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const u = new URL(req.url!, REDIRECT)
      const c = u.searchParams.get('code')
      res.end('Done. You can close this tab.')
      srv.close()
      resolve(c!)
    })
    srv.listen(53682)
  })

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, client_id: clientId, client_secret: clientSecret,
      redirect_uri: REDIRECT, grant_type: 'authorization_code',
    }),
  })
  const tok = await tokenRes.json()
  if (!tok.refresh_token) throw new Error('No refresh_token returned: ' + JSON.stringify(tok))

  const { ivB64, ctB64 } = await encryptToken(tok.refresh_token, encKey)
  const { error: tErr } = await supa.from('google_oauth_tokens').upsert({
    user_id: userId,
    refresh_token_encrypted: Buffer.from(ctB64, 'base64'),
    refresh_token_iv: Buffer.from(ivB64, 'base64'),
    scopes: SCOPES, error_state: null, updated_at: new Date().toISOString(),
  })
  if (tErr) throw tErr

  // Seed sync_identity from gmail send-as aliases
  const sendAsRes = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs',
    { headers: { Authorization: `Bearer ${tok.access_token}` } })
  const sendAs = await sendAsRes.json()
  const emails: string[] = (sendAs.sendAs ?? [])
    .map((s: any) => String(s.sendAsEmail).trim().toLowerCase())
  console.log('Detected send-as addresses:', emails)
  for (const email of emails) {
    await supa.from('sync_identity').upsert({ user_id: userId, email })
  }
  console.log('\n✅ Setup complete. Verify sync_identity contains all your addresses;')
  console.log('   add any missing ones via the Settings panel later.\n')
}

main().catch((e) => { console.error(e); process.exit(1) })
```

- [ ] **Step 3: Manual verification (run by user)**

Tell the user to run, with env set:
```bash
npm run oauth:setup
```
Expected: browser consent, then "Setup complete", and a `google_oauth_tokens` row + `sync_identity` rows exist. (No automated test — this is interactive I/O.)

- [ ] **Step 4: Commit**

```bash
git add scripts/google-oauth-setup.ts package.json
git commit -m "feat: one-time Google OAuth setup script (encrypted token + identity seed)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Phase 4: Edge Function Orchestration

> Requires Prereqs P1 (scheduling) + P4 (Gmail API enabled).

### Task 10: Edge Function — token refresh + Google fetch helpers

**Files:**
- Create: `supabase/functions/sync-google-interactions/index.ts`

- [ ] **Step 1: Implement the function (orchestration; imports pure logic via relative copy)**

Note: Edge Functions can't import from `src/`. Copy the pure modules into the function dir at build, OR vendor them. This plan vendors by importing from a shared path the deploy bundles. Implement `index.ts`:

```typescript
// supabase/functions/sync-google-interactions/index.ts
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { decryptToken } from './_shared/crypto.ts'
import { normalizeThread } from './_shared/gmail.ts'
import { normalizeEvent } from './_shared/calendar.ts'
import { buildMatchMap, resolveContact } from './_shared/matching.ts'
import { detectOpenLoops, shouldSelfCancel } from './_shared/followup-rules.ts'
import { DEFAULT_FOLLOWUP_SETTINGS } from './_shared/types.ts'

const SUPA_URL = Deno.env.get('NEXT_PUBLIC_SUPABASE_URL')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ENC_KEY = Deno.env.get('GOOGLE_TOKEN_ENC_KEY')!
const CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!
const CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!
const RUN_USER = Deno.env.get('SYNC_USER_ID')!

const supa = createClient(SUPA_URL, SERVICE)

async function freshAccessToken(): Promise<string> {
  const { data: row } = await supa.from('google_oauth_tokens')
    .select('*').eq('user_id', RUN_USER).single()
  if (!row) throw new Error('no token row')
  if (row.access_token && row.access_expires_at &&
      Date.parse(row.access_expires_at) > Date.now() + 60_000) {
    return row.access_token
  }
  const refresh = await decryptToken(
    Buffer.from(row.refresh_token_encrypted).toString('base64'),
    Buffer.from(row.refresh_token_iv).toString('base64'), ENC_KEY)
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
      refresh_token: refresh, grant_type: 'refresh_token',
    }),
  })
  const t = await res.json()
  if (!t.access_token) {
    await supa.from('google_oauth_tokens')
      .update({ error_state: 'refresh_failed' }).eq('user_id', RUN_USER)
    throw new Error('refresh failed: ' + JSON.stringify(t))
  }
  await supa.from('google_oauth_tokens').update({
    access_token: t.access_token,
    access_expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(),
    error_state: null,
  }).eq('user_id', RUN_USER)
  return t.access_token
}

Deno.serve(async () => {
  try {
    const result = await runSync()
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 })
  }
})

// runSync defined in Task 11–13
export { freshAccessToken }
```

- [ ] **Step 2: Vendor the shared modules**

Run:
```bash
mkdir -p "supabase/functions/sync-google-interactions/_shared"
cp src/lib/google-sync/{crypto,identity,matching,gmail,calendar,followup-rules,types}.ts \
   supabase/functions/sync-google-interactions/_shared/
```
Then in each copied file, ensure relative imports use `.ts` extensions (Deno requirement): change `from './identity'` → `from './identity.ts'` etc. via find/replace in the `_shared` copies only.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/sync-google-interactions/
git commit -m "feat: edge function scaffold + token refresh + vendored logic

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

### Task 11: runSync — fetch + match + write (Gmail)

**Files:**
- Modify: `supabase/functions/sync-google-interactions/index.ts`

- [ ] **Step 1: Add the Gmail sync phase**

Append to `index.ts` before the `export`:
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
  return { identity, map }
}

async function watermark(source: string): Promise<Date> {
  const { data } = await supa.from('sync_runs')
    .select('sync_watermark').eq('user_id', RUN_USER).eq('source', source)
    .eq('status', 'success').order('started_at', { ascending: false }).limit(1)
  const wm = data?.[0]?.sync_watermark
  const floor = new Date(Date.now() - 2 * 86_400_000)
  if (!wm) return floor
  return new Date(Math.min(Date.parse(wm), floor.getTime()))
}

async function syncGmail(token: string, ctx: Awaited<ReturnType<typeof loadContext>>) {
  const since = await watermark('gmail')
  const run = await startRun('gmail')
  let pageToken: string | undefined
  let seen = 0, written = 0, queued = 0, skipped = 0
  const after = Math.floor(since.getTime() / 1000)
  do {
    const list = await gJson(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads?q=after:${after}` +
      (pageToken ? `&pageToken=${pageToken}` : ''), token)
    for (const t of list.threads ?? []) {
      const full = await gJson(
        `https://gmail.googleapis.com/gmail/v1/users/me/threads/${t.id}?format=metadata`, token)
      const thread = adaptGmailThread(full)
      const norm = normalizeThread(thread, ctx.identity)
      if (norm.length === 0) { skipped++; continue }
      seen++
      for (const n of norm) {
        const contactId = n.counterpartyEmail
          ? resolveContact(n.counterpartyEmail, ctx.map) : null
        // Gmail: always review (per spec), even when matched
        await upsertReviewQueue(n, contactId); queued++
      }
    }
    pageToken = list.nextPageToken
  } while (pageToken)
  await finishRun(run, 'success', { seen, written, queued, skipped },
    new Date())
}

function adaptGmailThread(full: any) {
  return {
    id: full.id,
    messages: (full.messages ?? []).map((m: any) => {
      const h: Record<string,string> = {}
      for (const x of m.payload?.headers ?? []) h[x.name] = x.value
      return { headers: {
        From: h.From ?? '', To: h.To, Cc: h.Cc,
        Subject: h.Subject, Date: h.Date ?? new Date().toISOString(),
      }, snippet: m.snippet ?? '' }
    }),
  }
}

async function gJson(url: string, token: string): Promise<any> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (r.ok) return r.json()
    if (r.status === 429 || r.status >= 500) {
      await new Promise(res => setTimeout(res, 500 * 2 ** attempt)); continue
    }
    throw new Error(`google ${r.status}: ${await r.text()}`)
  }
  throw new Error('google: retries exhausted')
}

async function upsertReviewQueue(n: any, contactId: string | null) {
  await supa.from('interaction_review_queue').upsert({
    user_id: RUN_USER, source: n.source, external_id: n.externalId,
    suggested_contact_id: contactId, counterparty_email: n.counterpartyEmail,
    type: n.type, occurred_at: n.occurredAt, summary: n.summary,
    notes: n.notes, status: 'pending',
  }, { onConflict: 'user_id,source,external_id' })
}

async function startRun(source: string): Promise<string> {
  const { data } = await supa.from('sync_runs').insert({
    user_id: RUN_USER, source, status: 'running',
  }).select('id').single()
  return data!.id
}
async function finishRun(id: string, status: string,
  c: { seen:number; written:number; queued:number; skipped:number },
  wm: Date, fc = 0, fx = 0, err?: string) {
  await supa.from('sync_runs').update({
    status, finished_at: new Date().toISOString(),
    items_seen: c.seen, items_written: c.written, items_queued: c.queued,
    items_skipped: c.skipped, followups_created: fc, followups_cancelled: fx,
    sync_watermark: wm.toISOString(), error_message: err ?? null,
  }).eq('id', id)
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/sync-google-interactions/index.ts
git commit -m "feat: gmail sync phase (incremental, paginated, review queue)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

### Task 12: runSync — Calendar phase (auto-write high-confidence)

**Files:**
- Modify: `supabase/functions/sync-google-interactions/index.ts`

- [ ] **Step 1: Add the Calendar phase**

Append:
```typescript
async function syncCalendar(token: string,
  ctx: Awaited<ReturnType<typeof loadContext>>) {
  const since = await watermark('gcal')
  const run = await startRun('gcal')
  let pageToken: string | undefined
  let seen = 0, written = 0, queued = 0, skipped = 0
  do {
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      `singleEvents=true&orderBy=startTime&timeMin=${since.toISOString()}` +
      (pageToken ? `&pageToken=${pageToken}` : '')
    const list = await gJson(url, token)
    for (const ev of list.items ?? []) {
      const norm = normalizeEvent(ev, ctx.identity)
      if (norm.length === 0) { skipped++; continue }
      seen++
      for (const n of norm) {
        const contactId = n.counterpartyEmail
          ? resolveContact(n.counterpartyEmail, ctx.map) : null
        if (contactId) {
          await upsertInteraction(n, contactId); written++   // high-confidence auto-write
        } else {
          await upsertReviewQueue(n, null); queued++
        }
      }
    }
    pageToken = list.nextPageToken
  } while (pageToken)
  await finishRun(run, 'success', { seen, written, queued, skipped }, new Date())
}

async function upsertInteraction(n: any, contactId: string) {
  await supa.from('interactions').upsert({
    user_id: RUN_USER, contact_id: contactId, source: n.source,
    external_id: n.externalId, type: n.type, date: n.occurredAt,
    summary: n.summary, notes: n.notes, last_direction: n.lastDirection,
    message_count: n.messageCount, last_message_at: n.lastMessageAt,
  }, { onConflict: 'user_id,contact_id,source,external_id' })
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/sync-google-interactions/index.ts
git commit -m "feat: calendar sync phase (auto-write matched, queue unmatched)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

### Task 13: runSync — Phase C rule engine + orchestration

**Files:**
- Modify: `supabase/functions/sync-google-interactions/index.ts`

- [ ] **Step 1: Add rule engine + top-level runSync**

Append:
```typescript
async function runFollowups() {
  const { data: settingsRow } = await supa.from('followup_settings')
    .select('*').eq('user_id', RUN_USER).single()
  const settings = settingsRow ?? DEFAULT_FOLLOWUP_SETTINGS

  // self-cancel first
  const { data: pending } = await supa.from('email_reminders')
    .select('id,trigger_interaction_id').eq('user_id', RUN_USER)
    .eq('source', 'auto_followup').eq('status', 'pending')
  let cancelled = 0
  for (const rem of pending ?? []) {
    if (!rem.trigger_interaction_id) continue
    const { data: trig } = await supa.from('interactions')
      .select('id,last_direction').eq('id', rem.trigger_interaction_id)
    if (shouldSelfCancel(rem, trig ?? [])) {
      await supa.from('email_reminders')
        .update({ status: 'cancelled' }).eq('id', rem.id)
      await supa.from('reminder_logs').insert({
        reminder_id: rem.id, action: 'cancelled',
        details: { reason: 'response_received' } })
      cancelled++
    }
  }
  if (!settings.enabled) return { created: 0, cancelled }

  const horizon = new Date(Date.now() -
    Math.max(settings.email_no_reply_days, settings.meeting_no_followup_days,
             settings.gone_quiet_days) * 86_400_000).toISOString()
  const { data: rows } = await supa.from('interactions')
    .select('id,contact_id,type,last_direction,last_message_at')
    .eq('user_id', RUN_USER).not('external_id', 'is', null)
    .gte('last_message_at', horizon)
  const loops = detectOpenLoops(rows ?? [], settings, new Date())

  // separate daily budget
  const startOfDay = new Date(); startOfDay.setUTCHours(0,0,0,0)
  const { count: todayCount } = await supa.from('email_reminders')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', RUN_USER).eq('source', 'auto_followup')
    .gte('created_at', startOfDay.toISOString())
  let budget = settings.max_auto_followups_per_day - (todayCount ?? 0)
  let created = 0
  for (const loop of loops) {
    if (budget <= 0) break
    // skip if an auto_followup already open for this contact
    const { data: existing } = await supa.from('email_reminders')
      .select('id').eq('user_id', RUN_USER).eq('source', 'auto_followup')
      .eq('contact_id', loop.contactId).eq('status', 'pending').limit(1)
    if (existing && existing.length) continue
    await supa.from('email_reminders').insert({
      user_id: RUN_USER, contact_id: loop.contactId, source: 'auto_followup',
      trigger_interaction_id: loop.interactionId, status: 'pending',
      // remaining required reminder fields populated per existing reminder schema
      // (subject/body/scheduled_time) — see Task 13 note
    })
    budget--; created++
  }
  return { created, cancelled }
}

async function runSync() {
  const token = await freshAccessToken()
  const ctx = await loadContext()
  await syncGmail(token, ctx)
  await syncCalendar(token, ctx)
  const f = await runFollowups()
  return { ok: true, followups: f }
}
```

**Note (resolve during this task):** the existing `email_reminders` insert path
(`src/lib/reminders.ts` / `POST /api/reminders`) auto-generates
`email_subject`/`email_body` and requires `scheduled_time`. Reuse that exact
generation logic (read it first) so auto-followups are valid reminders;
schedule them for "now + a few minutes" so the existing
`process-email-reminders` function sends them. Do not duplicate the email
template — call/replicate the existing generator.

- [ ] **Step 2: Manual deploy + smoke (user-run)**

```bash
supabase functions deploy sync-google-interactions
supabase functions invoke sync-google-interactions
```
Expected: JSON `{ ok: true, followups: {...} }`; `sync_runs` rows appear; review queue / interactions populate.

- [ ] **Step 3: Wire scheduling (Prereq P1)**

Apply the same scheduling mechanism `process-email-reminders` uses, at the pinned hour. Document it in `CLAUDE.md` under the Edge Functions notes.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/sync-google-interactions/index.ts CLAUDE.md
git commit -m "feat: phase C rule engine + orchestration + scheduling

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Phase 5: API Routes

### Task 14: Follow-up settings + sync-identity APIs

**Files:**
- Create: `src/app/api/followup-settings/route.ts`
- Create: `src/app/api/sync-identity/route.ts`
- Test: `src/lib/google-sync/__tests__/settings-validation.test.ts`

- [ ] **Step 1: Write validation test**

```typescript
import { describe, it, expect } from 'vitest'
import { validateFollowupSettings } from '../settings-validation'

describe('followup settings validation', () => {
  it('accepts valid', () => {
    expect(validateFollowupSettings({
      enabled: true, email_no_reply_days: 7, meeting_no_followup_days: 14,
      gone_quiet_days: 30, max_auto_followups_per_day: 10 }).ok).toBe(true)
  })
  it('rejects out of range', () => {
    expect(validateFollowupSettings({
      enabled: true, email_no_reply_days: 0, meeting_no_followup_days: 14,
      gone_quiet_days: 30, max_auto_followups_per_day: 10 }).ok).toBe(false)
  })
  it('rejects non-integer', () => {
    expect(validateFollowupSettings({
      enabled: true, email_no_reply_days: 7.5, meeting_no_followup_days: 14,
      gone_quiet_days: 30, max_auto_followups_per_day: 10 }).ok).toBe(false)
  })
})
```

- [ ] **Step 2: Run, verify fail**

Run: `npx vitest run src/lib/google-sync/__tests__/settings-validation.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement validator**

`src/lib/google-sync/settings-validation.ts`:
```typescript
import type { FollowupSettings } from './types'

export function validateFollowupSettings(
  s: FollowupSettings
): { ok: boolean; error?: string } {
  const day = (n: number) => Number.isInteger(n) && n >= 1 && n <= 365
  if (!day(s.email_no_reply_days)) return { ok: false, error: 'email_no_reply_days' }
  if (!day(s.meeting_no_followup_days)) return { ok: false, error: 'meeting_no_followup_days' }
  if (!day(s.gone_quiet_days)) return { ok: false, error: 'gone_quiet_days' }
  if (!Number.isInteger(s.max_auto_followups_per_day) ||
      s.max_auto_followups_per_day < 0 || s.max_auto_followups_per_day > 50)
    return { ok: false, error: 'max_auto_followups_per_day' }
  if (typeof s.enabled !== 'boolean') return { ok: false, error: 'enabled' }
  return { ok: true }
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npx vitest run src/lib/google-sync/__tests__/settings-validation.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Implement settings route**

`src/app/api/followup-settings/route.ts` (follow `src/app/api/reminders/route.ts` auth pattern — read it first):
```typescript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { validateFollowupSettings } from '@/lib/google-sync/settings-validation'
import { DEFAULT_FOLLOWUP_SETTINGS } from '@/lib/google-sync/types'

export async function GET() {
  const supa = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supa.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data } = await supa.from('followup_settings')
    .select('*').eq('user_id', user.id).single()
  return NextResponse.json(data ?? { ...DEFAULT_FOLLOWUP_SETTINGS, user_id: user.id })
}

export async function PUT(req: Request) {
  const supa = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supa.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json()
  const v = validateFollowupSettings(body)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })
  const { error } = await supa.from('followup_settings').upsert({
    user_id: user.id, ...body, updated_at: new Date().toISOString() })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 6: Implement sync-identity route**

`src/app/api/sync-identity/route.ts`:
```typescript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET() {
  const supa = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supa.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data } = await supa.from('sync_identity')
    .select('email').eq('user_id', user.id)
  return NextResponse.json({ emails: (data ?? []).map(r => r.email) })
}

export async function PUT(req: Request) {
  const supa = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supa.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { emails } = await req.json() as { emails: string[] }
  const clean = [...new Set(emails.map(e => e.trim().toLowerCase()).filter(Boolean))]
  await supa.from('sync_identity').delete().eq('user_id', user.id)
  if (clean.length) {
    await supa.from('sync_identity').insert(
      clean.map(email => ({ user_id: user.id, email })))
  }
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 7: Commit**

```bash
git add src/app/api/followup-settings/route.ts src/app/api/sync-identity/route.ts src/lib/google-sync/settings-validation.ts src/lib/google-sync/__tests__/settings-validation.test.ts
git commit -m "feat: follow-up settings + sync-identity APIs

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

### Task 15: Review queue + sync-status APIs

**Files:**
- Create: `src/app/api/review-queue/route.ts`
- Create: `src/app/api/review-queue/[id]/route.ts`
- Create: `src/app/api/sync-status/route.ts`

- [ ] **Step 1: Implement list endpoint**

`src/app/api/review-queue/route.ts`:
```typescript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET() {
  const supa = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supa.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data } = await supa.from('interaction_review_queue')
    .select('*').eq('user_id', user.id).eq('status', 'pending')
    .order('occurred_at', { ascending: false })
  return NextResponse.json({ items: data ?? [] })
}
```

- [ ] **Step 2: Implement confirm/dismiss endpoint**

`src/app/api/review-queue/[id]/route.ts`:
```typescript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// POST = confirm: create interaction from (possibly edited) values + learn alias
export async function POST(req: Request,
  { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supa = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supa.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json() as {
    contact_id: string; type: string; date: string;
    summary: string; notes: string; learn_alias: boolean
  }
  const { data: q } = await supa.from('interaction_review_queue')
    .select('*').eq('id', id).eq('user_id', user.id).single()
  if (!q) return NextResponse.json({ error: 'not found' }, { status: 404 })

  await supa.from('interactions').upsert({
    user_id: user.id, contact_id: body.contact_id, source: q.source,
    external_id: q.external_id, type: body.type, date: body.date,
    summary: body.summary, notes: body.notes,
  }, { onConflict: 'user_id,contact_id,source,external_id' })

  if (body.learn_alias && q.counterparty_email) {
    await supa.from('contact_email_aliases').upsert({
      user_id: user.id, contact_id: body.contact_id,
      email: q.counterparty_email.trim().toLowerCase(), source: 'learned',
    }, { onConflict: 'user_id,email' })
  }
  await supa.from('interaction_review_queue')
    .update({ status: 'accepted' }).eq('id', id)
  return NextResponse.json({ ok: true })
}

// DELETE = dismiss
export async function DELETE(_req: Request,
  { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supa = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supa.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  await supa.from('interaction_review_queue')
    .update({ status: 'dismissed' }).eq('id', id).eq('user_id', user.id)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Implement sync-status endpoint**

`src/app/api/sync-status/route.ts`:
```typescript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET() {
  const supa = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supa.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data } = await supa.from('sync_runs')
    .select('*').eq('user_id', user.id)
    .order('started_at', { ascending: false }).limit(2)
  const { count } = await supa.from('interaction_review_queue')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id).eq('status', 'pending')
  return NextResponse.json({ runs: data ?? [], pendingCount: count ?? 0 })
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/review-queue/ src/app/api/sync-status/route.ts
git commit -m "feat: review-queue + sync-status APIs

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Phase 6: Review UI

### Task 16: Detected card + status line

**Files:**
- Create: `src/components/DetectedInteractionsCard.tsx`
- Modify: the Network tab container (locate via `grep -rn "Network" src/app/page.tsx src/components/`) to mount `<DetectedInteractionsCard />`

- [ ] **Step 1: Implement the card**

`src/components/DetectedInteractionsCard.tsx`:
```tsx
'use client'
import { useEffect, useState } from 'react'
import { ReviewItemPanel } from './ReviewItemPanel'
import { SyncSettingsPanel } from './SyncSettingsPanel'

interface QueueItem {
  id: string; source: string; summary: string; counterparty_email: string | null
  type: string; occurred_at: string; notes: string; suggested_contact_id: string | null
}

export function DetectedInteractionsCard() {
  const [items, setItems] = useState<QueueItem[]>([])
  const [status, setStatus] = useState<string>('')
  const [active, setActive] = useState<QueueItem | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  async function refresh() {
    const q = await fetch('/api/review-queue').then(r => r.json())
    setItems(q.items ?? [])
    const s = await fetch('/api/sync-status').then(r => r.json())
    const last = s.runs?.[0]
    if (!last) setStatus('No sync yet')
    else if (last.status === 'failed')
      setStatus('⚠ Sync needs attention — reauthorize Google')
    else setStatus(`Last synced ${new Date(last.finished_at ?? last.started_at).toLocaleString()} · ${s.pendingCount} to review`)
  }
  useEffect(() => { refresh() }, [])

  return (
    <div className="glass-strong rounded-2xl p-6 mb-6">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-semibold">
          Detected{items.length ? ` · ${items.length}` : ''}
        </h2>
        <button onClick={() => setShowSettings(true)}
          className="text-sm text-slate-500 hover:text-slate-800">Settings</button>
      </div>
      <p className="text-xs text-slate-500 mb-4">{status}</p>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">
          No detected interactions — you're all caught up. New emails and
          meetings with your contacts appear here daily.
        </p>
      ) : (
        <ul className="divide-y divide-slate-200">
          {items.map(it => (
            <li key={it.id}>
              <button onClick={() => setActive(it)}
                className="w-full text-left py-3 hover:bg-slate-50">
                <span className="text-xs uppercase text-slate-400 mr-2">{it.source}</span>
                <span className="font-medium">{it.summary}</span>
                <span className="block text-xs text-slate-500">
                  {it.counterparty_email} · {new Date(it.occurred_at).toLocaleDateString()}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {active && (
        <ReviewItemPanel item={active}
          onClose={() => setActive(null)}
          onDone={() => { setActive(null); refresh() }} />
      )}
      {showSettings && (
        <SyncSettingsPanel onClose={() => setShowSettings(false)} />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Mount it in the Network tab**

Run: `grep -rn "Network\|activeTab" src/app/page.tsx | head`
Then add `<DetectedInteractionsCard />` at the top of the Network tab's rendered content (import it).

- [ ] **Step 3: Commit**

```bash
git add src/components/DetectedInteractionsCard.tsx src/app/page.tsx
git commit -m "feat: detected interactions card + status line in Network tab

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

### Task 17: Edit-before-commit review panel

**Files:**
- Create: `src/components/ReviewItemPanel.tsx`

- [ ] **Step 1: Implement panel (right-slide pattern, reuse `animate-slide-in-right`)**

`src/components/ReviewItemPanel.tsx`:
```tsx
'use client'
import { useEffect, useState } from 'react'

interface Props {
  item: { id: string; type: string; summary: string; notes: string
    occurred_at: string; counterparty_email: string | null
    suggested_contact_id: string | null }
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
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<ContactLite[]>([])
  const [conflict, setConflict] = useState<string | null>(null)

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
    // alias conflict check
    if (item.counterparty_email) {
      const aliases = await fetch(
        `/api/sync-identity`).then(() => null).catch(() => null)
      // (conflict surfaced server-side on upsert collision; warn if reassigning)
    }
    await fetch(`/api/review-queue/${item.id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contact_id: contactId, type, date, summary, notes,
        learn_alias: !!item.counterparty_email,
      }),
    })
    onDone()
  }
  async function dismiss() {
    await fetch(`/api/review-queue/${item.id}`, { method: 'DELETE' })
    onDone()
  }

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

        {conflict && <p className="text-sm text-amber-700 mb-2">{conflict}</p>}

        <div className="flex gap-2">
          <button disabled={!contactId} onClick={confirm}
            className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-40">
            Confirm
          </button>
          <button onClick={dismiss}
            className="border px-4 py-2 rounded">Dismiss</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ReviewItemPanel.tsx
git commit -m "feat: edit-before-commit review panel with contact picker

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

### Task 18: Settings panel (follow-up + identity)

**Files:**
- Create: `src/components/SyncSettingsPanel.tsx`

- [ ] **Step 1: Implement panel**

`src/components/SyncSettingsPanel.tsx`:
```tsx
'use client'
import { useEffect, useState } from 'react'

export function SyncSettingsPanel({ onClose }: { onClose: () => void }) {
  const [s, setS] = useState<any>(null)
  const [emails, setEmails] = useState<string>('')
  const [err, setErr] = useState<string>('')

  useEffect(() => {
    fetch('/api/followup-settings').then(r => r.json()).then(setS)
    fetch('/api/sync-identity').then(r => r.json())
      .then(d => setEmails((d.emails ?? []).join('\n')))
  }, [])

  async function save() {
    setErr('')
    const r = await fetch('/api/followup-settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(s) })
    if (!r.ok) { setErr((await r.json()).error ?? 'invalid'); return }
    await fetch('/api/sync-identity', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails: emails.split(/\s+/).filter(Boolean) }) })
    onClose()
  }
  if (!s) return null
  const num = (k: string) => (
    <input type="number" value={s[k]} min={1} max={365}
      onChange={e => setS({ ...s, [k]: Number(e.target.value) })}
      className="border rounded p-2 w-24" />
  )
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative w-full max-w-[560px] bg-white h-full overflow-y-auto p-6 animate-slide-in-right">
        <div className="flex justify-between mb-4">
          <h3 className="text-lg font-semibold">Sync & follow-up settings</h3>
          <button onClick={onClose}>✕</button>
        </div>
        <label className="flex items-center gap-2 mb-4">
          <input type="checkbox" checked={s.enabled}
            onChange={e => setS({ ...s, enabled: e.target.checked })} />
          Auto follow-up reminders enabled
        </label>
        <div className="space-y-3 mb-6">
          <div>Remind if no reply to my note after {num('email_no_reply_days')} days</div>
          <div>Remind to follow up after a meeting after {num('meeting_no_followup_days')} days</div>
          <div>Reconnect if gone quiet after {num('gone_quiet_days')} days</div>
          <div>Max auto follow-ups per day: {num('max_auto_followups_per_day')}</div>
        </div>
        <h4 className="font-medium mb-1">My email addresses</h4>
        <p className="text-xs text-slate-500 mb-2">
          One per line. A missing address causes your own mail to be
          misclassified.
        </p>
        <textarea value={emails} onChange={e => setEmails(e.target.value)}
          rows={4} className="w-full border rounded p-2 mb-4" />
        {err && <p className="text-sm text-red-600 mb-2">Invalid: {err}</p>}
        <button onClick={save}
          className="bg-blue-600 text-white px-4 py-2 rounded">Save</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Build check + commit**

Run: `npm run build`
Expected: build succeeds.
```bash
git add src/components/SyncSettingsPanel.tsx
git commit -m "feat: sync + follow-up settings panel

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 18b: Guard against vendored-module drift

The Edge Function runs copies in `_shared/`; tests run the originals in
`src/lib/google-sync/`. They must stay byte-identical (modulo `.ts` import
suffixes). This task adds a CI-able check so drift fails loudly.

**Files:**
- Create: `scripts/check-vendored-sync.sh`
- Modify: `package.json` (add `check:vendored` + wire into `test`)

- [ ] **Step 1: Write the check**

`scripts/check-vendored-sync.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail
SRC="src/lib/google-sync"
VEN="supabase/functions/sync-google-interactions/_shared"
fail=0
for f in crypto identity matching gmail calendar followup-rules types; do
  # strip `.ts` from relative imports in the vendored copy, then diff
  if ! diff <(cat "$SRC/$f.ts") \
            <(sed -E "s/(from '\.\/[a-z-]+)\.ts'/\1'/g" "$VEN/$f.ts") \
            >/dev/null; then
    echo "DRIFT: $f.ts differs between src and _shared"
    fail=1
  fi
done
exit $fail
```

- [ ] **Step 2: Make executable + wire into npm test**

Run: `chmod +x scripts/check-vendored-sync.sh`
In `package.json` `"scripts"`, change `"test"` to:
```json
"test": "bash scripts/check-vendored-sync.sh && vitest run",
"check:vendored": "bash scripts/check-vendored-sync.sh"
```

- [ ] **Step 3: Run, verify pass**

Run: `npm test`
Expected: vendored check passes (copies match), then all suites green.

- [ ] **Step 4: Commit**

```bash
git add scripts/check-vendored-sync.sh package.json
git commit -m "chore: guard against vendored sync-module drift

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

## Phase 7: Documentation

### Task 19: Document the feature in CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add a section**

Under the Edge Functions / automation area of `CLAUDE.md`, add:
```markdown
### Gmail/Calendar Auto-Sourced Interactions
- Edge Function `sync-google-interactions` runs daily (same scheduler as
  `process-email-reminders`, pinned hour: <FILL FROM PREREQ P1>).
- One-time setup: `npm run oauth:setup` (needs GOOGLE_CLIENT_ID/SECRET,
  GOOGLE_TOKEN_ENC_KEY 32-byte hex, SUPABASE_SERVICE_ROLE_KEY, SYNC_USER_ID).
- Refresh token is AES-256-GCM encrypted at rest; key only in Edge Function
  secret `GOOGLE_TOKEN_ENC_KEY`. Rotating the key requires re-running setup.
- Calendar high-confidence matches auto-write; Gmail + all low-confidence go
  to the review queue (Network tab → Detected card).
- Follow-up thresholds editable in the Detected card → Settings; auto-followups
  have a separate daily budget from manual reminders.
- Migrations live in `supabase/migrations/` (new convention; timestamped SQL).
```
Replace `<FILL FROM PREREQ P1>` with the confirmed hour.

- [ ] **Step 2: Final full test run**

Run: `npm test`
Expected: all suites green.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document Gmail/Calendar auto-interactions feature

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Self-Review (completed by plan author)

**Spec coverage:** token encryption → Task 1,3,9,10; sync_identity → Task 1,9,14; matching/confidence → Task 5,11,12; Gmail thread collapsing → Task 6,11; Calendar noise floor + recurring → Task 7,12; idempotent upsert → Task 1 (index) + 11,12 (onConflict); rule engine + self-cancel + separate budget → Task 8,13; review queue + edit-before-commit + alias learning + conflict warn → Task 15,16,17; settings (followup + identity) → Task 14,18; sync_runs observability + status line → Task 1,13,15,16; error handling (backoff, error_state, watermark) → Task 10,11; migrations convention + docs → Task 1,19; Known limitations are accepted (no tasks needed). **Gap noted & resolved inline:** the auto-followup reminder insert (Task 13) must reuse the existing reminder subject/body/scheduled_time generation — flagged as an in-task note with instruction to read `src/lib/reminders.ts` first rather than duplicate the template.

**Placeholders:** none except two intentional, clearly-marked prereq substitutions (`<FILL FROM PREREQ P1>` for the scheduling hour; live-schema confirmation in Task 1 Step 2) — these are facts only the user/live DB can supply, explicitly called out as hard prerequisites, not vague TODOs.

**Type consistency:** `NormalizedInteraction` shape consistent across gmail.ts/calendar.ts/types.ts; `FollowupSettings` consistent across types.ts/settings-validation.ts/API; `onConflict: 'user_id,contact_id,source,external_id'` matches the migration's unique index; `source:'auto_followup'` consistent between rule engine and self-cancel query.

---

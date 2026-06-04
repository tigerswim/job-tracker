# Contact Follow-up Snooze Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-contact `followup_snoozed_until` timestamp so the daily auto-followup sync skips snoozed contacts, with snooze controls in both the contact detail panel and reminder emails.

**Architecture:** A nullable `timestamptz` column on `contacts` is the single source of truth. The Edge Function filters snoozed contacts before creating reminders. The UI exposes a dropdown in the contact modal; emails embed HMAC-signed snooze links that hit a new Next.js API route.

**Tech Stack:** PostgreSQL (Supabase migration), TypeScript/Next.js (API route + UI), Deno/TypeScript (Edge Function), Vitest (unit tests), Web Crypto API (HMAC-SHA256 for snooze links).

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `supabase/migrations/0008_contact_followup_snooze.sql` | Create | Add `followup_snoozed_until` column |
| `src/lib/supabase.ts` | Modify | Add field to `Contact` interface |
| `src/lib/contacts.ts` | Modify | Add field to all select column lists |
| `src/app/api/contacts/route.ts` | Modify | Add field to GET select list |
| `src/lib/google-sync/followup-rules.ts` | No change | Snooze filter is in caller, not here |
| `supabase/functions/sync-google-interactions/index.ts` | Modify | Filter snoozed contacts before `detectOpenLoops`; generate snooze links in email body |
| `supabase/functions/sync-google-interactions/_shared/followup-rules.ts` | No change | Stays in sync with src automatically |
| `src/app/api/contacts/[id]/snooze/route.ts` | Create | HMAC-validated snooze link handler |
| `src/lib/snooze-hmac.ts` | Create | HMAC generation + validation (shared by API route and testable in Vitest) |
| `src/components/ContactList.tsx` | Modify | Add snooze dropdown + status badge to `ContactModal` |
| `src/lib/google-sync/__tests__/followup-rules.test.ts` | Modify | Add snooze-filter tests |
| `src/lib/google-sync/__tests__/snooze-hmac.test.ts` | Create | HMAC unit tests |

---

## Task 1: Migration — add `followup_snoozed_until` to contacts

**Files:**
- Create: `supabase/migrations/0008_contact_followup_snooze.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0008_contact_followup_snooze.sql
ALTER TABLE contacts ADD COLUMN followup_snoozed_until timestamptz;
```

- [ ] **Step 2: Apply the migration**

Run in the Supabase SQL editor (Dashboard → SQL editor):
```sql
ALTER TABLE contacts ADD COLUMN followup_snoozed_until timestamptz;
```
Expected: no error, column appears in Table Editor for `contacts`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0008_contact_followup_snooze.sql
git commit -m "feat: add followup_snoozed_until column to contacts"
```

---

## Task 2: Update TypeScript types and contact select queries

**Files:**
- Modify: `src/lib/supabase.ts:14-30`
- Modify: `src/lib/contacts.ts`
- Modify: `src/app/api/contacts/route.ts`

- [ ] **Step 1: Add field to the `Contact` interface**

In `src/lib/supabase.ts`, add one line to the `Contact` interface after `updated_at`:

```typescript
export interface Contact {
  id: string
  name: string
  email?: string
  phone?: string
  current_location?: string
  company?: string
  job_title?: string
  linkedin_url?: string
  notes?: string
  experience?: ExperienceEntry[]
  education?: EducationEntry[]
  mutual_connections?: string[]
  user_id: string
  created_at: string
  updated_at: string
  followup_snoozed_until?: string | null
}
```

- [ ] **Step 2: Add field to `getContactsLite` select list**

In `src/lib/contacts.ts`, find the `getContactsLite` select string (line ~64) and add `followup_snoozed_until`:

```typescript
.select('id,name,company,job_title,email,phone,current_location,linkedin_url,notes,mutual_connections,experience,education,created_at,updated_at,user_id,followup_snoozed_until')
```

- [ ] **Step 3: Add field to `searchContacts` select list**

In `src/lib/contacts.ts`, find the `searchContacts` select string (line ~100) and add `followup_snoozed_until`:

```typescript
.select('id,name,company,job_title,email,phone,current_location,linkedin_url,notes,mutual_connections,experience,education,created_at,updated_at,user_id,followup_snoozed_until', { count: 'exact' })
```

- [ ] **Step 4: Add field to `getContactsBatch` select list**

In `src/lib/contacts.ts`, find the `getContactsBatch` select string (line ~141) and add `followup_snoozed_until`:

```typescript
.select('id,name,company,job_title,email,phone,current_location,linkedin_url,notes,mutual_connections,experience,education,created_at,updated_at,user_id,followup_snoozed_until', { count: 'exact' })
```

- [ ] **Step 5: Add field to the contacts GET API route**

In `src/app/api/contacts/route.ts`, find the `.select(` call (line ~23) and add `followup_snoozed_until`:

```typescript
.select(
  'id,name,company,job_title,email,phone,current_location,linkedin_url,notes,mutual_connections,experience,education,created_at,followup_snoozed_until',
  { count: 'exact' },
)
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabase.ts src/lib/contacts.ts src/app/api/contacts/route.ts
git commit -m "feat: expose followup_snoozed_until on Contact type and select queries"
```

---

## Task 3: Filter snoozed contacts in the Edge Function

**Files:**
- Modify: `supabase/functions/sync-google-interactions/index.ts`

- [ ] **Step 1: Add snoozed contact filter to `runFollowups()`**

In `supabase/functions/sync-google-interactions/index.ts`, find `runFollowups()` (line ~207). After `if (!settings.enabled) return { created: 0, cancelled }` and before `const horizon = ...`, insert:

```typescript
  // Fetch currently-snoozed contact IDs so we don't create reminders for them
  const now = new Date()
  const { data: snoozedContacts } = await supa.from('contacts')
    .select('id')
    .eq('user_id', RUN_USER)
    .gt('followup_snoozed_until', now.toISOString())
  const snoozedIds = new Set((snoozedContacts ?? []).map((r: { id: string }) => r.id))
```

Then change the `detectOpenLoops` call (line ~238) from:
```typescript
  const loops = detectOpenLoops(rows ?? [], settings, new Date())
```
to:
```typescript
  const loops = detectOpenLoops(rows ?? [], settings, now)
    .filter(l => !snoozedIds.has(l.contactId))
```

(Note: `now` is now defined above, so remove the `new Date()` inline call.)

- [ ] **Step 2: Verify the vendored drift check still passes**

Run:
```bash
cd "/Volumes/Mac Mini 2TB SSD/Dan/Kinetic Brand Partners/KBP Projects/job-tracker"
bash scripts/check-vendored-sync.sh
```
Expected output: no DRIFT lines, exit code 0. (We did not change `followup-rules.ts`, only the caller in `index.ts`, so no vendoring needed.)

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/sync-google-interactions/index.ts
git commit -m "feat: skip snoozed contacts in auto-followup reminder generation"
```

---

## Task 4: HMAC utility for snooze links

**Files:**
- Create: `src/lib/snooze-hmac.ts`

This module uses the Web Crypto API (available in Node 18+, Deno, and browsers) to generate and validate HMAC-SHA256 tokens for snooze links. It is imported by both the Next.js API route and the Edge Function.

- [ ] **Step 1: Write failing tests**

Create `src/lib/google-sync/__tests__/snooze-hmac.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { generateSnoozeToken, validateSnoozeToken, snoozeUntil } from '../../snooze-hmac'

const SECRET = 'a'.repeat(64) // 32-byte hex

describe('snooze HMAC', () => {
  it('validates a freshly generated token', async () => {
    const token = await generateSnoozeToken('contact-1', '1w', 'user-1', SECRET)
    expect(await validateSnoozeToken('contact-1', '1w', 'user-1', token, SECRET)).toBe(true)
  })

  it('rejects a tampered token', async () => {
    const token = await generateSnoozeToken('contact-1', '1w', 'user-1', SECRET)
    const tampered = token.slice(0, -4) + 'XXXX'
    expect(await validateSnoozeToken('contact-1', '1w', 'user-1', tampered, SECRET)).toBe(false)
  })

  it('rejects wrong duration', async () => {
    const token = await generateSnoozeToken('contact-1', '1w', 'user-1', SECRET)
    expect(await validateSnoozeToken('contact-1', '1m', 'user-1', token, SECRET)).toBe(false)
  })

  it('rejects wrong contactId', async () => {
    const token = await generateSnoozeToken('contact-1', '1w', 'user-1', SECRET)
    expect(await validateSnoozeToken('contact-2', '1w', 'user-1', token, SECRET)).toBe(false)
  })

  it('snoozeUntil 1w adds 7 days', () => {
    const base = new Date('2026-06-04T00:00:00Z')
    expect(snoozeUntil('1w', base).toISOString()).toBe('2026-06-11T00:00:00.000Z')
  })

  it('snoozeUntil 1m adds ~1 month', () => {
    const base = new Date('2026-06-04T00:00:00Z')
    expect(snoozeUntil('1m', base).toISOString()).toBe('2026-07-04T00:00:00.000Z')
  })

  it('snoozeUntil 3m adds ~3 months', () => {
    const base = new Date('2026-06-04T00:00:00Z')
    expect(snoozeUntil('3m', base).toISOString()).toBe('2026-09-04T00:00:00.000Z')
  })

  it('snoozeUntil indefinite returns year 2099', () => {
    const d = snoozeUntil('indefinite')
    expect(d.getFullYear()).toBe(2099)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "/Volumes/Mac Mini 2TB SSD/Dan/Kinetic Brand Partners/KBP Projects/job-tracker"
npx vitest run src/lib/google-sync/__tests__/snooze-hmac.test.ts
```
Expected: FAIL with "Cannot find module '../../snooze-hmac'"

- [ ] **Step 3: Implement `src/lib/snooze-hmac.ts`**

```typescript
// src/lib/snooze-hmac.ts
export type SnoozeDuration = '1w' | '1m' | '3m' | 'indefinite'

export function snoozeUntil(duration: SnoozeDuration, from: Date = new Date()): Date {
  const d = new Date(from)
  if (duration === '1w') { d.setDate(d.getDate() + 7) }
  else if (duration === '1m') { d.setMonth(d.getMonth() + 1) }
  else if (duration === '3m') { d.setMonth(d.getMonth() + 3) }
  else { d.setFullYear(2099) }
  return d
}

const enc = new TextEncoder()

async function importHmacKey(secretHex: string): Promise<CryptoKey> {
  const bytes = new Uint8Array(secretHex.match(/.{2}/g)!.map(b => parseInt(b, 16)))
  return crypto.subtle.importKey('raw', bytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

export async function generateSnoozeToken(
  contactId: string, duration: string, userId: string, secretHex: string
): Promise<string> {
  const key = await importHmacKey(secretHex)
  const msg = enc.encode(`${contactId}:${duration}:${userId}`)
  const sig = await crypto.subtle.sign('HMAC', key, msg)
  return Buffer.from(sig).toString('hex')
}

export async function validateSnoozeToken(
  contactId: string, duration: string, userId: string, token: string, secretHex: string
): Promise<boolean> {
  try {
    const expected = await generateSnoozeToken(contactId, duration, userId, secretHex)
    // Constant-time comparison
    if (expected.length !== token.length) return false
    let diff = 0
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i)
    return diff === 0
  } catch {
    return false
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/google-sync/__tests__/snooze-hmac.test.ts
```
Expected: all 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/snooze-hmac.ts src/lib/google-sync/__tests__/snooze-hmac.test.ts
git commit -m "feat: add snooze HMAC utility with tests"
```

---

## Task 5: Snooze link API route

**Files:**
- Create: `src/app/api/contacts/[id]/snooze/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// src/app/api/contacts/[id]/snooze/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateSnoozeToken, snoozeUntil, SnoozeDuration } from '@/lib/snooze-hmac'

const VALID_DURATIONS: SnoozeDuration[] = ['1w', '1m', '3m', 'indefinite']

const DURATION_LABEL: Record<SnoozeDuration, string> = {
  '1w': '1 week',
  '1m': '1 month',
  '3m': '3 months',
  'indefinite': 'indefinitely',
}

function htmlPage(title: string, body: string): NextResponse {
  return new NextResponse(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
     <style>body{font-family:system-ui,sans-serif;max-width:480px;margin:80px auto;padding:0 16px;text-align:center}
     h1{font-size:1.4rem}p{color:#555}</style></head>
     <body><h1>${title}</h1><p>${body}</p></body></html>`,
    { headers: { 'Content-Type': 'text/html' } }
  )
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(request.url)
  const duration = searchParams.get('duration') as SnoozeDuration | null
  const uid = searchParams.get('uid')
  const token = searchParams.get('token')

  if (!duration || !uid || !token) {
    return htmlPage('Invalid link', 'This snooze link is missing required parameters.')
  }

  if (!VALID_DURATIONS.includes(duration)) {
    return htmlPage('Invalid link', 'Unknown snooze duration.')
  }

  const secret = process.env.SNOOZE_LINK_SECRET
  if (!secret) {
    console.error('SNOOZE_LINK_SECRET not set')
    return htmlPage('Configuration error', 'Snooze links are not configured.')
  }

  const valid = await validateSnoozeToken(params.id, duration, uid, token, secret)
  if (!valid) {
    return htmlPage('Invalid link', 'This snooze link is invalid or has been tampered with.')
  }

  // Use service role to update without needing user session
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: contact, error: fetchErr } = await supabase
    .from('contacts')
    .select('name')
    .eq('id', params.id)
    .eq('user_id', uid)
    .single()

  if (fetchErr || !contact) {
    return htmlPage('Not found', 'Contact not found.')
  }

  const until = snoozeUntil(duration)
  const { error: updateErr } = await supabase
    .from('contacts')
    .update({ followup_snoozed_until: until.toISOString() })
    .eq('id', params.id)
    .eq('user_id', uid)

  if (updateErr) {
    console.error('Snooze update failed:', updateErr)
    return htmlPage('Error', 'Failed to save snooze. Please try again.')
  }

  const label = DURATION_LABEL[duration]
  const name = contact.name as string
  return htmlPage(
    'Follow-up snoozed',
    `Got it — follow-up reminders for <strong>${name}</strong> are snoozed for ${label}.`
  )
}
```

- [ ] **Step 2: Verify the route file is in the right place**

```bash
ls "/Volumes/Mac Mini 2TB SSD/Dan/Kinetic Brand Partners/KBP Projects/job-tracker/src/app/api/contacts/[id]/snooze/"
```
Expected: `route.ts`

- [ ] **Step 3: Add `SNOOZE_LINK_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` to `.env.local`**

The user must add these values manually (never put secrets in chat). Run:
```bash
openssl rand -hex 32
```
Copy the output. Then open `.env.local` and add:
```
SNOOZE_LINK_SECRET=<output from above>
SUPABASE_SERVICE_ROLE_KEY=<from Supabase dashboard → Settings → API → service_role key>
```

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/contacts/[id]/snooze/route.ts"
git commit -m "feat: add snooze link API route with HMAC validation"
```

---

## Task 6: Embed snooze links in auto-followup emails

**Files:**
- Modify: `supabase/functions/sync-google-interactions/index.ts`

The Edge Function needs to generate HMAC-signed snooze links. It can't import from `src/lib/snooze-hmac.ts` (that's a Next.js module). The HMAC logic is small enough to inline — Deno has `crypto.subtle` natively.

- [ ] **Step 1: Add snooze link generation helper to the Edge Function**

In `supabase/functions/sync-google-interactions/index.ts`, add this helper function near the top (after imports):

```typescript
async function buildSnoozeLinks(
  contactId: string, userId: string, appUrl: string, secret: string
): Promise<Record<string, string>> {
  const enc = new TextEncoder()
  async function hmac(duration: string): Promise<string> {
    const keyBytes = new Uint8Array(secret.match(/.{2}/g)!.map((b: string) => parseInt(b, 16)))
    const key = await crypto.subtle.importKey(
      'raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    )
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${contactId}:${duration}:${userId}`))
    return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
  }
  const durations = ['1w', '1m', '3m', 'indefinite'] as const
  const links: Record<string, string> = {}
  for (const d of durations) {
    const token = await hmac(d)
    links[d] = `${appUrl}/api/contacts/${contactId}/snooze?duration=${d}&uid=${userId}&token=${token}`
  }
  return links
}
```

- [ ] **Step 2: Read `SNOOZE_LINK_SECRET` and `APP_URL` in `runFollowups`**

At the top of the `runFollowups()` function body, add:

```typescript
  const snoozeSecret = Deno.env.get('SNOOZE_LINK_SECRET') ?? ''
  const appUrl = Deno.env.get('APP_URL') ?? 'https://job-tracker.kineticbrandpartners.com'
```

- [ ] **Step 3: Generate snooze links and build HTML email body when inserting a reminder**

In the `for (const loop of loops)` block in `runFollowups()`, replace the `email_body: subject` line in the `.insert({...})` call with a snooze-links HTML block. The full insert should become:

```typescript
    const snoozeLinks = snoozeSecret
      ? await buildSnoozeLinks(loop.contactId, RUN_USER, appUrl, snoozeSecret)
      : null

    const emailBody = snoozeLinks
      ? `<p>${subject}</p>
<p style="margin-top:16px;font-size:14px;color:#555;">Snooze follow-up reminders for this contact:</p>
<p>
  <a href="${snoozeLinks['1w']}" style="margin-right:12px;color:#2563eb;">1 week</a>
  <a href="${snoozeLinks['1m']}" style="margin-right:12px;color:#2563eb;">1 month</a>
  <a href="${snoozeLinks['3m']}" style="margin-right:12px;color:#2563eb;">3 months</a>
  <a href="${snoozeLinks['indefinite']}" style="color:#2563eb;">Indefinitely</a>
</p>`
      : subject

    await supa.from('email_reminders').insert({
      user_id: RUN_USER, contact_id: loop.contactId, source: 'auto_followup',
      trigger_interaction_id: loop.interactionId, status: 'pending',
      scheduled_time: scheduled, user_timezone: 'America/New_York',
      email_subject: subject,
      email_body: emailBody,
      user_message: subject,
    })
```

- [ ] **Step 4: Add `SNOOZE_LINK_SECRET` to Supabase Edge Function secrets**

In the Supabase dashboard → Edge Functions → `sync-google-interactions` → Secrets, add:
- `SNOOZE_LINK_SECRET` = same value as in `.env.local`

Also add to Netlify environment variables (Dashboard → Site → Environment Variables):
- `SNOOZE_LINK_SECRET` = same value
- `SUPABASE_SERVICE_ROLE_KEY` = service role key (if not already present)

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/sync-google-interactions/index.ts
git commit -m "feat: embed HMAC-signed snooze links in auto-followup reminder emails"
```

---

## Task 7: Snooze UI in the contact detail panel

**Files:**
- Modify: `src/components/ContactList.tsx`

The `ContactModal` component (line ~376) needs a snooze button in its header and a status badge in its content area.

- [ ] **Step 1: Add `useState` for snooze dropdown and import `updateContact` + `snoozeUntil`**

Near the top of `ContactModal`, add imports and local state. Find the existing imports at the top of `ContactList.tsx` and add:

```typescript
import { updateContact } from '@/lib/contacts'
import { snoozeUntil, SnoozeDuration } from '@/lib/snooze-hmac'
```

Inside the `ContactModal` component function body (just before `return`), add:

```typescript
  const [showSnoozeMenu, setShowSnoozeMenu] = useState(false)
  const [snoozeLoading, setSnoozLoading] = useState(false)
  const [localSnoozedUntil, setLocalSnoozedUntil] = useState<string | null>(
    contact.followup_snoozed_until ?? null
  )

  const isSnoozed = localSnoozedUntil && new Date(localSnoozedUntil) > new Date()

  async function applySnooze(duration: SnoozeDuration) {
    setSnoozLoading(true)
    setShowSnoozeMenu(false)
    const until = snoozeUntil(duration)
    await updateContact(contact.id, { followup_snoozed_until: until.toISOString() })
    setLocalSnoozedUntil(until.toISOString())
    setSnoozLoading(false)
  }

  async function clearSnooze() {
    setSnoozLoading(true)
    await updateContact(contact.id, { followup_snoozed_until: null })
    setLocalSnoozedUntil(null)
    setSnoozLoading(false)
  }
```

- [ ] **Step 2: Add snooze button to the modal header**

In `ContactModal`, find the header action buttons area (around line ~416, the Edit and close buttons). Add a snooze button between Edit and close:

```tsx
              {/* Snooze button */}
              <div className="relative">
                <button
                  onClick={() => setShowSnoozeMenu(v => !v)}
                  disabled={snoozeLoading}
                  className="p-1.5 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-all duration-200"
                  title="Snooze follow-up reminders"
                >
                  <Clock className="w-3 h-3" />
                </button>
                {showSnoozeMenu && (
                  <div className="absolute right-0 top-8 bg-white text-slate-800 rounded-lg shadow-lg border border-slate-200 z-10 min-w-[160px]">
                    <div className="px-3 py-2 text-xs font-semibold text-slate-500 border-b border-slate-100">
                      Snooze follow-ups
                    </div>
                    {(['1w', '1m', '3m', 'indefinite'] as const).map(d => (
                      <button
                        key={d}
                        onClick={() => applySnooze(d)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                      >
                        {{ '1w': '1 week', '1m': '1 month', '3m': '3 months', 'indefinite': 'Indefinitely' }[d]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
```

Make sure `Clock` is imported from `lucide-react`. Check the existing imports at the top of `ContactList.tsx` — if `Clock` is not there, add it to the lucide import line.

- [ ] **Step 3: Add snooze status badge to the modal content**

In `ContactModal`'s content area (the scrollable `<div className="flex-1 overflow-y-auto...">` around line ~435), add the badge as the first child inside the content `<div className="space-y-4">`:

```tsx
            {/* Snooze status badge */}
            {isSnoozed && (
              <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm">
                <span className="text-amber-800">
                  Follow-ups snoozed until{' '}
                  {new Date(localSnoozedUntil!).getFullYear() >= 2099
                    ? 'further notice'
                    : new Date(localSnoozedUntil!).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <button
                  onClick={clearSnooze}
                  className="text-amber-600 hover:text-amber-800 text-xs underline ml-2"
                >
                  Clear
                </button>
              </div>
            )}
```

- [ ] **Step 4: Build and check for TypeScript errors**

```bash
cd "/Volumes/Mac Mini 2TB SSD/Dan/Kinetic Brand Partners/KBP Projects/job-tracker"
npm run build 2>&1 | grep -E "error|Error" | head -20
```
Expected: no TypeScript errors related to `followup_snoozed_until` or new components.

- [ ] **Step 5: Start dev server and manually test**

```bash
npm run dev
```
Open http://localhost:3001, go to Network tab, open any contact, verify:
- Clock icon appears in header
- Clicking it shows dropdown with 4 options
- Selecting an option shows the amber badge with correct date
- "Clear" removes the badge
- Reopening the contact shows the badge (confirming DB write)

- [ ] **Step 6: Commit**

```bash
git add src/components/ContactList.tsx
git commit -m "feat: add snooze follow-ups dropdown and status badge to contact panel"
```

---

## Task 8: Extend followup-rules tests for snooze filtering

**Files:**
- Modify: `src/lib/google-sync/__tests__/followup-rules.test.ts`

The snooze filter lives in `runFollowups()` in the Edge Function (not in `detectOpenLoops` itself), so we test the filter pattern directly here with a small helper that mirrors the caller logic.

- [ ] **Step 1: Add snooze-filter test cases**

Append to `src/lib/google-sync/__tests__/followup-rules.test.ts`:

```typescript
describe('snooze filtering (caller-side)', () => {
  const rows = [{
    id: 'i1', contact_id: 'c1', type: 'email',
    last_direction: 'outbound' as const, last_message_at: '2026-05-10T00:00:00Z',
  }, {
    id: 'i2', contact_id: 'c2', type: 'email',
    last_direction: 'outbound' as const, last_message_at: '2026-05-10T00:00:00Z',
  }]

  it('filters out a contact whose snooze is in the future', () => {
    const snoozedIds = new Set(['c1'])
    const loops = detectOpenLoops(rows, DEFAULT_FOLLOWUP_SETTINGS, now)
      .filter(l => !snoozedIds.has(l.contactId))
    expect(loops.map(l => l.contactId)).not.toContain('c1')
    expect(loops.map(l => l.contactId)).toContain('c2')
  })

  it('includes a contact whose snooze expired in the past', () => {
    const snoozedIds = new Set<string>() // expired snooze: not in set
    const loops = detectOpenLoops(rows, DEFAULT_FOLLOWUP_SETTINGS, now)
      .filter(l => !snoozedIds.has(l.contactId))
    expect(loops.map(l => l.contactId)).toContain('c1')
  })

  it('includes a contact with null snooze', () => {
    const snoozedIds = new Set<string>()
    const loops = detectOpenLoops(rows, DEFAULT_FOLLOWUP_SETTINGS, now)
      .filter(l => !snoozedIds.has(l.contactId))
    expect(loops).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run all tests**

```bash
cd "/Volumes/Mac Mini 2TB SSD/Dan/Kinetic Brand Partners/KBP Projects/job-tracker"
npm test
```
Expected: all tests pass including the vendored drift check.

- [ ] **Step 3: Commit**

```bash
git add src/lib/google-sync/__tests__/followup-rules.test.ts
git commit -m "test: add snooze-filter cases to followup-rules tests"
```

---

## Task 9: Final integration check and deploy

- [ ] **Step 1: Run full test suite**

```bash
cd "/Volumes/Mac Mini 2TB SSD/Dan/Kinetic Brand Partners/KBP Projects/job-tracker"
npm test
```
Expected: all tests pass.

- [ ] **Step 2: Verify env vars are set in Netlify and Supabase**

Checklist:
- [ ] `SNOOZE_LINK_SECRET` set in Netlify environment variables
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set in Netlify environment variables
- [ ] `SNOOZE_LINK_SECRET` set in Supabase Edge Function secrets for `sync-google-interactions`
- [ ] `APP_URL` set in Supabase Edge Function secrets (should be `https://job-tracker.kineticbrandpartners.com`)

- [ ] **Step 3: Deploy Edge Function**

```bash
cd "/Volumes/Mac Mini 2TB SSD/Dan/Kinetic Brand Partners/KBP Projects/job-tracker"
npx supabase functions deploy sync-google-interactions
```
Expected: deployment succeeds.

- [ ] **Step 4: Push to GitHub (triggers Netlify deploy)**

```bash
git push origin main
```
Expected: Netlify build completes, site redeploys.

- [ ] **Step 5: Smoke test on production**

1. Open https://job-tracker.kineticbrandpartners.com
2. Open a contact in the Network tab
3. Verify Clock icon appears, dropdown works, badge shows, Clear works
4. Optionally: check Supabase Table Editor that `followup_snoozed_until` was written correctly

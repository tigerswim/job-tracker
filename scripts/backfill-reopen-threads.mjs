#!/usr/bin/env node
// One-time backfill for threads muted by the pre-0012 queue behaviour.
//
// Accepting a Gmail thread used to occupy its queue slot permanently, so every
// later reply was discarded. Migration 0012 fixes this going forward, but
// already-accepted threads still hold a stale occurred_at. The daily sync only
// looks back 2 days (watermark floor in index.ts), so it will never re-check
// them -- hence this script.
//
// Reuses the SAME decision rule as the sync (decideQueueWrite) so behaviour
// cannot drift: dismissed stays dismissed, live snoozes are respected, and a
// row re-opens only when the thread genuinely has a newer message.
//
// Read-only by default. Pass --apply to write.
//
//   node scripts/backfill-reopen-threads.mjs --days 30
//   node scripts/backfill-reopen-threads.mjs --days 30 --apply
//
// Requires GOOGLE_TOKEN_ENC_KEY + a stored refresh token (same as the sync).

import { readFileSync } from 'node:fs'
import { decideQueueWrite } from '../src/lib/google-sync/queue-reopen.ts'

const APPLY = process.argv.includes('--apply')
const daysArg = process.argv.indexOf('--days')
const DAYS = daysArg > -1 ? Number(process.argv[daysArg + 1]) : 90

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter(l => /^[A-Z_]+=/.test(l))
    .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
)

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_ROLE_KEY
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` }

if (!URL_ || !KEY) {
  console.error('missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

// --- Google access token, via the same encrypted refresh token the sync uses
async function accessToken() {
  const rows = await fetch(
    `${URL_}/rest/v1/google_oauth_tokens?select=*&limit=1`,
    { headers: H },
  ).then(r => r.json())
  if (!rows.length) throw new Error('no row in google_oauth_tokens')
  const row = rows[0]

  // Reuse the cached access token when it is still valid, so a read-only
  // backfill does not churn the shared credential.
  if (row.access_token && row.access_expires_at &&
      Date.parse(row.access_expires_at) > Date.now() + 60_000) {
    return row.access_token
  }

  const { decryptToken } = await import('../src/lib/google-sync/crypto.ts')
  const refresh = await decryptToken(
    row.refresh_token_encrypted, row.refresh_token_iv, env.GOOGLE_TOKEN_ENC_KEY)

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: refresh,
      grant_type: 'refresh_token',
    }),
  }).then(r => r.json())
  if (!res.access_token) throw new Error(`token refresh failed: ${JSON.stringify(res)}`)
  return res.access_token
}

const since = new Date(Date.now() - DAYS * 86_400_000).toISOString()

const rows = await fetch(
  `${URL_}/rest/v1/interaction_review_queue?select=id,external_id,counterparty_email,occurred_at,status,skipped_until` +
  `&source=eq.gmail&status=eq.accepted&occurred_at=gte.${since}&order=occurred_at.desc`,
  { headers: H },
).then(r => r.json())

console.log(`${rows.length} accepted gmail threads newer than ${DAYS}d`)
console.log(APPLY ? 'MODE: apply\n' : 'MODE: dry run (pass --apply to write)\n')

const token = await accessToken()
const now = new Date()
let reopen = 0, unchanged = 0, failed = 0

for (const r of rows) {
  let newest
  try {
    const thread = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${r.external_id}?format=metadata` +
      `&metadataHeaders=Date`,
      { headers: { Authorization: `Bearer ${token}` } },
    ).then(x => x.json())
    if (thread.error) throw new Error(thread.error.message)

    const dates = (thread.messages ?? []).map(m => {
      const h = (m.payload?.headers ?? []).find(x => x.name === 'Date')
      return { id: m.id, at: h ? Date.parse(h.value) : 0 }
    }).sort((a, b) => a.at - b.at)
    newest = dates[dates.length - 1]
  } catch (e) {
    console.log(`  ERR   ${r.counterparty_email} ${r.external_id}: ${e.message}`)
    failed++
    continue
  }

  const decision = decideQueueWrite(r, { lastMessageAt: new Date(newest.at).toISOString() }, now)
  const label = `${r.occurred_at.slice(0, 10)} -> ${new Date(newest.at).toISOString().slice(0, 10)}`

  if (decision.action !== 'reopen') {
    console.log(`  keep  ${r.counterparty_email}  (${label})`)
    unchanged++
    continue
  }

  console.log(`  OPEN  ${r.counterparty_email}  (${label})`)
  reopen++

  if (APPLY) {
    const res = await fetch(`${URL_}/rest/v1/interaction_review_queue?id=eq.${r.id}`, {
      method: 'PATCH',
      headers: { ...H, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'pending',
        occurred_at: new Date(newest.at).toISOString(),
        last_message_id: newest.id,
        skipped_until: null,
      }),
    })
    if (!res.ok) {
      console.log(`        write failed: HTTP ${res.status}`)
      failed++
    }
  }
}

console.log(`\n${reopen} to re-open, ${unchanged} unchanged, ${failed} failed`)
if (!APPLY && reopen) console.log('re-run with --apply to write')

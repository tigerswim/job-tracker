// supabase/functions/sync-google-interactions/index.ts
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { decryptToken } from './_shared/crypto.ts'
import { normalizeThread } from './_shared/gmail.ts'
import { normalizeEvent } from './_shared/calendar.ts'
import { buildMatchMap, resolveContact } from './_shared/matching.ts'
import { detectOpenLoops, shouldSelfCancel } from './_shared/followup-rules.ts'
import { DEFAULT_FOLLOWUP_SETTINGS } from './_shared/types.ts'

const SUPA_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ENC_KEY = Deno.env.get('GOOGLE_TOKEN_ENC_KEY')!
const CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!
const CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!
const RUN_USER = Deno.env.get('SYNC_USER_ID')!

const supa = createClient(SUPA_URL, SERVICE)

// refresh_token_encrypted / refresh_token_iv are text columns holding the
// base64 strings written by the setup script. decryptToken base64-decodes
// them itself, so they pass straight through — no byte juggling.

async function freshAccessToken(): Promise<string> {
  const { data: row } = await supa.from('google_oauth_tokens')
    .select('*').eq('user_id', RUN_USER).single()
  if (!row) throw new Error('no token row')
  if (row.access_token && row.access_expires_at &&
      Date.parse(row.access_expires_at) > Date.now() + 60_000) {
    return row.access_token
  }
  const refresh = await decryptToken(
    row.refresh_token_encrypted as string,
    row.refresh_token_iv as string,
    ENC_KEY)
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

async function startRun(source: string): Promise<string> {
  const { data } = await supa.from('sync_runs').insert({
    user_id: RUN_USER, source, status: 'running',
  }).select('id').single()
  return data!.id
}
async function finishRun(id: string, status: string,
  c: { seen: number; written: number; queued: number; skipped: number },
  wm: Date, fc = 0, fx = 0, err?: string) {
  await supa.from('sync_runs').update({
    status, finished_at: new Date().toISOString(),
    items_seen: c.seen, items_written: c.written, items_queued: c.queued,
    items_skipped: c.skipped, followups_created: fc, followups_cancelled: fx,
    sync_watermark: wm.toISOString(), error_message: err ?? null,
  }).eq('id', id)
}

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

async function upsertReviewQueue(n: any, contactId: string | null) {
  await supa.from('interaction_review_queue').upsert({
    user_id: RUN_USER, source: n.source, external_id: n.externalId,
    suggested_contact_id: contactId, counterparty_email: n.counterpartyEmail,
    type: n.type, occurred_at: n.occurredAt, summary: n.summary,
    notes: n.notes, status: 'pending',
  }, { onConflict: 'user_id,source,external_id' })
}

async function upsertInteraction(n: any, contactId: string) {
  await supa.from('interactions').upsert({
    user_id: RUN_USER, contact_id: contactId, source: n.source,
    external_id: n.externalId, type: n.type, date: n.occurredAt,
    summary: n.summary, notes: n.notes, last_direction: n.lastDirection,
    message_count: n.messageCount, last_message_at: n.lastMessageAt,
  }, { onConflict: 'user_id,contact_id,source,external_id' })
}

function adaptGmailThread(full: any) {
  return {
    id: full.id,
    messages: (full.messages ?? []).map((m: any) => {
      const h: Record<string, string> = {}
      for (const x of m.payload?.headers ?? []) h[x.name] = x.value
      return { headers: {
        From: h.From ?? '', To: h.To, Cc: h.Cc,
        Subject: h.Subject, Date: h.Date ?? new Date().toISOString(),
      }, snippet: m.snippet ?? '' }
    }),
  }
}

async function syncGmail(token: string, ctx: Awaited<ReturnType<typeof loadContext>>) {
  const since = await watermark('gmail')
  const run = await startRun('gmail')
  let pageToken: string | undefined
  let seen = 0, written = 0, queued = 0, skipped = 0
  const after = Math.floor(since.getTime() / 1000)
  try {
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
          await upsertReviewQueue(n, contactId); queued++
        }
      }
      pageToken = list.nextPageToken
    } while (pageToken)
  } catch (e) {
    await finishRun(run, 'failed', { seen, written, queued, skipped }, since, 0, 0, String(e))
    throw e
  }
  await finishRun(run, 'success', { seen, written, queued, skipped }, new Date())
}

async function syncCalendar(token: string, ctx: Awaited<ReturnType<typeof loadContext>>) {
  const since = await watermark('gcal')
  const run = await startRun('gcal')
  let pageToken: string | undefined
  let seen = 0, written = 0, queued = 0, skipped = 0
  try {
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
          if (contactId) { await upsertInteraction(n, contactId); written++ }
          else { await upsertReviewQueue(n, null); queued++ }
        }
      }
      pageToken = list.nextPageToken
    } while (pageToken)
  } catch (e) {
    await finishRun(run, 'failed', { seen, written, queued, skipped }, since, 0, 0, String(e))
    throw e
  }
  await finishRun(run, 'success', { seen, written, queued, skipped }, new Date())
}

async function runFollowups() {
  const { data: settingsRow } = await supa.from('followup_settings')
    .select('*').eq('user_id', RUN_USER).single()
  const settings = settingsRow ?? DEFAULT_FOLLOWUP_SETTINGS

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

  const startOfDay = new Date(); startOfDay.setUTCHours(0, 0, 0, 0)
  const { count: todayCount } = await supa.from('email_reminders')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', RUN_USER).eq('source', 'auto_followup')
    .gte('created_at', startOfDay.toISOString())
  let budget = settings.max_auto_followups_per_day - (todayCount ?? 0)
  let created = 0
  for (const loop of loops) {
    if (budget <= 0) break
    const { data: existing } = await supa.from('email_reminders')
      .select('id').eq('user_id', RUN_USER).eq('source', 'auto_followup')
      .eq('contact_id', loop.contactId).eq('status', 'pending').limit(1)
    if (existing && existing.length) continue
    const { data: contact } = await supa.from('contacts')
      .select('name,email').eq('id', loop.contactId).single()
    const name = contact?.name ?? 'your contact'
    const tierMsg: Record<string, string> = {
      email_no_reply: `Follow up with ${name} — no reply to your note`,
      meeting_no_followup: `Send ${name} the follow-up from your conversation`,
      gone_quiet: `Reconnect with ${name} — gone quiet`,
    }
    const subject = tierMsg[loop.tier] ?? `Follow up with ${name}`
    const scheduled = new Date(Date.now() + 5 * 60_000).toISOString()
    await supa.from('email_reminders').insert({
      user_id: RUN_USER, contact_id: loop.contactId, source: 'auto_followup',
      trigger_interaction_id: loop.interactionId, status: 'pending',
      scheduled_time: scheduled, user_timezone: 'America/New_York',
      email_subject: subject,
      email_body: subject,
      user_message: subject,
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

Deno.serve(async () => {
  try {
    const result = await runSync()
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 })
  }
})

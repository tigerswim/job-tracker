import { normalizeEmail, isOwn, classifyDirection, parseEmailAddress } from './identity'
import type { NormalizedInteraction } from './types'

const NOISE = /(^|[._-])(no-?reply|noreply|notifications?|donotreply|digest|alerts?|weekly|monthly|newsletter)@|@(lever\.co|greenhouse\.io|workday\.com|myworkday\.com|jobvite\.com|smartrecruiters\.com|taleo\.net|icims\.com|substack\.com|mailchimp\.com|sendgrid\.net|campaign-archive\.com|constantcontact\.com|klaviyo\.com|beehiiv\.com)/i

const NOISE_SUBJECT = /(weekly|daily|monthly)\s+(digest|roundup|update|newsletter)|job\s+alert|jobs\s+you\s+may\s+like|people\s+also\s+viewed|unsubscribe|view\s+in\s+browser|you'?re\s+receiving\s+this/i

const BODY_TRUNCATE = 800

export function isNoiseSender(from: string): boolean {
  return NOISE.test(normalizeEmail(from))
}

export function isNoiseSubject(subject: string): boolean {
  return NOISE_SUBJECT.test(subject)
}

interface RawPart { mimeType: string; body?: { data?: string }; parts?: RawPart[] }
interface RawMsg {
  headers: { From: string; To?: string; Cc?: string; Subject?: string; Date: string }
  payload?: RawPart
}
interface RawThread { id: string; messages: RawMsg[] }

function extractPlainText(part: RawPart): string {
  if (part.mimeType === 'text/plain' && part.body?.data) {
    const decoded = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'))
    return decoded.slice(0, BODY_TRUNCATE)
  }
  for (const child of part.parts ?? []) {
    const text = extractPlainText(child)
    if (text) return text
  }
  return ''
}

function parseAddrs(v?: string): string[] {
  if (!v) return []
  return v.split(',').map(s => parseEmailAddress(s)).filter(Boolean)
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
  const subject = sorted[0].headers.Subject ?? '(no subject)'
  if (isNoiseSubject(subject)) {
    return []
  }
  // collect counterparties across all messages
  const counterparties = new Set<string>()
  for (const m of sorted) {
    const everyone = [
      parseEmailAddress(m.headers.From),
      ...parseAddrs(m.headers.To), ...parseAddrs(m.headers.Cc),
    ]
    for (const e of everyone) if (e && !isOwn(e, identity)) counterparties.add(e)
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

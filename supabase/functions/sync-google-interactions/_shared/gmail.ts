import { normalizeEmail, isOwn, classifyDirection } from './identity.ts'
import type { NormalizedInteraction } from './types.ts'

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

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

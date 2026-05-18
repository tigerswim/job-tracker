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

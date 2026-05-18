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

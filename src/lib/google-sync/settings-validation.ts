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

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

import { describe, it, expect } from 'vitest'
import { detectOpenLoops, shouldSelfCancel } from '../followup-rules'
import { DEFAULT_FOLLOWUP_SETTINGS } from '../types'

const now = new Date('2026-05-20T00:00:00Z')

describe('followup rules', () => {
  it('flags outbound email with no reply past threshold', () => {
    const loops = detectOpenLoops([{
      id: 'i1', contact_id: 'c1', type: 'email',
      last_direction: 'outbound', last_message_at: '2026-05-10T00:00:00Z',
    }], DEFAULT_FOLLOWUP_SETTINGS, now)
    expect(loops.map(l => l.interactionId)).toContain('i1')
    expect(loops[0].tier).toBe('email_no_reply')
  })
  it('does not flag if inbound (loop closed)', () => {
    const loops = detectOpenLoops([{
      id: 'i1', contact_id: 'c1', type: 'email',
      last_direction: 'inbound', last_message_at: '2026-05-10T00:00:00Z',
    }], DEFAULT_FOLLOWUP_SETTINGS, now)
    expect(loops).toHaveLength(0)
  })
  it('does not flag before threshold', () => {
    const loops = detectOpenLoops([{
      id: 'i1', contact_id: 'c1', type: 'email',
      last_direction: 'outbound', last_message_at: '2026-05-19T00:00:00Z',
    }], DEFAULT_FOLLOWUP_SETTINGS, now)
    expect(loops).toHaveLength(0)
  })
  it('self-cancels when a later inbound exists', () => {
    expect(shouldSelfCancel(
      { trigger_interaction_id: 'i1' },
      [{ id: 'i1', last_direction: 'inbound' }]
    )).toBe(true)
  })
})

import { describe, it, expect } from 'vitest'
import { normalizeEvent } from '../calendar'

const identity = new Set(['me@gmail.com'])

describe('calendar', () => {
  const base = {
    id: 'ev1', summary: 'Coffee',
    start: { dateTime: '2026-05-02T15:00:00Z' },
    attendees: [
      { email: 'me@gmail.com', responseStatus: 'accepted', self: true },
      { email: 'them@x.com', responseStatus: 'accepted' },
    ],
  }
  it('produces meeting interaction for external attendee', () => {
    const out = normalizeEvent(base, identity)
    expect(out).toHaveLength(1)
    expect(out[0].counterpartyEmail).toBe('them@x.com')
    expect(out[0].type).toBe('meeting')
  })
  it('classifies video_call when conferencing link present', () => {
    const out = normalizeEvent(
      { ...base, location: 'https://zoom.us/j/123' }, identity)
    expect(out[0].type).toBe('video_call')
  })
  it('skips events the user declined', () => {
    const out = normalizeEvent(
      { ...base, attendees: [
        { email: 'me@gmail.com', responseStatus: 'declined', self: true },
        { email: 'them@x.com', responseStatus: 'accepted' }] }, identity)
    expect(out).toHaveLength(0)
  })
  it('skips all-day events', () => {
    const out = normalizeEvent(
      { ...base, start: { date: '2026-05-02' } }, identity)
    expect(out).toHaveLength(0)
  })
  it('uses recurringEventId as externalId when recurring', () => {
    const out = normalizeEvent(
      { ...base, id: 'occ_99', recurringEventId: 'series1' }, identity)
    expect(out[0].externalId).toBe('series1')
  })
})

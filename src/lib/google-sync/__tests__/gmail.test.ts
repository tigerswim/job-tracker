import { describe, it, expect } from 'vitest'
import { normalizeThread, isNoiseSender } from '../gmail'

const identity = new Set(['me@gmail.com'])

const thread = {
  id: 'thr1',
  messages: [
    { headers: { From: 'me@gmail.com', To: 'them@x.com', Subject: 'Hi', Date: '2026-05-01T10:00:00Z' }, snippet: 's1' },
    { headers: { From: 'them@x.com', To: 'me@gmail.com', Subject: 'Re: Hi', Date: '2026-05-03T10:00:00Z' }, snippet: 's2' },
  ],
}

describe('gmail', () => {
  it('collapses thread to one normalized interaction per counterparty', () => {
    const out = normalizeThread(thread, identity)
    expect(out).toHaveLength(1)
    expect(out[0].counterpartyEmail).toBe('them@x.com')
    expect(out[0].messageCount).toBe(2)
    expect(out[0].lastDirection).toBe('inbound')
    expect(out[0].lastMessageAt).toBe('2026-05-03T10:00:00.000Z')
    expect(out[0].externalId).toBe('thr1')
    expect(out[0].type).toBe('email')
  })
  it('flags no-reply senders', () => {
    expect(isNoiseSender('no-reply@x.com')).toBe(true)
    expect(isNoiseSender('notifications@x.com')).toBe(true)
    expect(isNoiseSender('jane@x.com')).toBe(false)
  })
})

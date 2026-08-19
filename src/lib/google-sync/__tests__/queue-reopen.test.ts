import { describe, it, expect } from 'vitest'
import { decideQueueWrite } from '../queue-reopen'

const NOW = new Date('2026-08-19T09:00:00Z')
const incoming = { lastMessageAt: '2026-08-18T20:41:44Z' }
const older = { lastMessageAt: '2026-07-01T10:00:00Z' }
const row = (over: Record<string, unknown> = {}) => ({
  status: 'pending', occurred_at: '2026-07-08T21:47:17Z',
  skipped_until: null, ...over,
})

describe('decideQueueWrite', () => {
  it('inserts when no row exists', () => {
    expect(decideQueueWrite(null, incoming, NOW).action).toBe('insert')
  })

  it('reopens an accepted thread when a newer message arrives', () => {
    const d = decideQueueWrite(row({ status: 'accepted' }), incoming, NOW)
    expect(d.action).toBe('reopen')
    expect(d.status).toBe('pending')
  })

  it('leaves an accepted thread alone when nothing is newer', () => {
    expect(decideQueueWrite(row({ status: 'accepted' }), older, NOW).action).toBe('skip')
  })

  it('keeps dismissed threads dismissed even with a newer message', () => {
    expect(decideQueueWrite(row({ status: 'dismissed' }), incoming, NOW).action).toBe('skip')
  })

  it('keeps a live snooze intact when a newer message arrives', () => {
    const r = row({ status: 'skipped', skipped_until: '2026-08-25T00:00:00Z' })
    expect(decideQueueWrite(r, incoming, NOW).action).toBe('skip')
  })

  it('reopens a skipped thread once the snooze has expired', () => {
    const r = row({ status: 'skipped', skipped_until: '2026-08-01T00:00:00Z' })
    expect(decideQueueWrite(r, incoming, NOW).action).toBe('reopen')
  })

  it('refreshes a pending row in place so the card shows the newest message', () => {
    const d = decideQueueWrite(row({ status: 'pending' }), incoming, NOW)
    expect(d.action).toBe('reopen')
    expect(d.status).toBe('pending')
  })

  it('treats an equal timestamp as not newer', () => {
    const r = row({ status: 'accepted', occurred_at: '2026-08-18T20:41:44Z' })
    expect(decideQueueWrite(r, incoming, NOW).action).toBe('skip')
  })
})

// Regression: a real accepted thread (19f4223464a32cc0). Accepted 2026-07-09
// with occurred_at 2026-07-08; the contact's 2026-08-18 reply was silently
// dropped on every subsequent run.
describe('regression: accepted thread with later replies', () => {
  const accepted = {
    status: 'accepted',
    occurred_at: '2026-07-08T21:47:17Z',
    skipped_until: null,
  }

  it('surfaces the 2026-08-18 reply instead of dropping it', () => {
    const d = decideQueueWrite(
      accepted, { lastMessageAt: '2026-08-18T20:41:44Z' },
      new Date('2026-08-19T09:00:00Z'),
    )
    expect(d.action).toBe('reopen')
  })

  it('surfaces each intervening reply as it arrives', () => {
    for (const at of ['2026-08-10T15:43:52Z', '2026-08-13T02:25:53Z']) {
      expect(decideQueueWrite(accepted, { lastMessageAt: at }, new Date('2026-08-19T09:00:00Z')).action)
        .toBe('reopen')
    }
  })
})

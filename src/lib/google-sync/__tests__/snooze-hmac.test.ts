import { describe, it, expect } from 'vitest'
import { generateSnoozeToken, validateSnoozeToken, snoozeUntil } from '../../snooze-hmac'

const SECRET = 'a'.repeat(64) // 32-byte hex

describe('snooze HMAC', () => {
  it('validates a freshly generated token', async () => {
    const token = await generateSnoozeToken('contact-1', '1w', 'user-1', SECRET)
    expect(await validateSnoozeToken('contact-1', '1w', 'user-1', token, SECRET)).toBe(true)
  })

  it('rejects a tampered token', async () => {
    const token = await generateSnoozeToken('contact-1', '1w', 'user-1', SECRET)
    const tampered = token.slice(0, -4) + 'XXXX'
    expect(await validateSnoozeToken('contact-1', '1w', 'user-1', tampered, SECRET)).toBe(false)
  })

  it('rejects wrong duration', async () => {
    const token = await generateSnoozeToken('contact-1', '1w', 'user-1', SECRET)
    expect(await validateSnoozeToken('contact-1', '1m', 'user-1', token, SECRET)).toBe(false)
  })

  it('rejects wrong contactId', async () => {
    const token = await generateSnoozeToken('contact-1', '1w', 'user-1', SECRET)
    expect(await validateSnoozeToken('contact-2', '1w', 'user-1', token, SECRET)).toBe(false)
  })

  it('snoozeUntil 1w adds 7 days', () => {
    const base = new Date('2026-06-04T00:00:00Z')
    expect(snoozeUntil('1w', base).toISOString()).toBe('2026-06-11T00:00:00.000Z')
  })

  it('snoozeUntil 1m adds ~1 month', () => {
    const base = new Date('2026-06-04T00:00:00Z')
    expect(snoozeUntil('1m', base).toISOString()).toBe('2026-07-04T00:00:00.000Z')
  })

  it('snoozeUntil 3m adds ~3 months', () => {
    const base = new Date('2026-06-04T00:00:00Z')
    expect(snoozeUntil('3m', base).toISOString()).toBe('2026-09-04T00:00:00.000Z')
  })

  it('snoozeUntil indefinite returns year 2099', () => {
    const d = snoozeUntil('indefinite')
    expect(d.getFullYear()).toBe(2099)
  })
})

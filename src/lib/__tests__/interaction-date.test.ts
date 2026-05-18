import { describe, it, expect } from 'vitest'
import { parseInteractionDate } from '../interaction-date'

describe('parseInteractionDate', () => {
  it('parses a date-only string (legacy `date` column format)', () => {
    const d = parseInteractionDate('2026-05-17')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(4) // May (0-indexed)
    expect(d.getDate()).toBe(17)
    expect(isNaN(d.getTime())).toBe(false)
  })

  // Regression: timestamptz widening (migration 0001) made the API return
  // full ISO timestamps; the old split('-') produced NaN → "Invalid Date".
  it('parses a full ISO timestamp (timestamptz column format)', () => {
    const d = parseInteractionDate('2026-05-17T00:00:00+00:00')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(4)
    expect(d.getDate()).toBe(17)
    expect(isNaN(d.getTime())).toBe(false)
  })

  it('never yields an Invalid Date for either format', () => {
    expect(isNaN(parseInteractionDate('2026-01-01').getTime())).toBe(false)
    expect(isNaN(parseInteractionDate('2026-12-31T23:59:59.999+00:00').getTime())).toBe(false)
  })
})

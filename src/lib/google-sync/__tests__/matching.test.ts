import { describe, it, expect } from 'vitest'
import { buildMatchMap, resolveContact } from '../matching'

describe('matching', () => {
  const map = buildMatchMap(
    [{ id: 'c1', email: 'a@x.com' }],
    [{ contact_id: 'c2', email: 'alias@x.com' }]
  )
  it('matches primary email', () => {
    expect(resolveContact('A@X.com', map)).toBe('c1')
  })
  it('matches alias', () => {
    expect(resolveContact('alias@x.com', map)).toBe('c2')
  })
  it('returns null when unmatched', () => {
    expect(resolveContact('none@x.com', map)).toBeNull()
  })
})

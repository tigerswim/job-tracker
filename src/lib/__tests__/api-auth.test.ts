import { describe, it, expect } from 'vitest'
import { secretsMatch } from '../api-auth'

describe('secretsMatch', () => {
  it('accepts an exact match', () => {
    expect(secretsMatch('s3cret-value', 's3cret-value')).toBe(true)
  })

  it('rejects a wrong value of the same length', () => {
    expect(secretsMatch('s3cret-value', 's3cret-valuX')).toBe(false)
  })

  it('rejects a differing length without throwing', () => {
    // timingSafeEqual throws on length mismatch; the guard must catch it.
    expect(() => secretsMatch('short', 'much-longer-secret')).not.toThrow()
    expect(secretsMatch('short', 'much-longer-secret')).toBe(false)
  })

  it('rejects a missing header', () => {
    expect(secretsMatch(null, 'expected')).toBe(false)
  })

  it('rejects an unconfigured expected secret', () => {
    // A missing env var must never authenticate the request.
    expect(secretsMatch('anything', undefined)).toBe(false)
    expect(secretsMatch('', undefined)).toBe(false)
  })

  it('rejects an empty provided value', () => {
    expect(secretsMatch('', 'expected')).toBe(false)
  })
})

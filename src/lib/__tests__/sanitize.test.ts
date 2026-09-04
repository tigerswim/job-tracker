import { describe, it, expect } from 'vitest'
import { sanitizeFilterValue } from '../sanitize'

describe('sanitizeFilterValue', () => {
  it('leaves ordinary search terms untouched', () => {
    expect(sanitizeFilterValue('Acme Corp')).toBe('Acme Corp')
    expect(sanitizeFilterValue("O'Brien")).toBe("O'Brien")
    expect(sanitizeFilterValue('senior-engineer_2')).toBe('senior-engineer_2')
  })

  it('strips the PostgREST filter metacharacters', () => {
    // A comma ends one filter clause and starts another, which is how an
    // injected condition would get in.
    expect(sanitizeFilterValue('a,b')).toBe('ab')
    expect(sanitizeFilterValue('a(b)c')).toBe('abc')
    expect(sanitizeFilterValue('a"b')).toBe('ab')
    expect(sanitizeFilterValue('a\\b')).toBe('ab')
    expect(sanitizeFilterValue('a*b')).toBe('ab')
    expect(sanitizeFilterValue('a%b')).toBe('ab')
  })

  it('neutralizes an injected or() clause', () => {
    const attack = 'x,user_id.neq.00000000-0000-0000-0000-000000000000'
    const safe = sanitizeFilterValue(attack)
    expect(safe).not.toContain(',')
    expect(safe).toBe('xuser_id.neq.00000000-0000-0000-0000-000000000000')
  })

  it('handles the empty string', () => {
    expect(sanitizeFilterValue('')).toBe('')
  })
})

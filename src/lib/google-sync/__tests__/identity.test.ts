import { describe, it, expect } from 'vitest'
import { normalizeEmail, isOwn, classifyDirection, parseEmailAddress } from '../identity'

const identity = new Set(['me@gmail.com', 'me@kinetic.com'])

describe('identity', () => {
  it('normalizes', () => {
    expect(normalizeEmail('  Me@Gmail.COM ')).toBe('me@gmail.com')
  })
  it('detects own', () => {
    expect(isOwn('me@kinetic.com', identity)).toBe(true)
    expect(isOwn('them@x.com', identity)).toBe(false)
  })
  it('classifies outbound when from is own', () => {
    expect(classifyDirection('me@gmail.com', identity)).toBe('outbound')
  })
  it('classifies inbound when from is not own', () => {
    expect(classifyDirection('them@x.com', identity)).toBe('inbound')
  })
})

describe('parseEmailAddress', () => {
  it('extracts bare email from a display-name header', () => {
    expect(parseEmailAddress('Acme <hello@example.com>')).toBe('hello@example.com')
  })
  it('extracts from a quoted comma display name', () => {
    expect(parseEmailAddress('"Doe, Jane" <jane.doe@example.com>'))
      .toBe('jane.doe@example.com')
  })
  it('passes through a bare email lowercased and trimmed', () => {
    expect(parseEmailAddress('  Ashley@Example.COM ')).toBe('ashley@example.com')
  })
  it('strips a trailing angle bracket', () => {
    expect(parseEmailAddress('hello@example.com>')).toBe('hello@example.com')
  })
  it('returns empty string when there is no @', () => {
    expect(parseEmailAddress('Some Name')).toBe('')
  })
  it('returns empty string for empty input', () => {
    expect(parseEmailAddress('')).toBe('')
  })
})

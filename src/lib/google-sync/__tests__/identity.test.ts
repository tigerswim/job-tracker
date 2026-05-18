import { describe, it, expect } from 'vitest'
import { normalizeEmail, isOwn, classifyDirection } from '../identity'

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

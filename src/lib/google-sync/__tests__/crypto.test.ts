import { describe, it, expect } from 'vitest'
import { encryptToken, decryptToken } from '../crypto'

const KEY = 'a'.repeat(64) // 32 bytes hex

describe('token crypto', () => {
  it('round-trips', async () => {
    const { ivB64, ctB64 } = await encryptToken('refresh-secret', KEY)
    const out = await decryptToken(ctB64, ivB64, KEY)
    expect(out).toBe('refresh-secret')
  })

  it('fails closed on wrong key', async () => {
    const { ivB64, ctB64 } = await encryptToken('x', KEY)
    await expect(decryptToken(ctB64, ivB64, 'b'.repeat(64))).rejects.toThrow()
  })

  it('fails on tampered ciphertext', async () => {
    const { ivB64, ctB64 } = await encryptToken('x', KEY)
    const bad = Buffer.from(ctB64, 'base64')
    bad[0] ^= 0xff
    await expect(
      decryptToken(bad.toString('base64'), ivB64, KEY)
    ).rejects.toThrow()
  })
})

export type SnoozeDuration = '1w' | '1m' | '3m' | 'indefinite'

export function snoozeUntil(duration: SnoozeDuration, from: Date = new Date()): Date {
  const d = new Date(from)
  if (duration === '1w') { d.setDate(d.getDate() + 7) }
  else if (duration === '1m') { d.setMonth(d.getMonth() + 1) }
  else if (duration === '3m') { d.setMonth(d.getMonth() + 3) }
  else { d.setFullYear(2099) }
  return d
}

const enc = new TextEncoder()

async function importHmacKey(secretHex: string): Promise<CryptoKey> {
  const bytes = new Uint8Array(secretHex.match(/.{2}/g)!.map(b => parseInt(b, 16)))
  return crypto.subtle.importKey('raw', bytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

export async function generateSnoozeToken(
  contactId: string, duration: string, userId: string, secretHex: string
): Promise<string> {
  const key = await importHmacKey(secretHex)
  const msg = enc.encode(`${contactId}:${duration}:${userId}`)
  const sig = await crypto.subtle.sign('HMAC', key, msg)
  return Buffer.from(sig).toString('hex')
}

export async function validateSnoozeToken(
  contactId: string, duration: string, userId: string, token: string, secretHex: string
): Promise<boolean> {
  try {
    const expected = await generateSnoozeToken(contactId, duration, userId, secretHex)
    // Constant-time comparison
    if (expected.length !== token.length) return false
    let diff = 0
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i)
    return diff === 0
  } catch {
    return false
  }
}

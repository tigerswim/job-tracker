function hexToBytes(hex: string): Uint8Array {
  if (hex.length !== 64) throw new Error('GOOGLE_TOKEN_ENC_KEY must be 32-byte hex')
  const out = new Uint8Array(32)
  for (let i = 0; i < 32; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16)
  return out
}

async function importKey(keyHex: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw', hexToBytes(keyHex), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']
  )
}

const enc = new TextEncoder()
const dec = new TextDecoder()
// Web-standard base64 (btoa/atob) — works in Node 18+, Deno, and browsers.
// Deno (Supabase Edge runtime) has no Node `Buffer`, so it must not be used.
const b64 = (b: ArrayBuffer | Uint8Array) => {
  const bytes = b instanceof Uint8Array ? b : new Uint8Array(b)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}
const unb64 = (s: string) => {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export async function encryptToken(
  plaintext: string, keyHex: string
): Promise<{ ivB64: string; ctB64: string }> {
  const key = await importKey(keyHex)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, key, enc.encode(plaintext)
  )
  // ct already includes the 16-byte auth tag appended (Web Crypto convention)
  return { ivB64: b64(iv), ctB64: b64(ct) }
}

export async function decryptToken(
  ctB64: string, ivB64: string, keyHex: string
): Promise<string> {
  const key = await importKey(keyHex)
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: unb64(ivB64) }, key, unb64(ctB64)
  )
  return dec.decode(pt)
}

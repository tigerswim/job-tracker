/**
 * One-time: obtains a Google refresh token (gmail.readonly + calendar.readonly),
 * encrypts it, upserts google_oauth_tokens, and seeds sync_identity.
 *
 * Env required:
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET   (Cloud project OAuth client)
 *   GOOGLE_TOKEN_ENC_KEY                      (32-byte hex)
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   SYNC_USER_ID                              (Dan's auth.users id)
 */
import * as http from 'node:http'
import { createClient } from '@supabase/supabase-js'
import { encryptToken } from '../src/lib/google-sync/crypto'

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/gmail.settings.basic', // read send-as aliases
].join(' ')
const REDIRECT = 'http://localhost:53682/callback'

function need(k: string): string {
  const v = process.env[k]
  if (!v) throw new Error(`Missing env ${k}`)
  return v
}

async function main() {
  const clientId = need('GOOGLE_CLIENT_ID')
  const clientSecret = need('GOOGLE_CLIENT_SECRET')
  const encKey = need('GOOGLE_TOKEN_ENC_KEY')
  const userId = need('SYNC_USER_ID')
  const supa = createClient(
    need('NEXT_PUBLIC_SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'))

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    new URLSearchParams({
      client_id: clientId, redirect_uri: REDIRECT, response_type: 'code',
      scope: SCOPES, access_type: 'offline', prompt: 'consent',
    })
  console.log('\nOpen this URL, approve, then return here:\n\n' + authUrl + '\n')

  const code: string = await new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const u = new URL(req.url!, REDIRECT)
      const c = u.searchParams.get('code')
      res.end('Done. You can close this tab.')
      srv.close()
      resolve(c!)
    })
    srv.listen(53682)
  })

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, client_id: clientId, client_secret: clientSecret,
      redirect_uri: REDIRECT, grant_type: 'authorization_code',
    }),
  })
  const tok = await tokenRes.json()
  if (!tok.refresh_token) throw new Error('No refresh_token returned: ' + JSON.stringify(tok))

  const { ivB64, ctB64 } = await encryptToken(tok.refresh_token, encKey)
  const { error: tErr } = await supa.from('google_oauth_tokens').upsert({
    user_id: userId,
    refresh_token_encrypted: Buffer.from(ctB64, 'base64'),
    refresh_token_iv: Buffer.from(ivB64, 'base64'),
    scopes: SCOPES, error_state: null, updated_at: new Date().toISOString(),
  })
  if (tErr) throw tErr

  // Seed sync_identity from gmail send-as aliases
  const sendAsRes = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs',
    { headers: { Authorization: `Bearer ${tok.access_token}` } })
  const sendAs = await sendAsRes.json()
  const emails: string[] = (sendAs.sendAs ?? [])
    .map((s: any) => String(s.sendAsEmail).trim().toLowerCase())
  console.log('Detected send-as addresses:', emails)
  for (const email of emails) {
    await supa.from('sync_identity').upsert({ user_id: userId, email })
  }
  console.log('\n✅ Setup complete. Verify sync_identity contains all your addresses;')
  console.log('   add any missing ones via the Settings panel later.\n')
}

main().catch((e) => { console.error(e); process.exit(1) })

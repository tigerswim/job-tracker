// Shared request authentication for machine-to-machine API routes.
import { NextRequest } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'crypto'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * Constant-time string comparison. A plain `===` on a secret leaks length and
 * position through timing; this does not.
 */
export function secretsMatch(provided: string | null, expected: string | undefined): boolean {
  if (!provided || !expected) return false
  const a = Buffer.from(provided, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  // timingSafeEqual throws on length mismatch, so compare lengths separately.
  // Length is far less sensitive than content.
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export type BearerAuthResult =
  | { ok: true; userId: string; supabase: SupabaseClient }
  | { ok: false; status: number; error: string }

/**
 * Authenticate a request by its Supabase user access token.
 *
 * Returns a client bound to that user's token, so every query runs under RLS
 * as that user. Prefer this over the service-role key: identity comes from a
 * verifiable, expiring token rather than a shared static secret.
 */
export async function authenticateBearer(request: NextRequest): Promise<BearerAuthResult> {
  const authHeader = request.headers.get('authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'Missing or invalid authorization header' }
  }

  const token = authHeader.substring(7)

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    return { ok: false, status: 401, error: 'Invalid authentication token' }
  }

  return { ok: true, userId: user.id, supabase }
}


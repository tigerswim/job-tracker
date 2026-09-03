// Server-side Supabase clients (@supabase/ssr).
// Replaces the deprecated @supabase/auth-helpers-nextjs helpers.
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * Client for Route Handlers and Server Actions. Reads and writes auth cookies,
 * so session refresh works. `cookies()` is async in Next 15 — always await this.
 */
export async function createRouteClient() {
  const cookieStore = await cookies()

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Middleware refreshes the session, so this is safe to ignore.
        }
      },
    },
  })
}

/**
 * Read-only client for Server Components. Cookie writes are dropped because
 * Server Components cannot set headers; middleware handles session refresh.
 */
export async function createServerComponentClient() {
  const cookieStore = await cookies()

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll() {
        // No-op: Server Components cannot write cookies.
      },
    },
  })
}

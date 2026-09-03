import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Write refreshed cookies onto both the request (so downstream
          // handlers in this pass see them) and the response (so the browser
          // stores them).
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value))
          res = NextResponse.next({ request: req })
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() revalidates the token with Supabase; getSession() only decodes
  // the cookie and is not safe to authorize on. Also refreshes expired
  // sessions for Server Components.
  const { data: { user } } = await supabase.auth.getUser()

  if (req.nextUrl.pathname.startsWith('/api/reminders') && !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return res
}

export const config = {
  matcher: [
    /*
     * Match only routes that need authentication:
     * - / (main page)
     * - /api/reminders/* (authenticated API routes)
     * Excludes _next, most API routes, and static files to reduce CPU overhead
     */
    '/',
    '/api/reminders/:path*',
  ],
}

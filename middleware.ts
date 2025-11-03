// middleware.ts (place in root directory)
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  
  // Create a Supabase client configured to use cookies
  const supabase = createMiddlewareClient({ req, res })
  
  // Refresh session if expired - required for Server Components
  const { data: { session } } = await supabase.auth.getSession()
  
  // If the request is for an API route that requires auth, ensure user is authenticated
  if (req.nextUrl.pathname.startsWith('/api/reminders')) {
    if (!session?.user) {
      console.log('Middleware: No session found for API request')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.log('Middleware: Session found for user:', session.user.id)
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
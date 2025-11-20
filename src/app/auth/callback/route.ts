import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const supabase = createRouteHandlerClient({ cookies })

    try {
      // Exchange code for session
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)

      if (error) {
        console.error('Error exchanging code for session:', error)
        // Redirect to landing page with error
        return NextResponse.redirect(`${requestUrl.origin}?error=auth_failed`)
      }

      // Verify session was established
      if (data?.session) {
        console.log('Session established for user:', data.session.user.id)
      }
    } catch (error) {
      console.error('Exception during auth callback:', error)
      return NextResponse.redirect(`${requestUrl.origin}?error=auth_failed`)
    }
  }

  // Redirect to the main app after successful authentication
  return NextResponse.redirect(requestUrl.origin)
}
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET() {
  const cookieStore = await cookies()
  const supa = createRouteHandlerClient({ cookies: () => cookieStore })
  const { data: { user } } = await supa.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data } = await supa.from('interaction_review_queue')
    .select('*').eq('user_id', user.id).eq('status', 'pending')
    .order('occurred_at', { ascending: false })
  return NextResponse.json({ items: data ?? [] })
}

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET() {
  const cookieStore = await cookies()
  const supa = createRouteHandlerClient({ cookies: () => cookieStore })
  const { data: { user } } = await supa.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data } = await supa.from('sync_runs')
    .select('*').eq('user_id', user.id)
    .order('started_at', { ascending: false }).limit(2)
  const { count } = await supa.from('interaction_review_queue')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id).eq('status', 'pending')
  return NextResponse.json({ runs: data ?? [], pendingCount: count ?? 0 })
}

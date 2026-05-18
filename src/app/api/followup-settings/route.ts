import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { validateFollowupSettings } from '@/lib/google-sync/settings-validation'
import { DEFAULT_FOLLOWUP_SETTINGS } from '@/lib/google-sync/types'

export async function GET() {
  const cookieStore = await cookies()
  const supa = createRouteHandlerClient({ cookies: () => cookieStore })
  const { data: { user } } = await supa.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data } = await supa.from('followup_settings')
    .select('*').eq('user_id', user.id).single()
  return NextResponse.json(data ?? { ...DEFAULT_FOLLOWUP_SETTINGS, user_id: user.id })
}

export async function PUT(req: Request) {
  const cookieStore = await cookies()
  const supa = createRouteHandlerClient({ cookies: () => cookieStore })
  const { data: { user } } = await supa.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json()
  const v = validateFollowupSettings(body)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })
  const { error } = await supa.from('followup_settings').upsert({
    user_id: user.id, ...body, updated_at: new Date().toISOString() })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET() {
  const cookieStore = await cookies()
  const supa = createRouteHandlerClient({ cookies: () => cookieStore })
  const { data: { user } } = await supa.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data } = await supa.from('sync_identity')
    .select('email').eq('user_id', user.id)
  return NextResponse.json({ emails: (data ?? []).map(r => r.email) })
}

export async function PUT(req: Request) {
  const cookieStore = await cookies()
  const supa = createRouteHandlerClient({ cookies: () => cookieStore })
  const { data: { user } } = await supa.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { emails } = await req.json() as { emails: string[] }
  const clean = [...new Set(emails.map(e => e.trim().toLowerCase()).filter(Boolean))]
  await supa.from('sync_identity').delete().eq('user_id', user.id)
  if (clean.length) {
    await supa.from('sync_identity').insert(
      clean.map(email => ({ user_id: user.id, email })))
  }
  return NextResponse.json({ ok: true })
}

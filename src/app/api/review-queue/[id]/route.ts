import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(req: Request,
  { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cookieStore = await cookies()
  const supa = createRouteHandlerClient({ cookies: () => cookieStore })
  const { data: { user } } = await supa.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json() as {
    contact_id: string; type: string; date: string;
    summary: string; notes: string; learn_alias: boolean
  }
  const { data: q } = await supa.from('interaction_review_queue')
    .select('*').eq('id', id).eq('user_id', user.id).single()
  if (!q) return NextResponse.json({ error: 'not found' }, { status: 404 })

  // Create the real interaction FIRST and verify it succeeded. If this
  // fails we must NOT mark the queue item accepted (that silently loses the
  // interaction — the bug this replaces).
  const { error: interactionErr } = await supa.from('interactions').upsert({
    user_id: user.id, contact_id: body.contact_id, source: q.source,
    external_id: q.external_id, type: body.type, date: body.date,
    summary: body.summary, notes: body.notes,
  }, { onConflict: 'user_id,contact_id,source,external_id' })
  if (interactionErr) {
    return NextResponse.json(
      { error: `failed to create interaction: ${interactionErr.message}` },
      { status: 500 })
  }

  if (body.learn_alias && q.counterparty_email) {
    const { error: aliasErr } = await supa.from('contact_email_aliases').upsert({
      user_id: user.id, contact_id: body.contact_id,
      email: q.counterparty_email.trim().toLowerCase(), source: 'learned',
    }, { onConflict: 'user_id,email' })
    // Alias learning is best-effort; the interaction already exists. Log but
    // don't fail the request (the user's primary action succeeded).
    if (aliasErr) console.error('alias upsert failed:', aliasErr.message)
  }

  const { error: queueErr } = await supa.from('interaction_review_queue')
    .update({ status: 'accepted' }).eq('id', id)
  if (queueErr) {
    return NextResponse.json(
      { error: `interaction created but queue update failed: ${queueErr.message}` },
      { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request,
  { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cookieStore = await cookies()
  const supa = createRouteHandlerClient({ cookies: () => cookieStore })
  const { data: { user } } = await supa.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  await supa.from('interaction_review_queue')
    .update({ status: 'dismissed' }).eq('id', id).eq('user_id', user.id)
  return NextResponse.json({ ok: true })
}

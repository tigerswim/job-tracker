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

  // Verify contact_id belongs to the authenticated user before writing
  const { data: ownedContact } = await supa.from('contacts')
    .select('id').eq('id', body.contact_id).eq('user_id', user.id).single()
  if (!ownedContact) return NextResponse.json({ error: 'invalid contact' }, { status: 400 })

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

export async function PATCH(req: Request,
  { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cookieStore = await cookies()
  const supa = createRouteHandlerClient({ cookies: () => cookieStore })
  const { data: { user } } = await supa.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json() as {
    action: 'dismiss' | 'skip'
    blockPattern?: string
    patternType?: 'sender' | 'domain'
  }

  if (body.action === 'skip') {
    const skippedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    await supa.from('interaction_review_queue')
      .update({ status: 'skipped', skipped_until: skippedUntil })
      .eq('id', id).eq('user_id', user.id)
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'dismiss') {
    if (body.patternType && !['sender', 'domain'].includes(body.patternType)) {
      return NextResponse.json({ error: 'invalid patternType' }, { status: 400 })
    }
    await supa.from('interaction_review_queue')
      .update({ status: 'dismissed' }).eq('id', id).eq('user_id', user.id)

    if (body.blockPattern && body.patternType) {
      // Normalize the pattern so it matches the bare counterparty_email values.
      // sender: extract bare email from a possible "Name <email>" header.
      // domain: strip brackets, leading @, and trailing '>'.
      let safe: string
      if (body.patternType === 'sender') {
        const m = body.blockPattern.match(/<([^>]+)>/)
        const bare = (m ? m[1] : body.blockPattern).trim().toLowerCase().replace(/>+$/, '')
        safe = bare.includes('@') ? bare : body.blockPattern.trim().toLowerCase()
      } else {
        safe = body.blockPattern.trim().toLowerCase().replace(/[<>]/g, '').replace(/^@/, '')
      }

      if (body.patternType === 'domain' && safe.includes('@')) {
        return NextResponse.json({ error: 'domain pattern must not include @' }, { status: 400 })
      }

      if (safe) {
        const { error: insertErr } = await supa.from('blocked_senders').insert({
          user_id: user.id,
          pattern: safe,
          pattern_type: body.patternType,
        })
        if (insertErr && insertErr.code !== '23505') {
          console.error('blocked_senders insert failed:', insertErr.message)
        }

        // Retroactively dismiss already-queued items from this sender/domain.
        // sender → exact match; domain → '%@<domain>' so 'example.com' doesn't
        // match 'notexample.com'. Best-effort: log but don't fail the request.
        let sweep = supa.from('interaction_review_queue')
          .update({ status: 'dismissed' })
          .eq('user_id', user.id)
          .in('status', ['pending', 'skipped'])
        sweep = body.patternType === 'sender'
          ? sweep.eq('counterparty_email', safe)
          : sweep.ilike('counterparty_email', `%@${safe}`)
        const { error: sweepErr } = await sweep
        if (sweepErr) console.error('block sweep failed:', sweepErr.message)
      }
    }
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}

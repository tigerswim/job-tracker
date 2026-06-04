import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateSnoozeToken, snoozeUntil, SnoozeDuration } from '@/lib/snooze-hmac'

const VALID_DURATIONS: SnoozeDuration[] = ['1w', '1m', '3m', 'indefinite']

const DURATION_LABEL: Record<SnoozeDuration, string> = {
  '1w': '1 week',
  '1m': '1 month',
  '3m': '3 months',
  'indefinite': 'indefinitely',
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function htmlPage(title: string, body: string): NextResponse {
  const safeTitle = escapeHtml(title)
  const safeBody = escapeHtml(body)
  return new NextResponse(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${safeTitle}</title>
     <style>body{font-family:system-ui,sans-serif;max-width:480px;margin:80px auto;padding:0 16px;text-align:center}
     h1{font-size:1.4rem}p{color:#555}</style></head>
     <body><h1>${safeTitle}</h1><p>${safeBody}</p></body></html>`,
    { headers: {
      'Content-Type': 'text/html',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
    }}
  )
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const duration = searchParams.get('duration') as SnoozeDuration | null
  const uid = searchParams.get('uid')
  const token = searchParams.get('token')

  if (!duration || !uid || !token) {
    return htmlPage('Invalid link', 'This snooze link is missing required parameters.')
  }

  if (!VALID_DURATIONS.includes(duration)) {
    return htmlPage('Invalid link', 'Unknown snooze duration.')
  }

  const secret = process.env.SNOOZE_LINK_SECRET
  if (!secret) {
    console.error('SNOOZE_LINK_SECRET not set')
    return htmlPage('Configuration error', 'Snooze links are not configured.')
  }

  const valid = await validateSnoozeToken(id, duration, uid, token, secret)
  if (!valid) {
    return htmlPage('Invalid link', 'This snooze link is invalid or has been tampered with.')
  }

  // Use service role to update without needing user session
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: contact, error: fetchErr } = await supabase
    .from('contacts')
    .select('name')
    .eq('id', id)
    .eq('user_id', uid)
    .single()

  if (fetchErr || !contact) {
    return htmlPage('Not found', 'Contact not found.')
  }

  const until = snoozeUntil(duration)
  const { error: updateErr } = await supabase
    .from('contacts')
    .update({ followup_snoozed_until: until.toISOString() })
    .eq('id', id)
    .eq('user_id', uid)

  if (updateErr) {
    console.error('Snooze update failed:', updateErr)
    return htmlPage('Error', 'Failed to save snooze. Please try again.')
  }

  const label = DURATION_LABEL[duration]
  const name = contact.name as string
  return htmlPage(
    'Follow-up snoozed',
    `Got it — follow-up reminders for "${name}" are snoozed for ${label}.`
  )
}

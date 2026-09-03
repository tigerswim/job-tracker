// API endpoint to look up a contact by LinkedIn URL.
// Authenticates with the extension user's Supabase access token (Bearer).

import { NextRequest, NextResponse } from 'next/server'
import { authenticateBearer } from '@/lib/api-auth'
import { sanitizeFilterValue } from '@/lib/sanitize'

export async function POST(request: NextRequest) {
  try {
    // Authenticate as the signed-in user. Previously this used a static
    // x-api-key plus the service-role key (RLS bypassed) and resolved the
    // tenant from a hardcoded N8N_DEFAULT_USER_ID, so the shared key was
    // effectively the identity. Now the caller's own token is the identity
    // and every query runs under RLS.
    const auth = await authenticateBearer(request)
    if (!auth.ok) {
      return NextResponse.json({ found: false, error: auth.error }, { status: auth.status })
    }
    const { supabase, userId } = auth

    // Parse request body
    const body = await request.json()
    const { linkedin_url } = body

    if (!linkedin_url) {
      return NextResponse.json(
        { found: false, error: 'linkedin_url is required' },
        { status: 400 }
      )
    }

    // Normalize LinkedIn URL for matching
    const normalizedUrl = normalizeLinkedInUrl(linkedin_url)
    const username = extractUsername(linkedin_url)

    // PostgREST filter metacharacters must be stripped before interpolation.
    const safeUsername = sanitizeFilterValue(username)
    const safeNormalizedUrl = sanitizeFilterValue(normalizedUrl)

    // Look up contact by LinkedIn URL with multiple matching strategies
    // Try exact username match first (most reliable)
    let { data: contact, error } = await supabase
      .from('contacts')
      .select('id, name, job_title, company, linkedin_url, mutual_connections')
      .eq('user_id', userId)
      .ilike('linkedin_url', `%${safeUsername}%`)
      .limit(1)
      .single()

    // If not found, try normalized path match
    if (!contact && (!error || error.code === 'PGRST116')) {
      const result = await supabase
        .from('contacts')
        .select('id, name, job_title, company, linkedin_url, mutual_connections')
        .eq('user_id', userId)
        .ilike('linkedin_url', `%${safeNormalizedUrl}%`)
        .limit(1)
        .single()

      contact = result.data
      error = result.error
    }

    // If still not found, try just the username without in/ prefix
    if (!contact && (!error || error.code === 'PGRST116')) {
      const result = await supabase
        .from('contacts')
        .select('id, name, job_title, company, linkedin_url, mutual_connections')
        .eq('user_id', userId)
        .or(`linkedin_url.ilike.%${safeUsername},linkedin_url.eq.${safeUsername}`)
        .limit(1)
        .single()

      contact = result.data
      error = result.error
    }


    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned (not an error for us)
      console.error('Lookup contact error:', error)
      return NextResponse.json(
        { found: false, error: 'Database error', details: error.message, code: error.code },
        { status: 500 }
      )
    }

    if (!contact) {
      return NextResponse.json({ found: false })
    }

    return NextResponse.json({
      found: true,
      contact: {
        id: contact.id,
        name: contact.name,
        title: contact.job_title,
        company: contact.company,
        linkedin: contact.linkedin_url,
        mutual_connections: contact.mutual_connections || []
      }
    })
  } catch (error) {
    console.error('Lookup contact unexpected error:', error)
    return NextResponse.json(
      { found: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Normalize a LinkedIn URL for consistent matching
 */
function normalizeLinkedInUrl(url: string): string {
  try {
    // Handle URLs without protocol
    if (!url.startsWith('http')) {
      url = 'https://' + url
    }

    const parsed = new URL(url)

    // Extract the path (e.g., /in/username)
    let path = parsed.pathname

    // Remove trailing slash
    if (path.endsWith('/')) {
      path = path.slice(0, -1)
    }

    return path.toLowerCase()
  } catch {
    // If URL parsing fails, return as-is lowercase
    return url.toLowerCase()
  }
}

/**
 * Extract username from LinkedIn URL
 */
function extractUsername(url: string): string {
  const match = url.match(/linkedin\.com\/in\/([^\/\?]+)/i)
  return match ? match[1].toLowerCase() : ''
}

// Handle OPTIONS request for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      // Content scripts run on LinkedIn pages, so the browser sends that
      // origin. Scoped rather than '*' so arbitrary sites cannot preflight.
      'Access-Control-Allow-Origin': 'https://www.linkedin.com',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Vary': 'Origin',
    },
  })
}

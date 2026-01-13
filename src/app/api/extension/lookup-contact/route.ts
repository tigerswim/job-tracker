// API endpoint to look up a contact by LinkedIn URL
// Uses API key authentication for the Chrome extension

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const extensionApiKey = process.env.EXTENSION_API_KEY

// Default user ID for extension operations (same as n8n)
const defaultUserId = process.env.N8N_DEFAULT_USER_ID

export async function POST(request: NextRequest) {
  try {
    // Validate API key
    const apiKey = request.headers.get('x-api-key')

    if (!apiKey || apiKey !== extensionApiKey) {
      return NextResponse.json(
        { found: false, error: 'Invalid or missing API key' },
        { status: 401 }
      )
    }

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

    // Create Supabase client with service role key (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Look up contact by LinkedIn URL
    const { data: contact, error } = await supabase
      .from('contacts')
      .select('id, name, title, company, linkedin, mutual_connections')
      .eq('user_id', defaultUserId)
      .or(`linkedin.ilike.%${normalizedUrl}%,linkedin.ilike.%${extractUsername(linkedin_url)}%`)
      .limit(1)
      .single()

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
        title: contact.title,
        company: contact.company,
        linkedin: contact.linkedin,
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
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
    },
  })
}

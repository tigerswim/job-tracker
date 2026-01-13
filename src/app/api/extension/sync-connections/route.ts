// API endpoint to sync mutual connections from LinkedIn to a contact
// Uses API key authentication for the Chrome extension

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { mergeNames } from '@/lib/nameMatching'

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
        { success: false, error: 'Invalid or missing API key' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { linkedin_url, mutual_connections } = body

    if (!linkedin_url) {
      return NextResponse.json(
        { success: false, error: 'linkedin_url is required' },
        { status: 400 }
      )
    }

    if (!Array.isArray(mutual_connections)) {
      return NextResponse.json(
        { success: false, error: 'mutual_connections must be an array' },
        { status: 400 }
      )
    }

    // Normalize LinkedIn URL for matching
    const normalizedUrl = normalizeLinkedInUrl(linkedin_url)
    const username = extractUsername(linkedin_url)

    // Create Supabase client with service role key (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Look up contact by LinkedIn URL
    const { data: contact, error: lookupError } = await supabase
      .from('contacts')
      .select('id, name, mutual_connections')
      .eq('user_id', defaultUserId)
      .or(`linkedin_url.ilike.%${normalizedUrl}%,linkedin_url.ilike.%${username}%`)
      .limit(1)
      .single()

    if (lookupError && lookupError.code !== 'PGRST116') {
      console.error('Sync connections lookup error:', lookupError)
      return NextResponse.json(
        { success: false, error: 'Database error during lookup' },
        { status: 500 }
      )
    }

    if (!contact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found with that LinkedIn URL' },
        { status: 404 }
      )
    }

    // Get existing mutual connections
    const existingConnections: string[] = contact.mutual_connections || []

    // Merge new connections with existing ones (using fuzzy name matching)
    const { merged, added, alreadyExisted } = mergeNames(existingConnections, mutual_connections)

    // If nothing new to add, return early
    if (added.length === 0) {
      return NextResponse.json({
        success: true,
        contact_id: contact.id,
        contact_name: contact.name,
        added: [],
        already_existed: alreadyExisted,
        total_connections: existingConnections.length
      })
    }

    // Update the contact with merged connections
    const { error: updateError } = await supabase
      .from('contacts')
      .update({ mutual_connections: merged })
      .eq('id', contact.id)

    if (updateError) {
      console.error('Sync connections update error:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update contact' },
        { status: 500 }
      )
    }

    console.log(`Synced ${added.length} connections to contact ${contact.name} (${contact.id})`)

    return NextResponse.json({
      success: true,
      contact_id: contact.id,
      contact_name: contact.name,
      added,
      already_existed: alreadyExisted,
      total_connections: merged.length
    })
  } catch (error) {
    console.error('Sync connections unexpected error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
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

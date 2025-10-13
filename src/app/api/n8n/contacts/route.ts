import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Validate API key from header
function validateApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('x-api-key')
  const validApiKey = process.env.N8N_API_KEY

  if (!validApiKey) {
    console.error('N8N_API_KEY not configured in environment variables')
    return false
  }

  return apiKey === validApiKey
}

export async function POST(request: NextRequest) {
  // Validate API key
  if (!validateApiKey(request)) {
    return NextResponse.json(
      { success: false, message: 'Unauthorized - Invalid API key' },
      { status: 401 }
    )
  }

  try {
    const body = await request.json()

    // Validate required fields
    if (!body.name) {
      return NextResponse.json(
        { success: false, message: 'Name is required' },
        { status: 400 }
      )
    }

    // Create Supabase client with service role for server-side operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase configuration missing')
      return NextResponse.json(
        { success: false, message: 'Server configuration error' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Check for duplicate contact (by name + company)
    const { data: existingContacts } = await supabase
      .from('contacts')
      .select('id, name, company')
      .eq('name', body.name)
      .eq('company', body.company || '')
      .limit(1)

    if (existingContacts && existingContacts.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'Contact already exists',
          existing_contact: existingContacts[0],
        },
        { status: 409 }
      )
    }

    // Map n8n data to contacts table structure
    // Note: This assumes a default user_id. You may need to adjust this based on your user setup
    const contactData = {
      name: body.name,
      company: body.company || null,
      job_title: body.title || body.current_position?.title || null,
      email: body.email || null,
      phone: body.phone || null,
      current_location: body.location || null,
      linkedin_url: body.linkedin || null,
      notes: body.summary || null,
      // Store additional structured data as JSON in notes or separate fields
      experience: body.experience ? JSON.stringify(body.experience) : null,
      education: body.education ? JSON.stringify(body.education) : null,
      skills: body.skills ? JSON.stringify(body.skills) : null,
      certifications: body.certifications ? JSON.stringify(body.certifications) : null,
      source: body.source || 'n8n automation',
      // If you have a specific user_id for n8n imports, set it here
      // Otherwise, you'll need to handle user association differently
    }

    // Insert the contact
    const { data: newContact, error } = await supabase
      .from('contacts')
      .insert([contactData])
      .select()
      .single()

    if (error) {
      console.error('Error inserting contact:', error)
      return NextResponse.json(
        { success: false, message: 'Failed to create contact', error: error.message },
        { status: 500 }
      )
    }

    // Log the import
    console.log(`[n8n] Contact created: ${newContact.name} (${newContact.company}) - ID: ${newContact.id}`)

    return NextResponse.json(
      {
        success: true,
        message: 'Contact created successfully',
        contact: {
          id: newContact.id,
          name: newContact.name,
          company: newContact.company,
          created_at: newContact.created_at,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error processing n8n contact:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

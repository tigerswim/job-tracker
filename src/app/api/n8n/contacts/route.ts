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

// Transform experience data from snake_case to camelCase
const transformExperience = (exp: any) => ({
  id: exp.id || `temp-${Date.now()}-${Math.random()}`,
  company: exp.company || '',
  title: exp.title || '',
  start_date: exp.start_date || '',
  end_date: exp.end_date || '',
  is_current: exp.is_current !== undefined ? exp.is_current : false,
  description: exp.description || ''
});

// Transform education data from snake_case to camelCase
const transformEducation = (edu: any) => ({
  id: edu.id || `temp-${Date.now()}-${Math.random()}`,
  institution: edu.institution || '',
  degree_and_field: edu.degree_and_field || '',
  year: edu.year || '',
  notes: edu.notes || ''
});

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

    // Helper function to add https:// prefix to LinkedIn URLs if not present
    const formatLinkedInUrl = (url: string | null | undefined): string | null => {
      if (!url) return null
      const trimmedUrl = url.trim()
      if (!trimmedUrl) return null
      // Check if URL already has a protocol
      if (!/^https?:\/\//i.test(trimmedUrl)) {
        return `https://${trimmedUrl}`
      }
      return trimmedUrl
    }

    // Format the incoming LinkedIn URL
    const formattedLinkedInUrl = formatLinkedInUrl(body.linkedin)

    // Check for existing contact by LinkedIn URL (primary matching method)
    let existingContact = null
    if (formattedLinkedInUrl) {
      const { data: linkedInMatch } = await supabase
        .from('contacts')
        .select('*')
        .eq('linkedin_url', formattedLinkedInUrl)
        .limit(1)

      if (linkedInMatch && linkedInMatch.length > 0) {
        existingContact = linkedInMatch[0]
      }
    }

    // Map n8n data to contacts table structure
    const contactData = {
      name: body.name,
      company: body.company || null,
      job_title: body.title || body.current_position?.title || null,
      email: body.email || null,
      phone: body.phone || null,
      current_location: body.location || null,
      linkedin_url: formattedLinkedInUrl,
      notes: body.summary || null,
      // Store additional structured data as proper JSONB arrays (not JSON strings)
      experience: Array.isArray(body.experience)
        ? body.experience.map(transformExperience)
        : [],
      education: Array.isArray(body.education)
        ? body.education.map(transformEducation)
        : [],
      skills: Array.isArray(body.skills)
        ? body.skills
        : [],
      certifications: Array.isArray(body.certifications)
        ? body.certifications
        : [],
      user_id: process.env.N8N_DEFAULT_USER_ID,
      source: body.source || 'n8n automation',
      mutual_connections: Array.isArray(body.mutual_connections)
        ? body.mutual_connections
        : body.mutual_connections
          ? body.mutual_connections.split(',').map((s: string) => s.trim()).filter((s: string) => s)
          : []
    }

    // If existing contact found, UPDATE it with historical data preservation
    if (existingContact) {
      // Build historical notes from old data
      const timestamp = new Date().toISOString()
      const historicalNotes: string[] = []

      // Preserve old experience data
      if (existingContact.experience && Array.isArray(existingContact.experience) && existingContact.experience.length > 0) {
        historicalNotes.push(`\n--- Previous Experience (archived ${timestamp}) ---\n${JSON.stringify(existingContact.experience, null, 2)}`)
      }

      // Preserve old education data
      if (existingContact.education && Array.isArray(existingContact.education) && existingContact.education.length > 0) {
        historicalNotes.push(`\n--- Previous Education (archived ${timestamp}) ---\n${JSON.stringify(existingContact.education, null, 2)}`)
      }

      // Preserve old simple field data if different from new data
      const oldFieldData: any = {}
      if (existingContact.name !== contactData.name) oldFieldData.name = existingContact.name
      if (existingContact.company !== contactData.company) oldFieldData.company = existingContact.company
      if (existingContact.job_title !== contactData.job_title) oldFieldData.job_title = existingContact.job_title
      if (existingContact.email !== contactData.email) oldFieldData.email = existingContact.email
      if (existingContact.phone !== contactData.phone) oldFieldData.phone = existingContact.phone
      if (existingContact.current_location !== contactData.current_location) oldFieldData.current_location = existingContact.current_location

      if (Object.keys(oldFieldData).length > 0) {
        historicalNotes.push(`\n--- Previous Contact Info (archived ${timestamp}) ---\n${JSON.stringify(oldFieldData, null, 2)}`)
      }

      // Combine historical notes with existing notes and new summary
      const updatedNotes = [
        ...(historicalNotes.length > 0 ? historicalNotes : []),
        ...(existingContact.notes ? [existingContact.notes] : []),
      ].join('\n\n')

      // Update the existing contact
      const { data: updatedContact, error } = await supabase
        .from('contacts')
        .update({
          ...contactData,
          notes: updatedNotes || contactData.notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingContact.id)
        .select()
        .single()

      if (error) {
        console.error('Error updating contact:', error)
        return NextResponse.json(
          { success: false, message: 'Failed to update contact', error: error.message },
          { status: 500 }
        )
      }

      // Log the update
      console.log(`[n8n] Contact updated: ${updatedContact.name} (${updatedContact.company}) - ID: ${updatedContact.id}`)

      return NextResponse.json(
        {
          success: true,
          message: 'Contact updated successfully',
          updated: true,
          contact: {
            id: updatedContact.id,
            name: updatedContact.name,
            company: updatedContact.company,
            updated_at: updatedContact.updated_at,
          },
        },
        { status: 200 }
      )
    }

    // If no existing contact found, INSERT new contact
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

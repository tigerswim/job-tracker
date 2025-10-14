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

// ADD THESE HELPER FUNCTIONS BEFORE THE POST FUNCTION
// Transform experience data from snake_case to camelCase
const transformExperience = (exp: any) => ({
  id: exp.id || `temp-${Date.now()}-${Math.random()}`,
  company: exp.company || '',
  title: exp.title || '',
  startdate: exp.start_date || exp.startdate || '',
  enddate: exp.end_date || exp.enddate || '',
  iscurrent: exp.is_current !== undefined ? exp.is_current : (exp.iscurrent || false),
  description: exp.description || ''
});

// Transform education data from snake_case to camelCase
const transformEducation = (edu: any) => ({
  id: edu.id || `temp-${Date.now()}-${Math.random()}`,
  institution: edu.institution || '',
  degreeandfield: edu.degree_and_field || edu.degreeandfield || '',
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
      return NextResponse.json(
        { success: false, message: 'Server configuration error' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // UPDATED CONTACT DATA OBJECT WITH TRANSFORMATIONS
    const contactData = {
      name: body.name,
      company: body.company || null,
      job_title: body.job_title || null,
      email: body.email || null,
      phone: body.phone || null,
      linkedin_url: body.linkedin_url || null,
      notes: body.notes || null,
      current_location: body.current_location || null,
      user_id: process.env.N8N_DEFAULT_USER_ID,
      source: body.source || 'n8n automation',
      mutual_connections: Array.isArray(body.mutual_connections) 
        ? body.mutual_connections 
        : body.mutual_connections 
          ? body.mutual_connections.split(',').map((s: string) => s.trim()).filter((s: string) => s)
          : [],
      // ADD THESE TRANSFORMED FIELDS
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
        : []
    }

    // Insert contact
    const { data, error } = await supabase
      .from('contacts')
      .insert([contactData])
      .select()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { success: false, message: 'Failed to create contact', error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { success: true, message: 'Contact created successfully', data },
      { status: 201 }
    )

  } catch (error) {
    console.error('Error processing request:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

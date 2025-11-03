// src/app/api/extension/jobs/route.ts - API endpoint for Chrome extension

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// This endpoint is specifically for the Chrome extension
// It uses Bearer token authentication instead of cookies

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function POST(request: NextRequest) {
  try {
    // Get authorization header
    const authHeader = request.headers.get('authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix

    // Create Supabase client with the provided token
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    })

    // Verify the token and get user
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) {
      console.error('Extension API: Auth error:', userError)
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      )
    }

    console.log('Extension API: Authenticated user:', user.id)

    // Parse request body
    const jobData = await request.json()

    // Validate required fields
    if (!jobData.job_title || !jobData.company) {
      return NextResponse.json(
        { error: 'job_title and company are required' },
        { status: 400 }
      )
    }

    // Prepare insert data
    const insertData = {
      job_title: jobData.job_title,
      company: jobData.company,
      location: jobData.location || null,
      salary: jobData.salary || null,
      job_url: jobData.job_url || null,
      status: jobData.status || 'interested',
      applied_date: jobData.applied_date || null,
      job_description: jobData.job_description || null,
      notes: jobData.notes || null,
      user_id: user.id
    }

    console.log('Extension API: Inserting job:', insertData.job_title)

    // Insert job into database
    const { data, error } = await supabase
      .from('jobs')
      .insert([insertData])
      .select()
      .single()

    if (error) {
      console.error('Extension API: Database error:', error)
      return NextResponse.json(
        { error: 'Failed to create job', details: error.message },
        { status: 500 }
      )
    }

    console.log('Extension API: Job created successfully:', data.id)

    return NextResponse.json(
      { success: true, job: data },
      { status: 201 }
    )
  } catch (error) {
    console.error('Extension API: Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Handle OPTIONS request for CORS preflight
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}

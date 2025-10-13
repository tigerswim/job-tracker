// src/lib/jobContacts.ts - Fixed version with proper error handling

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export interface JobContact {
  id: string
  job_id: string
  contact_id: string
  user_id: string
  created_at: string
  updated_at: string
}

export interface LinkedJob {
  id: string
  job_title: string
  company: string
  status: string
  location: string | null
}

export async function linkJobToContact(jobId: string, contactId: string): Promise<JobContact> {
  try {
    if (!jobId || !contactId) {
      throw new Error('Job ID and Contact ID are required')
    }

    const supabase = createClientComponentClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError) {
      throw new Error(`Authentication error: ${userError.message}`)
    }

    if (!user) {
      throw new Error('Auth session missing!')
    }

    // Check if link already exists
    const { data: existing } = await supabase
      .from('job_contacts')
      .select('id')
      .eq('job_id', jobId)
      .eq('contact_id', contactId)
      .eq('user_id', user.id)
      .single()

    if (existing) {
      throw new Error('Contact is already linked to this job')
    }

    const { data, error } = await supabase
      .from('job_contacts')
      .insert([{
        job_id: jobId,
        contact_id: contactId,
        user_id: user.id
      }])
      .select()
      .single()

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    return data
  } catch (error) {
    console.error('Error in linkJobToContact:', {
      error: error instanceof Error ? error.message : String(error),
      jobId,
      contactId,
      timestamp: new Date().toISOString()
    })
    throw error // Re-throw to let calling function handle
  }
}

export async function unlinkJobFromContact(jobId: string, contactId: string): Promise<boolean> {
  try {
    if (!jobId || !contactId) {
      throw new Error('Job ID and Contact ID are required')
    }

    const supabase = createClientComponentClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError) {
      throw new Error(`Authentication error: ${userError.message}`)
    }

    if (!user) {
      throw new Error('Auth session missing!')
    }

    const { error } = await supabase
      .from('job_contacts')
      .delete()
      .eq('job_id', jobId)
      .eq('contact_id', contactId)
      .eq('user_id', user.id)

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    return true
  } catch (error) {
    console.error('Error in unlinkJobFromContact:', {
      error: error instanceof Error ? error.message : String(error),
      jobId,
      contactId,
      timestamp: new Date().toISOString()
    })
    throw error // Re-throw to let calling function handle
  }
}

export async function getJobContacts(jobId: string) {
  try {
    if (!jobId || jobId.trim() === '') {
      throw new Error('Job ID is required')
    }

    const supabase = createClientComponentClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError) {
      throw new Error(`Authentication error: ${userError.message}`)
    }

    if (!user) {
      throw new Error('Auth session missing!')
    }

    const { data, error } = await supabase
      .from('job_contacts')
      .select(`
        id,
        contacts (
          id,
          name,
          email,
          phone,
          company,
          job_title
        )
      `)
      .eq('job_id', jobId)
      .eq('user_id', user.id)

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    return data?.map(item => item.contacts).filter(contact => contact !== null) || []
  } catch (error) {
    console.error('Error in getJobContacts:', {
      error: error instanceof Error ? error.message : String(error),
      jobId: jobId || 'undefined',
      timestamp: new Date().toISOString()
    })
    throw error // Re-throw to let calling function handle
  }
}

export async function getContactJobs(contactId: string) {
  try {
    if (!contactId || contactId.trim() === '') {
      throw new Error('Contact ID is required')
    }

    const supabase = createClientComponentClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError) {
      throw new Error(`Authentication error: ${userError.message}`)
    }

    if (!user) {
      throw new Error('Auth session missing!')
    }

    const { data, error } = await supabase
      .from('job_contacts')
      .select(`
        id,
        jobs (
          id,
          job_title,
          company,
          status,
          location
        )
      `)
      .eq('contact_id', contactId)
      .eq('user_id', user.id)

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    return data?.map(item => item.jobs).filter(job => job !== null) || []
  } catch (error) {
    console.error('Error in getContactJobs:', {
      error: error instanceof Error ? error.message : String(error),
      contactId: contactId || 'undefined',
      timestamp: new Date().toISOString()
    })
    throw error // Re-throw to let calling function handle
  }
}

/**
 * Batch fetch jobs linked to multiple contacts to avoid N+1 queries.
 * Returns a map: contact_id -> LinkedJob[]
 */
export async function getJobsForContacts(
  contactIds: string[]
): Promise<Record<string, LinkedJob[]>> {
  try {
    if (!contactIds || contactIds.length === 0) {
      return {}
    }

    // Filter out any undefined or empty contact IDs
    const validContactIds = contactIds.filter(id => id && id.trim() !== '')
    if (validContactIds.length === 0) {
      return {}
    }

    const supabase = createClientComponentClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError) {
      throw new Error(`Authentication error: ${userError.message}`)
    }

    if (!user) {
      throw new Error('Auth session missing!')
    }

    // Fetch all links for the provided contacts in a single query
    const { data, error } = await supabase
      .from('job_contacts')
      .select(`
        contact_id,
        jobs (
          id,
          job_title,
          company,
          status,
          location
        )
      `)
      .in('contact_id', validContactIds)
      .eq('user_id', user.id)

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    const map: Record<string, LinkedJob[]> = {}
    for (const row of data || []) {
      const cid = (row as any).contact_id as string
      const job = (row as any).jobs as LinkedJob
      if (!cid || !job) continue
      if (!map[cid]) map[cid] = []
      map[cid].push(job)
    }

    return map
  } catch (error) {
    console.error('Error in getJobsForContacts:', {
      error: error instanceof Error ? error.message : String(error),
      contactIds: contactIds?.length || 0,
      timestamp: new Date().toISOString()
    })
    throw error // Re-throw to let calling function handle
  }
}


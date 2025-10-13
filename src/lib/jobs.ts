// src/lib/jobs.ts - Job data operations
import { Contact } from './supabase'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Job } from './supabase'

export interface JobsResponse {
  jobs: Job[]
  total: number
  hasMore: boolean
}

export interface JobSearchOptions {
  searchTerm?: string
  status?: Job['status'] | 'all'
  limit?: number
  offset?: number
  sortBy?: 'job_title' | 'company' | 'created_at' | 'applied_date'
  sortOrder?: 'asc' | 'desc'
}

export async function getJobs(): Promise<Job[]> {
  try {
    const supabase = createClientComponentClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      console.error('Error getting user:', userError)
      return []
    }

    console.log('getJobs: Fetching jobs for user ID:', user.id)

    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching jobs:', error)
      return []
    }

    console.log('getJobs: Found', data?.length || 0, 'jobs for user:', user.id)
    return data || []
  } catch (error) {
    console.error('Exception in getJobs:', error)
    return []
  }
}

export async function searchJobs(options: JobSearchOptions = {}): Promise<JobsResponse> {
  try {
    const {
      searchTerm = '',
      status = 'all',
      limit = 50,
      offset = 0,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = options

    const supabase = createClientComponentClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      console.error('Error getting user:', userError)
      return { jobs: [], total: 0, hasMore: false }
    }

    let query = supabase
      .from('jobs')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)

    // Add search filtering if search term provided
    if (searchTerm.trim()) {
      const term = searchTerm.trim()
      query = query.or(`
        job_title.ilike.%${term}%,
        company.ilike.%${term}%,
        location.ilike.%${term}%,
        notes.ilike.%${term}%
      `)
    }

    // Add status filtering
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    // Add sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' })

    // Add pagination
    const { data, error, count } = await query.range(offset, offset + limit - 1)

    if (error) {
      console.error('Error searching jobs:', error)
      return { jobs: [], total: 0, hasMore: false }
    }

    const total = count || 0
    const hasMore = (offset + limit) < total

    return {
      jobs: (data as Job[]) || [],
      total,
      hasMore
    }
  } catch (error) {
    console.error('Exception in searchJobs:', error)
    return { jobs: [], total: 0, hasMore: false }
  }
}

export async function getJobById(id: string): Promise<Job | null> {
  try {
    const supabase = createClientComponentClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      console.error('Error getting user:', userError)
      return null
    }

    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error) {
      console.error('Error fetching job by id:', error)
      return null
    }

    return data as Job
  } catch (error) {
    console.error('Exception in getJobById:', error)
    return null
  }
}

export async function createJob(job: Omit<Job, 'id' | 'created_at' | 'updated_at'>): Promise<Job | null> {
  console.log('=== DEBUG: createJob started ===')
  console.log('Job data received:', job)
  
  try {
    const supabase = createClientComponentClient()
    
    // 1. Check user authentication with more detailed logging
    console.log('Getting user authentication...')
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError) {
      console.error('❌ User authentication error:', userError)
      console.error('Full error object:', JSON.stringify(userError, null, 2))
      throw new Error(`Authentication failed: ${userError.message}`)
    }

    if (!user) {
      console.error('❌ No authenticated user found')
      console.log('Checking session...')
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      console.log('Session data:', session)
      if (sessionError) {
        console.error('Session error:', sessionError)
      }
      throw new Error('No authenticated user')
    }

    console.log('✅ User authenticated successfully')
    console.log('User ID:', user.id)
    console.log('User email:', user.email)

    // 2. Prepare insert data with validation
    const insertData = {
      job_title: job.job_title || null,
      company: job.company || null,
      location: job.location || null,
      salary: job.salary || null,
      job_url: job.job_url || null,
      status: job.status || 'interested',
      applied_date: job.applied_date || null,
      job_description: job.job_description || null,
      notes: job.notes || null,
      user_id: user.id
    }

    console.log('🔧 Prepared insert data:', insertData)

    // 3. Validate required fields
    if (!insertData.job_title || !insertData.company) {
      throw new Error('Job title and company are required')
    }

    // 4. Attempt the insert
    console.log('Attempting database insert...')
    const { data, error } = await supabase
      .from('jobs')
      .insert([insertData])
      .select()
      .single()

    if (error) {
      console.error('❌ Database insert failed:', error)
      console.error('Error code:', error.code)
      console.error('Error message:', error.message)
      console.error('Error details:', error.details)
      console.error('Error hint:', error.hint)
      throw new Error(`Failed to create job: ${error.message}`)
    }

    console.log('✅ Job created successfully:', data)
    return data as Job

  } catch (exception) {
    console.error('❌ Exception in createJob:', exception)
    console.error('Exception stack:', exception instanceof Error ? exception.stack : 'No stack trace')
    throw exception
  }
}

// Updated updateJob function with similar debugging
export async function updateJob(id: string, jobData: Partial<Omit<Job, 'id' | 'created_at' | 'updated_at' | 'user_id'>>): Promise<Job | null> {
  console.log('=== DEBUG: updateJob started ===')
  console.log('Job ID:', id)
  console.log('Update data:', jobData)
  
  try {
    const supabase = createClientComponentClient()
    
    // Check user authentication
    console.log('Getting user authentication...')
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError) {
      console.error('❌ User authentication error:', userError)
      throw new Error(`Authentication failed: ${userError.message}`)
    }
    
    if (!user) {
      console.error('❌ No authenticated user found')
      console.log('Checking session...')
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      console.log('Session data:', session)
      if (sessionError) {
        console.error('Session error:', sessionError)
      }
      throw new Error('No authenticated user')
    }

    console.log('✅ User authenticated successfully')
    console.log('User ID:', user.id)

    console.log('Attempting database update...')
    const { data, error } = await supabase
      .from('jobs')
      .update({ 
        ...jobData, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', id)
      .eq('user_id', user.id) // Ensure user can only update their own jobs
      .select()
      .single()

    if (error) {
      console.error('❌ Database update failed:', error)
      console.error('Error code:', error.code)
      console.error('Error message:', error.message)
      throw new Error(`Failed to update job: ${error.message}`)
    }

    console.log('✅ Job updated successfully:', data)
    return data as Job
  } catch (error) {
    console.error('❌ Exception in updateJob:', error)
    throw error
  }
}

// Alternative authentication check function
export async function checkAuthStatus(): Promise<{ user: any | null, error: string | null }> {
  try {
    const supabase = createClientComponentClient()
    
    console.log('=== AUTH DEBUG ===')
    
    // Method 1: getUser()
    const { data: userData, error: userError } = await supabase.auth.getUser()
    console.log('getUser() result:', { user: userData.user, error: userError })
    
    // Method 2: getSession()
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    console.log('getSession() result:', { session: sessionData.session, error: sessionError })
    
    if (userData.user) {
      return { user: userData.user, error: null }
    }
    
    if (sessionData.session?.user) {
      return { user: sessionData.session.user, error: null }
    }
    
    return { user: null, error: 'No authenticated user found' }
  } catch (exception) {
    console.error('Auth check exception:', exception)
    return { user: null, error: `Auth check failed: ${exception}` }
  }
}

export async function deleteJob(id: string): Promise<boolean> {
  try {
    const supabase = createClientComponentClient()
    
    // Check user authentication
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      console.error('Error getting user:', userError)
      return false
    }

    const { error } = await supabase
      .from('jobs')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id) // Ensure user can only delete their own jobs

    if (error) {
      console.error('Error deleting job:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Exception in deleteJob:', error)
    return false
  }
}

export async function getJobStats(): Promise<{
  total: number
  byStatus: Record<Job['status'], number>
  recentlyApplied: number
  withSalary: number
}> {
  try {
    const supabase = createClientComponentClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      console.error('Error getting user:', userError)
      return {
        total: 0,
        byStatus: {
          'interested': 0,
          'applied': 0,
          'interviewing': 0,
          'onhold': 0,
          'offered': 0,
          'rejected': 0
        },
        recentlyApplied: 0,
        withSalary: 0
      }
    }

    const { data, error } = await supabase
      .from('jobs')
      .select('status, salary, applied_date')
      .eq('user_id', user.id)

    if (error) {
      console.error('Error fetching job stats:', error)
      return {
        total: 0,
        byStatus: {
          'interested': 0,
          'applied': 0,
          'interviewing': 0,
          'onhold': 0,
          'offered': 0,
          'rejected': 0
        },
        recentlyApplied: 0,
        withSalary: 0
      }
    }

    const jobs = data || []
    const byStatus = jobs.reduce((acc, job) => {
      acc[job.status] = (acc[job.status] || 0) + 1
      return acc
    }, {} as Record<Job['status'], number>)

    // Count recently applied (within last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const recentlyApplied = jobs.filter(job => 
      job.applied_date && new Date(job.applied_date) >= thirtyDaysAgo
    ).length

    const withSalary = jobs.filter(job => job.salary && job.salary.trim()).length

    return {
      total: jobs.length,
      byStatus: {
        'interested': byStatus['interested'] || 0,
        'applied': byStatus['applied'] || 0,
        'interviewing': byStatus['interviewing'] || 0,
        'onhold': byStatus['onhold'] || 0,
        'offered': byStatus['offered'] || 0,
        'rejected': byStatus['rejected'] || 0
      },
      recentlyApplied,
      withSalary
    }
  } catch (error) {
    console.error('Exception in getJobStats:', error)
    return {
      total: 0,
      byStatus: {
        'interested': 0,
        'applied': 0,
        'interviewing': 0,
        'onhold': 0,
        'offered': 0,
        'rejected': 0
      },
      recentlyApplied: 0,
      withSalary: 0
    }
  }
}

// Utility functions for job management
export async function getJobsByStatus(status: Job['status']): Promise<Job[]> {
  try {
    const response = await searchJobs({ status, limit: 100 })
    return response.jobs
  } catch (error) {
    console.error('Error fetching jobs by status:', error)
    return []
  }
}

export async function getRecentJobs(limit: number = 10): Promise<Job[]> {
  try {
    const response = await searchJobs({ 
      limit, 
      sortBy: 'created_at', 
      sortOrder: 'desc' 
    })
    return response.jobs
  } catch (error) {
    console.error('Error fetching recent jobs:', error)
    return []
  }
}

// Export the Job type for convenience
export type { Job }

// Add these functions to the end of your jobs.ts file

import { Contact } from './supabase' // Make sure this import is at the top

// Define JobWithContacts interface if not already defined elsewhere
export interface JobWithContacts extends Job {
  contacts: Contact[]
}

// Function to fetch jobs with their associated contacts
export async function fetchJobsWithContacts(): Promise<JobWithContacts[]> {
  try {
    const supabase = createClientComponentClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      console.error('Error getting user:', userError)
      return []
    }

    console.log('fetchJobsWithContacts: Fetching jobs with contacts for user:', user.id)

    // Method 1: Try to fetch with contacts (if you have the relationship tables)
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          job_contacts!left(
            contact_id,
            contacts(*)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (!error && data) {
        // Transform the data to match JobWithContacts interface
        const jobsWithContacts: JobWithContacts[] = data.map((job: any) => {
          const contacts = job.job_contacts?.map((jc: any) => jc.contacts).filter(Boolean) || []
          
          // Remove the job_contacts property and add contacts
          const { job_contacts, ...jobData } = job
          return {
            ...jobData,
            contacts
          }
        })

        console.log('fetchJobsWithContacts: Found', jobsWithContacts.length, 'jobs with contacts')
        return jobsWithContacts
      }
    } catch (joinError) {
      console.log('Join query failed, falling back to simple approach:', joinError)
    }

    // Method 2: Fallback - fetch jobs without contacts (simpler approach)
    console.log('Using fallback method: fetching jobs without contact relationships')
    const jobs = await getJobs()
    return jobs.map(job => ({ ...job, contacts: [] }))

  } catch (error) {
    console.error('Exception in fetchJobsWithContacts:', error)
    // Final fallback
    return []
  }
}

// Alias for getJobs - for compatibility with RemindersManagement
export const fetchJobs = getJobs

// Cache management functions (optional, but referenced in your JobList)
let jobsCache: JobWithContacts[] | null = null
let cacheTimestamp: number | null = null
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export function clearJobsCache(): void {
  jobsCache = null
  cacheTimestamp = null
  console.log('Jobs cache cleared')
}
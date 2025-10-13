// src/lib/reminders.ts - Reminder data operations
import { supabase } from './supabase'
import { 
  EmailReminder, 
  ReminderWithContext, 
  CreateReminderRequest,
  UpdateReminderRequest,
  ReminderListResponse,
  ReminderStatsResponse,
  ReminderSearchOptions
} from './types/reminders'

// Create a new reminder
export async function createReminder(data: CreateReminderRequest): Promise<ReminderWithContext | null> {
  try {
    const response = await fetch('/api/reminders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to create reminder')
    }

    const result = await response.json()
    return result.reminder
  } catch (error) {
    console.error('Error creating reminder:', error)
    throw error
  }
}

// Get user's reminders with filtering and pagination
export async function getReminders(options: ReminderSearchOptions = {}): Promise<ReminderListResponse> {
  try {
    const searchParams = new URLSearchParams()
    
    if (options.searchTerm) searchParams.set('search', options.searchTerm)
    if (options.status && options.status !== 'all') searchParams.set('status', options.status)
    if (options.contact_id) searchParams.set('contact_id', options.contact_id)
    if (options.job_id) searchParams.set('job_id', options.job_id)
    if (options.dateFrom) searchParams.set('date_from', options.dateFrom)
    if (options.dateTo) searchParams.set('date_to', options.dateTo)
    if (options.limit) searchParams.set('limit', options.limit.toString())
    if (options.offset) searchParams.set('offset', options.offset.toString())
    if (options.sortBy) searchParams.set('sort_by', options.sortBy)
    if (options.sortOrder) searchParams.set('sort_order', options.sortOrder)

    const response = await fetch(`/api/reminders?${searchParams.toString()}`)
    
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to fetch reminders')
    }

    const data = await response.json()
    return {
      reminders: data.reminders,
      total: data.total,
      hasMore: data.hasMore
    }
  } catch (error) {
    console.error('Error fetching reminders:', error)
    throw error
  }
}

// Update an existing reminder
export async function updateReminder(id: string, data: UpdateReminderRequest): Promise<ReminderWithContext | null> {
  try {
    const response = await fetch(`/api/reminders/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to update reminder')
    }

    const result = await response.json()
    return result.reminder
  } catch (error) {
    console.error('Error updating reminder:', error)
    throw error
  }
}

// Cancel or delete a reminder
export async function deleteReminder(id: string): Promise<void> {
  try {
    const response = await fetch(`/api/reminders/${id}`, {
      method: 'DELETE'
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to delete reminder')
    }
  } catch (error) {
    console.error('Error deleting reminder:', error)
    throw error
  }
}

// Get reminder statistics
export async function getReminderStats(): Promise<ReminderStatsResponse> {
  try {
    const response = await fetch('/api/reminders/stats')
    
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to fetch reminder statistics')
    }

    return await response.json()
  } catch (error) {
    console.error('Error fetching reminder stats:', error)
    throw error
  }
}

// Get reminders for a specific contact
export async function getContactReminders(contactId: string): Promise<ReminderWithContext[]> {
  try {
    const response = await getReminders({ 
      contact_id: contactId,
      limit: 50 
    })
    return response.reminders
  } catch (error) {
    console.error('Error fetching contact reminders:', error)
    return []
  }
}

// Get reminders for a specific job
export async function getJobReminders(jobId: string): Promise<ReminderWithContext[]> {
  try {
    const response = await getReminders({ 
      job_id: jobId,
      limit: 50 
    })
    return response.reminders
  } catch (error) {
    console.error('Error fetching job reminders:', error)
    return []
  }
}

// Get upcoming reminders (next 7 days)
export async function getUpcomingReminders(): Promise<ReminderWithContext[]> {
  try {
    const now = new Date()
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    
    const response = await getReminders({
      status: 'pending',
      dateFrom: now.toISOString(),
      dateTo: sevenDaysFromNow.toISOString(),
      sortBy: 'scheduled_time',
      sortOrder: 'asc',
      limit: 20
    })
    
    return response.reminders
  } catch (error) {
    console.error('Error fetching upcoming reminders:', error)
    return []
  }
}

// Get overdue reminders
export async function getOverdueReminders(): Promise<ReminderWithContext[]> {
  try {
    const now = new Date()
    
    const response = await getReminders({
      status: 'pending',
      dateTo: now.toISOString(),
      sortBy: 'scheduled_time',
      sortOrder: 'asc',
      limit: 50
    })
    
    return response.reminders
  } catch (error) {
    console.error('Error fetching overdue reminders:', error)
    return []
  }
}

// Utility function to create a quick reminder for a contact
export async function createContactReminder(
  contactId: string,
  scheduledTime: Date,
  timezone: string,
  subject?: string,
  message?: string
): Promise<ReminderWithContext | null> {
  try {
    // Get contact details to generate default subject/message
    const { data: contact, error } = await supabase
      .from('contacts')
      .select('name, company, job_title')
      .eq('id', contactId)
      .single()

    if (error || !contact) {
      throw new Error('Contact not found')
    }

    const defaultSubject = subject || `Follow up with ${contact.name}${contact.company ? ` at ${contact.company}` : ''}`
    const defaultMessage = message || `Hi ${contact.name},\n\nI wanted to follow up on our previous conversation. I'm very interested in ${contact.company ? `opportunities at ${contact.company}` : 'working together'} and would love to discuss next steps.\n\nThanks for your time!\n\nBest regards`

    return await createReminder({
      contact_id: contactId,
      scheduled_time: scheduledTime.toISOString(),
      user_timezone: timezone,
      email_subject: defaultSubject,
      email_body: '', // Will be generated by API
      user_message: defaultMessage
    })
  } catch (error) {
    console.error('Error creating contact reminder:', error)
    throw error
  }
}

// Utility function to create a quick reminder for a job
export async function createJobReminder(
  jobId: string,
  scheduledTime: Date,
  timezone: string,
  subject?: string,
  message?: string
): Promise<ReminderWithContext | null> {
  try {
    // Get job details to generate default subject/message
    const { data: job, error } = await supabase
      .from('jobs')
      .select('job_title, company, location')
      .eq('id', jobId)
      .single()

    if (error || !job) {
      throw new Error('Job not found')
    }

    const defaultSubject = subject || `Follow up on ${job.job_title} position at ${job.company}`
    const defaultMessage = message || `Hi,\n\nI wanted to follow up on my application for the ${job.job_title} position at ${job.company}. I'm very excited about this opportunity and would appreciate any updates on the hiring process.\n\nThank you for your time and consideration.\n\nBest regards`

    return await createReminder({
      job_id: jobId,
      scheduled_time: scheduledTime.toISOString(),
      user_timezone: timezone,
      email_subject: defaultSubject,
      email_body: '', // Will be generated by API
      user_message: defaultMessage
    })
  } catch (error) {
    console.error('Error creating job reminder:', error)
    throw error
  }
}

// Check if user is within rate limits for creating reminders
export async function checkReminderLimits(): Promise<{
  canCreate: boolean
  reason?: string
  activeCount?: number
  dailyCount?: number
}> {
  try {
    // This could be expanded to call a specific API endpoint
    // For now, we'll do a simple check by fetching recent reminders
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    const [activeReminders, todayReminders] = await Promise.all([
      getReminders({ status: 'pending', limit: 101 }), // Check if over 100
      getReminders({ 
        dateFrom: todayStart.toISOString(),
        dateTo: now.toISOString(),
        limit: 16 // Check if over 15
      })
    ])

    if (activeReminders.total >= 100) {
      return {
        canCreate: false,
        reason: 'You have reached the maximum of 100 active reminders',
        activeCount: activeReminders.total
      }
    }

    if (todayReminders.total >= 15) {
      return {
        canCreate: false,
        reason: 'You have reached the daily limit of 15 reminders',
        dailyCount: todayReminders.total
      }
    }

    return {
      canCreate: true,
      activeCount: activeReminders.total,
      dailyCount: todayReminders.total
    }
  } catch (error) {
    console.error('Error checking reminder limits:', error)
    // If we can't check limits, assume they can create (fail open)
    return { canCreate: true }
  }
}

// Bulk operations
export async function bulkCancelReminders(reminderIds: string[]): Promise<{ success: number, failed: number }> {
  let success = 0
  let failed = 0

  for (const id of reminderIds) {
    try {
      await deleteReminder(id)
      success++
    } catch (error) {
      failed++
    }
  }

  return { success, failed }
}

// Get reminder summary for dashboard/reporting
export async function getReminderSummary(): Promise<{
  upcoming: ReminderWithContext[]
  overdue: ReminderWithContext[]
  stats: ReminderStatsResponse
}> {
  try {
    const [upcoming, overdue, stats] = await Promise.all([
      getUpcomingReminders(),
      getOverdueReminders(),
      getReminderStats()
    ])

    return { upcoming, overdue, stats }
  } catch (error) {
    console.error('Error getting reminder summary:', error)
    return {
      upcoming: [],
      overdue: [],
      stats: {
        total: 0,
        pending: 0,
        sent: 0,
        failed: 0,
        cancelled: 0,
        thisMonth: 0,
        thisWeek: 0,
        overdue: 0
      }
    }
  }
}
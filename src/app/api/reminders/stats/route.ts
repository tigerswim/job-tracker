
// src/app/api/reminders/stats/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

// Helper function to get authenticated user (simplified for middleware)
async function getAuthenticatedUser(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({
      cookies: () => cookieStore
    })
    
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error) {
      console.error('Auth error in API route:', error)
      return { user: null, supabase: null, error: error.message }
    }

    if (!user) {
      console.error('No authenticated user found in API route')
      return { user: null, supabase: null, error: 'No authenticated user' }
    }
    
    console.log('User authenticated in API route:', user.id)
    return { user, supabase, error: null }
    
  } catch (error) {
    console.error('Unexpected auth error in API route:', error)
    return { user: null, supabase: null, error: 'Authentication failed' }
  }
}

// GET /api/reminders/stats - Get reminder statistics
export async function GET(request: NextRequest) {
  try {
    console.log('GET /api/reminders/stats - Starting stats request')
    
    const { user, supabase, error: authError } = await getAuthenticatedUser(request)
    
    if (authError || !user || !supabase) {
      console.error('Auth failed:', authError)
      return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 })
    }

    console.log('Authenticated user:', user.id)
    
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay()) // Start of current week
    startOfWeek.setHours(0, 0, 0, 0)

    console.log('Calculating stats for user:', user.id)

    // Get all reminders for this user
    const { data: allReminders, error: fetchError } = await supabase
      .from('email_reminders')
      .select('id, status, scheduled_time, created_at')
      .eq('user_id', user.id)

    if (fetchError) {
      console.error('Database fetch error:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch reminder statistics' }, { status: 500 })
    }

    const reminders = allReminders || []
    console.log(`Found ${reminders.length} total reminders`)

    // Calculate statistics
    const stats = {
      total: reminders.length,
      pending: 0,
      sent: 0,
      failed: 0,
      cancelled: 0,
      thisMonth: 0,
      thisWeek: 0,
      overdue: 0
    }

    reminders.forEach(reminder => {
      // Count by status
      switch (reminder.status) {
        case 'pending':
          stats.pending++
          break
        case 'sent':
          stats.sent++
          break
        case 'failed':
          stats.failed++
          break
        case 'cancelled':
          stats.cancelled++
          break
      }

      // Count this month (based on creation date)
      const createdAt = new Date(reminder.created_at)
      if (createdAt >= startOfMonth) {
        stats.thisMonth++
      }

      // Count this week (based on creation date)
      if (createdAt >= startOfWeek) {
        stats.thisWeek++
      }

      // Count overdue (pending reminders with scheduled time in the past)
      if (reminder.status === 'pending') {
        const scheduledTime = new Date(reminder.scheduled_time)
        if (scheduledTime < now) {
          stats.overdue++
        }
      }
    })

    console.log('Calculated stats:', stats)

    return NextResponse.json(stats)

  } catch (error) {
    console.error('Exception in GET /api/reminders/stats:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}



// src/app/api/reminders/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { REMINDER_VALIDATION } from '@/lib/types/reminders'

// Helper function to get authenticated user
async function getAuthenticatedUser(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    
    // First try to get user from session
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError) {
      console.error('Auth error:', authError)
      return { user: null, error: 'Authentication failed' }
    }
    
    if (!user) {
      // Try to get session from Authorization header
      const authHeader = request.headers.get('Authorization')
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7)
        const { data: { user: tokenUser }, error: tokenError } = await supabase.auth.getUser(token)
        
        if (tokenError) {
          console.error('Token auth error:', tokenError)
          return { user: null, error: 'Invalid token' }
        }
        
        return { user: tokenUser, error: null }
      }
      
      return { user: null, error: 'No authenticated user' }
    }
    
    return { user, error: null }
  } catch (error) {
    console.error('Unexpected auth error:', error)
    return { user: null, error: 'Authentication failed' }
  }
}

// PUT /api/reminders/[id] - Update reminder
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('PUT /api/reminders/[id] - Starting update request')
    
    const { user, error: authError } = await getAuthenticatedUser(request)
    
    if (authError || !user) {
      console.error('Auth failed:', authError)
      return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 })
    }

    console.log('Authenticated user:', user.id)
    
    const supabase = createRouteHandlerClient({ cookies })
    const body = await request.json()
    const reminderId = params.id

    console.log('Update request for reminder:', reminderId, 'by user:', user.id)

    // Validate that the reminder belongs to the user and is still pending
    const { data: existingReminder, error: fetchError } = await supabase
      .from('email_reminders')
      .select('*')
      .eq('id', reminderId)
      .eq('user_id', user.id)
      .single()

    if (fetchError) {
      console.error('Database fetch error:', fetchError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (!existingReminder) {
      console.log('Reminder not found or not owned by user')
      return NextResponse.json({ error: 'Reminder not found' }, { status: 404 })
    }

    if (existingReminder.status !== 'pending') {
      console.log('Cannot edit non-pending reminder')
      return NextResponse.json({ error: 'Cannot edit reminder that is not pending' }, { status: 400 })
    }

    // Validate scheduled time if provided
    if (body.scheduled_time) {
      const scheduledDate = new Date(body.scheduled_time)
      const now = new Date()
      const minDate = new Date(now.getTime() + (REMINDER_VALIDATION.MIN_SCHEDULE_MINUTES * 60 * 1000))
      const maxDate = new Date(now.getTime() + (REMINDER_VALIDATION.MAX_SCHEDULE_MONTHS * 30 * 24 * 60 * 60 * 1000))

      if (scheduledDate < minDate || scheduledDate > maxDate) {
        return NextResponse.json({ 
          error: 'Invalid scheduled time' 
        }, { status: 400 })
      }
    }

    // Prepare update data
    const updateData: any = {}
    
    if (body.scheduled_time) updateData.scheduled_time = body.scheduled_time
    if (body.user_timezone) updateData.user_timezone = body.user_timezone
    if (body.email_subject) updateData.email_subject = body.email_subject
    if (body.user_message) updateData.user_message = body.user_message
    if (body.status) updateData.status = body.status

    // If user_message is updated, regenerate email_body
    if (body.user_message) {
      let emailBody = ''
      
      if (existingReminder.contact_id) {
        const { data: contact } = await supabase
          .from('contacts')
          .select('name, email, company, job_title')
          .eq('id', existingReminder.contact_id)
          .eq('user_id', user.id)
          .single()

        if (contact) {
          emailBody = `Reminder to follow up with ${contact.name}`
          if (contact.company) emailBody += ` at ${contact.company}`
          if (contact.job_title) emailBody += ` (${contact.job_title})`
          emailBody += '.\n\n'
        }
      }

      if (existingReminder.job_id) {
        const { data: job } = await supabase
          .from('jobs')
          .select('job_title, company, location')
          .eq('id', existingReminder.job_id)
          .eq('user_id', user.id)
          .single()

        if (job) {
          if (emailBody) emailBody += 'Related to: '
          emailBody += `${job.job_title} position at ${job.company}`
          if (job.location) emailBody += ` (${job.location})`
          emailBody += '.\n\n'
        }
      }

      emailBody += `Your message:\n${body.user_message}`
      updateData.email_body = emailBody
    }

    console.log('Updating reminder with data:', updateData)

    // Update the reminder
    const { data: updatedReminder, error: updateError } = await supabase
      .from('email_reminders')
      .update(updateData)
      .eq('id', reminderId)
      .eq('user_id', user.id) // Double-check ownership
      .select()
      .single()

    if (updateError) {
      console.error('Error updating reminder:', updateError)
      return NextResponse.json({ error: 'Failed to update reminder' }, { status: 500 })
    }

    console.log('Successfully updated reminder:', updatedReminder.id)
    return NextResponse.json({ reminder: updatedReminder })

  } catch (error) {
    console.error('Exception in PUT /api/reminders/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/reminders/[id] - Cancel/delete reminder
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('DELETE /api/reminders/[id] - Starting delete request')
    
    const { user, error: authError } = await getAuthenticatedUser(request)
    
    if (authError || !user) {
      console.error('Auth failed:', authError)
      return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 })
    }

    console.log('Authenticated user:', user.id)
    
    const supabase = createRouteHandlerClient({ cookies })
    const reminderId = params.id

    console.log('Delete request for reminder:', reminderId, 'by user:', user.id)

    // Check if reminder exists and belongs to user
    const { data: existingReminder, error: fetchError } = await supabase
      .from('email_reminders')
      .select('status')
      .eq('id', reminderId)
      .eq('user_id', user.id)
      .single()

    if (fetchError) {
      console.error('Database fetch error:', fetchError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (!existingReminder) {
      console.log('Reminder not found or not owned by user')
      return NextResponse.json({ error: 'Reminder not found' }, { status: 404 })
    }

    // If reminder is pending, mark as cancelled instead of deleting
    // If already sent/failed, allow deletion for cleanup
    if (existingReminder.status === 'pending') {
      console.log('Cancelling pending reminder')
      const { error: updateError } = await supabase
        .from('email_reminders')
        .update({ status: 'cancelled' })
        .eq('id', reminderId)
        .eq('user_id', user.id) // Double-check ownership

      if (updateError) {
        console.error('Error cancelling reminder:', updateError)
        return NextResponse.json({ error: 'Failed to cancel reminder' }, { status: 500 })
      }

      console.log('Successfully cancelled reminder:', reminderId)
      return NextResponse.json({ message: 'Reminder cancelled successfully' })
    } else {
      console.log('Deleting non-pending reminder')
      // Actually delete non-pending reminders
      const { error: deleteError } = await supabase
        .from('email_reminders')
        .delete()
        .eq('id', reminderId)
        .eq('user_id', user.id) // Double-check ownership

      if (deleteError) {
        console.error('Error deleting reminder:', deleteError)
        return NextResponse.json({ error: 'Failed to delete reminder' }, { status: 500 })
      }

      console.log('Successfully deleted reminder:', reminderId)
      return NextResponse.json({ message: 'Reminder deleted successfully' })
    }

  } catch (error) {
    console.error('Exception in DELETE /api/reminders/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
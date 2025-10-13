// supabase/functions/process-email-reminders/index.ts
// Simplified version using Resend API instead of Gmail API

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface EmailReminder {
  id: string
  user_id: string
  contact_id?: string
  job_id?: string
  scheduled_time: string
  user_timezone: string
  email_subject: string
  email_body: string
  user_message: string
  status: string
  created_at: string
  updated_at: string
}

interface ContactInfo {
  name?: string
  email?: string
  company?: string
  job_title?: string
}

interface JobInfo {
  job_title?: string
  company?: string
  location?: string
}

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Email configuration
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'onboarding@resend.dev'

serve(async (req) => {
  try {
    console.log('🚀 Processing email reminders...')

    // Check if Resend API key is configured
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY not configured')
    }

    // Get pending reminders that are due (within next 5 minutes)
    const now = new Date()
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000)

    console.log(`⏰ Looking for reminders due between now and ${fiveMinutesFromNow.toISOString()}`)

    const { data: pendingReminders, error: fetchError } = await supabase
      .from('email_reminders')  // Query the actual table, not a view
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_time', fiveMinutesFromNow.toISOString())
      .order('scheduled_time', { ascending: true })
      .limit(50) // Process up to 50 reminders per run

    if (fetchError) {
      console.error('❌ Failed to fetch reminders:', fetchError)
      throw new Error(`Failed to fetch reminders: ${fetchError.message}`)
    }

    const reminders = (pendingReminders || []) as EmailReminder[]
    console.log(`📧 Found ${reminders.length} reminders to process`)

    let processedCount = 0
    let errorCount = 0

    // Process each reminder
    for (const reminder of reminders) {
      try {
        console.log(`📤 Processing reminder ${reminder.id}...`)

        // Get user's email address
        const { data: userData, error: userError } = await supabase.auth.admin.getUserById(reminder.user_id)
        
        if (userError || !userData?.user?.email) {
          throw new Error(`Unable to get user email for reminder ${reminder.id}: ${userError?.message}`)
        }

        const userEmail = userData.user.email
        console.log(`👤 Sending to user: ${userEmail}`)

        // Get additional context (contact and job info)
        let contactInfo: ContactInfo = {}
        let jobInfo: JobInfo = {}

        if (reminder.contact_id) {
          const { data: contact } = await supabase
            .from('contacts')
            .select('name, email, company, job_title')
            .eq('id', reminder.contact_id)
            .eq('user_id', reminder.user_id)
            .single()
          
          if (contact) contactInfo = contact
        }

        if (reminder.job_id) {
          const { data: job } = await supabase
            .from('jobs')
            .select('job_title, company, location')
            .eq('id', reminder.job_id)
            .eq('user_id', reminder.user_id)
            .single()
          
          if (job) jobInfo = job
        }

        // Generate email content
        const emailContent = generateEmailContent(reminder, contactInfo, jobInfo)

        // Send email via Resend
        await sendEmail(userEmail, emailContent.subject, emailContent.body)

        // Mark reminder as sent
        const { error: updateError } = await supabase
          .from('email_reminders')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            error_message: null
          })
          .eq('id', reminder.id)

        if (updateError) {
          console.error(`❌ Failed to update reminder ${reminder.id}:`, updateError)
        }

        processedCount++
        console.log(`✅ Successfully sent reminder ${reminder.id}`)

      } catch (error) {
        console.error(`❌ Error processing reminder ${reminder.id}:`, error)
        
        // Mark reminder as failed
        const { error: updateError } = await supabase
          .from('email_reminders')
          .update({
            status: 'failed',
            error_message: error.message
          })
          .eq('id', reminder.id)

        if (updateError) {
          console.error(`❌ Failed to update failed reminder ${reminder.id}:`, updateError)
        }

        errorCount++
      }
    }

    const result = {
      success: true,
      processed: processedCount,
      errors: errorCount,
      total: reminders.length,
      timestamp: new Date().toISOString()
    }

    console.log(`✅ Processing complete:`, result)

    return new Response(
      JSON.stringify(result),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('💥 Error in email processor:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [to],
      subject: subject,
      html: html
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Resend API error: ${response.status} - ${errorText}`)
  }

  const result = await response.json()
  console.log('📧 Email sent successfully:', result.id)
}

function generateEmailContent(
  reminder: EmailReminder, 
  contactInfo: ContactInfo, 
  jobInfo: JobInfo
): { subject: string; body: string } {
  const appUrl = Deno.env.get('APP_URL') || 'https://your-app-domain.com'
  
  let subject = reminder.email_subject
  
  let body = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f9fafb; }
    .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
    .content { padding: 32px 24px; }
    .reminder-info { background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #2563eb; }
    .contact-info { background: #ecfdf5; border-radius: 8px; padding: 16px; margin: 16px 0; }
    .message-box { background: #fffbeb; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #fbbf24; }
    .message-box h3 { color: #92400e; margin: 0 0 12px 0; }
    .links { background: #f1f5f9; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .btn { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 8px 8px 8px 0; }
    .footer { background: #f8fafc; padding: 20px 24px; text-align: center; font-size: 14px; color: #6b7280; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📧 Job Tracker Reminder</h1>
      <p>Time to follow up!</p>
    </div>
    
    <div class="content">
      <p>Hi there! 👋</p>
      
      <p>This is your scheduled reminder from Job Tracker.</p>
      
      <div class="reminder-info">
        <h3>📅 Reminder Details</h3>
        <p><strong>Scheduled for:</strong> ${new Date(reminder.scheduled_time).toLocaleString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          timeZoneName: 'short',
          timeZone: reminder.user_timezone
        })}</p>
  `

  // Add contact information if available
  if (contactInfo.name) {
    body += `
        <div class="contact-info">
          <h4>👤 Contact Information</h4>
          <p><strong>Name:</strong> ${contactInfo.name}</p>`
    
    if (contactInfo.email) {
      body += `<p><strong>Email:</strong> <a href="mailto:${contactInfo.email}">${contactInfo.email}</a></p>`
    }
    
    if (contactInfo.company) {
      body += `<p><strong>Company:</strong> ${contactInfo.company}</p>`
    }

    if (contactInfo.job_title) {
      body += `<p><strong>Title:</strong> ${contactInfo.job_title}</p>`
    }
    
    body += `</div>`
  }

  // Add job information if available
  if (jobInfo.job_title) {
    body += `
        <div class="contact-info">
          <h4>💼 Job Information</h4>
          <p><strong>Position:</strong> ${jobInfo.job_title}</p>`
    
    if (jobInfo.company) {
      body += `<p><strong>Company:</strong> ${jobInfo.company}</p>`
    }
    
    if (jobInfo.location) {
      body += `<p><strong>Location:</strong> ${jobInfo.location}</p>`
    }
    
    body += `</div>`
  }

  // Add user's message
  // … earlier parts of your template builder

  body += `
  ### 🚀 Quick Actions

  <!-- Bulletproof button for Outlook -->
  <!--[if mso]>
  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml"
      href="${jobTrackerUrl}"
      style="height:40px;v-text-anchor:middle;width:160px;"
      arcsize="8%"
      strokecolor="#007bff"
      fillcolor="#007bff">
    <w:anchorlock/>
    <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;">
      Open Job Tracker
    </center>
  </v:roundrect>
  <![endif]-->

  <!-- Standard HTML button fallback -->
  <a
    href="${jobTrackerUrl}"
    style="
      display: inline-block;
      background-color: #007bff;
      color: white !important;
      text-decoration: none;
      padding: 10px 20px;
      border-radius: 4px;
      font-family: Arial, sans-serif;
      font-size: 14px;
      font-weight: bold;
      line-height: 1.2;
    "
  >
    Open Job Tracker
  </a>

  ${reminder.contact_id ? `
  &nbsp;&nbsp;<!--[if mso]>
  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml"
      href="${contactUrl}"
      style="height:40px;v-text-anchor:middle;width:120px;"
      arcsize="8%"
      strokecolor="#28a745"
      fillcolor="#28a745">
    <w:anchorlock/>
    <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;">
      View Contact
    </center>
  </v:roundrect>
  <![endif]-->

  <a
    href="${contactUrl}"
    style="
      display: inline-block;
      background-color: #28a745;
      color: #ffffff !important;
      text-decoration: none;
      padding: 10px 20px;
      border-radius: 4px;
      font-family: Arial, sans-serif;
      font-size: 14px;
      font-weight: bold;
      line-height: 1.2;
    "
  >
    View Contact
  </a>` : ''}

  ${reminder.job_id ? `
  &nbsp;&nbsp;<!--[if mso]>
  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml"
      href="${jobUrl}"
      style="height:40px;v-text-anchor:middle;width:120px;"
      arcsize="8%"
      strokecolor="#17a2b8"
      fillcolor="#17a2b8">
    <w:anchorlock/>
    <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;">
      View Job
    </center>
  </v:roundrect>
  <![endif]-->

  <a
    href="${jobUrl}"
    style="
      display: inline-block;
      background-color: #17a2b8;
      color: #ffffff !important;
      text-decoration: none;
      padding: 10px 20px;
      border-radius: 4px;
      font-family: Arial, sans-serif;
      font-size: 14px;
      font-weight: bold;
      line-height: 1.2;
    "
  >
    View Job
  </a>` : ''}

  Good luck with your follow-up! 🤞
  `;


    
    <div class="footer">
      <p>This reminder was sent by Job Tracker</p>
      <p>You can manage your reminders in the <a href="${appUrl}">Job Tracker app</a></p>
      <p><em>Launch Into a New Role! 🚀</em></p>
    </div>
  </div>
</body>
</html>`

  return { subject, body }
}
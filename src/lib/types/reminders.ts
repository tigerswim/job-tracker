// src/lib/types/reminders.ts - Email Reminder System Types

// Core reminder interface
export interface EmailReminder {
  id: string
  user_id: string
  contact_id?: string | null
  job_id?: string | null
  scheduled_time: string // ISO timestamp
  user_timezone: string
  email_subject: string
  email_body: string
  user_message: string
  status: 'pending' | 'sent' | 'failed' | 'cancelled'
  created_at: string
  sent_at?: string | null
  error_message?: string | null
}

// Alias for backward compatibility with the modal component
export interface Reminder extends EmailReminder {
  type: 'contact' | 'job' | 'general'
}

// Extended reminder interface with related data for display
export interface ReminderWithContext extends EmailReminder {
  contact_name?: string | null
  contact_email?: string | null
  contact_company?: string | null
  contact_job_title?: string | null
  job_title?: string | null
  job_company?: string | null
  job_location?: string | null
}

// Reminder log interface
export interface ReminderLog {
  id: string
  reminder_id: string
  action: 'created' | 'sent' | 'failed' | 'cancelled' | 'edited'
  details: Record<string, any>
  created_at: string
}

// API request/response types
export interface CreateReminderRequest {
  contact_id?: string
  job_id?: string
  scheduled_time: string
  user_timezone: string
  email_subject: string
  email_body: string
  user_message: string
}

export interface UpdateReminderRequest {
  scheduled_time?: string
  user_timezone?: string
  email_subject?: string
  email_body?: string
  user_message?: string
  status?: 'pending' | 'cancelled'
}

export interface ReminderListResponse {
  reminders: ReminderWithContext[]
  total: number
  hasMore: boolean
}

export interface ReminderStatsResponse {
  total: number
  pending: number
  sent: number
  failed: number
  cancelled: number
  thisMonth: number
  thisWeek: number
  overdue: number
}

// Form data interfaces
export interface ReminderFormData {
  type: 'contact' | 'job' | 'general'
  contact_id?: string
  job_id?: string
  scheduled_date: string // YYYY-MM-DD
  scheduled_time: string // HH:MM
  user_timezone: string
  email_subject: string
  user_message: string
}

// Search and filter options
export interface ReminderSearchOptions {
  searchTerm?: string
  status?: string
  contact_id?: string
  job_id?: string
  dateFrom?: string
  dateTo?: string
  limit?: number
  offset?: number
  sortBy?: 'scheduled_time' | 'created_at' | 'contact_name' | 'job_title'
  sortOrder?: 'asc' | 'desc'
}

// Rate limiting response
export interface ReminderLimits {
  active_reminders_count: number
  daily_reminders_count: number
  recent_reminder_minutes: number
  canCreate: boolean
  reason?: string
}

// Email template data
export interface EmailTemplateData {
  user_name?: string
  user_email?: string
  contact_name?: string
  contact_email?: string
  contact_company?: string
  contact_job_title?: string
  job_title?: string
  job_company?: string
  job_location?: string
  user_message: string
  reminder_id: string
  app_url: string
}

// Timezone option for forms
export interface TimezoneOption {
  value: string
  label: string
  offset: string
}

// Common timezone options - you can extend this list
export const COMMON_TIMEZONES: TimezoneOption[] = [
  { value: 'America/New_York', label: 'Eastern Time (ET)', offset: 'UTC-5/-4' },
  { value: 'America/Chicago', label: 'Central Time (CT)', offset: 'UTC-6/-5' },
  { value: 'America/Denver', label: 'Mountain Time (MT)', offset: 'UTC-7/-6' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)', offset: 'UTC-8/-7' },
  { value: 'America/Phoenix', label: 'Arizona Time (MST)', offset: 'UTC-7' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKST)', offset: 'UTC-9/-8' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HST)', offset: 'UTC-10' },
  { value: 'UTC', label: 'Coordinated Universal Time (UTC)', offset: 'UTC+0' },
  { value: 'Europe/London', label: 'London Time (GMT)', offset: 'UTC+0/+1' },
  { value: 'Europe/Paris', label: 'Central European Time (CET)', offset: 'UTC+1/+2' },
  { value: 'Asia/Tokyo', label: 'Japan Standard Time (JST)', offset: 'UTC+9' },
  { value: 'Australia/Sydney', label: 'Australian Eastern Time (AEST)', offset: 'UTC+10/+11' },
]

// Validation rules
export const REMINDER_VALIDATION = {
  EMAIL_SUBJECT_MAX_LENGTH: 255,
  EMAIL_BODY_MAX_LENGTH: 10000,
  USER_MESSAGE_MAX_LENGTH: 5000,
  MAX_ACTIVE_REMINDERS: 100,
  MAX_DAILY_REMINDERS: 15,
  MIN_SCHEDULE_MINUTES: 5, // Minimum 5 minutes from now
  MAX_SCHEDULE_MONTHS: 12, // Maximum 12 months from now
} as const

// Helper functions to derive type from contact_id/job_id
export function getReminderType(reminder: EmailReminder): 'contact' | 'job' | 'general' {
  if (reminder.contact_id) return 'contact'
  if (reminder.job_id) return 'job'
  return 'general'
}

export function reminderToReminderWithType(reminder: EmailReminder): Reminder {
  return {
    ...reminder,
    type: getReminderType(reminder)
  }
}

// Helper type guards
export function isContactReminder(reminder: EmailReminder): reminder is EmailReminder & { contact_id: string } {
  return reminder.contact_id !== null && reminder.contact_id !== undefined
}

export function isJobReminder(reminder: EmailReminder): reminder is EmailReminder & { job_id: string } {
  return reminder.job_id !== null && reminder.job_id !== undefined
}

// Status badge helpers
export function getReminderStatusColor(status: EmailReminder['status']): string {
  switch (status) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    case 'sent':
      return 'bg-green-100 text-green-800 border-green-200'
    case 'failed':
      return 'bg-red-100 text-red-800 border-red-200'
    case 'cancelled':
      return 'bg-gray-100 text-gray-800 border-gray-200'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

export function getReminderStatusText(status: EmailReminder['status']): string {
  switch (status) {
    case 'pending':
      return 'Scheduled'
    case 'sent':
      return 'Sent'
    case 'failed':
      return 'Failed'
    case 'cancelled':
      return 'Cancelled'
    default:
      return status
  }
}

// Date/time helpers
export function formatReminderDate(dateString: string, timezone?: string): string {
  const date = new Date(dateString)
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
    ...(timezone && { timeZone: timezone })
  }
  return date.toLocaleDateString('en-US', options)
}

export function isReminderOverdue(reminder: EmailReminder): boolean {
  return reminder.status === 'pending' && new Date(reminder.scheduled_time) < new Date()
}

export function getTimeUntilReminder(reminder: EmailReminder): string {
  const now = new Date()
  const scheduled = new Date(reminder.scheduled_time)
  const diffMs = scheduled.getTime() - now.getTime()
  
  if (diffMs < 0) {
    return 'Overdue'
  }
  
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
  
  if (days > 0) {
    return `${days}d ${hours}h`
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`
  } else {
    return `${minutes}m`
  }
}
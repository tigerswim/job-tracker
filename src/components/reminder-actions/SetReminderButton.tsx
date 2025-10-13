// src/components/reminder-actions/SetReminderButton.tsx
'use client'

import { useState, useCallback } from 'react'
import { Bell, Plus } from 'lucide-react'
import { Contact, Job } from '@/lib/supabase'
import CreateReminderModal from '../modals/CreateReminderModal'

interface SetReminderButtonProps {
  contact?: Contact
  job?: Job
  variant?: 'button' | 'icon' | 'menu-item'
  size?: 'sm' | 'md'
  onSuccess?: () => void
  className?: string
}

export default function SetReminderButton({
  contact,
  job,
  variant = 'button',
  size = 'md',
  onSuccess,
  className = ''
}: SetReminderButtonProps) {
  const [showModal, setShowModal] = useState(false)

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setShowModal(true)
  }, [])

  const handleSuccess = useCallback(() => {
    setShowModal(false)
    onSuccess?.()
  }, [onSuccess])

  const handleClose = useCallback(() => {
    setShowModal(false)
  }, [])

  if (variant === 'icon') {
    return (
      <>
        <button
          onClick={handleClick}
          className={`p-2 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-lg transition-all duration-200 ${className}`}
          title="Set reminder"
        >
          <Bell className={`${size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'}`} />
        </button>

        {showModal && (
          <CreateReminderModal
            isOpen={showModal}
            onClose={handleClose}
            onSuccess={handleSuccess}
            contact={contact}
            job={job}
          />
        )}
      </>
    )
  }

  if (variant === 'menu-item') {
    return (
      <>
        <button
          onClick={handleClick}
          className={`w-full text-left px-4 py-2 text-sm text-purple-700 hover:bg-purple-50 hover:text-purple-800 flex items-center space-x-2 ${className}`}
        >
          <Bell className="w-4 h-4" />
          <span>Set Reminder</span>
        </button>

        {showModal && (
          <CreateReminderModal
            isOpen={showModal}
            onClose={handleClose}
            onSuccess={handleSuccess}
            contact={contact}
            job={job}
          />
        )}
      </>
    )
  }

  // Default button variant
  return (
    <>
      <button
        onClick={handleClick}
        className={`flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all duration-200 ${
          size === 'sm' ? 'text-sm' : ''
        } ${className}`}
      >
        <Bell className={`${size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'}`} />
        <span>Set Reminder</span>
      </button>

      {showModal && (
        <CreateReminderModal
          isOpen={showModal}
          onClose={handleClose}
          onSuccess={handleSuccess}
          contact={contact}
          job={job}
        />
      )}
    </>
  )
}

// src/components/reminder-actions/QuickReminderDropdown.tsx
'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Bell, Clock, ChevronDown, Calendar } from 'lucide-react'
import { Contact, Job } from '@/lib/supabase'
import { createContactReminder, createJobReminder } from '@/lib/reminders'
import { COMMON_TIMEZONES } from '@/lib/types/reminders'

interface QuickReminderDropdownProps {
  contact?: Contact
  job?: Job
  onSuccess?: () => void
  className?: string
}

export default function QuickReminderDropdown({
  contact,
  job,
  onSuccess,
  className = ''
}: QuickReminderDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Quick reminder options (relative to now)
  const quickOptions = [
    { label: 'In 1 hour', hours: 1 },
    { label: 'Tomorrow 9 AM', hours: null, time: '09:00' },
    { label: 'In 1 week', days: 7 },
    { label: 'In 2 weeks', days: 14 }
  ]

  const handleQuickReminder = useCallback(async (option: typeof quickOptions[0]) => {
    if (isCreating) return

    setIsCreating(true)

    try {
      // Calculate the scheduled time
      let scheduledTime: Date

      if (option.hours) {
        scheduledTime = new Date(Date.now() + option.hours * 60 * 60 * 1000)
      } else if (option.days) {
        scheduledTime = new Date(Date.now() + option.days * 24 * 60 * 60 * 1000)
      } else if (option.time) {
        // Tomorrow at specific time
        scheduledTime = new Date()
        scheduledTime.setDate(scheduledTime.getDate() + 1)
        const [hours, minutes] = option.time.split(':')
        scheduledTime.setHours(parseInt(hours), parseInt(minutes), 0, 0)
      } else {
        throw new Error('Invalid quick option')
      }

      // Get user's timezone
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York'

      // Create the reminder
      if (contact) {
        await createContactReminder(contact.id, scheduledTime, userTimezone)
      } else if (job) {
        await createJobReminder(job.id, scheduledTime, userTimezone)
      }

      setIsOpen(false)
      onSuccess?.()

      // Show success toast (you can customize this)
      // toast.success('Reminder scheduled successfully!')

    } catch (error) {
      console.error('Error creating quick reminder:', error)
      // toast.error('Failed to create reminder')
    } finally {
      setIsCreating(false)
    }
  }, [contact, job, onSuccess, isCreating])

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isCreating}
        className="flex items-center space-x-1 px-3 py-2 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded-lg transition-all duration-200 disabled:opacity-50"
      >
        <Bell className="w-4 h-4" />
        <span className="text-sm">Quick Remind</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
          <div className="py-2">
            {quickOptions.map((option, index) => (
              <button
                key={index}
                onClick={() => handleQuickReminder(option)}
                disabled={isCreating}
                className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50 flex items-center space-x-2"
              >
                <Clock className="w-4 h-4 text-slate-500" />
                <span>{option.label}</span>
              </button>
            ))}
            
            <div className="border-t border-slate-200 my-1"></div>
            
            {/* Custom reminder option */}
            <button
              onClick={() => {
                setIsOpen(false)
                // This would open the full CreateReminderModal
                // You could emit an event or use a callback for this
              }}
              className="w-full text-left px-4 py-2 text-sm text-purple-700 hover:bg-purple-50 flex items-center space-x-2"
            >
              <Calendar className="w-4 h-4" />
              <span>Custom time...</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// src/components/reminder-actions/RemindersList.tsx
// Mini component to show existing reminders for a contact/job
'use client'

import { useState, useEffect } from 'react'
import { Bell, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import { ReminderWithContext } from '@/lib/types/reminders'
import { getContactReminders, getJobReminders } from '@/lib/reminders'
import { 
  formatReminderDate, 
  getReminderStatusText, 
  getReminderStatusColor,
  isReminderOverdue,
  getTimeUntilReminder
} from '@/lib/types/reminders'

interface RemindersListProps {
  contactId?: string
  jobId?: string
  compact?: boolean
  showCreateButton?: boolean
  onCreateClick?: () => void
}

export default function RemindersList({
  contactId,
  jobId,
  compact = false,
  showCreateButton = false,
  onCreateClick
}: RemindersListProps) {
  const [reminders, setReminders] = useState<ReminderWithContext[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadReminders = async () => {
      try {
        let data: ReminderWithContext[] = []
        
        if (contactId) {
          data = await getContactReminders(contactId)
        } else if (jobId) {
          data = await getJobReminders(jobId)
        }
        
        setReminders(data)
      } catch (error) {
        console.error('Error loading reminders:', error)
      } finally {
        setLoading(false)
      }
    }

    if (contactId || jobId) {
      loadReminders()
    }
  }, [contactId, jobId])

  if (loading) {
    return (
      <div className="flex items-center space-x-2 text-slate-500">
        <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin"></div>
        <span className="text-sm">Loading reminders...</span>
      </div>
    )
  }

  if (reminders.length === 0) {
    return showCreateButton ? (
      <div className="text-center py-4">
        <Bell className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <p className="text-sm text-slate-500 mb-3">No reminders set</p>
        <button
          onClick={onCreateClick}
          className="text-sm text-purple-600 hover:text-purple-800 underline"
        >
          Create your first reminder
        </button>
      </div>
    ) : (
      <p className="text-sm text-slate-500">No reminders set</p>
    )
  }

  if (compact) {
    return (
      <div className="space-y-2">
        {reminders.slice(0, 3).map((reminder) => (
          <div key={reminder.id} className="flex items-center space-x-2 text-sm">
            <Bell className="w-3 h-3 text-slate-400 flex-shrink-0" />
            <span className="text-slate-600 truncate">{reminder.email_subject}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs ${getReminderStatusColor(reminder.status)}`}>
              {getReminderStatusText(reminder.status)}
            </span>
          </div>
        ))}
        {reminders.length > 3 && (
          <p className="text-xs text-slate-500">+{reminders.length - 3} more</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {reminders.map((reminder) => (
        <div key={reminder.id} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
          <div className="flex items-start justify-between mb-2">
            <h4 className="font-medium text-slate-800 text-sm">{reminder.email_subject}</h4>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getReminderStatusColor(reminder.status)}`}>
              {reminder.status === 'pending' && isReminderOverdue(reminder) && (
                <AlertTriangle className="w-3 h-3 inline mr-1" />
              )}
              {getReminderStatusText(reminder.status)}
            </span>
          </div>
          
          <div className="text-xs text-slate-600 space-y-1">
            <div className="flex items-center space-x-1">
              <Clock className="w-3 h-3" />
              <span>
                {formatReminderDate(reminder.scheduled_time, reminder.user_timezone)}
              </span>
            </div>
            
            {reminder.status === 'pending' && (
              <div className={`flex items-center space-x-1 ${
                isReminderOverdue(reminder) ? 'text-red-600' : 'text-slate-500'
              }`}>
                <span>{getTimeUntilReminder(reminder)}</span>
              </div>
            )}
            
            {reminder.sent_at && (
              <div className="flex items-center space-x-1 text-green-600">
                <CheckCircle className="w-3 h-3" />
                <span>Sent: {formatReminderDate(reminder.sent_at, reminder.user_timezone)}</span>
              </div>
            )}
          </div>
        </div>
      ))}
      
      {showCreateButton && (
        <button
          onClick={onCreateClick}
          className="w-full py-2 text-sm text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-lg transition-colors border border-dashed border-purple-300 hover:border-purple-400"
        >
          + Add Another Reminder
        </button>
      )}
    </div>
  )
}
// src/components/modals/CreateReminderModal.tsx
'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { X, Calendar, Clock, User, Briefcase, Mail, MessageSquare, AlertCircle, Check, Search } from 'lucide-react'
import { Contact, Job } from '@/lib/supabase'
import { 
  ReminderFormData, 
  COMMON_TIMEZONES, 
  REMINDER_VALIDATION,
  CreateReminderRequest, 
  Reminder,
} from '@/lib/types/reminders'

interface CreateReminderModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  contact?: Contact | null
  job?: Job | null
  contacts?: Contact[]
  jobs?: Job[]
  editingReminder?: Reminder | null // Fixed prop name to match usage
  isEditing?: boolean // Add this prop to indicate edit mode
  prefilledContact?: Contact  // New optional prop
  prefilledJob?: Job         // New optional prop
}

export default function CreateReminderModal({
  isOpen,
  onClose,
  onSuccess,
  contact,
  job,
  contacts = [],
  jobs = [],
  editingReminder,
  isEditing = false,
  prefilledContact,  // Add this
  prefilledJob       // Add this
}: CreateReminderModalProps) {
  const [formData, setFormData] = useState<ReminderFormData>({
    type: 'contact',
    contact_id: contact?.id || '',
    job_id: job?.id || '',
    scheduled_date: '',
    scheduled_time: '',
    user_timezone: 'America/New_York', // Default timezone
    email_subject: '',
    user_message: ''
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showSuccess, setShowSuccess] = useState(false)
  
  // Fix: Define isEditing based on editingReminder prop
  const isEditingMode = !!editingReminder || isEditing

  // Search dropdown states
  const [contactSearchTerm, setContactSearchTerm] = useState('')
  const [jobSearchTerm, setJobSearchTerm] = useState('')
  const [showContactDropdown, setShowContactDropdown] = useState(false)
  const [showJobDropdown, setShowJobDropdown] = useState(false)

  // Initialize form data based on props
  useEffect(() => {
    if (editingReminder) {
      // Parse the scheduled_time to get date and time components
      const scheduledDateTime = new Date(editingReminder.scheduled_time)
      const dateStr = scheduledDateTime.toISOString().split('T')[0]
      const timeStr = scheduledDateTime.toTimeString().slice(0, 5)

      setFormData({
        type: editingReminder.type || 'contact',
        contact_id: editingReminder.contact_id || '',
        job_id: editingReminder.job_id || '',
        scheduled_date: dateStr,
        scheduled_time: timeStr,
        user_timezone: editingReminder.user_timezone || 'America/New_York',
        email_subject: editingReminder.email_subject || '',
        user_message: editingReminder.user_message || ''
      })

      // Set search terms for display
      if (editingReminder.contact_id && contacts.length > 0) {
        const reminderContact = contacts.find(c => c.id === editingReminder.contact_id)
        if (reminderContact) {
          setContactSearchTerm(reminderContact.name)
        }
      }

      if (editingReminder.job_id && jobs.length > 0) {
        const reminderJob = jobs.find(j => j.id === editingReminder.job_id)
        if (reminderJob) {
          setJobSearchTerm(`${reminderJob.job_title} at ${reminderJob.company}`)
        }
      }
    } else if (contact) {
      // Handle new reminder with contact
      setFormData(prev => ({
        ...prev,
        type: 'contact',
        contact_id: contact.id,
        job_id: '',
        email_subject: `Follow up with ${contact.name}${contact.company ? ` at ${contact.company}` : ''}`,
        user_message: `Hi,\n\nBe sure to follow up and discuss next steps.\n\nBest regards,\n\nJob Tracker`
      }))
      setContactSearchTerm(contact.name)
    } else if (job) {
      // Handle new reminder with job
      setFormData(prev => ({
        ...prev,
        type: 'job',
        contact_id: '',
        job_id: job.id,
        email_subject: `Follow up on ${job.job_title} position at ${job.company}`,
        user_message: `Hi,\n\nDon't forget to check in on this role!\n\nBest regards\n\n,Job Tracker `
      }))
      setJobSearchTerm(`${job.job_title} at ${job.company}`)
    } else if (prefilledContact && !editingReminder) {
      // Handle new reminder with prefilled contact
      setFormData(prev => ({
        ...prev,
        type: 'contact',
        contact_id: prefilledContact.id,
        job_id: '',
        email_subject: `Follow up with ${prefilledContact.name}${prefilledContact.company ? ` at ${prefilledContact.company}` : ''}`,
        user_message: `Hi,\nDon't forget to check in with ${prefilledContact.name}!\n\nBest regards,\nJob Tracker`
      }))
      setContactSearchTerm(prefilledContact.name)
    } else if (prefilledJob && !editingReminder) {
      // Handle new reminder with prefilled job
      setFormData(prev => ({
        ...prev,
        type: 'job',
        contact_id: '',
        job_id: prefilledJob.id,
        email_subject: `Follow up on ${prefilledJob.job_title} position at ${prefilledJob.company}`,
        user_message: `Hi,\nDon't forget to follow up on the ${prefilledJob.job_title} role at ${prefilledJob.company}.\n\nBest regards,\nJob Tracker`
      }))
      setJobSearchTerm(`${prefilledJob.job_title} at ${prefilledJob.company}`)
    }
  }, [editingReminder, contact, job, prefilledContact, prefilledJob, contacts, jobs])

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFormData({
        type: 'contact',
        contact_id: contact?.id || prefilledContact?.id || '',
        job_id: job?.id || prefilledJob?.id || '',
        scheduled_date: '',
        scheduled_time: '',
        user_timezone: 'America/New_York',
        email_subject: '',
        user_message: ''
      })
      setShowSuccess(false)
      setErrors({})
      setContactSearchTerm('')
      setJobSearchTerm('')
    }
  }, [isOpen, contact?.id, job?.id, prefilledContact?.id, prefilledJob?.id])

  // Set minimum date/time to 5 minutes from now (only for new reminders)
  const minDateTime = useMemo(() => {
    if (isEditingMode) {
      // For editing, allow past dates (in case they want to reschedule to past for some reason)
      return {
        date: '',
        time: ''
      }
    }
    
    const now = new Date()
    const fiveMinutesFromNow = new Date(now.getTime() + REMINDER_VALIDATION.MIN_SCHEDULE_MINUTES * 60 * 1000)
    return {
      date: fiveMinutesFromNow.toISOString().split('T')[0],
      time: fiveMinutesFromNow.toTimeString().slice(0, 5)
    }
  }, [isEditingMode]) // Fixed: Added closing brace and dependency array

  // Auto-detect user timezone (only for new reminders)
  useEffect(() => {
    if (!isEditingMode) {
      try {
        const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
        if (COMMON_TIMEZONES.find(tz => tz.value === userTimezone)) {
          setFormData(prev => ({ ...prev, user_timezone: userTimezone }))
        }
      } catch (error) {
        console.log('Could not detect timezone, using default')
      }
    }
  }, [isEditingMode])

  // Reuse the exact search logic from ContactList.tsx
  const filteredContacts = useMemo(() => {
    if (!contactSearchTerm.trim()) return contacts

    const term = contactSearchTerm.toLowerCase()
    return contacts.filter(contact => {
      // Basic fields - SAFE pattern for all fields
      const basicMatch =
        (contact.name || '').toLowerCase().includes(term) ||
        (contact.company || '').toLowerCase().includes(term) ||
        (contact.email || '').toLowerCase().includes(term) ||
        (contact.job_title || '').toLowerCase().includes(term) ||
        (contact.notes || '').toLowerCase().includes(term)

      // Experience search - all props checked
      const experienceMatch = contact.experience?.some(exp =>
        (exp.company || '').toLowerCase().includes(term) ||
        (exp.title || '').toLowerCase().includes(term) ||
        (exp.description || '').toLowerCase().includes(term)
      )

      // Education search - all props checked
      const educationMatch = contact.education?.some(edu =>
        (edu.institution || '').toLowerCase().includes(term) ||
        (edu.degree_and_field || '').toLowerCase().includes(term) ||
        (edu.notes || '').toLowerCase().includes(term)
      )

      // Mutual connections search - all connections checked
      const connectionMatch = contact.mutual_connections?.some(conn =>
        (conn || '').toLowerCase().includes(term)
      )

      return basicMatch || experienceMatch || educationMatch || connectionMatch
    })

  }, [contacts, contactSearchTerm])

  // Reuse the exact search logic from JobList.tsx
  const filteredJobs = useMemo(() => {
    if (!jobSearchTerm.trim()) return jobs

    const term = jobSearchTerm.toLowerCase()
    return jobs.filter(job =>
      job.company?.toLowerCase().includes(term) ||
      job.job_title?.toLowerCase().includes(term) ||
      job.notes?.toLowerCase().includes(term) ||
      job.location?.toLowerCase().includes(term)
    )
  }, [jobs, jobSearchTerm])

  // Handle form field changes
  const handleFieldChange = useCallback((field: keyof ReminderFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
    
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }, [errors])

  // Handle type change
  const handleTypeChange = useCallback((type: 'contact' | 'job' | 'general') => {
    setFormData(prev => ({
      ...prev,
      type,
      contact_id: type === 'contact' ? prev.contact_id : '',
      job_id: type === 'job' ? prev.job_id : ''
    }))
  }, [])

  // Validation
  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.scheduled_date) {
      newErrors.scheduled_date = 'Date is required'
    }

    if (!formData.scheduled_time) {
      newErrors.scheduled_time = 'Time is required'
    }

    if (formData.scheduled_date && formData.scheduled_time) {
      const scheduledDateTime = new Date(`${formData.scheduled_date}T${formData.scheduled_time}`)
      const now = new Date()
      const minTime = new Date(now.getTime() + REMINDER_VALIDATION.MIN_SCHEDULE_MINUTES * 60 * 1000)
      const maxTime = new Date(now.getTime() + REMINDER_VALIDATION.MAX_SCHEDULE_MONTHS * 30 * 24 * 60 * 60 * 1000)

      if (!isEditingMode && scheduledDateTime < minTime) {
        newErrors.scheduled_time = `Must be at least ${REMINDER_VALIDATION.MIN_SCHEDULE_MINUTES} minutes from now`
      }

      if (scheduledDateTime > maxTime) {
        newErrors.scheduled_date = `Cannot be more than ${REMINDER_VALIDATION.MAX_SCHEDULE_MONTHS} months from now`
      }
    }

    if (!formData.email_subject.trim()) {
      newErrors.email_subject = 'Subject is required'
    } else if (formData.email_subject.length > REMINDER_VALIDATION.EMAIL_SUBJECT_MAX_LENGTH) {
      newErrors.email_subject = `Subject too long (max ${REMINDER_VALIDATION.EMAIL_SUBJECT_MAX_LENGTH} characters)`
    }

    if (!formData.user_message.trim()) {
      newErrors.user_message = 'Message is required'
    } else if (formData.user_message.length > REMINDER_VALIDATION.USER_MESSAGE_MAX_LENGTH) {
      newErrors.user_message = `Message too long (max ${REMINDER_VALIDATION.USER_MESSAGE_MAX_LENGTH} characters)`
    }

    if (formData.type === 'contact' && !formData.contact_id) {
      newErrors.contact_id = 'Please select a contact'
    }

    if (formData.type === 'job' && !formData.job_id) {
      newErrors.job_id = 'Please select a job'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [formData, isEditingMode])

  // Handle modal close
  const handleClose = useCallback(() => {
    if (!isSubmitting) {
      onClose()
    }
  }, [isSubmitting, onClose])

  // ESC key handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, isSubmitting, onClose])

  // Click outside handlers to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.dropdown-container')) {
        setShowContactDropdown(false)
        setShowJobDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      // Combine date and time into ISO timestamp
      const scheduledDateTime = new Date(`${formData.scheduled_date}T${formData.scheduled_time}`)
      
      const requestData: CreateReminderRequest = {
        scheduled_time: scheduledDateTime.toISOString(),
        user_timezone: formData.user_timezone,
        email_subject: formData.email_subject.trim(),
        email_body: '', // This will be generated by the API
        user_message: formData.user_message.trim()
      }

      if (formData.contact_id) {
        requestData.contact_id = formData.contact_id
      }

      if (formData.job_id) {
        requestData.job_id = formData.job_id
      }

      // Use different endpoints for create vs update
      const url = isEditingMode && editingReminder 
        ? `/api/reminders/${editingReminder.id}` 
        : '/api/reminders'
      
      const method = isEditingMode ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || `Failed to ${isEditingMode ? 'update' : 'create'} reminder`)
      }

      // Show success state
      setShowSuccess(true)
      setTimeout(() => {
        setShowSuccess(false)
        onSuccess()
        onClose()
        // Reset form only if not editing
        if (!isEditingMode) {
          setFormData({
            type: 'contact',
            contact_id: '',
            job_id: '',
            scheduled_date: '',
            scheduled_time: '',
            user_timezone: formData.user_timezone, // Keep timezone
            email_subject: '',
            user_message: ''
          })
          setContactSearchTerm('')
          setJobSearchTerm('')
        }
      }, 1500)

    } catch (error) {
      console.error(`Error ${isEditingMode ? 'updating' : 'creating'} reminder:`, error)
      setErrors({ submit: error instanceof Error ? error.message : `Failed to ${isEditingMode ? 'update' : 'create'} reminder` })
    } finally {
      setIsSubmitting(false)
    }
  }, [formData, validateForm, onSuccess, onClose, isEditingMode, editingReminder])

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center p-4 z-50"
      style={{ paddingTop: '2rem' }}
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-8 py-6 text-white">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                {showSuccess ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <Mail className="w-5 h-5" />
                )}
              </div>
              <div>
                <h2 className="text-xl font-bold">
                  {showSuccess ? 
                    `Reminder ${isEditingMode ? 'Updated' : 'Created'}!` : 
                    `${isEditingMode ? 'Edit' : 'Schedule'} Email Reminder`
                  }
                </h2>
                <p className="text-purple-100 text-sm">
                  {showSuccess 
                    ? `Your reminder has been ${isEditingMode ? 'updated' : 'scheduled'} successfully`
                    : `${isEditingMode ? 'Update your reminder' : 'Get reminded to follow up at the perfect time'}`
                  }
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-all duration-200 disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Success State */}
        {showSuccess ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">
              Reminder {isEditingMode ? 'Updated' : 'Scheduled'}!
            </h3>
            <p className="text-slate-600">
              {isEditingMode 
                ? 'Your reminder has been updated successfully.'
                : "You'll receive an email reminder at the scheduled time with your message ready to copy and send."
              }
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-8 overflow-y-auto max-h-[calc(90vh-120px)] custom-scrollbar">
            <div className="space-y-6">
              {/* Error Alert */}
              {errors.submit && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-2">
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="text-red-800 font-medium">Error</h4>
                    <p className="text-red-700 text-sm mt-1">{errors.submit}</p>
                  </div>
                </div>
              )}

              {/* Reminder Type Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-3">
                  Reminder Type
                </label>
                <div className="flex space-x-4">
                  <button
                    type="button"
                    onClick={() => handleTypeChange('contact')}
                    disabled={!!contact || !!prefilledContact || isEditingMode}
                    className={`flex-1 p-4 rounded-lg border-2 transition-all duration-200 ${
                      formData.type === 'contact'
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                    } ${(contact || prefilledContact || isEditingMode) ? 'opacity-75' : ''}`}
                  >
                    <User className="w-5 h-5 mx-auto mb-2 text-slate-600" />
                    <div className="text-sm font-medium text-slate-800">Contact</div>
                    <div className="text-xs text-slate-500">Follow up with a contact</div>
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => handleTypeChange('job')}
                    disabled={!!job || !!prefilledJob || isEditingMode}
                    className={`flex-1 p-4 rounded-lg border-2 transition-all duration-200 ${
                      formData.type === 'job'
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                    } ${(job || prefilledJob || isEditingMode) ? 'opacity-75' : ''}`}
                  >
                    <Briefcase className="w-5 h-5 mx-auto mb-2 text-slate-600" />
                    <div className="text-sm font-medium text-slate-800">Job Application</div>
                    <div className="text-xs text-slate-500">Follow up on a job</div>
                  </button>
                </div>
              </div>

              {/* Contact Selection with Search */}
              {formData.type === 'contact' && (
                <div className="relative dropdown-container">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Select Contact
                  </label>
                  
                  {/* Search Input */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Search contacts by name, company, email..."
                      value={contactSearchTerm}
                      onChange={(e) => setContactSearchTerm(e.target.value)}
                      onFocus={() => setShowContactDropdown(true)}
                      disabled={!!contact || !!prefilledContact}
                      className={`input pl-10 w-full ${errors.contact_id ? 'border-red-300' : ''}`}
                    />
                    {contactSearchTerm && !contact && !prefilledContact && (
                      <button
                        type="button"
                        onClick={() => {
                          setContactSearchTerm('')
                          handleFieldChange('contact_id', '')
                        }}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Dropdown Results */}
                  {showContactDropdown && !contact && !prefilledContact && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                      {filteredContacts.length === 0 ? (
                        <div className="p-4 text-center text-slate-500 text-sm">
                          {contactSearchTerm ? 'No matching contacts found' : 'No contacts available'}
                        </div>
                      ) : (
                        filteredContacts.slice(0, 10).map(contact => (
                          <button
                            key={contact.id}
                            type="button"
                            onClick={() => {
                              handleFieldChange('contact_id', contact.id)
                              setContactSearchTerm(contact.name)
                              setShowContactDropdown(false)
                            }}
                            className="w-full text-left px-4 py-3 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors"
                          >
                            <div className="font-medium text-slate-900">{contact.name}</div>
                            {contact.company && (
                              <div className="text-sm text-slate-600">
                                {contact.company}{contact.job_title ? ` • ${contact.job_title}` : ''}
                              </div>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                  
                  {errors.contact_id && (
                    <p className="text-red-600 text-sm mt-1">{errors.contact_id}</p>
                  )}
                </div>
              )}

              {/* Job Selection with Search */}
              {formData.type === 'job' && (
                <div className="relative dropdown-container">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Select Job Application
                  </label>
                  
                  {/* Search Input */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Search jobs by company, title, or location..."
                      value={jobSearchTerm}
                      onChange={(e) => setJobSearchTerm(e.target.value)}
                      onFocus={() => setShowJobDropdown(true)}
                      disabled={!!job || !!prefilledJob}
                      className={`input pl-10 w-full ${errors.job_id ? 'border-red-300' : ''}`}
                    />
                    {jobSearchTerm && !job && !prefilledJob && (
                      <button
                        type="button"
                        onClick={() => {
                          setJobSearchTerm('')
                          handleFieldChange('job_id', '')
                        }}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Dropdown Results */}
                  {showJobDropdown && !job && !prefilledJob && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                      {filteredJobs.length === 0 ? (
                        <div className="p-4 text-center text-slate-500 text-sm">
                          {jobSearchTerm ? 'No matching jobs found' : 'No job applications available'}
                        </div>
                      ) : (
                        filteredJobs.slice(0, 10).map(job => (
                          <button
                            key={job.id}
                            type="button"
                            onClick={() => {
                              handleFieldChange('job_id', job.id)
                              setJobSearchTerm(`${job.job_title} at ${job.company}`)
                              setShowJobDropdown(false)
                            }}
                            className="w-full text-left px-4 py-3 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors"
                          >
                            <div className="font-medium text-slate-900">{job.job_title}</div>
                            <div className="text-sm text-slate-600">
                              {job.company}{job.location ? ` • ${job.location}` : ''}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                  
                  {errors.job_id && (
                    <p className="text-red-600 text-sm mt-1">{errors.job_id}</p>
                  )}
                </div>
              )}

              {/* Schedule Date & Time */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Date
                  </label>
                  <input
                    type="date"
                    value={formData.scheduled_date}
                    onChange={(e) => handleFieldChange('scheduled_date', e.target.value)}
                    min={minDateTime.date}
                    className={`input w-full ${errors.scheduled_date ? 'border-red-300' : ''}`}
                  />
                  {errors.scheduled_date && (
                    <p className="text-red-600 text-sm mt-1">{errors.scheduled_date}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    <Clock className="w-4 h-4 inline mr-1" />
                    Time
                  </label>
                  <input
                    type="time"
                    value={formData.scheduled_time}
                    onChange={(e) => handleFieldChange('scheduled_time', e.target.value)}
                    className={`input w-full ${errors.scheduled_time ? 'border-red-300' : ''}`}
                  />
                  {errors.scheduled_time && (
                    <p className="text-red-600 text-sm mt-1">{errors.scheduled_time}</p>
                  )}
                </div>
              </div>

              {/* Timezone */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Timezone
                </label>
                <select
                  value={formData.user_timezone}
                  onChange={(e) => handleFieldChange('user_timezone', e.target.value)}
                  className="input w-full"
                >
                  {COMMON_TIMEZONES.map(tz => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label} ({tz.offset})
                    </option>
                  ))}
                </select>
              </div>

              {/* Email Subject */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Email Subject
                </label>
                <input
                  type="text"
                  value={formData.email_subject}
                  onChange={(e) => handleFieldChange('email_subject', e.target.value)}
                  placeholder="Follow up with..."
                  maxLength={REMINDER_VALIDATION.EMAIL_SUBJECT_MAX_LENGTH}
                  className={`input w-full ${errors.email_subject ? 'border-red-300' : ''}`}
                />
                <div className="flex justify-between items-center mt-1">
                  {errors.email_subject ? (
                    <p className="text-red-600 text-sm">{errors.email_subject}</p>
                  ) : (
                    <div />
                  )}
                  <p className="text-slate-400 text-sm">
                    {formData.email_subject.length}/{REMINDER_VALIDATION.EMAIL_SUBJECT_MAX_LENGTH}
                  </p>
                </div>
              </div>

              {/* User Message */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  <MessageSquare className="w-4 h-4 inline mr-1" />
                  Your Message
                  <span className="text-slate-500 font-normal ml-2">(This will be ready to copy in your reminder email)</span>
                </label>
                <textarea
                  value={formData.user_message}
                  onChange={(e) => handleFieldChange('user_message', e.target.value)}
                  placeholder="Hi [Name],&#10;&#10;I wanted to follow up on..."
                  rows={6}
                  maxLength={REMINDER_VALIDATION.USER_MESSAGE_MAX_LENGTH}
                  className={`input w-full resize-none ${errors.user_message ? 'border-red-300' : ''}`}
                />
                <div className="flex justify-between items-center mt-1">
                  {errors.user_message ? (
                    <p className="text-red-600 text-sm">{errors.user_message}</p>
                  ) : (
                    <div />
                  )}
                  <p className="text-slate-400 text-sm">
                    {formData.user_message.length}/{REMINDER_VALIDATION.USER_MESSAGE_MAX_LENGTH}
                  </p>
                </div>
              </div>
            
              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="px-6 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center space-x-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>{isEditingMode ? 'Updating...' : 'Creating...'}</span>
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      <span>{isEditingMode ? 'Update Reminder' : 'Schedule Reminder'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div> 
    </div> 
  )
}
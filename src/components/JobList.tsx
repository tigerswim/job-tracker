// src/components/JobList.tsx - Added Reminder Button
'use client'

import { useState, useEffect, useMemo, useRef, useCallback, memo } from 'react'
import { Job, Contact } from '@/lib/supabase'
import { fetchJobsWithContacts, deleteJob, JobWithContacts, clearJobsCache } from '@/lib/jobs'
import {
  Users, Plus, Search, Filter, Briefcase, MapPin, DollarSign, Edit, Trash2, X, User, MoreVertical, ChevronDown, ChevronRight, FileText, ChevronUp, ArrowUpDown, Mail, Phone, Linkedin, ExternalLink, GraduationCap, Bell
} from 'lucide-react'
import JobForm from './JobForm'
import JobContactManager from './JobContactManager'
import JobContactLinks from './JobContactLinks'
import ContactForm from './ContactForm'
import ContactJobLinks from './ContactJobLinks'
import CreateReminderModal from './modals/CreateReminderModal'

// Types
interface JobListState {
  jobs: JobWithContacts[]
  loading: boolean
  error: string | null
}

type SortField = 'job_title' | 'company' | 'status' | 'location' | 'salary' | 'created_at' | 'updated_at'
type SortDirection = 'asc' | 'desc'

interface SortConfig {
  field: SortField | null
  direction: SortDirection
}

// Enhanced Contact Modal Component - matches JobContactManager styling
const ContactModal = memo(({ 
  contact, 
  onClose, 
  onEdit 
}: { 
  contact: Contact
  onClose: () => void
  onEdit?: (contact: Contact) => void
}) => {
  // Memoized close handler
  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  // Edit handler
  const handleEdit = useCallback(() => {
    if (onEdit) {
      onEdit(contact)
    }
  }, [onEdit, contact])

  // ESC key handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose()
    }
  }, [handleClose])

  // Click outside to close
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose()
    }
  }, [handleClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Helper function to format experience dates
  const formatExperienceDate = (dateString: string | undefined | null) => {
    if (!dateString) return ''
    
    const parts = dateString.split('-')
    if (parts.length === 2) {
      const year = parts[0]
      const month = parts[1]
      
      if (year && month) {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                           'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        const monthIndex = parseInt(month) - 1
        return `${monthNames[monthIndex]} ${year}`
      } else if (year) {
        return year
      }
    }
    return dateString
  }

  // Helper function to format education date
  const formatEducationDate = (dateString: string | undefined | null) => {
    return formatExperienceDate(dateString)
  }

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center p-4 z-50"
      style={{ paddingTop: '2rem' }}
      onClick={handleBackdropClick}
    >
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6 text-white">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold">{contact.name}</h2>
                <p className="text-blue-100 text-sm">
                  {contact.job_title && contact.company 
                    ? `${contact.job_title} at ${contact.company}` 
                    : contact.job_title || contact.company || 'Professional Contact'
                  }
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {onEdit && (
                <button
                  type="button"
                  onClick={handleEdit}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-all duration-200 flex items-center space-x-2"
                >
                  <Edit className="w-4 h-4" />
                  <span>Edit Contact</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-all duration-200"
              >
                Close
              </button>
              <button
                onClick={handleClose}
                className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-all duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto max-h-[calc(90vh-120px)] custom-scrollbar">
          <div className="space-y-8">
            
            {/* Contact Information */}
            <div>
              <div className="flex items-center space-x-2 text-slate-700 border-b border-slate-200 pb-3 mb-4">
                <User className="w-5 h-5" />
                <h3 className="font-semibold">Contact Information</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {contact.email && (
                  <div className="bg-slate-50 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <Mail className="w-4 h-4 text-slate-600" />
                      <span className="text-sm font-medium text-slate-600 uppercase tracking-wider">Email</span>
                    </div>
                    <a 
                      href={`mailto:${contact.email}`}
                      className="text-blue-600 hover:text-blue-800 hover:underline transition-colors font-medium"
                    >
                      {contact.email}
                    </a>
                  </div>
                )}

                {contact.phone && (
                  <div className="bg-slate-50 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <Phone className="w-4 h-4 text-slate-600" />
                      <span className="text-sm font-medium text-slate-600 uppercase tracking-wider">Phone</span>
                    </div>
                    <a 
                      href={`tel:${contact.phone}`}
                      className="text-blue-600 hover:text-blue-800 hover:underline transition-colors font-medium"
                    >
                      {contact.phone}
                    </a>
                  </div>
                )}

                {contact.linkedin_url && (
                  <div className="bg-slate-50 rounded-lg p-4 md:col-span-2">
                    <div className="flex items-center space-x-2 mb-2">
                      <Linkedin className="w-4 h-4 text-slate-600" />
                      <span className="text-sm font-medium text-slate-600 uppercase tracking-wider">LinkedIn</span>
                    </div>
                    <a 
                      href={contact.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 hover:underline transition-colors font-medium flex items-center space-x-1"
                    >
                      <span>{contact.linkedin_url}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Work Experience */}
            {contact.experience && contact.experience.length > 0 && (
              <div>
                <div className="flex items-center space-x-2 text-slate-700 border-b border-slate-200 pb-3 mb-4">
                  <Briefcase className="w-5 h-5" />
                  <h3 className="font-semibold">Work Experience</h3>
                </div>
                
                <div className="space-y-4">
                  {contact.experience.map((exp, index) => (
                    <div key={exp.id || index} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-semibold text-slate-900">{exp.title}</h4>
                          <p className="text-slate-700">{exp.company}</p>
                        </div>
                        <div className="text-right text-sm text-slate-600">
                          {formatExperienceDate(exp.start_date)} - {
                            exp.is_current ? 'Present' : formatExperienceDate(exp.end_date) || 'Unknown'
                          }
                        </div>
                      </div>
                      {exp.description && (
                        <p className="text-slate-600 text-sm mt-2 whitespace-pre-wrap">{exp.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Education */}
            {contact.education && contact.education.length > 0 && (
              <div>
                <div className="flex items-center space-x-2 text-slate-700 border-b border-slate-200 pb-3 mb-4">
                  <GraduationCap className="w-5 h-5" />
                  <h3 className="font-semibold">Education</h3>
                </div>
                
                <div className="space-y-4">
                  {contact.education.map((edu, index) => (
                    <div key={edu.id || index} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-semibold text-slate-900">{edu.degree_and_field}</h4>
                          <p className="text-slate-700">{edu.institution}</p>
                        </div>
                        <div className="text-right text-sm text-slate-600">
                          {formatEducationDate(edu.year)}
                        </div>
                      </div>
                      {edu.notes && (
                        <p className="text-slate-600 text-sm mt-2">{edu.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Mutual Connections */}
            {contact.mutual_connections && contact.mutual_connections.length > 0 && (
              <div>
                <div className="flex items-center space-x-2 text-slate-700 border-b border-slate-200 pb-3 mb-4">
                  <Users className="w-5 h-5" />
                  <h3 className="font-semibold">Mutual Connections</h3>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {contact.mutual_connections.map((connection, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm border border-blue-200"
                    >
                      <Users className="w-3 h-3 mr-1" />
                      {connection}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Associated Jobs */}
            <div>
              <div className="flex items-center space-x-2 text-slate-700 border-b border-slate-200 pb-3 mb-4">
                <Briefcase className="w-5 h-5" />
                <h3 className="font-semibold">Associated Job Applications</h3>
              </div>
              
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <ContactJobLinks
                  contactId={contact.id}
                  compact={false}
                />
              </div>
            </div>

            {/* Notes */}
            {contact.notes && (
              <div>
                <div className="flex items-center space-x-2 text-slate-700 border-b border-slate-200 pb-3 mb-4">
                  <FileText className="w-5 h-5" />
                  <h3 className="font-semibold">Notes</h3>
                </div>
                
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <p className="text-slate-900 whitespace-pre-wrap">{contact.notes}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
})

ContactModal.displayName = 'ContactModal'

// Sortable header component
const SortableHeader = memo(({ 
  field, 
  label, 
  sortConfig, 
  onSort, 
  className = "" 
}: {
  field: SortField
  label: string
  sortConfig: SortConfig
  onSort: (field: SortField) => void
  className?: string
}) => {
  const isActive = sortConfig.field === field
  const direction = isActive ? sortConfig.direction : null

  const handleClick = useCallback(() => {
    onSort(field)
  }, [field, onSort])

  return (
    <th 
      className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100/50 transition-colors select-none ${className}`}
      onClick={handleClick}
    >
      <div className="flex items-center space-x-1 group">
        <span>{label}</span>
        <div className="flex flex-col">
          {direction === 'asc' ? (
            <ChevronUp className="w-3 h-3 text-blue-600" />
          ) : direction === 'desc' ? (
            <ChevronDown className="w-3 h-3 text-blue-600" />
          ) : (
            <ArrowUpDown className="w-3 h-3 text-gray-300 group-hover:text-gray-400" />
          )}
        </div>
      </div>
    </th>
  )
})

SortableHeader.displayName = 'SortableHeader'

// Memoized Job Table Row - Compact version with optimized callbacks
const JobTableRow = memo(({ 
  job, 
  onEdit, 
  onDelete, 
  onManageContacts, 
  onContactClick,
  onCreateReminder
}: {
  job: JobWithContacts
  onEdit: (job: Job) => void
  onDelete: (jobId: string) => void
  onManageContacts: (job: Job) => void
  onContactClick: (contact: Contact) => void
  onCreateReminder: (job: Job) => void
}) => {
  // Memoize callbacks to prevent child re-renders
  const handleEdit = useCallback(() => {
    onEdit(job)
  }, [job, onEdit])

  const handleDelete = useCallback(() => {
    onDelete(job.id)
  }, [job.id, onDelete])

  const handleManageContacts = useCallback(() => {
    onManageContacts(job)
  }, [job, onManageContacts])

  const handleCreateReminder = useCallback(() => {
    onCreateReminder(job)
  }, [job, onCreateReminder])

  return (
    <tr className="hover:bg-slate-50/50">
      <td className="px-4 py-3 text-sm font-medium text-gray-900">
        {job.job_title}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">
        {job.company}
      </td>
      <td className="px-4 py-3 hidden sm:table-cell">
        <span className={`status-badge status-${job.status?.toLowerCase()?.replace(/\s+/g, '-')}`}>
          {job.status?.replace('_', ' ')}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-500 hidden md:table-cell">
        {job.location || '—'}
      </td>
      <td className="px-4 py-3 text-sm text-gray-500 hidden lg:table-cell">
        {job.salary || '—'}
      </td>
      <td className="px-4 py-3 hidden xl:table-cell">
        <JobContactLinks 
          jobId={job.id}
          contacts={job.contacts || []}
          onContactClick={onContactClick}
        />
      </td>
      <td className="px-4 py-3 text-right w-40 sticky right-0 bg-white">
        <div className="flex items-center justify-end space-x-1">
          <button
            onClick={handleCreateReminder}
            className="p-1 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded"
            title="Create reminder"
          >
            <Bell className="w-4 h-4" />
          </button>
          <button
            onClick={handleManageContacts}
            className="p-1 text-green-600 hover:text-green-800 hover:bg-green-50 rounded"
            title="Manage contacts"
          >
            <Users className="w-4 h-4" />
          </button>
          <button
            onClick={handleEdit}
            className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
            title="Edit job"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={handleDelete}
            className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
            title="Delete job"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  )
})

JobTableRow.displayName = 'JobTableRow'

// Memoized loading skeleton
const LoadingSkeleton = memo(() => (
  <div className="space-y-6">
    <div className="glass rounded-xl p-8 text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
      <p className="text-gray-500 mt-4">Loading jobs...</p>
    </div>
  </div>
))

LoadingSkeleton.displayName = 'LoadingSkeleton'

// Memoized error state
const ErrorState = memo(({ 
  error, 
  onRetry, 
  onClearCacheRetry 
}: { 
  error: string
  onRetry: () => void
  onClearCacheRetry: () => void 
}) => (
  <div className="space-y-6">
    <div className="glass rounded-xl p-8 text-center">
      <p className="text-red-500 mb-4">{error}</p>
      <div className="space-x-4">
        <button 
          onClick={onRetry}
          className="btn-primary"
        >
          Retry
        </button>
        <button 
          onClick={onClearCacheRetry}
          className="btn-secondary"
        >
          Clear Cache & Retry
        </button>
      </div>
    </div>
  </div>
))

ErrorState.displayName = 'ErrorState'

// Memoized empty state
const EmptyState = memo(({ 
  hasJobs, 
  onAddJob 
}: { 
  hasJobs: boolean
  onAddJob: () => void 
}) => (
  <div className="text-center py-12 glass rounded-xl">
    <Briefcase className="mx-auto h-12 w-12 text-gray-400 mb-4" />
    <h3 className="text-lg font-medium text-gray-900 mb-2">
      {!hasJobs ? 'No jobs yet' : 'No matching jobs'}
    </h3>
    <p className="text-gray-500 mb-6">
      {!hasJobs 
        ? "Add your first job application to get started!" 
        : "Try adjusting your search terms or status filter."
      }
    </p>
    {!hasJobs && (
      <button
        onClick={onAddJob}
        className="btn-primary"
      >
        <Plus className="w-4 h-4 mr-2" />
        Add Your First Job
      </button>
    )}
  </div>
))

EmptyState.displayName = 'EmptyState'

// Memoized status filter component
const StatusFilter = memo(({ 
  statusCounts, 
  statusFilter, 
  onStatusChange 
}: {
  statusCounts: Record<string, number>
  statusFilter: string
  onStatusChange: (status: string) => void
}) => (
  <div className="flex flex-wrap gap-2 bg-white/50 p-2 rounded-lg">
    {/* Always show All Jobs first */}
    <button
      onClick={() => onStatusChange('all')}
      className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
        statusFilter === 'all'
          ? 'bg-blue-600 text-white'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      All Jobs
      <span className={`text-xs px-2 py-0.5 rounded-full ${
        statusFilter === 'all'
          ? 'bg-white/20 text-white'
          : 'bg-gray-200 text-gray-600'
      }`}>
        {statusCounts.all || 0}
      </span>
    </button>

    {/* Dynamic status buttons based on actual data */}
    {Object.entries(statusCounts)
      .filter(([status, count]) => status !== 'all' && count > 0)
      .sort(([a], [b]) => a.localeCompare(b)) // Sort alphabetically
      .map(([status, count]) => {
        const isActive = statusFilter === status
        
        return (
          <button
            key={status}
            onClick={() => onStatusChange(status)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
              isActive
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {/* Capitalize first letter for display */}
            {status.charAt(0).toUpperCase() + status.slice(1)}
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              isActive
                ? 'bg-white/20 text-white'
                : 'bg-gray-200 text-gray-600'
            }`}>
              {count}
            </span>
          </button>
        )
      })}
  </div>
))

StatusFilter.displayName = 'StatusFilter'

export default function JobList() {
  // State management
  const [state, setState] = useState<JobListState>({
    jobs: [],
    loading: true,
    error: null
  })
  
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortConfig, setSortConfig] = useState<SortConfig>({ 
    field: 'created_at', direction: 'desc' })
  const [showJobForm, setShowJobForm] = useState(false)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [showContactManager, setShowContactManager] = useState(false)
  
  // Reminder modal state
  const [showReminderModal, setShowReminderModal] = useState(false)
  const [reminderJob, setReminderJob] = useState<Job | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [jobs, setJobs] = useState<Job[]>([])

  // Sorting function
  const sortJobs = useCallback((jobs: JobWithContacts[], config: SortConfig): JobWithContacts[] => {
    if (!config.field) return jobs

    return [...jobs].sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (config.field) {
        case 'job_title':
          aValue = a.job_title?.toLowerCase() || ''
          bValue = b.job_title?.toLowerCase() || ''
          break
        case 'company':
          aValue = a.company?.toLowerCase() || ''
          bValue = b.company?.toLowerCase() || ''
          break
        case 'status':
          // Custom sort order for status
          const statusOrder = {
            'bookmarked': 0,
            'interested': 1,
            'applied': 2,
            'interviewing': 3,
            'offered': 4,
            'onhold': 5,
            'withdrawn': 6,
            'rejected': 7,
            'noresponse': 8
          }
          aValue = statusOrder[a.status as keyof typeof statusOrder] ?? 999
          bValue = statusOrder[b.status as keyof typeof statusOrder] ?? 999
          break
        case 'location':
          aValue = a.location?.toLowerCase() || ''
          bValue = b.location?.toLowerCase() || ''
          break
        case 'salary':
          // Extract numeric value from salary string for proper sorting
          const extractSalaryNumber = (salary: string | null) => {
            if (!salary) return 0
            const match = salary.match(/[\d,]+/)
            if (!match) return 0
            return parseInt(match[0].replace(/,/g, ''), 10)
          }
          aValue = extractSalaryNumber(a.salary)
          bValue = extractSalaryNumber(b.salary)
          break
        case 'created_at':
          aValue = new Date(a.created_at || '').getTime()
          bValue = new Date(b.created_at || '').getTime()
          break
        case 'updated_at':
          aValue = new Date(a.updated_at || '').getTime()
          bValue = new Date(b.updated_at || '').getTime()
          break
        default:
          return 0
      }

      if (aValue < bValue) {
        return config.direction === 'asc' ? -1 : 1
      }
      if (aValue > bValue) {
        return config.direction === 'asc' ? 1 : -1
      }
      return 0
    })
  }, [])

  // Handle sorting
  const handleSort = useCallback((field: SortField) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }, [])

  // Memoized callbacks to prevent unnecessary re-renders
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
  }, [])

  const handleSearchClear = useCallback(() => {
    setSearchTerm('')
  }, [])

  const handleStatusFilterChange = useCallback((status: string) => {
    setStatusFilter(status)
  }, [])

  const handleEditJob = useCallback((job: Job) => {
    setSelectedJob(job)
    setShowJobForm(true)
  }, [])

  const handleDeleteJob = useCallback(async (jobId: string) => {
    if (!confirm('Are you sure you want to delete this job application?')) {
      return
    }

    try {
      const success = await deleteJob(jobId)
      
      if (success) {
        // Optimistic update
        setState(prev => ({
          ...prev,
          jobs: prev.jobs.filter(job => job.id !== jobId)
        }))
      } else {
        setState(prev => ({
          ...prev,
          error: 'Failed to delete job'
        }))
      }
    } catch (error) {
      console.error('Error deleting job:', error)
      setState(prev => ({
        ...prev,
        error: 'Failed to delete job'
      }))
    }
  }, [])

  const handleManageContacts = useCallback((job: Job) => {
    setSelectedJob(job)
    setShowContactManager(true)
  }, [])

  const handleContactClick = useCallback((contact: Contact) => {
    setSelectedContact(contact)
  }, [])

  const handleCreateReminder = useCallback((job: Job) => {
    setReminderJob(job)
    setShowReminderModal(true)
  }, [])

  const handleCloseContactManager = useCallback(() => {
    setShowContactManager(false)
    setSelectedJob(null)
    // Reload data to get updated contacts
    loadJobs()
  }, [])

  const handleJobFormSubmit = useCallback((job: Job) => {
    if (selectedJob) {
      // Update existing job
      setState(prev => ({
        ...prev,
        jobs: prev.jobs.map(j => j.id === job.id ? { ...j, ...job, contacts: j.contacts } : j)
      }))
    } else {
      // Add new job (will be reloaded)
      loadJobs()
    }
    setShowJobForm(false)
    setSelectedJob(null)
  }, [selectedJob])

  const handleAddJob = useCallback(() => {
    setShowJobForm(true)
  }, [])

  const handleCancelJobForm = useCallback(() => {
    setShowJobForm(false)
    setSelectedJob(null)
  }, [])

  const handleCloseContactModal = useCallback(() => {
    setSelectedContact(null)
  }, [])

  const handleReminderModalClose = useCallback(() => {
    setShowReminderModal(false)
    setReminderJob(null)
  }, [])

  const handleReminderModalSuccess = useCallback(() => {
    setShowReminderModal(false)
    setReminderJob(null)
    // Could optionally show a success message or refresh data
  }, [])

  // Simplified data loading function
  const loadJobs = useCallback(async () => {
    console.log('Loading jobs...')
    setState(prev => ({ ...prev, loading: true, error: null }))
    
    try {
      const jobsWithContacts = await fetchJobsWithContacts()
      console.log('Loaded jobs:', jobsWithContacts.length)
      
      setState(prev => ({
        ...prev,
        jobs: jobsWithContacts,
        loading: false,
        error: null
      }))

      // Set jobs for reminder modal
      setJobs(jobsWithContacts.map(j => ({
        id: j.id,
        job_title: j.job_title,
        company: j.company,
        status: j.status,
        location: j.location,
        salary: j.salary,
        notes: j.notes,
        created_at: j.created_at,
        updated_at: j.updated_at
      })))
    } catch (error) {
      console.error('Error loading jobs:', error)
      setState(prev => ({
        ...prev,
        error: 'Failed to load jobs. Please try refreshing the page.',
        loading: false
      }))
    }
  }, [])

  const handleRetry = useCallback(() => {
    loadJobs()
  }, [loadJobs])

  const handleClearCacheRetry = useCallback(() => {
    loadJobs()
  }, [loadJobs])

  // Load data on component mount
  useEffect(() => {
    loadJobs()
  }, [loadJobs])

  // Load contacts for reminder modal (you might want to implement getContacts if not available)
  useEffect(() => {
    const loadContacts = async () => {
      try {
        // Import getContacts or implement similar function
        // const contactsData = await getContacts()
        // setContacts(contactsData)
        setContacts([]) // Placeholder until you implement contact loading
      } catch (error) {
        console.error('Error loading contacts:', error)
        setContacts([])
      }
    }

    loadContacts()
  }, [])

  // Memoized status counts - dynamic approach based on actual data
  const statusCounts = useMemo(() => {
    if (!state.jobs || !Array.isArray(state.jobs)) {
      return { all: 0 }
    }
    
    const counts: Record<string, number> = { all: state.jobs.length }
    
    state.jobs.forEach(job => {
      if (job && job.status) {
        // Use the exact status from the job (no normalization)
        counts[job.status] = (counts[job.status] || 0) + 1
      }
    })
    
    return counts
  }, [state.jobs])

  // Memoized filtered and sorted jobs
  const processedJobs = useMemo(() => {
    if (!state.jobs || !Array.isArray(state.jobs) || state.jobs.length === 0) {
      return []
    }
    
    const searchLower = searchTerm.toLowerCase().trim()
    
    // First filter
    const filteredJobs = state.jobs.filter(job => {
      if (!job) return false
      
      // Status filter - use exact matching (most selective filter first)
      if (statusFilter !== 'all' && job.status !== statusFilter) {
        return false
      }
      
      // Search filter (only if there's a search term)
      if (searchLower) {
        return (
          job.company?.toLowerCase().includes(searchLower) ||
          job.job_title?.toLowerCase().includes(searchLower) ||
          job.notes?.toLowerCase().includes(searchLower) ||
          job.location?.toLowerCase().includes(searchLower)
        )
      }
      
      return true
    })

    // Then sort
    return sortJobs(filteredJobs, sortConfig)
  }, [state.jobs, searchTerm, statusFilter, sortConfig, sortJobs])

  // ESC key handling
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showJobForm) {
          setShowJobForm(false)
          setSelectedJob(null)
        }
        if (selectedContact) {
          setSelectedContact(null)
        }
        if (showContactManager) {
          setShowContactManager(false)
          setSelectedJob(null)
        }
        if (showReminderModal) {
          setShowReminderModal(false)
          setReminderJob(null)
        }
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [showJobForm, selectedContact, showContactManager, showReminderModal])

  // Loading state
  if (state.loading) {
    return <LoadingSkeleton />
  }

  // Error state with retry option
  if (state.error) {
    return (
      <ErrorState 
        error={state.error}
        onRetry={handleRetry}
        onClearCacheRetry={handleClearCacheRetry}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with inline search and Add Job button - More robust mobile responsive */}
      <div className="space-y-4 lg:space-y-0">
        {/* Desktop and Tablet: Single row with search and actions (1024px and up) */}
        <div className="hidden lg:flex justify-between items-center gap-4">
          {/* Search Bar - Wider like Network page */}
          <div className="relative flex-1 max-w-2xl">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search jobs by company, title, or notes..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="input pl-10 w-full"
            />
            {searchTerm && (
              <button
                onClick={handleSearchClear}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <span className="text-sm text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
              {processedJobs.length} application{processedJobs.length !== 1 ? 's' : ''}
            </span>
            
            <button
              onClick={handleAddJob}
              className="btn-primary flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add Job</span>
            </button>
          </div>
        </div>

        {/* Mobile and Small Tablet: Stacked layout (below 1024px) */}
        <div className="lg:hidden">
          {/* Action buttons row */}
          <div className="flex justify-between items-center mb-4">
            <span className="text-lg font-semibold text-slate-800">Jobs</span>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                {processedJobs.length}
              </span>
              
              <button
                onClick={handleAddJob}
                className="btn-primary flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Add Job</span>
                <span className="sm:hidden">Add</span>
              </button>
            </div>
          </div>

          {/* Search Bar - Full width on mobile */}
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search jobs..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="input pl-10 w-full"
            />
            {searchTerm && (
              <button
                onClick={handleSearchClear}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Status Filter Tabs - Dynamic based on actual job data */}
      <StatusFilter 
        statusCounts={statusCounts}
        statusFilter={statusFilter}
        onStatusChange={handleStatusFilterChange}
      />

      {/* Jobs Table */}
      {processedJobs.length === 0 ? (
        <EmptyState 
          hasJobs={state.jobs.length > 0}
          onAddJob={handleAddJob}
        />
      ) : (
        <div className="glass rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 table-fixed">
              <thead className="bg-slate-50/50">
                <tr>
                  <SortableHeader
                    field="job_title"
                    label="Job Title"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                    className="w-[23%] min-w-[120px]"
                  />
                  <SortableHeader
                    field="company"
                    label="Company"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                    className="w-[18%] min-w-[100px]"
                  />
                  <SortableHeader
                    field="status"
                    label="Status"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                    className="w-[16%] min-w-[80px] hidden sm:table-cell"
                  />
                  <SortableHeader
                    field="location"
                    label="Location"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                    className="w-[12%] min-w-[80px] hidden md:table-cell"
                  />
                  <SortableHeader
                    field="salary"
                    label="Salary"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                    className="w-[10%] min-w-[80px] hidden lg:table-cell"
                  />
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[14%] min-w-[120px] hidden xl:table-cell">
                    Contacts
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[17%] min-w-[140px] sticky right-0 bg-slate-50/50">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {processedJobs.map((job) => (
                  <JobTableRow
                    key={job.id}
                    job={job}
                    onEdit={handleEditJob}
                    onDelete={handleDeleteJob}
                    onManageContacts={handleManageContacts}
                    onContactClick={handleContactClick}
                    onCreateReminder={handleCreateReminder}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Contact Details Modal */}
      {selectedContact && (
        <ContactModal
          contact={selectedContact}
          onClose={handleCloseContactModal}
        />
      )}

      {/* Contact Manager Modal */}
      {showContactManager && selectedJob && (
        <JobContactManager
          jobId={selectedJob.id}
          onClose={handleCloseContactManager}
        />
      )}

      {/* Job Form Modal */}
      {showJobForm && (
        <JobForm
          job={selectedJob}
          onJobAdded={handleJobFormSubmit}
          onCancel={handleCancelJobForm}
        />
      )}

      {/* Reminder Modal */}
      {showReminderModal && reminderJob && (
        <CreateReminderModal
          isOpen={showReminderModal}
          onClose={handleReminderModalClose}
          onSuccess={handleReminderModalSuccess}
          editingReminder={null}
          contacts={contacts}
          jobs={jobs}
          prefilledJob={reminderJob}
        />
      )}
    </div>
  )
}
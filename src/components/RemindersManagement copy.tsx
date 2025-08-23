
// src/components/RemindersManagement.tsx
'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Mail, Plus, Search, Filter, X, Edit, Trash2, Calendar, Clock,
  User, Briefcase, AlertTriangle, Check, Ban, RefreshCw, Eye
} from 'lucide-react'
import {
  ReminderWithContext,
  ReminderStatsResponse,
  ReminderSearchOptions,
  getReminderStatusColor,
  getReminderStatusText,
  formatReminderDate,
  isReminderOverdue,
  getTimeUntilReminder
} from '@/lib/types/reminders'
import CreateReminderModal from './modals/CreateReminderModal'
import { Contact, Job } from '@/lib/supabase'
import { getContacts } from '@/lib/contacts'
import { fetchJobs } from '@/lib/jobs'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs' // Import createClientComponentClient
import { ReminderDetailsModal } from './ReminderDetails' // Import ReminderDetailsModal from the new path

interface RemindersState {
  reminders: ReminderWithContext[]
  loading: boolean
  error: string | null
  total: number
  hasMore: boolean
}

export default function RemindersManagement() {
  // Initialize Supabase client using createClientComponentClient
  const supabase = createClientComponentClient()

  // -------------------------
  // Simplified state management
  // -------------------------
  const [state, setState] = useState<RemindersState>({
    reminders: [],
    loading: true,
    error: null,
    total: 0,
    hasMore: false,
  })
  const [stats, setStats] = useState<ReminderStatsResponse | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'sent' | 'failed' | 'cancelled'>('all')
  const [sortBy, setSortBy] = useState<'scheduled_time' | 'created_at'>('scheduled_time')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedReminder, setSelectedReminder] = useState<ReminderWithContext | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  const [contacts, setContacts] = useState<Contact[]>([])
  const [jobs, setJobs] = useState<Job[]>([])

  // Simplified auth state
  const [user, setUser] = useState<any>(null)
  const [authLoading, setAuthLoading] = useState(true)

  // -------------------------
  // Fixed auth handling
  // -------------------------
  useEffect(() => {
    let mounted = true

    const initAuth = async () => {
      try {
        // Get current session
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (!mounted) return
        
        if (error) {
          console.error('Session error:', error)
          setState(prev => ({ ...prev, error: 'Please sign in to access reminders.' }))
          setAuthLoading(false)
          return
        }

        if (session?.user) {
          setUser(session.user)
          console.log('User authenticated:', session.user.id)
        } else {
          setState(prev => ({ ...prev, error: 'Please sign in to access reminders.' }))
        }
        
        setAuthLoading(false)
      } catch (error) {
        console.error('Auth initialization error:', error)
        if (mounted) {
          setState(prev => ({ ...prev, error: 'Authentication failed. Please refresh the page.' }))
          setAuthLoading(false)
        }
      }
    }

    initAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      
      console.log('Auth state changed:', event, session?.user?.id)
      
      if (session?.user) {
        setUser(session.user)
        setState(prev => ({ ...prev, error: null }))
      } else {
        setUser(null)
        setState(prev => ({ 
          ...prev, 
          error: 'Session expired. Please sign in again.',
          reminders: [],
          loading: false 
        }))
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase])

  // -------------------------
  // Load initial data
  // -------------------------
  useEffect(() => {
    if (!user || authLoading) return
    
    const loadInitialData = async () => {
      console.log('Loading contacts and jobs for user:', user.id, 'email:', user.email)
      try {
        const [contactsData, jobsData] = await Promise.all([
          getContacts().catch(err => {
            console.warn('Failed to load contacts:', err)
            return []
          }),
          fetchJobs().catch(err => {
            console.warn('Failed to load jobs:', err)
            return []
          })
        ])
        
        setContacts(contactsData)
        setJobs(jobsData)
        console.log('Loaded contacts:', contactsData.length, 'jobs:', jobsData.length)
        console.log('User ID being used:', user.id)
      } catch (error) {
        console.error('Error loading initial data:', error)
      }
    }

    loadInitialData()
  }, [user, authLoading])

  // -------------------------
  // Fixed API requests - use session-based auth
  // -------------------------
  const makeRequest = useCallback(async (url: string, options: RequestInit = {}) => {
    console.log('Making request to:', url)
    
    // No need to manually get session and add Authorization header here
    // The browser will automatically send the cookies for the domain
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include', // Ensure cookies are sent with the request
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Request failed with status ${response.status}`)
    }

    return response
  }, []) // Removed supabase from dependency array as it's not directly used here

  // -------------------------
  // Load reminders
  // -------------------------
  const loadReminders = useCallback(async (options: ReminderSearchOptions = {}) => {
    if (!user) {
      setState(prev => ({ ...prev, error: 'Not authenticated' }))
      return
    }

    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const searchParams = new URLSearchParams()
      if (options.searchTerm) searchParams.set('search', options.searchTerm)
      if (options.status && options.status !== 'all') searchParams.set('status', options.status)
      if (options.sortBy) searchParams.set('sort_by', options.sortBy)
      if (options.sortOrder) searchParams.set('sort_order', options.sortOrder)
      searchParams.set('limit', '50')
      searchParams.set('offset', '0')

      console.log('Loading reminders with params:', searchParams.toString())
      const response = await makeRequest(`/api/reminders?${searchParams.toString()}`)
      const data = await response.json()
      
      console.log('Loaded reminders:', data.reminders?.length || 0)

      setState(prev => ({
        ...prev,
        reminders: data.reminders || [],
        total: data.total || 0,
        hasMore: data.hasMore || false,
        loading: false,
        error: null,
      }))
    } catch (error) {
      console.error('Error loading reminders:', error)
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load reminders',
      }))
    }
  }, [user, makeRequest])

  // Load statistics
  const loadStats = useCallback(async () => {
    if (!user) return
    
    setStatsLoading(true)
    try {
      console.log('Loading stats...')
      const response = await makeRequest('/api/reminders/stats')
      const statsData = await response.json()
      console.log('Loaded stats:', statsData)
      setStats(statsData)
    } catch (error) {
      console.error('Failed to load stats:', error)
      setStats(null)
    } finally {
      setStatsLoading(false)
    }
  }, [user, makeRequest])

  // Load data when user changes or filters change
  useEffect(() => {
    if (!user || authLoading) return
    
    loadReminders({
      searchTerm: searchTerm || undefined,
      status: statusFilter,
      sortBy,
      sortOrder,
    })
  }, [user, authLoading, loadReminders, searchTerm, statusFilter, sortBy, sortOrder])

  useEffect(() => {
    if (!user || authLoading) return
    loadStats()
  }, [user, authLoading, loadStats])

  // Handle search
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
  }, [])

  const handleSearchClear = useCallback(() => {
    setSearchTerm('')
  }, [])

  // Handle reminder actions
  const handleEditReminder = useCallback((reminder: ReminderWithContext) => {
    setSelectedReminder(reminder)
    setShowCreateModal(true)
  }, [])

  const handleDeleteReminder = useCallback(async (reminderId: string) => {
    if (!confirm('Are you sure you want to cancel this reminder?')) {
      return
    }

    try {
      const response = await makeRequest(`/api/reminders/${reminderId}`, {
        method: 'DELETE',
      })

      // Refresh data
      loadReminders({
        searchTerm: searchTerm || undefined,
        status: statusFilter,
        sortBy,
        sortOrder,
      })
      loadStats()
    } catch (error) {
      console.error('Error canceling reminder:', error)
      alert(error instanceof Error ? error.message : 'Failed to cancel reminder')
    }
  }, [searchTerm, statusFilter, sortBy, sortOrder, loadReminders, loadStats, makeRequest])

  const handleViewDetails = useCallback((reminder: ReminderWithContext) => {
    setSelectedReminder(reminder)
    setShowDetails(true)
  }, [])

  // Handle modal close
  const handleModalClose = useCallback(() => {
    setShowCreateModal(false)
    setSelectedReminder(null)
  }, [])

  const handleModalSuccess = useCallback(() => {
    // Refresh data after creating/editing reminder
    loadReminders({
      searchTerm: searchTerm || undefined,
      status: statusFilter,
      sortBy,
      sortOrder
    })
    loadStats()
  }, [searchTerm, statusFilter, sortBy, sortOrder, loadReminders, loadStats])

  // Filter reminders for display
  const filteredReminders = useMemo(() => {
    return state.reminders
  }, [state.reminders])

  // Status counts for filter tabs
  const statusCounts = useMemo(() => {
    if (!state.reminders.length) return { all: 0 }
    
    const counts = { all: state.reminders.length }
    state.reminders.forEach(reminder => {
      counts[reminder.status] = (counts[reminder.status] || 0) + 1
    })
    
    return counts
  }, [state.reminders])

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    )
  }

  // Show auth error
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Authentication Required</h3>
          <p className="text-gray-500 mb-4">{state.error || 'Please sign in to access your reminders.'}</p>
          <button 
            onClick={() => window.location.reload()}
            className="btn-primary"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Reload Page
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Email Reminders</h2>
          <p className="text-slate-600 mt-1">Schedule and manage follow-up reminders</p>
        </div>
        
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>New Reminder</span>
        </button>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Mail className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-slate-600">Total Reminders</span>
            </div>
            <div className="text-2xl font-bold text-slate-800">{stats.total}</div>
          </div>

          <div className="glass rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Clock className="w-5 h-5 text-yellow-600" />
              <span className="text-sm font-medium text-slate-600">Pending</span>
            </div>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            {stats.overdue > 0 && (
              <div className="text-xs text-red-600 mt-1">
                {stats.overdue} overdue
              </div>
            )}
          </div>

          <div className="glass rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Check className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-slate-600">Sent</span>
            </div>
            <div className="text-2xl font-bold text-green-600">{stats.sent}</div>
          </div>

          <div className="glass rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Calendar className="w-5 h-5 text-purple-600" />
              <span className="text-sm font-medium text-slate-600">This Month</span>
            </div>
            <div className="text-2xl font-bold text-purple-600">{stats.thisMonth}</div>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="glass rounded-xl p-6 space-y-4">
        {/* Search Bar */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search reminders..."
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

        {/* Status Filter Tabs */}
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'all', label: 'All Reminders', count: statusCounts.all || 0 },
            { key: 'pending', label: 'Pending', count: statusCounts.pending || 0 },
            { key: 'sent', label: 'Sent', count: statusCounts.sent || 0 },
            { key: 'failed', label: 'Failed', count: statusCounts.failed || 0 },
            { key: 'cancelled', label: 'Cancelled', count: statusCounts.cancelled || 0 }
          ]
            .filter(status => status.count > 0 || status.key === 'all')
            .map(status => (
              <button
                key={status.key}
                onClick={() => setStatusFilter(status.key)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                  statusFilter === status.key
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {status.label}
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  statusFilter === status.key
                    ? 'bg-white/20 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {status.count}
                </span>
              </button>
            ))}
        </div>

        {/* Sort Options */}
        <div className="flex items-center space-x-4">
          <span className="text-sm text-slate-600">Sort by:</span>
          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [field, order] = e.target.value.split('-') as ['scheduled_time' | 'created_at', 'asc' | 'desc']
              setSortBy(field)
              setSortOrder(order)
            }}
            className="input text-sm"
          >
            <option value="scheduled_time-asc">Scheduled Time (Earliest First)</option>
            <option value="scheduled_time-desc">Scheduled Time (Latest First)</option>
            <option value="created_at-desc">Created Date (Newest First)</option>
            <option value="created_at-asc">Created Date (Oldest First)</option>
          </select>
        </div>
      </div>

      {/* Reminders List */}
      <div className="glass rounded-xl overflow-hidden">
        {state.loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-500">Loading reminders...</p>
          </div>
        ) : state.error ? (
          <div className="p-8 text-center">
            <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-4" />
            <p className="text-red-600 mb-4">{state.error}</p>
            <button 
              onClick={() => loadReminders({ searchTerm: searchTerm || undefined, status: statusFilter, sortBy, sortOrder })}
              className="btn-primary"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </button>
          </div>
        ) : filteredReminders.length === 0 ? (
          <div className="p-8 text-center">
            <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No reminders found</h3>
            <p className="text-gray-500 mb-6">
              {searchTerm || statusFilter !== 'all' 
                ? "Try adjusting your search or filters"
                : "Create your first reminder to get started!"
              }
            </p>
            {!searchTerm && statusFilter === 'all' && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn-primary"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Reminder
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-slate-50/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Subject & Context
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Scheduled Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredReminders.map((reminder) => (
                  <tr key={reminder.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-gray-900 mb-1">
                          {reminder.email_subject}
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          {reminder.contact_name && (
                            <div className="flex items-center space-x-1">
                              <User className="w-3 h-3" />
                              <span>{reminder.contact_name}</span>
                              {reminder.contact_company && (
                                <span>at {reminder.contact_company}</span>
                              )}
                            </div>
                          )}
                          {reminder.job_title && (
                            <div className="flex items-center space-x-1">
                              <Briefcase className="w-3 h-3" />
                              <span>{reminder.job_title}</span>
                              {reminder.job_company && (
                                <span>at {reminder.job_company}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {formatReminderDate(reminder.scheduled_time, reminder.user_timezone)}
                      </div>
                      {reminder.status === 'pending' && (
                        <div className={`text-xs mt-1 ${
                          isReminderOverdue(reminder) ? 'text-red-600' : 'text-gray-500'
                        }`}>
                          {getTimeUntilReminder(reminder)}
                        </div>
                      )}
                      {reminder.sent_at && (
                        <div className="text-xs text-green-600 mt-1">
                          Sent: {formatReminderDate(reminder.sent_at, reminder.user_timezone)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getReminderStatusColor(reminder.status)}`}>
                        {reminder.status === 'pending' && isReminderOverdue(reminder) && (
                          <AlertTriangle className="w-3 h-3 mr-1" />
                        )}
                        {getReminderStatusText(reminder.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleViewDetails(reminder)}
                          className="p-1 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
                          title="View details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        
                        {reminder.status === 'pending' && (
                          <button
                            onClick={() => handleEditReminder(reminder)}
                            className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                            title="Edit reminder"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                        
                        <button
                          onClick={() => handleDeleteReminder(reminder.id)}
                          className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                          title={reminder.status === 'pending' ? 'Cancel reminder' : 'Delete reminder'}
                        >
                          {reminder.status === 'pending' ? (
                            <Ban className="w-4 h-4" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Reminder Modal */}
      {showCreateModal && (
        <CreateReminderModal
          isOpen={showCreateModal}
          onClose={handleModalClose}
          onSuccess={handleModalSuccess}
          editingReminder={selectedReminder}
          contacts={contacts}
          jobs={jobs}
        />
      )}

      {/* Reminder Details Modal */}
      {showDetails && selectedReminder && (
        <ReminderDetailsModal
          reminder={selectedReminder}
          onClose={() => setShowDetails(false)}
        />
      )}
    </div>
  )
}



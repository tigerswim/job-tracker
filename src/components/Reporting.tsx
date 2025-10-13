// src/components/Reporting.tsx – Updated with Reminders integration

'use client'

import { useState, useEffect, useMemo } from 'react'
import { Contact, Interaction } from '@/lib/supabase'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import {
  BarChart3,
  Users,
  MessageCircle,
  Search,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  Building,
  Briefcase,
  Calendar,
  Mail,
  Phone,
  Video,
  Linkedin,
  User,
  Clock,
  Network,
  TrendingUp,
  Activity,
  UserPlus,
  MessageSquare,
  Target,
  Eye,
  Bell // Added Bell icon for Reminders
} from 'lucide-react'
import dynamic from 'next/dynamic'

const RemindersManagement = dynamic(
  () => import('./RemindersManagement'),
  { ssr: false }
)

export function ReportingPage() {
  return (
    <div>
      <RemindersManagement />
    </div>
  )
}
// Add these imports after your existing imports
import type { 
  ContactWithJobs, 
  InteractionWithContact, 
  ContactSortField, 
  InteractionSortField, 
  SortDirection, 
  ContactStats, 
  InteractionStats,
  ReportingSection 
} from '@/lib/types'


/* ----------------------------- Types ---------------------------- */

interface ContactWithJobs extends Contact {
  linkedJobsCount?: number
  linkedJobs?: any[]
  lastInteractionDate?: string
  interactionCount?: number
  mutual_connections_count?: number
}

interface InteractionWithContact extends Interaction {
  contact?: Contact
}

interface InteractionStats {
  totalInteractions: number
  thisMonth: number
  lastMonth: number
  byType: { [key: string]: number }
  recentActivity: InteractionWithContact[]
}

interface ContactStats {
  totalContacts: number
  withJobs: number
  withMutualConnections: number
  topCompanies: { company: string; count: number }[]
  recentContacts: ContactWithJobs[]
}

type SortDirection = 'asc' | 'desc' | null
type ContactSortField =
  | 'name'
  | 'company'
  | 'job_title'
  | 'mutual_connections_count'
  | 'linkedJobsCount'
  | 'lastInteraction'
type InteractionSortField = 'date' | 'contact_name' | 'type' | 'summary'

// Updated to include reminders section type
type ReportingSection = 'overview' | 'contacts' | 'interactions' | 'reminders'

/* -------------------------- RPC result type shapes -------------------------- */

type RPCContactRow = {
  contact_id: string
  name: string | null
  company: string | null
  job_title: string | null
  linked_jobs_count: number
  last_interaction_date: string | null
  interaction_count: number
  mutual_connections_count: number
  mutual_connections: string[] | null
  email: string | null
  phone: string | null
  linkedin_url: string | null
  notes: string | null
}

type RPCRecentInteractionRow = {
  interaction_id: string
  date: string
  type: string
  summary: string | null
  notes: string | null
  contact_id: string
  contact_name: string | null
}

type ReportingSort =
  | 'name'
  | 'company'
  | 'job_title'
  | 'linkedJobsCount'
  | 'mutual_connections_count'
  | 'last_interaction'
type SortDir = 'asc' | 'desc'

/* -------------------------- Minimal RPC call helpers ------------------------ */

async function rpcReportingContacts(params: {
  userId: string
  search?: string | null
  sort?: ReportingSort
  dir?: SortDir
  limit?: number
  offset?: number
}): Promise<RPCContactRow[]> {
  const {
    userId,
    search = null,
    sort = 'last_interaction',
    dir = 'desc',
    limit = 10000,
    offset = 0
  } = params

  const supabase = createClientComponentClient()
  console.log('RPC reporting_contacts: Calling with user ID:', userId)
  const { data, error } = await supabase.rpc('reporting_contacts', {
    p_user_id: userId,
    p_search: search,
    p_sort: sort,
    p_dir: dir,
    p_limit: limit,
    p_offset: offset
  })
  if (error) {
    console.error('reporting_contacts RPC error:', error)
    return []
  }
  console.log('RPC reporting_contacts: Retrieved', data?.length || 0, 'contacts')
  return (data ?? []) as RPCContactRow[]
}

async function rpcReportingRecentInteractions(params: {
  userId: string
  limit?: number
}): Promise<RPCRecentInteractionRow[]> {
  const { userId, limit = 100 } = params
  const supabase = createClientComponentClient()
  console.log('RPC reporting_recent_interactions: Calling with user ID:', userId)
  const { data, error } = await supabase.rpc('reporting_recent_interactions', {
    p_user_id: userId,
    p_limit: limit
  })
  if (error) {
    console.error('reporting_recent_interactions RPC error:', error)
    return []
  }
  console.log('RPC reporting_recent_interactions: Retrieved', data?.length || 0, 'interactions')
  return (data ?? []) as RPCRecentInteractionRow[]
}

/* --------------------------------- Modals ---------------------------------- */

interface ContactModalProps {
  contact: Contact
  onClose: () => void
}

function ContactModal({ contact, onClose }: ContactModalProps) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 text-white">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold">{contact.name}</h2>
                <p className="text-blue-100 text-sm">Contact Details</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-all duration-200"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
          <div className="space-y-6">
            {(contact.job_title || contact.company) && (
              <div>
                <h3 className="flex items-center space-x-2 text-slate-700 font-semibold mb-2">
                  <Building className="w-4 h-4" />
                  <span>Current Role</span>
                </h3>
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <p className="font-medium">
                    {contact.job_title && contact.company
                      ? `${contact.job_title} at ${contact.company}`
                      : contact.job_title || contact.company}
                  </p>
                </div>
              </div>
            )}

            <div>
              <h3 className="flex items-center space-x-2 text-slate-700 font-semibold mb-2">
                <Mail className="w-4 h-4" />
                <span>Contact Information</span>
              </h3>
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 space-y-3">
                {contact.email && (
                  <div className="flex items-center space-x-2 text-sm">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <span>{contact.email}</span>
                  </div>
                )}
                {contact.phone && (
                  <div className="flex items-center space-x-2 text-sm">
                    <Phone className="w-4 h-4 text-slate-400" />
                    <span>{contact.phone}</span>
                  </div>
                )}
                {contact.linkedin_url && (
                  <div className="flex items-center space-x-2 text-sm">
                    <Linkedin className="w-4 h-4 text-slate-400" />
                    <a
                      href={contact.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                    >
                      <span>LinkedIn Profile</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            </div>

            {contact.mutual_connections && contact.mutual_connections.length > 0 && (
              <div>
                <h3 className="flex items-center space-x-2 text-slate-700 font-semibold mb-2">
                  <Network className="w-4 h-4" />
                  <span>Mutual Connections</span>
                </h3>
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <div className="flex flex-wrap gap-2">
                    {contact.mutual_connections.map((connection, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                      >
                        {connection}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {contact.notes && (
              <div>
                <h3 className="flex items-center space-x-2 text-slate-700 font-semibold mb-2">
                  <MessageCircle className="w-4 h-4" />
                  <span>Notes</span>
                </h3>
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{contact.notes}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

interface InteractionModalProps {
  interaction: InteractionWithContact
  onClose: () => void
}

function InteractionModal({ interaction, onClose }: InteractionModalProps) {
  const getInteractionIcon = (type: string) => {
    switch (type) {
      case 'email': return Mail
      case 'phone': return Phone
      case 'video_call': return Video
      case 'linkedin': return Linkedin
      case 'meeting': return Calendar
      default: return MessageCircle
    }
  }
  const Icon = getInteractionIcon(interaction.type)

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-4 text-white">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Interaction Details</h2>
                <p className="text-green-100 text-sm">
                  {interaction.contact?.name} • {interaction.date}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-all duration-200"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="space-y-6">
            <div>
              <h3 className="flex items-center space-x-2 text-slate-700 font-semibold mb-2">
                <MessageCircle className="w-4 h-4" />
                <span>Summary</span>
              </h3>
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <p className="font-medium text-slate-800">{interaction.summary}</p>
              </div>
            </div>

            <div>
              <h3 className="flex items-center space-x-2 text-slate-700 font-semibold mb-2">
                <Clock className="w-4 h-4" />
                <span>Details</span>
              </h3>
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 space-y-3">
                <div className="flex items-center space-x-2">
                  <Icon className="w-4 h-4 text-slate-500" />
                  <span className="text-sm font-medium">Type:</span>
                  <span className="text-sm capitalize">{interaction.type.replace('_', ' ')}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  <span className="text-sm font-medium">Date:</span>
                  <span className="text-sm">{new Date(interaction.date).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {interaction.notes && (
              <div>
                <h3 className="flex items-center space-x-2 text-slate-700 font-semibold mb-2">
                  <MessageCircle className="w-4 h-4" />
                  <span>Notes</span>
                </h3>
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{interaction.notes}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------ Stats card UI ------------------------------ */

interface StatsCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ComponentType<any>
  trend?: { value: number; isPositive: boolean }
  color: string
}

function StatsCard({ title, value, subtitle, icon: Icon, trend, color }: StatsCardProps) {
  return (
    <div className="bg-white/60 backdrop-blur-sm rounded-xl border border-slate-200/60 shadow-sm p-4 hover:shadow-md transition-all duration-200">
      <div className="flex items-center justify-between mb-2">
        <div className={`w-8 h-8 rounded-lg bg-gradient-to-r ${color} flex items-center justify-center`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        {trend && (
          <div
            className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${
              trend.isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}
          >
            <TrendingUp className={`w-3 h-3 ${trend.isPositive ? '' : 'rotate-180'}`} />
            <span>{Math.abs(trend.value)}%</span>
          </div>
        )}
      </div>
      <div className="space-y-1">
        <div className="text-2xl font-bold text-slate-800">{value}</div>
        <div className="text-sm font-medium text-slate-600">{title}</div>
        {subtitle && <div className="text-xs text-slate-500">{subtitle}</div>}
      </div>
    </div>
  )
}

/* ------------------------------- Quick actions ------------------------------ */

function QuickActions() {
  return (
    <div className="bg-white/60 backdrop-blur-sm rounded-xl border border-slate-200/60 shadow-sm p-4">
      <h3 className="font-semibold text-slate-800 mb-3 flex items-center space-x-2">
        <Target className="w-4 h-4" />
        <span>Quick Actions</span>
      </h3>
      <div className="space-y-2">
        <button className="w-full text-left px-3 py-2 text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors">
          Schedule follow-ups
        </button>
        <button className="w-full text-left px-3 py-2 text-sm bg-green-50 hover:bg-green-100 text-green-700 rounded-lg transition-colors">
          Export contact list
        </button>
        <button className="w-full text-left px-3 py-2 text-sm bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg transition-colors">
          Generate reports
        </button>
      </div>
    </div>
  )
}

/* ------------------------------- Main component ----------------------------- */

export default function Reporting() {
  const [contacts, setContacts] = useState<ContactWithJobs[]>([])
  const [interactions, setInteractions] = useState<InteractionWithContact[]>([])
  const [loading, setLoading] = useState(true)
  // Updated to include reminders in the active section type
  const [activeSection, setActiveSection] = useState<ReportingSection>('overview')

  // Search and filter states
  const [contactSearch, setContactSearch] = useState('')
  const [interactionSearch, setInteractionSearch] = useState('')

  // Sort states
  const [contactSort, setContactSort] =
    useState<{ field: ContactSortField; direction: SortDirection }>({
      field: 'name',
      direction: 'asc'
    })
  const [interactionSort, setInteractionSort] =
    useState<{ field: InteractionSortField; direction: SortDirection }>({
      field: 'date',
      direction: 'desc'
    })

  // Modal states
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [selectedInteraction, setSelectedInteraction] =
    useState<InteractionWithContact | null>(null)

  // Stats
  const [contactStats, setContactStats] = useState<ContactStats | null>(null)
  const [interactionStats, setInteractionStats] =
    useState<InteractionStats | null>(null)

  // Load with RPCs (fast) but keep the same UI
  useEffect(() => {
    let mounted = true
    async function loadReportingData() {
      setLoading(true)
      const supabase = createClientComponentClient()
      const { data: { user } } = await supabase.auth.getUser()
      console.log('Reporting: Loading data for user:', user?.id, 'email:', user?.email)
      if (!mounted || !user) { setLoading(false); return }

      const [contactsData, interactionsData] = await Promise.all([
        rpcReportingContacts({
          userId: user.id,
          sort: 'last_interaction',
          dir: 'desc',
          limit: 10000,
          offset: 0
        }),
        rpcReportingRecentInteractions({ userId: user.id, limit: 500 })
      ])

      // Debug logging
      console.log('RPC returned contacts:', contactsData.length)
      console.log('RPC returned interactions:', interactionsData.length)
      
      // Debug mutual connections data
      console.log('Sample contact data:', contactsData.slice(0, 3))
      console.log('Contacts with mutual_connections field:', contactsData.filter(c => c.mutual_connections).length)
      console.log('Contacts with mutual_connections_count > 0:', contactsData.filter(c => c.mutual_connections_count > 0).length)

      // Map to your existing shapes with ALL fields properly populated
      const mappedContacts: ContactWithJobs[] = contactsData.map((r) => ({
        id: r.contact_id,
        name: r.name ?? '',
        company: r.company ?? undefined,
        job_title: r.job_title ?? undefined,
        email: r.email ?? undefined,
        phone: r.phone ?? undefined,
        linkedin_url: r.linkedin_url ?? undefined,
        notes: r.notes ?? undefined,
        experience: [],
        education: [],
        // Use the count from RPC, but fallback to array length if available
        mutual_connections: r.mutual_connections ?? [],
        user_id: user.id,
        created_at: '',
        updated_at: '',
        linkedJobsCount: r.linked_jobs_count,
        lastInteractionDate: r.last_interaction_date ?? undefined,
        interactionCount: r.interaction_count,
        // Store the mutual connections count for easy access
        mutual_connections_count: r.mutual_connections_count || 0
      }))

      const mappedInteractions: InteractionWithContact[] = interactionsData.map((r) => ({
        id: r.interaction_id,
        contact_id: r.contact_id,
        type: r.type as Interaction['type'],
        date: r.date,
        summary: r.summary ?? '',
        notes: r.notes ?? undefined,
        user_id: user.id,
        created_at: '',
        updated_at: '',
        contact: {
          id: r.contact_id,
          name: r.contact_name ?? 'Unknown Contact',
          user_id: user.id,
          created_at: '',
          updated_at: '',
          mutual_connections: [],
          experience: [],
          education: []
        } as Contact
      }))

      // FIXED: Stats derived client-side with correct calculations
      const now = new Date()
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)

      const thisMonthCount = mappedInteractions.filter(i => new Date(i.date) >= thisMonthStart).length
      const lastMonthCount = mappedInteractions.filter(i => {
        const d = new Date(i.date)
        return d >= lastMonthStart && d <= lastMonthEnd
      }).length

      const byType = mappedInteractions.reduce((acc, i) => {
        acc[i.type] = (acc[i.type] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      // FIXED: Only count companies that actually exist
      const companyCounts = mappedContacts.reduce((acc, c) => {
        if (c.company && c.company.trim()) {
          acc[c.company] = (acc[c.company] || 0) + 1
        }
        return acc
      }, {} as Record<string, number>)

      const topCompanies = Object.entries(companyCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([company, count]) => ({ company, count }))

      // FIXED: Correct mutual connections count using the count field from RPC
      const withMutualConnections = contactsData.filter(c => 
        (c.mutual_connections_count || 0) > 0
      ).length
      
      // Debug the calculation
      console.log('Contacts with mutual_connections_count > 0:', withMutualConnections)
      console.log('Sample mutual_connections_count values:', contactsData.slice(0, 10).map(c => c.mutual_connections_count))

      setContactStats({
        totalContacts: mappedContacts.length,
        withJobs: mappedContacts.filter(c => (c.linkedJobsCount || 0) > 0).length,
        withMutualConnections,
        topCompanies,
        recentContacts: mappedContacts
          .filter(c => c.lastInteractionDate)
          .sort((a, b) => {
            const dateA = a.lastInteractionDate ? new Date(a.lastInteractionDate) : new Date(0)
            const dateB = b.lastInteractionDate ? new Date(b.lastInteractionDate) : new Date(0)
            return dateB.getTime() - dateA.getTime()
          })
          .slice(0, 5)
      })

      setInteractionStats({
        totalInteractions: mappedInteractions.length,
        thisMonth: thisMonthCount,
        lastMonth: lastMonthCount,
        byType,
        recentActivity: mappedInteractions
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 8)
      })

      if (mounted) {
        setContacts(mappedContacts)
        setInteractions(mappedInteractions)
        setLoading(false)
      }
    }
    loadReportingData()
    return () => { mounted = false }
  }, [])

  /* ---------------------- Filtering/sorting (unchanged) --------------------- */

  const filteredAndSortedContacts = useMemo(() => {
    let filtered = [...contacts]
    if (contactSearch.trim()) {
      const search = contactSearch.toLowerCase()
      filtered = filtered.filter(contact =>
        contact.name.toLowerCase().includes(search) ||
        (contact.company && contact.company.toLowerCase().includes(search)) ||
        (contact.job_title && contact.job_title.toLowerCase().includes(search)) ||
        (contact.mutual_connections && contact.mutual_connections.some(conn =>
          conn.toLowerCase().includes(search)
        ))
      )
    }
    if (contactSort.field && contactSort.direction) {
      filtered.sort((a, b) => {
        let aValue: any
        let bValue: any
        switch (contactSort.field) {
          case 'name':
            aValue = a.name.toLowerCase(); bValue = b.name.toLowerCase(); break
          case 'company':
            aValue = (a.company || '').toLowerCase(); bValue = (b.company || '').toLowerCase(); break
          case 'job_title':
            aValue = (a.job_title || '').toLowerCase(); bValue = (b.job_title || '').toLowerCase(); break
          case 'mutual_connections_count':
            aValue = a.mutual_connections?.length || 0; bValue = b.mutual_connections?.length || 0; break
          case 'linkedJobsCount':
            aValue = a.linkedJobsCount || 0; bValue = b.linkedJobsCount || 0; break
          case 'lastInteraction':
            aValue = a.lastInteractionDate ? new Date(a.lastInteractionDate) : new Date(0)
            bValue = b.lastInteractionDate ? new Date(b.lastInteractionDate) : new Date(0)
            break
          default: return 0
        }
        if (aValue < bValue) return contactSort.direction === 'asc' ? -1 : 1
        if (aValue > bValue) return contactSort.direction === 'asc' ? 1 : -1
        return 0
      })
    }
    return filtered
  }, [contacts, contactSearch, contactSort])

  const filteredAndSortedInteractions = useMemo(() => {
    let filtered = [...interactions]
    if (interactionSearch.trim()) {
      const search = interactionSearch.toLowerCase()
      filtered = filtered.filter(interaction =>
        (interaction.contact?.name || '').toLowerCase().includes(search) ||
        interaction.type.toLowerCase().includes(search) ||
        interaction.summary.toLowerCase().includes(search) ||
        (interaction.notes && interaction.notes.toLowerCase().includes(search))
      )
    }
    if (interactionSort.field && interactionSort.direction) {
      filtered.sort((a, b) => {
        let aValue: any
        let bValue: any
        switch (interactionSort.field) {
          case 'date': aValue = new Date(a.date); bValue = new Date(b.date); break
          case 'contact_name':
            aValue = (a.contact?.name || '').toLowerCase(); bValue = (b.contact?.name || '').toLowerCase(); break
          case 'type': aValue = a.type.toLowerCase(); bValue = b.type.toLowerCase(); break
          case 'summary': aValue = a.summary.toLowerCase(); bValue = b.summary.toLowerCase(); break
          default: return 0
        }
        if (aValue < bValue) return interactionSort.direction === 'asc' ? -1 : 1
        if (aValue > bValue) return interactionSort.direction === 'asc' ? 1 : -1
        return 0
      })
    }
    return filtered
  }, [interactions, interactionSearch, interactionSort])

  const handleContactSort = (field: ContactSortField) => {
    setContactSort(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }
  const handleInteractionSort = (field: InteractionSortField) => {
    setInteractionSort(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }
  const getSortIcon = (field: string, currentSort: { field: string; direction: SortDirection }) => {
    if (currentSort.field !== field) return <ArrowUpDown className="w-4 h-4" />
    return currentSort.direction === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
  }
  const getInteractionIcon = (type: string) => {
    switch (type) {
      case 'email': return <Mail className="w-4 h-4" />
      case 'phone': return <Phone className="w-4 h-4" />
      case 'video_call': return <Video className="w-4 h-4" />
      case 'linkedin': return <Linkedin className="w-4 h-4" />
      case 'meeting': return <Calendar className="w-4 h-4" />
      default: return <MessageCircle className="w-4 h-4" />
    }
  }
  const getInteractionTypeColor = (type: string) => {
    switch (type) {
      case 'email': return 'bg-blue-100 text-blue-700'
      case 'phone': return 'bg-green-100 text-green-700'
      case 'video_call': return 'bg-purple-100 text-purple-700'
      case 'linkedin': return 'bg-blue-100 text-blue-800'
      case 'meeting': return 'bg-orange-100 text-orange-700'
      default: return 'bg-slate-100 text-slate-700'
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="flex items-center justify-between mb-4">
                <div className="w-8 h-8 bg-slate-200 rounded-lg"></div>
                <div className="w-16 h-6 bg-slate-200 rounded"></div>
              </div>
              <div className="space-y-2">
                <div className="w-12 h-8 bg-slate-200 rounded"></div>
                <div className="w-20 h-4 bg-slate-200 rounded"></div>
                <div className="w-16 h-3 bg-slate-200 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  /* ----------------------------------- UI ---------------------------------- */
  return (
    <>
      <div className="space-y-4 animate-fade-in">
        {/* Updated Section navigation to include reminders */}
        <div className="bg-white/60 backdrop-blur-sm rounded-xl border border-slate-200/60 shadow-sm">
          <div className="grid grid-cols-4 divide-x divide-slate-200/60">
            <button
              onClick={() => setActiveSection('overview')}
              className={`p-3 text-center transition-all duration-200 ${
                activeSection === 'overview'
                  ? 'bg-white/80 text-purple-700 font-medium'
                  : 'text-slate-600 hover:bg-white/40'
              } ${activeSection === 'overview' ? 'rounded-l-xl' : ''}`}
            >
              <div className="flex items-center justify-center space-x-2">
                <BarChart3 className="w-4 h-4" />
                <span className="text-sm">Overview</span>
                <span className="hidden sm:inline text-xs text-slate-500">
                  ({contactStats?.totalContacts || 0} contacts, {interactionStats?.totalInteractions || 0} interactions)
                </span>
              </div>
            </button>

            <button
              onClick={() => setActiveSection('contacts')}
              className={`p-3 text-center transition-all duration-200 ${
                activeSection === 'contacts'
                  ? 'bg-white/80 text-blue-700 font-medium'
                  : 'text-slate-600 hover:bg-white/40'
              }`}
            >
              <div className="flex items-center justify-center space-x-2">
                <Users className="w-4 h-4" />
                <span className="text-sm">Contacts</span>
                <span className="hidden sm:inline text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                  {filteredAndSortedContacts.length}
                </span>
              </div>
            </button>

            <button
              onClick={() => setActiveSection('interactions')}
              className={`p-3 text-center transition-all duration-200 ${
                activeSection === 'interactions'
                  ? 'bg-white/80 text-green-700 font-medium'
                  : 'text-slate-600 hover:bg-white/40'
              }`}
            >
              <div className="flex items-center justify-center space-x-2">
                <MessageCircle className="w-4 h-4" />
                <span className="text-sm">Interactions</span>
                <span className="hidden sm:inline text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                  {filteredAndSortedInteractions.length}
                </span>
              </div>
            </button>

            {/* New Reminders tab */}
            <button
              onClick={() => setActiveSection('reminders')}
              className={`p-3 text-center transition-all duration-200 ${
                activeSection === 'reminders'
                  ? 'bg-white/80 text-purple-700 font-medium'
                  : 'text-slate-600 hover:bg-white/40'
              } ${activeSection === 'reminders' ? 'rounded-r-xl' : ''}`}
            >
              <div className="flex items-center justify-center space-x-2">
                <Bell className="w-4 h-4" />
                <span className="text-sm">Reminders</span>
                <span className="hidden sm:inline text-xs text-slate-500">
                  Email follow-ups
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Overview */}
        {activeSection === 'overview' && (
          <div className="space-y-4">
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatsCard
                title="Total Contacts"
                value={contactStats?.totalContacts || 0}
                subtitle="Professional network"
                icon={Users}
                color="from-blue-500 to-blue-600"
              />
              <StatsCard
                title="Jobs with Linked Contacts"
                value={contactStats?.withJobs || 0}
                subtitle={`${((contactStats?.withJobs || 0) / Math.max(contactStats?.totalContacts || 1, 1) * 100).toFixed(0)}% of jobs`}
                icon={Briefcase}
                color="from-green-500 to-green-600"
              />
              <StatsCard
                title="This Month"
                value={interactionStats?.thisMonth || 0}
                subtitle="Interactions"
                icon={Activity}
                trend={
                  interactionStats?.lastMonth && interactionStats.lastMonth > 0
                    ? {
                        value: Math.round(((interactionStats.thisMonth - interactionStats.lastMonth) / interactionStats.lastMonth) * 100),
                        isPositive: (interactionStats?.thisMonth || 0) >= (interactionStats?.lastMonth || 0)
                      }
                    : undefined
                }
                color="from-purple-500 to-purple-600"
              />
              <StatsCard
                title="Contacts with Mutual Connections"
                value={contactStats?.withMutualConnections || 0}
                subtitle={`${((contactStats?.withMutualConnections || 0) / Math.max(contactStats?.totalContacts || 1, 1) * 100).toFixed(0)}% of contacts`}
                icon={Network}
                color="from-orange-500 to-orange-600"
              />
            </div>

            {/* Dashboard grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Recent Activity */}
              <div className="lg:col-span-2 bg-white/60 backdrop-blur-sm rounded-xl border border-slate-200/60 shadow-sm">
                <div className="p-4 border-b border-slate-200/60">
                  <h3 className="font-semibold text-slate-800 flex items-center space-x-2">
                    <Activity className="w-4 h-4" />
                    <span>Recent Activity</span>
                  </h3>
                </div>
                <div className="p-2">
                  <div className="space-y-1">
                    {interactionStats?.recentActivity.slice(0, 6).map((interaction) => (
                      <div
                        key={interaction.id}
                        onClick={() => setSelectedInteraction(interaction)}
                        className="p-3 rounded-lg hover:bg-slate-50/80 cursor-pointer transition-colors group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center ${getInteractionTypeColor(interaction.type)}`}
                            >
                              {getInteractionIcon(interaction.type)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center space-x-2">
                                <span className="font-medium text-slate-900 text-sm group-hover:text-blue-600 transition-colors">
                                  {interaction.contact?.name || 'Unknown'}
                                </span>
                                <span className="text-xs text-slate-500">•</span>
                                <span
                                  className={`text-xs px-2 py-1 rounded-full font-medium ${getInteractionTypeColor(
                                    interaction.type
                                  )}`}
                                >
                                  {interaction.type.replace('_', ' ')}
                                </span>
                              </div>
                              <p className="text-sm text-slate-600 truncate mt-0.5">{interaction.summary}</p>
                            </div>
                          </div>
                          <div className="text-xs text-slate-500 text-right">
                            <div>
                              {new Date(interaction.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {(!interactionStats?.recentActivity || interactionStats.recentActivity.length === 0) && (
                      <div className="p-8 text-center text-slate-500">
                        <Activity className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <p>No recent activity</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right column: Top Companies + Interaction Types */}
              <div className="space-y-4">
                {/* Top Companies */}
                <div className="bg-white/60 backdrop-blur-sm rounded-xl border border-slate-200/60 shadow-sm p-4">
                  <h3 className="font-semibold text-slate-800 mb-3 flex items-center space-x-2">
                    <Building className="w-4 h-4" />
                    <span>Top Companies</span>
                  </h3>
                  <div className="space-y-2">
                    {(contactStats?.topCompanies || []).map((item) => (
                      <div key={item.company} className="flex items-center justify-between">
                        <span className="text-sm text-slate-700 truncate">{item.company}</span>
                        <div className="flex items-center space-x-2">
                          <div className="w-12 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full transition-all duration-300"
                              style={{
                                width: `${Math.max((item.count / Math.max(contactStats?.totalContacts || 1, 1)) * 100, 5)}%`
                              }}
                            />
                          </div>
                          <span className="text-xs font-medium text-slate-600 w-6 text-right">{item.count}</span>
                        </div>
                      </div>
                    ))}
                    {(contactStats?.topCompanies?.length ?? 0) === 0 && (
                      <div className="text-sm text-slate-500 text-center py-4">
                        <Building className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                        <p>No company data yet</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Interaction Types */}
                <div className="bg-white/60 backdrop-blur-sm rounded-xl border border-slate-200/60 shadow-sm p-4">
                  <h3 className="font-semibold text-slate-800 mb-3 flex items-center space-x-2">
                    <MessageSquare className="w-4 h-4" />
                    <span>Interaction Types</span>
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(interactionStats?.byType || {})
                      .sort(([, a], [, b]) => (b as number) - (a as number))
                      .map(([type, count]) => (
                        <div key={type} className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            {getInteractionIcon(type)}
                            <span className="text-sm text-slate-700 capitalize">{type.replace('_', ' ')}</span>
                          </div>
                          <span className="text-sm font-medium text-slate-600">{count as number}</span>
                        </div>
                      ))}
                    {Object.keys(interactionStats?.byType || {}).length === 0 && (
                      <div className="text-sm text-slate-500 text-center py-4">
                        <MessageSquare className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                        <p>No interactions yet</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Contacts Section */}
        {activeSection === 'contacts' && (
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search contacts by name, company, title, or mutual connections..."
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white/70 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 text-sm"
              />
            </div>

            {/* Table */}
            <div className="bg-white/70 backdrop-blur-sm rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50/80 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        <button
                          onClick={() => handleContactSort('name')}
                          className="flex items-center space-x-2 font-semibold text-slate-700 hover:text-slate-900 transition-colors text-sm"
                        >
                          <span>Name</span>
                          {getSortIcon('name', contactSort)}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <button
                          onClick={() => handleContactSort('company')}
                          className="flex items-center space-x-2 font-semibold text-slate-700 hover:text-slate-900 transition-colors text-sm"
                        >
                          <span>Title • Company</span>
                          {getSortIcon('company', contactSort)}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <button
                          onClick={() => handleContactSort('linkedJobsCount')}
                          className="flex items-center space-x-2 font-semibold text-slate-700 hover:text-slate-900 transition-colors text-sm"
                        >
                          <span>Linked jobs</span>
                          {getSortIcon('linkedJobsCount', contactSort)}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <button
                          onClick={() => handleContactSort('lastInteraction')}
                          className="flex items-center space-x-2 font-semibold text-slate-700 hover:text-slate-900 transition-colors text-sm"
                        >
                          <span>Last interaction</span>
                          {getSortIcon('lastInteraction', contactSort)}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <button
                          onClick={() => handleContactSort('mutual_connections_count')}
                          className="flex items-center space-x-2 font-semibold text-slate-700 hover:text-slate-900 transition-colors text-sm"
                        >
                          <span>Mutual connections</span>
                          {getSortIcon('mutual_connections_count', contactSort)}
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredAndSortedContacts.map((contact) => (
                      <tr
                        key={contact.id}
                        className="hover:bg-slate-50/50 cursor-pointer transition-colors"
                        onClick={() => setSelectedContact(contact)}
                      >
                        <td className="px-4 py-3">
                          <div className="text-sm">
                            <div className="font-medium text-slate-900 hover:text-blue-600 transition-colors">
                              {contact.name || '—'}
                            </div>
                            <div className="text-xs text-slate-500">
                              {contact.email || ''}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-slate-900">
                            {contact.job_title && <span>{contact.job_title}</span>}
                            {contact.job_title && contact.company && <span> • </span>}
                            {contact.company && <span className="text-slate-700">{contact.company}</span>}
                            {!contact.job_title && !contact.company && <span>—</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-slate-900">{contact.linkedJobsCount ?? 0}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-slate-900">
                            {contact.lastInteractionDate
                              ? new Date(contact.lastInteractionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                              : '—'}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-slate-900">
                            {contact.mutual_connections_count ?? contact.mutual_connections?.length ?? 0}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredAndSortedContacts.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  {contactSearch ? 'No contacts match your search.' : 'No contacts found.'}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Interactions Section */}
        {activeSection === 'interactions' && (
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search interactions by contact, type, or summary..."
                value={interactionSearch}
                onChange={(e) => setInteractionSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white/70 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 text-sm"
              />
            </div>

            {/* Table */}
            <div className="bg-white/70 backdrop-blur-sm rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50/80 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        <button
                          onClick={() => handleInteractionSort('date')}
                          className="flex items-center space-x-2 font-semibold text-slate-700 hover:text-slate-900 transition-colors text-sm"
                        >
                          <span>Date</span>
                          {getSortIcon('date', interactionSort)}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <button
                          onClick={() => handleInteractionSort('contact_name')}
                          className="flex items-center space-x-2 font-semibold text-slate-700 hover:text-slate-900 transition-colors text-sm"
                        >
                          <span>Contact</span>
                          {getSortIcon('contact_name', interactionSort)}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <button
                          onClick={() => handleInteractionSort('type')}
                          className="flex items-center space-x-2 font-semibold text-slate-700 hover:text-slate-900 transition-colors text-sm"
                        >
                          <span>Type</span>
                          {getSortIcon('type', interactionSort)}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <button
                          onClick={() => handleInteractionSort('summary')}
                          className="flex items-center space-x-2 font-semibold text-slate-700 hover:text-slate-900 transition-colors text-sm"
                        >
                          <span>Summary</span>
                          {getSortIcon('summary', interactionSort)}
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredAndSortedInteractions.map((interaction) => (
                      <tr
                        key={interaction.id}
                        className="hover:bg-slate-50/50 cursor-pointer transition-colors"
                        onClick={() => setSelectedInteraction(interaction)}
                      >
                        <td className="px-4 py-3">
                          <div className="text-sm">
                            <div className="font-medium text-slate-900">
                              {new Date(interaction.date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </div>
                            <div className="text-xs text-slate-500">
                              {new Date(interaction.date).toLocaleDateString('en-US', {
                                weekday: 'short'
                              })}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center space-x-3">
                            <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                              <User className="w-3.5 h-3.5 text-white" />
                            </div>
                            <div className="font-medium text-slate-900 hover:text-blue-600 transition-colors text-sm truncate">
                              {interaction.contact?.name || 'Unknown Contact'}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getInteractionTypeColor(interaction.type)}`}>
                            {getInteractionIcon(interaction.type)}
                            <span className="capitalize">
                              {interaction.type.replace('_', ' ')}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-slate-900 max-w-md truncate">
                            {interaction.summary}
                          </div>
                          {interaction.notes && (
                            <div className="text-xs text-slate-500 truncate mt-0.5">
                              {interaction.notes}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredAndSortedInteractions.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  {interactionSearch ? 'No interactions match your search.' : 'No interactions found.'}
                </div>
              )}
            </div>
          </div>
        )}

        {/* New Reminders Section */}
        {activeSection === 'reminders' && (
          <RemindersManagement />
        )}
      </div>

      {/* Modals */}
      {selectedContact && (
        <ContactModal contact={selectedContact} onClose={() => setSelectedContact(null)} />
      )}
      {selectedInteraction && (
        <InteractionModal interaction={selectedInteraction} onClose={() => setSelectedInteraction(null)} />
      )}
    </>
  )
}
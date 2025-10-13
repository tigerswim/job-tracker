// src/components/ContactList.tsx - Performance Optimized Version with Reminder Button
'use client'

import { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react'
import { Contact } from '@/lib/supabase'
import { getContactsLite, getContactById, deleteContact } from '@/lib/contacts'
import { getJobsForContacts } from '@/lib/jobContacts'
import { 
  Plus, 
  Search, 
  Filter, 
  Users, 
  Mail, 
  Phone, 
  Building, 
  Edit,
  Trash2,
  X,
  MessageCircle,
  Linkedin,
  User,
  GraduationCap,
  Briefcase,
  Network,
  ExternalLink,
  ChevronUp,
  ChevronDown,
  Bell
} from 'lucide-react'
import ContactForm from './ContactForm'
import ContactJobLinks from './ContactJobLinks'
import ContactFilter from './ContactFilter'
import CreateReminderModal from './modals/CreateReminderModal'

// Lazy-loaded InteractionList to avoid loading it until needed
import { lazy, Suspense } from 'react'
const InteractionList = lazy(() => import('./InteractionList'))
// Import new hybrid components
import ResizablePanel from './ui/ResizablePanel'
import BottomSheet from './ui/BottomSheet'

// Constants for performance
const CONTACTS_PER_PAGE = 50
const DEBOUNCE_DELAY = 300

// Smart text truncation component (similar to InteractionCard)
const TruncatedText = ({ 
  text, 
  maxLines = 2, 
  className = '',
  showToggle = true 
}: { 
  text: string
  maxLines?: number
  className?: string
  showToggle?: boolean
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  
  // Calculate if text needs truncation (rough estimation)
  const shouldTruncate = text.length > maxLines * 60 // Slightly shorter for contact cards
  
  const toggleExpansion = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setIsExpanded(!isExpanded)
  }, [isExpanded])

  if (!shouldTruncate || isExpanded) {
    return (
      <div className={className}>
        <p className="whitespace-pre-wrap text-xs">{text}</p>
        {shouldTruncate && showToggle && (
          <button
            onClick={toggleExpansion}
            className="text-blue-600 hover:text-blue-800 text-xs font-medium mt-1 flex items-center space-x-1"
          >
            <ChevronUp className="w-3 h-3" />
            <span>Show less</span>
          </button>
        )}
      </div>
    )
  }

  return (
    <div className={className}>
      <p 
        className={`whitespace-pre-wrap text-xs line-clamp-${maxLines}`}
        style={{
          display: '-webkit-box',
          WebkitLineClamp: maxLines,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden'
        }}
      >
        {text}
      </p>
      {showToggle && (
        <button
          onClick={toggleExpansion}
          className="text-blue-600 hover:text-blue-800 text-xs font-medium mt-1 flex items-center space-x-1"
        >
          <ChevronDown className="w-3 h-3" />
          <span>Show more</span>
        </button>
      )}
    </div>
  )
}

// Resizable text area component for modal fields
const ResizableTextArea = ({ 
  text, 
  className = '',
  minHeight = 100,
  maxHeight = 400
}: { 
  text: string | null | undefined
  className?: string
  minHeight?: number
  maxHeight?: number
}) => {
  const [height, setHeight] = useState(minHeight)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startY = e.clientY
    const startHeight = height
    
    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - startY
      const newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight + deltaY))
      setHeight(newHeight)
    }
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [height, minHeight, maxHeight])
  
  return (
    <div className={className}>
      <textarea
        ref={textareaRef}
        value={text || ''}
        readOnly
        className="w-full p-3 text-sm text-slate-700 bg-white border border-slate-200 rounded-lg resize-y focus:outline-none"
        style={{ height: `${height}px`, minHeight: `${minHeight}px`, maxHeight: `${maxHeight}px` }}
      />
    </div>
  )
}

// Memoized Contact Card Component
const ContactCard = memo(({ 
  contact, 
  index, 
  isSelected, 
  contactIdToJobs, 
  contactNameMap, 
  onClick, 
  onEdit, 
  onDelete,
  onMutualConnectionClick,
  onCreateReminder
}: {
  contact: Contact
  index: number
  isSelected: boolean
  contactIdToJobs: Record<string, any[]>
  contactNameMap: Map<string, Contact>
  onClick: (id: string) => void
  onEdit: (contact: Contact) => void
  onDelete: (id: string) => void
  onMutualConnectionClick: (connectionName: string) => void
  onCreateReminder: (contact: Contact) => void
}) => {
  const formatExperience = useCallback((contact: Contact) => {
    if (!contact.experience || contact.experience.length === 0) return null
    const currentRole = contact.experience.find(exp => exp.is_current)
    const mostRecentRole = contact.experience[0]
    const displayRole = currentRole || mostRecentRole
    if (displayRole) {
      return `${displayRole.title} at ${displayRole.company}`
    }
    return null
  }, [])

  const formatEducation = useCallback((contact: Contact) => {
    if (!contact.education || contact.education.length === 0) return null
    const recentEducation = contact.education[0]
    return `${recentEducation.degree_and_field}, ${recentEducation.institution}`
  }, [])

  return (
    <div
      className={`card p-3 cursor-pointer transition-all duration-200 animate-slide-up relative ${
        isSelected
          ? 'ring-2 ring-blue-500 border-blue-300 bg-blue-50/50'
          : 'hover:shadow-lg hover:scale-[1.02]'
      }`}
      style={{ animationDelay: `${index * 30}ms` }}
      onClick={() => onClick(contact.id)}
    >
      {/* Header with name and actions */}
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center space-x-2 flex-1 min-w-0">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-white" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-slate-800 truncate">{contact.name}</h3>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onCreateReminder(contact)
            }}
            className="p-1 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-all duration-200"
            title="Create reminder"
          >
            <Bell className="w-3 h-3" />
          </button>
          <button
            onClick={async (e) => {
              e.stopPropagation()
              onEdit(contact)
            }}
            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all duration-200"
            title="Edit contact"
          >
            <Edit className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete(contact.id)
            }}
            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-all duration-200"
            title="Delete contact"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Company - Condensed */}
      {contact.company && (
        <div className="flex items-center space-x-1 text-slate-600 mb-1">
          <Building className="w-3 h-3 flex-shrink-0 text-slate-400" />
          <p className="text-xs truncate">{contact.company}</p>
        </div>
      )}

      {/* Job Title - Condensed */}
      {contact.job_title && (
        <div className="flex items-center space-x-1 text-slate-600 mb-1">
          <Briefcase className="w-3 h-3 flex-shrink-0 text-slate-400" />
          <p className="text-xs truncate">{contact.job_title}</p>
        </div>
      )}

      {/* LinkedIn - Clickable if populated */}
      {contact.linkedin_url && (
        <div className="flex items-center space-x-1 text-xs text-slate-500 mb-1">
          <Linkedin className="w-3 h-3 text-slate-400" />
          <a 
            href={contact.linkedin_url} 
            target="_blank" 
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-blue-600 hover:text-blue-800 hover:underline truncate"
          >
            LinkedIn Profile
          </a>
        </div>
      )}

      {/* Notes Preview - Condensed */}
      {contact.notes && (
        <div className="bg-slate-50 rounded p-2 border border-slate-100 mb-2">
          <p className="text-xs text-slate-700 line-clamp-2">{contact.notes}</p>
        </div>
      )}

      {/* Contact Details - Condensed */}
      <div className="space-y-1 mb-2">
        {contact.email && (
          <div className="flex items-center space-x-1 text-xs text-slate-500">
            <Mail className="w-3 h-3 text-slate-400" />
            <span className="truncate">{contact.email}</span>
          </div>
        )}
        {contact.phone && (
          <div className="flex items-center space-x-1 text-xs text-slate-500">
            <Phone className="w-3 h-3 text-slate-400" />
            <span>{contact.phone}</span>
          </div>
        )}
      </div>

      {/* Education - Condensed */}
      {formatEducation(contact) && (
        <div className="flex items-center space-x-1 text-xs text-slate-500 mb-2">
          <GraduationCap className="w-3 h-3 flex-shrink-0 text-slate-400" />
          <p className="truncate">{formatEducation(contact)}</p>
        </div>
      )}

      {/* Mutual Connections - Ultra Compact */}
      {contact.mutual_connections && contact.mutual_connections.length > 0 && (
        <div className="mb-2">
          <div className="flex items-center space-x-1 mb-1">
            <Network className="w-3 h-3 text-slate-400" />
            <span className="text-xs text-slate-500">
              {contact.mutual_connections.length} mutual
            </span>
          </div>
          <MutualConnections
            connections={contact.mutual_connections}
            contactNameMap={contactNameMap}
            onConnectionClick={onMutualConnectionClick}
          />
        </div>
      )}

      {/* Linked Jobs - Count Badge only */}
      {contactIdToJobs[contact.id] && contactIdToJobs[contact.id].length > 0 && (
        <div className="mb-2">
          <div className="inline-flex items-center gap-2 px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs border border-blue-200">
            <Briefcase className="w-3 h-3" />
            <span>{contactIdToJobs[contact.id].length} linked job{contactIdToJobs[contact.id].length > 1 ? 's' : ''}</span>
          </div>
        </div>
      )}

      {/* Selected Indicator */}
      {isSelected && (
        <div className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full animate-pulse">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping absolute"></div>
        </div>
      )}
    </div>
  )
})
ContactCard.displayName = 'ContactCard'

// Contact Modal Component (unchanged but memoized)
interface ContactModalProps {
  contact: Contact
  onClose: () => void
  onEdit: (contact: Contact) => void
}

const ContactModal = memo(({ contact, onClose, onEdit }: ContactModalProps) => {
  const formatExperience = useCallback((contact: Contact) => {
    if (!contact.experience || contact.experience.length === 0) return null
    const currentRole = contact.experience.find(exp => exp.is_current)
    const mostRecentRole = contact.experience[0]
    const displayRole = currentRole || mostRecentRole
    if (displayRole) {
      return `${displayRole.title} at ${displayRole.company}`
    }
    return null
  }, [])

  const formatEducation = useCallback((contact: Contact) => {
    if (!contact.education || contact.education.length === 0) return null
    const recentEducation = contact.education[0]
    return `${recentEducation.degree_and_field}, ${recentEducation.institution}`
  }, [])

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 text-white">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <User className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">{contact.name}</h2>
                <p className="text-blue-100 text-xs">Contact Details</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => onEdit(contact)}
                className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-all duration-200"
                title="Edit contact"
              >
                <Edit className="w-3 h-3" />
              </button>
              <button
                onClick={onClose}
                className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-all duration-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(80vh-80px)]">
          <div className="space-y-4">
            {/* Current Role */}
            {(contact.job_title && contact.company) || formatExperience(contact) ? (
              <div>
                <h3 className="flex items-center space-x-2 text-slate-700 font-medium mb-2 text-sm">
                  <Building className="w-3 h-3" />
                  <span>Current Role</span>
                </h3>
                <div className="bg-slate-50 rounded-lg p-2 border border-slate-200">
                  {contact.job_title && contact.company ? (
                    <p className="font-medium text-xs">{contact.job_title} at {contact.company}</p>
                  ) : (
                    formatExperience(contact) && (
                      <p className="font-medium text-xs">{formatExperience(contact)}</p>
                    )
                  )}
                </div>
              </div>
            ) : null}

            {/* Contact Information */}
            <div>
              <h3 className="flex items-center space-x-2 text-slate-700 font-medium mb-2 text-sm">
                <Mail className="w-3 h-3" />
                <span>Contact Information</span>
              </h3>
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 space-y-2">
                {contact.email && (
                  <div className="flex items-center space-x-2 text-xs">
                    <Mail className="w-3 h-3 text-slate-400" />
                    <span>{contact.email}</span>
                  </div>
                )}
                {contact.phone && (
                  <div className="flex items-center space-x-2 text-xs">
                    <Phone className="w-3 h-3 text-slate-400" />
                    <span>{contact.phone}</span>
                  </div>
                )}
                {contact.linkedin_url && (
                  <div className="flex items-center space-x-2 text-xs">
                    <Linkedin className="w-3 h-3 text-slate-400" />
                    <a 
                      href={contact.linkedin_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                    >
                      <span>LinkedIn Profile</span>
                      <ExternalLink className="w-2 h-2" />
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Education */}
            {formatEducation(contact) && (
              <div>
                <h3 className="flex items-center space-x-2 text-slate-700 font-medium mb-2 text-sm">
                  <GraduationCap className="w-3 h-3" />
                  <span>Education</span>
                </h3>
                <div className="bg-slate-50 rounded-lg p-2 border border-slate-200">
                  <p className="text-xs">{formatEducation(contact)}</p>
                </div>
              </div>
            )}

            {/* Work Experience */}
            {contact.experience && contact.experience.length > 0 && (
              <div>
                <h3 className="flex items-center space-x-2 text-slate-700 font-medium mb-2 text-sm">
                  <Briefcase className="w-3 h-3" />
                  <span>Work Experience</span>
                </h3>
                <div className="space-y-2">
                  {contact.experience.map((exp, index) => (
                    <div key={exp.id || index} className="bg-slate-50 rounded-lg p-2 border border-slate-200">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-medium text-xs">{exp.title}</h4>
                        {exp.is_current && (
                          <span className="px-1.5 py-0.5 bg-green-100 text-green-800 text-xs rounded-full">
                            Current
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 mb-1">{exp.company}</p>
                      {(exp.start_date || exp.end_date) && (
                        <p className="text-xs text-slate-500 mb-2">
                          {exp.start_date} - {exp.is_current ? 'Present' : (exp.end_date || 'Present')}
                        </p>
                      )}
                      {exp.description && (
                        <div className="mt-2">
                          <ResizableTextArea
                            text={exp.description}
                            minHeight={80}
                            maxHeight={300}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Mutual Connections */}
            {contact.mutual_connections && contact.mutual_connections.length > 0 && (
              <div>
                <h3 className="flex items-center space-x-2 text-slate-700 font-medium mb-2 text-sm">
                  <Network className="w-3 h-3" />
                  <span>Mutual Connections</span>
                </h3>
                <div className="bg-slate-50 rounded-lg p-2 border border-slate-200">
                  <div className="flex flex-wrap gap-1">
                    {contact.mutual_connections.map((connection, idx) => (
                      <span
                        key={idx}
                        className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs"
                      >
                        {connection}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Linked Jobs */}
            <div>
              <h3 className="flex items-center space-x-2 text-slate-700 font-medium mb-2 text-sm">
                <Briefcase className="w-3 h-3" />
                <span>Associated Job Applications</span>
              </h3>
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                <ContactJobLinks contactId={contact.id} compact={false} />
              </div>
            </div>

            {/* Notes */}
            {contact.notes && (
              <div>
                <h3 className="flex items-center space-x-2 text-slate-700 font-medium mb-2 text-sm">
                  <MessageCircle className="w-3 h-3" />
                  <span>Notes</span>
                </h3>
                <ResizableTextArea
                  text={contact.notes}
                  minHeight={100}
                  maxHeight={400}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
})
ContactModal.displayName = 'ContactModal'

// Compact MutualConnections Component (memoized)
interface MutualConnectionsProps {
  connections: string[]
  contactNameMap: Map<string, Contact>
  onConnectionClick: (connectionName: string) => void
  stopPropagation?: boolean
}

const MutualConnections = memo(({ connections, contactNameMap, onConnectionClick, stopPropagation = true }: MutualConnectionsProps) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const maxInitialDisplay = 2

  const isContactInSystem = useCallback((connectionName: string | null | undefined): Contact | null => {
    const safeName = (connectionName || '').toLowerCase().trim()
    return contactNameMap.get(safeName) || null
  }, [contactNameMap])

  const handleConnectionClick = useCallback((e: React.MouseEvent, connectionName: string) => {
    if (stopPropagation) {
      e.stopPropagation()
    }
    const existingContact = isContactInSystem(connectionName)
    if (existingContact) {
      onConnectionClick(connectionName)
    }
  }, [stopPropagation, isContactInSystem, onConnectionClick])

  const handleExpandClick = useCallback((e: React.MouseEvent) => {
    if (stopPropagation) {
      e.stopPropagation()
    }
    setIsExpanded(!isExpanded)
  }, [stopPropagation, isExpanded])

  if (!connections || connections.length === 0) return null

  const initialConnections = connections.slice(0, maxInitialDisplay)
  const remainingConnections = connections.slice(maxInitialDisplay)
  const displayConnections = isExpanded ? connections : initialConnections

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1">
        {displayConnections.map((connection, idx) => {
          const existingContact = isContactInSystem(connection)
          return (
            <span
              key={idx}
              onClick={(e) => handleConnectionClick(e, connection)}
              className={`px-1.5 py-0.5 rounded text-xs transition-all duration-200 ${
                existingContact
                  ? 'bg-blue-100 text-blue-700 border border-blue-300 cursor-pointer hover:bg-blue-200 font-medium'
                  : 'bg-slate-100 text-slate-600'
              }`}
              title={existingContact ? 'Click to view contact details' : connection}
            >
              {connection.length > 12 ? connection.substring(0, 12) + '...' : connection}
              {existingContact && (
                <ExternalLink className="w-2 h-2 inline ml-0.5" />
              )}
            </span>
          )
        })}
        
        {/* Expansion/Collapse Button */}
        {remainingConnections.length > 0 && (
          <button
            onClick={handleExpandClick}
            className="px-1.5 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-xs transition-all duration-200 flex items-center space-x-1"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-2 h-2" />
                <span>less</span>
              </>
            ) : (
              <>
                <span>+{remainingConnections.length}</span>
                <ChevronDown className="w-2 h-2" />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
})
MutualConnections.displayName = 'MutualConnections'

// Custom hook for debounced search
const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

export default function ContactList() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [modalContact, setModalContact] = useState<Contact | null>(null)
  const [contactIdToJobs, setContactIdToJobs] = useState<Record<string, any[]>>({})
  const [displayedContactsCount, setDisplayedContactsCount] = useState(20)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  // Reminder modal state
  const [showReminderModal, setShowReminderModal] = useState(false)
  const [reminderContact, setReminderContact] = useState<Contact | null>(null)
  const [jobs, setJobs] = useState<any[]>([])

  // Mobile interactions state
  const [showMobileInteractions, setShowMobileInteractions] = useState(false)
  
  // Track available width for responsive grid
  const [availableWidth, setAvailableWidth] = useState<number>(1200)
  const [isClient, setIsClient] = useState(false)

  // Calculate optimal grid columns based on available width
  const getGridColumns = useCallback(() => {
    if (!isClient) return '3' // Default to 3 during SSR
    
    // Mobile breakpoint - always single column on small screens
    if (typeof window !== 'undefined' && window.innerWidth < 640) return '1'
    
    // For larger screens, base it on the available width of the contacts area
    // Each card needs roughly 300px minimum width + gap
    const cardMinWidth = 300
    const gapWidth = 16 // 4 * 4px (gap-4)
    
    if (availableWidth >= (cardMinWidth * 3) + (gapWidth * 2)) return '3'
    if (availableWidth >= (cardMinWidth * 2) + gapWidth) return '2'
    return '1'
  }, [availableWidth, isClient])

  const gridCols = getGridColumns()
  
  // Debug: Log grid changes for development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`Grid columns: ${gridCols}, Available width: ${availableWidth}px`)
    }
  }, [gridCols, availableWidth])
  
  // Debug: Log mobile interactions state
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Mobile interactions state:', {
        isClient,
        showMobileInteractions,
        selectedContactId,
        isOpen: showMobileInteractions && !!selectedContactId
      })
    }
  }, [isClient, showMobileInteractions, selectedContactId])

  // Set client flag after mount
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Debounced search term for performance
  const debouncedSearchTerm = useDebounce(searchTerm, DEBOUNCE_DELAY)

  useEffect(() => {
    loadContacts()
  }, [])

  const loadContacts = useCallback(async () => {
    setLoading(true)
    try {
      // Step 1: Load contacts FAST - show them immediately
      console.time('contacts-load-only')
      const data = await getContactsLite()
      setContacts(data as unknown as Contact[])
      console.timeEnd('contacts-load-only')
      
      // Show contacts immediately to user
      setLoading(false)
      
      // Step 2: Load jobs in background (non-blocking UI)
      if (data.length > 0) {
        setTimeout(async () => {
          console.time('jobs-background-load')
          try {
            const map = await getJobsForContacts((data as any).map((c: any) => c.id))
            setContactIdToJobs(map)
            console.timeEnd('jobs-background-load')
          } catch (e) {
            console.error('Error fetching jobs for contacts:', e)
            setContactIdToJobs({})
          }
        }, 50) // Small delay to let contacts render first
      }
    } catch (error) {
      console.error('Error loading contacts:', error)
      setLoading(false)
    }
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    if (confirm('Are you sure you want to delete this contact?')) {
      const success = await deleteContact(id)
      if (success) {
        loadContacts()
        if (selectedContactId === id) {
          setSelectedContactId(null)
        }
      }
    }
  }, [selectedContactId, loadContacts])

  const handleFormSuccess = useCallback(() => {
    setShowForm(false)
    setEditingContact(null)
    loadContacts()
  }, [loadContacts])

  const handleEditContact = useCallback(async (contact: Contact) => {
    // Load full contact data for editing
    const fullContact = await getContactById(contact.id)
    setEditingContact(fullContact || contact)
    setShowForm(true)
  }, [])

  // Close mobile interactions when contact selection changes
  useEffect(() => {
    if (!selectedContactId) {
      setShowMobileInteractions(false)
    }
  }, [selectedContactId])

  // Track available width for responsive grid
  useEffect(() => {
    if (!isClient) return
    
    const mainArea = document.querySelector('.contacts-main-area')
    if (!mainArea) {
      // If not found immediately, try again in next frame
      requestAnimationFrame(() => {
        const mainAreaRetry = document.querySelector('.contacts-main-area')
        if (mainAreaRetry) {
          setAvailableWidth(mainAreaRetry.getBoundingClientRect().width)
        }
      })
      return
    }

    // Initial width measurement
    setAvailableWidth(mainArea.getBoundingClientRect().width)

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Use getBoundingClientRect for more accurate measurements
        const newWidth = entry.target.getBoundingClientRect().width
        setAvailableWidth(newWidth)
      }
    })

    resizeObserver.observe(mainArea)
    
    // Also listen for window resize to handle mobile orientation changes
    const handleWindowResize = () => {
      const currentWidth = mainArea.getBoundingClientRect().width
      setAvailableWidth(currentWidth)
    }
    
    window.addEventListener('resize', handleWindowResize)
    
    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', handleWindowResize)
    }
  }, [isClient])

  const handleCreateReminder = useCallback((contact: Contact) => {
    setReminderContact(contact)
    setShowReminderModal(true)
  }, [])

  const handleReminderModalClose = useCallback(() => {
    setShowReminderModal(false)
    setReminderContact(null)
  }, [])

  const handleReminderModalSuccess = useCallback(() => {
    setShowReminderModal(false)
    setReminderContact(null)
    // Could optionally show a success message
  }, [])

  // Create a map for quick contact lookup by name (memoized)
  const contactNameMap = useMemo(() => {
    const map = new Map<string, Contact>()
    contacts.forEach(contact => {
      const safeName = (contact.name || '').toLowerCase().trim()
      if (safeName) {
        map.set(safeName, contact)
      }
    })
    return map
  }, [contacts])

  // Handle clicking on mutual connection
  const handleMutualConnectionClick = useCallback(async (connectionName: string) => {
    const contact = contactNameMap.get(connectionName.toLowerCase().trim())
    if (contact) {
      const full = await getContactById(contact.id)
      handleEditContact(full || contact)
    }
  }, [contactNameMap, handleEditContact])

  // Enhanced filter contacts based on debounced search term (memoized)
  const filteredContacts = useMemo(() => {
    if (!debouncedSearchTerm.trim()) {
      return contacts
    }

    const term = debouncedSearchTerm.toLowerCase()
    return contacts.filter(contact => {
      // Basic fields - add null checks before toLowerCase()
      const basicMatch = (contact.name || '').toLowerCase().includes(term) ||
        (contact.company || '').toLowerCase().includes(term) ||
        (contact.email || '').toLowerCase().includes(term) ||
        (contact.job_title || '').toLowerCase().includes(term) ||
        (contact.notes || '').toLowerCase().includes(term)
      
      // Experience search - add null checks for company and title
      const experienceMatch = contact.experience?.some(exp =>
        (exp.company || '').toLowerCase().includes(term) ||
        (exp.title || '').toLowerCase().includes(term) ||
        (exp.description && exp.description.toLowerCase().includes(term))
      )
      
      // Education search - add null checks for institution and degree_and_field
      const educationMatch = contact.education?.some(edu =>
        (edu.institution || '').toLowerCase().includes(term) ||
        (edu.degree_and_field || '').toLowerCase().includes(term) ||
        (edu.notes && edu.notes.toLowerCase().includes(term))
      )
      
      // Mutual connections search - add null check for each connection
      const connectionMatch = contact.mutual_connections?.some(conn =>
        (conn || '').toLowerCase().includes(term)
      )
      
      return basicMatch || experienceMatch || educationMatch || connectionMatch
    })
  }, [contacts, debouncedSearchTerm])

  // Paginated contacts for better performance with large lists
  const displayedContacts = useMemo(() => {
    return filteredContacts.slice(0, displayedContactsCount)
  }, [filteredContacts, displayedContactsCount])

  const hasMoreContacts = filteredContacts.length > displayedContactsCount

  const loadMoreContacts = useCallback(async () => {
    setIsLoadingMore(true)
    await new Promise(resolve => setTimeout(resolve, 100))
    setDisplayedContactsCount(prev => Math.min(prev + 20, filteredContacts.length))
    setIsLoadingMore(false)
  }, [filteredContacts.length])

  // Reset pagination when search changes
  useEffect(() => {
    setDisplayedContactsCount(20)
  }, [debouncedSearchTerm])

  // Load jobs for reminder modal
  useEffect(() => {
    const loadJobs = async () => {
      try {
        // Import fetchJobs or implement similar function
        // const jobsData = await fetchJobs()
        // setJobs(jobsData)
        setJobs([]) // Placeholder until you implement job loading
      } catch (error) {
        console.error('Error loading jobs:', error)
        setJobs([])
      }
    }

    loadJobs()
  }, [])

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex justify-between items-center">
          <div className="h-10 bg-slate-200 rounded w-32"></div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <div className="col-span-full lg:col-span-2 xl:col-span-2 space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="card p-3">
                <div className="animate-pulse space-y-2">
                  <div className="flex justify-between">
                    <div className="h-5 bg-slate-200 rounded w-32"></div>
                    <div className="flex space-x-1">
                      <div className="h-4 bg-slate-200 rounded w-8"></div>
                      <div className="h-4 bg-slate-200 rounded w-8"></div>
                      <div className="h-4 bg-slate-200 rounded w-8"></div>
                    </div>
                  </div>
                  <div className="h-3 bg-slate-200 rounded w-48"></div>
                  <div className="h-3 bg-slate-200 rounded w-full"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with search and Add Contact button - More robust mobile responsive */}
      <div className="space-y-4 lg:space-y-0">
        {/* Desktop and Tablet: Single row with search and actions (768px and up) */}
        <div className="hidden lg:flex justify-between items-center gap-4">
          {/* Search Bar */}
          <div className="relative flex-1 max-w-2xl">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search contacts by name, company, email, experience, education, or connections..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10 w-full"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <span className="text-sm text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
              {filteredContacts.length} contact{filteredContacts.length !== 1 ? 's' : ''}
            </span>
            
            <button
              onClick={() => setShowForm(true)}
              className="btn-primary flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add Contact</span>
            </button>
          </div>
        </div>

        {/* Mobile and Small Tablet: Stacked layout (below 1024px) */}
        <div className="lg:hidden">
          {/* Action buttons row */}
          <div className="flex justify-between items-center mb-4">
            <span className="text-lg font-semibold text-slate-800">Contacts</span>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                {filteredContacts.length}
              </span>
              
              <button
                onClick={() => setShowForm(true)}
                className="btn-primary flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Add Contact</span>
                <span className="sm:hidden">Add</span>
              </button>
            </div>
          </div>

          {/* Search Bar - Full width on mobile */}
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search contacts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10 w-full"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Hybrid Main Content Layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Contact List - Flexible Width */}
        <div className="flex-1 min-w-0 contacts-main-area px-4 sm:px-0">
          {displayedContacts.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-500 mb-2">
                {searchTerm ? 'No contacts found' : 'No contacts yet'}
              </h3>
              <p className="text-slate-400 mb-6">
                {searchTerm 
                  ? 'Try adjusting your search terms or clear the search to see all contacts.'
                  : 'Start building your professional network by adding your first contact.'
                }
              </p>
              {!searchTerm && (
                <button
                  onClick={() => setShowForm(true)}
                  className="btn-primary"
                >
                  Add Your First Contact
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Contact Cards in Grid Layout - Dynamic responsive grid */}
              <div 
                className="grid gap-4"
                style={{
                  gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
                  transition: 'grid-template-columns 0.3s ease'
                }}
              >
                {displayedContacts.map((contact, index) => (
                  <ContactCard
                    key={contact.id}
                    contact={contact}
                    index={index}
                    isSelected={selectedContactId === contact.id}
                    contactIdToJobs={contactIdToJobs}
                    contactNameMap={contactNameMap}
                    onClick={(id) => {
                      setSelectedContactId(id)
                      // On mobile, show bottom sheet when contact is selected
                      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                        setShowMobileInteractions(true)
                      }
                    }}
                    onEdit={handleEditContact}
                    onDelete={handleDelete}
                    onMutualConnectionClick={handleMutualConnectionClick}
                    onCreateReminder={handleCreateReminder}
                  />
                ))}
              </div>

              {/* Load More Button */}
              {hasMoreContacts && (
                <div className="text-center py-6">
                  <button
                    onClick={loadMoreContacts}
                    disabled={isLoadingMore}
                    className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                      isLoadingMore 
                        ? 'bg-slate-200 text-slate-500 cursor-not-allowed' 
                        : 'bg-blue-500 text-white hover:bg-blue-600 hover:scale-105'
                    }`}
                  >
                    {isLoadingMore ? (
                      <span className="flex items-center space-x-2">
                        <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                        <span>Loading...</span>
                      </span>
                    ) : (
                      `Load More Contacts (${filteredContacts.length - displayedContactsCount} remaining)`
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Desktop Resizable Panel - Hidden on mobile */}
        {selectedContactId && (
          <div className="hidden lg:block">
            <ResizablePanel
              defaultWidth={350}
              minWidth={300}
              maxWidth={600}
              storageKey="interactions-panel-width"
              position="right"
            >
              <div className="card p-6 h-full overflow-hidden">
                <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center space-x-2">
                  <MessageCircle className="w-5 h-5" />
                  <span>Interactions</span>
                </h3>
                <div className="flex-1 overflow-auto">
                  <Suspense fallback={
                    <div className="space-y-3">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="animate-pulse">
                          <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                          <div className="h-3 bg-slate-200 rounded w-full mb-1"></div>
                          <div className="h-3 bg-slate-200 rounded w-5/6"></div>
                        </div>
                      ))}
                    </div>
                  }>
                    <InteractionList contactId={selectedContactId} />
                  </Suspense>
                </div>
              </div>
            </ResizablePanel>
          </div>
        )}
      </div>

      {/* Mobile Bottom Sheet */}
      {isClient && (
        <BottomSheet
            isOpen={showMobileInteractions && !!selectedContactId}
            onClose={() => {
              setShowMobileInteractions(false)
              setSelectedContactId(null)
            }}
            title="Interactions"
            snapPoints={[160, 400, 600]}
            defaultSnap={1}
          >
          {selectedContactId && (
            <Suspense fallback={
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-slate-200 rounded w-full mb-1"></div>
                    <div className="h-3 bg-slate-200 rounded w-5/6"></div>
                  </div>
                ))}
              </div>
            }>
              <InteractionList contactId={selectedContactId} compact={true} />
            </Suspense>
          )}
          </BottomSheet>
      )}

      {/* Contact Form Modal */}
      {showForm && (
        <ContactForm
          contact={editingContact}
          onSuccess={handleFormSuccess}
          onCancel={() => {
            setShowForm(false)
            setEditingContact(null)
          }}
          allContacts={contacts}
        />
      )}

      {/* Contact Detail Modal */}
      {modalContact && (
        <ContactModal
          contact={modalContact}
          onClose={() => setModalContact(null)}
          onEdit={(contact) => {
            setModalContact(null)
            handleEditContact(contact)
          }}
        />
      )}

      {/* Reminder Modal */}
      {showReminderModal && reminderContact && (
        <CreateReminderModal
          isOpen={showReminderModal}
          onClose={handleReminderModalClose}
          onSuccess={handleReminderModalSuccess}
          editingReminder={null}
          contacts={contacts}
          jobs={jobs}
          prefilledContact={reminderContact}
        />
      )}
    </div>
  )
}
// src/components/JobContactLinks.tsx - Optimized version
'use client'

import { memo, useMemo } from 'react'
import { Contact } from '@/lib/supabase'
import { User } from 'lucide-react'

interface JobContactLinksProps {
  jobId: string
  contacts?: Contact[]  // Pre-loaded contacts
  onContactClick: (contact: Contact) => void
}

const JobContactLinks = memo(({ jobId, contacts = [], onContactClick }: JobContactLinksProps) => {
  // Memoize the contact display logic
  const contactDisplay = useMemo(() => {
    if (!contacts.length) {
      return (
        <span className="text-gray-400 text-sm">No contacts</span>
      )
    }

    if (contacts.length === 1) {
      const contact = contacts[0]
      return (
        <button
          onClick={() => onContactClick(contact)}
          className="inline-flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-sm"
        >
          <User className="w-4 h-4" />
          <span>{contact.name}</span>
        </button>
      )
    }

    // Multiple contacts - show first contact and count
    const firstContact = contacts[0]
    const remainingCount = contacts.length - 1

    return (
      <div className="flex items-center space-x-2">
        <button
          onClick={() => onContactClick(firstContact)}
          className="inline-flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-sm"
        >
          <User className="w-4 h-4" />
          <span>{firstContact.name}</span>
        </button>
        {remainingCount > 0 && (
          <span className="text-gray-500 text-sm">
            +{remainingCount} more
          </span>
        )}
      </div>
    )
  }, [contacts, onContactClick])

  return contactDisplay
})

JobContactLinks.displayName = 'JobContactLinks'

export default JobContactLinks
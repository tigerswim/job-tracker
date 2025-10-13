// src/components/JobContactManager.tsx - Updated to match modal styling

'use client'

import { useState, useEffect, useMemo } from 'react'
import { Contact } from '@/lib/supabase'
import { getContacts } from '@/lib/contacts'
import { getJobContacts, linkJobToContact, unlinkJobFromContact } from '@/lib/jobContacts'
import { X, Plus, Users, AlertCircle, RefreshCw, Search, Link } from 'lucide-react'

interface JobContactManagerProps {
  jobId: string
  onClose: () => void
}

export default function JobContactManager({ jobId, onClose }: JobContactManagerProps) {
  const [allContacts, setAllContacts] = useState<Contact[]>([])
  const [linkedContacts, setLinkedContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [linking, setLinking] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadData()
  }, [jobId])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      if (!jobId) {
        throw new Error('Job ID is required')
      }

      console.log('Loading data for job:', jobId)

      const [contacts, jobContacts] = await Promise.all([
        getContacts(),
        getJobContacts(jobId)
      ])

      console.log('Loaded contacts:', contacts?.length || 0)
      console.log('Loaded job contacts:', jobContacts?.length || 0)

      setAllContacts(contacts || [])
      setLinkedContacts((jobContacts as Contact[]) || [])
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      console.error('Error in JobContactManager loadData:', {
        error: errorMessage,
        jobId,
        timestamp: new Date().toISOString(),
        stack: error instanceof Error ? error.stack : undefined
      })
      setError(`Failed to load contact data: ${errorMessage}`)
      setAllContacts([])
      setLinkedContacts([])
    } finally {
      setLoading(false)
    }
  }

  const handleLinkContact = async (contactId: string) => {
    try {
      setLinking(contactId)
      setError(null)

      if (!jobId || !contactId) {
        throw new Error('Job ID and Contact ID are required')
      }

      const result = await linkJobToContact(jobId, contactId)
      if (!result) {
        throw new Error('Failed to link contact to job')
      }

      console.log('Successfully linked contact:', contactId, 'to job:', jobId)
      await loadData() // Reload data to reflect changes
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      console.error('Error linking contact:', {
        error: errorMessage,
        jobId,
        contactId,
        timestamp: new Date().toISOString()
      })
      setError(`Failed to link contact: ${errorMessage}`)
    } finally {
      setLinking(null)
    }
  }

  const handleUnlinkContact = async (contactId: string) => {
    try {
      setError(null)

      if (!jobId || !contactId) {
        throw new Error('Job ID and Contact ID are required')
      }

      const success = await unlinkJobFromContact(jobId, contactId)
      if (!success) {
        throw new Error('Failed to unlink contact from job')
      }

      console.log('Successfully unlinked contact:', contactId, 'from job:', jobId)
      await loadData() // Reload data to reflect changes
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      console.error('Error unlinking contact:', {
        error: errorMessage,
        jobId,
        contactId,
        timestamp: new Date().toISOString()
      })
      setError(`Failed to unlink contact: ${errorMessage}`)
    }
  }

  // Filter available contacts based on search query
  const filteredAvailableContacts = useMemo(() => {
    const availableContacts = allContacts.filter(
      contact => !linkedContacts.some(linked => linked.id === contact.id)
    )

    if (!searchQuery.trim()) {
      return availableContacts
    }

    const query = searchQuery.toLowerCase().trim()
    
    return availableContacts.filter(contact => {
      const name = contact.name?.toLowerCase() || ''
      const company = contact.company?.toLowerCase() || ''
      const jobTitle = contact.job_title?.toLowerCase() || ''
      
      return name.includes(query) || 
             company.includes(query) || 
             jobTitle.includes(query)
    })
  }, [allContacts, linkedContacts, searchQuery])

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }

  const clearSearch = () => {
    setSearchQuery('')
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-8">
          <div className="flex items-center justify-center">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-500 mr-3" />
            <span className="text-lg">Loading contacts...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center p-4 z-50" style={{ paddingTop: '2rem' }}>
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6 text-white">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <Link className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Manage Job Contacts</h2>
                <p className="text-blue-100 text-sm">
                  Link contacts to this job application
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-all duration-200"
              >
                Done
              </button>
              <button
                onClick={onClose}
                className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-all duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto max-h-[calc(90vh-120px)] custom-scrollbar">
          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span className="font-medium">Error:</span>
              </div>
              <p className="mt-1 text-sm">{error}</p>
              <button
                onClick={loadData}
                className="mt-2 text-sm underline hover:no-underline"
              >
                Try again
              </button>
            </div>
          )}

          <div className="space-y-8">
            {/* Linked Contacts Section */}
            <div>
              <div className="flex items-center space-x-2 text-slate-700 border-b border-slate-200 pb-3 mb-4">
                <Users className="w-5 h-5" />
                <h3 className="font-semibold">Linked Contacts ({linkedContacts.length})</h3>
              </div>
              
              {linkedContacts.length === 0 ? (
                <div className="text-center py-6 text-slate-500 bg-slate-50 rounded-lg border border-slate-200">
                  <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm font-medium">No contacts linked yet</p>
                  <p className="text-xs text-slate-400 mt-1">Add contacts below to track your networking for this job</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {linkedContacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-slate-900">{contact.name}</div>
                        <div className="text-sm text-slate-600">
                          {contact.job_title && contact.company ? 
                            `${contact.job_title} at ${contact.company}` :
                            contact.company || contact.job_title || 'No additional details'
                          }
                        </div>
                      </div>
                      <button
                        onClick={() => handleUnlinkContact(contact.id)}
                        className="text-red-600 hover:text-red-800 text-sm font-medium px-3 py-1 rounded-lg hover:bg-red-50 transition-all duration-200"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Available Contacts Section */}
            <div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
                <div className="flex items-center space-x-2 text-slate-700">
                  <Plus className="w-5 h-5" />
                  <h3 className="font-semibold">Available Contacts ({allContacts.length - linkedContacts.length})</h3>
                </div>
              </div>
              
              {/* Search Bar */}
              {(allContacts.length - linkedContacts.length) > 0 && (
                <div className="relative mb-4">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search contacts by name, company, or title..."
                    value={searchQuery}
                    onChange={handleSearchChange}
                    className="block w-full pl-10 pr-10 py-3 border border-slate-300 rounded-lg text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={clearSearch}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      <X className="h-4 w-4 text-slate-400 hover:text-slate-600" />
                    </button>
                  )}
                </div>
              )}

              {/* Search Results Info */}
              {searchQuery && (
                <div className="mb-4 text-sm text-slate-600">
                  {filteredAvailableContacts.length === 0 ? (
                    <span>No contacts found matching "{searchQuery}"</span>
                  ) : (
                    <span>
                      {filteredAvailableContacts.length} contact{filteredAvailableContacts.length !== 1 ? 's' : ''} found matching "{searchQuery}"
                    </span>
                  )}
                </div>
              )}
              
              {(allContacts.length - linkedContacts.length) === 0 ? (
                <div className="text-center py-6 text-slate-500 bg-slate-50 rounded-lg border border-slate-200">
                  <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm font-medium">All contacts are already linked</p>
                  <p className="text-xs text-slate-400 mt-1">Create new contacts to expand your network for this job</p>
                </div>
              ) : filteredAvailableContacts.length === 0 ? (
                <div className="text-center py-6 text-slate-500 bg-slate-50 rounded-lg border border-slate-200">
                  <Search className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm font-medium">
                    {searchQuery ? 
                      `No contacts found matching "${searchQuery}"` : 
                      'No available contacts'
                    }
                  </p>
                  {searchQuery && (
                    <button
                      onClick={clearSearch}
                      className="mt-2 text-sm text-blue-600 hover:text-blue-800 underline"
                    >
                      Clear search
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto custom-scrollbar">
                  {filteredAvailableContacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-all duration-200"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-slate-900">{contact.name}</div>
                        <div className="text-sm text-slate-600">
                          {contact.job_title && contact.company ? 
                            `${contact.job_title} at ${contact.company}` :
                            contact.company || contact.job_title || 'No additional details'
                          }
                        </div>
                      </div>
                      <button
                        onClick={() => handleLinkContact(contact.id)}
                        disabled={linking === contact.id}
                        className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-medium px-3 py-2 rounded-lg hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                      >
                        {linking === contact.id ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Linking...
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4" />
                            Link Contact
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
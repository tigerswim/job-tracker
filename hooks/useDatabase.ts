import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { User } from '@supabase/supabase-js'

// Types matching your existing interfaces
interface Job {
  id: string
  company: string
  position: string
  status: 'interested' | 'applied' | 'interviewing' | 'onhold' | 'offered' | 'rejected'
  salary?: string
  location?: string
  jobUrl?: string
  jobDescription?: string
  notes?: string
  stage: string
  order?: number
  dateAdded: string
}

interface Contact {
  id: string
  name: string
  company?: string
  position?: string
  email?: string
  phone?: string
  linkedin?: string
  associatedJob?: string
  associatedJobId?: string
  notes?: string
  interactions: Interaction[]
}

interface Interaction {
  id: string
  date: string
  type: 'email' | 'phone' | 'meeting' | 'linkedin' | 'other'
  summary: string
  notes?: string
}

// Custom hook for managing jobs
export const useJobs = (user: User | null) => {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)

  const fetchJobs = useCallback(async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      const formattedJobs: Job[] = data.map(job => ({
        id: job.id,
        company: job.company,
        position: job.position,
        status: job.status,
        salary: job.salary || '',
        location: job.location || '',
        jobUrl: job.job_url || '',
        jobDescription: job.job_description || '',
        notes: job.notes || '',
        stage: job.stage,
        order: job.order_position,
        dateAdded: job.date_added
      }))

      setJobs(formattedJobs)
    } catch (error) {
      console.error('Error fetching jobs:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  const addJob = useCallback(async (job: Omit<Job, 'id'>) => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('jobs')
        .insert({
          user_id: user.id,
          company: job.company,
          position: job.position,
          status: job.status,
          salary: job.salary,
          location: job.location,
          job_url: job.jobUrl,
          job_description: job.jobDescription,
          notes: job.notes,
          stage: job.stage,
          order_position: job.order || 0,
          date_added: job.dateAdded
        })
        .select()
        .single()

      if (error) throw error

      const newJob: Job = {
        id: data.id,
        company: data.company,
        position: data.position,
        status: data.status,
        salary: data.salary || '',
        location: data.location || '',
        jobUrl: data.job_url || '',
        jobDescription: data.job_description || '',
        notes: data.notes || '',
        stage: data.stage,
        order: data.order_position,
        dateAdded: data.date_added
      }

      setJobs(prev => [newJob, ...prev])
      return newJob
    } catch (error) {
      console.error('Error adding job:', error)
      throw error
    }
  }, [user])

  const updateJob = useCallback(async (id: string, updates: Partial<Omit<Job, 'id'>>) => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('jobs')
        .update({
          company: updates.company,
          position: updates.position,
          status: updates.status,
          salary: updates.salary,
          location: updates.location,
          job_url: updates.jobUrl,
          job_description: updates.jobDescription,
          notes: updates.notes,
          stage: updates.stage,
          order_position: updates.order,
          date_added: updates.dateAdded,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) throw error

      const updatedJob: Job = {
        id: data.id,
        company: data.company,
        position: data.position,
        status: data.status,
        salary: data.salary || '',
        location: data.location || '',
        jobUrl: data.job_url || '',
        jobDescription: data.job_description || '',
        notes: data.notes || '',
        stage: data.stage,
        order: data.order_position,
        dateAdded: data.date_added
      }

      setJobs(prev => prev.map(job => job.id === id ? updatedJob : job))
      return updatedJob
    } catch (error) {
      console.error('Error updating job:', error)
      throw error
    }
  }, [user])

  const deleteJob = useCallback(async (id: string) => {
    if (!user) return

    try {
      const { error } = await supabase
        .from('jobs')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) throw error

      setJobs(prev => prev.filter(job => job.id !== id))
    } catch (error) {
      console.error('Error deleting job:', error)
      throw error
    }
  }, [user])

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  return {
    jobs,
    loading,
    addJob,
    updateJob,
    deleteJob,
    refetch: fetchJobs
  }
}

// Custom hook for managing contacts
export const useContacts = (user: User | null) => {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)

  const fetchContacts = useCallback(async () => {
    if (!user) return

    try {
      // Fetch contacts with their interactions
      const { data: contactsData, error: contactsError } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (contactsError) throw contactsError

      const { data: interactionsData, error: interactionsError } = await supabase
        .from('interactions')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })

      if (interactionsError) throw interactionsError

      // Group interactions by contact
      const interactionsByContact = interactionsData.reduce((acc, interaction) => {
        if (!acc[interaction.contact_id]) {
          acc[interaction.contact_id] = []
        }
        acc[interaction.contact_id].push({
          id: interaction.id,
          date: interaction.date,
          type: interaction.type,
          summary: interaction.summary,
          notes: interaction.notes || ''
        })
        return acc
      }, {} as Record<string, Interaction[]>)

      const formattedContacts: Contact[] = contactsData.map(contact => ({
        id: contact.id,
        name: contact.name,
        company: contact.company || '',
        position: contact.position || '',
        email: contact.email || '',
        phone: contact.phone || '',
        linkedin: contact.linkedin || '',
        associatedJob: contact.associated_job || '',
        associatedJobId: contact.associated_job_id || '',
        notes: contact.notes || '',
        interactions: interactionsByContact[contact.id] || []
      }))

      setContacts(formattedContacts)
    } catch (error) {
      console.error('Error fetching contacts:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  const addContact = useCallback(async (contact: Omit<Contact, 'id' | 'interactions'>) => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('contacts')
        .insert({
          user_id: user.id,
          name: contact.name,
          company: contact.company,
          position: contact.position,
          email: contact.email,
          phone: contact.phone,
          linkedin: contact.linkedin,
          associated_job_id: contact.associatedJobId,
          associated_job: contact.associatedJob,
          notes: contact.notes
        })
        .select()
        .single()

      if (error) throw error

      const newContact: Contact = {
        id: data.id,
        name: data.name,
        company: data.company || '',
        position: data.position || '',
        email: data.email || '',
        phone: data.phone || '',
        linkedin: data.linkedin || '',
        associatedJob: data.associated_job || '',
        associatedJobId: data.associated_job_id || '',
        notes: data.notes || '',
        interactions: []
      }

      setContacts(prev => [newContact, ...prev])
      return newContact
    } catch (error) {
      console.error('Error adding contact:', error)
      throw error
    }
  }, [user])

  const updateContact = useCallback(async (id: string, updates: Partial<Omit<Contact, 'id' | 'interactions'>>) => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('contacts')
        .update({
          name: updates.name,
          company: updates.company,
          position: updates.position,
          email: updates.email,
          phone: updates.phone,
          linkedin: updates.linkedin,
          associated_job_id: updates.associatedJobId,
          associated_job: updates.associatedJob,
          notes: updates.notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) throw error

      setContacts(prev => prev.map(contact => 
        contact.id === id 
          ? {
              ...contact,
              name: data.name,
              company: data.company || '',
              position: data.position || '',
              email: data.email || '',
              phone: data.phone || '',
              linkedin: data.linkedin || '',
              associatedJob: data.associated_job || '',
              associatedJobId: data.associated_job_id || '',
              notes: data.notes || ''
            }
          : contact
      ))
    } catch (error) {
      console.error('Error updating contact:', error)
      throw error
    }
  }, [user])

  const deleteContact = useCallback(async (id: string) => {
    if (!user) return

    try {
      // Delete interactions first (cascade should handle this, but being explicit)
      await supabase
        .from('interactions')
        .delete()
        .eq('contact_id', id)
        .eq('user_id', user.id)

      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) throw error

      setContacts(prev => prev.filter(contact => contact.id !== id))
    } catch (error) {
      console.error('Error deleting contact:', error)
      throw error
    }
  }, [user])

  const addInteraction = useCallback(async (contactId: string, interaction: Omit<Interaction, 'id'>) => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('interactions')
        .insert({
          user_id: user.id,
          contact_id: contactId,
          date: interaction.date,
          type: interaction.type,
          summary: interaction.summary,
          notes: interaction.notes
        })
        .select()
        .single()

      if (error) throw error

      const newInteraction: Interaction = {
        id: data.id,
        date: data.date,
        type: data.type,
        summary: data.summary,
        notes: data.notes || ''
      }

      setContacts(prev => prev.map(contact => 
        contact.id === contactId 
          ? { ...contact, interactions: [newInteraction, ...contact.interactions] }
          : contact
      ))

      return newInteraction
    } catch (error) {
      console.error('Error adding interaction:', error)
      throw error
    }
  }, [user])

  useEffect(() => {
    fetchContacts()
  }, [fetchContacts])

  return {
    contacts,
    loading,
    addContact,
    updateContact,
    deleteContact,
    addInteraction,
    refetch: fetchContacts
  }
}
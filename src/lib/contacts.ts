// src/lib/contacts.ts - Fixed Version with Consistent Client Usage
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Contact } from './supabase'

export interface ContactsResponse {
  contacts: Contact[]
  total: number
  hasMore: boolean
}

export interface ContactSearchOptions {
  searchTerm?: string
  limit?: number
  offset?: number
  sortBy?: 'name' | 'company' | 'created_at'
  sortOrder?: 'asc' | 'desc'
}

export async function getContacts(): Promise<Contact[]> {
  try {
    // Use the same client pattern throughout
    const supabase = createClientComponentClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      console.error('Error getting user:', userError)
      return []
    }

    console.log('getContacts: Fetching contacts for user ID:', user.id, 'email:', user.email)

    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching contacts:', error)
      return []
    }

    console.log('getContacts: Found', data?.length || 0, 'contacts for user:', user.id)
    return data || []
  } catch (error) {
    console.error('Exception in getContacts:', error)
    return []
  }
}

export async function getContactsLite(): Promise<Pick<Contact,
  'id' | 'name' | 'company' | 'job_title' | 'email' | 'phone' | 'current_location' | 'linkedin_url' | 'notes' | 'mutual_connections' | 'experience' | 'education' | 'created_at' | 'updated_at' | 'user_id'
>[]> {
  try {
    const supabase = createClientComponentClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      console.error('Error getting user:', userError)
      return []
    }

    const { data, error } = await supabase
      .from('contacts')
      .select('id,name,company,job_title,email,phone,current_location,linkedin_url,notes,mutual_connections,experience,education,created_at,updated_at,user_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching contacts (lite):', error)
      return []
    }

    return (data as any) || []
  } catch (error) {
    console.error('Exception in getContactsLite:', error)
    return []
  }
}

export async function searchContacts(options: ContactSearchOptions = {}): Promise<ContactsResponse> {
  try {
    const {
      searchTerm = '',
      limit = 50,
      offset = 0,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = options

    const supabase = createClientComponentClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      console.error('Error getting user:', userError)
      return { contacts: [], total: 0, hasMore: false }
    }

    let query = supabase
      .from('contacts')
      .select('id,name,company,job_title,email,phone,current_location,linkedin_url,notes,mutual_connections,experience,education,created_at,updated_at,user_id', { count: 'exact' })
      .eq('user_id', user.id)

    if (searchTerm.trim()) {
      const term = searchTerm.trim()
      query = query.or(`
        name.ilike.%${term}%,
        company.ilike.%${term}%,
        job_title.ilike.%${term}%,
        email.ilike.%${term}%,
        current_location.ilike.%${term}%,
        notes.ilike.%${term}%
      `)
    }

    query = query.order(sortBy, { ascending: sortOrder === 'asc' })
    const { data, error, count } = await query.range(offset, offset + limit - 1)

    if (error) {
      console.error('Error searching contacts:', error)
      return { contacts: [], total: 0, hasMore: false }
    }

    const total = count || 0
    const hasMore = (offset + limit) < total

    return {
      contacts: (data as any) || [],
      total,
      hasMore
    }
  } catch (error) {
    console.error('Exception in searchContacts:', error)
    return { contacts: [], total: 0, hasMore: false }
  }
}

export async function getContactsBatch(offset: number = 0, limit: number = 50): Promise<ContactsResponse> {
  try {
    const supabase = createClientComponentClient() // ✅ Fixed: Use consistent client
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      console.error('Error getting user:', userError)
      return { contacts: [], total: 0, hasMore: false }
    }

    const { data, error, count } = await supabase
      .from('contacts')
      .select('id,name,company,job_title,email,phone,current_location,linkedin_url,notes,mutual_connections,experience,education,created_at,updated_at,user_id', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error fetching contacts batch:', error)
      return { contacts: [], total: 0, hasMore: false }
    }

    const total = count || 0
    const hasMore = (offset + limit) < total

    return {
      contacts: (data as any) || [],
      total,
      hasMore
    }
  } catch (error) {
    console.error('Exception in getContactsBatch:', error)
    return { contacts: [], total: 0, hasMore: false }
  }
}

export async function getContactById(id: string): Promise<Contact | null> {
  try {
    const supabase = createClientComponentClient() // ✅ Fixed: Use consistent client
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      console.error('Error getting user:', userError)
      return null
    }

    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error) {
      console.error('Error fetching contact by id:', error)
      return null
    }

    return data as unknown as Contact
  } catch (error) {
    console.error('Exception in getContactById:', error)
    return null
  }
}

export async function getContactsByIds(ids: string[]): Promise<Contact[]> {
  try {
    if (!ids || ids.length === 0) return []

    const supabase = createClientComponentClient() // ✅ Fixed: Use consistent client
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      console.error('Error getting user:', userError)
      return []
    }

    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .in('id', ids)
      .eq('user_id', user.id)

    if (error) {
      console.error('Error fetching contacts by ids:', error)
      return []
    }

    return (data as unknown as Contact[]) || []
  } catch (error) {
    console.error('Exception in getContactsByIds:', error)
    return []
  }
}

export async function createContact(contact: Omit<Contact, 'id' | 'created_at' | 'updated_at'>): Promise<Contact | null> {
  console.log('=== ENHANCED DEBUG: createContact started ===')
  
  try {
    const supabase = createClientComponentClient() // ✅ Fixed: Use consistent client
    
    // 1. Check user authentication
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError) {
      console.error('❌ User authentication error:', userError)
      return null
    }

    if (!user) {
      console.error('❌ No authenticated user')
      return null
    }

    console.log('✅ User authenticated:', user.email)

    // 2. Test basic table access
    console.log('🔍 Testing table access...')
    const { data: testData, error: testError } = await supabase
      .from('contacts')
      .select('id')
      .limit(1)

    if (testError) {
      console.error('❌ Table access error:', testError.message)
      return null
    }

    console.log('✅ Table access successful')

    // 3. Prepare insert data
    const insertData = {
      name: contact.name,
      email: contact.email || null,
      phone: contact.phone || null,
      current_location: contact.current_location || null,
      company: contact.company || null,
      job_title: contact.job_title || null,
      linkedin_url: contact.linkedin_url || null,
      notes: contact.notes || null,
      experience: contact.experience || null,
      education: contact.education || null,
      mutual_connections: contact.mutual_connections || null,
      user_id: user.id
    }

    console.log('🔧 Prepared insert data:', insertData)

    // 4. Attempt the insert
    const { data, error } = await supabase
      .from('contacts')
      .insert([insertData])
      .select()
      .single()

    if (error) {
      console.error('❌ Insert failed:', error.message)
      return null
    }

    console.log('✅ Contact created successfully:', data)
    return data

  } catch (exception) {
    console.error('❌ Exception in createContact:', exception)
    return null
  }
}

export async function updateContact(id: string, contactData: Partial<Omit<Contact, 'id' | 'created_at' | 'updated_at' | 'user_id'>>): Promise<Contact | null> {
  try {
    const supabase = createClientComponentClient() // ✅ Fixed: Use consistent client
    console.log('Updating contact with data:', contactData)

    const { data, error } = await supabase
      .from('contacts')
      .update({ 
        ...contactData, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating contact:', error)
      return null
    }

    console.log('Contact updated successfully:', data)
    return data
  } catch (error) {
    console.error('Exception in updateContact:', error)
    return null
  }
}

export async function deleteContact(id: string): Promise<boolean> {
  try {
    const supabase = createClientComponentClient() // ✅ Fixed: Use consistent client
    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting contact:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Exception in deleteContact:', error)
    return false
  }
}

export async function getContactStats(): Promise<{
  total: number
  withEmail: number
  withPhone: number
  withLinkedIn: number
  withLocation: number
  withJobs: number
}> {
  try {
    const supabase = createClientComponentClient() // ✅ Fixed: Use consistent client
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      console.error('Error getting user:', userError)
      return { total: 0, withEmail: 0, withPhone: 0, withLinkedIn: 0, withLocation: 0, withJobs: 0 }
    }

    const { data, error } = await supabase
      .from('contacts')
      .select(`
        id,
        email,
        phone,
        current_location,
        linkedin_url
      `)
      .eq('user_id', user.id)

    if (error) {
      console.error('Error fetching contact stats:', error)
      return { total: 0, withEmail: 0, withPhone: 0, withLinkedIn: 0, withLocation: 0, withJobs: 0 }
    }

    const contacts = data || []
    
    return {
      total: contacts.length,
      withEmail: contacts.filter(c => c.email).length,
      withPhone: contacts.filter(c => c.phone).length,
      withLinkedIn: contacts.filter(c => c.linkedin_url).length,
      withLocation: contacts.filter(c => c.current_location).length,
      withJobs: 0
    }
  } catch (error) {
    console.error('Exception in getContactStats:', error)
    return { total: 0, withEmail: 0, withPhone: 0, withLinkedIn: 0, withLocation: 0, withJobs: 0 }
  }
}
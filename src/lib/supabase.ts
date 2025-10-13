// src/lib/supabase.ts - Updated with proper client setup
import { createClient } from '@supabase/supabase-js'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Basic client for general use
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Client-side auth helper for React components
export const createSupabaseClient = () => createClientComponentClient()

export interface Contact {
  id: string
  name: string
  email?: string
  phone?: string
  current_location?: string
  company?: string
  job_title?: string
  linkedin_url?: string
  notes?: string
  experience?: ExperienceEntry[]
  education?: EducationEntry[]
  mutual_connections?: string[]
  user_id: string
  created_at: string
  updated_at: string
}

export interface ExperienceEntry {
  id: string
  company: string
  title: string
  start_date: string // YYYY-MM format
  end_date?: string // YYYY-MM format or null for current
  is_current: boolean
  description?: string
}

export interface EducationEntry {
  id: string
  institution: string
  degree_and_field: string // e.g., "Bachelor's in Computer Science", "MBA"
  year: string // Can be graduation year or range like "2018-2022"
  notes?: string
}

export interface Job {
  id: string
  job_title: string
  company: string
  location?: string
  salary?: string
  job_url?: string
  status: 'interested' | 'applied' | 'interviewing' | 'onhold' | 'offered' | 'rejected'
  applied_date?: string
  job_description?: string
  notes?: string
  user_id: string
  created_at: string
  updated_at: string
}

export interface Interaction {
  id: string
  contact_id: string
  type: 'email' | 'phone' | 'video_call' | 'linkedin' | 'meeting' | 'other'
  date: string
  summary: string
  notes?: string
  user_id: string
  created_at: string
  updated_at: string
}
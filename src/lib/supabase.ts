// src/lib/supabase.ts - shared database types + a plain (unauthenticated) client.
// Auth-aware clients live in src/lib/supabase-ssr/ (browser + server).
import { createClient } from '@supabase/supabase-js'
import { createClient as createBrowserClient } from '@/lib/supabase-ssr/client'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Plain client — carries no user session. Use the ssr clients for anything
// that must respect RLS as the signed-in user.
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/** @deprecated Import createClient from '@/lib/supabase-ssr/client' instead. */
export const createSupabaseClient = () => createBrowserClient()

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
  followup_snoozed_until?: string | null
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

export type JobStatus =
  | 'bookmarked'
  | 'interested'
  | 'applied'
  | 'interviewing'
  | 'offered'
  | 'onhold'
  | 'withdrawn'
  | 'rejected'
  | 'noresponse'

export interface Job {
  id: string
  job_title: string
  company: string
  // Nullable in the DB; forms write null for cleared fields.
  location?: string | null
  salary?: string | null
  job_url?: string | null
  // Must stay in sync with JobForm's statusOptions, JobStatusFilter's labels,
  // and the .status-* classes in globals.css. The DB column is a plain
  // VARCHAR(50) defaulting to 'bookmarked', so it accepts all of these.
  status: JobStatus
  applied_date?: string | null
  job_description?: string | null
  notes?: string | null
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
  external_id?: string
  source?: string
  last_direction?: string
  message_count?: number
  last_message_at?: string
  user_id: string
  created_at: string
  updated_at: string
}
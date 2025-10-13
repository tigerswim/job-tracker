// src/lib/reporting.ts
import { supabase } from './supabase'

export type ReportingSort =
  | 'name'
  | 'company'
  | 'job_title'
  | 'linkedJobsCount'
  | 'mutual_connections_count'
  | 'last_interaction'

export type SortDir = 'asc' | 'desc'

export interface ReportingContactRow {
  contact_id: string
  name: string | null
  company: string | null
  job_title: string | null
  linked_jobs_count: number
  last_interaction_date: string | null
  interaction_count: number
  mutual_connections_count: number
}

export interface RecentInteractionRow {
  interaction_id: string
  date: string
  type: string
  summary: string | null
  notes: string | null
  contact_id: string
  contact_name: string | null
}

export async function getReportingContacts(params: {
  userId: string
  search?: string | null
  sort?: ReportingSort
  dir?: SortDir
  limit?: number
  offset?: number
}): Promise<ReportingContactRow[]> {
  const {
    userId,
    search = null,
    sort = 'last_interaction',
    dir = 'desc',
    limit = 50,
    offset = 0,
  } = params

  const { data, error } = await supabase.rpc('reporting_contacts', {
    p_user_id: userId,
    p_search: search,
    p_sort: sort,
    p_dir: dir,
    p_limit: limit,
    p_offset: offset,
  })

  if (error) {
    console.error('reporting_contacts RPC error:', error)
    return []
  }
  return data ?? []
}

export async function getReportingRecentInteractions(params: {
  userId: string
  limit?: number
}): Promise<RecentInteractionRow[]> {
  const { userId, limit = 50 } = params

  const { data, error } = await supabase.rpc('reporting_recent_interactions', {
    p_user_id: userId,
    p_limit: limit,
  })

  if (error) {
    console.error('reporting_recent_interactions RPC error:', error)
    return []
  }
  return data ?? []
}

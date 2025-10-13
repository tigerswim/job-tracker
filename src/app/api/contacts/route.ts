import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const offset = parseInt(url.searchParams.get('offset') ?? '0', 10)
  const limit = parseInt(url.searchParams.get('limit') ?? '50', 10)
  const searchTerm = url.searchParams.get('search') ?? ''

  const supabase = createRouteHandlerClient({ cookies })
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    // Not signed in or session expired – return empty set so UI can handle it gracefully
    return NextResponse.json({ contacts: [], total: 0, hasMore: false })
  }

  let query = supabase
    .from('contacts')
    .select(
      'id,name,company,job_title,email,phone,current_location,linkedin_url,notes,mutual_connections,experience,education,created_at',
      { count: 'exact' },
    )
    .eq('user_id', user.id)

  if (searchTerm.trim()) {
    const term = searchTerm.trim()
    query = query.or(
      `name.ilike.%${term}%,company.ilike.%${term}%,job_title.ilike.%${term}%,email.ilike.%${term}%,current_location.ilike.%${term}%,notes.ilike.%${term}%`,
    )
  }

  query = query.order('created_at', { ascending: false })
  const { data, error, count } = await query.range(offset, offset + limit - 1)

  if (error) {
    console.error('Error fetching contacts batch (route):', error)
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 })
  }

  const total = count ?? 0
  const hasMore = offset + limit < total

  return NextResponse.json(
    { contacts: data ?? [], total, hasMore },
    { headers: { 'Cache-Control': 'private, max-age=60'}},
  )  
}
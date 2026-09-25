/**
 * sync-connections creates a placeholder contact when none matches, so shared
 * connections can be saved before the profile PDF has been processed.
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterAll(() => {
  vi.restoreAllMocks()
})

// Minimal client: the lookup finds nothing, and an insert echoes back a row.
let inserted: Record<string, unknown>[] | null
const makeClient = () => {
  inserted = null
  const builder = (): Record<string, unknown> => {
    let isInsert = false
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'or', 'limit']) b[m] = () => b
    b.insert = (rows: Record<string, unknown>[]) => { inserted = rows; isInsert = true; return b }
    b.single = async () => isInsert
      ? { data: { id: 'new-id', name: inserted![0].name }, error: null }
      : { data: null, error: { code: 'PGRST116' } }
    return b
  }
  return {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })) },
    from: vi.fn(() => builder()),
  }
}

let mockClient: ReturnType<typeof makeClient>
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockClient),
}))

const post = (body: unknown) =>
  new NextRequest(new Request('http://localhost/api/extension/sync-connections', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer token' },
    body: JSON.stringify(body),
  }))

const load = async () => (await import('../extension/sync-connections/route')).POST

describe('POST /api/extension/sync-connections for an unknown contact', () => {
  beforeEach(() => {
    vi.resetModules()
    mockClient = makeClient()
  })

  it('creates the contact in the URL form the n8n PDF route matches on', async () => {
    const res = await (await load())(post({
      linkedin_url: 'https://www.linkedin.com/in/Shawn-Wherry-Marketing/?miniProfileUrn=x',
      name: '  Shawn Wherry ',
      headline: 'Fractional CMO',
      mutual_connections: ['Hannon Smith', 'Laura Jones', 'Hannon Smith'],
    }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toMatchObject({ success: true, created: true, contact_id: 'new-id' })
    expect(inserted).toEqual([{
      user_id: 'user-1',
      name: 'Shawn Wherry',
      linkedin_url: 'https://www.linkedin.com/in/shawn-wherry-marketing',
      notes: 'Fractional CMO',
      source: 'linkedin extension',
      mutual_connections: ['Hannon Smith', 'Laura Jones'],
    }])
  })

  it('still returns 404 when no name is sent (older extension builds)', async () => {
    const res = await (await load())(post({
      linkedin_url: 'https://www.linkedin.com/in/someone',
      mutual_connections: ['Someone Else'],
    }))

    expect(res.status).toBe(404)
    expect(inserted).toBeNull()
  })
})

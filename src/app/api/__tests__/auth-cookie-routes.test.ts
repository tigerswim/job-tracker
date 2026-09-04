/**
 * Authorization tests for the cookie/session-authenticated API routes.
 *
 * Every one of these routes is reachable from the public internet and returns
 * a single user's data, so the contract under test is: with no valid session,
 * the handler must not read from or write to the database.
 *
 * Only middleware.ts guards /api/reminders/*; the other routes here are
 * matched by nothing in the middleware config and defend themselves. These
 * tests hold that in place.
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import { anonymous, invalidToken, type MockSupabase } from './helpers/supabase-mock'

// These handlers log every rejected request, which is correct in production
// but drowns the test output. Silence the expected noise; a genuinely new
// message would still surface via a failing assertion.
beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterAll(() => {
  vi.restoreAllMocks()
})

// The routes call createRouteClient(); swap it for a stub we control.
let mockClient: MockSupabase

vi.mock('@/lib/supabase-ssr/server', () => ({
  createRouteClient: vi.fn(async () => mockClient),
  createServerComponentClient: vi.fn(async () => mockClient),
}))

const req = (url: string, init?: RequestInit) =>
  new NextRequest(new Request(url, init))

/** Route handlers taking (request, context) — context is unused when unauthed. */
type Handler = (request: NextRequest, ctx?: unknown) => Promise<Response>

const params = { params: Promise.resolve({ id: 'a0000000-0000-4000-8000-000000000000' }) }

/**
 * Each entry: a human label, a loader for the handler, and how to call it.
 * Loaded lazily inside the test so the vi.mock above is in effect.
 */
const protectedHandlers: Array<{
  name: string
  load: () => Promise<Handler>
  call: (h: Handler) => Promise<Response>
}> = [
  {
    name: 'GET /api/sync-status',
    load: async () => (await import('../sync-status/route')).GET as Handler,
    call: h => h(req('http://localhost/api/sync-status')),
  },
  {
    name: 'GET /api/sync-identity',
    load: async () => (await import('../sync-identity/route')).GET as Handler,
    call: h => h(req('http://localhost/api/sync-identity')),
  },
  {
    name: 'PUT /api/sync-identity',
    load: async () => (await import('../sync-identity/route')).PUT as Handler,
    call: h =>
      h(req('http://localhost/api/sync-identity', {
        method: 'PUT',
        body: JSON.stringify({ self_emails: ['attacker@example.com'] }),
        headers: { 'content-type': 'application/json' },
      })),
  },
  {
    name: 'GET /api/review-queue',
    load: async () => (await import('../review-queue/route')).GET as Handler,
    call: h => h(req('http://localhost/api/review-queue')),
  },
  {
    name: 'POST /api/review-queue/[id]',
    load: async () => (await import('../review-queue/[id]/route')).POST as Handler,
    call: h => h(req('http://localhost/api/review-queue/x', { method: 'POST' }), params),
  },
  {
    name: 'DELETE /api/review-queue/[id]',
    load: async () => (await import('../review-queue/[id]/route')).DELETE as Handler,
    call: h => h(req('http://localhost/api/review-queue/x', { method: 'DELETE' }), params),
  },
  {
    name: 'PATCH /api/review-queue/[id]',
    load: async () => (await import('../review-queue/[id]/route')).PATCH as Handler,
    call: h =>
      h(req('http://localhost/api/review-queue/x', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'dismissed' }),
        headers: { 'content-type': 'application/json' },
      }), params),
  },
  {
    name: 'GET /api/followup-settings',
    load: async () => (await import('../followup-settings/route')).GET as Handler,
    call: h => h(req('http://localhost/api/followup-settings')),
  },
  {
    name: 'PUT /api/followup-settings',
    load: async () => (await import('../followup-settings/route')).PUT as Handler,
    call: h =>
      h(req('http://localhost/api/followup-settings', {
        method: 'PUT',
        body: JSON.stringify({ max_auto_followups_per_day: 999 }),
        headers: { 'content-type': 'application/json' },
      })),
  },
  {
    name: 'GET /api/reminders',
    load: async () => (await import('../reminders/route')).GET as Handler,
    call: h => h(req('http://localhost/api/reminders')),
  },
  {
    name: 'POST /api/reminders',
    load: async () => (await import('../reminders/route')).POST as Handler,
    call: h =>
      h(req('http://localhost/api/reminders', {
        method: 'POST',
        body: JSON.stringify({ type: 'general', email_subject: 'x' }),
        headers: { 'content-type': 'application/json' },
      })),
  },
  {
    name: 'GET /api/reminders/stats',
    load: async () => (await import('../reminders/stats/route')).GET as Handler,
    call: h => h(req('http://localhost/api/reminders/stats')),
  },
  {
    name: 'PUT /api/reminders/[id]',
    load: async () => (await import('../reminders/[id]/route')).PUT as Handler,
    call: h =>
      h(req('http://localhost/api/reminders/x', {
        method: 'PUT',
        body: JSON.stringify({ email_subject: 'hijacked' }),
        headers: { 'content-type': 'application/json' },
      }), params),
  },
  {
    name: 'DELETE /api/reminders/[id]',
    load: async () => (await import('../reminders/[id]/route')).DELETE as Handler,
    call: h => h(req('http://localhost/api/reminders/x', { method: 'DELETE' }), params),
  },
]

describe('cookie-authenticated routes reject anonymous requests', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  for (const { name, load, call } of protectedHandlers) {
    it(`${name} returns 401 without a session`, async () => {
      mockClient = anonymous()
      const res = await call(await load())

      expect(res.status).toBe(401)
    })

    it(`${name} touches no table without a session`, async () => {
      mockClient = anonymous()
      await call(await load())

      // The gate must come before any query. A 401 issued after a read has
      // already leaked the row.
      expect(mockClient.queries).toEqual([])
    })

    it(`${name} rejects an invalid token`, async () => {
      mockClient = invalidToken()
      const res = await call(await load())

      expect(res.status).toBe(401)
      expect(mockClient.queries).toEqual([])
    })
  }
})

describe('GET /api/contacts degrades to an empty set', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  // This route deliberately returns 200 + empty data rather than 401 so the
  // UI can render a signed-out state (see CLAUDE.md, "API Patterns"). The
  // security property is therefore about disclosure, not status code.
  it('returns no contacts and queries nothing when signed out', async () => {
    mockClient = anonymous()
    const { GET } = await import('../contacts/route')

    const res = await GET(req('http://localhost/api/contacts'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ contacts: [], total: 0, hasMore: false })
    expect(mockClient.queries).toEqual([])
  })

  it('does not run a search query for an anonymous caller', async () => {
    mockClient = anonymous()
    const { GET } = await import('../contacts/route')

    // A search term must not reach the database ahead of the auth check.
    const res = await GET(req('http://localhost/api/contacts?search=acme'))

    expect(res.status).toBe(200)
    expect(mockClient.queries).toEqual([])
  })
})

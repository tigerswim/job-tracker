/**
 * Authorization tests for the Chrome-extension API routes.
 *
 * These three previously authenticated on a static shared key and then queried
 * with the service-role key (RLS bypassed) against a hardcoded user id. They
 * now require the caller's own Supabase access token. The tests below pin that
 * down: no token, a malformed header, or a token Supabase rejects must all be
 * refused before any database access.
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import { makeSupabaseMock, type MockSupabase } from './helpers/supabase-mock'

// The handlers log every rejected request, which is correct in production
// but drowns the test output. Silence the expected noise.
beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterAll(() => {
  vi.restoreAllMocks()
})

let mockClient: MockSupabase

// The extension routes build their client through @supabase/supabase-js
// (either directly or via authenticateBearer), so intercept that factory.
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockClient),
}))

const post = (url: string, headers: Record<string, string>, body: unknown = {}) =>
  new NextRequest(new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  }))

type Handler = (request: NextRequest) => Promise<Response>

const routes: Array<{
  name: string
  load: () => Promise<Handler>
  url: string
  body: unknown
}> = [
  {
    name: 'POST /api/extension/lookup-contact',
    load: async () => (await import('../extension/lookup-contact/route')).POST as Handler,
    url: 'http://localhost/api/extension/lookup-contact',
    body: { linkedin_url: 'https://www.linkedin.com/in/someone' },
  },
  {
    name: 'POST /api/extension/sync-connections',
    load: async () => (await import('../extension/sync-connections/route')).POST as Handler,
    url: 'http://localhost/api/extension/sync-connections',
    body: {
      linkedin_url: 'https://www.linkedin.com/in/someone',
      mutual_connections: ['Someone Else'],
    },
  },
  {
    name: 'POST /api/extension/jobs',
    load: async () => (await import('../extension/jobs/route')).POST as Handler,
    url: 'http://localhost/api/extension/jobs',
    body: { job_title: 'Engineer', company: 'Acme' },
  },
]

describe('extension routes require a valid bearer token', () => {
  beforeEach(() => {
    vi.resetModules()
    mockClient = makeSupabaseMock(null)
  })

  for (const { name, load, url, body } of routes) {
    it(`${name} rejects a request with no Authorization header`, async () => {
      const res = await (await load())(post(url, {}, body))

      expect(res.status).toBe(401)
      expect(mockClient.queries).toEqual([])
    })

    it(`${name} rejects a non-Bearer Authorization header`, async () => {
      // The old scheme; it must no longer be honoured.
      const res = await (await load())(post(url, { 'x-api-key': 'legacy-key' }, body))

      expect(res.status).toBe(401)
      expect(mockClient.queries).toEqual([])
    })

    it(`${name} rejects a malformed Authorization header`, async () => {
      const res = await (await load())(post(url, { authorization: 'Basic abc123' }, body))

      expect(res.status).toBe(401)
      expect(mockClient.queries).toEqual([])
    })

    it(`${name} rejects a token Supabase does not recognise`, async () => {
      mockClient = makeSupabaseMock(null, { message: 'invalid JWT' })

      const res = await (await load())(
        post(url, { authorization: 'Bearer forged.token.value' }, body),
      )

      expect(res.status).toBe(401)
      expect(mockClient.queries).toEqual([])
    })
  }
})

describe('extension routes scope queries to the token holder', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('lookup-contact filters contacts by the authenticated user id', async () => {
    const userId = 'ab000000-0000-4000-8000-00000000000f'
    mockClient = makeSupabaseMock({ id: userId })

    const { POST } = await import('../extension/lookup-contact/route')
    await POST(post(
      'http://localhost/api/extension/lookup-contact',
      { authorization: 'Bearer good.token.value' },
      { linkedin_url: 'https://www.linkedin.com/in/someone' },
    ))

    // Identity must come from the token, never from an env-var default.
    expect(mockClient.queries.length).toBeGreaterThan(0)
    for (const q of mockClient.queries) {
      expect(q.table).toBe('contacts')
      expect(q.ops.join(' ')).toContain(`eq("user_id", "${userId}")`)
    }
  })

  it('lookup-contact strips PostgREST metacharacters from the username', async () => {
    mockClient = makeSupabaseMock({ id: 'ab000000-0000-4000-8000-00000000000f' })

    const { POST } = await import('../extension/lookup-contact/route')
    await POST(post(
      'http://localhost/api/extension/lookup-contact',
      { authorization: 'Bearer good.token.value' },
      // A username crafted to close the filter and append a condition.
      { linkedin_url: 'https://www.linkedin.com/in/eve,user_id.neq.00000000' },
    ))

    const orClauses = mockClient.queries
      .flatMap(q => q.ops)
      .filter(op => op.startsWith('or('))

    // The comma is what would end one filter clause and begin an injected
    // one. Stripping it leaves the payload inert inside a single value:
    // "eveuser_id.neq.00000000" is just a string that matches nothing.
    // Assert on clause structure rather than the substring, which survives
    // harmlessly as part of that value.
    expect(orClauses.length).toBeGreaterThan(0)
    for (const clause of orClauses) {
      // The filter the route builds has exactly two comma-separated terms;
      // an injected condition would add a third.
      const inner = clause.slice('or('.length, -1).replace(/^"|"$/g, '')
      expect(inner.split(',')).toHaveLength(2)
    }
  })
})

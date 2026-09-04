/**
 * Authorization tests for the two routes that cannot use a user session:
 *
 *   /api/n8n/contacts      — server-to-server, shared secret in x-api-key
 *   /api/contacts/[id]/snooze — a one-click link in an email, HMAC-signed
 *
 * Both run with the service-role key once past the gate, so the gate is the
 * only thing standing between an anonymous caller and unrestricted writes.
 */
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import { makeSupabaseMock, type MockSupabase } from './helpers/supabase-mock'
import { generateSnoozeToken } from '@/lib/snooze-hmac'

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

let mockClient: MockSupabase

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockClient),
}))

const ORIGINAL_ENV = { ...process.env }

beforeEach(() => {
  vi.resetModules()
  mockClient = makeSupabaseMock(null)
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

describe('POST /api/n8n/contacts requires the shared secret', () => {
  const body = { name: 'Test Person', company: 'Acme' }

  const post = (headers: Record<string, string>) =>
    new NextRequest(new Request('http://localhost/api/n8n/contacts', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    }))

  it('rejects a request with no api key', async () => {
    process.env.N8N_API_KEY = 'the-real-key'
    const { POST } = await import('../n8n/contacts/route')

    const res = await POST(post({}))

    expect(res.status).toBe(401)
    expect(mockClient.queries).toEqual([])
  })

  it('rejects a wrong api key', async () => {
    process.env.N8N_API_KEY = 'the-real-key'
    const { POST } = await import('../n8n/contacts/route')

    const res = await POST(post({ 'x-api-key': 'not-the-real-key' }))

    expect(res.status).toBe(401)
    expect(mockClient.queries).toEqual([])
  })

  it('rejects a key that is a prefix of the real one', async () => {
    // Guards the length check in secretsMatch: a prefix must not pass.
    process.env.N8N_API_KEY = 'the-real-key'
    const { POST } = await import('../n8n/contacts/route')

    const res = await POST(post({ 'x-api-key': 'the-real' }))

    expect(res.status).toBe(401)
  })

  it('refuses every request when the secret is not configured', async () => {
    // An unset env var must fail closed. If `undefined === undefined` ever
    // slipped through, a missing key would authenticate everyone.
    delete process.env.N8N_API_KEY
    const { POST } = await import('../n8n/contacts/route')

    expect((await POST(post({}))).status).toBe(401)
    expect((await POST(post({ 'x-api-key': '' }))).status).toBe(401)
    expect((await POST(post({ 'x-api-key': 'undefined' }))).status).toBe(401)
    expect(mockClient.queries).toEqual([])
  })
})

describe('GET /api/contacts/[id]/snooze requires a valid signature', () => {
  const SECRET = 'a'.repeat(64) // 32 bytes, hex
  const CONTACT = 'c0000000-0000-4000-8000-000000000001'
  const USER = 'u0000000-0000-4000-8000-000000000002'

  const get = (query: string) =>
    new NextRequest(new Request(`http://localhost/api/contacts/${CONTACT}/snooze?${query}`))

  const ctx = { params: Promise.resolve({ id: CONTACT }) }

  it('rejects a link with no token', async () => {
    process.env.SNOOZE_LINK_SECRET = SECRET
    const { GET } = await import('../contacts/[id]/snooze/route')

    const res = await GET(get(`duration=1w&uid=${USER}`), ctx)

    expect(await res.text()).toContain('Invalid link')
    expect(mockClient.queries).toEqual([])
  })

  it('rejects a forged token', async () => {
    process.env.SNOOZE_LINK_SECRET = SECRET
    const { GET } = await import('../contacts/[id]/snooze/route')

    const res = await GET(get(`duration=1w&uid=${USER}&token=${'f'.repeat(64)}`), ctx)

    expect(await res.text()).toContain('invalid or has been tampered with')
    expect(mockClient.queries).toEqual([])
  })

  it('rejects a token signed for a different duration', async () => {
    // The signature covers (id, duration, uid), so swapping the duration in
    // the URL must not let a 1-week link snooze a contact indefinitely.
    process.env.SNOOZE_LINK_SECRET = SECRET
    const token = await generateSnoozeToken(CONTACT, '1w', USER, SECRET)
    const { GET } = await import('../contacts/[id]/snooze/route')

    const res = await GET(get(`duration=indefinite&uid=${USER}&token=${token}`), ctx)

    expect(await res.text()).toContain('invalid or has been tampered with')
    expect(mockClient.queries).toEqual([])
  })

  it('rejects a token signed for a different user', async () => {
    process.env.SNOOZE_LINK_SECRET = SECRET
    const token = await generateSnoozeToken(CONTACT, '1w', USER, SECRET)
    const { GET } = await import('../contacts/[id]/snooze/route')

    const otherUser = 'u0000000-0000-4000-8000-000000000099'
    const res = await GET(get(`duration=1w&uid=${otherUser}&token=${token}`), ctx)

    expect(await res.text()).toContain('invalid or has been tampered with')
    expect(mockClient.queries).toEqual([])
  })

  it('rejects an unknown duration before checking the signature', async () => {
    process.env.SNOOZE_LINK_SECRET = SECRET
    const { GET } = await import('../contacts/[id]/snooze/route')

    const res = await GET(get(`duration=forever&uid=${USER}&token=${'0'.repeat(64)}`), ctx)

    expect(await res.text()).toContain('Unknown snooze duration')
    expect(mockClient.queries).toEqual([])
  })

  it('fails closed when the signing secret is not configured', async () => {
    delete process.env.SNOOZE_LINK_SECRET
    const { GET } = await import('../contacts/[id]/snooze/route')

    const res = await GET(get(`duration=1w&uid=${USER}&token=${'0'.repeat(64)}`), ctx)

    expect(await res.text()).toContain('not configured')
    expect(mockClient.queries).toEqual([])
  })

  it('accepts a correctly signed link and scopes the write to that user', async () => {
    process.env.SNOOZE_LINK_SECRET = SECRET
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role'
    mockClient = makeSupabaseMock(null)

    const token = await generateSnoozeToken(CONTACT, '1w', USER, SECRET)
    const { GET } = await import('../contacts/[id]/snooze/route')

    await GET(get(`duration=1w&uid=${USER}&token=${token}`), ctx)

    // A valid signature reaches the database — and every statement must be
    // filtered by both the contact id and the signed user id, since this
    // client holds the service-role key and bypasses RLS.
    expect(mockClient.queries.length).toBeGreaterThan(0)
    for (const q of mockClient.queries) {
      expect(q.table).toBe('contacts')
      expect(q.ops.join(' ')).toContain(`eq("user_id", "${USER}")`)
      expect(q.ops.join(' ')).toContain(`eq("id", "${CONTACT}")`)
    }
  })
})

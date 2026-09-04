/**
 * Test doubles for the Supabase clients the API routes build.
 *
 * These tests exercise the authorization gate only: does the handler refuse a
 * request that carries no valid credential, and does it refuse without
 * disclosing data? The query builder below therefore records what was asked
 * for and returns empty results — it is not a database.
 *
 * If a handler ever reaches the query builder on an unauthenticated request,
 * `queries` is non-empty and the test fails. That is the real assertion: an
 * auth gate that returns 401 *after* querying still leaked a read.
 */
import { vi } from 'vitest'

export interface RecordedQuery {
  table: string
  ops: string[]
}

export interface MockSupabase {
  auth: {
    getUser: ReturnType<typeof vi.fn>
  }
  from: ReturnType<typeof vi.fn>
  /** Every .from(...) chain the handler built. Empty means no DB access. */
  queries: RecordedQuery[]
}

/**
 * Build a Supabase stub whose auth.getUser() resolves to the given result.
 *
 * @param user  the user object to return, or null for "not signed in"
 * @param error an auth error to return alongside a null user
 */
export function makeSupabaseMock(
  user: { id: string } | null,
  error: { message: string } | null = null,
): MockSupabase {
  const queries: RecordedQuery[] = []

  const from = vi.fn((table: string) => {
    const record: RecordedQuery = { table, ops: [] }
    queries.push(record)

    // A chainable builder: every method records itself and returns the
    // builder, so `.select().eq().order()` works. Awaiting it yields an
    // empty result set.
    const builder: Record<string, unknown> = {}
    const chain = (name: string) => (...args: unknown[]) => {
      record.ops.push(`${name}(${args.map(a => JSON.stringify(a)).join(', ')})`)
      return builder
    }

    for (const method of [
      'select', 'insert', 'update', 'upsert', 'delete',
      'eq', 'neq', 'in', 'or', 'ilike', 'gt', 'gte', 'lt', 'lte',
      'is', 'not', 'order', 'range', 'limit', 'match',
    ]) {
      builder[method] = chain(method)
    }

    builder.single = chain('single')
    builder.maybeSingle = chain('maybeSingle')
    // Make the builder awaitable, resolving to an empty PostgREST response.
    builder.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null, count: 0 }).then(resolve)

    return builder
  })

  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user }, error })),
    },
    from,
    queries,
  }
}

/** A stub that is signed out: no user, no error. */
export const anonymous = () => makeSupabaseMock(null)

/** A stub whose token check fails, as an expired/forged JWT would. */
export const invalidToken = () =>
  makeSupabaseMock(null, { message: 'invalid JWT' })

import { normalizeEmail } from './identity.ts'

export function buildMatchMap(
  contacts: { id: string; email: string | null }[],
  aliases: { contact_id: string; email: string }[]
): Map<string, string> {
  const m = new Map<string, string>()
  for (const c of contacts) {
    if (c.email) m.set(normalizeEmail(c.email), c.id)
  }
  for (const a of aliases) {
    // primary email wins if collision; only add alias if not already mapped
    const key = normalizeEmail(a.email)
    if (!m.has(key)) m.set(key, a.contact_id)
  }
  return m
}

export function resolveContact(
  email: string, map: Map<string, string>
): string | null {
  return map.get(normalizeEmail(email)) ?? null
}

import type { Direction } from './types.ts'

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

export function isOwn(email: string, identity: Set<string>): boolean {
  return identity.has(normalizeEmail(email))
}

export function classifyDirection(
  fromEmail: string, identity: Set<string>
): Direction {
  return isOwn(fromEmail, identity) ? 'outbound' : 'inbound'
}

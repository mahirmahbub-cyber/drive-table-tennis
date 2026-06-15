import type { SessionState } from './seeder-session'

export const STORAGE_KEY = 'quick-seeder:v1'

/**
 * Serialize a session to a JSON string suitable for localStorage.
 */
export function serializeSession(s: SessionState): string {
  return JSON.stringify(s)
}

/** Parse a stored session, returning null for anything that isn't a valid shape. */
export function parseStoredSession(raw: string | null): SessionState | null {
  if (!raw) return null
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof data !== 'object' || data === null) return null
  const d = data as Record<string, unknown>
  const config = d.config as Record<string, unknown> | undefined
  const okConfig =
    !!config &&
    typeof config.target === 'number' &&
    typeof config.minutes === 'number' &&
    typeof config.mix === 'number' &&
    typeof config.seed === 'number'
  if (!okConfig || !Array.isArray(d.roster) || !Array.isArray(d.queue)) return null
  return data as SessionState
}

import { describe, it, expect } from 'vitest'
import { STORAGE_KEY, serializeSession, parseStoredSession } from './seeder-storage'
import { createSession, toggleRosterPlayer, generate, setConfig } from './seeder-session'

describe('storage', () => {
  it('uses a versioned key', () => {
    expect(STORAGE_KEY).toBe('quick-seeder:v1')
  })

  it('round-trips a session', () => {
    let s = createSession(7)
    s = toggleRosterPlayer(s, { id: 'a', name: 'A', elo: 1200 })
    s = toggleRosterPlayer(s, { id: 'b', name: 'B', elo: 1300 })
    s = generate(setConfig(s, { minutes: 30 }))
    const back = parseStoredSession(serializeSession(s))
    expect(back).toEqual(s)
  })

  it('returns null for missing or malformed data', () => {
    expect(parseStoredSession(null)).toBeNull()
    expect(parseStoredSession('not json')).toBeNull()
    expect(parseStoredSession('{"roster":[]}')).toBeNull() // missing config/queue
    expect(parseStoredSession('{"config":{},"roster":"x","queue":[]}')).toBeNull()
  })
})

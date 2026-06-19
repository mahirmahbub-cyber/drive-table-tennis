import { describe, it, expect } from 'vitest'
import { isDuplicatePlayer } from './player-dedup'

describe('isDuplicatePlayer', () => {
  const now = 1_000_000
  it('flags the same name (case-insensitive, trimmed) within the window', () => {
    expect(isDuplicatePlayer({ name: 'Alice ', createdAtMs: now - 5000 }, 'alice', now)).toBe(true)
  })
  it('ignores matches older than the window', () => {
    expect(isDuplicatePlayer({ name: 'Alice', createdAtMs: now - 20_000 }, 'Alice', now)).toBe(false)
  })
  it('does not flag different names', () => {
    expect(isDuplicatePlayer({ name: 'Alice', createdAtMs: now }, 'Bob', now)).toBe(false)
  })
})

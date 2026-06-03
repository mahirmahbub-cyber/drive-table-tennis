import { describe, it, expect } from 'vitest'
import { DEDUP_WINDOW_MS, isDuplicateMatch } from '@/lib/match-dedup'

const base = { playerAId: 'a', playerBId: 'b', sets: [[11, 9], [11, 7]] as [number, number][] }

describe('isDuplicateMatch', () => {
  const now = 1_000_000
  it('flags identical sitting within the window', () => {
    const existing = { playerAId: 'a', playerBId: 'b', setScores: [[11, 9], [11, 7]] as [number, number][], createdAtMs: now - 2000 }
    expect(isDuplicateMatch(existing, base, now)).toBe(true)
  })
  it('ignores when outside the window', () => {
    const existing = { playerAId: 'a', playerBId: 'b', setScores: [[11, 9], [11, 7]] as [number, number][], createdAtMs: now - DEDUP_WINDOW_MS - 1 }
    expect(isDuplicateMatch(existing, base, now)).toBe(false)
  })
  it('matches regardless of player orientation, comparing scores in that orientation', () => {
    const existing = { playerAId: 'b', playerBId: 'a', setScores: [[9, 11], [7, 11]] as [number, number][], createdAtMs: now - 1000 }
    expect(isDuplicateMatch(existing, base, now)).toBe(true)
  })
  it('not a duplicate when scores differ', () => {
    const existing = { playerAId: 'a', playerBId: 'b', setScores: [[11, 9]] as [number, number][], createdAtMs: now - 1000 }
    expect(isDuplicateMatch(existing, base, now)).toBe(false)
  })
})

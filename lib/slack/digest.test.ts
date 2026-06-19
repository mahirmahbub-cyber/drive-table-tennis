import { describe, it, expect } from 'vitest'
import { buildWeeklyDigest, buildDailyDigest, type DigestInput, type PlayerLite } from './digest'
import type { EngineMatch } from '@/lib/stats-engine'

const players = new Map<string, PlayerLite>([
  ['a', { name: 'Alice', nickname: null }],
  ['b', { name: 'Bob', nickname: null }],
  ['c', { name: 'Carol', nickname: null }],
])

function m(over: Partial<EngineMatch>): EngineMatch {
  return {
    id: 'x', playerAId: 'a', playerBId: 'b', winnerId: 'a',
    setScores: [[11, 5]], durationSeconds: 300,
    playedAt: new Date('2026-06-10T02:00:00Z'),
    eloABefore: 1200, eloAAfter: 1216, eloBBefore: 1200, eloBAfter: 1184,
    ...over,
  }
}

const weekRange = { start: new Date('2026-06-07T14:00:00Z'), end: new Date('2026-06-14T14:00:00Z') }
const dayRange = { start: new Date('2026-06-09T14:00:00Z'), end: new Date('2026-06-10T14:00:00Z') }

describe('buildWeeklyDigest', () => {
  it('returns null when no games fall in the window', () => {
    const input: DigestInput = { engineMatches: [], playersById: players, range: weekRange }
    expect(buildWeeklyDigest(input)).toBeNull()
  })
  it('builds variables with names and counts', () => {
    const input: DigestInput = { engineMatches: [m({})], playersById: players, range: weekRange }
    const v = buildWeeklyDigest(input)!
    expect(v.games_played).toBe('1')
    expect(v.biggest_beatdown).toBe('Alice beat Bob 11–5')
    expect(v.top_risers).toContain('Alice +16')
    expect(v.biggest_fallers).toContain('Bob -16')
  })
  it('always includes every key, using — for missing data', () => {
    const input: DigestInput = { engineMatches: [m({})], playersById: players, range: weekRange }
    const v = buildWeeklyDigest(input)!
    for (const key of ['week_range','games_played','biggest_beatdown','biggest_upset','top_risers','biggest_fallers','top_rivalry','longest_game','fastest_game']) {
      expect(v[key]).toBeDefined()
    }
  })
})

describe('buildDailyDigest', () => {
  it('returns null on an empty day', () => {
    const input: DigestInput = { engineMatches: [], playersById: players, range: dayRange }
    expect(buildDailyDigest(input)).toBeNull()
  })
  it('reports the biggest swing match and winner', () => {
    const input: DigestInput = { engineMatches: [m({})], playersById: players, range: dayRange }
    const v = buildDailyDigest(input)!
    expect(v.biggest_swing_match).toBe('Alice beat Bob 11–5 · +16 ELO')
    expect(v.biggest_winner).toContain('Alice · +16 ELO')
  })
})

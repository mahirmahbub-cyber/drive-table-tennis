import { describe, it, expect } from 'vitest'
import { inRange, biggestEloSwingMatch, recentlyActive, type EngineMatch } from './stats-engine'

function m(over: Partial<EngineMatch>): EngineMatch {
  return {
    id: 'x', playerAId: 'a', playerBId: 'b', winnerId: 'a',
    setScores: [[11, 5]], durationSeconds: 300,
    playedAt: new Date('2026-06-10T00:00:00Z'),
    eloABefore: 1200, eloAAfter: 1216, eloBBefore: 1200, eloBAfter: 1184,
    ...over,
  }
}

describe('inRange', () => {
  it('keeps matches in [start, end) and drops the rest', () => {
    const all = [
      m({ id: 'before', playedAt: new Date('2026-06-07T13:59:00Z') }),
      m({ id: 'in', playedAt: new Date('2026-06-10T00:00:00Z') }),
      m({ id: 'on-end', playedAt: new Date('2026-06-14T14:00:00Z') }),
    ]
    const out = inRange(all, new Date('2026-06-07T14:00:00Z'), new Date('2026-06-14T14:00:00Z'))
    expect(out.map((x) => x.id)).toEqual(['in'])
  })
})

describe('biggestEloSwingMatch', () => {
  it('picks the match where the winner gained the most', () => {
    const all = [
      m({ id: 'small', eloABefore: 1200, eloAAfter: 1210 }),
      m({ id: 'big', eloABefore: 1200, eloAAfter: 1232 }),
      m({ id: 'tie', winnerId: null }),
    ]
    expect(biggestEloSwingMatch(all)?.id).toBe('big')
  })
  it('returns null when no match has a winner', () => {
    expect(biggestEloSwingMatch([m({ winnerId: null })])).toBeNull()
  })
})

describe('recentlyActive', () => {
  it('includes both players of matches at/after since, excludes older', () => {
    const all = [
      m({ playerAId: 'a', playerBId: 'b', playedAt: new Date('2026-06-01T00:00:00Z') }),
      m({ playerAId: 'c', playerBId: 'd', playedAt: new Date('2026-06-12T00:00:00Z') }),
    ]
    const ids = recentlyActive(all, new Date('2026-06-10T00:00:00Z'))
    expect([...ids].sort()).toEqual(['c', 'd'])
  })
})

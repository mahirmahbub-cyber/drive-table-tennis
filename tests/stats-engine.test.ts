import { describe, it, expect } from 'vitest'
import {
  matchPoints,
  matchMargin,
  playerAggregates,
  movers,
  upsetOfWeek,
  demolitionOfWeek,
  durationRecords,
  mostPlayedRivalry,
  headToHead,
  participation,
  type EngineMatch,
} from '@/lib/stats-engine'

const d = (iso: string) => new Date(iso)

function m(p: Partial<EngineMatch> & { id: string }): EngineMatch {
  return {
    id: p.id,
    playerAId: p.playerAId ?? 'A',
    playerBId: p.playerBId ?? 'B',
    winnerId: p.winnerId ?? 'A',
    setScores: p.setScores ?? [[11, 5]],
    durationSeconds: p.durationSeconds ?? 600,
    playedAt: p.playedAt ?? d('2026-06-01T10:00:00Z'),
    eloABefore: p.eloABefore ?? 1200,
    eloAAfter: p.eloAAfter ?? 1216,
    eloBBefore: p.eloBBefore ?? 1200,
    eloBAfter: p.eloBAfter ?? 1184,
  }
}

describe('matchPoints', () => {
  it('sums points for each side across sets', () => {
    const r = matchPoints(m({ id: '1', setScores: [[11, 8], [9, 11], [11, 6]] }))
    expect(r).toEqual({ aFor: 31, aAgainst: 25, bFor: 25, bAgainst: 31, sets: 3 })
  })
})

describe('matchMargin', () => {
  it('absolute total points difference', () => {
    expect(matchMargin(m({ id: '1', setScores: [[11, 8], [9, 11], [11, 6]] }))).toBe(6)
  })
})

describe('playerAggregates', () => {
  const matches: EngineMatch[] = [
    m({ id: '1', winnerId: 'A', setScores: [[11, 5]], durationSeconds: 300, playedAt: d('2026-05-30T10:00:00Z'), eloABefore: 1200, eloAAfter: 1212 }),
    m({ id: '2', winnerId: 'A', setScores: [[11, 9], [11, 7]], durationSeconds: 600, playedAt: d('2026-05-31T10:00:00Z'), eloABefore: 1212, eloAAfter: 1222 }),
    m({ id: '3', winnerId: 'B', setScores: [[5, 11], [8, 11]], durationSeconds: 500, playedAt: d('2026-06-01T10:00:00Z'), eloABefore: 1222, eloAAfter: 1210 }),
  ]

  it('computes record, streak and points stats for player A', () => {
    const s = playerAggregates(matches, 'A', 1216)
    expect(s.games).toBe(3)
    expect(s.wins).toBe(2)
    expect(s.losses).toBe(1)
    expect(s.winPct).toBe(67)
    expect(s.currentStreak).toBe(-1)
    expect(s.longestWinStreak).toBe(2)
    expect(s.peakElo).toBe(1222)
    expect(s.pointsFor).toBe(46)
    expect(s.pointsAgainst).toBe(43)
    expect(s.pointsRatio).toBeCloseTo(46 / 43, 3)
    expect(s.avgGameSeconds).toBe(467)
  })

  it('returns null rate stats below the min-sample guard', () => {
    const s = playerAggregates([matches[0]], 'A', 1212, 3)
    expect(s.winPct).toBeNull()
    expect(s.pointsRatio).toBeNull()
  })
})

describe('weekly window', () => {
  const since = d('2026-05-29T00:00:00Z')
  const ms: EngineMatch[] = [
    m({ id: '1', playerAId: 'A', playerBId: 'B', winnerId: 'A', setScores: [[11, 2]], durationSeconds: 200, playedAt: d('2026-05-30T10:00:00Z'), eloABefore: 1200, eloAAfter: 1216, eloBBefore: 1400, eloBAfter: 1384 }),
    m({ id: '2', playerAId: 'A', playerBId: 'B', winnerId: 'B', setScores: [[9, 11], [8, 11]], durationSeconds: 900, playedAt: d('2026-05-31T10:00:00Z'), eloABefore: 1216, eloAAfter: 1208, eloBBefore: 1384, eloBAfter: 1392 }),
    m({ id: '3', playerAId: 'A', playerBId: 'C', winnerId: 'A', setScores: [[11, 9]], durationSeconds: 400, playedAt: d('2026-06-01T10:00:00Z'), eloABefore: 1208, eloAAfter: 1218, eloBBefore: 1210, eloBAfter: 1200 }),
  ]

  it('movers: net ELO change in window per player, sorted desc', () => {
    const r = movers(ms, since)
    const a = r.find((x) => x.playerId === 'A')!
    expect(a.delta).toBe(18) // 1218 - 1200
    const b = r.find((x) => x.playerId === 'B')!
    expect(b.delta).toBe(-8) // first B before 1400 (match1) -> last B after 1392 (match2)
    expect(r[0].delta).toBeGreaterThanOrEqual(r[r.length - 1].delta)
  })

  it('upsetOfWeek: lower-rated winner with biggest rating gap', () => {
    expect(upsetOfWeek(ms, since)?.id).toBe('1') // A(1200) beat B(1400)
  })

  it('demolitionOfWeek: biggest points margin', () => {
    expect(demolitionOfWeek(ms, since)?.id).toBe('1') // 11-2 => margin 9
  })

  it('durationRecords: longest + fastest within window', () => {
    const r = durationRecords(ms, since)
    expect(r.longest?.id).toBe('2')
    expect(r.fastest?.id).toBe('1')
  })

  it('mostPlayedRivalry: pair with most games', () => {
    const r = mostPlayedRivalry(ms, since)!
    expect([r.p1, r.p2].sort()).toEqual(['A', 'B'])
    expect(r.games).toBe(2)
  })

  it('headToHead: win counts per side', () => {
    expect(headToHead(ms, 'A', 'B')).toEqual({ p1Wins: 1, p2Wins: 1 })
  })

  it('participation: distinct players and games in window', () => {
    const r = participation(ms, ['A', 'B', 'C', 'D'], since)
    expect(r.games).toBe(3)
    expect(r.distinctPlayers).toBe(3)
    expect(r.rate).toBe(75)
  })
})

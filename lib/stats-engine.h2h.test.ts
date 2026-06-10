import { describe, it, expect } from 'vitest'
import { headToHeadDetail, type EngineMatch } from './stats-engine'

const m = (over: Partial<EngineMatch>): EngineMatch => ({
  id: 'x', playerAId: 'p1', playerBId: 'p2', winnerId: 'p1',
  setScores: [[11, 5], [11, 7]], durationSeconds: 600,
  playedAt: new Date('2026-01-01'),
  eloABefore: 1200, eloAAfter: 1215, eloBBefore: 1200, eloBAfter: 1185,
  ...over,
})

describe('headToHeadDetail — zero matches', () => {
  it('returns zeroed detail when pair has never played', () => {
    const r = headToHeadDetail([], 'p1', 'p2')
    expect(r.matchCount).toBe(0)
    expect(r.p1MatchWins).toBe(0)
    expect(r.avgDurationSeconds).toBeNull()
    expect(r.avgScoreDifferential).toBeNull()
    expect(r.last5Form).toEqual([])
    expect(r.eloSwingSeries).toEqual([])
  })
  it('ignores matches between unrelated players', () => {
    const r = headToHeadDetail([m({ playerAId: 'x', playerBId: 'y' })], 'p1', 'p2')
    expect(r.matchCount).toBe(0)
  })
})

describe('headToHeadDetail — single match', () => {
  it('counts game and match wins when p1 is playerA', () => {
    const r = headToHeadDetail([m({})], 'p1', 'p2')
    expect(r.p1GameWins).toBe(2)
    expect(r.p2GameWins).toBe(0)
    expect(r.p1MatchWins).toBe(1)
    expect(r.p2MatchWins).toBe(0)
  })
  it('flips perspective when queried as (p2, p1)', () => {
    const r = headToHeadDetail([m({})], 'p2', 'p1')
    expect(r.p1GameWins).toBe(0)
    expect(r.p2GameWins).toBe(2)
    expect(r.p1MatchWins).toBe(0)
    expect(r.p2MatchWins).toBe(1)
    expect(r.last5Form).toEqual(['L'])
    expect(r.totalEloTakenByP1).toBe(-15)
  })
  it('skips tied sets in game wins', () => {
    const r = headToHeadDetail([m({ setScores: [[10, 10], [11, 7]] })], 'p1', 'p2')
    expect(r.p1GameWins).toBe(1)
    expect(r.p2GameWins).toBe(0)
  })
  it('null duration → null average', () => {
    expect(headToHeadDetail([m({ durationSeconds: null })], 'p1', 'p2').avgDurationSeconds).toBeNull()
  })
  it('builds a one-point elo swing series', () => {
    const r = headToHeadDetail([m({})], 'p1', 'p2')
    expect(r.eloSwingSeries).toEqual([
      { matchIndex: 1, date: '1 Jan', cumulativeDelta: 15, matchDelta: 15 },
    ])
    expect(r.totalEloTakenByP1).toBe(15)
    expect(r.totalEloTakenByP2).toBe(-15)
  })
})

describe('headToHeadDetail — multiple matches', () => {
  const matches = [
    m({ id: '2', playedAt: new Date('2026-01-02'), setScores: [[5, 11], [7, 11]],
        eloABefore: 1215, eloAAfter: 1200, eloBBefore: 1185, eloBAfter: 1200 }),
    m({ id: '1', playedAt: new Date('2026-01-01') }), // deliberately out of order
    m({ id: '3', playedAt: new Date('2026-01-03'), setScores: [[11, 9], [11, 9]],
        eloABefore: 1200, eloAAfter: 1213, eloBBefore: 1200, eloBAfter: 1187 }),
  ]
  it('sorts chronologically and counts match wins', () => {
    const r = headToHeadDetail(matches, 'p1', 'p2')
    expect(r.matchCount).toBe(3)
    expect(r.p1MatchWins).toBe(2)
    expect(r.p2MatchWins).toBe(1)
  })
  it('last5Form is W/L from p1 perspective, oldest first', () => {
    expect(headToHeadDetail(matches, 'p1', 'p2').last5Form).toEqual(['W', 'L', 'W'])
  })
  it('last5Form caps at 5', () => {
    const many = Array.from({ length: 7 }, (_, i) =>
      m({ id: String(i), playedAt: new Date(2026, 0, i + 1) }))
    expect(headToHeadDetail(many, 'p1', 'p2').last5Form).toHaveLength(5)
  })
  it('cumulative elo swing is a running total', () => {
    const r = headToHeadDetail(matches, 'p1', 'p2')
    expect(r.eloSwingSeries.map(p => p.cumulativeDelta)).toEqual([15, 0, 13])
    expect(r.totalEloTakenByP1).toBe(13)
    expect(r.totalEloTakenByP2).toBe(-13)
  })
  it('averages duration only over timed matches (> 0)', () => {
    const mixed = [
      m({ id: 'a', durationSeconds: 600 }),
      m({ id: 'b', durationSeconds: 0 }),
      m({ id: 'c', durationSeconds: null }),
      m({ id: 'd', durationSeconds: 900 }),
    ]
    expect(headToHeadDetail(mixed, 'p1', 'p2').avgDurationSeconds).toBe(750)
  })
  it('avgScoreDifferential is mean point margin per game to 1dp', () => {
    // games: 11-5, 11-7 | 5-11, 7-11 | 11-9, 11-9 → margins 6,4,6,4,2,2 → 24/6 = 4
    expect(headToHeadDetail(matches, 'p1', 'p2').avgScoreDifferential).toBe(4)
  })
  it('tied games count as zero-margin games in avgScoreDifferential', () => {
    // margins 0, 4 → 2
    const r = headToHeadDetail([m({ setScores: [[10, 10], [11, 7]] })], 'p1', 'p2')
    expect(r.avgScoreDifferential).toBe(2)
  })
  it('rounds avgScoreDifferential to 1dp', () => {
    // margins 6, 4, 1 → 11/3 = 3.666… → 3.7
    const r = headToHeadDetail([m({ setScores: [[11, 5], [11, 7], [10, 11]] })], 'p1', 'p2')
    expect(r.avgScoreDifferential).toBe(3.7)
  })
})

describe('headToHeadDetail — drawn match', () => {
  it('drawn match counts in matchCount but not wins or form', () => {
    const r = headToHeadDetail([m({ setScores: [[11, 5], [5, 11]] })], 'p1', 'p2')
    expect(r.matchCount).toBe(1)
    expect(r.p1MatchWins).toBe(0)
    expect(r.p2MatchWins).toBe(0)
    expect(r.last5Form).toEqual([])
  })
})

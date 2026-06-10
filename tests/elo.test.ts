import { describe, it, expect } from 'vitest'
import { applyMatch, applyGames, projectGamesWon, K_FACTOR, STARTING_ELO } from '@/lib/elo'

describe('applyMatch', () => {
  it('exposes the canonical constants', () => {
    expect(K_FACTOR).toBe(32)
    expect(STARTING_ELO).toBe(1200)
  })

  it('equal-rated players: winner +16, loser -16', () => {
    const r = applyMatch(1200, 1200, 'A')
    expect(r.deltaA).toBe(16)
    expect(r.deltaB).toBe(-16)
    expect(r.eloA).toBe(1216)
    expect(r.eloB).toBe(1184)
  })

  it('zero-sum: deltaA + deltaB === 0 for equal ratings', () => {
    const r = applyMatch(1500, 1500, 'B')
    expect(r.deltaA + r.deltaB).toBe(0)
  })

  it('upset: low-rated beats high-rated → big swing', () => {
    const r = applyMatch(1000, 1400, 'A')
    expect(r.deltaA).toBeGreaterThan(25)
    expect(r.deltaB).toBeLessThan(-25)
  })

  it('expected outcome: high-rated beats low-rated → small swing', () => {
    const r = applyMatch(1400, 1000, 'A')
    expect(r.deltaA).toBeLessThan(10)
    expect(r.deltaA).toBeGreaterThan(0)
  })

  it('result is symmetric under swap of A/B and winner', () => {
    const r1 = applyMatch(1300, 1100, 'A')
    const r2 = applyMatch(1100, 1300, 'B')
    expect(r1.deltaA).toBe(r2.deltaB)
    expect(r1.deltaB).toBe(r2.deltaA)
  })
})

describe('applyGames', () => {
  it('matches applyMatch for a single decisive game', () => {
    const single = applyMatch(1200, 1200, 'A')
    const games = applyGames(1200, 1200, [[11, 7]])
    expect(games.eloA).toBe(single.eloA)
    expect(games.eloB).toBe(single.eloB)
  })
  it('threads rating through games in order (2-1 to A)', () => {
    let a = 1200, b = 1200
    for (const w of ['A', 'B', 'A'] as const) { const r = applyMatch(a, b, w); a = r.eloA; b = r.eloB }
    const res = applyGames(1200, 1200, [[11, 9], [8, 11], [11, 6]])
    expect(res.eloA).toBe(a); expect(res.eloB).toBe(b); expect(res.deltaA).toBe(a - 1200)
  })
  it('skips games with an equal score (no result)', () => {
    const res = applyGames(1200, 1200, [[11, 11]])
    expect(res.eloA).toBe(1200); expect(res.eloB).toBe(1200); expect(res.deltaA).toBe(0)
  })
  it('a 1-1 tie still moves both ratings, nets symmetric at equal elo', () => {
    const res = applyGames(1200, 1200, [[11, 9], [9, 11]])
    expect(res.deltaA).toBe(-res.deltaB)
  })
})

describe('projectGamesWon', () => {
  it('a single A win matches applyMatch', () => {
    const p = projectGamesWon(1200, 1200, 1, 0)
    expect(p.eloAAfter).toBe(1216)
    expect(p.eloBAfter).toBe(1184)
    expect(p.deltaA).toBe(16)
    expect(p.deltaB).toBe(-16)
    expect(p.steps).toHaveLength(1)
    expect(p.steps[0]).toMatchObject({ game: 1, winner: 'A', eloA: 1216, eloB: 1184 })
  })

  it('no games → no change, no steps', () => {
    const p = projectGamesWon(1200, 1300, 0, 0)
    expect(p.deltaA).toBe(0)
    expect(p.deltaB).toBe(0)
    expect(p.steps).toEqual([])
    expect(p.eloAAfter).toBe(1200)
    expect(p.eloBAfter).toBe(1300)
  })

  it('interleaves wins evenly (3-1 → A,B,A,A)', () => {
    const p = projectGamesWon(1200, 1200, 3, 1)
    expect(p.steps.map((s) => s.winner)).toEqual(['A', 'B', 'A', 'A'])
  })

  it('interleaves wins evenly (2-2 → A,B,A,B)', () => {
    const p = projectGamesWon(1200, 1200, 2, 2)
    expect(p.steps.map((s) => s.winner)).toEqual(['A', 'B', 'A', 'B'])
  })

  it('one-sided sweep is all one winner', () => {
    const p = projectGamesWon(1200, 1200, 4, 0)
    expect(p.steps.map((s) => s.winner)).toEqual(['A', 'A', 'A', 'A'])
  })

  it('net matches threading the same sequence through applyGames', () => {
    const p = projectGamesWon(1300, 1100, 3, 2)
    const scores = p.steps.map((s) => (s.winner === 'A' ? [1, 0] : [0, 1]) as [number, number])
    const viaGames = applyGames(1300, 1100, scores)
    expect(p.eloAAfter).toBe(viaGames.eloA)
    expect(p.eloBAfter).toBe(viaGames.eloB)
  })

  it('first step threads from the starting ratings', () => {
    const p = projectGamesWon(1250, 1180, 2, 3)
    const first = applyMatch(1250, 1180, p.steps[0].winner)
    expect(p.steps[0].game).toBe(1)
    expect(p.steps[0].eloA).toBe(first.eloA)
    expect(p.steps[0].eloB).toBe(first.eloB)
  })
})

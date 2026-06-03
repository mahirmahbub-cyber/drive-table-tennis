import { describe, it, expect } from 'vitest'
import { applyMatch, applyGames } from './elo'

describe('applyGames', () => {
  it('matches applyMatch for a single decisive game', () => {
    const single = applyMatch(1200, 1200, 'A')
    const games = applyGames(1200, 1200, [[11, 7]])
    expect(games.eloA).toBe(single.eloA)
    expect(games.eloB).toBe(single.eloB)
  })

  it('threads rating through games in order (2-1 to A)', () => {
    let a = 1200, b = 1200
    for (const w of ['A', 'B', 'A'] as const) {
      const r = applyMatch(a, b, w); a = r.eloA; b = r.eloB
    }
    const res = applyGames(1200, 1200, [[11, 9], [8, 11], [11, 6]])
    expect(res.eloA).toBe(a)
    expect(res.eloB).toBe(b)
    expect(res.deltaA).toBe(a - 1200)
  })

  it('skips games with an equal score (no result)', () => {
    const res = applyGames(1200, 1200, [[11, 11]])
    expect(res.eloA).toBe(1200)
    expect(res.eloB).toBe(1200)
    expect(res.deltaA).toBe(0)
  })

  it('a 1-1 tie still moves both ratings (per-game), nets symmetric at equal elo', () => {
    const res = applyGames(1200, 1200, [[11, 9], [9, 11]])
    expect(res.deltaA).toBe(-res.deltaB)
  })
})

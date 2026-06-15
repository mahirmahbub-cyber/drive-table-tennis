import { describe, it, expect } from 'vitest'
import { mulberry32, computeGameCount, GAME_MINUTES, opponentWeights, pickOpponent, buildMatchups } from './seeder'
import type { PlayerRef, Matchup, SeederConfig } from './seeder'

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(123)
    const b = mulberry32(123)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })
  it('produces values in [0, 1)', () => {
    const r = mulberry32(7)
    for (let i = 0; i < 50; i++) {
      const v = r()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('computeGameCount', () => {
  it('uses the time budget when it exceeds the everyone-once minimum', () => {
    // 30 min / 5 (target 11) = 6 budget games; 4 players => min 2 => 6
    expect(computeGameCount(4, { target: 11, minutes: 30 })).toBe(6)
  })
  it('overrides the budget to guarantee everyone plays once', () => {
    // 5 min / 5 = 1 budget game; 7 players => min ceil(7/2)=4 => 4
    expect(computeGameCount(7, { target: 11, minutes: 5 })).toBe(4)
  })
  it('reflects the per-target game minutes', () => {
    expect(GAME_MINUTES).toEqual({ 7: 3, 11: 5, 21: 12 })
    // 24 min / 12 (target 21) = 2 budget; 2 players => min 1 => 2
    expect(computeGameCount(2, { target: 21, minutes: 24 })).toBe(2)
  })
})

const P = (id: string, elo: number): PlayerRef => ({ id, name: id, elo })

describe('opponentWeights', () => {
  const cands = [P('close', 1210), P('mid', 1400), P('far', 1800)]
  it('competitive weighting favours the closest ELO', () => {
    const w = opponentWeights(1200, cands, false)
    expect(w[0]).toBeGreaterThan(w[1])
    expect(w[1]).toBeGreaterThan(w[2])
  })
  it('upset weighting favours the farthest ELO', () => {
    const w = opponentWeights(1200, cands, true)
    expect(w[2]).toBeGreaterThan(w[1])
    expect(w[1]).toBeGreaterThan(w[0])
  })
  it('returns one weight per candidate, all positive', () => {
    const w = opponentWeights(1200, cands, false)
    expect(w).toHaveLength(3)
    expect(w.every((x) => x > 0)).toBe(true)
  })
})

describe('pickOpponent', () => {
  const cands = [P('close', 1210), P('mid', 1400), P('far', 1800)]
  it('returns one of the candidates', () => {
    const rng = mulberry32(1)
    const chosen = pickOpponent({ pickedElo: 1200, candidates: cands, upset: false, rng })
    expect(cands.map((c) => c.id)).toContain(chosen.id)
  })
  it('is deterministic for a fixed seed', () => {
    const a = pickOpponent({ pickedElo: 1200, candidates: cands, upset: false, rng: mulberry32(42) })
    const b = pickOpponent({ pickedElo: 1200, candidates: cands, upset: false, rng: mulberry32(42) })
    expect(a.id).toBe(b.id)
  })
  it('competitive picks lean toward close over many seeds', () => {
    let closeWins = 0
    for (let s = 0; s < 200; s++) {
      const c = pickOpponent({ pickedElo: 1200, candidates: cands, upset: false, rng: mulberry32(s) })
      if (c.id === 'close') closeWins++
    }
    expect(closeWins).toBeGreaterThan(200 / 3) // beats uniform share
  })
})

const roster = (n: number): PlayerRef[] =>
  Array.from({ length: n }, (_, i) => P(`p${i}`, 1100 + i * 50))
const cfg = (over: Partial<SeederConfig> = {}): SeederConfig => ({
  target: 11, minutes: 30, mix: 0.2, seed: 1, ...over,
})
const counts = (players: PlayerRef[], q: Matchup[]) => {
  const m = new Map(players.map((p) => [p.id, 0]))
  for (const x of q) { m.set(x.aId, (m.get(x.aId) ?? 0) + 1); m.set(x.bId, (m.get(x.bId) ?? 0) + 1) }
  return m
}

describe('buildMatchups', () => {
  it('emits exactly `count` matchups', () => {
    const q = buildMatchups({ players: roster(5), config: cfg(), history: [], count: 6 })
    expect(q).toHaveLength(6)
    expect(q.every((m) => m.status === 'pending')).toBe(true)
  })

  it('returns [] when fewer than 2 players', () => {
    expect(buildMatchups({ players: roster(1), config: cfg(), count: 4 })).toEqual([])
  })

  it('never pairs a player with themselves', () => {
    const q = buildMatchups({ players: roster(6), config: cfg(), count: 12 })
    expect(q.every((m) => m.aId !== m.bId)).toBe(true)
  })

  it('keeps game counts within ±1 for even and odd rosters', () => {
    for (const n of [3, 4, 5, 7]) {
      const players = roster(n)
      const count = computeGameCount(n, { target: 11, minutes: 60 })
      const q = buildMatchups({ players, config: cfg(), count })
      const vals = [...counts(players, q).values()]
      expect(Math.max(...vals) - Math.min(...vals)).toBeLessThanOrEqual(1)
    }
  })

  it('guarantees everyone plays at least once (incl. odd rosters)', () => {
    for (const n of [3, 5, 7]) {
      const players = roster(n)
      const count = computeGameCount(n, { target: 11, minutes: 1 }) // forces the min
      const q = buildMatchups({ players, config: cfg(), count })
      for (const v of counts(players, q).values()) expect(v).toBeGreaterThanOrEqual(1)
    }
  })

  it('avoids back-to-back appearances when the roster allows', () => {
    const q = buildMatchups({ players: roster(5), config: cfg(), count: 10 })
    for (let i = 1; i < q.length; i++) {
      const prev = new Set([q[i - 1].aId, q[i - 1].bId])
      expect(prev.has(q[i].aId) && prev.has(q[i].bId)).toBe(false) // not the exact same pair
      expect(prev.has(q[i].aId) || prev.has(q[i].bId)).toBe(false) // no shared player back-to-back
    }
  })

  it('is deterministic for identical inputs', () => {
    const a = buildMatchups({ players: roster(6), config: cfg(), count: 8 })
    const b = buildMatchups({ players: roster(6), config: cfg(), count: 8 })
    expect(a.map((m) => [m.aId, m.bId])).toEqual(b.map((m) => [m.aId, m.bId]))
  })

  it('seeds fairness from history and continues counts', () => {
    const players = roster(4)
    const history: Matchup[] = [
      { id: 'h0', aId: 'p0', bId: 'p1', status: 'done' },
      { id: 'h1', aId: 'p0', bId: 'p2', status: 'done' },
    ]
    const q = buildMatchups({ players, config: cfg(), history, count: 2 })
    const all = counts(players, [...history, ...q])
    expect(Math.max(...all.values()) - Math.min(...all.values())).toBeLessThanOrEqual(1)
    expect(q.every((m) => m.id !== 'h0' && m.id !== 'h1')).toBe(true)
  })
})

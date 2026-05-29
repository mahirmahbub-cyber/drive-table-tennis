import { describe, it, expect } from 'vitest'
import { replayHistory, type HistoryMatch } from '@/lib/elo-recompute'
import { STARTING_ELO } from '@/lib/elo'

const m = (a: string, b: string, w: 'A' | 'B'): HistoryMatch => ({
  id: `${a}-${b}-${w}`,
  playerAId: a,
  playerBId: b,
  winner: w,
})

describe('replayHistory', () => {
  it('returns starting ELO for players with no matches', () => {
    const result = replayHistory([], ['p1', 'p2'])
    expect(result.currentElo.get('p1')).toBe(STARTING_ELO)
    expect(result.currentElo.get('p2')).toBe(STARTING_ELO)
    expect(result.replayed).toEqual([])
  })

  it('replays a single match and reports before/after for both players', () => {
    const result = replayHistory([m('p1', 'p2', 'A')], ['p1', 'p2'])
    expect(result.replayed[0].eloABefore).toBe(1200)
    expect(result.replayed[0].eloBBefore).toBe(1200)
    expect(result.replayed[0].eloAAfter).toBe(1216)
    expect(result.replayed[0].eloBAfter).toBe(1184)
    expect(result.currentElo.get('p1')).toBe(1216)
    expect(result.currentElo.get('p2')).toBe(1184)
  })

  it('replays sequential matches with running ratings', () => {
    const history = [
      m('p1', 'p2', 'A'),
      m('p1', 'p2', 'A'),
      m('p1', 'p2', 'B'),
    ]
    const result = replayHistory(history, ['p1', 'p2'])
    expect(result.replayed[1].eloABefore).toBe(1216)
    expect(result.replayed[2].eloABefore).toBe(result.replayed[1].eloAAfter)
  })

  it('deletion equivalence: replay without match X equals "match X never happened"', () => {
    const all = [m('p1', 'p2', 'A'), m('p1', 'p2', 'A'), m('p2', 'p1', 'A')]
    const without = [all[0], all[2]]
    const a = replayHistory(without, ['p1', 'p2'])
    const b = replayHistory(without, ['p1', 'p2'])
    expect(a.currentElo.get('p1')).toBe(b.currentElo.get('p1'))
  })
})

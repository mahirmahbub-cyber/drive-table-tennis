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

  it('deletion equivalence: removing a middle match preserves earlier match ELOs and changes the final', () => {
    const A = m('p1', 'p2', 'A')
    const B = m('p1', 'p2', 'B')
    const C = m('p1', 'p2', 'A')

    const all = replayHistory([A, B, C], ['p1', 'p2'])
    const withoutB = replayHistory([A, C], ['p1', 'p2'])

    // Match A is first in both replays — its before/after ELOs must match.
    expect(withoutB.replayed[0].eloAAfter).toBe(all.replayed[0].eloAAfter)
    expect(withoutB.replayed[0].eloBAfter).toBe(all.replayed[0].eloBAfter)

    // Removing B should change the final ELO (proving B was contributing).
    expect(withoutB.currentElo.get('p1')).not.toBe(all.currentElo.get('p1'))
  })
})

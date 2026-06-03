import { describe, it, expect } from 'vitest'
import { replayHistory, type HistoryMatch } from '@/lib/elo-recompute'
import { STARTING_ELO, applyGames } from '@/lib/elo'

// A single decisive game to side w.
const m = (a: string, b: string, w: 'A' | 'B'): HistoryMatch => ({
  id: `${a}-${b}-${w}`,
  playerAId: a,
  playerBId: b,
  games: w === 'A' ? [[11, 5]] : [[5, 11]],
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
    const history = [m('p1', 'p2', 'A'), m('p1', 'p2', 'A'), m('p1', 'p2', 'B')]
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
    expect(withoutB.replayed[0].eloAAfter).toBe(all.replayed[0].eloAAfter)
    expect(withoutB.replayed[0].eloBAfter).toBe(all.replayed[0].eloBAfter)
    expect(withoutB.currentElo.get('p1')).not.toBe(all.currentElo.get('p1'))
  })

  it('replays a multi-game match using applyGames', () => {
    const expected = applyGames(1200, 1200, [[11, 9], [8, 11], [11, 6]])
    const { currentElo } = replayHistory(
      [{ id: 'm1', playerAId: 'a', playerBId: 'b', games: [[11, 9], [8, 11], [11, 6]] }],
      ['a', 'b']
    )
    expect(currentElo.get('a')).toBe(expected.eloA)
    expect(currentElo.get('b')).toBe(expected.eloB)
  })

  it('a match with no games leaves ratings unchanged (bye)', () => {
    const { currentElo } = replayHistory([{ id: 'm1', playerAId: 'a', playerBId: 'b', games: [] }], ['a', 'b'])
    expect(currentElo.get('a')).toBe(1200)
    expect(currentElo.get('b')).toBe(1200)
  })
})

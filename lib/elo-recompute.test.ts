import { describe, it, expect } from 'vitest'
import { replayHistory } from './elo-recompute'
import { applyGames } from './elo'

describe('replayHistory (per-game)', () => {
  it('replays a multi-game match using applyGames', () => {
    const expected = applyGames(1200, 1200, [[11, 9], [8, 11], [11, 6]])
    const { currentElo, replayed } = replayHistory(
      [{ id: 'm1', playerAId: 'a', playerBId: 'b', games: [[11, 9], [8, 11], [11, 6]] }],
      ['a', 'b']
    )
    expect(currentElo.get('a')).toBe(expected.eloA)
    expect(currentElo.get('b')).toBe(expected.eloB)
    expect(replayed[0].eloABefore).toBe(1200)
    expect(replayed[0].eloAAfter).toBe(expected.eloA)
  })

  it('a match with no games leaves ratings unchanged (bye)', () => {
    const { currentElo } = replayHistory(
      [{ id: 'm1', playerAId: 'a', playerBId: 'b', games: [] }],
      ['a', 'b']
    )
    expect(currentElo.get('a')).toBe(1200)
    expect(currentElo.get('b')).toBe(1200)
  })
})

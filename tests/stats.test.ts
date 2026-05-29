import { describe, it, expect } from 'vitest'
import {
  computeFormScore,
  computeAboveExpectationScore,
  classifyOpponentTier,
  type ScoredMatch,
} from '@/lib/stats'

const sm = (
  player: string,
  opponent: string,
  myEloBefore: number,
  oppEloBefore: number,
  iWon: boolean,
  daysAgo: number
): ScoredMatch => ({
  playerId: player,
  opponentId: opponent,
  myEloBefore,
  myEloAfter: myEloBefore + (iWon ? 16 : -16),
  opponentEloBefore: oppEloBefore,
  iWon,
  playedAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
})

describe('classifyOpponentTier', () => {
  it('opponent more than +100 above me → higher', () => {
    expect(classifyOpponentTier(1200, 1305)).toBe('higher')
  })
  it('opponent within ±100 → similar', () => {
    expect(classifyOpponentTier(1200, 1250)).toBe('similar')
    expect(classifyOpponentTier(1200, 1150)).toBe('similar')
  })
  it('opponent more than -100 below me → lower', () => {
    expect(classifyOpponentTier(1200, 1095)).toBe('lower')
  })
})

describe('computeFormScore', () => {
  it('returns null when fewer than 3 matches in window', () => {
    const matches = [
      sm('me', 'x', 1200, 1200, true, 2),
      sm('me', 'x', 1216, 1200, true, 1),
    ]
    expect(computeFormScore(matches, 1232, 14)).toBeNull()
  })
  it('returns currentElo − earliest in-window eloBefore for qualifying players', () => {
    const matches = [
      sm('me', 'x', 1200, 1200, true, 5),
      sm('me', 'x', 1216, 1200, true, 4),
      sm('me', 'x', 1232, 1200, true, 3),
    ]
    expect(computeFormScore(matches, 1248, 14)).toBe(1248 - 1200)
  })
  it('ignores matches outside the window', () => {
    const matches = [
      sm('me', 'x', 1100, 1200, true, 30),
      sm('me', 'x', 1116, 1200, true, 5),
      sm('me', 'x', 1132, 1200, true, 4),
      sm('me', 'x', 1148, 1200, true, 3),
    ]
    expect(computeFormScore(matches, 1164, 14)).toBe(1164 - 1116)
  })
})

describe('computeAboveExpectationScore', () => {
  it('beating an equal-rated opponent gives +0.5 above expectation', () => {
    const m = [sm('me', 'x', 1200, 1200, true, 1)]
    expect(computeAboveExpectationScore(m, 14)).toBeCloseTo(0.5, 5)
  })
  it('beating a much-stronger opponent yields close to +1', () => {
    const m = [sm('me', 'x', 1000, 1400, true, 1)]
    expect(computeAboveExpectationScore(m, 14)).toBeGreaterThan(0.85)
  })
  it('losing to an equal-rated opponent gives -0.5', () => {
    const m = [sm('me', 'x', 1200, 1200, false, 1)]
    expect(computeAboveExpectationScore(m, 14)).toBeCloseTo(-0.5, 5)
  })
})

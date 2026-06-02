import { describe, it, expect } from 'vitest'
import {
  inferWinnerSide,
  setsWon,
  formatScoreForPlayer,
  playerEloDelta,
  isSingleSet,
  type SetScore,
} from '@/lib/match-format'

describe('inferWinnerSide', () => {
  it('single set, A ahead → A', () => {
    expect(inferWinnerSide([[11, 7]])).toBe('A')
  })
  it('single set, B ahead → B', () => {
    expect(inferWinnerSide([[7, 11]])).toBe('B')
  })
  it('best-of-3, A takes 2 → A', () => {
    expect(inferWinnerSide([[11, 8], [9, 11], [11, 6]])).toBe('A')
  })
  it('tied set count → null', () => {
    expect(inferWinnerSide([[11, 8], [9, 11]])).toBe(null)
  })
  it('single tied set → null', () => {
    expect(inferWinnerSide([[11, 11]])).toBe(null)
  })
  it('empty → null', () => {
    expect(inferWinnerSide([])).toBe(null)
  })
})

describe('setsWon', () => {
  it('counts sets each side won, ignoring tied sets', () => {
    expect(setsWon([[11, 8], [9, 11], [11, 6]])).toEqual({ a: 2, b: 1 })
    expect(setsWon([[11, 11]])).toEqual({ a: 0, b: 0 })
  })
})

describe('isSingleSet', () => {
  it('true for exactly one set', () => {
    expect(isSingleSet([[11, 7]])).toBe(true)
    expect(isSingleSet([[11, 7], [5, 11]])).toBe(false)
    expect(isSingleSet([])).toBe(false)
  })
})

describe('formatScoreForPlayer', () => {
  it('single set, player is A → player points first', () => {
    expect(formatScoreForPlayer([[11, 7]], true)).toBe('11–7')
  })
  it('single set, player is B → player points first', () => {
    expect(formatScoreForPlayer([[11, 7]], false)).toBe('7–11')
  })
  it('multi set, player is A → player sets-won first', () => {
    expect(formatScoreForPlayer([[11, 8], [9, 11], [11, 6]], true)).toBe('2–1')
  })
  it('multi set, player is B → player sets-won first', () => {
    expect(formatScoreForPlayer([[11, 8], [9, 11], [11, 6]], false)).toBe('1–2')
  })
})

describe('playerEloDelta', () => {
  const base = { eloABefore: 1200, eloAAfter: 1216, eloBBefore: 1300, eloBAfter: 1284 }
  it('player A delta', () => {
    expect(playerEloDelta(base, true)).toBe(16)
  })
  it('player B delta', () => {
    expect(playerEloDelta(base, false)).toBe(-16)
  })
  it('null before/after → null', () => {
    expect(playerEloDelta({ eloABefore: null, eloAAfter: null, eloBBefore: null, eloBAfter: null }, true)).toBe(null)
  })
})

import { inferWinnerSide as sharedInfer } from '@/lib/match-format'

describe('shared winner rule is the single source of truth', () => {
  it('matches expected winners across representative cases', () => {
    expect(sharedInfer([[11, 9], [8, 11], [11, 5]])).toBe('A')
    expect(sharedInfer([[5, 11], [11, 7], [9, 11]])).toBe('B')
    expect(sharedInfer([[11, 9], [9, 11]])).toBe(null) // 1-1 tie blocks save
    expect(sharedInfer([[11, 9]])).toBe('A')           // single set
  })
})

import { describe, it, expect } from 'vitest'
import {
  currentAsGame, allGames, tally, matchWinner,
  gameWonBy, gamePoint, canBank, canAddGame, splitForEdit,
  MAX_GAMES,
} from '@/lib/flip-pad'

describe('currentAsGame', () => {
  it('both filled, not tied → the pair', () => {
    expect(currentAsGame([11, 9])).toEqual([11, 9])
  })
  it('an empty card → null', () => {
    expect(currentAsGame([11, null])).toBeNull()
    expect(currentAsGame([null, null])).toBeNull()
  })
  it('a tie → null (a game cannot end level)', () => {
    expect(currentAsGame([10, 10])).toBeNull()
  })
})

describe('allGames', () => {
  it('appends the current game when complete', () => {
    expect(allGames([[11, 7]], [9, 11])).toEqual([[11, 7], [9, 11]])
  })
  it('omits an incomplete current game', () => {
    expect(allGames([[11, 7]], [5, null])).toEqual([[11, 7]])
  })
})

describe('tally / matchWinner', () => {
  it('counts games won across banked + current', () => {
    expect(tally([[11, 7], [8, 11]], [11, 9])).toEqual({ a: 2, b: 1 })
  })
  it('winner is whoever leads on games; level → null', () => {
    expect(matchWinner([[11, 7]], [9, 11])).toBeNull()
    expect(matchWinner([[11, 7], [11, 5]], [null, null])).toBe('A')
  })
  it('empty → null winner, 0–0 tally', () => {
    expect(matchWinner([], [null, null])).toBeNull()
    expect(tally([], [null, null])).toEqual({ a: 0, b: 0 })
  })
})

describe('gameWonBy (default 11, win by 2)', () => {
  it('11–9 → A', () => expect(gameWonBy([11, 9])).toBe('A'))
  it('9–11 → B', () => expect(gameWonBy([9, 11])).toBe('B'))
  it('11–10 → null (deuce continues)', () => expect(gameWonBy([11, 10])).toBeNull())
  it('13–11 → A', () => expect(gameWonBy([13, 11])).toBe('A'))
  it('respects a custom target', () => expect(gameWonBy([21, 19], 21)).toBe('A'))
})

describe('gamePoint', () => {
  it('10–9 → A on game point', () => expect(gamePoint([10, 9])).toEqual({ a: true, b: false }))
  it('9–10 → B on game point', () => expect(gamePoint([9, 10])).toEqual({ a: false, b: true }))
  it('10–10 → neither (deuce)', () => expect(gamePoint([10, 10])).toEqual({ a: false, b: false }))
  it('11–10 → A on game point', () => expect(gamePoint([11, 10])).toEqual({ a: true, b: false }))
  it('empty cards → neither', () => expect(gamePoint([null, null])).toEqual({ a: false, b: false }))
})

describe('canBank / canAddGame', () => {
  it('bankable only when both filled and not tied', () => {
    expect(canBank([11, 9])).toBe(true)
    expect(canBank([5, null])).toBe(false)
    expect(canBank([7, 7])).toBe(false)
  })
  it('can add a game until one short of the cap', () => {
    expect(canAddGame([])).toBe(true)
    expect(canAddGame(new Array(MAX_GAMES - 2).fill([11, 0]))).toBe(true)
    expect(canAddGame(new Array(MAX_GAMES - 1).fill([11, 0]))).toBe(false)
  })
})

describe('splitForEdit', () => {
  it('single game → live on the pad, nothing banked', () => {
    expect(splitForEdit([[11, 9]])).toEqual({ banked: [], current: [11, 9] })
  })
  it('multi game → last is live, rest banked', () => {
    expect(splitForEdit([[11, 9], [9, 11], [11, 7]]))
      .toEqual({ banked: [[11, 9], [9, 11]], current: [11, 7] })
  })
  it('empty → blank pad', () => {
    expect(splitForEdit([])).toEqual({ banked: [], current: [null, null] })
  })
})

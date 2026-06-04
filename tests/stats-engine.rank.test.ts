import { describe, it, expect } from 'vitest'
import { rankWithin } from '@/lib/stats-engine'

describe('rankWithin', () => {
  it('competition rank = count strictly greater + 1', () => {
    const elos = [1300, 1200, 1200, 1100]
    expect(rankWithin(elos, 1300)).toBe(1)
    expect(rankWithin(elos, 1200)).toBe(2)
    expect(rankWithin(elos, 1100)).toBe(4)
  })
  it('a value above everyone ranks 1', () => {
    expect(rankWithin([1000, 1050], 1400)).toBe(1)
  })
  it('empty pool ranks 1', () => {
    expect(rankWithin([], 1200)).toBe(1)
  })
})

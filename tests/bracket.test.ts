import { describe, it, expect } from 'vitest'
import { generateBracket } from '@/lib/bracket'

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`)

describe('generateBracket', () => {
  it('produces N-1 real (non-bye) matches for N=4', () => {
    const rows = generateBracket(ids(4))
    const realMatches = rows.filter((r) => !r.winnerId)
    expect(realMatches.length).toBe(3)
  })

  it('N=4 round-1 pairings are (1,4) and (2,3)', () => {
    const rows = generateBracket(ids(4))
    const r1 = rows.filter((r) => r.round === 1).sort((a, b) => a.slot - b.slot)
    expect(r1).toHaveLength(2)
    expect([r1[0].playerAId, r1[0].playerBId].sort()).toEqual(['p1', 'p4'])
    expect([r1[1].playerAId, r1[1].playerBId].sort()).toEqual(['p2', 'p3'])
  })

  it('N=8 round-1 pairings keep #1 and #2 in opposite halves', () => {
    const rows = generateBracket(ids(8))
    const r1 = rows.filter((r) => r.round === 1).sort((a, b) => a.slot - b.slot)
    expect(r1).toHaveLength(4)
    const halfWith1 = r1.findIndex(
      (r) => r.playerAId === 'p1' || r.playerBId === 'p1'
    )
    const halfWith2 = r1.findIndex(
      (r) => r.playerAId === 'p2' || r.playerBId === 'p2'
    )
    expect(halfWith1 < 2).not.toBe(halfWith2 < 2)
  })

  it('N=6 (non-power-of-2): top 2 seeds get byes in round 1', () => {
    const rows = generateBracket(ids(6))
    const r1 = rows.filter((r) => r.round === 1)
    const byes = r1.filter((r) => r.winnerId !== null)
    expect(byes).toHaveLength(2)
    const byeWinners = byes.map((b) => b.winnerId).sort()
    expect(byeWinners).toEqual(['p1', 'p2'])
  })

  it('produces ceil(log2(N)) rounds', () => {
    expect(new Set(generateBracket(ids(4)).map((r) => r.round)).size).toBe(2)
    expect(new Set(generateBracket(ids(8)).map((r) => r.round)).size).toBe(3)
    expect(new Set(generateBracket(ids(12)).map((r) => r.round)).size).toBe(4)
    expect(new Set(generateBracket(ids(16)).map((r) => r.round)).size).toBe(4)
  })

  it('later rounds have null player slots (to be filled as winners advance)', () => {
    const rows = generateBracket(ids(4))
    const final = rows.find((r) => r.round === 2)!
    expect(final.playerAId).toBeNull()
    expect(final.playerBId).toBeNull()
    expect(final.winnerId).toBeNull()
  })
})

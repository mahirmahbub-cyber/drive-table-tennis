import { describe, it, expect } from 'vitest'
import { titlesForPlayer, topTitle, type TitleInput } from '@/lib/titles'

const base: TitleInput = {
  rank: 6, totalPlayers: 12, games: 5, currentStreak: 0, weeklyDelta: 0, giantKills: 0, currentElo: 1200, peakElo: 1200,
}

describe('titlesForPlayer', () => {
  it('rank 1 → Gigachad (top)', () => {
    expect(topTitle({ ...base, rank: 1 })?.key).toBe('gigachad')
  })
  it('3+ giant kills → Mogger', () => {
    expect(topTitle({ ...base, giantKills: 3 })?.key).toBe('mogger')
  })
  it('win streak >= 3 → Locked In', () => {
    expect(topTitle({ ...base, currentStreak: 4 })?.key).toBe('lockedIn')
  })
  it('weekly delta <= -30 → Washed (beats down-bad)', () => {
    expect(topTitle({ ...base, weeklyDelta: -40, currentStreak: -3 })?.key).toBe('washed')
  })
  it('loss streak <= -3 → Down Bad', () => {
    expect(topTitle({ ...base, currentStreak: -3 })?.key).toBe('downBad')
  })
  it('last place → Jester', () => {
    expect(topTitle({ ...base, rank: 12, totalPlayers: 12 })?.key).toBe('jester')
  })
  it('middle third → Mid', () => {
    expect(topTitle({ ...base, rank: 6, totalPlayers: 12 })?.key).toBe('mid')
  })
  it('no games → no titles', () => {
    expect(titlesForPlayer({ ...base, games: 0 })).toEqual([])
  })
})

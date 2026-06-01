import { describe, it, expect } from 'vitest'
import {
  formatDuration,
  parseDurationInput,
  averageDurationForPlayer,
  computeDurationRecords,
  type DurationMatch,
} from './stats'

const m = (over: Partial<DurationMatch>): DurationMatch => ({
  id: 'm', playerAId: 'a', playerBId: 'b', winnerId: 'a',
  durationSeconds: 600, playedAt: new Date('2026-01-01'), ...over,
})

describe('formatDuration', () => {
  it('formats mm:ss with zero-padded seconds', () => {
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(65)).toBe('1:05')
    expect(formatDuration(600)).toBe('10:00')
  })
})

describe('parseDurationInput', () => {
  it('parses mm:ss', () => { expect(parseDurationInput('10:30')).toBe(630) })
  it('parses plain seconds', () => { expect(parseDurationInput('90')).toBe(90) })
  it('returns null for empty', () => { expect(parseDurationInput('')).toBeNull() })
  it('rejects bad seconds field', () => { expect(parseDurationInput('1:75')).toBeNull() })
  it('rejects non-numeric', () => { expect(parseDurationInput('abc')).toBeNull() })
})

describe('averageDurationForPlayer', () => {
  it('averages only the player\'s timed matches, rounded', () => {
    const matches = [
      m({ playerAId: 'a', durationSeconds: 600 }),
      m({ playerBId: 'a', playerAId: 'x', durationSeconds: 700 }),
      m({ playerAId: 'y', playerBId: 'z', durationSeconds: 999 }),
      m({ playerAId: 'a', durationSeconds: 0 }),
    ]
    expect(averageDurationForPlayer(matches, 'a')).toBe(650)
  })
  it('returns null when player has no timed matches', () => {
    expect(averageDurationForPlayer([m({ playerAId: 'a', durationSeconds: 0 })], 'a')).toBeNull()
  })
})

describe('computeDurationRecords', () => {
  it('finds longest, fastest, and total over timed matches', () => {
    const matches = [
      m({ id: '1', durationSeconds: 300 }),
      m({ id: '2', durationSeconds: 1200 }),
      m({ id: '3', durationSeconds: 0 }),
    ]
    const r = computeDurationRecords(matches)
    expect(r.longestMatch?.id).toBe('2')
    expect(r.fastestWin?.id).toBe('1')
    expect(r.totalCourtTimeSeconds).toBe(1500)
  })
  it('returns nulls and zero total when no timed matches', () => {
    const r = computeDurationRecords([m({ durationSeconds: 0 })])
    expect(r.longestMatch).toBeNull()
    expect(r.fastestWin).toBeNull()
    expect(r.totalCourtTimeSeconds).toBe(0)
  })
})

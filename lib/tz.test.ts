import { describe, it, expect } from 'vitest'
import { wallClockToInstant, instantToWallClock, hasExplicitZone, formatInZone, VENUE_TZ } from './tz'

describe('wallClockToInstant (Australia/Sydney)', () => {
  it('AEST winter (+10): 12:19 Sydney → 02:19 UTC', () => {
    expect(wallClockToInstant('2026-06-18T12:19').toISOString()).toBe('2026-06-18T02:19:00.000Z')
  })
  it('AEDT summer (+11): 12:00 Sydney → 01:00 UTC', () => {
    expect(wallClockToInstant('2026-01-15T12:00').toISOString()).toBe('2026-01-15T01:00:00.000Z')
  })
  it('accepts seconds', () => {
    expect(wallClockToInstant('2026-06-18T23:59:59').toISOString()).toBe('2026-06-18T13:59:59.000Z')
  })
  it('DST spring-forward boundary: 01:30 (pre-jump, AEST) → 15:30 UTC prior day', () => {
    expect(wallClockToInstant('2026-10-04T01:30').toISOString()).toBe('2026-10-03T15:30:00.000Z')
  })
})

describe('instantToWallClock (Australia/Sydney)', () => {
  it('AEST winter: 02:19 UTC → 12:19', () => {
    expect(instantToWallClock(new Date('2026-06-18T02:19:00Z'))).toBe('2026-06-18T12:19')
  })
  it('AEDT summer: 01:00 UTC → 12:00', () => {
    expect(instantToWallClock(new Date('2026-01-15T01:00:00Z'))).toBe('2026-01-15T12:00')
  })
  it('Sydney midnight renders 00:00, not 24:00', () => {
    // 2026-06-17T14:00Z = 18 Jun 00:00 Sydney (AEST)
    expect(instantToWallClock(new Date('2026-06-17T14:00:00Z'))).toBe('2026-06-18T00:00')
  })
})

describe('round-trip', () => {
  it('stable in winter', () => {
    expect(instantToWallClock(wallClockToInstant('2026-06-18T12:19'))).toBe('2026-06-18T12:19')
  })
  it('stable in summer', () => {
    expect(instantToWallClock(wallClockToInstant('2026-01-15T08:30'))).toBe('2026-01-15T08:30')
  })
})

describe('hasExplicitZone', () => {
  it('detects Z', () => expect(hasExplicitZone('2026-06-18T02:19:00.000Z')).toBe(true))
  it('detects +10:00', () => expect(hasExplicitZone('2026-06-18T12:19:00+10:00')).toBe(true))
  it('detects +1000', () => expect(hasExplicitZone('2026-06-18T12:19:00+1000')).toBe(true))
  it('false for naive wall-clock', () => expect(hasExplicitZone('2026-06-18T12:19')).toBe(false))
})

describe('formatInZone', () => {
  // 2026-06-17T14:00Z = 17 Jun in UTC but already 18 Jun in Sydney (AEST).
  const d = new Date('2026-06-17T14:00:00Z')
  it('renders in the venue zone, not UTC', () => {
    expect(formatInZone(d, { day: 'numeric' })).toBe('18')
  })
  it('ignores a timeZone passed via opts (zone is not overridable)', () => {
    expect(formatInZone(d, { day: 'numeric', timeZone: 'UTC' })).toBe('18')
  })
  it('honours an explicit tz argument', () => {
    expect(formatInZone(d, { day: 'numeric' }, 'UTC')).toBe('17')
  })
})

describe('VENUE_TZ', () => {
  it('is Sydney', () => expect(VENUE_TZ).toBe('Australia/Sydney'))
})

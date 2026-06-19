import { describe, it, expect } from 'vitest'
import { yesterdayRange, lastWeekRange, formatSydneyDay, formatSydneyWeekRange } from './windows'

describe('yesterdayRange (Australia/Sydney)', () => {
  it('AEST winter: Sydney midnight is 14:00 UTC the prior day', () => {
    // 2026-06-18T05:00Z = 18 Jun 15:00 Sydney (AEST, UTC+10) → yesterday = 17 Jun
    const r = yesterdayRange(new Date('2026-06-18T05:00:00Z'))
    expect(r.start.toISOString()).toBe('2026-06-16T14:00:00.000Z')
    expect(r.end.toISOString()).toBe('2026-06-17T14:00:00.000Z')
  })
  it('AEDT summer: Sydney midnight is 13:00 UTC the prior day', () => {
    // 2026-01-15T02:00Z = 15 Jan 13:00 Sydney (AEDT, UTC+11) → yesterday = 14 Jan
    const r = yesterdayRange(new Date('2026-01-15T02:00:00Z'))
    expect(r.start.toISOString()).toBe('2026-01-13T13:00:00.000Z')
    expect(r.end.toISOString()).toBe('2026-01-14T13:00:00.000Z')
  })
})

describe('lastWeekRange (Australia/Sydney)', () => {
  it('on a Monday, returns the previous Mon→Mon week', () => {
    // 2026-06-15 is a Monday; 11:00 Sydney
    const r = lastWeekRange(new Date('2026-06-15T01:00:00Z'))
    expect(r.start.toISOString()).toBe('2026-06-07T14:00:00.000Z') // Mon 8 Jun 00:00 Sydney
    expect(r.end.toISOString()).toBe('2026-06-14T14:00:00.000Z')   // Mon 15 Jun 00:00 Sydney
  })
})

describe('formatting', () => {
  it('formats a single Sydney day', () => {
    expect(formatSydneyDay(new Date('2026-06-17T20:00:00Z'))).toBe('Thu 18 Jun') // 18 Jun 06:00 Sydney
  })
  it('formats a same-month week range', () => {
    const r = lastWeekRange(new Date('2026-06-15T01:00:00Z'))
    expect(formatSydneyWeekRange(r.start, r.end)).toBe('8–14 Jun')
  })
})

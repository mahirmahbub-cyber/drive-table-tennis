import { describe, it, expect } from 'vitest'
import { matchLogSchema } from './validators'

const base = {
  playerAId: '11111111-1111-4111-8111-111111111111',
  playerBId: '22222222-2222-4222-8222-222222222222',
  sets: [[11, 7]],
}

describe('matchLogSchema duration + playedAt', () => {
  it('accepts optional durationSeconds and playedAt', () => {
    const r = matchLogSchema.safeParse({ ...base, durationSeconds: '630', playedAt: '2026-05-01T14:30' })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.durationSeconds).toBe(630)
      expect(r.data.playedAt instanceof Date).toBe(true)
    }
  })
  it('treats empty strings as undefined', () => {
    const r = matchLogSchema.safeParse({ ...base, durationSeconds: '', playedAt: '' })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.durationSeconds).toBeUndefined()
      expect(r.data.playedAt).toBeUndefined()
    }
  })
  it('rejects same player on both sides', () => {
    const r = matchLogSchema.safeParse({ ...base, playerBId: base.playerAId })
    expect(r.success).toBe(false)
  })
})

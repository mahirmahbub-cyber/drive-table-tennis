import { describe, it, expect } from 'vitest'
import { giantKills, type EngineMatch } from '@/lib/stats-engine'

const d = (iso: string) => new Date(iso)
function m(p: Partial<EngineMatch> & { id: string }): EngineMatch {
  return {
    id: p.id, playerAId: p.playerAId ?? 'A', playerBId: p.playerBId ?? 'B',
    winnerId: p.winnerId ?? 'A', setScores: p.setScores ?? [[11, 5]],
    durationSeconds: p.durationSeconds ?? 600, playedAt: p.playedAt ?? d('2026-06-01T10:00:00Z'),
    eloABefore: p.eloABefore ?? 1200, eloAAfter: p.eloAAfter ?? 1216,
    eloBBefore: p.eloBBefore ?? 1200, eloBAfter: p.eloBAfter ?? 1184,
  }
}

describe('giantKills', () => {
  it('counts wins over opponents rated >= gap higher (default 100)', () => {
    const ms: EngineMatch[] = [
      m({ id: '1', winnerId: 'A', eloABefore: 1200, eloBBefore: 1350 }),
      m({ id: '2', winnerId: 'A', eloABefore: 1200, eloBBefore: 1250 }),
      m({ id: '3', winnerId: 'B', eloABefore: 1200, eloBBefore: 1400 }),
    ]
    expect(giantKills(ms, 'A')).toBe(1)
    expect(giantKills(ms, 'A', 40)).toBe(2)
  })
})

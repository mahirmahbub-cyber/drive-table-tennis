import { asc, isNotNull } from 'drizzle-orm'
import { db, matches, players } from '@/lib/db'
import type { EngineMatch } from '@/lib/stats-engine'
import type { PlayerLite } from '@/lib/slack/digest'

/** All players (for name resolution) + all decided/played matches as EngineMatch[]. */
export async function loadDigestData(): Promise<{
  engineMatches: EngineMatch[]
  playersById: Map<string, PlayerLite>
}> {
  const playerRows = await db
    .select({ id: players.id, name: players.name, nickname: players.nickname })
    .from(players)
  const playersById = new Map<string, PlayerLite>(
    playerRows.map((p) => [p.id, { name: p.name, nickname: p.nickname }]),
  )

  const raw = await db
    .select()
    .from(matches)
    .where(isNotNull(matches.playedAt))
    .orderBy(asc(matches.playedAt))

  const engineMatches: EngineMatch[] = raw
    .filter((m) => m.playerAId && m.playerBId && m.playedAt && (m.setScores?.length ?? 0) > 0)
    .map((m) => ({
      id: m.id,
      playerAId: m.playerAId!,
      playerBId: m.playerBId!,
      winnerId: m.winnerId,
      setScores: (m.setScores as [number, number][]) ?? [],
      durationSeconds: m.durationSeconds,
      playedAt: m.playedAt!,
      eloABefore: m.eloABefore ?? 1200,
      eloAAfter: m.eloAAfter ?? 1200,
      eloBBefore: m.eloBBefore ?? 1200,
      eloBAfter: m.eloBAfter ?? 1200,
    }))

  return { engineMatches, playersById }
}

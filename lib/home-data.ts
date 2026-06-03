import { db, matches, players } from '@/lib/db'
import { and, asc, eq, isNotNull } from 'drizzle-orm'
import type { EngineMatch } from '@/lib/stats-engine'

export type HomePlayer = { id: string; name: string; nickname: string | null; photoUrl: string | null; currentElo: number }

export async function loadHomeData() {
  const activePlayers = await db
    .select({ id: players.id, name: players.name, nickname: players.nickname, photoUrl: players.photoUrl, currentElo: players.currentElo })
    .from(players)
    .where(eq(players.active, true))
    .orderBy(asc(players.name))

  const rawMatches = await db
    .select()
    .from(matches)
    .where(and(isNotNull(matches.playedAt), isNotNull(matches.winnerId)))
    .orderBy(asc(matches.playedAt))

  const engineMatches: EngineMatch[] = rawMatches
    .filter((m) => m.playerAId && m.playerBId && m.winnerId && m.playedAt)
    .map((m) => ({
      id: m.id,
      playerAId: m.playerAId!,
      playerBId: m.playerBId!,
      winnerId: m.winnerId!,
      setScores: (m.setScores as [number, number][]) ?? [],
      durationSeconds: m.durationSeconds,
      playedAt: m.playedAt!,
      eloABefore: m.eloABefore ?? 1200,
      eloAAfter: m.eloAAfter ?? 1200,
      eloBBefore: m.eloBBefore ?? 1200,
      eloBAfter: m.eloBAfter ?? 1200,
    }))

  const nameById = new Map(activePlayers.map((p) => [p.id, p] as const))
  return { activePlayers, engineMatches, nameById }
}

export type HomeData = Awaited<ReturnType<typeof loadHomeData>>

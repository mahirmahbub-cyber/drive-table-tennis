import { db, matches, players } from '@/lib/db'
import { and, asc, eq, isNotNull } from 'drizzle-orm'
import { playerAggregates, type EngineMatch } from '@/lib/stats-engine'

export type HomePlayer = { id: string; name: string; nickname: string | null; photoUrl: string | null; currentElo: number }
export type PlayerWL = { wins: number; losses: number; games: number }

export async function loadHomeData() {
  const activePlayers = await db
    .select({ id: players.id, name: players.name, nickname: players.nickname, photoUrl: players.photoUrl, currentElo: players.currentElo })
    .from(players)
    .where(eq(players.active, true))
    .orderBy(asc(players.name))

  // Include tied casual sittings (winnerId null) — only require a played_at.
  const rawMatches = await db
    .select()
    .from(matches)
    .where(and(isNotNull(matches.playedAt)))
    .orderBy(asc(matches.playedAt))

  const engineMatches: EngineMatch[] = rawMatches
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

  const nameById = new Map(activePlayers.map((p) => [p.id, p] as const))
  const wlById = new Map<string, PlayerWL>(
    activePlayers.map((p) => {
      const s = playerAggregates(engineMatches, p.id, p.currentElo)
      return [p.id, { wins: s.wins, losses: s.losses, games: s.games }] as const
    })
  )
  return { now: Date.now(), activePlayers, engineMatches, nameById, wlById }
}

export type HomeData = Awaited<ReturnType<typeof loadHomeData>>

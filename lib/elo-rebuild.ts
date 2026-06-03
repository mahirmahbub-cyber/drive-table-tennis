import { asc, eq } from 'drizzle-orm'
import { db, matches, players } from '@/lib/db'
import { replayHistory, type HistoryMatch } from '@/lib/elo-recompute'

/**
 * Replays the entire match history per game and rewrites every match's ELO
 * snapshots and each player's current rating. Safe to run anytime.
 */
export async function rebuildEloFromHistory(): Promise<void> {
  const allMatches = await db
    .select()
    .from(matches)
    .orderBy(asc(matches.playedAt), asc(matches.createdAt))
  const allPlayers = await db.select({ id: players.id }).from(players)

  const history: HistoryMatch[] = allMatches
    .filter((m) => m.playerAId && m.playerBId && m.playedAt && (m.setScores?.length ?? 0) > 0)
    .map((m) => ({
      id: m.id,
      playerAId: m.playerAId!,
      playerBId: m.playerBId!,
      games: m.setScores as Array<[number, number]>,
    }))

  const result = replayHistory(history, allPlayers.map((p) => p.id))

  await db.transaction(async (tx) => {
    for (const r of result.replayed) {
      await tx
        .update(matches)
        .set({
          eloABefore: r.eloABefore,
          eloBBefore: r.eloBBefore,
          eloAAfter: r.eloAAfter,
          eloBAfter: r.eloBAfter,
        })
        .where(eq(matches.id, r.id))
    }
    for (const [playerId, elo] of result.currentElo.entries()) {
      await tx.update(players).set({ currentElo: elo }).where(eq(players.id, playerId))
    }
  })
}

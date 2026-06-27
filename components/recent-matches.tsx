import { db, matches, players } from '@/lib/db'
import { alias } from 'drizzle-orm/pg-core'
import { desc, eq, isNotNull } from 'drizzle-orm'
import { ViewGameButton } from '@/components/view-game-button'
import { MatchScoreline } from '@/components/match-scoreline'

export async function RecentMatches({ limit = 8 }: { limit?: number }) {
  const a = alias(players, 'a')
  const b = alias(players, 'b')
  const rows = await db
    .select({
      id: matches.id,
      playedAt: matches.playedAt,
      aId: a.id,
      aName: a.name,
      bId: b.id,
      bName: b.name,
      winnerId: matches.winnerId,
      setScores: matches.setScores,
    })
    .from(matches)
    .innerJoin(a, eq(matches.playerAId, a.id))
    .innerJoin(b, eq(matches.playerBId, b.id))
    .where(isNotNull(matches.playedAt))
    .orderBy(desc(matches.playedAt))
    .limit(limit)

  return (
    <section>
      <div className="section-header font-display">Recent Results</div>
      <ul className="rounded-lg border border-border overflow-hidden bg-card">
        {rows.map((r) => {
          const sets = (r.setScores as Array<[number, number]>) ?? []
          return (
            <li
              key={r.id}
              className="flex items-center gap-3 border-b border-border px-3 py-1.5 text-sm last:border-0"
            >
              <MatchScoreline
                aId={r.aId}
                aName={r.aName}
                bId={r.bId}
                bName={r.bName}
                winnerId={r.winnerId}
                sets={sets}
              />
              <ViewGameButton id={r.id} />
            </li>
          )
        })}
        {rows.length === 0 && (
          <li className="px-3 py-3 text-sm text-muted-foreground">
            No matches yet.
          </li>
        )}
      </ul>
    </section>
  )
}

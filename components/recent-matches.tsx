import Link from 'next/link'
import { db, matches, players } from '@/lib/db'
import { alias } from 'drizzle-orm/pg-core'
import { desc, eq, isNotNull } from 'drizzle-orm'
import { ViewGameButton } from '@/components/view-game-button'

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
          const aWon = r.winnerId === r.aId
          const bWon = r.winnerId === r.bId
          const sets = (r.setScores as Array<[number, number]>) ?? []
          return (
            <li key={r.id} className="data-row text-sm">
              {/* Winner indicator */}
              <span
                className={`w-1 h-4 rounded-full shrink-0 ${aWon ? 'bg-gain' : 'bg-transparent'}`}
              />
              <Link
                href={`/players/${r.aId}`}
                className={`shrink-0 transition-colors duration-150 ${
                  aWon
                    ? 'font-semibold text-foreground hover:text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {r.aName}
              </Link>

              {/* Scores */}
              {sets.length > 0 ? (
                <span className="flex-1 text-center font-mono nums text-xs text-muted-foreground tracking-tight">
                  {sets.map(([sa, sb]) => `${sa}–${sb}`).join('  ')}
                </span>
              ) : (
                <span className="flex-1" />
              )}

              <Link
                href={`/players/${r.bId}`}
                className={`shrink-0 transition-colors duration-150 ${
                  bWon
                    ? 'font-semibold text-foreground hover:text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {r.bName}
              </Link>
              <span
                className={`w-1 h-4 rounded-full shrink-0 ${bWon ? 'bg-gain' : 'bg-transparent'}`}
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

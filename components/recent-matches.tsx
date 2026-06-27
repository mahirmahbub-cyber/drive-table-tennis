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
          const aFirst = r.aName.split(' ')[0]
          const bFirst = r.bName.split(' ')[0]
          return (
            <li
              key={r.id}
              className="flex items-center gap-3 border-b border-border px-3 py-1.5 text-sm last:border-0"
            >
              {/* Matchup + scores scroll horizontally when they overflow; View game stays pinned */}
              <div className="min-w-0 flex-1 overflow-x-auto">
                <div className="grid w-max min-w-full grid-cols-[1fr_auto_1fr] items-center gap-2">
                  {/* left player — pushed to the left edge, crown on outer edge */}
                  <div className="flex items-center justify-start gap-1.5 whitespace-nowrap">
                    {aWon && <span className="leading-none" aria-hidden>👑</span>}
                    <Link
                      href={`/players/${r.aId}`}
                      className={`transition-colors duration-150 ${aWon
                        ? 'font-semibold text-foreground hover:text-primary'
                        : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                      <span className="sm:hidden">{aFirst}</span>
                      <span className="hidden sm:inline">{r.aName}</span>
                    </Link>
                  </div>

                  {/* score — always centred in the row */}
                  <span className="whitespace-nowrap text-center font-mono text-xs nums tracking-tight text-muted-foreground">
                    {sets.map(([sa, sb]) => `${sa}–${sb}`).join('  ')}
                  </span>

                  {/* right player — pushed to the right edge, crown on outer edge */}
                  <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                    <Link
                      href={`/players/${r.bId}`}
                      className={`transition-colors duration-150 ${bWon
                        ? 'font-semibold text-foreground hover:text-primary'
                        : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                      <span className="sm:hidden">{bFirst}</span>
                      <span className="hidden sm:inline">{r.bName}</span>
                    </Link>
                    {bWon && <span className="leading-none" aria-hidden>👑</span>}
                  </div>
                </div>
              </div>
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

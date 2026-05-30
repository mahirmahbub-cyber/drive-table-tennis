import { db, matches, players } from '@/lib/db'
import { desc, eq, isNotNull } from 'drizzle-orm'
import Link from 'next/link'
import { alias } from 'drizzle-orm/pg-core'

export const dynamic = 'force-dynamic'

export default async function MatchesPage() {
  const a = alias(players, 'a')
  const b = alias(players, 'b')
  const rows = await db
    .select({
      id: matches.id,
      playedAt: matches.playedAt,
      setScores: matches.setScores,
      winnerId: matches.winnerId,
      aId: a.id,
      aName: a.name,
      bId: b.id,
      bName: b.name,
      eloAAfter: matches.eloAAfter,
      eloBAfter: matches.eloBAfter,
    })
    .from(matches)
    .innerJoin(a, eq(matches.playerAId, a.id))
    .innerJoin(b, eq(matches.playerBId, b.id))
    .where(isNotNull(matches.playedAt))
    .orderBy(desc(matches.playedAt))
    .limit(200)

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">Matches</h1>
      <ul className="divide-y">
        {rows.map((r) => {
          const aWon = r.winnerId === r.aId
          const sets = (r.setScores as Array<[number, number]>) ?? []
          return (
            <li key={r.id} className="flex items-center gap-4 py-3">
              <div className="w-32 text-xs text-zinc-500">
                {r.playedAt?.toLocaleString()}
              </div>
              <div className="flex-1">
                <Link href={`/players/${r.aId}`} className={aWon ? 'font-semibold' : ''}>
                  {r.aName}
                </Link>
                <span className="mx-2 font-mono tabular-nums text-zinc-500">
                  {sets.map(([sa, sb]) => `${sa}-${sb}`).join('  ')}
                </span>
                <Link href={`/players/${r.bId}`} className={!aWon ? 'font-semibold' : ''}>
                  {r.bName}
                </Link>
              </div>
            </li>
          )
        })}
      </ul>
    </main>
  )
}

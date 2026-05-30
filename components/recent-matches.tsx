import Link from 'next/link'
import { db, matches, players } from '@/lib/db'
import { alias } from 'drizzle-orm/pg-core'
import { desc, eq, isNotNull } from 'drizzle-orm'

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
      <h2 className="mb-3 text-lg font-semibold">Recent matches</h2>
      <ul className="divide-y rounded border">
        {rows.map((r) => {
          const aWon = r.winnerId === r.aId
          const sets = (r.setScores as Array<[number, number]>) ?? []
          return (
            <li key={r.id} className="px-3 py-2 text-sm">
              <Link href={`/players/${r.aId}`} className={aWon ? 'font-semibold' : ''}>
                {r.aName}
              </Link>
              <span className="mx-2 font-mono tabular-nums text-zinc-500">
                {sets.map(([sa, sb]) => `${sa}-${sb}`).join(' ')}
              </span>
              <Link href={`/players/${r.bId}`} className={!aWon ? 'font-semibold' : ''}>
                {r.bName}
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

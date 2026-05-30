import { db, players } from '@/lib/db'
import { asc, eq } from 'drizzle-orm'
import { MatchLogForm } from '@/components/match-log-form'

export const dynamic = 'force-dynamic'

export default async function NewMatchPage() {
  const roster = await db
    .select({
      id: players.id,
      name: players.name,
      nickname: players.nickname,
      currentElo: players.currentElo,
    })
    .from(players)
    .where(eq(players.active, true))
    .orderBy(asc(players.name))

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">Log a match</h1>
      <MatchLogForm players={roster} />
    </main>
  )
}

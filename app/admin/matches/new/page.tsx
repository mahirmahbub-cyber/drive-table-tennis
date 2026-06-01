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
    <main className="mx-auto w-full max-w-xl px-4 py-8 md:px-6">
      <div className="mb-6">
        <p className="font-display uppercase tracking-[0.2em] text-xs text-primary mb-1">
          Score Entry
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight leading-none">
          Log a match
        </h1>
      </div>
      <MatchLogForm players={roster} />
    </main>
  )
}

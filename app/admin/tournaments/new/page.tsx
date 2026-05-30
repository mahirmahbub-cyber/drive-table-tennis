import { db, players } from '@/lib/db'
import { asc, eq } from 'drizzle-orm'
import { TournamentCreateForm } from '@/components/tournament-create-form'

export const dynamic = 'force-dynamic'

export default async function NewTournamentPage() {
  const roster = await db
    .select({ id: players.id, name: players.name, currentElo: players.currentElo })
    .from(players)
    .where(eq(players.active, true))
    .orderBy(asc(players.name))

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">New tournament</h1>
      <TournamentCreateForm players={roster} />
    </main>
  )
}

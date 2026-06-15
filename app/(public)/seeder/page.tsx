import { asc, eq } from 'drizzle-orm'
import { db, players } from '@/lib/db'
import { QuickSeeder } from '@/components/quick-seeder'

export const dynamic = 'force-dynamic'

export default async function SeederPage() {
  const roster = await db
    .select({ id: players.id, name: players.name, currentElo: players.currentElo })
    .from(players)
    .where(eq(players.active, true))
    .orderBy(asc(players.name))

  const options = roster.map((p) => ({ id: p.id, name: p.name, elo: p.currentElo }))

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8 md:px-6">
      <div className="mb-6">
        <p className="font-display uppercase tracking-[0.2em] text-xs text-primary mb-1">
          Casual play
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight leading-none">
          Quick Seeder
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pick who&rsquo;s playing, set a time budget, and get a fair, ELO-seeded run of games.
        </p>
      </div>
      <QuickSeeder players={options} />
    </main>
  )
}

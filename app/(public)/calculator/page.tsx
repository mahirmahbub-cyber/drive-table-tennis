import { asc, eq } from 'drizzle-orm'
import { db, players } from '@/lib/db'
import { EloCalculator } from '@/components/elo-calculator'

export const dynamic = 'force-dynamic'

export default async function CalculatorPage() {
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
          What-if
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight leading-none">
          Elo calculator
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pick two players and how many games each wins to project the Elo change.
          Points don&rsquo;t matter — only who wins each game.
        </p>
      </div>
      <EloCalculator players={roster} />
    </main>
  )
}

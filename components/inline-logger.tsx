import { db, players } from '@/lib/db'
import { asc, eq } from 'drizzle-orm'
import { MatchLogForm } from '@/components/match-log-form'

export async function InlineLogger() {
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
    <section
      id="log"
      className="scroll-mt-20 rounded-xl border border-primary/40 bg-card p-4 shadow-[0_0_0_2px_rgba(41,96,197,0.12)]"
    >
      <div className="section-header font-display text-primary">Log a game</div>
      <MatchLogForm players={roster} />
    </section>
  )
}

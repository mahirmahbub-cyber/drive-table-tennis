import { notFound } from 'next/navigation'
import { db, matches, players, tournaments } from '@/lib/db'
import { alias } from 'drizzle-orm/pg-core'
import { asc, eq } from 'drizzle-orm'
import { BracketView, type BracketMatch } from '@/components/bracket-view'

export const dynamic = 'force-dynamic'

async function loadTournament(id: string) {
  const [t] = await db.select().from(tournaments).where(eq(tournaments.id, id))
  if (!t) return null
  const a = alias(players, 'a')
  const b = alias(players, 'b')
  const rows = await db
    .select({
      id: matches.id,
      round: matches.round,
      bracketSlot: matches.bracketSlot,
      winnerId: matches.winnerId,
      setScores: matches.setScores,
      aId: a.id,
      aName: a.name,
      bId: b.id,
      bName: b.name,
    })
    .from(matches)
    .leftJoin(a, eq(matches.playerAId, a.id))
    .leftJoin(b, eq(matches.playerBId, b.id))
    .where(eq(matches.tournamentId, id))
    .orderBy(asc(matches.round), asc(matches.bracketSlot))

  const bracket: BracketMatch[] = rows.map((r) => ({
    id: r.id,
    round: r.round!,
    bracketSlot: r.bracketSlot!,
    playerA: r.aId ? { id: r.aId, name: r.aName! } : null,
    playerB: r.bId ? { id: r.bId, name: r.bName! } : null,
    winnerId: r.winnerId,
    setScores: r.setScores as Array<[number, number]> | null,
  }))

  return { tournament: t, bracket }
}

export default async function TournamentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await loadTournament(id)
  if (!data) notFound()
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6">
      <div className="mb-6 flex items-center gap-3">
        <div>
          <p className="font-display uppercase tracking-[0.2em] text-xs text-primary mb-1">
            Bracket
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight leading-none">
            {data.tournament.name}
          </h1>
        </div>
        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-display text-[10px] font-semibold uppercase tracking-wider text-primary">
          {data.tournament.status.replace('_', ' ')}
        </span>
      </div>
      <div className="rounded-lg border border-border bg-card p-1">
        <BracketView matches={data.bracket} />
      </div>
    </main>
  )
}

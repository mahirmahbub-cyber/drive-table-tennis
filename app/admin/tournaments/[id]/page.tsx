import { notFound } from 'next/navigation'
import { db, matches, players, tournaments } from '@/lib/db'
import { alias } from 'drizzle-orm/pg-core'
import { asc, eq } from 'drizzle-orm'
import { BracketView, type BracketMatch } from '@/components/bracket-view'
import { TournamentManageActions } from '@/components/admin/tournament-row-actions'

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

export default async function ManageTournamentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await loadTournament(id)
  if (!data) notFound()

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{data.tournament.name}</h1>
        <TournamentManageActions id={id} name={data.tournament.name} />
      </div>
      <p className="mb-2 text-sm text-zinc-500">Status: {data.tournament.status}</p>
      <p className="mb-6 text-xs text-muted-foreground">Tip: click any match with both players set to record or fix its result. Editing an early-round result re-advances the immediate next match only — deeper rounds aren&apos;t auto-rewritten.</p>
      <BracketView
        matches={data.bracket}
        href={(m) => (m.playerA && m.playerB ? `/admin/tournaments/${id}/match/${m.id}` : null)}
      />
    </main>
  )
}

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
      <h1 className="mb-4 text-2xl font-semibold">{data.tournament.name}</h1>
      <p className="mb-6 text-sm text-zinc-500">Status: {data.tournament.status}</p>
      <BracketView
        matches={data.bracket}
        href={(m) =>
          m.playerA && m.playerB && !m.winnerId
            ? `/admin/tournaments/${id}/match/${m.id}`
            : null
        }
      />
    </main>
  )
}

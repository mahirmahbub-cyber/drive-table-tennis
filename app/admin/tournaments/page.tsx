import Link from 'next/link'
import { desc, eq, sql } from 'drizzle-orm'
import { db, tournaments, tournamentEntries } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function AdminTournamentsPage() {
  const rows = await db
    .select({
      id: tournaments.id,
      name: tournaments.name,
      status: tournaments.status,
      createdAt: tournaments.createdAt,
      players: sql<number>`count(${tournamentEntries.id})`.mapWith(Number),
    })
    .from(tournaments)
    .leftJoin(tournamentEntries, eq(tournamentEntries.tournamentId, tournaments.id))
    .groupBy(tournaments.id)
    .orderBy(desc(tournaments.createdAt))

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 md:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="font-display uppercase tracking-[0.2em] text-xs text-primary mb-1">Race Control</p>
          <h1 className="font-display text-3xl font-bold tracking-tight leading-none">Tournaments</h1>
        </div>
        <Link href="/admin/tournaments/new" className="rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">New tournament</Link>
      </div>
      <ul className="rounded-lg border border-border overflow-hidden bg-card">
        {rows.map((t) => (
          <li key={t.id} className="data-row">
            <Link href={`/admin/tournaments/${t.id}`} className="flex-1 font-medium hover:text-primary">{t.name}</Link>
            <span className="text-xs text-muted-foreground">{t.players} players</span>
            <span className="text-xs text-muted-foreground">{t.createdAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
            <span className="rounded-full bg-secondary px-2 py-0.5 font-display text-[10px] uppercase tracking-wider text-secondary-foreground">{t.status.replace('_', ' ')}</span>
          </li>
        ))}
        {rows.length === 0 && <li className="px-3 py-4 text-sm text-muted-foreground">No tournaments yet.</li>}
      </ul>
    </main>
  )
}

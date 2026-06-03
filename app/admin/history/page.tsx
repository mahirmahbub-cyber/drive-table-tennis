import Link from 'next/link'
import { db, matches, players } from '@/lib/db'
import { and, asc, desc, eq, gte, ilike, isNotNull, isNull, lte, or, type SQL } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { formatDuration } from '@/lib/stats'
import { MatchRowActions } from '@/components/admin/match-row-actions'

export const dynamic = 'force-dynamic'

export default async function AdminHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ playerId?: string; from?: string; to?: string; type?: string; q?: string }>
}) {
  const sp = await searchParams
  const a = alias(players, 'a')
  const b = alias(players, 'b')

  const conditions: SQL[] = [isNotNull(matches.playedAt)]
  if (sp.playerId) {
    conditions.push(or(eq(matches.playerAId, sp.playerId), eq(matches.playerBId, sp.playerId))!)
  }
  if (sp.from) conditions.push(gte(matches.playedAt, new Date(sp.from)))
  if (sp.to) conditions.push(lte(matches.playedAt, new Date(sp.to + 'T23:59:59')))
  if (sp.type === 'tournament') conditions.push(isNotNull(matches.tournamentId))
  if (sp.type === 'casual') conditions.push(isNull(matches.tournamentId))
  if (sp.q) conditions.push(or(ilike(a.name, `%${sp.q}%`), ilike(b.name, `%${sp.q}%`))!)

  const rows = await db
    .select({
      id: matches.id,
      playedAt: matches.playedAt,
      setScores: matches.setScores,
      winnerId: matches.winnerId,
      durationSeconds: matches.durationSeconds,
      tournamentId: matches.tournamentId,
      eloAAfter: matches.eloAAfter,
      eloBAfter: matches.eloBAfter,
      aId: a.id,
      aName: a.name,
      bId: b.id,
      bName: b.name,
    })
    .from(matches)
    .innerJoin(a, eq(matches.playerAId, a.id))
    .innerJoin(b, eq(matches.playerBId, b.id))
    .where(and(...conditions))
    .orderBy(desc(matches.playedAt))
    .limit(300)

  const roster = await db
    .select({ id: players.id, name: players.name, nickname: players.nickname, currentElo: players.currentElo })
    .from(players)
    .orderBy(asc(players.name))

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 md:px-6">
      <div className="mb-6">
        <p className="font-display uppercase tracking-[0.2em] text-xs text-primary mb-1">Records Office</p>
        <h1 className="font-display text-3xl font-bold tracking-tight leading-none">Match history</h1>
      </div>

      {/* Filters */}
      <form className="mb-6 grid grid-cols-1 gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-5">
        <label className="block sm:col-span-1">
          <span className="font-display uppercase tracking-widest text-[10px] text-muted-foreground">Player</span>
          <select name="playerId" defaultValue={sp.playerId ?? ''} className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm">
            <option value="">All players</option>
            {roster.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="font-display uppercase tracking-widest text-[10px] text-muted-foreground">From</span>
          <input type="date" name="from" defaultValue={sp.from ?? ''} className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm" />
        </label>
        <label className="block">
          <span className="font-display uppercase tracking-widest text-[10px] text-muted-foreground">To</span>
          <input type="date" name="to" defaultValue={sp.to ?? ''} className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm" />
        </label>
        <label className="block">
          <span className="font-display uppercase tracking-widest text-[10px] text-muted-foreground">Type</span>
          <select name="type" defaultValue={sp.type ?? ''} className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm">
            <option value="">All</option>
            <option value="tournament">Tournament</option>
            <option value="casual">Casual</option>
          </select>
        </label>
        <label className="block">
          <span className="font-display uppercase tracking-widest text-[10px] text-muted-foreground">Search</span>
          <input name="q" defaultValue={sp.q ?? ''} placeholder="Player name" className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm" />
        </label>
        <div className="flex items-end gap-2 sm:col-span-5">
          <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
            Apply filters
          </button>
          <Link href="/admin/history" className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
            Clear
          </Link>
        </div>
      </form>

      {/* Results */}
      <ul className="rounded-lg border border-border overflow-hidden bg-card">
        {rows.map((r) => {
          const aWon = r.winnerId === r.aId
          const bWon = r.winnerId === r.bId
          const sets = (r.setScores as Array<[number, number]>) ?? []
          return (
            <li key={r.id} className="data-row text-sm">
              <span className="hidden w-24 shrink-0 font-mono text-[11px] text-muted-foreground sm:block">
                {r.playedAt?.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
              <span className={`shrink-0 ${aWon ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{r.aName}</span>
              <span className="flex-1 text-center font-mono nums text-xs text-muted-foreground">
                {sets.map(([sa, sb]) => `${sa}–${sb}`).join('  ')}
              </span>
              <span className={`shrink-0 ${bWon ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{r.bName}</span>
              <span className="hidden w-16 shrink-0 text-right font-mono text-[11px] text-muted-foreground sm:block">
                {r.durationSeconds ? formatDuration(r.durationSeconds) : '—'}
              </span>
              {r.tournamentId && (
                <span className="hidden shrink-0 rounded-full bg-secondary px-2 py-0.5 font-display text-[9px] uppercase tracking-wider text-secondary-foreground sm:inline">
                  Cup
                </span>
              )}
              <MatchRowActions
                players={roster}
                label={`${r.aName} vs ${r.bName}`}
                initial={{
                  id: r.id,
                  playerAId: r.aId,
                  playerBId: r.bId,
                  sets,
                  playedAt: r.playedAt,
                  durationSeconds: r.durationSeconds,
                }}
              />
            </li>
          )
        })}
        {rows.length === 0 && (
          <li className="px-3 py-4 text-sm text-muted-foreground">No matches found for these filters.</li>
        )}
      </ul>
    </main>
  )
}

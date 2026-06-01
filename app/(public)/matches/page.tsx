import { db, matches, players } from '@/lib/db'
import { desc, eq, isNotNull } from 'drizzle-orm'
import Link from 'next/link'
import { alias } from 'drizzle-orm/pg-core'
import { computeDurationRecords, formatDuration, type DurationMatch } from '@/lib/stats'

export const dynamic = 'force-dynamic'

export default async function MatchesPage() {
  const a = alias(players, 'a')
  const b = alias(players, 'b')
  const rows = await db
    .select({
      id: matches.id,
      playedAt: matches.playedAt,
      setScores: matches.setScores,
      winnerId: matches.winnerId,
      aId: a.id,
      aName: a.name,
      bId: b.id,
      bName: b.name,
      eloAAfter: matches.eloAAfter,
      eloBAfter: matches.eloBAfter,
      durationSeconds: matches.durationSeconds,
    })
    .from(matches)
    .innerJoin(a, eq(matches.playerAId, a.id))
    .innerJoin(b, eq(matches.playerBId, b.id))
    .where(isNotNull(matches.playedAt))
    .orderBy(desc(matches.playedAt))
    .limit(200)

  const durationMatches: DurationMatch[] = rows
    .filter((r) => r.durationSeconds && r.playedAt)
    .map((r) => ({
      id: r.id,
      playerAId: r.aId,
      playerBId: r.bId,
      winnerId: r.winnerId!,
      durationSeconds: r.durationSeconds!,
      playedAt: r.playedAt!,
    }))
  const records = computeDurationRecords(durationMatches)

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 md:px-6">
      <div className="mb-6">
        <p className="font-display uppercase tracking-[0.2em] text-xs text-primary mb-1">
          Race Log
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight leading-none">
          Matches
        </h1>
      </div>

      {records.totalCourtTimeSeconds > 0 && (
        <div className="mb-6 grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <div className="font-display uppercase tracking-widest text-[10px] text-muted-foreground">Longest match</div>
            <div className="font-mono nums text-xl font-semibold">
              {records.longestMatch ? formatDuration(records.longestMatch.durationSeconds) : '—'}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <div className="font-display uppercase tracking-widest text-[10px] text-muted-foreground">Fastest game</div>
            <div className="font-mono nums text-xl font-semibold">
              {records.fastestWin ? formatDuration(records.fastestWin.durationSeconds) : '—'}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <div className="font-display uppercase tracking-widest text-[10px] text-muted-foreground">Total court time</div>
            <div className="font-mono nums text-xl font-semibold">
              {formatDuration(records.totalCourtTimeSeconds)}
            </div>
          </div>
        </div>
      )}

      <ul className="rounded-lg border border-border overflow-hidden bg-card">
        {rows.map((r) => {
          const aWon = r.winnerId === r.aId
          const sets = (r.setScores as Array<[number, number]>) ?? []
          return (
            <li key={r.id} className="data-row text-sm">
              <span className="hidden w-28 shrink-0 font-mono text-[11px] text-muted-foreground sm:block">
                {r.playedAt?.toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}
                {', '}
                {r.playedAt?.toLocaleTimeString(undefined, {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </span>

              <span className={`w-1 h-4 rounded-full shrink-0 ${aWon ? 'bg-primary' : 'bg-transparent'}`} />
              <Link
                href={`/players/${r.aId}`}
                className={`shrink-0 transition-colors duration-150 ${
                  aWon
                    ? 'font-semibold text-foreground hover:text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {r.aName}
              </Link>

              <span className="flex-1 text-center font-mono nums text-xs text-muted-foreground tracking-tight">
                {sets.map(([sa, sb]) => `${sa}–${sb}`).join('  ')}
              </span>

              <Link
                href={`/players/${r.bId}`}
                className={`shrink-0 transition-colors duration-150 ${
                  !aWon
                    ? 'font-semibold text-foreground hover:text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {r.bName}
              </Link>
              <span className="hidden w-14 shrink-0 text-right font-mono text-[11px] text-muted-foreground sm:block">
                {r.durationSeconds ? formatDuration(r.durationSeconds) : ''}
              </span>
              <span className={`w-1 h-4 rounded-full shrink-0 ${!aWon ? 'bg-primary' : 'bg-transparent'}`} />
            </li>
          )
        })}
        {rows.length === 0 && (
          <li className="px-3 py-4 text-sm text-muted-foreground">No matches yet.</li>
        )}
      </ul>
    </main>
  )
}

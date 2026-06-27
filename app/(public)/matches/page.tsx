import { db, matches, players } from '@/lib/db'
import { desc, eq, isNotNull } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { computeDurationRecords, formatDuration, type DurationMatch } from '@/lib/stats'
import { ViewGameButton } from '@/components/view-game-button'
import { MatchScoreline } from '@/components/match-scoreline'
import { formatInZone } from '@/lib/tz'

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
          const sets = (r.setScores as Array<[number, number]>) ?? []
          return (
            <li key={r.id} className="data-row text-sm">
              <span className="hidden w-28 shrink-0 font-mono text-[11px] text-muted-foreground sm:block">
                {r.playedAt && formatInZone(r.playedAt, { month: 'short', day: 'numeric' })}
                {', '}
                {r.playedAt && formatInZone(r.playedAt, { hour: 'numeric', minute: '2-digit' })}
              </span>

              <MatchScoreline
                aId={r.aId}
                aName={r.aName}
                bId={r.bId}
                bName={r.bName}
                winnerId={r.winnerId}
                sets={sets}
              />

              <span className="hidden w-14 shrink-0 text-right font-mono text-[11px] text-muted-foreground sm:block">
                {r.durationSeconds ? formatDuration(r.durationSeconds) : ''}
              </span>
              <ViewGameButton id={r.id} />
            </li>
          )
        })}
        {rows.length === 0 && (
          <li className="px-3 py-4 text-sm text-muted-foreground">No races logged yet. The first result sets the grid.</li>
        )}
      </ul>
    </main>
  )
}

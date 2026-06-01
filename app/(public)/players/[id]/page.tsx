import { notFound } from 'next/navigation'
import { db, matches, players } from '@/lib/db'
import { and, asc, eq, isNotNull, or } from 'drizzle-orm'
import { PlayerAvatar } from '@/components/player-avatar'
import { EloChart } from '@/components/elo-chart'
import { SpeedoGauge } from '@/components/speedo-gauge'
import { classifyOpponentTier, averageDurationForPlayer, formatDuration, type DurationMatch } from '@/lib/stats'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [player] = await db.select().from(players).where(eq(players.id, id))
  if (!player) notFound()

  const playerMatches = await db
    .select()
    .from(matches)
    .where(
      and(
        isNotNull(matches.playedAt),
        or(eq(matches.playerAId, id), eq(matches.playerBId, id))
      )
    )
    .orderBy(asc(matches.playedAt))

  const durationMatches: DurationMatch[] = playerMatches
    .filter((m) => m.durationSeconds)
    .map((m) => ({
      id: m.id,
      playerAId: m.playerAId!,
      playerBId: m.playerBId!,
      winnerId: m.winnerId!,
      durationSeconds: m.durationSeconds!,
      playedAt: m.playedAt!,
    }))
  const avgDuration = averageDurationForPlayer(durationMatches, id)

  const points = playerMatches.map((m, i) => {
    const isA = m.playerAId === id
    const elo = isA ? m.eloAAfter! : m.eloBAfter!
    return { t: m.playedAt!.getTime(), elo, label: `#${i + 1}` }
  })

  let wins = 0
  let losses = 0
  const tier = {
    higher: { w: 0, l: 0 },
    similar: { w: 0, l: 0 },
    lower: { w: 0, l: 0 },
  }
  for (const m of playerMatches) {
    const isA = m.playerAId === id
    const iWon = m.winnerId === id
    if (iWon) wins++
    else losses++
    const myEloBefore = isA ? m.eloABefore! : m.eloBBefore!
    const oppEloBefore = isA ? m.eloBBefore! : m.eloABefore!
    const t = classifyOpponentTier(myEloBefore, oppEloBefore)
    if (iWon) tier[t].w++
    else tier[t].l++
  }

  const winPct =
    wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : null

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 md:px-6">

      {/* ── Back link ── */}
      <Link
        href="/"
        className="inline-block mb-6 text-xs font-display uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors duration-150"
      >
        ← Ladder
      </Link>

      {/* ── Player header ── */}
      <header className="mb-8 flex items-center justify-between gap-5 border-b border-border pb-6">
        <div className="flex min-w-0 items-center gap-5">
          <PlayerAvatar name={player.name} photoUrl={player.photoUrl} size={72} />
          <div className="min-w-0">
            <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight leading-tight">
              {player.name}
              {player.nickname && (
                <span className="ml-2 text-lg font-normal text-muted-foreground">
                  &ldquo;{player.nickname}&rdquo;
                </span>
              )}
            </h1>
            {player.bio && (
              <p className="mt-1 text-sm text-muted-foreground">{player.bio}</p>
            )}

            {/* Key stats row */}
            <div className="mt-3 flex items-baseline gap-4 flex-wrap text-muted-foreground text-sm">
              <span>
                <span className="font-mono nums text-foreground">{wins}</span>W{' '}
                <span className="font-mono nums text-foreground">{losses}</span>L
              </span>
              {winPct !== null && (
                <span className="font-display font-semibold nums text-gain">
                  {winPct}% wins
                </span>
              )}
              {avgDuration !== null && (
                <span className="font-mono nums text-muted-foreground">
                  avg {formatDuration(avgDuration)}/game
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Speedometer — the headline ELO read-out */}
        <div className="hidden shrink-0 sm:block">
          <SpeedoGauge elo={player.currentElo} label="ELO" size="lg" />
        </div>
      </header>

      {/* ── ELO chart ── */}
      <section className="mb-8">
        <div className="section-header font-display">ELO Trajectory</div>
        <EloChart data={points} />
      </section>

      {/* ── Tier breakdown ── */}
      <section>
        <div className="section-header font-display">By Opponent Tier</div>
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="pb-2 text-left font-display uppercase text-xs tracking-widest text-muted-foreground font-medium">
                Tier
              </th>
              <th className="pb-2 text-right font-display uppercase text-xs tracking-widest text-muted-foreground font-medium">
                W
              </th>
              <th className="pb-2 text-right font-display uppercase text-xs tracking-widest text-muted-foreground font-medium">
                L
              </th>
              <th className="pb-2 text-right font-display uppercase text-xs tracking-widest text-muted-foreground font-medium">
                Win%
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(['higher', 'similar', 'lower'] as const).map((t) => {
              const { w, l } = tier[t]
              const total = w + l
              const pct = total === 0 ? '—' : `${Math.round((w / total) * 100)}%`
              return (
                <tr key={t}>
                  <td className="py-1.5 capitalize text-muted-foreground">
                    {t}-rated
                  </td>
                  <td className="py-1.5 text-right font-mono nums">{w}</td>
                  <td className="py-1.5 text-right font-mono nums">{l}</td>
                  <td
                    className={`py-1.5 text-right font-mono nums font-medium ${
                      total > 0 && w / total >= 0.5
                        ? 'text-gain'
                        : total > 0
                        ? 'text-muted-foreground'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {pct}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
    </main>
  )
}

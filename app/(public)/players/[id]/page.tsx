import { notFound } from 'next/navigation'
import { db, matches, players } from '@/lib/db'
import { and, asc, eq, isNotNull, or } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { PlayerAvatar } from '@/components/player-avatar'
import { EloChart } from '@/components/elo-chart'
import { SpeedoGauge } from '@/components/speedo-gauge'
import { classifyOpponentTier, averageDurationForPlayer, formatDuration, type DurationMatch } from '@/lib/stats'
import { playerAggregates, giantKills, rankWithin, movers, type EngineMatch } from '@/lib/stats-engine'
import { titlesForPlayer } from '@/lib/titles'
import { TitleBadge } from '@/components/title-badge'
import Link from 'next/link'
import { PlayerGamesHistory, type HistoryRow } from '@/components/player-games-history'
import { playerEloDelta, type SetScore } from '@/lib/match-format'

export const dynamic = 'force-dynamic'

export default async function PlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ welcome?: string }>
}) {
  const { id } = await params
  const sp = await searchParams
  const welcome = sp.welcome === '1'
  const [player] = await db.select().from(players).where(eq(players.id, id))
  if (!player) notFound()

  const pa = alias(players, 'pa')
  const pb = alias(players, 'pb')
  const playerMatches = await db
    .select({
      id: matches.id,
      playerAId: matches.playerAId,
      playerBId: matches.playerBId,
      winnerId: matches.winnerId,
      setScores: matches.setScores,
      playedAt: matches.playedAt,
      durationSeconds: matches.durationSeconds,
      eloABefore: matches.eloABefore,
      eloAAfter: matches.eloAAfter,
      eloBBefore: matches.eloBBefore,
      eloBAfter: matches.eloBAfter,
      aName: pa.name,
      bName: pb.name,
    })
    .from(matches)
    .innerJoin(pa, eq(matches.playerAId, pa.id))
    .innerJoin(pb, eq(matches.playerBId, pb.id))
    .where(and(isNotNull(matches.playedAt), or(eq(matches.playerAId, id), eq(matches.playerBId, id))))
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

  const engineMatches: EngineMatch[] = playerMatches
    .filter((m) => ((m.setScores as SetScore[] | null)?.length ?? 0) > 0)
    .map((m) => ({
      id: m.id, playerAId: m.playerAId!, playerBId: m.playerBId!, winnerId: m.winnerId,
      setScores: (m.setScores as [number, number][]) ?? [], durationSeconds: m.durationSeconds, playedAt: m.playedAt!,
      eloABefore: m.eloABefore ?? 1200, eloAAfter: m.eloAAfter ?? 1200, eloBBefore: m.eloBBefore ?? 1200, eloBAfter: m.eloBAfter ?? 1200,
    }))
  const stats = playerAggregates(engineMatches, id, player.currentElo)
  const wins = stats.wins
  const losses = stats.losses
  const winPct = stats.winPct

  const now = Date.now()
  const activeElos = await db.select({ id: players.id, currentElo: players.currentElo }).from(players).where(eq(players.active, true))
  const weekly = movers(engineMatches, new Date(now - 7 * 86400 * 1000)).find((x) => x.playerId === id)?.delta ?? 0
  const titles = titlesForPlayer({
    rank: rankWithin(activeElos.map((p) => p.currentElo), player.currentElo),
    totalPlayers: activeElos.length,
    games: stats.games,
    currentStreak: stats.currentStreak,
    weeklyDelta: weekly,
    giantKills: giantKills(engineMatches, id),
    currentElo: player.currentElo,
    peakElo: stats.peakElo,
  })

  const tier = {
    higher: { w: 0, l: 0 },
    similar: { w: 0, l: 0 },
    lower: { w: 0, l: 0 },
  }
  for (const m of playerMatches) {
    const isA = m.playerAId === id
    const myEloBefore = isA ? m.eloABefore! : m.eloBBefore!
    const oppEloBefore = isA ? m.eloBBefore! : m.eloABefore!
    const t = classifyOpponentTier(myEloBefore, oppEloBefore)
    for (const [sa, sb] of (m.setScores as SetScore[]) ?? []) {
      if (sa === sb) continue
      const iWonGame = isA ? sa > sb : sb > sa
      if (iWonGame) tier[t].w++; else tier[t].l++
    }
  }

  const historyRows: HistoryRow[] = [...playerMatches].reverse().map((m) => {
    const playerIsA = m.playerAId === id
    return {
      id: m.id,
      playedAt: m.playedAt!.toISOString(),
      playerIsA,
      iWon: m.winnerId === id,
      opponentId: playerIsA ? m.playerBId! : m.playerAId!,
      opponentName: playerIsA ? m.bName : m.aName,
      sets: (m.setScores as SetScore[]) ?? [],
      eloDelta: playerEloDelta(m, playerIsA),
    }
  })

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 md:px-6">

      {welcome && (
        <div className="mb-6 rounded-xl border border-primary/40 bg-secondary px-4 py-3.5">
          <div className="font-display text-sm font-bold text-primary">🏁 You&apos;re on the grid!</div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Starting at 1200 ELO. <a href="/#log" className="text-primary hover:underline">Log your first game</a> to start climbing.
          </p>
        </div>
      )}

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

            {/* Title badges */}
            {titles.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {titles.map((t) => <TitleBadge key={t.key} title={t} />)}
              </div>
            )}

            {/* Key stats row */}
            <div className="mt-3 flex items-baseline gap-4 flex-wrap text-muted-foreground text-sm">
              <span>
                <span className="font-mono nums text-foreground">{wins}</span>W{' '}
                <span className="font-mono nums text-foreground">{losses}</span>L
              </span>
              {winPct !== null && (
                <span className="font-display font-semibold nums text-gain">{winPct}% wins</span>
              )}
              <span className="font-mono nums">{stats.games} games</span>
              {stats.totalPlayingSeconds > 0 && (
                <span className="font-mono nums">{formatDuration(stats.totalPlayingSeconds)} played</span>
              )}
              {avgDuration !== null && (
                <span className="font-mono nums text-muted-foreground">avg {formatDuration(avgDuration)}/game</span>
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

      {/* ── Games History ── */}
      <section className="mb-8">
        <div className="section-header font-display">Games History</div>
        <PlayerGamesHistory rows={historyRows} />
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

import Link from 'next/link'
import { PixelRally } from '@/components/pixel-rally'
import { InlineLogger } from '@/components/inline-logger'
import { Leaderboard } from '@/components/leaderboard'
import { RecentMatches } from '@/components/recent-matches'
import { ThisWeek } from '@/components/home/this-week'
import { H2hBanner } from '@/components/home/h2h-banner'
import { loadHomeData } from '@/lib/home-data'
import { movers, playerAggregates, giantKills, rankWithin, recentlyActive } from '@/lib/stats-engine'
import { topTitle, type Title } from '@/lib/titles'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const data = await loadHomeData()
  const now = data.now
  const since = new Date(now - 7 * 86400 * 1000)
  const weekMovers = movers(data.engineMatches, since)
  const activeIds = recentlyActive(data.engineMatches, since)
  const leaderboardPlayers = data.activePlayers.filter((p) => activeIds.has(p.id))

  const allElos = data.activePlayers.map((p) => p.currentElo)
  const moverById = new Map(weekMovers.map((mv) => [mv.playerId, mv.delta] as const))
  const titleByPlayer = new Map<string, Title>()
  for (const p of data.activePlayers) {
    const agg = playerAggregates(data.engineMatches, p.id, p.currentElo)
    const t = topTitle({
      rank: rankWithin(allElos, p.currentElo),
      totalPlayers: data.activePlayers.length,
      games: agg.games,
      currentStreak: agg.currentStreak,
      weeklyDelta: moverById.get(p.id) ?? 0,
      giantKills: giantKills(data.engineMatches, p.id),
      currentElo: p.currentElo,
      peakElo: agg.peakElo,
    })
    if (t) titleByPlayer.set(p.id, t)
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6">
      <H2hBanner />

      {/* ── Hero ── */}
      <section className="mb-8 overflow-hidden rounded-xl border border-border bg-linear-to-br from-secondary to-card">
        <div className="grid items-center gap-6 p-6 md:grid-cols-[1fr_1.1fr] md:p-8">
          <div>
            <p className="font-display uppercase tracking-[0.2em] text-xs text-primary mb-2">
              Office Ladder · Live Standings
            </p>
            <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight leading-[0.95]">
              Race to the top
              <br />
              of the table.
            </h1>
            <p className="mt-3 max-w-sm text-sm text-muted-foreground leading-relaxed">
              Every rally moves the grid. Log a match, watch the ratings spin, and
              chase pole position on the Drive table-tennis ladder.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link
                href="/join"
                className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors duration-150 hover:bg-brass-deep"
              >
                Join the ladder
              </Link>
            </div>
          </div>
          <div className="px-2 md:px-4">
            <PixelRally />
          </div>
        </div>
      </section>

      {/* ── Logger (most prominent) + weekly sidebar ── */}
      <div className="mb-8 grid gap-8 lg:grid-cols-[1fr_360px] lg:items-start">
        <div className="min-w-0">
          <InlineLogger />
        </div>
        <div className="min-w-0">
          <ThisWeek data={data} now={now} movers={weekMovers} />
        </div>
      </div>

      {/* ── Ladder (full width) ── */}
      <Leaderboard players={leaderboardPlayers} movers={weekMovers} wlById={data.wlById} titles={titleByPlayer} />

      {/* ── Recent results (full width) ── */}
      <div className="mt-8">
        <RecentMatches />
      </div>
    </main>
  )
}

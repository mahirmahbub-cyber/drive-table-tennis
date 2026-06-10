import Link from 'next/link'
import { PixelRally } from '@/components/pixel-rally'
import { InlineLogger } from '@/components/inline-logger'
import { Leaderboard } from '@/components/leaderboard'
import { RecentMatches } from '@/components/recent-matches'
import { JoinCta } from '@/components/join-cta'
import { SuperlativesStrip } from '@/components/home/superlatives-strip'
import { RivalryWatch } from '@/components/home/rivalry-watch'
import { ByTheNumbers } from '@/components/home/by-the-numbers'
import { loadHomeData } from '@/lib/home-data'
import { movers, playerAggregates, giantKills, rankWithin } from '@/lib/stats-engine'
import { topTitle, type Title } from '@/lib/titles'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const data = await loadHomeData()
  const now = data.now
  const since = new Date(now - 7 * 86400 * 1000)
  const weekMovers = movers(data.engineMatches, since)

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
      {/* ── Hero ── */}
      <section className="mb-10 overflow-hidden rounded-xl border border-border bg-linear-to-br from-secondary to-card">
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
                className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors duration-150 hover:bg-[#10489e]"
              >
                Join the ladder
              </Link>
              <a
                href="#log"
                className="inline-flex items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-secondary"
              >
                Log a game
              </a>
            </div>
          </div>
          <div className="px-2 md:px-4">
            <PixelRally />
          </div>
        </div>
      </section>

      {/* ── Logger (centered) ── */}
      <div className="mx-auto mb-8 w-full max-w-2xl">
        <InlineLogger />
      </div>

      {/* ── Championship HQ: wide on lg, stacked on mobile ── */}
      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="space-y-8 min-w-0">
          <SuperlativesStrip data={data} now={now} movers={weekMovers} />
          <Leaderboard players={data.activePlayers} movers={weekMovers} wlById={data.wlById} titles={titleByPlayer} />
          <RecentMatches />
        </div>
        <div className="space-y-8 min-w-0">
          <ByTheNumbers data={data} now={now} />
          <RivalryWatch data={data} now={now} />
          <JoinCta />
        </div>
      </div>
    </main>
  )
}

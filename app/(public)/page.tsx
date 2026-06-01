import Link from 'next/link'
import { Leaderboard } from '@/components/leaderboard'
import { RecentMatches } from '@/components/recent-matches'
import { InFormCard } from '@/components/in-form-card'
import { PixelRally } from '@/components/pixel-rally'
import { JoinCta } from '@/components/join-cta'

export const dynamic = 'force-dynamic'

export default function HomePage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 md:px-6">
      {/* ── Hero ── */}
      <section className="mb-10 overflow-hidden rounded-xl border border-border bg-gradient-to-br from-secondary to-card">
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
              <Link
                href="/admin/matches/new"
                className="inline-flex items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-secondary"
              >
                New game
              </Link>
            </div>
          </div>
          <div className="px-2 md:px-4">
            <PixelRally />
          </div>
        </div>
      </section>

      {/* ── Dashboard grid ── */}
      <div className="grid gap-8 md:grid-cols-[1fr_320px]">
        {/* Left — primary leaderboard */}
        <Leaderboard />

        {/* Right — secondary widgets */}
        <div className="space-y-8">
          <JoinCta />
          <InFormCard />
          <RecentMatches />
        </div>
      </div>
    </main>
  )
}

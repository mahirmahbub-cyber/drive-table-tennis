import Link from 'next/link'
import { Leaderboard } from '@/components/leaderboard'
import { RecentMatches } from '@/components/recent-matches'
import { InFormCard } from '@/components/in-form-card'

export const dynamic = 'force-dynamic'

export default function HomePage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 md:px-6">

      {/* ── Site header ── */}
      <header className="mb-10 flex items-end justify-between border-b border-border pb-5">
        <div>
          <p className="font-display uppercase tracking-[0.2em] text-xs text-muted-foreground mb-1">
            Drive.com.au
          </p>
          <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight leading-none">
            Table Tennis
          </h1>
        </div>
        <nav className="flex items-center gap-1 text-sm">
          <Link
            href="/players"
            className="px-3 py-1.5 text-muted-foreground hover:text-foreground transition-colors duration-150"
          >
            Players
          </Link>
          <Link
            href="/matches"
            className="px-3 py-1.5 text-muted-foreground hover:text-foreground transition-colors duration-150"
          >
            Matches
          </Link>
          <Link
            href="/tournaments"
            className="px-3 py-1.5 text-muted-foreground hover:text-foreground transition-colors duration-150"
          >
            Tournaments
          </Link>
          <Link
            href="/join"
            className="ml-2 px-3 py-1.5 border border-gain text-gain hover:bg-gain-muted font-medium transition-colors duration-150"
          >
            Join
          </Link>
        </nav>
      </header>

      {/* ── Dashboard grid ── */}
      <div className="grid gap-8 md:grid-cols-[1fr_320px]">
        {/* Left — primary leaderboard */}
        <Leaderboard />

        {/* Right — secondary widgets */}
        <div className="space-y-8">
          <InFormCard />
          <RecentMatches />
        </div>
      </div>
    </main>
  )
}

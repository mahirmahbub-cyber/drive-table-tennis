import Link from 'next/link'
import { rebuildElo } from '@/app/actions/matches'

const links = [
  { href: '/admin/matches/new', title: 'Log a match', desc: 'Record a game with a live stopwatch' },
  { href: '/admin/history', title: 'Match history', desc: 'Search, filter, edit, and delete matches' },
  { href: '/admin/players', title: 'Players', desc: 'Edit profiles and toggle active status' },
  { href: '/admin/tournaments/new', title: 'New tournament', desc: 'Seed and run a bracket' },
]

export default function AdminHomePage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 md:px-6">
      <div className="mb-6">
        <p className="font-display uppercase tracking-[0.2em] text-xs text-primary mb-1">Pit Wall</p>
        <h1 className="font-display text-3xl font-bold tracking-tight leading-none">Admin dashboard</h1>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-lg border border-border bg-card px-4 py-4 transition-colors hover:border-primary hover:bg-secondary/40"
          >
            <div className="font-display font-semibold">{l.title}</div>
            <div className="text-sm text-muted-foreground">{l.desc}</div>
          </Link>
        ))}
      </div>

      <div className="mt-8 rounded-lg border border-border bg-card p-4">
        <div className="section-header font-display">Maintenance</div>
        <form action={rebuildElo}>
          <button
            type="submit"
            className="rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary"
          >
            Rebuild ELO from match history
          </button>
        </form>
        <p className="mt-2 text-sm text-muted-foreground">
          Replays the entire match history and rewrites all per-match ELO snapshots and each
          player&apos;s current ELO. Safe to run anytime.
        </p>
      </div>
    </main>
  )
}

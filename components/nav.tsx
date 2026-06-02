import Link from 'next/link'
import { logout } from '@/app/actions/auth'

export function AdminNav() {
  return (
    <nav className="flex items-center gap-0 border-b border-border bg-card text-sm">
      {/* Brand mark */}
      <Link
        href="/"
        className="font-display uppercase tracking-widest text-xs font-semibold px-4 py-3 border-r border-border hover:text-gain transition-colors duration-150"
      >
        ← Back to home
      </Link>

      <Link
        href="/admin/players"
        className="px-4 py-3 text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors duration-150"
      >
        Players
      </Link>
      <Link
        href="/admin/matches/new"
        className="px-4 py-3 text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors duration-150"
      >
        Log match
      </Link>
      <Link
        href="/admin/tournaments/new"
        className="px-4 py-3 text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors duration-150"
      >
        Tournament
      </Link>
      <Link
        href="/admin/history"
        className="px-4 py-3 text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors duration-150"
      >
        History
      </Link>

      <form action={logout} className="ml-auto">
        <button
          type="submit"
          className="px-4 py-3 text-muted-foreground hover:text-foreground transition-colors duration-150"
        >
          Sign out
        </button>
      </form>
    </nav>
  )
}

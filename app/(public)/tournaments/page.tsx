import Link from 'next/link'
import { desc } from 'drizzle-orm'
import { db, tournaments } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function TournamentsPage() {
  const all = await db.select().from(tournaments).orderBy(desc(tournaments.createdAt))
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 md:px-6">
      <div className="mb-6">
        <p className="font-display uppercase tracking-[0.2em] text-xs text-primary mb-1">
          The Championship
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight leading-none">
          Tournaments
        </h1>
      </div>

      <ul className="rounded-lg border border-border overflow-hidden bg-card">
        {all.map((t) => (
          <li key={t.id} className="data-row">
            <Link
              href={`/tournaments/${t.id}`}
              className="flex-1 font-medium transition-colors duration-150 hover:text-primary"
            >
              {t.name}
            </Link>
            <StatusBadge status={t.status} />
          </li>
        ))}
        {all.length === 0 && (
          <li className="px-3 py-4 text-sm text-muted-foreground">
            No tournaments yet.
          </li>
        )}
      </ul>
    </main>
  )
}

function StatusBadge({ status }: { status: string }) {
  const label = status.replace('_', ' ')
  const styles =
    status === 'in_progress'
      ? 'bg-primary/10 text-primary'
      : status === 'completed'
      ? 'bg-secondary text-secondary-foreground'
      : 'bg-muted text-muted-foreground'
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 font-display text-[10px] font-semibold uppercase tracking-wider ${styles}`}
    >
      {label}
    </span>
  )
}

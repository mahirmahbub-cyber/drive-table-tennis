import Link from 'next/link'
import { desc, eq } from 'drizzle-orm'
import { db, players } from '@/lib/db'
import { PlayerAvatar } from '@/components/player-avatar'
import { SpeedoGauge } from '@/components/speedo-gauge'

export const dynamic = 'force-dynamic'

export default async function PlayersPage() {
  const roster = await db
    .select()
    .from(players)
    .where(eq(players.active, true))
    .orderBy(desc(players.currentElo))

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 md:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="font-display uppercase tracking-[0.2em] text-xs text-primary mb-1">
            The Grid
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight leading-none">
            Players
          </h1>
        </div>
        <Link
          href="/join"
          className="rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-colors duration-150 hover:bg-[#10489e]"
        >
          Create my profile
        </Link>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {roster.map((p) => (
          <li key={p.id}>
            <Link
              href={`/players/${p.id}`}
              className="group flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors duration-150 hover:border-primary/40 hover:bg-secondary/40"
            >
              <PlayerAvatar name={p.name} photoUrl={p.photoUrl} size={44} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium leading-tight transition-colors duration-150 group-hover:text-primary">
                  {p.name}
                  {p.nickname && (
                    <span className="ml-1.5 text-sm text-muted-foreground">
                      &ldquo;{p.nickname}&rdquo;
                    </span>
                  )}
                </div>
                {p.bio && (
                  <div className="truncate text-xs text-muted-foreground">
                    {p.bio}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <SpeedoGauge elo={p.currentElo} size="sm" />
                <span className="font-display text-lg font-semibold nums w-10 text-right">
                  {p.currentElo}
                </span>
              </div>
            </Link>
          </li>
        ))}
        {roster.length === 0 && (
          <li className="col-span-full rounded-lg border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
            No players yet. Be the first to{' '}
            <Link href="/join" className="text-primary hover:underline">
              join the ladder
            </Link>
            .
          </li>
        )}
      </ul>
    </main>
  )
}

import Link from 'next/link'
import { db, players } from '@/lib/db'
import { desc, eq } from 'drizzle-orm'
import { PlayerAvatar } from './player-avatar'
import { AnimatedRow } from './motion/animated-row'

export async function Leaderboard() {
  const rows = await db
    .select()
    .from(players)
    .where(eq(players.active, true))
    .orderBy(desc(players.currentElo))
    .limit(20)

  const leaderElo = rows[0]?.currentElo ?? 0

  return (
    <section>
      <div className="section-header font-display flex items-center justify-between">
        <span>Starting Grid</span>
        <span className="flex items-center gap-4 normal-case tracking-normal text-[10px] text-muted-foreground/70">
          <span className="w-10 text-right">Rating</span>
          <span className="w-12 text-right">Gap</span>
        </span>
      </div>

      <ol className="rounded-lg border border-border overflow-hidden bg-card">
        {rows.map((p, i) => {
          const pole = i === 0
          const gap = leaderElo - p.currentElo
          return (
            <AnimatedRow
              key={p.id}
              layoutId={`leader-${p.id}`}
              className={`data-row group ${pole ? 'bg-secondary' : ''}`}
            >
              {/* Grid slot number */}
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-display text-sm font-bold nums ${
                  pole
                    ? 'bg-primary text-primary-foreground'
                    : i <= 2
                    ? 'bg-secondary text-primary'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {i + 1}
              </span>

              <PlayerAvatar name={p.name} photoUrl={p.photoUrl} size={28} />

              <Link
                href={`/players/${p.id}`}
                className="flex-1 min-w-0 leading-tight transition-colors duration-150 hover:text-primary"
              >
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{p.name}</span>
                  {pole && (
                    <span className="rounded-sm bg-primary/10 px-1.5 py-0.5 font-display text-[9px] font-bold uppercase tracking-wider text-primary">
                      Pole
                    </span>
                  )}
                </span>
                {p.nickname && (
                  <span className="block truncate text-xs text-muted-foreground">
                    &ldquo;{p.nickname}&rdquo;
                  </span>
                )}
              </Link>

              {/* Rating */}
              <span className="w-10 shrink-0 text-right font-display text-base font-semibold nums">
                {p.currentElo}
              </span>

              {/* Gap to leader */}
              <span className="w-12 shrink-0 text-right font-mono text-xs nums text-muted-foreground">
                {pole ? '—' : `-${gap}`}
              </span>
            </AnimatedRow>
          )
        })}
        {rows.length === 0 && (
          <li className="px-3 py-4 text-sm text-muted-foreground">No players yet.</li>
        )}
      </ol>
    </section>
  )
}

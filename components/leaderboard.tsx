import Link from 'next/link'
import { db, players } from '@/lib/db'
import { desc, eq } from 'drizzle-orm'
import { PlayerAvatar } from './player-avatar'

export async function Leaderboard() {
  const rows = await db
    .select()
    .from(players)
    .where(eq(players.active, true))
    .orderBy(desc(players.currentElo))
    .limit(20)

  return (
    <section>
      <div className="section-header font-display">Ladder</div>
      <ol>
        {rows.map((p, i) => (
          <li key={p.id} className="data-row group">
            {/* Rank */}
            <span className="w-6 shrink-0 text-right font-mono nums text-xs text-muted-foreground">
              {i + 1}
            </span>

            {/* Medal accent for top 3 */}
            <span
              className={`w-1 h-5 rounded-full shrink-0 ${
                i === 0
                  ? 'bg-gain'
                  : i === 1
                  ? 'bg-muted-foreground/60'
                  : i === 2
                  ? 'bg-muted-foreground/30'
                  : 'bg-transparent'
              }`}
            />

            <PlayerAvatar name={p.name} photoUrl={p.photoUrl} size={28} />

            <Link
              href={`/players/${p.id}`}
              className="flex-1 min-w-0 leading-tight hover:text-gain transition-colors duration-150"
            >
              <span className="block truncate text-sm font-medium">
                {p.name}
              </span>
              {p.nickname && (
                <span className="block truncate text-xs text-muted-foreground">
                  &ldquo;{p.nickname}&rdquo;
                </span>
              )}
            </Link>

            {/* ELO — the star number */}
            <span className="font-display text-base nums font-semibold tabular-nums shrink-0">
              {p.currentElo}
            </span>
          </li>
        ))}
        {rows.length === 0 && (
          <li className="px-3 py-4 text-sm text-muted-foreground">
            No players yet.
          </li>
        )}
      </ol>
    </section>
  )
}

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
      <h2 className="mb-3 text-lg font-semibold">Leaderboard</h2>
      <ol className="divide-y rounded border">
        {rows.map((p, i) => (
          <li key={p.id} className="flex items-center gap-3 px-3 py-2">
            <span className="w-6 text-right font-mono text-sm tabular-nums text-zinc-500">
              {i + 1}
            </span>
            <PlayerAvatar name={p.name} photoUrl={p.photoUrl} size={28} />
            <Link href={`/players/${p.id}`} className="flex-1 hover:underline">
              {p.name}
              {p.nickname && <span className="ml-2 text-sm text-zinc-500">&quot;{p.nickname}&quot;</span>}
            </Link>
            <span className="font-mono tabular-nums">{p.currentElo}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

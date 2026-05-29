import Link from 'next/link'
import { desc, eq } from 'drizzle-orm'
import { db, players } from '@/lib/db'
import { PlayerAvatar } from '@/components/player-avatar'

export const dynamic = 'force-dynamic'

export default async function PlayersPage() {
  const roster = await db
    .select()
    .from(players)
    .where(eq(players.active, true))
    .orderBy(desc(players.currentElo))

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Players</h1>
        <Link href="/join" className="rounded border px-3 py-1.5 text-sm">
          Create my profile
        </Link>
      </div>
      <ul className="divide-y">
        {roster.map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-3">
            <PlayerAvatar name={p.name} photoUrl={p.photoUrl} />
            <Link href={`/players/${p.id}`} className="flex-1 hover:underline">
              <div className="font-medium">
                {p.name}
                {p.nickname && (
                  <span className="ml-2 text-sm text-zinc-500">&quot;{p.nickname}&quot;</span>
                )}
              </div>
              {p.bio && <div className="text-sm text-zinc-500">{p.bio}</div>}
            </Link>
            <div className="font-mono tabular-nums">{p.currentElo}</div>
          </li>
        ))}
      </ul>
    </main>
  )
}

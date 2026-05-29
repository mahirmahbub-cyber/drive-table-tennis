import { db, players } from '@/lib/db'
import { desc } from 'drizzle-orm'
import { setPlayerActive } from '@/app/actions/players'
import { PlayerAvatar } from '@/components/player-avatar'

export const dynamic = 'force-dynamic'

export default async function AdminPlayersPage() {
  const all = await db.select().from(players).orderBy(desc(players.createdAt))

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">Players (admin)</h1>
      <ul className="divide-y">
        {all.map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-3">
            <PlayerAvatar name={p.name} photoUrl={p.photoUrl} />
            <div className="flex-1">
              <div className="font-medium">{p.name}</div>
              <div className="text-xs text-zinc-500">
                {p.createdVia} · ELO {p.currentElo} · {p.active ? 'active' : 'inactive'}
              </div>
            </div>
            <form
              action={async () => {
                'use server'
                await setPlayerActive(p.id, !p.active)
              }}
            >
              <button type="submit" className="text-sm text-zinc-600 hover:underline">
                {p.active ? 'Deactivate' : 'Reactivate'}
              </button>
            </form>
          </li>
        ))}
      </ul>
    </main>
  )
}

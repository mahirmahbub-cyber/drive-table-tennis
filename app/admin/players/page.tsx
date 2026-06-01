import { db, players } from '@/lib/db'
import { desc } from 'drizzle-orm'
import { setPlayerActive } from '@/app/actions/players'
import { PlayerAvatar } from '@/components/player-avatar'
import { PlayerEditDialog } from '@/components/admin/player-edit-dialog'

export const dynamic = 'force-dynamic'

export default async function AdminPlayersPage() {
  const all = await db.select().from(players).orderBy(desc(players.createdAt))

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 md:px-6">
      <div className="mb-6">
        <p className="font-display uppercase tracking-[0.2em] text-xs text-primary mb-1">Roster</p>
        <h1 className="font-display text-3xl font-bold tracking-tight leading-none">Players</h1>
      </div>

      <ul className="rounded-lg border border-border overflow-hidden bg-card">
        {all.map((p) => (
          <li key={p.id} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0">
            <PlayerAvatar name={p.name} photoUrl={p.photoUrl} />
            <div className="min-w-0 flex-1">
              <div className="font-medium">{p.name}</div>
              <div className="font-mono text-[11px] text-muted-foreground">
                {p.createdVia} · ELO {p.currentElo} · {p.active ? 'active' : 'inactive'}
              </div>
            </div>
            <PlayerEditDialog
              player={{ id: p.id, name: p.name, nickname: p.nickname, bio: p.bio, email: p.email }}
            />
            <form
              action={async () => {
                'use server'
                await setPlayerActive(p.id, !p.active)
              }}
            >
              <button type="submit" className="text-sm text-muted-foreground hover:text-foreground">
                {p.active ? 'Deactivate' : 'Reactivate'}
              </button>
            </form>
          </li>
        ))}
      </ul>
    </main>
  )
}

import { notFound } from 'next/navigation'
import { db, matches, players } from '@/lib/db'
import { and, asc, eq, isNotNull, or } from 'drizzle-orm'
import { PlayerAvatar } from '@/components/player-avatar'
import { EloChart } from '@/components/elo-chart'
import { classifyOpponentTier } from '@/lib/stats'

export const dynamic = 'force-dynamic'

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [player] = await db.select().from(players).where(eq(players.id, id))
  if (!player) notFound()

  const playerMatches = await db
    .select()
    .from(matches)
    .where(
      and(
        isNotNull(matches.playedAt),
        or(eq(matches.playerAId, id), eq(matches.playerBId, id))
      )
    )
    .orderBy(asc(matches.playedAt))

  // ELO chart points
  const points = playerMatches.map((m, i) => {
    const isA = m.playerAId === id
    const elo = isA ? m.eloAAfter! : m.eloBAfter!
    return {
      t: m.playedAt!.getTime(),
      elo,
      label: `#${i + 1}`,
    }
  })

  // W/L overall + by tier
  let wins = 0
  let losses = 0
  const tier = {
    higher: { w: 0, l: 0 },
    similar: { w: 0, l: 0 },
    lower: { w: 0, l: 0 },
  }
  for (const m of playerMatches) {
    const isA = m.playerAId === id
    const iWon = m.winnerId === id
    if (iWon) wins++
    else losses++
    const myEloBefore = isA ? m.eloABefore! : m.eloBBefore!
    const oppEloBefore = isA ? m.eloBBefore! : m.eloABefore!
    const t = classifyOpponentTier(myEloBefore, oppEloBefore)
    if (iWon) tier[t].w++
    else tier[t].l++
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <header className="mb-6 flex items-center gap-4">
        <PlayerAvatar name={player.name} photoUrl={player.photoUrl} size={64} />
        <div>
          <h1 className="text-2xl font-semibold">
            {player.name}
            {player.nickname && (
              <span className="ml-2 text-base font-normal text-zinc-500">
                &quot;{player.nickname}&quot;
              </span>
            )}
          </h1>
          {player.bio && <p className="text-sm text-zinc-500">{player.bio}</p>}
          <p className="mt-1 font-mono tabular-nums">
            ELO {player.currentElo} · {wins}W – {losses}L
          </p>
        </div>
      </header>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold">ELO over time</h2>
        <EloChart data={points} />
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold">By opponent capability</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-500">
              <th className="pb-1">Tier</th>
              <th className="pb-1">Wins</th>
              <th className="pb-1">Losses</th>
              <th className="pb-1">Win %</th>
            </tr>
          </thead>
          <tbody>
            {(['higher', 'similar', 'lower'] as const).map((t) => {
              const { w, l } = tier[t]
              const total = w + l
              const pct = total === 0 ? '—' : `${Math.round((w / total) * 100)}%`
              return (
                <tr key={t} className="border-t">
                  <td className="py-1 capitalize">{t}-rated opponents</td>
                  <td className="py-1 font-mono tabular-nums">{w}</td>
                  <td className="py-1 font-mono tabular-nums">{l}</td>
                  <td className="py-1 font-mono tabular-nums">{pct}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
    </main>
  )
}

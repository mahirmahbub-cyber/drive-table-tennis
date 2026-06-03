import { db, matches, players } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { recordTournamentResult } from '@/app/actions/tournaments'

export const dynamic = 'force-dynamic'

export default async function MatchRecordPage({
  params,
}: {
  params: Promise<{ id: string; matchId: string }>
}) {
  const { matchId } = await params
  const [m] = await db.select().from(matches).where(eq(matches.id, matchId))
  if (!m || !m.playerAId || !m.playerBId) notFound()
  const [a] = await db.select().from(players).where(eq(players.id, m.playerAId))
  const [b] = await db.select().from(players).where(eq(players.id, m.playerBId))

  async function action(formData: FormData) {
    'use server'
    await recordTournamentResult(matchId, formData)
  }

  const existing = (m.setScores as Array<[number, number]> | null) ?? []

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-4 text-xl font-semibold">
        {a.name} vs {b.name}
      </h1>
      <form action={action} className="space-y-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-12 text-sm text-zinc-500">Game {i + 1}</span>
            <input name={`set_${i}_a`} type="number" min={0} max={99} defaultValue={existing[i]?.[0] ?? ''} className="w-20 rounded border px-2 py-1" />
            <span>–</span>
            <input name={`set_${i}_b`} type="number" min={0} max={99} defaultValue={existing[i]?.[1] ?? ''} className="w-20 rounded border px-2 py-1" />
          </div>
        ))}
        <button type="submit" className="rounded bg-black px-4 py-2 text-white">
          Save
        </button>
      </form>
    </main>
  )
}

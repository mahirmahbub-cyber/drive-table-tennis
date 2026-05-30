'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { asc, eq, inArray } from 'drizzle-orm'
import { db, matches, players, type Match } from '@/lib/db'
import { applyMatch } from '@/lib/elo'
import { replayHistory, type HistoryMatch } from '@/lib/elo-recompute'
import { matchLogSchema } from '@/lib/validators'

function inferWinner(sets: Array<[number, number]>): 'A' | 'B' | null {
  let a = 0
  let b = 0
  for (const [sa, sb] of sets) {
    if (sa > sb) a++
    else if (sb > sa) b++
  }
  if (a === b) return null
  return a > b ? 'A' : 'B'
}

export async function logMatch(formData: FormData) {
  const setsRaw: Array<[number, number]> = []
  for (let i = 0; i < 7; i++) {
    const a = formData.get(`set_${i}_a`)
    const b = formData.get(`set_${i}_b`)
    if (a == null || b == null || a === '' || b === '') continue
    setsRaw.push([Number(a), Number(b)])
  }

  const parsed = matchLogSchema.safeParse({
    playerAId: formData.get('playerAId'),
    playerBId: formData.get('playerBId'),
    sets: setsRaw,
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const winner = inferWinner(parsed.data.sets)
  if (!winner) return { error: 'Sets are tied; cannot determine winner' }

  // Read current ratings
  const both = await db
    .select()
    .from(players)
    .where(inArray(players.id, [parsed.data.playerAId, parsed.data.playerBId]))
  const a = both.find((p) => p.id === parsed.data.playerAId)
  const b = both.find((p) => p.id === parsed.data.playerBId)
  if (!a || !b) return { error: 'Player not found' }

  const elo = applyMatch(a.currentElo, b.currentElo, winner)

  await db.transaction(async (tx) => {
    await tx.insert(matches).values({
      playerAId: a.id,
      playerBId: b.id,
      winnerId: winner === 'A' ? a.id : b.id,
      setScores: parsed.data.sets,
      playedAt: new Date(),
      eloABefore: a.currentElo,
      eloBBefore: b.currentElo,
      eloAAfter: elo.eloA,
      eloBAfter: elo.eloB,
    })
    await tx.update(players).set({ currentElo: elo.eloA }).where(eq(players.id, a.id))
    await tx.update(players).set({ currentElo: elo.eloB }).where(eq(players.id, b.id))
  })

  revalidatePath('/')
  revalidatePath('/matches')
  revalidatePath('/players')
  revalidatePath(`/players/${a.id}`)
  revalidatePath(`/players/${b.id}`)
  redirect('/')
}

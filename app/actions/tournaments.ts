'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { and, eq, inArray } from 'drizzle-orm'
import { db, matches, players, tournaments, tournamentEntries } from '@/lib/db'
import { generateBracket } from '@/lib/bracket'
import { rebuildEloFromHistory } from '@/lib/elo-rebuild'
import { tournamentCreateSchema, tournamentRenameSchema } from '@/lib/validators'

export async function createTournament(formData: FormData) {
  const name = String(formData.get('name') ?? '')
  const playerIds = formData.getAll('playerIds').map(String)
  const parsed = tournamentCreateSchema.safeParse({ name, playerIds })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  // Seed by current ELO unless caller passed an explicit seedOrder JSON
  const seedOrderRaw = formData.get('seedOrder')
  let seeded: string[] = parsed.data.playerIds
  if (typeof seedOrderRaw === 'string' && seedOrderRaw.length > 0) {
    seeded = JSON.parse(seedOrderRaw)
  } else {
    const ratings = await db
      .select({ id: players.id, elo: players.currentElo })
      .from(players)
      .where(inArray(players.id, parsed.data.playerIds))
    seeded = parsed.data.playerIds
      .slice()
      .sort(
        (a, b) =>
          (ratings.find((r) => r.id === b)?.elo ?? 0) -
          (ratings.find((r) => r.id === a)?.elo ?? 0)
      )
  }

  const tournamentId = await db.transaction(async (tx) => {
    const [t] = await tx
      .insert(tournaments)
      .values({ name: parsed.data.name, status: 'in_progress', startedAt: new Date() })
      .returning({ id: tournaments.id })
    await tx.insert(tournamentEntries).values(
      seeded.map((playerId, i) => ({
        tournamentId: t.id,
        playerId,
        seed: i + 1,
      }))
    )
    const bracket = generateBracket(seeded)
    await tx.insert(matches).values(
      bracket.map((slot) => ({
        tournamentId: t.id,
        round: slot.round,
        bracketSlot: slot.slot,
        playerAId: slot.playerAId,
        playerBId: slot.playerBId,
        winnerId: slot.winnerId,
        playedAt: slot.winnerId ? new Date() : null,
      }))
    )
    return t.id
  })

  revalidatePath('/tournaments')
  revalidatePath('/admin/tournaments')
  redirect(`/admin/tournaments/${tournamentId}`)
}

export async function recordTournamentResult(matchId: string, formData: FormData) {
  const setsRaw: Array<[number, number]> = []
  for (let i = 0; i < 7; i++) {
    const a = formData.get(`set_${i}_a`)
    const b = formData.get(`set_${i}_b`)
    if (a == null || b == null || a === '' || b === '') continue
    setsRaw.push([Number(a), Number(b)])
  }

  const [m] = await db.select().from(matches).where(eq(matches.id, matchId))
  if (!m || !m.playerAId || !m.playerBId || !m.tournamentId) {
    return { error: 'Match not ready' }
  }

  let aWins = 0, bWins = 0
  for (const [sa, sb] of setsRaw) {
    if (sa > sb) aWins++
    else if (sb > sa) bWins++
  }
  if (setsRaw.length === 0 || aWins === bWins) return { error: 'A tournament match needs a winner.' }
  const winner: 'A' | 'B' = aWins > bWins ? 'A' : 'B'
  const winnerId = winner === 'A' ? m.playerAId : m.playerBId

  await db.transaction(async (tx) => {
    await tx
      .update(matches)
      .set({ winnerId, setScores: setsRaw, playedAt: new Date() })
      .where(eq(matches.id, matchId))

    // Advance (or re-advance) winner into the next-round slot.
    const nextRound = (m.round ?? 0) + 1
    const nextSlot = Math.floor((m.bracketSlot ?? 0) / 2)
    const [next] = await tx
      .select()
      .from(matches)
      .where(
        and(
          eq(matches.tournamentId, m.tournamentId!),
          eq(matches.round, nextRound),
          eq(matches.bracketSlot, nextSlot)
        )
      )
    if (next) {
      const slotKey = (m.bracketSlot ?? 0) % 2 === 0 ? 'playerAId' : 'playerBId'
      await tx
        .update(matches)
        .set({ [slotKey]: winnerId } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .where(eq(matches.id, next.id))
    } else {
      await tx
        .update(tournaments)
        .set({ status: 'completed', completedAt: new Date() })
        .where(eq(tournaments.id, m.tournamentId!))
    }
  })

  // Per-game ELO is rebuilt from the full history so re-scores stay consistent.
  await rebuildEloFromHistory()

  revalidatePath(`/tournaments/${m.tournamentId}`)
  revalidatePath(`/admin/tournaments/${m.tournamentId}`)
  revalidatePath('/players')
  revalidatePath('/')
  return { ok: true }
}

export async function renameTournament(id: string, formData: FormData) {
  const parsed = tournamentRenameSchema.safeParse({ name: formData.get('name') })
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  await db.update(tournaments).set({ name: parsed.data.name }).where(eq(tournaments.id, id))
  revalidatePath('/admin/tournaments')
  revalidatePath(`/admin/tournaments/${id}`)
  revalidatePath('/tournaments')
  return { ok: true }
}

export async function deleteTournament(id: string) {
  // Matches cascade via the FK onDelete: 'cascade'.
  await db.delete(tournaments).where(eq(tournaments.id, id))
  await rebuildEloFromHistory()
  revalidatePath('/admin/tournaments')
  revalidatePath('/tournaments')
  revalidatePath('/players')
  revalidatePath('/')
}

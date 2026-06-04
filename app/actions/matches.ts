'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, gte, inArray, or } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db, matches, players } from '@/lib/db'
import { applyGames } from '@/lib/elo'
import { rebuildEloFromHistory } from '@/lib/elo-rebuild'
import { matchLogSchema } from '@/lib/validators'
import { inferWinnerSide, type SetScore } from '@/lib/match-format'
import { DEDUP_WINDOW_MS, isDuplicateMatch } from '@/lib/match-dedup'
import { rankWithin } from '@/lib/stats-engine'

export type LogResult = {
  aId: string; aName: string; bId: string; bName: string
  winnerId: string | null
  eloABefore: number; eloAAfter: number; eloBBefore: number; eloBAfter: number
  aRankBefore: number; aRankAfter: number; bRankBefore: number; bRankAfter: number
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
    playedAt: formData.get('playedAt'),
    durationSeconds: formData.get('durationSeconds'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  // ── Duplicate guard: identical sitting for this pair within the window ──
  const nowMs = Date.now()
  const recent = await db
    .select({
      playerAId: matches.playerAId,
      playerBId: matches.playerBId,
      setScores: matches.setScores,
      createdAt: matches.createdAt,
    })
    .from(matches)
    .where(
      and(
        gte(matches.createdAt, new Date(nowMs - DEDUP_WINDOW_MS)),
        or(
          and(eq(matches.playerAId, parsed.data.playerAId), eq(matches.playerBId, parsed.data.playerBId)),
          and(eq(matches.playerAId, parsed.data.playerBId), eq(matches.playerBId, parsed.data.playerAId))
        )
      )
    )
  const dup = recent.some((r) =>
    isDuplicateMatch(
      {
        playerAId: r.playerAId,
        playerBId: r.playerBId,
        setScores: (r.setScores as Array<[number, number]>) ?? null,
        createdAtMs: r.createdAt.getTime(),
      },
      { playerAId: parsed.data.playerAId, playerBId: parsed.data.playerBId, sets: parsed.data.sets },
      nowMs
    )
  )
  if (dup) return { error: 'Looks like that match was just logged.' }

  const both = await db
    .select()
    .from(players)
    .where(inArray(players.id, [parsed.data.playerAId, parsed.data.playerBId]))
  const a = both.find((p) => p.id === parsed.data.playerAId)
  const b = both.find((p) => p.id === parsed.data.playerBId)
  if (!a || !b) return { error: 'Player not found' }

  const winner = inferWinnerSide(parsed.data.sets) // null when tied
  const elo = applyGames(a.currentElo, b.currentElo, parsed.data.sets)
  const winnerId = winner === 'A' ? a.id : winner === 'B' ? b.id : null

  const activeElos = await db
    .select({ id: players.id, currentElo: players.currentElo })
    .from(players)
    .where(eq(players.active, true))
  const beforePool = activeElos.map((p) => p.currentElo)
  const afterPool = activeElos.map((p) =>
    p.id === a.id ? elo.eloA : p.id === b.id ? elo.eloB : p.currentElo
  )

  await db.transaction(async (tx) => {
    await tx.insert(matches).values({
      playerAId: a.id,
      playerBId: b.id,
      winnerId,
      setScores: parsed.data.sets,
      playedAt: parsed.data.playedAt ?? new Date(),
      durationSeconds: parsed.data.durationSeconds ?? null,
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
  const result: LogResult = {
    aId: a.id, aName: a.name, bId: b.id, bName: b.name,
    winnerId,
    eloABefore: a.currentElo, eloAAfter: elo.eloA,
    eloBBefore: b.currentElo, eloBAfter: elo.eloB,
    aRankBefore: rankWithin(beforePool, a.currentElo),
    aRankAfter: rankWithin(afterPool, elo.eloA),
    bRankBefore: rankWithin(beforePool, b.currentElo),
    bRankAfter: rankWithin(afterPool, elo.eloB),
  }
  return { ok: true as const, result }
}


export async function editMatch(id: string, formData: FormData) {
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
    playedAt: formData.get('playedAt'),
    durationSeconds: formData.get('durationSeconds'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const winner = inferWinnerSide(parsed.data.sets) // null when tied — allowed for casual
  const winnerId =
    winner === 'A' ? parsed.data.playerAId : winner === 'B' ? parsed.data.playerBId : null

  await db
    .update(matches)
    .set({
      playerAId: parsed.data.playerAId,
      playerBId: parsed.data.playerBId,
      winnerId,
      setScores: parsed.data.sets,
      playedAt: parsed.data.playedAt ?? undefined,
      durationSeconds: parsed.data.durationSeconds ?? null,
    })
    .where(eq(matches.id, id))

  await rebuildEloFromHistory()
  revalidatePath('/')
  revalidatePath('/matches')
  revalidatePath('/players')
  revalidatePath('/admin/history')
  return { ok: true }
}

export async function deleteMatch(id: string) {
  await db.delete(matches).where(eq(matches.id, id))
  await rebuildEloFromHistory()
  revalidatePath('/')
  revalidatePath('/matches')
  revalidatePath('/players')
  revalidatePath('/admin/history')
}

export async function rebuildElo() {
  await rebuildEloFromHistory()
  revalidatePath('/')
  revalidatePath('/players')
}

export type MatchDetail = {
  id: string
  playedAt: Date | null
  durationSeconds: number | null
  setScores: SetScore[]
  aId: string
  aName: string
  bId: string
  bName: string
  winnerId: string | null
  eloABefore: number | null
  eloAAfter: number | null
  eloBBefore: number | null
  eloBAfter: number | null
}

export async function getMatchDetail(id: string): Promise<MatchDetail | null> {
  const a = alias(players, 'a')
  const b = alias(players, 'b')
  const [row] = await db
    .select({
      id: matches.id,
      playedAt: matches.playedAt,
      durationSeconds: matches.durationSeconds,
      setScores: matches.setScores,
      aId: a.id,
      aName: a.name,
      bId: b.id,
      bName: b.name,
      winnerId: matches.winnerId,
      eloABefore: matches.eloABefore,
      eloAAfter: matches.eloAAfter,
      eloBBefore: matches.eloBBefore,
      eloBAfter: matches.eloBAfter,
    })
    .from(matches)
    .innerJoin(a, eq(matches.playerAId, a.id))
    .innerJoin(b, eq(matches.playerBId, b.id))
    .where(eq(matches.id, id))
    .limit(1)
  if (!row) return null
  return { ...row, setScores: (row.setScores as SetScore[]) ?? [] }
}

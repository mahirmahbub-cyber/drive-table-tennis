import Link from 'next/link'
import { db, matches, players } from '@/lib/db'
import { eq, gte, and } from 'drizzle-orm'
import {
  computeFormScore,
  computeAboveExpectationScore,
  type ScoredMatch,
} from '@/lib/stats'
import { PlayerAvatar } from './player-avatar'

async function loadScoredMatches(since: Date): Promise<Map<string, ScoredMatch[]>> {
  const rows = await db
    .select()
    .from(matches)
    .where(gte(matches.playedAt, since))

  const byPlayer = new Map<string, ScoredMatch[]>()
  for (const m of rows) {
    if (!m.playerAId || !m.playerBId || !m.winnerId || !m.playedAt) continue
    const aSide: ScoredMatch = {
      playerId: m.playerAId,
      opponentId: m.playerBId,
      myEloBefore: m.eloABefore ?? 1200,
      myEloAfter: m.eloAAfter ?? 1200,
      opponentEloBefore: m.eloBBefore ?? 1200,
      iWon: m.winnerId === m.playerAId,
      playedAt: m.playedAt,
    }
    const bSide: ScoredMatch = {
      playerId: m.playerBId,
      opponentId: m.playerAId,
      myEloBefore: m.eloBBefore ?? 1200,
      myEloAfter: m.eloBAfter ?? 1200,
      opponentEloBefore: m.eloABefore ?? 1200,
      iWon: m.winnerId === m.playerBId,
      playedAt: m.playedAt,
    }
    for (const s of [aSide, bSide]) {
      if (!byPlayer.has(s.playerId)) byPlayer.set(s.playerId, [])
      byPlayer.get(s.playerId)!.push(s)
    }
  }
  return byPlayer
}

export async function InFormCard({ windowDays = 14 }: { windowDays?: number }) {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000)
  const active = await db
    .select()
    .from(players)
    .where(eq(players.active, true))
  const scoredByPlayer = await loadScoredMatches(since)

  type Row = {
    player: typeof active[number]
    delta: number
    aboveExp: number
    w: number
    l: number
  }
  const rows: Row[] = []
  for (const p of active) {
    const ms = scoredByPlayer.get(p.id) ?? []
    const delta = computeFormScore(ms, p.currentElo, windowDays)
    if (delta == null) continue
    const aboveExp = computeAboveExpectationScore(ms, windowDays)
    const w = ms.filter((m) => m.iWon).length
    const l = ms.length - w
    rows.push({ player: p, delta, aboveExp, w, l })
  }

  const topByDelta = [...rows].sort((a, b) => b.delta - a.delta).slice(0, 5)

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">
        In Form{' '}
        <span className="text-sm font-normal text-zinc-500">
          (last {windowDays} days)
        </span>
      </h2>
      <ol className="divide-y rounded border">
        {topByDelta.map((r) => (
          <li
            key={r.player.id}
            className="flex items-center gap-3 px-3 py-2"
          >
            <PlayerAvatar
              name={r.player.name}
              photoUrl={r.player.photoUrl}
              size={28}
            />
            <Link
              href={`/players/${r.player.id}`}
              className="flex-1 hover:underline"
            >
              {r.player.name}
            </Link>
            <span className="font-mono text-sm tabular-nums text-zinc-500">
              {r.w}-{r.l}
            </span>
            <span
              className={`w-12 text-right font-mono tabular-nums ${
                r.delta >= 0 ? 'text-emerald-600' : 'text-red-600'
              }`}
            >
              {r.delta >= 0 ? '+' : ''}
              {r.delta}
            </span>
          </li>
        ))}
        {topByDelta.length === 0 && (
          <li className="px-3 py-2 text-sm text-zinc-500">
            Nobody has played 3+ matches in the last {windowDays} days yet.
          </li>
        )}
      </ol>
    </section>
  )
}

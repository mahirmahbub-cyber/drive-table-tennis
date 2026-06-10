import Link from 'next/link'
import { db, matches, players } from '@/lib/db'
import { eq, gte } from 'drizzle-orm'
import {
  computeFormScore,
  computeAboveExpectationScore,
  type ScoredMatch,
} from '@/lib/stats'
import { PlayerAvatar } from './player-avatar'
import { DeltaCounter } from './motion/delta-counter'
import { requestNow } from '@/lib/utils'

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
  const since = new Date(requestNow() - windowDays * 24 * 60 * 60 * 1000)
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
      <div className="section-header font-display">
        In Form{' '}
        <span className="normal-case tracking-normal font-sans font-normal text-muted-foreground/70 ml-1">
          {windowDays}d
        </span>
      </div>
      <ol className="rounded-lg border border-border overflow-hidden bg-card">
        {topByDelta.map((r) => (
          <li key={r.player.id} className="data-row">
            <PlayerAvatar
              name={r.player.name}
              photoUrl={r.player.photoUrl}
              size={26}
            />
            <Link
              href={`/players/${r.player.id}`}
              className="flex-1 min-w-0 text-sm font-medium hover:text-primary transition-colors duration-150 truncate"
            >
              {r.player.name}
            </Link>

            {/* W-L record */}
            <span className="font-mono nums text-xs text-muted-foreground shrink-0">
              {r.w}W {r.l}L
            </span>

            {/* ΔELO — counts up, blue for gain, coral for loss */}
            <span
              className={`flex w-14 justify-end text-right font-display text-sm nums font-semibold shrink-0 ${
                r.delta > 0
                  ? 'text-gain'
                  : r.delta < 0
                  ? 'text-loss'
                  : 'text-muted-foreground'
              }`}
            >
              {r.delta > 0 ? '+' : ''}
              <DeltaCounter from={0} to={r.delta} />
            </span>
          </li>
        ))}
        {topByDelta.length === 0 && (
          <li className="px-3 py-3 text-sm text-muted-foreground">
            Nobody has played 3+ matches in the last {windowDays} days yet.
          </li>
        )}
      </ol>
    </section>
  )
}

'use client'

import Link from 'next/link'
import { ViewGameButton } from '@/components/view-game-button'
import { formatScoreForPlayer, gamesWon, type SetScore } from '@/lib/match-format'

export type HistoryRow = {
  id: string
  playedAt: string // ISO
  playerIsA: boolean
  iWon: boolean
  opponentId: string
  opponentName: string
  sets: SetScore[]
  eloDelta: number | null
}

export function PlayerGamesHistory({ rows }: { rows: HistoryRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No races yet — challenge someone and log your first game.</p>
  }
  return (
    <ul className="rounded-lg border border-border overflow-hidden bg-card">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center gap-3 px-3 py-2.5 text-sm border-b border-border last:border-0">
          <span className="w-14 shrink-0 font-mono text-[11px] text-muted-foreground">
            {new Date(r.playedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
          {(() => {
            const { a, b } = gamesWon(r.sets)
            const mine = r.playerIsA ? a : b
            const theirs = r.playerIsA ? b : a
            const tone = mine > theirs ? 'bg-gain/15 text-gain' : mine < theirs ? 'bg-loss/15 text-loss' : 'bg-muted text-muted-foreground'
            return (
              <span className={`flex h-5 min-w-[2.25rem] shrink-0 items-center justify-center rounded px-1 text-[11px] font-bold nums ${tone}`}>
                {mine}–{theirs}
              </span>
            )
          })()}
          <Link href={`/players/${r.opponentId}`} className="flex-1 truncate text-foreground hover:text-primary">
            vs {r.opponentName}
          </Link>
          <span className="shrink-0 font-mono nums text-xs text-muted-foreground">
            {formatScoreForPlayer(r.sets, r.playerIsA)}
          </span>
          {r.eloDelta != null && (
            <span className={`w-11 shrink-0 text-right font-mono nums text-xs font-semibold ${
              r.eloDelta >= 0 ? 'text-gain' : 'text-loss'
            }`}>
              {r.eloDelta >= 0 ? '+' : '−'}{Math.abs(r.eloDelta)}
            </span>
          )}
          <ViewGameButton id={r.id} />
        </li>
      ))}
    </ul>
  )
}

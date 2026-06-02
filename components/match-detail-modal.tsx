'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getMatchDetail, type MatchDetail } from '@/app/actions/matches'
import { setsWon, inferWinnerSide, playerEloDelta } from '@/lib/match-format'
import { formatDuration } from '@/lib/stats'

export function MatchDetailModal({
  id, open, onOpenChange,
}: { id: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [detail, setDetail] = useState<MatchDetail | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    getMatchDetail(id).then((d) => {
      if (!cancelled) { setDetail(d); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [open, id])

  const winnerSide = detail ? inferWinnerSide(detail.setScores) : null
  const tally = detail ? setsWon(detail.setScores) : { a: 0, b: 0 }
  const aWon = detail ? detail.winnerId === detail.aId : false
  const deltaA = detail ? playerEloDelta(detail, true) : null
  const deltaB = detail ? playerEloDelta(detail, false) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            {loading || !detail ? 'Game' : (
              <span>
                <span className={aWon ? 'text-foreground' : 'text-muted-foreground'}>{detail.aName}</span>
                <span className="text-muted-foreground"> vs </span>
                <span className={!aWon ? 'text-foreground' : 'text-muted-foreground'}>{detail.bName}</span>
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!loading && !detail && <p className="text-sm text-muted-foreground">Match not found.</p>}

        {detail && (
          <div className="space-y-4">
            <p className="font-mono text-xs text-muted-foreground">
              {detail.playedAt?.toLocaleString(undefined, {
                day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
              })}
            </p>

            <div className="flex gap-2">
              {detail.setScores.map(([sa, sb], i) => {
                const setToA = sa > sb
                return (
                  <div key={i} className="flex-1 rounded-lg border border-border p-2 text-center">
                    <div className="font-display text-[9px] uppercase tracking-widest text-muted-foreground">
                      Set {i + 1}
                    </div>
                    <div className="mt-1 font-mono nums text-lg font-bold">
                      <span className={setToA ? 'text-foreground' : 'text-muted-foreground'}>{sa}</span>
                      –
                      <span className={!setToA ? 'text-foreground' : 'text-muted-foreground'}>{sb}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            <p className="text-center text-sm">
              <b className="text-primary">
                {winnerSide === 'A' ? detail.aName : detail.bName} wins
                {detail.setScores.length > 1
                  ? ` ${winnerSide === 'A' ? tally.a : tally.b}–${winnerSide === 'A' ? tally.b : tally.a}`
                  : ` ${detail.setScores[0]?.[0]}–${detail.setScores[0]?.[1]}`}
              </b>
            </p>

            <div className="flex gap-3">
              {[
                { name: detail.aName, id: detail.aId, before: detail.eloABefore, after: detail.eloAAfter, delta: deltaA },
                { name: detail.bName, id: detail.bId, before: detail.eloBBefore, after: detail.eloBAfter, delta: deltaB },
              ].map((p) => (
                <Link key={p.id} href={`/players/${p.id}`}
                  className="flex-1 rounded-lg border border-border p-2.5 transition-colors hover:bg-secondary">
                  <div className="text-sm">{p.name}</div>
                  {p.delta != null && (
                    <>
                      <div className={`font-mono nums font-bold ${p.delta >= 0 ? 'text-gain' : 'text-loss'}`}>
                        {p.delta >= 0 ? '+' : '−'}{Math.abs(p.delta)}
                      </div>
                      <div className="font-mono text-[11px] text-muted-foreground">{p.before} → {p.after}</div>
                    </>
                  )}
                </Link>
              ))}
            </div>

            {detail.durationSeconds ? (
              <p className="text-xs text-muted-foreground">⏱ {formatDuration(detail.durationSeconds)}</p>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

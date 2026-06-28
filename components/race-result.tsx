'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowUp } from 'lucide-react'
import { FlipNumber } from '@/components/flip-number'
import { mogCaption } from '@/lib/banter'
import type { LogResult } from '@/app/actions/matches'

function LightsOut({ onDone }: { onDone: () => void }) {
  const [lit, setLit] = useState(0)
  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) { onDone(); return }
    const timers: ReturnType<typeof setTimeout>[] = []
    for (let i = 1; i <= 5; i++) timers.push(setTimeout(() => setLit(i), i * 140))
    timers.push(setTimeout(onDone, 5 * 140 + 260))
    return () => timers.forEach(clearTimeout)
  }, [onDone])
  return (
    <div className="flex items-center justify-center gap-2 py-6" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={`h-4 w-4 rounded-full transition-colors duration-150 ${i < lit ? 'bg-loss' : 'bg-muted'}`}
        />
      ))}
    </div>
  )
}

function RankBadge({ before, after }: { before: number; after: number }) {
  if (after >= before) return null
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-gain/10 px-2 py-0.5 font-display text-xs font-bold text-gain">
      <ArrowUp className="h-3.5 w-3.5" /> P{before} → P{after}
    </span>
  )
}

export function RaceResult({ result, onLogAnother }: { result: LogResult; onLogAnother?: () => void }) {
  const [revealed, setRevealed] = useState(false)

  // Auto-dismiss after the reveal: 3s countdown, then call onLogAnother. The ref
  // keeps the latest callback out of the effect deps so the timer isn't reset.
  const onDoneRef = useRef(onLogAnother)
  useEffect(() => {
    onDoneRef.current = onLogAnother
  }, [onLogAnother])
  const [secondsLeft, setSecondsLeft] = useState(5)
  useEffect(() => {
    if (!revealed || !onDoneRef.current) return
    if (secondsLeft <= 0) { onDoneRef.current(); return }
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [revealed, secondsLeft])

  const aWon = result.winnerId === result.aId
  const bWon = result.winnerId === result.bId

  if (!revealed) {
    return (
      <div className="text-center">
        <LightsOut onDone={() => setRevealed(true)} />
      </div>
    )
  }

  return (
    <div className="space-y-4 text-center">
      <div className="font-display text-xs uppercase tracking-widest text-primary">Result</div>
      {result.winnerId && (
        <div className="font-display text-base font-semibold">
          {mogCaption(
            result.winnerId === result.aId ? result.aName : result.bName,
            result.winnerId === result.aId ? result.bName : result.aName,
          )}
        </div>
      )}

      <div className="flex items-start justify-center gap-6">
        {[
          { name: result.aName, won: aWon, before: result.eloABefore, after: result.eloAAfter, rb: result.aRankBefore, ra: result.aRankAfter },
          { name: result.bName, won: bWon, before: result.eloBBefore, after: result.eloBAfter, rb: result.bRankBefore, ra: result.bRankAfter },
        ].map((p) => {
          const delta = p.after - p.before
          return (
            <div key={p.name} className="flex flex-col items-center gap-1.5">
              <div className="panel p-2">
                <FlipNumber from={p.before} to={p.after} durationMs={1000} />
              </div>
              <div className="max-w-[170px] text-center font-display text-[11px] uppercase leading-tight tracking-widest text-muted-foreground">
                {p.name}
              </div>
              <div className={`font-display text-base font-bold nums ${delta >= 0 ? 'text-gain' : 'text-loss'}`}>
                {delta >= 0 ? '+' : '−'}{Math.abs(delta)}
              </div>
              <RankBadge before={p.rb} after={p.ra} />
              {p.won && (
                <span className="rounded-full bg-brass px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-widest text-ink">
                  Winner
                </span>
              )}
            </div>
          )
        })}
      </div>

      {onLogAnother && (
        <button
          type="button"
          onClick={onLogAnother}
          className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Log another <span className="nums opacity-80">· {secondsLeft}</span>
        </button>
      )}
    </div>
  )
}

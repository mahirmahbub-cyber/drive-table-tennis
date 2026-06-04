'use client'

import { useEffect, useState } from 'react'
import { ArrowUp } from 'lucide-react'
import { AnimatedDial } from '@/components/animated-dial'
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
  const aWon = result.winnerId === result.aId
  const bWon = result.winnerId === result.bId

  return (
    <div className="text-center">
      {!revealed ? (
        <LightsOut onDone={() => setRevealed(true)} />
      ) : (
        <div className="space-y-5">
          <div className="font-display text-xs uppercase tracking-widest text-primary">Result</div>
          {result.winnerId && (
            <div className="font-display text-sm font-semibold">
              {mogCaption(
                result.winnerId === result.aId ? result.aName : result.bName,
                result.winnerId === result.aId ? result.bName : result.aName,
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            {[
              { name: result.aName, won: aWon, before: result.eloABefore, after: result.eloAAfter, rb: result.aRankBefore, ra: result.aRankAfter },
              { name: result.bName, won: bWon, before: result.eloBBefore, after: result.eloBAfter, rb: result.bRankBefore, ra: result.bRankAfter },
            ].map((p) => {
              const delta = p.after - p.before
              return (
                <div key={p.name} className="flex flex-col items-center gap-2">
                  <AnimatedDial from={p.before} to={p.after} label={p.name} size="lg" />
                  <div className={`font-display text-sm font-bold nums ${delta >= 0 ? 'text-gain' : 'text-loss'}`}>
                    {delta >= 0 ? '+' : '−'}{Math.abs(delta)}
                  </div>
                  <RankBadge before={p.rb} after={p.ra} />
                  {p.won && <div className="font-display text-[10px] uppercase tracking-widest text-primary">Winner</div>}
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
              Log another
            </button>
          )}
        </div>
      )}
    </div>
  )
}

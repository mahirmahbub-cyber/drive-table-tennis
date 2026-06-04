import { Trophy, Flame, Zap, TrendingUp } from 'lucide-react'
import type { HomeData } from '@/lib/home-data'
import type { Mover } from '@/lib/stats-engine'
import {
  upsetOfWeek, demolitionOfWeek, matchMargin,
} from '@/lib/stats-engine'
import { SUPERLATIVE_LABELS } from '@/lib/banter'

const WINDOW_DAYS = 7

export function SuperlativesStrip({ data, now, movers }: { data: HomeData; now: number; movers: Mover[] }) {
  const since = new Date(now - WINDOW_DAYS * 86400 * 1000)
  const name = (id: string | null | undefined) => (id ? data.nameById.get(id)?.name : undefined) ?? '—'

  const topMover = movers[0]
  const upset = upsetOfWeek(data.engineMatches, since)
  const demo = demolitionOfWeek(data.engineMatches, since)

  const cards = [
    topMover && topMover.delta > 0
      ? { icon: TrendingUp, label: SUPERLATIVE_LABELS.mostImproved, value: name(topMover.playerId), sub: `+${topMover.delta} ELO` }
      : null,
    upset
      ? { icon: Zap, label: SUPERLATIVE_LABELS.upset, value: name(upset.winnerId), sub: `mogged ${name(upset.winnerId === upset.playerAId ? upset.playerBId : upset.playerAId)}` }
      : null,
    demo
      ? { icon: Flame, label: SUPERLATIVE_LABELS.demolition, value: name(demo.winnerId), sub: `cooked ${name(demo.winnerId === demo.playerAId ? demo.playerBId : demo.playerAId)} by ${matchMargin(demo)}` }
      : null,
  ].filter(Boolean) as { icon: typeof Trophy; label: string; value: string; sub: string }[]

  if (cards.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/50 px-4 py-6 text-center text-sm text-muted-foreground">
        No races this week yet — <span className="text-primary">log a game</span> to kick off the week.
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-1.5 font-display text-[10px] uppercase tracking-widest text-muted-foreground">
            <c.icon className="h-3.5 w-3.5 text-primary" />
            {c.label}
          </div>
          <div className="mt-1.5 truncate font-display text-lg font-bold">{c.value}</div>
          <div className="truncate text-xs text-muted-foreground">{c.sub}</div>
        </div>
      ))}
    </div>
  )
}

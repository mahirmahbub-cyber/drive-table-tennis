import { TrendingUp, Zap, Flame, Swords, Crown } from 'lucide-react'
import type { HomeData } from '@/lib/home-data'
import type { Mover } from '@/lib/stats-engine'
import { SectionHeading } from '@/components/scoreboard'
import {
  demolitionOfWeek,
  matchMargin,
  upsetOfWeek,
  mostPlayedRivalry,
  headToHead,
  lossesInWindow,
} from '@/lib/stats-engine'
import { SUPERLATIVE_LABELS } from '@/lib/banter'

const WINDOW_DAYS = 7

// Big Money Langford — the house villain. This card is always about him,
// regardless of where he currently sits on the ladder.
const LANGFORD_ID = 'ee90d173-7d43-4c7c-91f4-b6ddf5da1a2d'

export function ThisWeek({ data, now, movers }: { data: HomeData; now: number; movers: Mover[] }) {
  const since = new Date(now - WINDOW_DAYS * 86400 * 1000)
  const name = (id: string | null | undefined) => (id ? data.nameById.get(id)?.name : undefined) ?? '—'

  const demo = demolitionOfWeek(data.engineMatches, since)
  const upset = upsetOfWeek(data.engineMatches, since)
  const topMover = movers[0]
  const rivalry = mostPlayedRivalry(data.engineMatches, since)

  // How many times Big Money Langford was toppled this week.
  const langford = data.nameById.get(LANGFORD_ID)
  const langfordBeaten = langford ? lossesInWindow(data.engineMatches, LANGFORD_ID, since) : 0

  // Prominent highlights — the human-interest superlatives. Each card shows
  // an icon + label, the player's name, and a short descriptor line.
  const highlights = [
    topMover && topMover.delta > 0
      ? { icon: TrendingUp, label: SUPERLATIVE_LABELS.mostImproved, value: name(topMover.playerId), sub: `+${topMover.delta} ELO` }
      : null,
    upset
      ? {
        icon: Zap,
        label: SUPERLATIVE_LABELS.upset,
        value: name(upset.winnerId),
        sub: `mogged ${name(upset.winnerId === upset.playerAId ? upset.playerBId : upset.playerAId)}`,
      }
      : null,
    demo
      ? {
        icon: Flame,
        label: SUPERLATIVE_LABELS.demolition,
        value: name(demo.winnerId),
        sub: `cooked ${name(demo.winnerId === demo.playerAId ? demo.playerBId : demo.playerAId)} by ${matchMargin(demo)}`,
      }
      : null,
    rivalry
      ? (() => {
        const h2h = headToHead(data.engineMatches, rivalry.p1, rivalry.p2)
        const leadP1 = h2h.p1Wins >= h2h.p2Wins
        const ldr = leadP1 ? rivalry.p1 : rivalry.p2
        const opponent = leadP1 ? rivalry.p2 : rivalry.p1
        const lw = leadP1 ? h2h.p1Wins : h2h.p2Wins
        const ow = leadP1 ? h2h.p2Wins : h2h.p1Wins
        return { icon: Swords, label: 'Rivalry', value: name(ldr), sub: `${lw}–${ow} vs ${name(opponent)}` }
      })()
      : null,
    langford
      ? {
        icon: Crown,
        label: `${langford.name} beaten`,
        value: `${langfordBeaten}x`,
        sub: langfordBeaten > 0 ? 'get rekt scrub' : 'untouched',
      }
      : null,
  ].filter(Boolean) as { icon: typeof TrendingUp; label: string; value: string; sub: string }[]

  return (
    <section>
      <SectionHeading kicker="7 Days" surface="cream">This Week</SectionHeading>

      {highlights.length > 0 && (
        <div className="grid gap-2">
          {highlights.map((h) => (
            <div key={h.label} className="rounded-xl border border-border bg-card px-3.5 py-2">
              <div className="flex items-center gap-1.5 font-display text-[10px] uppercase tracking-widest text-muted-foreground">
                <h.icon className="h-3.5 w-3.5 text-primary" />
                {h.label}
              </div>
              <div className="mt-1 truncate font-display text-base font-semibold leading-tight">{h.value}</div>
              <div className="mt-1 truncate text-xs text-muted-foreground">{h.sub}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

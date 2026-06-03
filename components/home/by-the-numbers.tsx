import type { HomeData } from '@/lib/home-data'
import { participation, demolitionOfWeek, matchMargin } from '@/lib/stats-engine'
import { formatDuration } from '@/lib/stats'

const WINDOW_DAYS = 7

export function ByTheNumbers({ data, now }: { data: HomeData; now: number }) {
  const since = new Date(now - WINDOW_DAYS * 86400 * 1000)
  const part = participation(data.engineMatches, data.activePlayers.map((p) => p.id), since)
  const demo = demolitionOfWeek(data.engineMatches, since)

  const stats = [
    { label: 'Games this week', value: String(part.games) },
    { label: 'Court time', value: part.totalCourtSeconds > 0 ? formatDuration(part.totalCourtSeconds) : '—' },
    { label: 'Turnout', value: `${part.rate}%` },
    { label: 'Biggest margin', value: demo ? `${matchMargin(demo)} pts` : '—' },
  ]

  return (
    <section>
      <div className="section-header font-display">By the Numbers <span className="normal-case tracking-normal font-sans font-normal text-muted-foreground/70 ml-1">7d</span></div>
      <div className="grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card px-4 py-3">
            <div className="font-display uppercase tracking-widest text-[10px] text-muted-foreground">{s.label}</div>
            <div className="mt-0.5 font-display text-xl font-semibold nums">{s.value}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

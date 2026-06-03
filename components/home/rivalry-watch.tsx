import { PlayerAvatar } from '@/components/player-avatar'
import type { HomeData } from '@/lib/home-data'
import { mostPlayedRivalry, headToHead } from '@/lib/stats-engine'

const WINDOW_DAYS = 7

export function RivalryWatch({ data, now }: { data: HomeData; now: number }) {
  const since = new Date(now - WINDOW_DAYS * 86400 * 1000)
  const r = mostPlayedRivalry(data.engineMatches, since)
  if (!r) return null
  const p1 = data.nameById.get(r.p1)
  const p2 = data.nameById.get(r.p2)
  if (!p1 || !p2) return null
  const h2h = headToHead(data.engineMatches, r.p1, r.p2)

  return (
    <section>
      <div className="section-header font-display">Rivalry of the Week</div>
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 min-w-0">
          <PlayerAvatar name={p1.name} photoUrl={p1.photoUrl} size={32} />
          <span className="truncate text-sm font-medium">{p1.name}</span>
        </div>
        <div className="shrink-0 text-center">
          <div className="font-display text-xl font-bold nums">{h2h.p1Wins}–{h2h.p2Wins}</div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{r.games} this week</div>
        </div>
        <div className="flex items-center gap-2 min-w-0 justify-end">
          <span className="truncate text-sm font-medium">{p2.name}</span>
          <PlayerAvatar name={p2.name} photoUrl={p2.photoUrl} size={32} />
        </div>
      </div>
    </section>
  )
}

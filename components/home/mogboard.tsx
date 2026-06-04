import { PlayerAvatar } from '@/components/player-avatar'
import { headToHead } from '@/lib/stats-engine'
import type { HomePlayer } from '@/lib/home-data'
import type { EngineMatch } from '@/lib/stats-engine'

export function Mogboard({ players, matches }: { players: HomePlayer[]; matches: EngineMatch[] }) {
  const ranked = [...players].sort((a, b) => b.currentElo - a.currentElo)
  if (ranked.length < 2) {
    return <p className="text-sm text-muted-foreground">Need at least two players on the grid to start mogging.</p>
  }
  const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-background p-2 text-left font-display text-[10px] uppercase tracking-widest text-muted-foreground">vs →</th>
            {ranked.map((c) => (
              <th key={c.id} className="p-2 font-mono text-[11px] text-muted-foreground" title={c.name}>{initials(c.name)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ranked.map((r) => (
            <tr key={r.id} className="border-t border-border">
              <th className="sticky left-0 z-10 bg-background p-2 text-left">
                <span className="flex items-center gap-2">
                  <PlayerAvatar name={r.name} photoUrl={r.photoUrl} size={22} />
                  <span className="truncate text-xs font-medium max-w-[120px]">{r.name}</span>
                </span>
              </th>
              {ranked.map((c) => {
                if (c.id === r.id) return <td key={c.id} className="p-2 text-center text-muted-foreground/30">—</td>
                const h = headToHead(matches, r.id, c.id)
                const total = h.p1Wins + h.p2Wins
                const cls = total === 0 ? 'text-muted-foreground/40' : h.p1Wins > h.p2Wins ? 'text-gain font-semibold' : h.p1Wins < h.p2Wins ? 'text-loss' : 'text-muted-foreground'
                return (
                  <td key={c.id} className="p-2 text-center font-mono nums text-xs">
                    <span className={cls}>{total === 0 ? '·' : `${h.p1Wins}–${h.p2Wins}`}</span>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

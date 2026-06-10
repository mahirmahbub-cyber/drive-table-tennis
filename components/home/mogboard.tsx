'use client'

import { useRef, useState } from 'react'
import { PlayerAvatar } from '@/components/player-avatar'
import { headToHead } from '@/lib/stats-engine'
import { H2hPanel, type PairSelection } from '@/components/home/h2h-panel'
import type { HomePlayer } from '@/lib/home-data'
import type { EngineMatch } from '@/lib/stats-engine'

export function Mogboard({ players, matches }: { players: HomePlayer[]; matches: EngineMatch[] }) {
  const [pair, setPair] = useState<PairSelection>({ p1Id: null, p2Id: null })
  const panelRef = useRef<HTMLDivElement>(null)
  const ranked = [...players].sort((a, b) => b.currentElo - a.currentElo)
  if (ranked.length < 2) {
    return <p className="text-sm text-muted-foreground">Need at least two players on the grid to start mogging.</p>
  }
  const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()

  function selectCell(rowId: string, colId: string) {
    setPair({ p1Id: rowId, p2Id: colId })
    setTimeout(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 0)
  }

  return (
    <div>
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
                  const isSelected = pair.p1Id === r.id && pair.p2Id === c.id
                  return (
                    <td key={c.id} className="p-0">
                      <button
                        type="button"
                        onClick={() => selectCell(r.id, c.id)}
                        title={`${r.name} vs ${c.name}`}
                        aria-pressed={isSelected}
                        className={`w-full p-2 text-center font-mono nums text-xs transition-colors hover:bg-secondary focus:outline-none focus-visible:ring-1 focus-visible:ring-ring ${isSelected ? 'bg-secondary ring-1 ring-inset ring-primary' : ''}`}
                      >
                        <span className={cls}>{total === 0 ? '·' : `${h.p1Wins}–${h.p2Wins}`}</span>
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div ref={panelRef} className="mt-6 scroll-mt-4">
        <H2hPanel players={ranked} matches={matches} pair={pair} onPairChange={setPair} />
      </div>
    </div>
  )
}

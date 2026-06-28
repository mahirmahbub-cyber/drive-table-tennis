import Link from 'next/link'
import { PlayerAvatar } from './player-avatar'
import { AnimatedRow } from './motion/animated-row'
import { TitleBadge } from '@/components/title-badge'
import { Panel } from '@/components/scoreboard'
import { ArrowUp, ArrowDown } from 'lucide-react'
import type { HomePlayer, PlayerWL } from '@/lib/home-data'
import type { Mover } from '@/lib/stats-engine'
import type { Title } from '@/lib/titles'

export function Leaderboard({ players, movers, wlById, titles }: { players: HomePlayer[]; movers: Mover[]; wlById: Map<string, PlayerWL>; titles?: Map<string, Title> }) {
  const ranked = [...players].sort((a, b) => b.currentElo - a.currentElo).slice(0, 20)
  const leaderElo = ranked[0]?.currentElo ?? 0
  const moveById = new Map(movers.map((m) => [m.playerId, m.delta] as const))

  return (
    <Panel kicker="Active Grid" title="Starting Grid" rule className="overflow-hidden pb-0 sm:pb-0">
      {/* Column labels — aligned to match data row right-hand columns */}
      <div className="flex items-center justify-end gap-4 px-3.5 sm:px-4 pb-1.5 text-[10px] text-panel-muted">
        <span className="hidden w-14 text-right sm:block">W–L</span>
        <span className="hidden w-12 text-right sm:block">7d</span>
        <span className="w-10 text-right">Rating</span>
        <span className="hidden w-12 text-right sm:block">Gap</span>
      </div>
      <ol className="-mx-3.5 sm:-mx-4">
        {ranked.map((p, i) => {
          const pole = i === 0
          const gap = leaderElo - p.currentElo
          const mv = moveById.get(p.id) ?? 0
          return (
            <AnimatedRow key={p.id} layoutId={`leader-${p.id}`} className={`group flex items-center gap-3 px-3.5 sm:px-4 py-1.5 border-b border-panel-line last:border-0 ${pole ? 'bg-white/5' : ''}`}>
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-display text-sm font-bold nums ${pole ? 'bg-primary text-primary-foreground' : i <= 2 ? 'bg-panel-raised text-brass' : 'bg-panel-line text-panel-muted'}`}>{i + 1}</span>
              <PlayerAvatar name={p.name} photoUrl={p.photoUrl} size={28} />
              <Link href={`/players/${p.id}`} className="flex-1 min-w-0 leading-tight transition-colors duration-150 hover:text-primary">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-panel-foreground">{p.name}</span>
                  {titles?.get(p.id) ? (
                    <TitleBadge title={titles.get(p.id)!} />
                  ) : pole ? (
                    <span className="rounded-sm bg-brass/18 px-1.5 py-0.5 font-display text-[9px] font-bold uppercase tracking-wider text-brass">Pole</span>
                  ) : null}
                </span>
                {p.nickname && <span className="block truncate text-xs text-panel-muted">&ldquo;{p.nickname}&rdquo;</span>}
              </Link>
              {(() => { const wl = wlById.get(p.id); return (
                <span className="hidden w-14 shrink-0 text-right font-mono text-xs nums text-panel-muted sm:block">
                  {wl ? `${wl.wins}–${wl.losses}` : '—'}
                </span>
              ) })()}
              <span className={`hidden w-12 shrink-0 items-center justify-end gap-0.5 font-mono text-xs nums sm:flex ${mv > 0 ? 'text-gain-strong' : mv < 0 ? 'text-loss-strong' : 'text-panel-muted'}`}>
                {mv > 0 && <ArrowUp className="h-3 w-3" />}
                {mv < 0 && <ArrowDown className="h-3 w-3" />}
                {mv !== 0 ? Math.abs(mv) : '·'}
              </span>
              <span className="w-10 shrink-0 text-right font-display text-base font-semibold nums text-panel-foreground">{p.currentElo}</span>
              <span className="hidden w-12 shrink-0 text-right font-mono text-xs nums text-panel-muted sm:block">{pole ? '—' : `-${gap}`}</span>
            </AnimatedRow>
          )
        })}
        {ranked.length === 0 && <li className="px-3.5 sm:px-4 py-4 text-sm text-panel-muted">The grid is empty — be the first to join.</li>}
      </ol>
    </Panel>
  )
}

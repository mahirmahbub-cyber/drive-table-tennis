'use client'

import { FlipCard } from './flip-card'
import { PlayerLabelSelect } from './player-label-select'
import { gamePoint as calcGamePoint, gameWonBy, type LiveGame } from '@/lib/flip-pad'

type PlayerOption = { id: string; name: string; nickname: string | null; currentElo: number }

function firstNameFor(players: PlayerOption[], id: string, fallback: string) {
  const p = players.find((x) => x.id === id)
  return p ? p.name.split(' ')[0] : fallback
}

function TargetSelector({ target, onTarget }: { target: number; onTarget: (n: number) => void }) {
  return (
    <div className="flex w-full items-center justify-center gap-2 ">
      <span className="font-display text-[10px] uppercase tracking-widest text-panel-muted">First to</span>
      <div className="inline-flex items-center gap-0.5 rounded-lg bg-black/25 p-0.5">
        {[7, 11, 15, 21].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`first to ${n} points`}
            aria-pressed={target === n}
            onClick={() => onTarget(n)}
            className={`min-w-[30px] rounded-md px-2 py-1 font-mono nums text-sm font-bold transition-colors ${target === n
              ? 'bg-brass text-ink shadow-sm'
              : 'text-panel-muted hover:text-white'
              }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

function GamePointTag({ won }: { won: boolean }) {
  return (
    <span className="pointer-events-none absolute left-1/2 top-0.5 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-brass px-1.5 py-px text-[8px] font-bold uppercase tracking-[0.1em] text-ink shadow">
      {won ? 'Game won' : 'Game point'}
    </span>
  )
}

export function FlipPad({
  players,
  aId,
  bId,
  onA,
  onB,
  current,
  onCurrent,
  tallyA,
  tallyB,
  target,
  onTarget,
}: {
  players: PlayerOption[]
  aId: string
  bId: string
  onA: (id: string) => void
  onB: (id: string) => void
  current: LiveGame
  onCurrent: (g: LiveGame) => void
  tallyA: number
  tallyB: number
  target: number
  onTarget: (n: number) => void
}) {
  const [a, b] = current
  const leadA = a !== null && (b === null || a > b)
  const leadB = b !== null && (a === null || b > a)
  const gp = calcGamePoint(current, target)
  // A game can be "won" (target reached, 2-point lead) — that supersedes "game point".
  const wonSide = a !== null && b !== null ? gameWonBy([a, b], target) : null
  const tagA = wonSide === 'A' ? 'won' : gp.a ? 'point' : null
  const tagB = wonSide === 'B' ? 'won' : gp.b ? 'point' : null

  return (
    <div className="flex flex-col items-center gap-3 rounded-[13px] bg-linear-to-b from-panel-raised to-panel px-3 pt-4 pb-4 shadow-[0_5px_12px_rgba(0,0,0,0.22)]">
      <div className="grid grid-cols-[auto_auto_auto] justify-center justify-items-center gap-x-3 gap-y-1.5">
        {/* Row 1 — player pickers */}
        <PlayerLabelSelect players={players} value={aId} exclude={bId} onChange={onA} />
        <span aria-hidden />
        <PlayerLabelSelect players={players} value={bId} exclude={aId} onChange={onB} />

        {/* Row 2 — the flippers define the row height; the games block stretches to match it */}
        <div className="relative" title={tagA ? (tagA === 'won' ? 'Game won — tap “+ next game”' : 'Game point — one more point wins the game') : undefined}>
          <FlipCard
            value={a}
            name={firstNameFor(players, aId, 'Player A')}
            lead={leadA}
            gamePoint={gp.a}
            onChange={(v) => onCurrent([v, current[1]])}
          />
          {tagA && <GamePointTag won={tagA === 'won'} />}
        </div>

        <div className="flex flex-col items-center justify-center gap-0.5 self-stretch text-center text-[9px] uppercase tracking-wider text-panel-muted">
          <span>Games</span>
          <span className="font-mono nums text-[22px] font-bold leading-none text-panel-foreground">
            {tallyA}–{tallyB}
          </span>
        </div>

        <div className="relative" title={tagB ? (tagB === 'won' ? 'Game won — tap “+ next game”' : 'Game point — one more point wins the game') : undefined}>
          <FlipCard
            value={b}
            name={firstNameFor(players, bId, 'Player B')}
            lead={leadB}
            gamePoint={gp.b}
            onChange={(v) => onCurrent([current[0], v])}
          />
          {tagB && <GamePointTag won={tagB === 'won'} />}
        </div>
      </div>

      <TargetSelector target={target} onTarget={onTarget} />
    </div>
  )
}

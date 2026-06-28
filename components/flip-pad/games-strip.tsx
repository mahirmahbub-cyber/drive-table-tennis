'use client'

import { useState } from 'react'
import { gameWonBy, type BankedGame } from '@/lib/flip-pad'

function Chip({
  game,
  target,
  editing,
  onStartEdit,
  onDoneEdit,
  onEdit,
  onRemove,
}: {
  game: BankedGame
  target: number
  editing: boolean
  onStartEdit: () => void
  onDoneEdit: () => void
  onEdit: (g: BankedGame) => void
  onRemove: () => void
}) {
  const won = gameWonBy(game, target)
  const clamp = (n: number) => Math.max(0, Math.min(99, n))

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border-2 border-brass-light bg-card px-2 py-1 font-mono nums text-sm font-bold">
        <input
          type="number"
          aria-label="game score left"
          value={game[0]}
          onChange={(e) => onEdit([clamp(Number(e.target.value || 0)), game[1]])}
          className="w-8 bg-transparent text-center focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span className="text-muted-foreground">–</span>
        <input
          type="number"
          aria-label="game score right"
          value={game[1]}
          onChange={(e) => onEdit([game[0], clamp(Number(e.target.value || 0))])}
          className="w-8 bg-transparent text-center focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button type="button" aria-label="done editing game" onClick={onDoneEdit} className="px-1 text-primary">
          ✓
        </button>
        <button type="button" aria-label="remove game" onClick={onRemove} className="px-1 text-muted-foreground hover:text-loss">
          ×
        </button>
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={onStartEdit}
      className="rounded-md border border-input bg-secondary/60 px-2.5 py-1 font-mono nums text-sm font-bold"
    >
      <span className={won === 'A' ? 'text-primary' : ''}>{game[0]}</span>
      <span className="text-muted-foreground">–</span>
      <span className={won === 'B' ? 'text-primary' : ''}>{game[1]}</span>
    </button>
  )
}

export function GamesStrip({
  banked,
  canBank,
  canAdd,
  target,
  onBank,
  onEditChip,
  onRemoveChip,
}: {
  banked: BankedGame[]
  canBank: boolean
  canAdd: boolean
  target: number
  onBank: () => void
  onEditChip: (index: number, game: BankedGame) => void
  onRemoveChip: (index: number) => void
}) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const ready = canBank && canAdd
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {banked.map((g, i) => (
        <Chip
          key={i}
          game={g}
          target={target}
          editing={editingIndex === i}
          onStartEdit={() => setEditingIndex(i)}
          onDoneEdit={() => setEditingIndex(null)}
          onEdit={(ng) => onEditChip(i, ng)}
          onRemove={() => {
            setEditingIndex(null)
            onRemoveChip(i)
          }}
        />
      ))}
      <button
        type="button"
        onClick={onBank}
        disabled={!ready}
        className={`rounded-md px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wide transition-colors ${
          ready
            ? 'border-2 border-primary bg-primary text-primary-foreground'
            : 'border-2 border-dashed border-input text-muted-foreground'
        }`}
      >
        + next game
      </button>
    </div>
  )
}

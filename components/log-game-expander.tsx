'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { MatchLogForm } from '@/components/match-log-form'

type PlayerOption = {
  id: string
  name: string
  nickname: string | null
  currentElo: number
}

/**
 * Centered "Log a game" panel that expands the full logger inline.
 * Collapsed by default — a single button; clicking it reveals the form
 * in place. Stays open after a save so you can log several in a row.
 */
export function LogGameExpander({ players }: { players: PlayerOption[] }) {
  const [open, setOpen] = useState(false)

  return (
    <section id="log" className="scroll-mt-20">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/40 bg-card px-4 py-3.5 font-display text-sm font-semibold uppercase tracking-widest text-primary shadow-[0_0_0_2px_rgba(41,96,197,0.10)] transition-colors hover:bg-secondary"
        >
          <Plus className="h-4 w-4" />
          Log a game
        </button>
      ) : (
        <div className="rounded-xl border border-primary/40 bg-card p-5 shadow-[0_0_0_2px_rgba(41,96,197,0.12)]">
          <div className="mb-4 flex items-center justify-between">
            <div className="font-display text-sm font-semibold uppercase tracking-widest text-primary">
              Log a game
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close logger"
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <MatchLogForm players={players} />
        </div>
      )}
    </section>
  )
}

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
 * "Log a game" panel. Desktop keeps the form expanded at all times; mobile
 * starts as a single "Log a game" button that reveals the form on tap. The
 * split is pure CSS (lg: variants) so both states are server-rendered and the
 * right one shows per viewport — no client-side flicker. The `open` state only
 * drives the mobile toggle. The timer inside starts paused; the panel stays
 * open after a save so you can log several in a row.
 */
export function LogGameExpander({ players }: { players: PlayerOption[] }) {
  const [open, setOpen] = useState(false)

  return (
    <section id="log" className="scroll-mt-20">
      {/* Collapsed trigger — mobile only (always hidden on desktop). */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${open ? 'hidden' : 'flex'} w-full items-center justify-center gap-2 rounded-xl border border-primary/40 bg-card px-4 py-3.5 font-display text-sm font-semibold uppercase tracking-widest text-primary shadow-[0_0_0_2px_rgba(41,96,197,0.10)] transition-colors hover:bg-secondary lg:hidden`}
      >
        <Plus className="h-4 w-4" />
        Log a game
      </button>

      {/* Form panel — always shown on desktop; on tap on mobile. */}
      <div
        className={`${open ? 'block' : 'hidden'} rounded-xl border border-primary/40 bg-card p-5 shadow-[0_0_0_2px_rgba(41,96,197,0.12)] lg:block`}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="font-display text-sm font-semibold uppercase tracking-widest text-primary">
            Log a game
          </div>
          {/* Collapse — mobile only. */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close logger"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <MatchLogForm players={players} />
      </div>
    </section>
  )
}

'use client'

import { useState } from 'react'
import { MatchDetailModal } from '@/components/match-detail-modal'

/**
 * Universal "View game" button. Opens the shared match-detail modal.
 * Used identically across the matches list, recent games, and player history.
 */
export function ViewGameButton({ id }: { id: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 rounded-md border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary hover:bg-secondary"
      >
        View game
      </button>
      {open && <MatchDetailModal id={id} open={open} onOpenChange={setOpen} />}
    </>
  )
}

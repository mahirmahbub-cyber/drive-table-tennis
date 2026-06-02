'use client'

import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { MatchDetailModal } from '@/components/match-detail-modal'

export function ViewGameButton({
  id, variant = 'label',
}: { id: string; variant?: 'label' | 'icon' }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={variant === 'icon' ? 'View game details' : undefined}
        className={
          variant === 'icon'
            ? 'rounded-md p-1 text-muted-foreground transition-colors hover:text-primary hover:bg-secondary'
            : 'rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-primary hover:bg-secondary'
        }
      >
        {variant === 'icon' ? <ChevronRight className="h-4 w-4" /> : 'View'}
      </button>
      {open && <MatchDetailModal id={id} open={open} onOpenChange={setOpen} />}
    </>
  )
}

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'

const LS_KEY = 'drive_tt_h2h_banner_dismissed'

export function H2hBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(LS_KEY) !== '1') setVisible(true)
  }, [])

  if (!visible) return null

  return (
    <div className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-primary/20 bg-secondary px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="shrink-0 rounded-md bg-primary px-2 py-0.5 font-display text-[10px] uppercase tracking-widest text-primary-foreground">New</span>
        <p className="min-w-0 text-sm">
          <Link href="/matrix" className="font-medium text-primary hover:underline">Head-to-Head mode</Link>
          {' '}is live — click any matchup on the Mogboard for the full rivalry breakdown.
        </p>
      </div>
      <button
        type="button"
        onClick={() => { localStorage.setItem(LS_KEY, '1'); setVisible(false) }}
        aria-label="Dismiss"
        className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

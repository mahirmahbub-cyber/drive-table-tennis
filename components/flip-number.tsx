'use client'

import { useEffect, useState } from 'react'

/**
 * Tweens `from` → `to` (easeOutCubic) and renders the value as flip-tiles, one
 * per digit. Each tile replays the flip whenever its digit changes — so the
 * number flips as it tallies, like the scoring pad. Jumps to `to` under
 * reduced motion (the media query suppresses the flips).
 */
function useCountUp(from: number, to: number, durationMs: number) {
  const [value, setValue] = useState(from)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const id = requestAnimationFrame(() => setValue(to))
      return () => cancelAnimationFrame(id)
    }
    let raf = 0
    let startTs = 0
    const tick = (ts: number) => {
      if (!startTs) startTs = ts
      const p = Math.min(1, (ts - startTs) / durationMs)
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(Math.round(from + (to - from) * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [from, to, durationMs])
  return value
}

function FlipDigit({ char }: { char: string }) {
  return (
    <span className="relative grid h-12 w-9 place-items-center overflow-hidden rounded-md bg-cream shadow-[var(--shadow-tile)]">
      {/* Inner span remounts on digit change (key={char}) to replay the flip. */}
      <span
        key={char}
        className="flip-digit-anim absolute inset-0 grid place-items-center font-mono nums text-3xl font-bold text-ink"
      >
        {char}
      </span>
      <span className="pointer-events-none absolute inset-x-0 top-1/2 z-10 h-px hinge" aria-hidden />
    </span>
  )
}

export function FlipNumber({ from, to, durationMs = 1300 }: { from: number; to: number; durationMs?: number }) {
  const value = useCountUp(from, to, durationMs)
  const digits = String(value).split('')
  return (
    <div className="flex items-end gap-1 nums" aria-label={String(to)}>
      {digits.map((c, i) => (
        <FlipDigit key={i} char={c} />
      ))}
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { SpeedoGauge } from '@/components/speedo-gauge'

/**
 * Tweens an ELO value from `from` to `to` (easeOutCubic) and renders the
 * SpeedoGauge with the interpolated value — so the needle sweeps and the
 * (lg) centre number counts up. Jumps straight to `to` under reduced motion.
 */
export function AnimatedDial({
  from,
  to,
  label,
  size = 'lg',
  durationMs = 950,
  delayMs = 0,
}: {
  from: number
  to: number
  label?: string
  size?: 'lg' | 'sm'
  durationMs?: number
  delayMs?: number
}) {
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
      const elapsed = ts - startTs - delayMs
      if (elapsed < 0) { raf = requestAnimationFrame(tick); return }
      const p = Math.min(1, elapsed / durationMs)
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(Math.round(from + (to - from) * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [from, to, durationMs, delayMs])

  return <SpeedoGauge elo={value} label={label} size={size} />
}

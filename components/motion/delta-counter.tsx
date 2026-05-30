'use client'

import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { useEffect } from 'react'

export function DeltaCounter({
  from,
  to,
  durationMs = 600,
}: {
  from: number
  to: number
  durationMs?: number
}) {
  const value = useMotionValue(from)
  const rounded = useTransform(value, (v) => Math.round(v).toString())
  useEffect(() => {
    const controls = animate(value, to, {
      duration: durationMs / 1000,
      ease: 'easeOut',
    })
    return () => controls.stop()
  }, [to, durationMs, value])
  return <motion.span className="font-mono tabular-nums">{rounded}</motion.span>
}

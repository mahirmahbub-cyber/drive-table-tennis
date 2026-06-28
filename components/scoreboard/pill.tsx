import * as React from 'react'
import { cn } from '@/lib/utils'

const variants = {
  gain: 'bg-gain-muted text-gain',
  loss: 'bg-loss-muted text-loss',
  brass: 'bg-brass/18 text-brass-deep',
  neutral: 'bg-muted text-ink-muted',
} as const

export function Pill({
  variant = 'neutral',
  className,
  children,
}: {
  variant?: keyof typeof variants
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-block rounded-md px-2 py-0.5 font-mono nums text-xs font-bold',
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}

import * as React from 'react'
import { cn } from '@/lib/utils'

export function SectionHeading({
  kicker,
  surface = 'cream',
  rule = true,
  className,
  children,
}: {
  kicker?: string
  surface?: 'cream' | 'panel'
  rule?: boolean
  className?: string
  children: React.ReactNode
}) {
  const titleColor = surface === 'panel' ? 'text-panel-foreground' : 'text-ink'
  const kickerColor = surface === 'panel' ? 'text-brass' : 'text-ink-muted'
  return (
    <div className={cn('mb-3', className)}>
      {kicker && (
        <div className={cn('font-mono text-[10px] uppercase tracking-[0.16em]', kickerColor)}>
          {kicker}
        </div>
      )}
      <h2 className={cn('font-display text-2xl leading-tight', titleColor)}>{children}</h2>
      {rule && <div className="brass-rule mt-2 opacity-85" />}
    </div>
  )
}

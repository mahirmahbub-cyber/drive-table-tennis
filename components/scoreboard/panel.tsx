import * as React from 'react'
import { cn } from '@/lib/utils'

export function Panel({
  kicker,
  title,
  rule = true,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  kicker?: string
  title?: string
  rule?: boolean
}) {
  return (
    <div className={cn('panel px-3.5 py-3.5 sm:px-4 sm:py-4', className)} {...props}>
      {(kicker || title) && (
        <div className="mb-2">
          {kicker && (
            <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-brass">
              {kicker}
            </div>
          )}
          {title && (
            <div className="font-display text-lg leading-tight text-panel-foreground">
              {title}
            </div>
          )}
          {rule && <div className="brass-rule mt-1.5 opacity-85" />}
        </div>
      )}
      {children}
    </div>
  )
}

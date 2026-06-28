import { cn } from '@/lib/utils'
import { FlipNumber } from '@/components/flip-number'

export function StatReadout({
  label,
  value,
  from = 0,
  className,
}: {
  label: string
  value: number
  from?: number
  className?: string
}) {
  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-brass">
        {label}
      </span>
      <FlipNumber from={from} to={value} />
    </div>
  )
}

import { FlipNumber } from '@/components/flip-number'

export function StatReadout({
  label,
  value,
  from = 0,
}: {
  label: string
  value: number
  from?: number
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-brass">
        {label}
      </span>
      <FlipNumber from={from} to={value} />
    </div>
  )
}

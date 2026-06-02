'use client'

import { useState } from 'react'

/**
 * A numeric score input: − [n] +. The number is typable AND adjustable by the
 * buttons. Renders a real <input name=...> so a parent form/server action reads
 * it (e.g. set_<i>_a / set_<i>_b). Calls onValueChange so a parent can react live.
 */
export function Stepper({
  name,
  defaultValue,
  min = 0,
  max = 99,
  ariaLabel,
  onValueChange,
}: {
  name: string
  defaultValue?: number | ''
  min?: number
  max?: number
  ariaLabel?: string
  onValueChange?: (v: number | '') => void
}) {
  const [value, setValue] = useState<number | ''>(defaultValue ?? '')

  const update = (v: number | '') => {
    setValue(v)
    onValueChange?.(v)
  }
  const clamp = (n: number) => Math.max(min, Math.min(max, n))
  const step = (delta: number) =>
    update(clamp((typeof value === 'number' ? value : 0) + delta))

  return (
    <div className="flex items-center gap-2 rounded-lg border border-input bg-card p-1.5">
      <button
        type="button"
        aria-label={`decrease ${ariaLabel ?? name}`}
        onClick={() => step(-1)}
        className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary text-foreground transition-colors hover:bg-muted"
      >
        −
      </button>
      <input
        name={name}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        aria-label={ariaLabel ?? name}
        value={value}
        onChange={(e) => {
          const raw = e.target.value
          if (raw === '') return update('')
          update(clamp(Number(raw)))
        }}
        className="w-12 bg-transparent text-center font-mono nums text-xl font-bold focus:outline-none"
      />
      <button
        type="button"
        aria-label={`increase ${ariaLabel ?? name}`}
        onClick={() => step(1)}
        className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary text-foreground transition-colors hover:bg-muted"
      >
        +
      </button>
    </div>
  )
}

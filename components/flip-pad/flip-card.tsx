'use client'

import { useState } from 'react'

export function FlipCard({
  value,
  name,
  lead,
  gamePoint,
  onChange,
}: {
  value: number | null
  name: string
  lead: boolean
  gamePoint: boolean
  onChange: (v: number | null) => void
}) {
  const v = value ?? 0
  const clamp = (n: number) => Math.max(0, Math.min(99, n))
  // Bumped only on +/− steps, so the flip plays on live scoring but not while typing.
  const [flip, setFlip] = useState(0)
  const step = (delta: number) => {
    const next = clamp(v + delta)
    if (next === v) return
    onChange(next)
    setFlip((f) => f + 1)
  }
  const cuesHidden = (value ?? 0) >= 2
  const bg = lead ? 'bg-cream-lift' : 'bg-cream'
  const shadow = lead
    ? 'shadow-[0_3px_10px_var(--brass-glow),inset_0_-6px_0_rgb(0_0_0_/_0.06)]'
    : 'shadow-[0_3px_6px_rgba(0,0,0,0.35),inset_0_-6px_0_rgba(0,0,0,0.06)]'

  return (
    <div
      className={`relative grid h-[100px] w-[78px] grid-rows-[1fr_auto_1fr] overflow-hidden rounded-[6px_6px_9px_9px] sm:h-[104px] sm:w-[86px] ${bg} ${shadow} ${gamePoint ? 'ring-2 ring-brass' : ''}`}
    >
      {/* Cues fade once scoring is underway, but the +/− regions stay the live tap-targets (aria-labels carry meaning). */}
      <button
        type="button"
        aria-label={`add point ${name}`}
        onClick={() => step(1)}
        className={`flex items-start justify-center pt-1 text-sm font-bold text-brass/70 transition-opacity ${cuesHidden ? 'opacity-0' : 'opacity-100'}`}
      >
        +
      </button>

      <div className="group relative grid place-items-center">
        {/* Visible digit: remounts on each step (key={flip}) to replay the flip; updates in place while typing. */}
        <span
          key={flip}
          aria-hidden
          className={`${flip > 0 ? 'flip-card-anim ' : ''}pointer-events-none border-b-2 border-transparent pb-0.5 font-mono nums text-[40px] font-bold leading-none group-focus-within:border-brass sm:text-[44px] ${
            value === null ? 'text-ink/30' : 'text-ink'
          }`}
        >
          {value ?? 0}
        </span>
        {/* Transparent input over the digit: owns typing + the keypad; the span renders the value. */}
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={99}
          aria-label={`${name} score`}
          value={value ?? ''}
          onChange={(e) => {
            const raw = e.target.value
            onChange(raw === '' ? null : clamp(Number(raw)))
          }}
          className="absolute inset-0 h-full w-full bg-transparent text-center font-mono text-[40px] font-bold leading-none text-transparent caret-ink focus:outline-none sm:text-[44px] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
      </div>

      <button
        type="button"
        aria-label={`remove point ${name}`}
        onClick={() => step(-1)}
        className={`flex items-end justify-center pb-1 text-sm font-bold text-brass/55 transition-opacity ${cuesHidden ? 'opacity-0' : 'opacity-100'}`}
      >
        −
      </button>

      <span className="pointer-events-none absolute inset-x-0 top-1/2 z-10 h-[2px] hinge" aria-hidden />
    </div>
  )
}

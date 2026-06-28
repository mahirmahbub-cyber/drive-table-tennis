'use client'

import { useRef } from 'react'
import { Calendar } from 'lucide-react'

function labelFor(value: string): string {
  if (!value) return 'Set time'
  const [date, time] = value.split('T')
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = (time ?? '00:00').split(':').map(Number)
  const at = new Date(y, m - 1, d, hh, mm)
  const today = new Date()
  const sameDay =
    at.getFullYear() === today.getFullYear() &&
    at.getMonth() === today.getMonth() &&
    at.getDate() === today.getDate()
  const h12 = ((hh + 11) % 12) + 1
  const ampm = hh < 12 ? 'am' : 'pm'
  const clock = `${h12}:${String(mm).padStart(2, '0')}${ampm}`
  if (sameDay) return `Today ${clock}`
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${d} ${months[m - 1]} ${clock}`
}

export function PlayedAtLine({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="text-right">
      <button
        type="button"
        // Opens the native date/time picker directly; the input stays visually hidden.
        onClick={() => ref.current?.showPicker?.()}
        aria-label={`Change played-at, currently ${labelFor(value)}`}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground"
      >
        <Calendar className="h-3.5 w-3.5" />
        <span className="border-b border-dashed border-input text-secondary-foreground">{labelFor(value)}</span>
      </button>
      <input
        ref={ref}
        type="datetime-local"
        name="playedAt"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-hidden
        tabIndex={-1}
        className="sr-only"
      />
    </div>
  )
}

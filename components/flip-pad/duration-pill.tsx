'use client'

import { useEffect, useRef, useState } from 'react'
import { Play, Pause } from 'lucide-react'
import { formatDuration } from '@/lib/stats'

export function DurationPill({
  value,
  onChange,
  autoStart = false,
}: {
  value: number
  onChange: (seconds: number) => void
  autoStart?: boolean
}) {
  const [running, setRunning] = useState(autoStart)
  const startedAt = useRef<number | null>(null)
  const baseSeconds = useRef(value)

  useEffect(() => {
    if (!running) return
    startedAt.current ??= Date.now()
    const id = setInterval(() => {
      onChange(baseSeconds.current + Math.floor((Date.now() - (startedAt.current ?? Date.now())) / 1000))
    }, 250)
    return () => clearInterval(id)
  }, [running, onChange])

  function toggle() {
    if (running) {
      setRunning(false)
    } else {
      baseSeconds.current = value
      startedAt.current = Date.now()
      setRunning(true)
    }
  }

  function onText(text: string) {
    const digits = text.replace(/\D/g, '').replace(/^0+/, '').slice(0, 6)
    if (digits === '') return onChange(0)
    const n = parseInt(digits, 10)
    onChange(Math.floor(n / 100) * 60 + (n % 100))
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-md border border-input bg-card px-2 py-1.5">
      <button
        type="button"
        onClick={toggle}
        aria-label={running ? 'pause timer' : 'start timer'}
        className="grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground"
      >
        {running ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
      </button>
      <input
        value={formatDuration(value)}
        onFocus={() => setRunning(false)}
        onChange={(e) => onText(e.target.value)}
        inputMode="numeric"
        aria-label="match duration mm:ss"
        className="w-12 bg-transparent font-mono nums text-sm font-bold focus:outline-none"
      />
    </span>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'
import { Play, Pause, RotateCcw } from 'lucide-react'
import { formatDuration } from '@/lib/stats'

export function MatchStopwatch({
  value,
  onChange,
}: {
  value: number
  onChange: (seconds: number) => void
}) {
  const [running, setRunning] = useState(false)
  const startedAt = useRef<number | null>(null)
  const baseSeconds = useRef(value)

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      const elapsed =
        baseSeconds.current +
        Math.floor((Date.now() - (startedAt.current ?? Date.now())) / 1000)
      onChange(elapsed)
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

  function reset() {
    setRunning(false)
    baseSeconds.current = 0
    onChange(0)
  }

  return (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-secondary/40 px-4 py-3">
      <span className="font-mono nums text-3xl font-semibold tabular-nums tracking-tight">
        {formatDuration(value)}
      </span>
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          aria-label={running ? 'Pause timer' : 'Start timer'}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
        >
          {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {running ? 'Pause' : 'Start'}
        </button>
        <button
          type="button"
          onClick={reset}
          aria-label="Reset timer"
          className="inline-flex items-center justify-center rounded-md border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground hover:bg-secondary"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

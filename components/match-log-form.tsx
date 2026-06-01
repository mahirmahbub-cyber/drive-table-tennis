'use client'

import { useState, useEffect } from 'react'
import { logMatch, editMatch } from '@/app/actions/matches'
import { MatchStopwatch } from '@/components/match-stopwatch'
import { formatDuration, parseDurationInput } from '@/lib/stats'

type PlayerOption = { id: string; name: string; nickname: string | null; currentElo: number }

export type MatchFormInitial = {
  id: string
  playerAId: string
  playerBId: string
  sets: Array<[number, number]>
  playedAt: Date | null
  durationSeconds: number | null
}

function toLocalDatetimeValue(d: Date): string {
  // yyyy-MM-ddThh:mm in local time, for <input type="datetime-local">
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function MatchLogForm({
  players,
  initial,
  onSuccess,
}: {
  players: PlayerOption[]
  initial?: MatchFormInitial
  onSuccess?: () => void
}) {
  const isEdit = !!initial
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [savedTick, setSavedTick] = useState(0)
  const [duration, setDuration] = useState<number>(initial?.durationSeconds ?? 0)
  const [durationText, setDurationText] = useState<string>(
    initial?.durationSeconds ? formatDuration(initial.durationSeconds) : ''
  )
  const [playedAt, setPlayedAt] = useState<string>(
    initial?.playedAt ? toLocalDatetimeValue(initial.playedAt) : ''
  )

  // Set "now" only on the client after mount to avoid SSR/client hydration mismatch
  // on the datetime-local input. This is the canonical pattern for client-only init.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!isEdit && playedAt === '') setPlayedAt(toLocalDatetimeValue(new Date()))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Called by the stopwatch — syncs both duration and durationText display.
  function handleStopwatchChange(seconds: number) {
    setDuration(seconds)
    setDurationText(seconds > 0 ? formatDuration(seconds) : '')
  }

  function handleDurationText(text: string) {
    setDurationText(text)
    const parsed = parseDurationInput(text)
    if (parsed !== null) setDuration(parsed)
    if (text.trim() === '') setDuration(0)
  }

  async function handle(formData: FormData) {
    setError(null)
    setPending(true)
    const r = isEdit
      ? await editMatch(initial!.id, formData)
      : await logMatch(formData)
    setPending(false)
    if (r && 'error' in r) {
      setError(r.error ?? null)
      return
    }
    if (onSuccess) onSuccess()
    if (!isEdit) {
      setSavedTick((t) => t + 1)
      setDuration(0)
      setDurationText('')
      setPlayedAt(toLocalDatetimeValue(new Date()))
    }
  }

  const setDefaults = initial?.sets ?? []

  return (
    <form action={handle} className="space-y-6">
      <input type="hidden" name="durationSeconds" value={duration || ''} readOnly />

      {/* Players */}
      <div className="grid grid-cols-2 gap-4">
        {(['A', 'B'] as const).map((side) => {
          const fieldName = side === 'A' ? 'playerAId' : 'playerBId'
          const def = side === 'A' ? initial?.playerAId : initial?.playerBId
          return (
            <label key={side} className="block">
              <span className="font-display uppercase tracking-widest text-xs text-muted-foreground">
                Player {side}
              </span>
              <select
                name={fieldName}
                required
                defaultValue={def ?? ''}
                className="mt-1.5 w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">—</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.currentElo})
                  </option>
                ))}
              </select>
            </label>
          )
        })}
      </div>

      {/* Set scores */}
      <fieldset className="space-y-2">
        <legend className="section-header font-display w-full">Set scores</legend>
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="w-12 font-mono text-xs text-muted-foreground">Set {i + 1}</span>
            <input
              name={`set_${i}_a`}
              type="number"
              min={0}
              max={99}
              defaultValue={setDefaults[i]?.[0] ?? ''}
              className="w-20 rounded-md border border-input bg-card px-2 py-1.5 font-mono nums text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <span className="text-muted-foreground">–</span>
            <input
              name={`set_${i}_b`}
              type="number"
              min={0}
              max={99}
              defaultValue={setDefaults[i]?.[1] ?? ''}
              className="w-20 rounded-md border border-input bg-card px-2 py-1.5 font-mono nums text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        ))}
      </fieldset>

      {/* Duration */}
      <div className="space-y-2">
        <div className="section-header font-display">Game duration</div>
        <MatchStopwatch value={duration} onChange={handleStopwatchChange} />
        <label className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">Or enter manually (mm:ss)</span>
          <input
            value={durationText}
            onChange={(e) => handleDurationText(e.target.value)}
            placeholder="12:30"
            inputMode="numeric"
            className="w-24 rounded-md border border-input bg-card px-2 py-1.5 font-mono nums text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
      </div>

      {/* Date/time */}
      <label className="block">
        <span className="font-display uppercase tracking-widest text-xs text-muted-foreground">
          Played at
        </span>
        <input
          type="datetime-local"
          name="playedAt"
          value={playedAt}
          onChange={(e) => setPlayedAt(e.target.value)}
          className="mt-1.5 block rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </label>

      {error && <div className="text-sm text-loss">{error}</div>}
      {!isEdit && savedTick > 0 && !error && (
        <div className="text-sm text-gain">Match saved. Log another below.</div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Save match'}
      </button>
    </form>
  )
}

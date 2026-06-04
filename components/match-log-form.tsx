'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { logMatch, editMatch } from '@/app/actions/matches'
import { MatchStopwatch } from '@/components/match-stopwatch'
import { formatDuration, parseDurationInput } from '@/lib/stats'
import { Stepper } from '@/components/stepper'
import { inferWinnerSide, setsWon, type SetScore } from '@/lib/match-format'
import { RaceResult } from '@/components/race-result'
import type { LogResult } from '@/app/actions/matches'

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
  const [result, setResult] = useState<LogResult | null>(null)
  const [duration, setDuration] = useState<number>(initial?.durationSeconds ?? 0)
  const [durationText, setDurationText] = useState<string>(
    initial?.durationSeconds ? formatDuration(initial.durationSeconds) : ''
  )
  const [playedAt, setPlayedAt] = useState<string>(
    initial?.playedAt ? toLocalDatetimeValue(initial.playedAt) : ''
  )

  // New state for Quick/Full mode toggle and score tracking
  const initialSetCount = Math.min(7, Math.max(1, initial?.sets.length ?? 1))
  const initialMode: 'quick' | 'full' = initial && initial.sets.length > 1 ? 'full' : 'quick'
  const [mode, setMode] = useState<'quick' | 'full'>(initialMode)
  const [setCount, setSetCount] = useState(initialSetCount)
  const [scores, setScores] = useState<Array<[string, string]>>(
    Array.from({ length: 7 }, (_, i) => [
      initial?.sets[i]?.[0]?.toString() ?? '',
      initial?.sets[i]?.[1]?.toString() ?? '',
    ])
  )
  const [aId, setAId] = useState(initial?.playerAId ?? '')
  const [bId, setBId] = useState(initial?.playerBId ?? '')
  const submitting = useRef(false)

  // Set "now" only on the client after mount to avoid SSR/client hydration mismatch
  // on the datetime-local input. This is the canonical pattern for client-only init.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!isEdit && playedAt === '') setPlayedAt(toLocalDatetimeValue(new Date()))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Called by the stopwatch — syncs both duration and durationText display.
  // Stable reference so the stopwatch's interval effect doesn't restart every tick.
  const handleStopwatchChange = useCallback((seconds: number) => {
    setDuration(seconds)
    setDurationText(seconds > 0 ? formatDuration(seconds) : '')
  }, [])

  function handleDurationText(text: string) {
    setDurationText(text)
    const parsed = parseDurationInput(text)
    if (parsed !== null) setDuration(parsed)
    if (text.trim() === '') setDuration(0)
  }

  async function handle(formData: FormData) {
    if (submitting.current) return
    submitting.current = true
    setError(null)
    setPending(true)
    try {
      const r = isEdit
        ? await editMatch(initial!.id, formData)
        : await logMatch(formData)
      if (r && 'error' in r) {
        setError(r.error ?? null)
        return
      }
      if (onSuccess) onSuccess()
      if (!isEdit) {
        if (r && 'result' in r && (r as { result?: LogResult }).result) setResult((r as { result: LogResult }).result)
        setSavedTick((t) => t + 1)
        setDuration(0)
        setDurationText('')
        setPlayedAt(toLocalDatetimeValue(new Date()))
        setScores(Array.from({ length: 7 }, () => ['', '']))
        setSetCount(1)
        setMode('quick')
        setAId('')
        setBId('')
      }
    } finally {
      setPending(false)
      submitting.current = false
    }
  }

  // Derive live winner badge
  const nameFor = (id: string) => players.find((p) => p.id === id)?.name ?? 'Player'
  const activeSets: SetScore[] = scores
    .slice(0, mode === 'quick' ? 1 : setCount)
    .filter(([a, b]) => a !== '' && b !== '')
    .map(([a, b]) => [Number(a), Number(b)] as SetScore)
  const winnerSide = inferWinnerSide(activeSets)
  const tally = setsWon(activeSets)
  const badge = (() => {
    if (activeSets.length === 0) return null
    if (winnerSide === null) return { tone: 'tie' as const, text: 'Tied — adjust the score' }
    const winnerName = winnerSide === 'A' ? nameFor(aId) : nameFor(bId)
    if (mode === 'quick') {
      const [a, b] = activeSets[0]
      return { tone: 'win' as const, text: `${winnerName} wins · ${a}–${b}` }
    }
    return { tone: 'win' as const, text: `${winnerName} wins the match (${tally.a}–${tally.b})` }
  })()

  if (!isEdit && result) {
    return (
      <RaceResult
        result={result}
        onLogAnother={() => {
          setResult(null)
          setSavedTick((t) => t + 1)
        }}
      />
    )
  }

  return (
    <form key={savedTick} action={handle} className="space-y-6">
      <input type="hidden" name="durationSeconds" value={duration || ''} readOnly />

      {/* Mode toggle */}
      <div className="flex gap-1 rounded-lg bg-secondary p-1">
        {(['quick', 'full'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
            }`}
          >
            {m === 'quick' ? 'Quick' : 'Full match'}
          </button>
        ))}
      </div>

      {/* Players */}
      <div className="grid grid-cols-2 gap-4">
        {(['A', 'B'] as const).map((side) => {
          const fieldName = side === 'A' ? 'playerAId' : 'playerBId'
          return (
            <label key={side} className="block">
              <span className="font-display uppercase tracking-widest text-xs text-muted-foreground">
                Player {side}
              </span>
              <select
                name={fieldName}
                required
                value={side === 'A' ? aId : bId}
                onChange={(e) => side === 'A' ? setAId(e.target.value) : setBId(e.target.value)}
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
        <legend className="section-header font-display w-full">
          {mode === 'quick' ? 'Score' : 'Games'}
        </legend>
        {Array.from({ length: mode === 'quick' ? 1 : setCount }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            {mode === 'full' && (
              <span className="w-12 font-mono text-xs text-muted-foreground">Game {i + 1}</span>
            )}
            <Stepper
              name={`set_${i}_a`}
              ariaLabel={`game ${i + 1} player A`}
              defaultValue={scores[i][0] === '' ? '' : Number(scores[i][0])}
              onValueChange={(v) =>
                setScores((s) => { const n = [...s]; n[i] = [v === '' ? '' : String(v), n[i][1]]; return n })
              }
            />
            <span className="text-muted-foreground">–</span>
            <Stepper
              name={`set_${i}_b`}
              ariaLabel={`game ${i + 1} player B`}
              defaultValue={scores[i][1] === '' ? '' : Number(scores[i][1])}
              onValueChange={(v) =>
                setScores((s) => { const n = [...s]; n[i] = [n[i][0], v === '' ? '' : String(v)]; return n })
              }
            />
            {mode === 'full' && setCount > 1 && i === setCount - 1 && (
              <button
                type="button"
                aria-label={`remove game ${i + 1}`}
                onClick={() => setSetCount((c) => Math.max(1, c - 1))}
                className="text-muted-foreground hover:text-loss"
              >
                ×
              </button>
            )}
          </div>
        ))}
        {mode === 'full' && setCount < 7 && (
          <button
            type="button"
            onClick={() => setSetCount((c) => Math.min(7, c + 1))}
            className="rounded-md border border-dashed border-input px-3 py-1.5 text-sm text-primary"
          >
            ＋ Add game
          </button>
        )}
      </fieldset>

      {/* Live winner badge */}
      {badge && (
        <div className={`rounded-md border px-3 py-2 text-sm text-center ${
          badge.tone === 'win'
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-border text-muted-foreground'
        }`}>
          {badge.text}
        </div>
      )}

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
        className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending && (
          <span
            className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground"
            aria-hidden
          />
        )}
        {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Save match'}
      </button>
    </form>
  )
}

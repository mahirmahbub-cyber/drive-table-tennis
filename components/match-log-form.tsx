'use client'

import { useState, useEffect, useRef, Fragment } from 'react'
import { logMatch, editMatch } from '@/app/actions/matches'
import { LoadingOverlay } from '@/components/loading-overlay'
import { RaceResult } from '@/components/race-result'
import { FlipPad } from '@/components/flip-pad/flip-pad'
import { GamesStrip } from '@/components/flip-pad/games-strip'
import { DurationPill } from '@/components/flip-pad/duration-pill'
import { PlayedAtLine } from '@/components/flip-pad/played-at-line'
import {
  splitForEdit,
  allGames,
  tally,
  matchWinner,
  canBank,
  canAddGame,
  type BankedGame,
  type LiveGame,
} from '@/lib/flip-pad'
import type { LogResult } from '@/app/actions/matches'
import { instantToWallClock } from '@/lib/tz'

type PlayerOption = { id: string; name: string; nickname: string | null; currentElo: number }

export type MatchFormInitial = {
  id: string
  playerAId: string
  playerBId: string
  sets: Array<[number, number]>
  playedAt: Date | null
  durationSeconds: number | null
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
  const [editSplit] = useState(() => (initial ? splitForEdit(initial.sets) : null))

  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [savedTick, setSavedTick] = useState(0)
  const [result, setResult] = useState<LogResult | null>(null)
  const [duration, setDuration] = useState<number>(initial?.durationSeconds ?? 0)
  const [playedAt, setPlayedAt] = useState<string>(initial?.playedAt ? instantToWallClock(initial.playedAt) : '')

  const [banked, setBanked] = useState<BankedGame[]>(editSplit?.banked ?? [])
  const [current, setCurrent] = useState<LiveGame>(editSplit?.current ?? [0, 0])
  const [target, setTarget] = useState<number>(11)
  const [aId, setAId] = useState(initial?.playerAId ?? '')
  const [bId, setBId] = useState(initial?.playerBId ?? '')
  const submitting = useRef(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!isEdit && playedAt === '') setPlayedAt(instantToWallClock(new Date()))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const games = allGames(banked, current)
  const t = tally(banked, current)
  const winnerSide = matchWinner(banked, current)
  const firstNameFor = (id: string) => (players.find((p) => p.id === id)?.name ?? 'Player').split(' ')[0]

  const resultSuffix = (() => {
    if (games.length === 0) return ''
    if (winnerSide === null) return `· ${t.a}–${t.b}, tied`
    const who = winnerSide === 'A' ? firstNameFor(aId) : firstNameFor(bId)
    return `· ${who} ${Math.max(t.a, t.b)}–${Math.min(t.a, t.b)}`
  })()

  function bankGame() {
    if (!canBank(current) || !canAddGame(banked)) return
    setBanked((b) => [...b, current as BankedGame])
    setCurrent([0, 0])
  }

  async function handle(formData: FormData) {
    if (submitting.current) return
    submitting.current = true
    setError(null)
    setPending(true)
    try {
      const r = isEdit ? await editMatch(initial!.id, formData) : await logMatch(formData)
      if (r && 'error' in r) {
        setError(r.error ?? null)
        return
      }
      if (onSuccess) onSuccess()
      if (!isEdit) {
        if (r && 'result' in r && (r as { result?: LogResult }).result) setResult((r as { result: LogResult }).result)
        setSavedTick((s) => s + 1)
        setDuration(0)
        setPlayedAt(instantToWallClock(new Date()))
        setBanked([])
        setCurrent([0, 0])
        setTarget(11)
        setAId('')
        setBId('')
      }
    } finally {
      setPending(false)
      submitting.current = false
    }
  }

  if (!isEdit && result) {
    return (
      <RaceResult
        result={result}
        onLogAnother={() => {
          setResult(null)
          setSavedTick((s) => s + 1)
        }}
      />
    )
  }

  const canSave = !pending && !!aId && !!bId && games.length > 0
  // Only nudge once both players are picked (missing players is self-evident from the disabled Save).
  const saveHint = canSave || pending || !aId || !bId ? '' : 'Finish the current game — both scores, no tie.'

  return (
    <form key={savedTick} action={handle} className="space-y-4">
      <LoadingOverlay open={pending} label="Saving match…" />

      <FlipPad
        players={players}
        aId={aId}
        bId={bId}
        onA={setAId}
        onB={setBId}
        current={current}
        onCurrent={setCurrent}
        tallyA={t.a}
        tallyB={t.b}
        target={target}
        onTarget={setTarget}
      />

      <GamesStrip
        banked={banked}
        canBank={canBank(current)}
        canAdd={canAddGame(banked)}
        target={target}
        onBank={bankGame}
        onEditChip={(i, g) => setBanked((b) => b.map((x, idx) => (idx === i ? g : x)))}
        onRemoveChip={(i) => setBanked((b) => b.filter((_, idx) => idx !== i))}
      />

      {/* Hidden fields carry the pad state into the existing server action. */}
      {games.map((g, i) => (
        <Fragment key={i}>
          <input type="hidden" name={`set_${i}_a`} value={g[0]} readOnly />
          <input type="hidden" name={`set_${i}_b`} value={g[1]} readOnly />
        </Fragment>
      ))}
      <input type="hidden" name="playerAId" value={aId} readOnly />
      <input type="hidden" name="playerBId" value={bId} readOnly />
      <input type="hidden" name="durationSeconds" value={duration || ''} readOnly />

      <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
        <DurationPill value={duration} onChange={setDuration} />
        <PlayedAtLine value={playedAt} onChange={setPlayedAt} />
      </div>

      {error && <div className="text-sm text-loss">{error}</div>}
      {!isEdit && savedTick > 0 && !error && (
        <div className="text-sm text-gain">Match saved. Log another below.</div>
      )}

      {saveHint && (
        <div role="status" aria-live="polite" className="text-center text-xs text-muted-foreground">
          {saveHint}
        </div>
      )}

      <button
        type="submit"
        disabled={!canSave}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending && (
          <span
            className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground"
            aria-hidden
          />
        )}
        {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Save match'}
        {resultSuffix && <span className="font-normal opacity-85">{resultSuffix}</span>}
      </button>
    </form>
  )
}

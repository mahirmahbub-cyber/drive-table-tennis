'use client'

import { useRef, useState } from 'react'
import { LoadingOverlay } from '@/components/loading-overlay'
import { MatchStopwatch } from '@/components/match-stopwatch'
import { Stepper } from '@/components/stepper'
import { formatDuration } from '@/lib/stats'
import { logMatch } from '@/app/actions/matches'
import { buildLogFields, type SessionState } from '@/lib/seeder-session'
import type { Matchup, PlayerRef } from '@/lib/seeder'

function nameOf(session: SessionState, id: string) {
  return session.roster.find((p) => p.id === id)?.name ?? '—'
}

export function SeederQueue({
  session, players, onStart, onFinish, onAddPlayer, onGenerateMore, onRemovePlayer, onClear,
}: {
  session: SessionState
  players: PlayerRef[]
  onStart: (id: string, now: number) => void
  onFinish: (id: string, score: [number, number], durationSeconds: number) => void
  onAddPlayer: (p: PlayerRef) => void
  onGenerateMore: (minutes: number) => void
  onRemovePlayer: (id: string) => void
  onClear: () => void
}) {
  const done = session.queue.filter((m) => m.status === 'done')
  const active = session.queue.find((m) => m.status === 'playing') ?? null
  const upcoming = session.queue.filter((m) => m.status === 'pending')

  return (
    <div className="space-y-6">
      <ActiveCard
        key={(active ?? upcoming[0])?.id ?? 'none'}
        session={session}
        active={active}
        firstPending={upcoming[0] ?? null}
        onStart={onStart}
        onFinish={onFinish}
      />

      {upcoming.length > 0 && (
        <div className="space-y-1.5">
          <div className="section-header font-display">Up next</div>
          <ol className="space-y-1">
            {upcoming.slice(active ? 0 : 1).map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
              >
                <span>
                  {nameOf(session, m.aId)} <span className="text-muted-foreground">vs</span>{' '}
                  {nameOf(session, m.bId)}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {done.length > 0 && (
        <div className="space-y-1.5">
          <div className="section-header font-display">Played ({done.length})</div>
          <ol className="space-y-1">
            {done.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-sm text-muted-foreground"
              >
                <span>
                  {nameOf(session, m.aId)} vs {nameOf(session, m.bId)}
                </span>
                <span className="font-mono nums">{m.score ? `${m.score[0]}–${m.score[1]}` : ''}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      <SeederControls
        session={session}
        players={players}
        onAddPlayer={onAddPlayer}
        onGenerateMore={onGenerateMore}
        onRemovePlayer={onRemovePlayer}
        onClear={onClear}
      />
    </div>
  )
}

function ActiveCard({
  session,
  active,
  firstPending,
  onStart,
  onFinish,
}: {
  session: SessionState
  active: Matchup | null
  firstPending: Matchup | null
  onStart: (id: string, now: number) => void
  onFinish: (id: string, score: [number, number], durationSeconds: number) => void
}) {
  const current = active ?? firstPending
  const [duration, setDuration] = useState(0)
  const [timerRunning, setTimerRunning] = useState(true)
  const [a, setA] = useState<number | ''>('')
  const [b, setB] = useState<number | ''>('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const submitting = useRef(false)

  if (!current) {
    return (
      <div className="rounded-lg border border-border px-4 py-6 text-center text-sm text-muted-foreground">
        All games played. Generate more below.
      </div>
    )
  }

  const isPlaying = current.status === 'playing'

  async function save() {
    if (submitting.current) return
    if (a === '' || b === '') {
      setError('Enter both scores.')
      return
    }
    submitting.current = true
    setError(null)
    setPending(true)
    try {
      const fields = buildLogFields(current!, [Number(a), Number(b)], duration, new Date().toISOString())
      const fd = new FormData()
      Object.entries(fields).forEach(([k, v]) => fd.set(k, v))
      const r = await logMatch(fd)
      if (r && 'error' in r) {
        setError(r.error ?? 'Could not save.')
        return
      }
      onFinish(current!.id, [Number(a), Number(b)], duration)
      setDuration(0)
      setA('')
      setB('')
    } finally {
      setPending(false)
      submitting.current = false
    }
  }

  return (
    <div className="rounded-lg border border-primary/40 bg-primary/5 p-4 space-y-4">
      <LoadingOverlay open={pending} label="Saving game…" />
      <div className="text-center">
        <span className="font-display text-xl font-bold">{nameOf(session, current.aId)}</span>
        <span className="mx-2 text-muted-foreground">vs</span>
        <span className="font-display text-xl font-bold">{nameOf(session, current.bId)}</span>
      </div>

      {!isPlaying ? (
        <button
          type="button"
          onClick={() => onStart(current.id, Date.now())}
          className="w-full rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Start game
        </button>
      ) : (
        <div className="space-y-4">
          <MatchStopwatch
            value={duration}
            onChange={setDuration}
            running={timerRunning}
            onRunningChange={setTimerRunning}
          />
          <div className="flex items-center justify-center gap-3">
            <Stepper name="a" ariaLabel="player A score" defaultValue={a} onValueChange={setA} />
            <span className="text-muted-foreground">–</span>
            <Stepper name="b" ariaLabel="player B score" defaultValue={b} onValueChange={setB} />
          </div>
          {error && <div className="text-sm text-loss text-center">{error}</div>}
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="w-full rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {pending ? 'Saving…' : `Save ${formatDuration(duration)}`}
          </button>
        </div>
      )}
    </div>
  )
}

function SeederControls({
  session, players, onAddPlayer, onGenerateMore, onRemovePlayer, onClear,
}: {
  session: SessionState
  players: PlayerRef[]
  onAddPlayer: (p: PlayerRef) => void
  onGenerateMore: (minutes: number) => void
  onRemovePlayer: (id: string) => void
  onClear: () => void
}) {
  const [adding, setAdding] = useState(false)
  const [moreMinutes, setMoreMinutes] = useState(15)
  const available = players.filter((p) => !session.roster.some((r) => r.id === p.id))

  return (
    <div className="space-y-4 border-t border-border pt-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="section-header font-display">In session ({session.roster.length})</span>
          <button type="button" onClick={() => setAdding((v) => !v)} className="text-sm text-primary">
            {adding ? 'Done' : '+ Add player'}
          </button>
        </div>
        {adding && (
          <div className="grid grid-cols-2 gap-2">
            {available.length === 0 && (
              <p className="text-xs text-muted-foreground">Everyone active is in.</p>
            )}
            {available.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onAddPlayer(p)}
                className="flex items-center justify-between rounded-md border border-input px-3 py-2 text-sm hover:bg-secondary"
              >
                <span className="truncate">{p.name}</span>
                <span className="ml-2 font-mono nums text-xs text-muted-foreground">{p.elo}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {session.roster.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs"
            >
              {p.name}
              <button
                type="button"
                aria-label={`remove ${p.name}`}
                onClick={() => onRemovePlayer(p.id)}
                className="text-muted-foreground hover:text-loss"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-end gap-3">
        <label className="block">
          <span className="font-display uppercase tracking-widest text-xs text-muted-foreground">
            More minutes
          </span>
          <input
            type="number"
            min={1}
            max={600}
            value={moreMinutes}
            onChange={(e) => setMoreMinutes(Math.max(1, Number(e.target.value) || 0))}
            className="mt-1.5 block w-24 rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <button
          type="button"
          onClick={() => onGenerateMore(moreMinutes)}
          className="rounded-md border border-primary px-4 py-2 text-sm text-primary hover:bg-primary/10"
        >
          Generate more
        </button>
      </div>

      <button
        type="button"
        onClick={onClear}
        className="text-sm text-muted-foreground hover:text-loss"
      >
        Clear session
      </button>
    </div>
  )
}

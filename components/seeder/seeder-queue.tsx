'use client'

import { useRef, useState } from 'react'
import { LoadingOverlay } from '@/components/loading-overlay'
import { DurationPill } from '@/components/flip-pad/duration-pill'
import { FlipCard } from '@/components/flip-pad/flip-card'
import { canBank, gamePoint as calcGamePoint, type LiveGame } from '@/lib/flip-pad'
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
  const [a, setA] = useState<number | null>(0)
  const [b, setB] = useState<number | null>(0)
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
  const live: LiveGame = [a, b]
  const leadA = a !== null && (b === null || a > b)
  const leadB = b !== null && (a === null || b > a)
  const gp = calcGamePoint(live, session.config.target)

  async function save() {
    if (submitting.current) return
    if (a === null || b === null) {
      setError('Enter both scores.')
      return
    }
    submitting.current = true
    setError(null)
    setPending(true)
    try {
      const fields = buildLogFields(current!, [a, b], duration, new Date().toISOString())
      const fd = new FormData()
      Object.entries(fields).forEach(([k, v]) => fd.set(k, v))
      const r = await logMatch(fd)
      if (r && 'error' in r) {
        setError(r.error ?? 'Could not save.')
        return
      }
      onFinish(current!.id, [a, b], duration)
      setDuration(0)
      setA(0)
      setB(0)
    } finally {
      setPending(false)
      submitting.current = false
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
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
          <div className="flex items-end justify-center gap-5 rounded-[13px] bg-linear-to-b from-[#2a2d33] to-[#1b1d22] px-3 py-3 shadow-[0_5px_12px_rgba(0,0,0,0.22)]">
            <FlipCard value={a} name={nameOf(session, current.aId)} lead={leadA} gamePoint={gp.a} onChange={setA} />
            <div className="flex flex-col items-center gap-0.5 self-center text-[9px] uppercase tracking-wider text-[#9aa3b2]">
              <span>To</span>
              <span className="font-mono nums text-lg font-bold text-white">{session.config.target}</span>
            </div>
            <FlipCard value={b} name={nameOf(session, current.bId)} lead={leadB} gamePoint={gp.b} onChange={setB} />
          </div>
          {error && <div className="text-sm text-loss text-center">{error}</div>}
          <div className="flex items-center justify-between gap-2">
            <DurationPill value={duration} onChange={setDuration} autoStart />
            <button
              type="button"
              onClick={save}
              disabled={pending || !canBank(live)}
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {pending ? 'Saving…' : 'Save'}
            </button>
          </div>
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

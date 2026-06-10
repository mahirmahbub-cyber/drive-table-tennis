'use client'

import { useMemo, useState } from 'react'
import { Stepper } from '@/components/stepper'
import { projectGamesWon } from '@/lib/elo'

type PlayerOption = {
  id: string
  name: string
  nickname: string | null
  currentElo: number
}

function DeltaBadge({ delta }: { delta: number }) {
  const tone =
    delta > 0 ? 'text-gain' : delta < 0 ? 'text-loss' : 'text-muted-foreground'
  const sign = delta > 0 ? '+' : ''
  return (
    <span className={`font-mono font-bold ${tone}`}>
      {sign}
      {delta}
    </span>
  )
}

export function EloCalculator({ players }: { players: PlayerOption[] }) {
  const [aId, setAId] = useState('')
  const [bId, setBId] = useState('')
  const [gamesA, setGamesA] = useState(0)
  const [gamesB, setGamesB] = useState(0)

  const samePlayer = aId !== '' && aId === bId
  const nameFor = (id: string) => players.find((p) => p.id === id)?.name ?? 'Player'

  const projection = useMemo(() => {
    const pa = players.find((p) => p.id === aId)
    const pb = players.find((p) => p.id === bId)
    if (!pa || !pb || aId === bId || gamesA + gamesB === 0) return null
    return projectGamesWon(pa.currentElo, pb.currentElo, gamesA, gamesB)
  }, [players, aId, bId, gamesA, gamesB])

  return (
    <div className="space-y-6">
      {/* Players */}
      <div className="grid grid-cols-2 gap-4">
        {(['A', 'B'] as const).map((side) => {
          const value = side === 'A' ? aId : bId
          const setValue = side === 'A' ? setAId : setBId
          return (
            <label key={side} className="block">
              <span className="font-display uppercase tracking-widest text-xs text-muted-foreground">
                Player {side}
              </span>
              <select
                value={value}
                onChange={(e) => setValue(e.target.value)}
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

      {samePlayer && (
        <div className="rounded-md border border-border px-3 py-2 text-center text-sm text-muted-foreground">
          Pick two different players.
        </div>
      )}

      {/* Games won */}
      <fieldset className="grid grid-cols-2 gap-4">
        <legend className="section-header font-display w-full">Games won</legend>
        {(['A', 'B'] as const).map((side) => {
          const id = side === 'A' ? aId : bId
          return (
            <label key={side} className="flex flex-col gap-1.5">
              <span className="font-mono text-xs text-muted-foreground">
                {id ? nameFor(id) : `Player ${side}`}
              </span>
              <Stepper
                name={side === 'A' ? 'gamesA' : 'gamesB'}
                ariaLabel={`games won by player ${side}`}
                defaultValue={0}
                min={0}
                max={7}
                onValueChange={(v) =>
                  (side === 'A' ? setGamesA : setGamesB)(v === '' ? 0 : Math.round(v))
                }
              />
            </label>
          )
        })}
      </fieldset>

      {/* Projection */}
      {projection && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {[
              {
                side: 'A' as const,
                id: aId,
                before: projection.eloABefore,
                after: projection.eloAAfter,
                delta: projection.deltaA,
              },
              {
                side: 'B' as const,
                id: bId,
                before: projection.eloBBefore,
                after: projection.eloBAfter,
                delta: projection.deltaB,
              },
            ].map((row) => (
              <div key={row.side} className="rounded-lg border border-border bg-card p-4">
                <div className="font-display text-sm font-semibold">{nameFor(row.id)}</div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-mono nums text-muted-foreground">{row.before}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-mono nums text-xl font-bold">{row.after}</span>
                  <DeltaBadge delta={row.delta} />
                </div>
              </div>
            ))}
          </div>

          {/* Per-game breakdown */}
          <div className="rounded-lg border border-border bg-card">
            <div className="section-header font-display border-b border-border px-4 py-2">
              Game by game
            </div>
            <ol className="divide-y divide-border">
              {projection.steps.map((step) => (
                <li
                  key={step.game}
                  className="flex items-center justify-between px-4 py-2 text-sm"
                >
                  <span className="text-muted-foreground">
                    Game {step.game} · {nameFor(step.winner === 'A' ? aId : bId)} wins
                  </span>
                  <span className="font-mono nums">
                    {step.eloA} · {step.eloB}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {!projection && !samePlayer && (
        <p className="text-sm text-muted-foreground">
          Pick both players and enter how many games each wins to see the projection.
        </p>
      )}
    </div>
  )
}

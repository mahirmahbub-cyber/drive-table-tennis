'use client'

import type { PlayerRef, Target } from '@/lib/seeder'
import type { SessionState } from '@/lib/seeder-session'

const TARGETS: Target[] = [7, 11, 21]

export function SeederSetup({
  players,
  session,
  onToggle,
  onConfig,
  onGenerate,
}: {
  players: PlayerRef[]
  session: SessionState
  onToggle: (p: PlayerRef) => void
  onConfig: (partial: Partial<{ target: Target; minutes: number; mix: number }>) => void
  onGenerate: () => void
}) {
  const inRoster = (id: string) => session.roster.some((r) => r.id === id)
  const { config, roster } = session

  return (
    <div className="space-y-6">
      <fieldset className="space-y-2">
        <legend className="section-header font-display w-full">Players ({roster.length})</legend>
        <div className="grid grid-cols-2 gap-2">
          {players.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onToggle(p)}
              aria-pressed={inRoster(p.id)}
              className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors ${
                inRoster(p.id)
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-input text-foreground hover:bg-secondary'
              }`}
            >
              <span className="truncate">{p.name}</span>
              <span className="ml-2 font-mono nums text-xs text-muted-foreground">{p.elo}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2">
        <div className="section-header font-display">Game to</div>
        <div className="flex gap-1 rounded-lg bg-secondary p-1">
          {TARGETS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onConfig({ target: t })}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                config.target === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="font-display uppercase tracking-widest text-xs text-muted-foreground">
          Time available (minutes)
        </span>
        <input
          type="number"
          min={1}
          max={600}
          value={config.minutes}
          onChange={(e) => onConfig({ minutes: Math.max(1, Number(e.target.value) || 0) })}
          className="mt-1.5 block w-28 rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </label>

      <label className="block">
        <span className="font-display uppercase tracking-widest text-xs text-muted-foreground">
          Mix · {Math.round(config.mix * 100)}% upsets
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(config.mix * 100)}
          onChange={(e) => onConfig({ mix: Number(e.target.value) / 100 })}
          className="mt-2 block w-full"
        />
        <span className="text-xs text-muted-foreground">Competitive ↔ Mixed</span>
      </label>

      <button
        type="button"
        onClick={onGenerate}
        disabled={roster.length < 2}
        className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        Generate games
      </button>
      {roster.length < 2 && (
        <p className="text-xs text-muted-foreground">Add at least two players to generate.</p>
      )}
    </div>
  )
}

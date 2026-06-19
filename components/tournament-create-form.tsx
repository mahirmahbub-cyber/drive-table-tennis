'use client'

import { useRef, useState } from 'react'
import { LoadingOverlay } from '@/components/loading-overlay'
import { createTournament } from '@/app/actions/tournaments'

type PlayerOption = { id: string; name: string; currentElo: number }

export function TournamentCreateForm({ players }: { players: PlayerOption[] }) {
  const [selected, setSelected] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const submitting = useRef(false)

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }

  function move(id: string, dir: -1 | 1) {
    setSelected((s) => {
      const i = s.indexOf(id)
      if (i < 0) return s
      const j = i + dir
      if (j < 0 || j >= s.length) return s
      const copy = [...s]
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
      return copy
    })
  }

  function autoSeed() {
    const byElo = [...selected].sort(
      (a, b) =>
        (players.find((p) => p.id === b)?.currentElo ?? 0) -
        (players.find((p) => p.id === a)?.currentElo ?? 0)
    )
    setSelected(byElo)
  }

  async function handle(formData: FormData) {
    if (submitting.current) return
    submitting.current = true
    setError(null)
    setPending(true)
    formData.set('seedOrder', JSON.stringify(selected))
    for (const id of selected) formData.append('playerIds', id)
    try {
      const r = await createTournament(formData)
      if (r && 'error' in r) setError(r.error)
    } finally {
      setPending(false)
      submitting.current = false
    }
  }

  return (
    <form action={handle} className="space-y-6">
      <LoadingOverlay open={pending} label="Creating tournament…" />
      <label className="block">
        <span className="text-sm font-medium">Tournament name</span>
        <input
          name="name"
          required
          maxLength={80}
          className="mt-1 w-full rounded border px-3 py-2"
        />
      </label>

      <div>
        <h3 className="mb-2 text-sm font-medium">Available players</h3>
        <ul className="grid grid-cols-2 gap-1 text-sm">
          {players.map((p) => (
            <li key={p.id}>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selected.includes(p.id)}
                  onChange={() => toggle(p.id)}
                />
                {p.name}{' '}
                <span className="text-zinc-500">({p.currentElo})</span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-medium">Seed order</h3>
          <button
            type="button"
            onClick={autoSeed}
            className="text-xs text-zinc-600 underline"
          >
            Auto-seed by ELO
          </button>
        </div>
        <ol className="space-y-1 rounded border p-2 text-sm">
          {selected.length === 0 && (
            <li className="text-zinc-500">No players selected yet.</li>
          )}
          {selected.map((id, i) => {
            const p = players.find((x) => x.id === id)!
            return (
              <li key={id} className="flex items-center gap-2">
                <span className="w-6 font-mono tabular-nums text-zinc-500">{i + 1}.</span>
                <span className="flex-1">
                  {p.name}{' '}
                  <span className="text-zinc-500">({p.currentElo})</span>
                </span>
                <button type="button" onClick={() => move(id, -1)} className="text-xs">▲</button>
                <button type="button" onClick={() => move(id, 1)} className="text-xs">▼</button>
              </li>
            )
          })}
        </ol>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}
      <button
        type="submit"
        disabled={selected.length < 2 || pending}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        Start tournament
      </button>
    </form>
  )
}

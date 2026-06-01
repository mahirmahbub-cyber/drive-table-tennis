'use client'

import { useState } from 'react'
import { logMatch } from '@/app/actions/matches'

type PlayerOption = { id: string; name: string; nickname: string | null; currentElo: number }

export function MatchLogForm({ players }: { players: PlayerOption[] }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handle(formData: FormData) {
    setError(null)
    setPending(true)
    const r = await logMatch(formData)
    setPending(false)
    if (r && 'error' in r) setError(r.error ?? null)
  }

  return (
    <form action={handle} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className="text-sm font-medium">Player A</span>
          <select name="playerAId" required className="mt-1 w-full rounded border px-2 py-2">
            <option value="">—</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.currentElo})
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Player B</span>
          <select name="playerBId" required className="mt-1 w-full rounded border px-2 py-2">
            <option value="">—</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.currentElo})
              </option>
            ))}
          </select>
        </label>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Set scores (leave blank for unused sets)</legend>
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-12 text-sm text-zinc-500">Set {i + 1}</span>
            <input
              name={`set_${i}_a`}
              type="number"
              min={0}
              max={99}
              className="w-20 rounded border px-2 py-1"
            />
            <span>–</span>
            <input
              name={`set_${i}_b`}
              type="number"
              min={0}
              max={99}
              className="w-20 rounded border px-2 py-1"
            />
          </div>
        ))}
      </fieldset>
      {error && <div className="text-sm text-red-600">{error}</div>}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Save match'}
      </button>
    </form>
  )
}

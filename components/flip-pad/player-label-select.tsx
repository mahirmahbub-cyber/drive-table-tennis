'use client'

type PlayerOption = { id: string; name: string; nickname: string | null; currentElo: number }

export function PlayerLabelSelect({
  players,
  value,
  exclude,
  onChange,
}: {
  players: PlayerOption[]
  value: string
  exclude?: string
  onChange: (id: string) => void
}) {
  const opts = players.filter((p) => p.id !== exclude || p.id === value)
  const selected = players.find((p) => p.id === value)
  const first = selected ? selected.name.split(' ')[0] : 'Pick'

  return (
    <div className="relative inline-flex max-w-[92px] items-center gap-1 text-[#e7c86a]">
      <span className="truncate text-xs font-bold uppercase tracking-wide">{first}</span>
      <span aria-hidden className="text-[8px] opacity-70">▼</span>
      <select
        aria-label="select player"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 cursor-pointer text-foreground opacity-0"
      >
        <option value="" className="text-foreground">—</option>
        {opts.map((p) => (
          <option key={p.id} value={p.id} className="text-foreground">
            {p.name} ({p.currentElo})
          </option>
        ))}
      </select>
    </div>
  )
}

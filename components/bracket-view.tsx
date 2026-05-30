import Link from 'next/link'

export type BracketMatch = {
  id: string
  round: number
  bracketSlot: number
  playerA: { id: string; name: string } | null
  playerB: { id: string; name: string } | null
  winnerId: string | null
  setScores: Array<[number, number]> | null
}

export function BracketView({
  matches,
  href,
}: {
  matches: BracketMatch[]
  href?: (m: BracketMatch) => string | null
}) {
  const byRound = new Map<number, BracketMatch[]>()
  for (const m of matches) {
    if (!byRound.has(m.round)) byRound.set(m.round, [])
    byRound.get(m.round)!.push(m)
  }
  const rounds = [...byRound.keys()].sort((a, b) => a - b)

  return (
    <div className="flex gap-6 overflow-x-auto">
      {rounds.map((r) => (
        <div key={r} className="min-w-[200px] space-y-3">
          <div className="text-xs uppercase tracking-wide text-zinc-500">Round {r}</div>
          {byRound.get(r)!.map((m) => {
            const link = href?.(m)
            const content = (
              <div className="rounded border p-2 text-sm">
                <div className={m.winnerId === m.playerA?.id ? 'font-semibold' : ''}>
                  {m.playerA?.name ?? 'TBD'}
                </div>
                <div className={m.winnerId === m.playerB?.id ? 'font-semibold' : ''}>
                  {m.playerB?.name ?? 'TBD'}
                </div>
                {m.setScores && (
                  <div className="mt-1 font-mono text-xs tabular-nums text-zinc-500">
                    {m.setScores.map(([a, b]) => `${a}-${b}`).join(' ')}
                  </div>
                )}
              </div>
            )
            return link ? (
              <Link key={m.id} href={link}>
                {content}
              </Link>
            ) : (
              <div key={m.id}>{content}</div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

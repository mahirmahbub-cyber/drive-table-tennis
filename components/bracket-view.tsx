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
  const totalRounds = rounds.length

  return (
    <div className="flex gap-0 overflow-x-auto">
      {rounds.map((r, roundIdx) => {
        const isLast = roundIdx === totalRounds - 1
        return (
          <div key={r} className="flex flex-col min-w-[180px]">
            {/* Round label */}
            <div className="px-3 py-2 text-xs font-display uppercase tracking-widest text-muted-foreground border-b border-border">
              {isLast ? 'Final' : roundIdx === totalRounds - 2 ? 'Semi' : `R${r}`}
            </div>

            {/* Matches */}
            <div className="flex flex-col divide-y divide-border border-r border-border">
              {byRound.get(r)!.map((m) => {
                const link = href?.(m)
                const inner = (
                  <div className="px-3 py-2.5 text-sm hover:bg-secondary/50 transition-colors duration-100">
                    <BracketSlot
                      name={m.playerA?.name ?? 'TBD'}
                      isWinner={!!m.winnerId && m.winnerId === m.playerA?.id}
                      isPending={!m.winnerId}
                    />
                    <div className="my-1 border-t border-border/50" />
                    <BracketSlot
                      name={m.playerB?.name ?? 'TBD'}
                      isWinner={!!m.winnerId && m.winnerId === m.playerB?.id}
                      isPending={!m.winnerId}
                    />
                    {m.setScores && m.setScores.length > 0 && (
                      <div className="mt-1.5 font-mono nums text-xs text-muted-foreground">
                        {m.setScores.map(([a, b]) => `${a}–${b}`).join('  ')}
                      </div>
                    )}
                  </div>
                )

                return link ? (
                  <Link key={m.id} href={link} className="block">
                    {inner}
                  </Link>
                ) : (
                  <div key={m.id}>{inner}</div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function BracketSlot({
  name,
  isWinner,
  isPending,
}: {
  name: string
  isWinner: boolean
  isPending: boolean
}) {
  return (
    <div
      className={`flex items-center gap-2 ${
        isWinner
          ? 'text-gain font-semibold'
          : isPending
          ? 'text-foreground'
          : 'text-muted-foreground line-through'
      }`}
    >
      {isWinner && (
        <span className="w-1.5 h-1.5 rounded-full bg-gain shrink-0" />
      )}
      {!isWinner && <span className="w-1.5 h-1.5 shrink-0" />}
      <span className="truncate">{name}</span>
    </div>
  )
}

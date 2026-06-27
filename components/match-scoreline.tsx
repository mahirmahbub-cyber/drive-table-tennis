import Link from 'next/link'

type SetScore = [number, number]

export function MatchScoreline({
  aId,
  aName,
  bId,
  bName,
  winnerId,
  sets,
}: {
  aId: string
  aName: string
  bId: string
  bName: string
  winnerId: string | null
  sets: SetScore[]
}) {
  const aWon = winnerId === aId
  const bWon = winnerId === bId
  const aFirst = aName.split(' ')[0]
  const bFirst = bName.split(' ')[0]

  return (
    // Matchup + scores scroll horizontally when they overflow; surrounding columns stay pinned
    <div className="min-w-0 flex-1 overflow-x-auto">
      <div className="grid w-max min-w-full grid-cols-[1fr_auto_1fr] items-center gap-2">
        {/* left player — pushed to the left edge, crown on outer edge */}
        <div className="flex items-center justify-start gap-1.5 whitespace-nowrap">
          {aWon && <span className="leading-none" aria-hidden>👑</span>}
          <Link
            href={`/players/${aId}`}
            className={`transition-colors duration-150 ${aWon
              ? 'font-semibold text-foreground hover:text-primary'
              : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            <span className="sm:hidden">{aFirst}</span>
            <span className="hidden sm:inline">{aName}</span>
          </Link>
        </div>

        {/* score — always centred in the row */}
        <span className="whitespace-nowrap text-center font-mono text-xs nums tracking-tight text-muted-foreground">
          {sets.map(([sa, sb]) => `${sa}–${sb}`).join('  ')}
        </span>

        {/* right player — pushed to the right edge, crown on outer edge */}
        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
          <Link
            href={`/players/${bId}`}
            className={`transition-colors duration-150 ${bWon
              ? 'font-semibold text-foreground hover:text-primary'
              : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            <span className="sm:hidden">{bFirst}</span>
            <span className="hidden sm:inline">{bName}</span>
          </Link>
          {bWon && <span className="leading-none" aria-hidden>👑</span>}
        </div>
      </div>
    </div>
  )
}

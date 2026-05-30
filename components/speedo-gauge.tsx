// Sweep geometry: a 270° tachometer dial, gap at the bottom.
const START = 135 // degrees, lower-left
const SWEEP = 270 // clockwise to lower-right

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function arcPath(cx: number, cy: number, r: number, fromDeg: number, toDeg: number) {
  const a = polar(cx, cy, r, fromDeg)
  const b = polar(cx, cy, r, toDeg)
  const large = toDeg - fromDeg > 180 ? 1 : 0
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${large} 1 ${b.x} ${b.y}`
}

export function SpeedoGauge({
  elo,
  min = 800,
  max = 2000,
  label,
  size = 'lg',
}: {
  elo: number
  min?: number
  max?: number
  label?: string
  size?: 'lg' | 'sm'
}) {
  const dim = size === 'lg' ? 200 : 64
  const stroke = size === 'lg' ? 14 : 6
  const cx = 100
  const cy = 100
  const r = 100 - stroke / 2 - 4

  const t = Math.max(0, Math.min(1, (elo - min) / (max - min)))
  const needleDeg = START + t * SWEEP
  const needleEnd = polar(cx, cy, r - stroke / 2 - (size === 'lg' ? 6 : 2), needleDeg)

  const track = arcPath(cx, cy, r, START, START + SWEEP)
  const value = t > 0 ? arcPath(cx, cy, r, START, needleDeg) : null

  return (
    <div
      className="relative inline-flex flex-col items-center justify-center select-none"
      style={{ width: dim, height: dim }}
      role="img"
      aria-label={`${label ? label + ': ' : ''}ELO ${Math.round(elo)}`}
    >
      <svg viewBox="0 0 200 200" width={dim} height={dim} className="overflow-visible">
        <defs>
          <linearGradient id="speedo-arc" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#2960c5" />
            <stop offset="60%" stopColor="#3b97fa" />
            <stop offset="100%" stopColor="#ff5e55" />
          </linearGradient>
        </defs>

        {/* track */}
        <path
          d={track}
          fill="none"
          stroke="var(--border)"
          strokeWidth={stroke}
          strokeLinecap="round"
        />

        {/* value arc — fills from start to the current value */}
        {value && (
          <path
            d={value}
            fill="none"
            stroke="url(#speedo-arc)"
            strokeWidth={stroke}
            strokeLinecap="round"
          />
        )}

        {/* needle pointing at the current value */}
        <line
          x1={cx}
          y1={cy}
          x2={needleEnd.x}
          y2={needleEnd.y}
          stroke="var(--foreground)"
          strokeWidth={size === 'lg' ? 3 : 1.75}
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r={size === 'lg' ? 7 : 3.5} fill="var(--foreground)" />
      </svg>

      {size === 'lg' && (
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-5 pointer-events-none">
          <span className="font-display text-4xl font-bold leading-none nums text-foreground">
            {Math.round(elo)}
          </span>
          {label && (
            <span className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
              {label}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

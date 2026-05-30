'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts'

type Point = { t: number; elo: number; label: string }

export function EloChart({ data }: { data: Point[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-muted-foreground border border-border">
        No matches yet.
      </div>
    )
  }

  const baseline = data[0]?.elo ?? 1200

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid
          strokeDasharray="1 4"
          stroke="oklch(1 0 0 / 8%)"
          vertical={false}
        />
        <ReferenceLine
          y={baseline}
          stroke="oklch(1 0 0 / 12%)"
          strokeDasharray="4 4"
        />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: 'oklch(0.60 0.008 270)', fontFamily: 'var(--font-geist-mono)' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={['dataMin - 30', 'dataMax + 30']}
          tick={{ fontSize: 10, fill: 'oklch(0.60 0.008 270)', fontFamily: 'var(--font-geist-mono)' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            background: 'oklch(0.12 0.005 270)',
            border: '1px solid oklch(1 0 0 / 9%)',
            borderRadius: '2px',
            fontSize: '12px',
            fontFamily: 'var(--font-geist-mono)',
            color: 'oklch(0.96 0.003 270)',
          }}
          cursor={{ stroke: 'oklch(1 0 0 / 15%)', strokeWidth: 1 }}
        />
        <Line
          type="monotone"
          dataKey="elo"
          stroke="oklch(0.82 0.22 131)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 3, fill: 'oklch(0.82 0.22 131)', strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

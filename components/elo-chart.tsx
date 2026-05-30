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
          stroke="#e3e3e5"
          vertical={false}
        />
        <ReferenceLine
          y={baseline}
          stroke="#cfcfcf"
          strokeDasharray="4 4"
        />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: '#5f5f5f', fontFamily: 'var(--font-ibm-plex-mono)' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={['dataMin - 30', 'dataMax + 30']}
          tick={{ fontSize: 10, fill: '#5f5f5f', fontFamily: 'var(--font-ibm-plex-mono)' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            background: '#ffffff',
            border: '1px solid #e3e3e5',
            borderRadius: '8px',
            fontSize: '12px',
            fontFamily: 'var(--font-ibm-plex-mono)',
            color: '#161616',
          }}
          cursor={{ stroke: '#2960c5', strokeWidth: 1, strokeOpacity: 0.4 }}
        />
        <Line
          type="monotone"
          dataKey="elo"
          stroke="#2960c5"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4, fill: '#2960c5', strokeWidth: 0 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

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
import type { EloSwingPoint } from '@/lib/stats-engine'

export function H2hEloChart({ data, p1First }: { data: EloSwingPoint[]; p1First: string }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid strokeDasharray="1 4" vertical={false} stroke="var(--border)" />
        <ReferenceLine y={0} stroke="var(--input)" strokeDasharray="4 4" />
        <XAxis
          dataKey="matchIndex"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10, fill: '#5f5f5f', fontFamily: 'var(--font-ibm-plex-mono)' }}
        />
        <YAxis
          domain={['dataMin - 10', 'dataMax + 10']}
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10, fill: '#5f5f5f', fontFamily: 'var(--font-ibm-plex-mono)' }}
        />
        <Tooltip
          contentStyle={{
            background: '#ffffff',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            fontSize: '12px',
            fontFamily: 'var(--font-ibm-plex-mono)',
            color: '#161616',
          }}
          cursor={{ stroke: 'var(--chart-1)', strokeWidth: 1, strokeOpacity: 0.4 }}
          formatter={(value) => {
            const v = value as number
            return [`${v > 0 ? '+' : ''}${v}`, `Cumulative (${p1First})`] as [string, string]
          }}
          labelFormatter={(label) => {
            const idx = label as number
            return `Match ${idx} — ${data[idx - 1]?.date ?? ''}`
          }}
        />
        <Line
          type="monotone"
          dataKey="cumulativeDelta"
          stroke="var(--chart-1)"
          strokeWidth={2}
          dot={{ r: 3, fill: 'var(--chart-1)', strokeWidth: 0 }}
          activeDot={{ r: 5, fill: 'var(--chart-1)', strokeWidth: 0 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'

type Point = { t: number; elo: number; label: string }

export function EloChart({ data }: { data: Point[] }) {
  if (data.length === 0) {
    return <div className="text-sm text-zinc-500">No matches yet.</div>
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="2 4" opacity={0.3} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis domain={['dataMin - 20', 'dataMax + 20']} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Line type="monotone" dataKey="elo" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

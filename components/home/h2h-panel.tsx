'use client'

import { useMemo } from 'react'
import { headToHeadDetail, type EngineMatch } from '@/lib/stats-engine'
import { H2hEloChart } from '@/components/home/h2h-elo-chart'
import { PlayerAvatar } from '@/components/player-avatar'
import { formatDuration } from '@/lib/stats'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { HomePlayer } from '@/lib/home-data'

export type PairSelection = { p1Id: string | null; p2Id: string | null }

export function H2hPanel({
  players,
  matches,
  pair,
  onPairChange,
}: {
  players: HomePlayer[]
  matches: EngineMatch[]
  pair: PairSelection
  onPairChange: (pair: PairSelection) => void
}) {
  const { p1Id, p2Id } = pair
  const detail = useMemo(
    () => (p1Id && p2Id ? headToHeadDetail(matches, p1Id, p2Id) : null),
    [matches, p1Id, p2Id],
  )
  const p1 = players.find((p) => p.id === p1Id)
  const p2 = players.find((p) => p.id === p2Id)
  const first = (name?: string) => name?.split(' ')[0] ?? ''

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="section-header font-display">Head-to-Head Explorer</div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={p1Id ?? ''} onValueChange={(v) => onPairChange({ p1Id: v, p2Id })}>
          <SelectTrigger className="w-44" aria-label="Player 1">
            <SelectValue placeholder="Player 1" />
          </SelectTrigger>
          <SelectContent>
            {players.map((p) => (
              <SelectItem key={p.id} value={p.id} disabled={p.id === p2Id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="font-display text-sm text-muted-foreground">vs</span>
        <Select value={p2Id ?? ''} onValueChange={(v) => onPairChange({ p1Id, p2Id: v })}>
          <SelectTrigger className="w-44" aria-label="Player 2">
            <SelectValue placeholder="Player 2" />
          </SelectTrigger>
          <SelectContent>
            {players.map((p) => (
              <SelectItem key={p.id} value={p.id} disabled={p.id === p1Id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!detail && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Click any cell above or pick two players to explore their head-to-head.
        </p>
      )}

      {detail && detail.matchCount === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          These two haven&rsquo;t played each other yet.
        </p>
      )}

      {detail && detail.matchCount > 0 && p1 && p2 && (
        <>
          {/* VS header */}
          <div className="flex items-center justify-between gap-4 py-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <PlayerAvatar name={p1.name} photoUrl={p1.photoUrl} size={36} />
              <span className="truncate font-display font-semibold">{p1.name}</span>
            </div>
            <div className="shrink-0 text-center">
              <div className="font-display text-2xl font-bold nums">
                <span className={detail.p1MatchWins > detail.p2MatchWins ? 'text-gain' : ''}>
                  {detail.p1MatchWins}
                </span>
                <span className="mx-1 text-muted-foreground">–</span>
                <span className={detail.p2MatchWins > detail.p1MatchWins ? 'text-gain' : ''}>
                  {detail.p2MatchWins}
                </span>
              </div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {detail.matchCount} match{detail.matchCount !== 1 ? 'es' : ''}
              </div>
            </div>
            <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
              <span className="truncate text-right font-display font-semibold">{p2.name}</span>
              <PlayerAvatar name={p2.name} photoUrl={p2.photoUrl} size={36} />
            </div>
          </div>

          {/* Stat grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Game wins" value={`${detail.p1GameWins} – ${detail.p2GameWins}`} />
            <Stat
              label="Avg match time"
              value={detail.avgDurationSeconds !== null ? formatDuration(detail.avgDurationSeconds) : '—'}
            />
            <Stat
              label="Avg score diff"
              value={detail.avgScoreDifferential !== null ? `${detail.avgScoreDifferential} pts` : '—'}
            />
            <Stat
              label="ELO exchanged"
              value={`${detail.totalEloTakenByP1 >= 0 ? '+' : ''}${detail.totalEloTakenByP1} / ${detail.totalEloTakenByP2 >= 0 ? '+' : ''}${detail.totalEloTakenByP2}`}
              sub={`${first(p1.name)} / ${first(p2.name)}`}
            />
          </div>

          {/* Last-5 form */}
          {detail.last5Form.length > 0 && (
            <div>
              <div className="mb-2 font-display text-[10px] uppercase tracking-widest text-muted-foreground">
                Last {detail.last5Form.length} ({first(p1.name)}&rsquo;s view)
              </div>
              <div className="flex gap-1.5">
                {detail.last5Form.map((r, i) => (
                  <span
                    key={i}
                    className={`flex h-7 w-7 items-center justify-center rounded font-display text-xs font-bold ${
                      r === 'W' ? 'bg-gain-muted text-gain' : 'bg-muted text-loss'
                    }`}
                  >
                    {r}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ELO swing chart */}
          {detail.eloSwingSeries.length > 1 ? (
            <div>
              <div className="mb-2 font-display text-[10px] uppercase tracking-widest text-muted-foreground">
                ELO swing — cumulative taken by {first(p1.name)} off {first(p2.name)}
              </div>
              <H2hEloChart data={detail.eloSwingSeries} p1First={first(p1.name)} />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Play more matches to unlock the ELO swing chart.
            </p>
          )}
        </>
      )}
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2.5">
      <div className="font-display text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 truncate font-display text-base font-semibold nums">{value}</div>
      {sub && <div className="truncate text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  )
}

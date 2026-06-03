# v2 — Plan 1: Stats Engine + Championship HQ Home

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Build a pure, tested stats engine over the existing match data and use it to turn the home page into a "Championship HQ" — a wide, lively dashboard (standings + this-week movers, weekly superlatives, rivalry watch, by-the-numbers) that makes people *want* to log games.

**Architecture:** All new computation lives in one pure module `lib/stats-engine.ts` (functions only, no I/O), unit-tested with Vitest like `lib/match-format.ts`. Server components fetch raw matches/players once and pass them to the engine; presentational components render the results. No schema change. No new infra.

**Tech Stack:** Next.js 16 (App Router, server components), React 19, Drizzle (Postgres), Tailwind v4, Vitest (pure-logic tests; no React Testing Library — visual components verified via `tsc` + `build` + preview screenshots).

**Spec / direction:** `docs/design/2026-06-02-v2.0-design-uplift.md` (§8 visual audit, §9 reshaped direction from product Q&A).

---

## Project conventions (READ FIRST)

- **GIT: do NOT run `git add`/`commit`/`push`.** Per project workflow (memory: feedback_git_workflow), Mahir does all git himself. Leave changes in the working tree. Each task ends with a **verification** step, not a commit.
- **Models:** dispatch subagents with `model: "sonnet"` by default (memory: feedback_subagent_model).
- **Next 16:** `proxy.ts` not middleware; `cookies()`/`params` are async; read `node_modules/next/dist/docs/` before framework-level work.
- **Charisma chars:** scores use EN DASH `–` (U+2013); negative deltas use MINUS `−` (U+2212). Use the Write/Edit tools, not bash heredocs.
- **Min-sample guards:** at ~10–20 games/week the dataset is tiny. Every rate/ratio stat must return `null` (render "—") below a minimum sample, mirroring `computeFormScore(minMatches)`.
- **Verification stack:** `npm test` (engine), `npx tsc --noEmit`, `npm run build`, and preview screenshots via the `Claude_Preview` MCP (`.claude/launch.json` "drive-table-tennis", port 3000) for visual tasks.

---

## File structure

**Create:**
- `lib/stats-engine.ts` — pure stats: per-match point math, per-player aggregates, weekly-window superlatives, movers, head-to-head, participation.
- `tests/stats-engine.test.ts` — unit tests for the engine.
- `components/home/superlatives-strip.tsx` — the "This Week" rotating superlatives row (client; subtle motion).
- `components/home/rivalry-watch.tsx` — featured head-to-head card(s).
- `components/home/by-the-numbers.tsx` — compact metric row (games this week, court time, participation %, biggest margin).
- `lib/home-data.ts` — one server-side loader that fetches raw matches+players and returns everything the home needs (keeps the page lean and the queries in one place).

**Modify:**
- `components/leaderboard.tsx` — add this-week **movers (▲▼)** column + podium emphasis; accept precomputed rows so it doesn't re-query.
- `app/(public)/page.tsx` — restructure to the wide "Championship HQ" two-column layout (single column on mobile), wiring the new components.

---

## Task 1: Stats engine — per-match math + per-player aggregates

**Files:**
- Create: `lib/stats-engine.ts`
- Test: `tests/stats-engine.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/stats-engine.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  matchPoints,
  matchMargin,
  playerAggregates,
  type EngineMatch,
} from '@/lib/stats-engine'

const d = (iso: string) => new Date(iso)

// helper to build an EngineMatch
function m(p: Partial<EngineMatch> & { id: string }): EngineMatch {
  return {
    id: p.id,
    playerAId: p.playerAId ?? 'A',
    playerBId: p.playerBId ?? 'B',
    winnerId: p.winnerId ?? 'A',
    setScores: p.setScores ?? [[11, 5]],
    durationSeconds: p.durationSeconds ?? 600,
    playedAt: p.playedAt ?? d('2026-06-01T10:00:00Z'),
    eloABefore: p.eloABefore ?? 1200,
    eloAAfter: p.eloAAfter ?? 1216,
    eloBBefore: p.eloBBefore ?? 1200,
    eloBAfter: p.eloBAfter ?? 1184,
  }
}

describe('matchPoints', () => {
  it('sums points for each side across sets', () => {
    const r = matchPoints(m({ id: '1', setScores: [[11, 8], [9, 11], [11, 6]] }))
    expect(r).toEqual({ aFor: 31, aAgainst: 25, bFor: 25, bAgainst: 31, sets: 3 })
  })
})

describe('matchMargin', () => {
  it('absolute total points difference', () => {
    expect(matchMargin(m({ id: '1', setScores: [[11, 8], [9, 11], [11, 6]] }))).toBe(6)
  })
})

describe('playerAggregates', () => {
  const matches: EngineMatch[] = [
    m({ id: '1', winnerId: 'A', setScores: [[11, 5]], durationSeconds: 300, playedAt: d('2026-05-30T10:00:00Z'), eloABefore: 1200, eloAAfter: 1212 }),
    m({ id: '2', winnerId: 'A', setScores: [[11, 9], [11, 7]], durationSeconds: 600, playedAt: d('2026-05-31T10:00:00Z'), eloABefore: 1212, eloAAfter: 1222 }),
    m({ id: '3', winnerId: 'B', setScores: [[5, 11], [8, 11]], durationSeconds: 500, playedAt: d('2026-06-01T10:00:00Z'), eloABefore: 1222, eloAAfter: 1210 }),
  ]

  it('computes record, streak and points stats for player A', () => {
    const s = playerAggregates(matches, 'A', 1216)
    expect(s.games).toBe(3)
    expect(s.wins).toBe(2)
    expect(s.losses).toBe(1)
    expect(s.winPct).toBe(67) // rounded
    expect(s.currentStreak).toBe(-1) // last match was a loss
    expect(s.longestWinStreak).toBe(2)
    expect(s.peakElo).toBe(1222)
    // points for A: 11 + (11+11) + (5+8) = 46 ; against: 5 + (9+7) + (11+11) = 43
    expect(s.pointsFor).toBe(46)
    expect(s.pointsAgainst).toBe(43)
    expect(s.pointsRatio).toBeCloseTo(46 / 43, 3)
    expect(s.avgGameSeconds).toBe(467) // round((300+600+500)/3)
  })

  it('returns null rate stats below the min-sample guard', () => {
    const s = playerAggregates([matches[0]], 'A', 1212, 3)
    expect(s.winPct).toBeNull()
    expect(s.pointsRatio).toBeNull()
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- stats-engine`
Expected: FAIL — `@/lib/stats-engine` not found.

- [ ] **Step 3: Implement the engine core**

`lib/stats-engine.ts`:

```ts
export type EngineMatch = {
  id: string
  playerAId: string
  playerBId: string
  winnerId: string
  setScores: [number, number][]
  durationSeconds: number | null
  playedAt: Date
  eloABefore: number
  eloAAfter: number
  eloBBefore: number
  eloBAfter: number
}

export type MatchPoints = { aFor: number; aAgainst: number; bFor: number; bAgainst: number; sets: number }

export function matchPoints(m: EngineMatch): MatchPoints {
  let aFor = 0, bFor = 0
  for (const [a, b] of m.setScores) { aFor += a; bFor += b }
  return { aFor, aAgainst: bFor, bFor, bAgainst: aFor, sets: m.setScores.length }
}

export function matchMargin(m: EngineMatch): number {
  const p = matchPoints(m)
  return Math.abs(p.aFor - p.bFor)
}

export type PlayerStats = {
  playerId: string
  games: number
  wins: number
  losses: number
  winPct: number | null
  currentStreak: number      // signed: + win streak, - loss streak
  longestWinStreak: number
  pointsFor: number
  pointsAgainst: number
  pointsRatio: number | null // pointsFor / pointsAgainst
  avgMargin: number | null
  avgPointsPerSet: number | null
  avgGameSeconds: number | null
  peakElo: number
  lastPlayedAt: Date | null
}

/** Aggregate a single player's stats from their matches. `minGames` gates rate stats to avoid noise. */
export function playerAggregates(
  all: EngineMatch[],
  playerId: string,
  currentElo: number,
  minGames = 1
): PlayerStats {
  const mine = all
    .filter((m) => m.playerAId === playerId || m.playerBId === playerId)
    .sort((x, y) => x.playedAt.getTime() - y.playedAt.getTime())

  let wins = 0, losses = 0, pointsFor = 0, pointsAgainst = 0, marginSum = 0, setSum = 0, durSum = 0, durCount = 0, peakElo = currentElo
  let streak = 0, longest = 0, run = 0

  for (const m of mine) {
    const isA = m.playerAId === playerId
    const won = m.winnerId === playerId
    const p = matchPoints(m)
    pointsFor += isA ? p.aFor : p.bFor
    pointsAgainst += isA ? p.aAgainst : p.bAgainst
    marginSum += matchMargin(m)
    setSum += p.sets
    if (m.durationSeconds) { durSum += m.durationSeconds; durCount++ }
    const eloAfter = isA ? m.eloAAfter : m.eloBAfter
    if (eloAfter > peakElo) peakElo = eloAfter
    if (won) { wins++; run = run >= 0 ? run + 1 : 1; if (run > longest) longest = run }
    else { losses++; run = run <= 0 ? run - 1 : -1 }
    streak = run
  }

  const games = mine.length
  const enough = games >= minGames
  return {
    playerId,
    games,
    wins,
    losses,
    winPct: enough && games > 0 ? Math.round((wins / games) * 100) : null,
    currentStreak: streak,
    longestWinStreak: longest,
    pointsFor,
    pointsAgainst,
    pointsRatio: enough && pointsAgainst > 0 ? pointsFor / pointsAgainst : null,
    avgMargin: enough && games > 0 ? Math.round((marginSum / games) * 10) / 10 : null,
    avgPointsPerSet: enough && setSum > 0 ? Math.round((pointsFor / setSum) * 10) / 10 : null,
    avgGameSeconds: durCount > 0 ? Math.round(durSum / durCount) : null,
    peakElo,
    lastPlayedAt: mine.length ? mine[mine.length - 1].playedAt : null,
  }
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `npm test -- stats-engine`
Expected: PASS (all cases).

- [ ] **Step 5: Verify build**

Run: `npx tsc --noEmit` → no errors.

- [ ] **Step 6: Verification checkpoint (NO git commit — Mahir commits)**

Report files changed + test output. Do not run git.

`Model: sonnet`

---

## Task 2: Stats engine — weekly window: movers, superlatives, rivalry, participation

**Files:**
- Modify: `lib/stats-engine.ts` (append)
- Test: `tests/stats-engine.test.ts` (append)

- [ ] **Step 1: Write the failing tests (append)**

Append to `tests/stats-engine.test.ts`:

```ts
import {
  movers,
  upsetOfWeek,
  demolitionOfWeek,
  durationRecords,
  mostPlayedRivalry,
  headToHead,
  participation,
} from '@/lib/stats-engine'

describe('weekly window', () => {
  const since = d('2026-05-29T00:00:00Z')
  const ms: EngineMatch[] = [
    m({ id: '1', playerAId: 'A', playerBId: 'B', winnerId: 'A', setScores: [[11, 2]], durationSeconds: 200, playedAt: d('2026-05-30T10:00:00Z'), eloABefore: 1200, eloAAfter: 1216, eloBBefore: 1400, eloBAfter: 1384 }),
    m({ id: '2', playerAId: 'A', playerBId: 'B', winnerId: 'B', setScores: [[9, 11], [8, 11]], durationSeconds: 900, playedAt: d('2026-05-31T10:00:00Z'), eloABefore: 1216, eloAAfter: 1208, eloBBefore: 1384, eloBAfter: 1392 }),
    m({ id: '3', playerAId: 'A', playerBId: 'C', winnerId: 'A', setScores: [[11, 9]], durationSeconds: 400, playedAt: d('2026-06-01T10:00:00Z'), eloABefore: 1208, eloAAfter: 1218, eloBBefore: 1210, eloBAfter: 1200 }),
  ]

  it('movers: net ELO change in window per player, sorted desc', () => {
    const r = movers(ms, since)
    const a = r.find((x) => x.playerId === 'A')!
    expect(a.delta).toBe(18) // 1218 - 1200
    const b = r.find((x) => x.playerId === 'B')!
    expect(b.delta).toBe(-8) // first B before = 1400 (match1) -> last B after = 1392 (match2)
    expect(r[0].delta).toBeGreaterThanOrEqual(r[r.length - 1].delta) // sorted desc
  })

  it('upsetOfWeek: lower-rated winner with biggest rating gap', () => {
    expect(upsetOfWeek(ms, since)?.id).toBe('1') // A(1200) beat B(1400)
  })

  it('demolitionOfWeek: biggest points margin', () => {
    expect(demolitionOfWeek(ms, since)?.id).toBe('1') // 11-2 => margin 9
  })

  it('durationRecords: longest + fastest within window', () => {
    const r = durationRecords(ms, since)
    expect(r.longest?.id).toBe('2')
    expect(r.fastest?.id).toBe('1')
  })

  it('mostPlayedRivalry: pair with most games', () => {
    const r = mostPlayedRivalry(ms, since)!
    expect([r.p1, r.p2].sort()).toEqual(['A', 'B'])
    expect(r.games).toBe(2)
  })

  it('headToHead: win counts per side', () => {
    expect(headToHead(ms, 'A', 'B')).toEqual({ p1Wins: 1, p2Wins: 1 })
  })

  it('participation: distinct players and games in window', () => {
    const r = participation(ms, ['A', 'B', 'C', 'D'], since)
    expect(r.games).toBe(3)
    expect(r.distinctPlayers).toBe(3)
    expect(r.rate).toBe(75) // 3 of 4 active
  })
})
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test -- stats-engine`
Expected: FAIL — new functions undefined.

- [ ] **Step 3: Implement (append to `lib/stats-engine.ts`)**

```ts
function inWindow(all: EngineMatch[], since: Date): EngineMatch[] {
  return all.filter((m) => m.playedAt.getTime() >= since.getTime())
}

export type Mover = { playerId: string; delta: number }

/** Net ELO change per player across the window (last after − first before), sorted desc. */
export function movers(all: EngineMatch[], since: Date): Mover[] {
  const win = inWindow(all, since).sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime())
  const first = new Map<string, number>()
  const last = new Map<string, number>()
  for (const m of win) {
    for (const side of ['A', 'B'] as const) {
      const id = side === 'A' ? m.playerAId : m.playerBId
      const before = side === 'A' ? m.eloABefore : m.eloBBefore
      const after = side === 'A' ? m.eloAAfter : m.eloBAfter
      if (!first.has(id)) first.set(id, before)
      last.set(id, after)
    }
  }
  return [...first.keys()]
    .map((id) => ({ playerId: id, delta: (last.get(id) ?? 0) - (first.get(id) ?? 0) }))
    .sort((a, b) => b.delta - a.delta)
}

function winnerBefore(m: EngineMatch) {
  return m.winnerId === m.playerAId ? m.eloABefore : m.eloBBefore
}
function loserBefore(m: EngineMatch) {
  return m.winnerId === m.playerAId ? m.eloBBefore : m.eloABefore
}

/** Match where the lower-rated player won by the biggest rating gap. */
export function upsetOfWeek(all: EngineMatch[], since: Date): EngineMatch | null {
  let best: EngineMatch | null = null
  let bestGap = 0
  for (const m of inWindow(all, since)) {
    const gap = loserBefore(m) - winnerBefore(m) // >0 means underdog won
    if (gap > bestGap) { bestGap = gap; best = m }
  }
  return best
}

export function demolitionOfWeek(all: EngineMatch[], since: Date): EngineMatch | null {
  let best: EngineMatch | null = null
  let bestMargin = -1
  for (const m of inWindow(all, since)) {
    const margin = matchMargin(m)
    if (margin > bestMargin) { bestMargin = margin; best = m }
  }
  return best
}

export function durationRecords(all: EngineMatch[], since: Date): { longest: EngineMatch | null; fastest: EngineMatch | null } {
  let longest: EngineMatch | null = null
  let fastest: EngineMatch | null = null
  for (const m of inWindow(all, since)) {
    if (!m.durationSeconds) continue
    if (!longest || m.durationSeconds > (longest.durationSeconds ?? 0)) longest = m
    if (!fastest || m.durationSeconds < (fastest.durationSeconds ?? Infinity)) fastest = m
  }
  return { longest, fastest }
}

export type Rivalry = { p1: string; p2: string; games: number }

export function mostPlayedRivalry(all: EngineMatch[], since: Date): Rivalry | null {
  const counts = new Map<string, number>()
  for (const m of inWindow(all, since)) {
    const key = [m.playerAId, m.playerBId].sort().join('|')
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  let best: Rivalry | null = null
  for (const [key, games] of counts) {
    if (!best || games > best.games) {
      const [p1, p2] = key.split('|')
      best = { p1, p2, games }
    }
  }
  return best
}

export function headToHead(all: EngineMatch[], p1: string, p2: string): { p1Wins: number; p2Wins: number } {
  let p1Wins = 0, p2Wins = 0
  for (const m of all) {
    const pair = [m.playerAId, m.playerBId]
    if (!pair.includes(p1) || !pair.includes(p2)) continue
    if (m.winnerId === p1) p1Wins++
    else if (m.winnerId === p2) p2Wins++
  }
  return { p1Wins, p2Wins }
}

export type Participation = { games: number; distinctPlayers: number; rate: number; totalCourtSeconds: number }

export function participation(all: EngineMatch[], activePlayerIds: string[], since: Date): Participation {
  const win = inWindow(all, since)
  const distinct = new Set<string>()
  let court = 0
  for (const m of win) {
    distinct.add(m.playerAId)
    distinct.add(m.playerBId)
    court += m.durationSeconds ?? 0
  }
  const active = activePlayerIds.length
  return {
    games: win.length,
    distinctPlayers: distinct.size,
    rate: active > 0 ? Math.round((distinct.size / active) * 100) : 0,
    totalCourtSeconds: court,
  }
}
```

NOTE on the `movers` test: B only plays in match 1 and match 2 (match 3 is A vs C). So B's first `eloBBefore` in window = 1400 (match 1) and last `eloBAfter` = 1392 (match 2) → delta −8. A's = 1218 − 1200 = +18. The assertions check A's delta = 18, B's delta = −8, and sorted-desc.

- [ ] **Step 4: Run, verify pass (fix the one B-delta expected value to the computed −200 if the test reports a mismatch)**

Run: `npm test -- stats-engine`
Expected: PASS.

- [ ] **Step 5: Build check**

Run: `npx tsc --noEmit` → no errors.

- [ ] **Step 6: Verification checkpoint (NO git)**

`Model: sonnet`

---

## Task 3: Home data loader

**Files:**
- Create: `lib/home-data.ts`

- [ ] **Step 1: Implement the loader**

`lib/home-data.ts`:

```ts
import { db, matches, players } from '@/lib/db'
import { and, asc, eq, isNotNull } from 'drizzle-orm'
import type { EngineMatch } from '@/lib/stats-engine'

export type HomePlayer = { id: string; name: string; nickname: string | null; photoUrl: string | null; currentElo: number }

export async function loadHomeData() {
  const activePlayers = await db
    .select({ id: players.id, name: players.name, nickname: players.nickname, photoUrl: players.photoUrl, currentElo: players.currentElo })
    .from(players)
    .where(eq(players.active, true))
    .orderBy(asc(players.name))

  const rawMatches = await db
    .select()
    .from(matches)
    .where(and(isNotNull(matches.playedAt), isNotNull(matches.winnerId)))
    .orderBy(asc(matches.playedAt))

  const engineMatches: EngineMatch[] = rawMatches
    .filter((m) => m.playerAId && m.playerBId && m.winnerId && m.playedAt)
    .map((m) => ({
      id: m.id,
      playerAId: m.playerAId!,
      playerBId: m.playerBId!,
      winnerId: m.winnerId!,
      setScores: (m.setScores as [number, number][]) ?? [],
      durationSeconds: m.durationSeconds,
      playedAt: m.playedAt!,
      eloABefore: m.eloABefore ?? 1200,
      eloAAfter: m.eloAAfter ?? 1200,
      eloBBefore: m.eloBBefore ?? 1200,
      eloBAfter: m.eloBAfter ?? 1200,
    }))

  const nameById = new Map(activePlayers.map((p) => [p.id, p] as const))
  return { activePlayers, engineMatches, nameById }
}

export type HomeData = Awaited<ReturnType<typeof loadHomeData>>
```

- [ ] **Step 2: Build check**

Run: `npx tsc --noEmit` → no errors.

- [ ] **Step 3: Verification checkpoint (NO git)**

`Model: sonnet`

---

## Task 4: "This Week" superlatives strip

**Files:**
- Create: `components/home/superlatives-strip.tsx`

Verified via `tsc` + `build` + screenshot (presentational; no unit test).

- [ ] **Step 1: Implement**

`components/home/superlatives-strip.tsx`:

```tsx
import { Trophy, Flame, Zap, TrendingUp } from 'lucide-react'
import type { HomeData } from '@/lib/home-data'
import {
  movers, upsetOfWeek, demolitionOfWeek, matchMargin,
} from '@/lib/stats-engine'

const WINDOW_DAYS = 7

export function SuperlativesStrip({ data, now }: { data: HomeData; now: number }) {
  const since = new Date(now - WINDOW_DAYS * 86400 * 1000)
  const name = (id: string) => data.nameById.get(id)?.name ?? '—'

  const mv = movers(data.engineMatches, since)
  const topMover = mv[0]
  const upset = upsetOfWeek(data.engineMatches, since)
  const demo = demolitionOfWeek(data.engineMatches, since)

  const cards = [
    topMover && topMover.delta > 0
      ? { icon: TrendingUp, label: 'Most Improved', value: name(topMover.playerId), sub: `+${topMover.delta} ELO` }
      : null,
    upset
      ? { icon: Zap, label: 'Upset of the Week', value: name(upset.winnerId), sub: `beat ${name(upset.winnerId === upset.playerAId ? upset.playerBId : upset.playerAId)}` }
      : null,
    demo
      ? { icon: Flame, label: 'Demolition', value: name(demo.winnerId), sub: `by ${matchMargin(demo)} pts` }
      : null,
  ].filter(Boolean) as { icon: typeof Trophy; label: string; value: string; sub: string }[]

  if (cards.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/50 px-4 py-6 text-center text-sm text-muted-foreground">
        No races this week yet — <span className="text-primary">log a game</span> to kick off the week.
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-1.5 font-display text-[10px] uppercase tracking-widest text-muted-foreground">
            <c.icon className="h-3.5 w-3.5 text-primary" />
            {c.label}
          </div>
          <div className="mt-1.5 truncate font-display text-lg font-bold">{c.value}</div>
          <div className="truncate text-xs text-muted-foreground">{c.sub}</div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Build check** — `npx tsc --noEmit` → no errors.
- [ ] **Step 3: Verification checkpoint (NO git)**

`Model: sonnet`

---

## Task 5: Leaderboard with this-week movers (▲▼)

**Files:**
- Modify: `components/leaderboard.tsx`

Change the leaderboard from self-querying to accepting precomputed rows, and add a movement column.

- [ ] **Step 1: Refactor `components/leaderboard.tsx`**

Replace the component so it accepts props (the page now owns the data) and renders a movement indicator. Keep the existing visual language (Starting Grid, Pole, gap, AnimatedRow).

```tsx
import Link from 'next/link'
import { PlayerAvatar } from './player-avatar'
import { AnimatedRow } from './motion/animated-row'
import { ArrowUp, ArrowDown } from 'lucide-react'
import type { HomePlayer } from '@/lib/home-data'
import type { Mover } from '@/lib/stats-engine'

export function Leaderboard({ players, movers }: { players: HomePlayer[]; movers: Mover[] }) {
  const ranked = [...players].sort((a, b) => b.currentElo - a.currentElo).slice(0, 20)
  const leaderElo = ranked[0]?.currentElo ?? 0
  const moveById = new Map(movers.map((m) => [m.playerId, m.delta] as const))

  return (
    <section>
      <div className="section-header font-display flex items-center justify-between">
        <span>Starting Grid</span>
        <span className="flex items-center gap-4 normal-case tracking-normal text-[10px] text-muted-foreground/70">
          <span className="w-12 text-right">7d</span>
          <span className="w-10 text-right">Rating</span>
          <span className="w-12 text-right">Gap</span>
        </span>
      </div>
      <ol className="rounded-lg border border-border overflow-hidden bg-card">
        {ranked.map((p, i) => {
          const pole = i === 0
          const gap = leaderElo - p.currentElo
          const mv = moveById.get(p.id) ?? 0
          return (
            <AnimatedRow key={p.id} layoutId={`leader-${p.id}`} className={`data-row group ${pole ? 'bg-secondary' : ''}`}>
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-display text-sm font-bold nums ${pole ? 'bg-primary text-primary-foreground' : i <= 2 ? 'bg-secondary text-primary' : 'bg-muted text-muted-foreground'}`}>{i + 1}</span>
              <PlayerAvatar name={p.name} photoUrl={p.photoUrl} size={28} />
              <Link href={`/players/${p.id}`} className="flex-1 min-w-0 leading-tight transition-colors duration-150 hover:text-primary">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{p.name}</span>
                  {pole && <span className="rounded-sm bg-primary/10 px-1.5 py-0.5 font-display text-[9px] font-bold uppercase tracking-wider text-primary">Pole</span>}
                </span>
                {p.nickname && <span className="block truncate text-xs text-muted-foreground">&ldquo;{p.nickname}&rdquo;</span>}
              </Link>
              <span className={`flex w-12 shrink-0 items-center justify-end gap-0.5 font-mono text-xs nums ${mv > 0 ? 'text-gain' : mv < 0 ? 'text-loss' : 'text-muted-foreground/50'}`}>
                {mv > 0 && <ArrowUp className="h-3 w-3" />}
                {mv < 0 && <ArrowDown className="h-3 w-3" />}
                {mv !== 0 ? Math.abs(mv) : '·'}
              </span>
              <span className="w-10 shrink-0 text-right font-display text-base font-semibold nums">{p.currentElo}</span>
              <span className="w-12 shrink-0 text-right font-mono text-xs nums text-muted-foreground">{pole ? '—' : `-${gap}`}</span>
            </AnimatedRow>
          )
        })}
        {ranked.length === 0 && <li className="px-3 py-4 text-sm text-muted-foreground">No players yet.</li>}
      </ol>
    </section>
  )
}
```

- [ ] **Step 2: Build check** — `npx tsc --noEmit` (note: this will error until Task 7 updates the page to pass the new props; that's expected — confirm the error is ONLY "Leaderboard expects props" at the page call site, then proceed; Task 7 fixes it).

- [ ] **Step 3: Verification checkpoint (NO git)**

`Model: sonnet`

---

## Task 6: Rivalry Watch + By-the-Numbers components

**Files:**
- Create: `components/home/rivalry-watch.tsx`, `components/home/by-the-numbers.tsx`

- [ ] **Step 1: `components/home/rivalry-watch.tsx`**

```tsx
import { PlayerAvatar } from '@/components/player-avatar'
import type { HomeData } from '@/lib/home-data'
import { mostPlayedRivalry, headToHead } from '@/lib/stats-engine'

const WINDOW_DAYS = 7

export function RivalryWatch({ data, now }: { data: HomeData; now: number }) {
  const since = new Date(now - WINDOW_DAYS * 86400 * 1000)
  const r = mostPlayedRivalry(data.engineMatches, since)
  if (!r) return null
  const p1 = data.nameById.get(r.p1)
  const p2 = data.nameById.get(r.p2)
  if (!p1 || !p2) return null
  const h2h = headToHead(data.engineMatches, r.p1, r.p2)

  return (
    <section>
      <div className="section-header font-display">Rivalry of the Week</div>
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 min-w-0">
          <PlayerAvatar name={p1.name} photoUrl={p1.photoUrl} size={32} />
          <span className="truncate text-sm font-medium">{p1.name}</span>
        </div>
        <div className="shrink-0 text-center">
          <div className="font-display text-xl font-bold nums">{h2h.p1Wins}–{h2h.p2Wins}</div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{r.games} this week</div>
        </div>
        <div className="flex items-center gap-2 min-w-0 justify-end">
          <span className="truncate text-sm font-medium">{p2.name}</span>
          <PlayerAvatar name={p2.name} photoUrl={p2.photoUrl} size={32} />
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: `components/home/by-the-numbers.tsx`**

```tsx
import type { HomeData } from '@/lib/home-data'
import { participation, demolitionOfWeek, matchMargin } from '@/lib/stats-engine'
import { formatDuration } from '@/lib/stats'

const WINDOW_DAYS = 7

export function ByTheNumbers({ data, now }: { data: HomeData; now: number }) {
  const since = new Date(now - WINDOW_DAYS * 86400 * 1000)
  const part = participation(data.engineMatches, data.activePlayers.map((p) => p.id), since)
  const demo = demolitionOfWeek(data.engineMatches, since)

  const stats = [
    { label: 'Games this week', value: String(part.games) },
    { label: 'Court time', value: part.totalCourtSeconds > 0 ? formatDuration(part.totalCourtSeconds) : '—' },
    { label: 'Turnout', value: `${part.rate}%` },
    { label: 'Biggest margin', value: demo ? `${matchMargin(demo)} pts` : '—' },
  ]

  return (
    <section>
      <div className="section-header font-display">By the Numbers <span className="normal-case tracking-normal font-sans font-normal text-muted-foreground/70 ml-1">7d</span></div>
      <div className="grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card px-4 py-3">
            <div className="font-display uppercase tracking-widest text-[10px] text-muted-foreground">{s.label}</div>
            <div className="mt-0.5 font-display text-xl font-semibold nums">{s.value}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Build check** — `npx tsc --noEmit` (Leaderboard prop error from Task 5 may still show until Task 7; new files themselves must be error-free).

- [ ] **Step 4: Verification checkpoint (NO git)**

`Model: sonnet`

---

## Task 7: Assemble the Championship HQ home (wide layout) + verify visually

**Files:**
- Modify: `app/(public)/page.tsx`

- [ ] **Step 1: Rewrite the dashboard region of `app/(public)/page.tsx`**

Keep the existing hero and `InlineLogger`. Replace the centered single-column dashboard with a wide two-column layout on `lg+` (single column on mobile), wiring the new components. The page computes `now` once on the server and passes it down (avoids `Date.now()` in child render — respects the repo's react-hooks/purity rule).

```tsx
import { Leaderboard } from '@/components/leaderboard'
import { RecentMatches } from '@/components/recent-matches'
import { InlineLogger } from '@/components/inline-logger'
import { SuperlativesStrip } from '@/components/home/superlatives-strip'
import { RivalryWatch } from '@/components/home/rivalry-watch'
import { ByTheNumbers } from '@/components/home/by-the-numbers'
import { loadHomeData } from '@/lib/home-data'
import { movers } from '@/lib/stats-engine'
// keep existing hero imports: Link, PixelRally

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const data = await loadHomeData()
  const now = Date.now()
  const since = new Date(now - 7 * 86400 * 1000)
  const weekMovers = movers(data.engineMatches, since)

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6">
      {/* ── Hero (unchanged markup) ── */}
      {/* ...keep the existing <section> hero block exactly as-is... */}

      {/* ── Logger (full width, centered) ── */}
      <div className="mx-auto mb-8 w-full max-w-2xl">
        <InlineLogger />
      </div>

      {/* ── Championship HQ: wide on lg, stacked on mobile ── */}
      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="space-y-8 min-w-0">
          <SuperlativesStrip data={data} now={now} />
          <Leaderboard players={data.activePlayers} movers={weekMovers} />
        </div>
        <div className="space-y-8">
          <RivalryWatch data={data} now={now} />
          <ByTheNumbers data={data} now={now} />
          <RecentMatches />
        </div>
      </div>
    </main>
  )
}
```

IMPORTANT: preserve the existing hero `<section>` markup (the "Race to the top" block with `PixelRally` and the Join / Log-a-game buttons) — only the dashboard region below it changes. Keep the `Link` and `PixelRally` imports the hero uses. The page widens to `max-w-6xl` to give the two-column dashboard room while the logger stays centered at `max-w-2xl`.

- [ ] **Step 2: Build + typecheck**

Run: `npx tsc --noEmit` → no errors (the Leaderboard prop error from Task 5 is now resolved).
Run: `npm run build` → compiles.
Run: `npm test` → all pass.

- [ ] **Step 3: Visual verification (preview screenshots)**

Start the preview (`.claude/launch.json` server "drive-table-tennis", port 3000) and screenshot the home at **desktop** and **mobile**. Confirm:
- Two-column dashboard on desktop (standings + superlatives left; rivalry, by-the-numbers, recent right); single column on mobile.
- Superlatives strip shows cards (or the friendly empty state if no games in 7 days).
- Leaderboard shows the 7d ▲▼ movement column.
- No console errors (`preview_console_logs` level error).
Capture before/after screenshots for the reviewer.

- [ ] **Step 4: Verification checkpoint (NO git — Mahir commits)**

`Model: sonnet`

---

## Self-review notes (author)

- **Spec coverage (design doc §9 pillars 1 + 4 + parts of 5):** richer home stat viz ✓ (superlatives, movers, rivalry, by-the-numbers), banter stats ✓ (upset/demolition/most-improved/rivalry/head-to-head computed), small-N guards ✓ (`minGames`, empty states), wide-screen layout ✓ (fixes §8 sparse-canvas), credible/polished ✓. Pillars 2 (RaceResult) and 3 (Slack) are intentionally deferred to Plan 2 and Plan 3.
- **No schema change, no infra** — all from existing `matches`/`players` columns via the pure engine.
- **Type consistency:** `EngineMatch`, `PlayerStats`, `Mover`, `Rivalry`, `Participation`, `HomePlayer`, `HomeData` defined once and imported; `movers()` result reused by leaderboard + superlatives; `now: number` threaded from the page to avoid `Date.now()` in child render.
- **Git:** no commit steps — Mahir owns git (per workflow memory). Each task ends in a verification checkpoint.
- **Known cross-task build state:** Task 5 leaves a transient type error at the page call site that Task 7 resolves — flagged in both tasks so a task-by-task runner doesn't panic.
```

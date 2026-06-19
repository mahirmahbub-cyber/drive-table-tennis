# Table Tennis — Five Additions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Slack digest bot, blocking loading overlays + duplicate prevention, a seeder current-time fix, a desktop nav cleanup, and a 7-day leaderboard inactivity filter to the Drive Table Tennis app.

**Architecture:** Five mostly-independent workstreams. Pure logic (window math, digest builders, dedup, new stats functions) is TDD'd in `lib/`; UI wiring (overlay, nav, admin buttons) is verified in the browser preview. The Slack bot POSTs flat variable payloads to two Slack Workflow Builder webhook triggers, fired by Vercel Cron and an admin button.

**Tech Stack:** Next.js 16.2.6 (App Router), React 19, Drizzle + Postgres (Supabase), Tailwind v4, Radix, vitest. Spec: [`docs/superpowers/specs/2026-06-19-table-tennis-additions-design.md`](../specs/2026-06-19-table-tennis-additions-design.md).

---

## ⚠️ Project rules (read before any task)

- **GIT POLICY — do not run git.** Never run `git add`/`commit`/`push` (this applies to every subagent). Mahir commits manually. Each task is a clean commit boundary: finish a task, confirm green, then **stop for review** — do not commit.
- **Tests:** run with `npx vitest run <file>` (e.g. `npx vitest run lib/slack/windows.test.ts`). `npm test` runs the whole suite.
- **Lint:** `npm run lint` is broken (space in the repo path). Lint touched files with `npx eslint <paths>` instead.
- **Preview/CSS:** if you edit `globals.css`, delete `.next` before previewing (Turbopack caches it). The tasks here use Tailwind utilities only — no `globals.css` edits expected.
- **Preview verification:** `preview_click` misses React handlers and `preview_screenshot` can time out — drive interactions with `preview_eval` `.click()` and read the DOM with separate `preview_eval` calls. Never seed the live Supabase to verify; use throwaway preview fixtures.
- **Path alias:** `@/` maps to the repo root (`@/lib/...`, `@/components/...`).

## Parallelization & sequencing

- **Task 1 (stats-engine additions) must run first** — Features 1 and 5 both import from it. Doing all three new functions here removes the only shared-file conflict.
- After Task 1, the five features are independent and can be split across subagents, **except:**
  - `lib/seeder-session.ts` + `components/seeder/seeder-queue.tsx` are touched by **Task 13 (seeder time)** and **Task 11 (seeder overlay)** — assign both to the **same** subagent, Task 13 first.
- Suggested groupings: **A:** Tasks 1–8 (stats + Slack). **B:** Tasks 9–12 (overlay + player dedup). **C:** Tasks 13 (seeder time, then its overlay task 11 if not in group B). **D:** Task 14 (nav). **E:** Task 15 (leaderboard filter, depends on Task 1).

## Spec coverage map

| Spec feature | Tasks |
|---|---|
| F1 Slack digest | 1, 2, 3, 4, 5, 6, 7, 8 |
| F2 Dedup + overlay | 9 (overlay), 10 (player dedup), 11, 12 (apply overlay) |
| F3 Seeder time | 13 |
| F4 Desktop nav | 14 |
| F5 Leaderboard filter | 1 (`recentlyActive`), 15 |

---

## Task 1: stats-engine additions (`inRange`, `biggestEloSwingMatch`, `recentlyActive`)

Shared foundation for Features 1 and 5. Pure functions, TDD.

**Files:**
- Modify: `lib/stats-engine.ts` (append new exports)
- Test: `lib/stats-engine.digest.test.ts` (create)

- [ ] **Step 1: Write the failing tests**

Create `lib/stats-engine.digest.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { inRange, biggestEloSwingMatch, recentlyActive, type EngineMatch } from './stats-engine'

function m(over: Partial<EngineMatch>): EngineMatch {
  return {
    id: 'x', playerAId: 'a', playerBId: 'b', winnerId: 'a',
    setScores: [[11, 5]], durationSeconds: 300,
    playedAt: new Date('2026-06-10T00:00:00Z'),
    eloABefore: 1200, eloAAfter: 1216, eloBBefore: 1200, eloBAfter: 1184,
    ...over,
  }
}

describe('inRange', () => {
  it('keeps matches in [start, end) and drops the rest', () => {
    const all = [
      m({ id: 'before', playedAt: new Date('2026-06-07T13:59:00Z') }),
      m({ id: 'in', playedAt: new Date('2026-06-10T00:00:00Z') }),
      m({ id: 'on-end', playedAt: new Date('2026-06-14T14:00:00Z') }),
    ]
    const out = inRange(all, new Date('2026-06-07T14:00:00Z'), new Date('2026-06-14T14:00:00Z'))
    expect(out.map((x) => x.id)).toEqual(['in'])
  })
})

describe('biggestEloSwingMatch', () => {
  it('picks the match where the winner gained the most', () => {
    const all = [
      m({ id: 'small', eloABefore: 1200, eloAAfter: 1210 }),
      m({ id: 'big', eloABefore: 1200, eloAAfter: 1232 }),
      m({ id: 'tie', winnerId: null }),
    ]
    expect(biggestEloSwingMatch(all)?.id).toBe('big')
  })
  it('returns null when no match has a winner', () => {
    expect(biggestEloSwingMatch([m({ winnerId: null })])).toBeNull()
  })
})

describe('recentlyActive', () => {
  it('includes both players of matches at/after since, excludes older', () => {
    const all = [
      m({ playerAId: 'a', playerBId: 'b', playedAt: new Date('2026-06-01T00:00:00Z') }),
      m({ playerAId: 'c', playerBId: 'd', playedAt: new Date('2026-06-12T00:00:00Z') }),
    ]
    const ids = recentlyActive(all, new Date('2026-06-10T00:00:00Z'))
    expect([...ids].sort()).toEqual(['c', 'd'])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/stats-engine.digest.test.ts`
Expected: FAIL — `inRange`/`biggestEloSwingMatch`/`recentlyActive` are not exported.

- [ ] **Step 3: Implement the functions**

Append to `lib/stats-engine.ts`:

```ts
// ── Digest / activity helpers ──────────────────────────────────────────────────

/** Matches whose playedAt falls in [start, end). */
export function inRange(all: EngineMatch[], start: Date, end: Date): EngineMatch[] {
  const s = start.getTime()
  const e = end.getTime()
  return all.filter((m) => {
    const t = m.playedAt.getTime()
    return t >= s && t < e
  })
}

/** Match with the largest winner ELO delta (most rating changed hands). Null-winner matches ignored. */
export function biggestEloSwingMatch(matches: EngineMatch[]): EngineMatch | null {
  let best: EngineMatch | null = null
  let bestSwing = -1
  for (const m of matches) {
    if (!m.winnerId) continue
    const winnerIsA = m.winnerId === m.playerAId
    const swing = Math.abs(winnerIsA ? m.eloAAfter - m.eloABefore : m.eloBAfter - m.eloBBefore)
    if (swing > bestSwing) {
      bestSwing = swing
      best = m
    }
  }
  return best
}

/** Set of player ids that appear in any match played at/after `since`. */
export function recentlyActive(matches: EngineMatch[], since: Date): Set<string> {
  const s = since.getTime()
  const ids = new Set<string>()
  for (const m of matches) {
    if (m.playedAt.getTime() >= s) {
      ids.add(m.playerAId)
      ids.add(m.playerBId)
    }
  }
  return ids
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/stats-engine.digest.test.ts`
Expected: PASS (3 files of assertions green).

- [ ] **Step 5: Lint, then stop for review (no git)**

Run: `npx eslint lib/stats-engine.ts lib/stats-engine.digest.test.ts`
Expected: no errors. Then pause — Mahir reviews/commits.

---

## Task 2: Slack timezone window math (`lib/slack/windows.ts`)

**Files:**
- Create: `lib/slack/windows.ts`
- Test: `lib/slack/windows.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/slack/windows.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { yesterdayRange, lastWeekRange, formatSydneyDay, formatSydneyWeekRange } from './windows'

describe('yesterdayRange (Australia/Sydney)', () => {
  it('AEST winter: Sydney midnight is 14:00 UTC the prior day', () => {
    // 2026-06-18T05:00Z = 18 Jun 15:00 Sydney (AEST, UTC+10) → yesterday = 17 Jun
    const r = yesterdayRange(new Date('2026-06-18T05:00:00Z'))
    expect(r.start.toISOString()).toBe('2026-06-16T14:00:00.000Z')
    expect(r.end.toISOString()).toBe('2026-06-17T14:00:00.000Z')
  })
  it('AEDT summer: Sydney midnight is 13:00 UTC the prior day', () => {
    // 2026-01-15T02:00Z = 15 Jan 13:00 Sydney (AEDT, UTC+11) → yesterday = 14 Jan
    const r = yesterdayRange(new Date('2026-01-15T02:00:00Z'))
    expect(r.start.toISOString()).toBe('2026-01-13T13:00:00.000Z')
    expect(r.end.toISOString()).toBe('2026-01-14T13:00:00.000Z')
  })
})

describe('lastWeekRange (Australia/Sydney)', () => {
  it('on a Monday, returns the previous Mon→Mon week', () => {
    // 2026-06-15 is a Monday; 11:00 Sydney
    const r = lastWeekRange(new Date('2026-06-15T01:00:00Z'))
    expect(r.start.toISOString()).toBe('2026-06-07T14:00:00.000Z') // Mon 8 Jun 00:00 Sydney
    expect(r.end.toISOString()).toBe('2026-06-14T14:00:00.000Z')   // Mon 15 Jun 00:00 Sydney
  })
})

describe('formatting', () => {
  it('formats a single Sydney day', () => {
    expect(formatSydneyDay(new Date('2026-06-17T20:00:00Z'))).toBe('Thu 18 Jun') // 18 Jun 06:00 Sydney
  })
  it('formats a same-month week range', () => {
    const r = lastWeekRange(new Date('2026-06-15T01:00:00Z'))
    expect(formatSydneyWeekRange(r.start, r.end)).toBe('8–14 Jun')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run lib/slack/windows.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `lib/slack/windows.ts`:

```ts
export const SYDNEY_TZ = 'Australia/Sydney'

export type Range = { start: Date; end: Date }
type YMD = { year: number; month: number; day: number }

/** Offset in ms that `tz` is ahead of UTC at the given instant. */
function tzOffsetMs(instant: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const map: Record<string, string> = {}
  for (const p of dtf.formatToParts(instant)) map[p.type] = p.value
  const asUTC = Date.UTC(
    Number(map.year), Number(map.month) - 1, Number(map.day),
    Number(map.hour), Number(map.minute), Number(map.second),
  )
  return asUTC - instant.getTime()
}

/** Local calendar date (Y/M/D) in `tz` at the given instant. */
function ymdInTz(instant: Date, tz: string): YMD {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  })
  const map: Record<string, string> = {}
  for (const p of dtf.formatToParts(instant)) map[p.type] = p.value
  return { year: Number(map.year), month: Number(map.month), day: Number(map.day) }
}

/** UTC instant of local midnight (00:00) on the given calendar date in `tz`. */
function zonedMidnightUtc({ year, month, day }: YMD, tz: string): Date {
  const utcGuess = Date.UTC(year, month - 1, day, 0, 0, 0)
  const offset = tzOffsetMs(new Date(utcGuess), tz)
  let instant = utcGuess - offset
  const offset2 = tzOffsetMs(new Date(instant), tz)
  if (offset2 !== offset) instant = utcGuess - offset2 // DST-edge correction
  return new Date(instant)
}

/** Shift a calendar date by `days`, staying calendar-correct across month/year. */
function addDays(ymd: YMD, days: number): YMD {
  const d = new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day + days))
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }
}

/** Day of week for a calendar date: 0=Sun … 6=Sat. */
function weekday(ymd: YMD): number {
  return new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day)).getUTCDay()
}

/** Yesterday 00:00 → today 00:00, Sydney time, as UTC instants. */
export function yesterdayRange(now: Date, tz: string = SYDNEY_TZ): Range {
  const today = ymdInTz(now, tz)
  return {
    start: zonedMidnightUtc(addDays(today, -1), tz),
    end: zonedMidnightUtc(today, tz),
  }
}

/** Previous Mon 00:00 → this Mon 00:00 (last full week), Sydney time, as UTC instants. */
export function lastWeekRange(now: Date, tz: string = SYDNEY_TZ): Range {
  const today = ymdInTz(now, tz)
  const daysSinceMonday = (weekday(today) + 6) % 7
  const thisMonday = addDays(today, -daysSinceMonday)
  return {
    start: zonedMidnightUtc(addDays(thisMonday, -7), tz),
    end: zonedMidnightUtc(thisMonday, tz),
  }
}

/** "Thu 18 Jun" in Sydney time. */
export function formatSydneyDay(instant: Date, tz: string = SYDNEY_TZ): string {
  return new Intl.DateTimeFormat('en-AU', {
    timeZone: tz, weekday: 'short', day: 'numeric', month: 'short',
  }).format(instant)
}

/** "8–14 Jun" (or "29 Jun–5 Jul"); `end` is exclusive. */
export function formatSydneyWeekRange(start: Date, end: Date, tz: string = SYDNEY_TZ): string {
  const lastDay = new Date(end.getTime() - 1)
  const d = (i: Date) => new Intl.DateTimeFormat('en-AU', { timeZone: tz, day: 'numeric' }).format(i)
  const mon = (i: Date) => new Intl.DateTimeFormat('en-AU', { timeZone: tz, month: 'short' }).format(i)
  return mon(start) === mon(lastDay)
    ? `${d(start)}–${d(lastDay)} ${mon(lastDay)}`
    : `${d(start)} ${mon(start)}–${d(lastDay)} ${mon(lastDay)}`
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run lib/slack/windows.test.ts`
Expected: PASS.

- [ ] **Step 5: Lint, then stop for review**

Run: `npx eslint lib/slack/windows.ts lib/slack/windows.test.ts`

---

## Task 3: Digest builders (`lib/slack/digest.ts`)

Depends on Task 1 (`inRange`, `biggestEloSwingMatch`) and Task 2 (formatting).

**Files:**
- Create: `lib/slack/digest.ts`
- Test: `lib/slack/digest.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/slack/digest.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildWeeklyDigest, buildDailyDigest, type DigestInput, type PlayerLite } from './digest'
import type { EngineMatch } from '@/lib/stats-engine'

const players = new Map<string, PlayerLite>([
  ['a', { name: 'Alice', nickname: null }],
  ['b', { name: 'Bob', nickname: null }],
  ['c', { name: 'Carol', nickname: null }],
])

function m(over: Partial<EngineMatch>): EngineMatch {
  return {
    id: 'x', playerAId: 'a', playerBId: 'b', winnerId: 'a',
    setScores: [[11, 5]], durationSeconds: 300,
    playedAt: new Date('2026-06-10T02:00:00Z'),
    eloABefore: 1200, eloAAfter: 1216, eloBBefore: 1200, eloBAfter: 1184,
    ...over,
  }
}

const weekRange = { start: new Date('2026-06-07T14:00:00Z'), end: new Date('2026-06-14T14:00:00Z') }
const dayRange = { start: new Date('2026-06-09T14:00:00Z'), end: new Date('2026-06-10T14:00:00Z') }

describe('buildWeeklyDigest', () => {
  it('returns null when no games fall in the window', () => {
    const input: DigestInput = { engineMatches: [], playersById: players, range: weekRange }
    expect(buildWeeklyDigest(input)).toBeNull()
  })
  it('builds variables with names and counts', () => {
    const input: DigestInput = { engineMatches: [m({})], playersById: players, range: weekRange }
    const v = buildWeeklyDigest(input)!
    expect(v.games_played).toBe('1')
    expect(v.biggest_beatdown).toBe('Alice beat Bob 11–5')
    expect(v.top_risers).toContain('Alice +16')
    expect(v.biggest_fallers).toContain('Bob -16')
  })
  it('always includes every key, using — for missing data', () => {
    const input: DigestInput = { engineMatches: [m({})], playersById: players, range: weekRange }
    const v = buildWeeklyDigest(input)!
    for (const key of ['week_range','games_played','biggest_beatdown','biggest_upset','top_risers','biggest_fallers','top_rivalry','longest_game','fastest_game']) {
      expect(v[key]).toBeDefined()
    }
  })
})

describe('buildDailyDigest', () => {
  it('returns null on an empty day', () => {
    const input: DigestInput = { engineMatches: [], playersById: players, range: dayRange }
    expect(buildDailyDigest(input)).toBeNull()
  })
  it('reports the biggest swing match and winner', () => {
    const input: DigestInput = { engineMatches: [m({})], playersById: players, range: dayRange }
    const v = buildDailyDigest(input)!
    expect(v.biggest_swing_match).toBe('Alice beat Bob 11–5 · +16 ELO')
    expect(v.biggest_winner).toContain('Alice · +16 ELO')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run lib/slack/digest.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `lib/slack/digest.ts`:

```ts
import {
  inRange, biggestEloSwingMatch, movers, demolitionOfWeek, upsetOfWeek,
  mostPlayedRivalry, durationRecords, type EngineMatch,
} from '@/lib/stats-engine'
import { formatDuration } from '@/lib/stats'
import { formatSydneyDay, formatSydneyWeekRange, type Range } from '@/lib/slack/windows'

export type PlayerLite = { name: string; nickname: string | null }
export type DigestInput = {
  engineMatches: EngineMatch[]
  playersById: Map<string, PlayerLite>
  range: Range
}
export type DigestVariables = Record<string, string>

const DASH = '—'

function nameOf(input: DigestInput, id: string): string {
  return input.playersById.get(id)?.name ?? 'Unknown'
}

function winnerLoser(m: EngineMatch) {
  const winnerIsA = m.winnerId === m.playerAId
  return {
    winnerId: winnerIsA ? m.playerAId : m.playerBId,
    loserId: winnerIsA ? m.playerBId : m.playerAId,
    winnerBefore: winnerIsA ? m.eloABefore : m.eloBBefore,
    loserBefore: winnerIsA ? m.eloBBefore : m.eloABefore,
    winnerDelta: winnerIsA ? m.eloAAfter - m.eloABefore : m.eloBAfter - m.eloBBefore,
  }
}

/** Winner-oriented scoreline, e.g. "11–5" or "11–9, 9–11, 11–7". */
function scoreline(m: EngineMatch): string {
  const winnerIsA = m.winnerId === m.playerAId
  return m.setScores.map(([a, b]) => (winnerIsA ? `${a}–${b}` : `${b}–${a}`)).join(', ')
}

const signed = (n: number): string => (n > 0 ? `+${n}` : `${n}`)

export function buildWeeklyDigest(input: DigestInput): DigestVariables | null {
  const ms = inRange(input.engineMatches, input.range.start, input.range.end)
  if (ms.length === 0) return null
  const since = input.range.start

  const demo = demolitionOfWeek(ms, since)
  const upset = upsetOfWeek(ms, since)
  const mv = movers(ms, since)
  const risers = mv.filter((x) => x.delta > 0).slice(0, 3)
  const fallers = mv.filter((x) => x.delta < 0).slice(-3).reverse()
  const rivalry = mostPlayedRivalry(ms, since)
  const { longest, fastest } = durationRecords(ms, since)

  const moverLine = (x: { playerId: string; delta: number }) => `${nameOf(input, x.playerId)} ${signed(x.delta)}`
  const pair = (m: EngineMatch) => `${nameOf(input, m.playerAId)} vs ${nameOf(input, m.playerBId)}`
  const beatdown = demo ? winnerLoser(demo) : null
  const up = upset ? winnerLoser(upset) : null

  return {
    week_range: formatSydneyWeekRange(input.range.start, input.range.end),
    games_played: String(ms.length),
    biggest_beatdown: demo && beatdown
      ? `${nameOf(input, beatdown.winnerId)} beat ${nameOf(input, beatdown.loserId)} ${scoreline(demo)}`
      : DASH,
    biggest_upset: upset && up
      ? `${nameOf(input, up.winnerId)} beat ${nameOf(input, up.loserId)} (${up.winnerBefore} vs ${up.loserBefore})`
      : DASH,
    top_risers: risers.length ? risers.map(moverLine).join(' · ') : DASH,
    biggest_fallers: fallers.length ? fallers.map(moverLine).join(' · ') : DASH,
    top_rivalry: rivalry
      ? `${nameOf(input, rivalry.p1)} vs ${nameOf(input, rivalry.p2)} · ${rivalry.games} games`
      : DASH,
    longest_game: longest?.durationSeconds ? `${pair(longest)} · ${formatDuration(longest.durationSeconds)}` : DASH,
    fastest_game: fastest?.durationSeconds ? `${pair(fastest)} · ${formatDuration(fastest.durationSeconds)}` : DASH,
  }
}

export function buildDailyDigest(input: DigestInput): DigestVariables | null {
  const ms = inRange(input.engineMatches, input.range.start, input.range.end)
  if (ms.length === 0) return null
  const since = input.range.start

  const swing = biggestEloSwingMatch(ms)
  const mv = movers(ms, since)
  const top = mv[0] && mv[0].delta > 0 ? mv[0] : null

  let biggestWinner = DASH
  if (top) {
    const games = ms.filter((m) => m.playerAId === top.playerId || m.playerBId === top.playerId).length
    biggestWinner = `${nameOf(input, top.playerId)} · ${signed(top.delta)} ELO over ${games} game${games === 1 ? '' : 's'}`
  }

  let swingLine = DASH
  if (swing) {
    const wl = winnerLoser(swing)
    swingLine = `${nameOf(input, wl.winnerId)} beat ${nameOf(input, wl.loserId)} ${scoreline(swing)} · ${signed(wl.winnerDelta)} ELO`
  }

  return {
    day: formatSydneyDay(input.range.start),
    games_played: String(ms.length),
    biggest_swing_match: swingLine,
    biggest_winner: biggestWinner,
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run lib/slack/digest.test.ts`
Expected: PASS.

- [ ] **Step 5: Lint, then stop for review**

Run: `npx eslint lib/slack/digest.ts lib/slack/digest.test.ts`

---

## Task 4: Slack sender (`lib/slack/send.ts`)

**Files:**
- Create: `lib/slack/send.ts`

- [ ] **Step 1: Implement (no unit test — thin network wrapper)**

Create `lib/slack/send.ts`:

```ts
import type { DigestVariables } from '@/lib/slack/digest'

/** POST a flat variable payload to a Slack Workflow Builder webhook trigger. */
export async function postToSlackTrigger(url: string, variables: DigestVariables): Promise<void> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(variables),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Slack trigger failed: ${res.status} ${body}`)
  }
}
```

- [ ] **Step 2: Typecheck/lint, then stop for review**

Run: `npx eslint lib/slack/send.ts`
Expected: no errors.

---

## Task 5: Digest data loader (`lib/slack/data.ts`)

**Files:**
- Create: `lib/slack/data.ts`

- [ ] **Step 1: Implement**

Create `lib/slack/data.ts`:

```ts
import { asc, isNotNull } from 'drizzle-orm'
import { db, matches, players } from '@/lib/db'
import type { EngineMatch } from '@/lib/stats-engine'
import type { PlayerLite } from '@/lib/slack/digest'

/** All players (for name resolution) + all decided/played matches as EngineMatch[]. */
export async function loadDigestData(): Promise<{
  engineMatches: EngineMatch[]
  playersById: Map<string, PlayerLite>
}> {
  const playerRows = await db
    .select({ id: players.id, name: players.name, nickname: players.nickname })
    .from(players)
  const playersById = new Map<string, PlayerLite>(
    playerRows.map((p) => [p.id, { name: p.name, nickname: p.nickname }]),
  )

  const raw = await db
    .select()
    .from(matches)
    .where(isNotNull(matches.playedAt))
    .orderBy(asc(matches.playedAt))

  const engineMatches: EngineMatch[] = raw
    .filter((m) => m.playerAId && m.playerBId && m.playedAt && (m.setScores?.length ?? 0) > 0)
    .map((m) => ({
      id: m.id,
      playerAId: m.playerAId!,
      playerBId: m.playerBId!,
      winnerId: m.winnerId,
      setScores: (m.setScores as [number, number][]) ?? [],
      durationSeconds: m.durationSeconds,
      playedAt: m.playedAt!,
      eloABefore: m.eloABefore ?? 1200,
      eloAAfter: m.eloAAfter ?? 1200,
      eloBBefore: m.eloBBefore ?? 1200,
      eloBAfter: m.eloBAfter ?? 1200,
    }))

  return { engineMatches, playersById }
}
```

- [ ] **Step 2: Lint, then stop for review**

Run: `npx eslint lib/slack/data.ts`

---

## Task 6: Cron route handlers

**Files:**
- Create: `app/api/cron/weekly-digest/route.ts`
- Create: `app/api/cron/daily-digest/route.ts`

- [ ] **Step 1: Implement the weekly route**

Create `app/api/cron/weekly-digest/route.ts`:

```ts
import { loadDigestData } from '@/lib/slack/data'
import { buildWeeklyDigest } from '@/lib/slack/digest'
import { postToSlackTrigger } from '@/lib/slack/send'
import { lastWeekRange } from '@/lib/slack/windows'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }
  try {
    const { engineMatches, playersById } = await loadDigestData()
    const vars = buildWeeklyDigest({ engineMatches, playersById, range: lastWeekRange(new Date()) })
    if (!vars) return Response.json({ skipped: true })
    await postToSlackTrigger(process.env.SLACK_WEBHOOK_URL!, vars)
    return Response.json({ ok: true })
  } catch (e) {
    console.error('weekly-digest failed', e)
    return new Response('Internal Error', { status: 500 })
  }
}
```

- [ ] **Step 2: Implement the daily route**

Create `app/api/cron/daily-digest/route.ts`:

```ts
import { loadDigestData } from '@/lib/slack/data'
import { buildDailyDigest } from '@/lib/slack/digest'
import { postToSlackTrigger } from '@/lib/slack/send'
import { yesterdayRange } from '@/lib/slack/windows'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }
  try {
    const { engineMatches, playersById } = await loadDigestData()
    const vars = buildDailyDigest({ engineMatches, playersById, range: yesterdayRange(new Date()) })
    if (!vars) return Response.json({ skipped: true })
    await postToSlackTrigger(process.env.SLACK_DAILY_WEBHOOK_URL!, vars)
    return Response.json({ ok: true })
  } catch (e) {
    console.error('daily-digest failed', e)
    return new Response('Internal Error', { status: 500 })
  }
}
```

- [ ] **Step 3: Verify the auth guard locally**

Start the dev server (`preview_start`), then:
- `preview_eval`: `await fetch('/api/cron/weekly-digest').then(r => r.status)` → expect `401`.
- `preview_eval`: `await fetch('/api/cron/weekly-digest', { headers: { authorization: 'Bearer ' + 'WRONG' } }).then(r => r.status)` → expect `401`.

(With a correct `CRON_SECRET` set locally and a real `SLACK_WEBHOOK_URL`, a `Bearer <secret>` request returns `{ ok: true }` or `{ skipped: true }` — only test that once env is configured, to avoid an accidental real post.)

- [ ] **Step 4: Lint, then stop for review**

Run: `npx eslint app/api/cron/weekly-digest/route.ts app/api/cron/daily-digest/route.ts`

---

## Task 7: Admin manual-trigger server actions + button

**Files:**
- Create: `app/actions/slack.ts`
- Create: `components/admin/post-to-slack-buttons.tsx`
- Modify: `app/admin/page.tsx`

- [ ] **Step 1: Implement the server actions**

Create `app/actions/slack.ts`:

```ts
'use server'

import { cookies } from 'next/headers'
import { ADMIN_COOKIE, verifySessionCookie } from '@/lib/auth'
import { loadDigestData } from '@/lib/slack/data'
import { buildWeeklyDigest, buildDailyDigest } from '@/lib/slack/digest'
import { postToSlackTrigger } from '@/lib/slack/send'
import { lastWeekRange, yesterdayRange } from '@/lib/slack/windows'

type Result = { ok: true } | { skipped: true } | { error: string }

async function isAdmin(): Promise<boolean> {
  const store = await cookies()
  return verifySessionCookie(store.get(ADMIN_COOKIE)?.value, process.env.SESSION_SECRET!)
}

export async function postWeeklyNow(): Promise<Result> {
  if (!(await isAdmin())) return { error: 'Not authorized.' }
  try {
    const { engineMatches, playersById } = await loadDigestData()
    const vars = buildWeeklyDigest({ engineMatches, playersById, range: lastWeekRange(new Date()) })
    if (!vars) return { skipped: true }
    await postToSlackTrigger(process.env.SLACK_WEBHOOK_URL!, vars)
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to post.' }
  }
}

export async function postDailyNow(): Promise<Result> {
  if (!(await isAdmin())) return { error: 'Not authorized.' }
  try {
    const { engineMatches, playersById } = await loadDigestData()
    const vars = buildDailyDigest({ engineMatches, playersById, range: yesterdayRange(new Date()) })
    if (!vars) return { skipped: true }
    await postToSlackTrigger(process.env.SLACK_DAILY_WEBHOOK_URL!, vars)
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to post.' }
  }
}
```

- [ ] **Step 2: Implement the button component**

Create `components/admin/post-to-slack-buttons.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { postWeeklyNow, postDailyNow } from '@/app/actions/slack'

type R = { ok: true } | { skipped: true } | { error: string }

export function PostToSlackButtons() {
  const [pending, setPending] = useState<null | 'weekly' | 'daily'>(null)
  const [status, setStatus] = useState<string | null>(null)

  async function run(kind: 'weekly' | 'daily', fn: () => Promise<R>) {
    if (pending) return
    setPending(kind)
    setStatus(null)
    try {
      const r = await fn()
      if ('error' in r) setStatus(`⚠️ ${r.error}`)
      else if ('skipped' in r) setStatus('No games in the window — nothing posted.')
      else setStatus(`✓ ${kind === 'weekly' ? 'Weekly' : 'Daily'} recap posted to Slack.`)
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => run('weekly', postWeeklyNow)}
          className="rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary disabled:opacity-50"
        >
          {pending === 'weekly' ? 'Posting…' : 'Post weekly recap now'}
        </button>
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => run('daily', postDailyNow)}
          className="rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary disabled:opacity-50"
        >
          {pending === 'daily' ? 'Posting…' : 'Post daily recap now'}
        </button>
      </div>
      {status && <p className="text-sm text-muted-foreground">{status}</p>}
    </div>
  )
}
```

- [ ] **Step 3: Add the Slack card to the admin page**

In `app/admin/page.tsx`, add the import at the top (after the existing `rebuildElo` import):

```tsx
import { PostToSlackButtons } from '@/components/admin/post-to-slack-buttons'
```

Then add this block immediately **after** the closing `</div>` of the existing "Maintenance" card (the `<div className="mt-8 rounded-lg border border-border bg-card p-4">…</div>`), before the `</main>`:

```tsx
      <div className="mt-6 rounded-lg border border-border bg-card p-4">
        <div className="section-header font-display">Slack</div>
        <p className="mb-3 text-sm text-muted-foreground">
          Post a recap to the Slack channel on demand — the same content the weekly/daily cron sends.
        </p>
        <PostToSlackButtons />
      </div>
```

- [ ] **Step 4: Verify in preview**

With the dev server running and logged in as admin, load `/admin`. Confirm the Slack card renders with two buttons. Clicking with no `SLACK_WEBHOOK_URL` set shows an inline `⚠️ …` error (expected). Use `preview_eval` to click and read the status text.

- [ ] **Step 5: Lint, then stop for review**

Run: `npx eslint app/actions/slack.ts components/admin/post-to-slack-buttons.tsx app/admin/page.tsx`

---

## Task 8: Vercel cron config + env placeholders

**Files:**
- Create: `vercel.json`
- Modify: `.env.example`

- [ ] **Step 1: Create `vercel.json`**

```json
{
  "crons": [
    { "path": "/api/cron/weekly-digest", "schedule": "0 22 * * 0" },
    { "path": "/api/cron/daily-digest", "schedule": "0 22 * * 1-4" }
  ]
}
```

- [ ] **Step 2: Add env placeholders to `.env.example`**

Append these lines to `.env.example`:

```
SLACK_WEBHOOK_URL=
SLACK_DAILY_WEBHOOK_URL=
CRON_SECRET=
```

- [ ] **Step 3: Stop for review**

No code to test. (Mahir performs the live enablement steps from the spec's "Enablement checklist".) Pause for review.

---

## Task 9: Loading overlay component

**Files:**
- Create: `components/loading-overlay.tsx`

- [ ] **Step 1: Implement (verified in preview, not unit — no RTL/jsdom in this repo)**

Create `components/loading-overlay.tsx`:

```tsx
'use client'

/** Full-screen blocking overlay shown while a write is in flight. Covers the viewport
 *  so a second click/submit is impossible until the action resolves. */
export function LoadingOverlay({ open, label = 'Saving…' }: { open: boolean; label?: string }) {
  if (!open) return null
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 bg-background/70 backdrop-blur-sm"
    >
      <span
        className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary"
        aria-hidden
      />
      <span className="text-sm font-medium text-foreground">{label}</span>
    </div>
  )
}
```

- [ ] **Step 2: Lint, then stop for review**

Run: `npx eslint components/loading-overlay.tsx`

---

## Task 10: Server-side player dedup

**Files:**
- Create: `lib/player-dedup.ts`
- Test: `lib/player-dedup.test.ts`
- Modify: `app/actions/players.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/player-dedup.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { isDuplicatePlayer } from './player-dedup'

describe('isDuplicatePlayer', () => {
  const now = 1_000_000
  it('flags the same name (case-insensitive, trimmed) within the window', () => {
    expect(isDuplicatePlayer({ name: 'Alice ', createdAtMs: now - 5000 }, 'alice', now)).toBe(true)
  })
  it('ignores matches older than the window', () => {
    expect(isDuplicatePlayer({ name: 'Alice', createdAtMs: now - 20_000 }, 'Alice', now)).toBe(false)
  })
  it('does not flag different names', () => {
    expect(isDuplicatePlayer({ name: 'Alice', createdAtMs: now }, 'Bob', now)).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run lib/player-dedup.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helper**

Create `lib/player-dedup.ts`:

```ts
export const PLAYER_DEDUP_WINDOW_MS = 10_000

type ExistingPlayer = { name: string; createdAtMs: number }

/** True when an existing player has the same name (case-insensitive, trimmed)
 *  created within `windowMs` before `nowMs`. */
export function isDuplicatePlayer(
  existing: ExistingPlayer,
  incomingName: string,
  nowMs: number,
  windowMs: number = PLAYER_DEDUP_WINDOW_MS,
): boolean {
  if (nowMs - existing.createdAtMs > windowMs) return false
  return existing.name.trim().toLowerCase() === incomingName.trim().toLowerCase()
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run lib/player-dedup.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire dedup into both create actions**

In `app/actions/players.ts`, change the drizzle import line:

```ts
import { eq } from 'drizzle-orm'
```

to:

```ts
import { and, eq, gte, ilike } from 'drizzle-orm'
```

Add this import near the other imports:

```ts
import { isDuplicatePlayer, PLAYER_DEDUP_WINDOW_MS } from '@/lib/player-dedup'
```

In `createPlayerSelfServe`, immediately after the `if (!parsed.success) { return { error: parsed.error.issues[0].message } }` block and before the photo handling, insert:

```ts
  const nowMs = Date.now()
  const recent = await db
    .select({ name: players.name, createdAt: players.createdAt })
    .from(players)
    .where(and(gte(players.createdAt, new Date(nowMs - PLAYER_DEDUP_WINDOW_MS)), ilike(players.name, parsed.data.name)))
  if (recent.some((r) => isDuplicatePlayer({ name: r.name, createdAtMs: r.createdAt.getTime() }, parsed.data.name, nowMs))) {
    return { error: 'Looks like that player was just added.' }
  }
```

In `createPlayerAdmin`, after its `if (!parsed.success) return { error: parsed.error.issues[0].message }` line and before the photo handling, insert the **same** block:

```ts
  const nowMs = Date.now()
  const recent = await db
    .select({ name: players.name, createdAt: players.createdAt })
    .from(players)
    .where(and(gte(players.createdAt, new Date(nowMs - PLAYER_DEDUP_WINDOW_MS)), ilike(players.name, parsed.data.name)))
  if (recent.some((r) => isDuplicatePlayer({ name: r.name, createdAtMs: r.createdAt.getTime() }, parsed.data.name, nowMs))) {
    return { error: 'Looks like that player was just added.' }
  }
```

- [ ] **Step 6: Run the full suite + lint, then stop for review**

Run: `npx vitest run` and `npx eslint lib/player-dedup.ts lib/player-dedup.test.ts app/actions/players.ts`
Expected: all green.

---

## Task 11: Apply overlay — public flows (log form, join, seeder)

> `seeder-queue.tsx` is also edited by Task 13. **Do Task 13 before this task** and assign both to the same worker.

**Files:**
- Modify: `components/match-log-form.tsx`
- Modify: `components/join-form.tsx`
- Modify: `components/seeder/seeder-queue.tsx`

- [ ] **Step 1: Match log form**

In `components/match-log-form.tsx`, add the import after the existing imports:

```tsx
import { LoadingOverlay } from '@/components/loading-overlay'
```

Then, inside the returned `<form key={savedTick} action={handle} className="space-y-6">`, add the overlay as the first child (right after the opening `<form …>` tag, before the hidden input):

```tsx
      <LoadingOverlay open={pending} label="Saving match…" />
```

(The form already guards re-entry with the `submitting` ref and `pending` state — no other change needed.)

- [ ] **Step 2: Join form**

In `components/join-form.tsx`, add the import:

```tsx
import { useRef, useState } from 'react'
import { LoadingOverlay } from '@/components/loading-overlay'
```

(Replace the existing `import { useState } from 'react'` line with the `useRef, useState` version.)

Add a submitting ref inside the component, right after the existing `useState` lines:

```tsx
  const submitting = useRef(false)
```

Replace the `handleSubmit` function with a guarded version:

```tsx
  async function handleSubmit(formData: FormData) {
    if (submitting.current) return
    submitting.current = true
    setError(null)
    setPending(true)
    try {
      const result = await createPlayerSelfServe(formData)
      if (result && 'error' in result) setError(result.error)
    } finally {
      setPending(false)
      submitting.current = false
    }
  }
```

Add the overlay as the first child inside the `<form action={handleSubmit} className="space-y-4">`:

```tsx
      <LoadingOverlay open={pending} label="Creating profile…" />
```

- [ ] **Step 3: Seeder queue (ActiveCard)**

In `components/seeder/seeder-queue.tsx`:

Add the imports at the top (after the existing imports):

```tsx
import { useRef, useState } from 'react'
import { LoadingOverlay } from '@/components/loading-overlay'
```

(Replace the existing `import { useState } from 'react'` with the `useRef, useState` version.)

In `ActiveCard`, add a submitting ref after the existing `useState` declarations:

```tsx
  const submitting = useRef(false)
```

Replace the start of `save()` (the `setError(null); setPending(true)` region) so the guard wraps the whole call. The function becomes:

```tsx
  async function save() {
    if (submitting.current) return
    if (a === '' || b === '') {
      setError('Enter both scores.')
      return
    }
    submitting.current = true
    setError(null)
    setPending(true)
    try {
      const fields = buildLogFields(current!, [Number(a), Number(b)], duration, new Date().toISOString())
      const fd = new FormData()
      Object.entries(fields).forEach(([k, v]) => fd.set(k, v))
      const r = await logMatch(fd)
      if (r && 'error' in r) {
        setError(r.error ?? 'Could not save.')
        return
      }
      onFinish(current!.id, [Number(a), Number(b)], duration)
      setDuration(0)
      setA('')
      setB('')
    } finally {
      setPending(false)
      submitting.current = false
    }
  }
```

(The `buildLogFields(..., new Date().toISOString())` 4th argument is the Task 13 signature — that's why Task 13 lands first.)

Add the overlay as the first child of the returned `ActiveCard` markup — inside the outer `<div className="rounded-lg border border-primary/40 bg-primary/5 p-4 space-y-4">`, right after the opening tag:

```tsx
      <LoadingOverlay open={pending} label="Saving game…" />
```

- [ ] **Step 4: Verify in preview**

Run the dev server. With a preview fixture roster:
- Home logger: fill a game, submit, and confirm the overlay flashes over the viewport before the result screen.
- `/join`: submit and confirm the overlay shows; submit the same name twice rapidly (via `preview_eval` double `.click()`) and confirm only one player is created (server dedup) and the inline error appears on the blocked attempt.
- `/seeder`: start a game, save, confirm overlay shows and the game records.

- [ ] **Step 5: Lint, then stop for review**

Run: `npx eslint components/match-log-form.tsx components/join-form.tsx components/seeder/seeder-queue.tsx`

---

## Task 12: Apply overlay — admin flows (edit player, tournament, delete match)

**Files:**
- Modify: `components/admin/player-edit-dialog.tsx`
- Modify: `components/tournament-create-form.tsx`
- Modify: `components/admin/match-row-actions.tsx`

- [ ] **Step 1: Player edit dialog**

In `components/admin/player-edit-dialog.tsx`:

Replace `import { useState } from 'react'` with:

```tsx
import { useRef, useState } from 'react'
import { LoadingOverlay } from '@/components/loading-overlay'
```

Add a ref after the existing `useState` lines:

```tsx
  const submitting = useRef(false)
```

Replace `handle` with a guarded version:

```tsx
  async function handle(formData: FormData) {
    if (submitting.current) return
    submitting.current = true
    setError(null)
    setPending(true)
    try {
      const r = await updatePlayer(player.id, formData)
      if (r && 'error' in r) {
        setError(r.error ?? 'Unknown error')
        return
      }
      setOpen(false)
      router.refresh()
    } finally {
      setPending(false)
      submitting.current = false
    }
  }
```

Add the overlay as the first child inside `<form action={handle} className="space-y-4">`:

```tsx
            <LoadingOverlay open={pending} label="Saving profile…" />
```

- [ ] **Step 2: Tournament create form**

In `components/tournament-create-form.tsx`:

Replace `import { useState } from 'react'` with:

```tsx
import { useRef, useState } from 'react'
import { LoadingOverlay } from '@/components/loading-overlay'
```

Add state + ref after the existing `useState` lines:

```tsx
  const [pending, setPending] = useState(false)
  const submitting = useRef(false)
```

Replace `handle` with a guarded version:

```tsx
  async function handle(formData: FormData) {
    if (submitting.current) return
    submitting.current = true
    setError(null)
    setPending(true)
    formData.set('seedOrder', JSON.stringify(selected))
    for (const id of selected) formData.append('playerIds', id)
    try {
      const r = await createTournament(formData)
      if (r && 'error' in r) setError(r.error)
    } finally {
      setPending(false)
      submitting.current = false
    }
  }
```

(On success `createTournament` redirects, unmounting the form — the overlay stays visible through navigation.)

Add the overlay as the first child inside `<form action={handle} className="space-y-6">`:

```tsx
      <LoadingOverlay open={pending} label="Creating tournament…" />
```

Update the submit button's `disabled` to also respect pending:

```tsx
        disabled={selected.length < 2 || pending}
```

- [ ] **Step 3: Match row actions (delete)**

In `components/admin/match-row-actions.tsx`:

Replace `import { useState } from 'react'` with:

```tsx
import { useRef, useState } from 'react'
```

and add to the existing dialog imports' sibling import list:

```tsx
import { LoadingOverlay } from '@/components/loading-overlay'
```

Add a ref after the existing `useState` lines:

```tsx
  const submitting = useRef(false)
```

Replace `confirmDelete` with a guarded version:

```tsx
  async function confirmDelete() {
    if (submitting.current) return
    submitting.current = true
    setPending(true)
    try {
      await deleteMatch(initial.id)
      setDeleteOpen(false)
      router.refresh()
    } finally {
      setPending(false)
      submitting.current = false
    }
  }
```

Add the overlay just inside the outer returned `<div className="flex items-center gap-1">` as its first child:

```tsx
      <LoadingOverlay open={pending} label="Deleting match…" />
```

(The edit dialog here renders `MatchLogForm`, which already got its overlay in Task 11 — no extra work.)

- [ ] **Step 4: Verify in preview**

Logged in as admin: edit a player (overlay shows on save), create a tournament (overlay shows, redirects), delete a match from history (overlay shows). Drive clicks with `preview_eval`.

- [ ] **Step 5: Lint, then stop for review**

Run: `npx eslint components/admin/player-edit-dialog.tsx components/tournament-create-form.tsx components/admin/match-row-actions.tsx`

---

## Task 13: Seeder current-time fix

> Edits `lib/seeder-session.ts` + `components/seeder/seeder-queue.tsx`. **Run before Task 11.**

**Files:**
- Modify: `lib/seeder-session.ts` (`buildLogFields`)
- Modify: `lib/seeder-session.test.ts`
- Modify: `components/seeder/seeder-queue.tsx` (caller)

- [ ] **Step 1: Investigate the root cause (systematic-debugging, ~2 min)**

Before changing code, confirm where "midnight" comes from. Today `buildLogFields` sends `playedAt: ''`, which `matchLogSchema` coerces to `undefined`, so `logMatch` stores `new Date()`. In preview with a fixture, log a seeder game and read the stored `playedAt` (e.g. via the matches list or a `preview_eval` fetch of a player page). Note whether the wrong time originates from the empty-string path or a display/coercion path. Either way, the fix below (sending an explicit ISO instant) is correct and removes the ambiguity. Record the finding in the task notes.

- [ ] **Step 2: Update the failing test**

In `lib/seeder-session.test.ts`, replace the `buildLogFields` test block (the `describe('buildLogFields', …)` with the `[11, 7], 240` case) with:

```ts
describe('buildLogFields', () => {
  it('maps a finished matchup to logMatch form fields with an explicit playedAt', () => {
    expect(buildLogFields({ aId: 'a', bId: 'b' }, [11, 7], 240, '2026-06-19T03:30:00.000Z')).toEqual({
      playerAId: 'a', playerBId: 'b', set_0_a: '11', set_0_b: '7',
      durationSeconds: '240', playedAt: '2026-06-19T03:30:00.000Z',
    })
  })
})
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run lib/seeder-session.test.ts`
Expected: FAIL — `buildLogFields` ignores the 4th arg / still emits `playedAt: ''`.

- [ ] **Step 4: Update `buildLogFields`**

In `lib/seeder-session.ts`, replace the `buildLogFields` function with:

```ts
/** Build the field map the existing `logMatch` server action expects (single game).
 *  `playedAtISO` is the exact instant the game finished (e.g. `new Date().toISOString()`). */
export function buildLogFields(
  matchup: { aId: string; bId: string },
  score: [number, number],
  durationSeconds: number,
  playedAtISO: string
): Record<string, string> {
  return {
    playerAId: matchup.aId,
    playerBId: matchup.bId,
    set_0_a: String(score[0]),
    set_0_b: String(score[1]),
    durationSeconds: String(durationSeconds),
    playedAt: playedAtISO,
  }
}
```

- [ ] **Step 5: Update the caller**

In `components/seeder/seeder-queue.tsx`, find the `save()` call to `buildLogFields` and pass the current instant:

```tsx
      const fields = buildLogFields(current!, [Number(a), Number(b)], duration, new Date().toISOString())
```

(If Task 11 already rewrote `save()`, this line is already present — verify it matches.)

- [ ] **Step 6: Run to verify pass**

Run: `npx vitest run lib/seeder-session.test.ts`
Expected: PASS.

- [ ] **Step 7: Verify in preview**

Log a game via `/seeder` against a fixture, then open the relevant player/match view and confirm the timestamp matches the actual current local time (not 00:00).

- [ ] **Step 8: Lint, then stop for review**

Run: `npx eslint lib/seeder-session.ts lib/seeder-session.test.ts components/seeder/seeder-queue.tsx`

---

## Task 14: Desktop top-nav cleanup (group by type)

**Files:**
- Modify: `components/site-header.tsx`

- [ ] **Step 1: Split the NAV array**

In `components/site-header.tsx`, replace the existing `NAV` constant:

```tsx
const NAV = [
  { href: '/players', label: 'Players' },
  { href: '/matches', label: 'Matches' },
  { href: '/matrix', label: 'Mogboard' },
  { href: '/tournaments', label: 'Tournaments' },
  { href: '/calculator', label: 'Calculator' },
  { href: '/seeder', label: 'Seeder' },
]
```

with grouped arrays (mobile keeps the combined list):

```tsx
const STATS_NAV = [
  { href: '/players', label: 'Players' },
  { href: '/matches', label: 'Matches' },
  { href: '/matrix', label: 'Mogboard' },
  { href: '/tournaments', label: 'Tournaments' },
]
const TOOLS_NAV = [
  { href: '/calculator', label: 'Calculator' },
  { href: '/seeder', label: 'Seeder' },
]
const NAV = [...STATS_NAV, ...TOOLS_NAV]
```

- [ ] **Step 2: Rebuild the desktop nav with grouped clusters + dividers**

Replace the entire desktop `<nav className="hidden items-center gap-0.5 text-sm lg:flex lg:gap-1"> … </nav>` block (the links map through the Join link) with:

```tsx
        <nav className="hidden items-center gap-0.5 text-sm lg:flex lg:gap-1">
          {/* Stats / views */}
          {STATS_NAV.map((item) => {
            const active = isActive(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  'rounded-md px-2.5 py-1.5 transition-colors duration-150 lg:px-3',
                  active
                    ? 'text-primary font-medium bg-secondary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                )}
              >
                {item.label}
              </Link>
            )
          })}

          <span aria-hidden className="mx-1.5 h-5 w-px bg-border" />

          {/* Tools */}
          {TOOLS_NAV.map((item) => {
            const active = isActive(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  'rounded-md px-2.5 py-1.5 transition-colors duration-150 lg:px-3',
                  active
                    ? 'text-primary font-medium bg-secondary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                )}
              >
                {item.label}
              </Link>
            )
          })}

          <span aria-hidden className="mx-1.5 h-5 w-px bg-border" />

          {/* Actions / utility */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- intentional plain anchor: in-page #log scroll, avoids client-route round-trip */}
          <a
            href="/#log"
            className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1.5 font-medium text-foreground transition-colors duration-150 hover:bg-secondary lg:px-3"
          >
            <Plus className="h-3.5 w-3.5" />
            Log a game
          </a>

          {isLoggedIn ? (
            <>
              <Link
                href="/admin"
                className="rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors duration-150 hover:text-foreground hover:bg-muted lg:px-3"
              >
                Admin
              </Link>
              <form action={logout}>
                <button
                  type="submit"
                  className="rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors duration-150 hover:text-foreground hover:bg-muted lg:px-3"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/admin/login"
              className="rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors duration-150 hover:text-foreground hover:bg-muted lg:px-3"
            >
              Admin Log In
            </Link>
          )}

          <Link
            href="/join"
            className="ml-1 rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground transition-colors duration-150 hover:bg-[#10489e] lg:ml-2 lg:px-3.5"
          >
            Join
          </Link>
        </nav>
```

(The mobile `Dialog` menu below still maps `NAV` — leave it unchanged.)

- [ ] **Step 3: Polish with the frontend-design skill**

Invoke `frontend-design` to refine the divider treatment, spacing rhythm, and hover/active states so the grouped bar reads cleanly and on-brand at `lg`+ widths. Keep `aria-current`, the logo, and sticky header intact.

- [ ] **Step 4: Verify in preview**

At ≥1024px width, confirm: two link clusters separated by dividers, then Log a game / Admin / Join; the active route is highlighted (`aria-current="page"`); every link resolves. Re-check at a narrow width that the mobile menu is unchanged. Use `preview_resize` for both widths.

- [ ] **Step 5: Lint, then stop for review**

Run: `npx eslint components/site-header.tsx`

---

## Task 15: Leaderboard 7-day inactivity filter

Depends on Task 1 (`recentlyActive`).

**Files:**
- Modify: `app/(public)/page.tsx`

- [ ] **Step 1: Filter players before the leaderboard**

In `app/(public)/page.tsx`, update the stats-engine import to include `recentlyActive`:

```tsx
import { movers, playerAggregates, giantKills, rankWithin, recentlyActive } from '@/lib/stats-engine'
```

After the existing `const weekMovers = movers(data.engineMatches, since)` line, add:

```tsx
  const activeIds = recentlyActive(data.engineMatches, since)
  const leaderboardPlayers = data.activePlayers.filter((p) => activeIds.has(p.id))
```

Then change the `<Leaderboard … />` usage to pass the filtered list:

```tsx
          <Leaderboard players={leaderboardPlayers} movers={weekMovers} wlById={data.wlById} titles={titleByPlayer} />
```

(`since` is already defined as `new Date(now - 7 * 86400 * 1000)`. The `/players` directory is intentionally left unfiltered.)

- [ ] **Step 2: Verify in preview**

With a fixture where one player's most recent game is >7 days ago and others are recent: load `/`, confirm the dormant player is absent from the "Starting Grid" while present on `/players`. Confirm ranks read 1…N with no gaps.

- [ ] **Step 3: Lint, then stop for review**

Run: `npx eslint "app/(public)/page.tsx"`

---

## Final verification (after all tasks)

- [ ] Run the whole test suite: `npx vitest run` → all green.
- [ ] Lint everything touched: `npx eslint lib components app` (or the specific paths above).
- [ ] Preview smoke test: home leaderboard filter, log-game overlay, seeder time, admin Slack buttons (inline status), desktop nav groups.
- [ ] Hand off to Mahir for the live Slack/Vercel enablement steps (spec's "Enablement checklist") and all git commits.

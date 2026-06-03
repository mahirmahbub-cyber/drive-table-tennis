# Game-level scoring, duplicate-submit guard, and tournament management — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the individual game the unit of win/loss and ELO (with ties allowed for casual matches), block duplicate match submissions, and add admin view/edit/delete for tournaments.

**Architecture:** Keep one `matches` row per sitting (the "encounter"); reinterpret its `set_scores` array as individual games. All W/L and totals are computed on read from those scores; ELO is applied per game via a shared `applyGames` helper used by every write path and the replay engine. No schema change.

**Tech Stack:** Next.js 16 (App Router, server actions, `proxy.ts`, async params/cookies), React 19, Drizzle ORM + Postgres (Supabase), Zod, Vitest, Tailwind + shadcn/Radix, lucide-react.

**Spec:** `docs/superpowers/specs/2026-06-03-game-level-scoring-tournament-management-design.md`

---

## ⚠️ CORRECTION (added during execution)

Tests for `elo`, `elo-recompute`, `match-format`, `stats-engine` live in the **`tests/`** directory (e.g. `tests/elo.test.ts`), NOT co-located in `lib/`. Where this plan says "create `lib/X.test.ts`", instead **add to / update the existing `tests/X.test.ts`**. New modules with no existing test (`lib/match-dedup.ts`) get `tests/match-dedup.test.ts`.

The game-level change **breaks existing assertions** in `tests/stats-engine.test.ts`. Corrected expected values for the `playerAggregates` "player A" case: `games=5, wins=3, losses=2, winPct=60, currentStreak=-2, longestWinStreak=3, peakElo=1222, pointsFor=46, pointsAgainst=43, avgGameSeconds=467`, plus new `totalPlayingSeconds=1400`. Corrected `headToHead(A,B)` = `{ p1Wins: 1, p2Wins: 2 }`. Other functions (movers, upset/demolition, participation, mostPlayedRivalry, durationRecords) are unchanged.

**Extra consumer found during execution:** making `EngineMatch.winnerId` nullable breaks `components/home/superlatives-strip.tsx` (passes `winnerId` into `name(id: string)`). Fixed as part of Task 17: make `demolitionOfWeek` skip null-winner matches (a demolition needs a winner), and make the component's `name` helper tolerate `string | null`. Known/expected tsc errors during execution: `app/actions/matches.ts` (until Task 6) and `components/home/superlatives-strip.tsx` (until Task 17).

## ⚠️ Conventions for every task

- **Git is the human's job.** Do NOT run `git add` / `git commit` / `git push`. Where this plan says "Checkpoint", it means run the verification commands and stop — the repo owner commits. Subagents must not touch git.
- **Next.js 16 is not your training data.** Before editing server actions, pages, or anything touching params/cookies/forms, read the relevant guide under `node_modules/next/dist/docs/`. `proxy.ts` replaces `middleware.ts`; `cookies`/`params` are async; a function used directly as `<form action={fn}>` must not return a value (wrap in a void server action — see existing `app/admin/tournaments/[id]/match/[matchId]/page.tsx`).
- **Verify data-driven UI with throwaway preview fixtures, never by seeding live Supabase.**
- **Terminology:** UI labels and new identifiers say "game" (each `[a,b]` pair). The DB column stays `set_scores` / `setScores` — do not rename it.
- **Run tests with:** `npm test` (Vitest, `vitest run`). Typecheck with `npx tsc --noEmit`.

---

## File map

**Engine / pure logic (TDD):**
- `lib/elo.ts` — add `applyGames`.
- `lib/elo-recompute.ts` — `HistoryMatch` carries games; replay applies per game.
- `lib/match-format.ts` — add `gamesWon` + `gameTally` helpers (game terminology).
- `lib/match-dedup.ts` *(new)* — pure duplicate predicate + window constant.
- `lib/stats-engine.ts` — game-level `playerAggregates`, `headToHead`; nullable `winnerId`; add `totalPlayingSeconds`.
- `lib/elo-rebuild.ts` *(new)* — shared `rebuildEloFromHistory(db-or-tx)` extracted from `matches.ts`.

**Server actions:**
- `app/actions/matches.ts` — dedup guard, `applyGames`, allow ties, use shared rebuild.
- `app/actions/tournaments.ts` — `applyGames`, allow re-scoring, `renameTournament`, `deleteTournament`, use shared rebuild.

**Display + client:**
- `lib/home-data.ts` — stop dropping ties; expose per-player game-level stats map.
- `components/leaderboard.tsx` — W–L column.
- `app/(public)/players/page.tsx` — per-card quick stats.
- `app/(public)/players/[id]/page.tsx` — game-level W/L + tier + stat tiles.
- `components/player-games-history.tsx` — game tally per sitting; ties.
- `components/recent-matches.tsx`, `app/admin/history/page.tsx` — null-winner handling + tally.
- `components/match-log-form.tsx` — "game" labels, spinner, re-entrancy guard.

**Tournament UI (Fix #3):**
- `app/admin/tournaments/page.tsx` *(new)* — list page.
- `app/admin/page.tsx` — dashboard link.
- `app/admin/tournaments/[id]/page.tsx` — rename + delete + allow editing decided matches.
- `app/admin/tournaments/[id]/match/[matchId]/page.tsx` — "game" labels, prefill existing scores.
- `components/admin/tournament-row-actions.tsx` *(new)* — delete/rename client component.

---

## GROUP A — Engine & pure logic  *(suggested model: sonnet)*

### Task 1: `applyGames` — per-game ELO

**Files:**
- Modify: `lib/elo.ts`
- Test: `lib/elo.test.ts` *(new)*

- [ ] **Step 1: Write the failing test**

```ts
// lib/elo.test.ts
import { describe, it, expect } from 'vitest'
import { applyMatch, applyGames } from './elo'

describe('applyGames', () => {
  it('matches applyMatch for a single decisive game', () => {
    const single = applyMatch(1200, 1200, 'A')
    const games = applyGames(1200, 1200, [[11, 7]])
    expect(games.eloA).toBe(single.eloA)
    expect(games.eloB).toBe(single.eloB)
  })

  it('threads rating through games in order (2-1 to A)', () => {
    // Apply manually: A wins, B wins, A wins — sequential.
    let a = 1200, b = 1200
    for (const w of ['A', 'B', 'A'] as const) {
      const r = applyMatch(a, b, w); a = r.eloA; b = r.eloB
    }
    const res = applyGames(1200, 1200, [[11, 9], [8, 11], [11, 6]])
    expect(res.eloA).toBe(a)
    expect(res.eloB).toBe(b)
    expect(res.deltaA).toBe(a - 1200)
  })

  it('skips games with an equal score (no result)', () => {
    const res = applyGames(1200, 1200, [[11, 11]])
    expect(res.eloA).toBe(1200)
    expect(res.eloB).toBe(1200)
    expect(res.deltaA).toBe(0)
  })

  it('a 1-1 tie still moves both ratings (per-game), nets near zero at equal elo', () => {
    const res = applyGames(1200, 1200, [[11, 9], [9, 11]])
    // equal elo: +16 then a symmetric swing back; net is small but defined
    expect(res.deltaA).toBe(-res.deltaB)
  })
})
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npm test -- elo`
Expected: FAIL — `applyGames is not a function`.

- [ ] **Step 3: Implement `applyGames`**

Append to `lib/elo.ts`:

```ts
/**
 * Applies ELO per game, threading the rating through each game in order.
 * Games with an equal score are skipped (no result). Returns the net
 * before→after for the whole sitting.
 */
export function applyGames(
  eloA: number,
  eloB: number,
  games: Array<[number, number]>
): MatchResult {
  let a = eloA
  let b = eloB
  for (const [ga, gb] of games) {
    if (ga === gb) continue
    const r = applyMatch(a, b, ga > gb ? 'A' : 'B')
    a = r.eloA
    b = r.eloB
  }
  return { eloA: a, eloB: b, deltaA: a - eloA, deltaB: b - eloB }
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npm test -- elo`
Expected: PASS (4 tests).

- [ ] **Step 5: Checkpoint** — `npx tsc --noEmit` clean. Stop for review/commit.

---

### Task 2: Per-game replay engine

**Files:**
- Modify: `lib/elo-recompute.ts`
- Test: `lib/elo-recompute.test.ts` *(new)*

- [ ] **Step 1: Write the failing test**

```ts
// lib/elo-recompute.test.ts
import { describe, it, expect } from 'vitest'
import { replayHistory } from './elo-recompute'
import { applyGames } from './elo'

describe('replayHistory (per-game)', () => {
  it('replays a multi-game match using applyGames', () => {
    const expected = applyGames(1200, 1200, [[11, 9], [8, 11], [11, 6]])
    const { currentElo, replayed } = replayHistory(
      [{ id: 'm1', playerAId: 'a', playerBId: 'b', games: [[11, 9], [8, 11], [11, 6]] }],
      ['a', 'b']
    )
    expect(currentElo.get('a')).toBe(expected.eloA)
    expect(currentElo.get('b')).toBe(expected.eloB)
    expect(replayed[0].eloABefore).toBe(1200)
    expect(replayed[0].eloAAfter).toBe(expected.eloA)
  })

  it('a match with no games leaves ratings unchanged (bye)', () => {
    const { currentElo } = replayHistory(
      [{ id: 'm1', playerAId: 'a', playerBId: 'b', games: [] }],
      ['a', 'b']
    )
    expect(currentElo.get('a')).toBe(1200)
    expect(currentElo.get('b')).toBe(1200)
  })
})
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npm test -- elo-recompute`
Expected: FAIL — current `HistoryMatch` has `winner`, not `games`.

- [ ] **Step 3: Rewrite `lib/elo-recompute.ts`**

```ts
import { applyGames, STARTING_ELO } from './elo'

export type HistoryMatch = {
  id: string
  playerAId: string
  playerBId: string
  games: Array<[number, number]>
}

export type ReplayedMatch = HistoryMatch & {
  eloABefore: number
  eloBBefore: number
  eloAAfter: number
  eloBAfter: number
}

export type ReplayResult = {
  currentElo: Map<string, number>
  replayed: ReplayedMatch[]
}

/**
 * Replays chronologically-ordered matches, applying ELO per game within each
 * match. Returns each match's net before/after ELOs and every player's final
 * rating. `playerIds` is the universe of players to seed at STARTING_ELO.
 */
export function replayHistory(
  history: HistoryMatch[],
  playerIds: string[]
): ReplayResult {
  const currentElo = new Map<string, number>()
  for (const id of playerIds) currentElo.set(id, STARTING_ELO)

  const replayed: ReplayedMatch[] = []
  for (const match of history) {
    const eloABefore = currentElo.get(match.playerAId) ?? STARTING_ELO
    const eloBBefore = currentElo.get(match.playerBId) ?? STARTING_ELO
    const { eloA, eloB } = applyGames(eloABefore, eloBBefore, match.games)
    currentElo.set(match.playerAId, eloA)
    currentElo.set(match.playerBId, eloB)
    replayed.push({ ...match, eloABefore, eloBBefore, eloAAfter: eloA, eloBAfter: eloB })
  }

  return { currentElo, replayed }
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npm test -- elo-recompute`
Expected: PASS (2 tests). NOTE: `app/actions/matches.ts` will now fail to typecheck (it builds `HistoryMatch` with `winner`) — fixed in Task 6/Task A-rebuild. That is expected.

- [ ] **Step 5: Checkpoint** — stop for review.

---

### Task 3: Game-terminology helpers in `match-format.ts`

**Files:**
- Modify: `lib/match-format.ts`
- Test: `lib/match-format.test.ts` *(new)*

- [ ] **Step 1: Write the failing test**

```ts
// lib/match-format.test.ts
import { describe, it, expect } from 'vitest'
import { gamesWon, gameTally } from './match-format'

describe('gamesWon / gameTally', () => {
  it('counts games won per side, ignoring equal scores', () => {
    expect(gamesWon([[11, 9], [8, 11], [11, 6]])).toEqual({ a: 2, b: 1 })
    expect(gamesWon([[11, 11]])).toEqual({ a: 0, b: 0 })
  })
  it('formats a player-oriented tally', () => {
    expect(gameTally([[11, 9], [8, 11], [11, 6]], true)).toBe('2–1')
    expect(gameTally([[11, 9], [8, 11], [11, 6]], false)).toBe('1–2')
  })
})
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npm test -- match-format`
Expected: FAIL — `gamesWon`/`gameTally` not exported.

- [ ] **Step 3: Implement** — append to `lib/match-format.ts` (note: `setsWon` already exists and does the same counting; re-export under the game name and add the tally):

```ts
/** Game-level alias of setsWon: games won per side, ignoring equal-score games. */
export function gamesWon(games: SetScore[]): { a: number; b: number } {
  return setsWon(games)
}

/** Player-oriented "gamesWon–gamesLost" string for a sitting, e.g. "2–1". */
export function gameTally(games: SetScore[], playerIsA: boolean): string {
  const { a, b } = setsWon(games)
  return playerIsA ? `${a}–${b}` : `${b}–${a}`
}
```

- [ ] **Step 4: Run tests, verify pass** — `npm test -- match-format` → PASS.
- [ ] **Step 5: Checkpoint.**

---

### Task 4: Duplicate-match predicate

**Files:**
- Create: `lib/match-dedup.ts`
- Test: `lib/match-dedup.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/match-dedup.test.ts
import { describe, it, expect } from 'vitest'
import { DEDUP_WINDOW_MS, isDuplicateMatch } from './match-dedup'

const base = { playerAId: 'a', playerBId: 'b', sets: [[11, 9], [11, 7]] as [number, number][] }

describe('isDuplicateMatch', () => {
  const now = 1_000_000
  it('flags identical sitting within the window', () => {
    const existing = { playerAId: 'a', playerBId: 'b', setScores: [[11, 9], [11, 7]] as [number, number][], createdAtMs: now - 2000 }
    expect(isDuplicateMatch(existing, base, now)).toBe(true)
  })
  it('ignores when outside the window', () => {
    const existing = { playerAId: 'a', playerBId: 'b', setScores: [[11, 9], [11, 7]] as [number, number][], createdAtMs: now - DEDUP_WINDOW_MS - 1 }
    expect(isDuplicateMatch(existing, base, now)).toBe(false)
  })
  it('matches regardless of player orientation, comparing scores in that orientation', () => {
    const existing = { playerAId: 'b', playerBId: 'a', setScores: [[9, 11], [7, 11]] as [number, number][], createdAtMs: now - 1000 }
    expect(isDuplicateMatch(existing, base, now)).toBe(true)
  })
  it('not a duplicate when scores differ', () => {
    const existing = { playerAId: 'a', playerBId: 'b', setScores: [[11, 9]] as [number, number][], createdAtMs: now - 1000 }
    expect(isDuplicateMatch(existing, base, now)).toBe(false)
  })
})
```

- [ ] **Step 2: Run it, verify it fails** — `npm test -- match-dedup` → FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
// lib/match-dedup.ts
export const DEDUP_WINDOW_MS = 10_000

type ExistingMatch = {
  playerAId: string | null
  playerBId: string | null
  setScores: Array<[number, number]> | null
  createdAtMs: number
}
type IncomingMatch = {
  playerAId: string
  playerBId: string
  sets: Array<[number, number]>
}

function sameScores(a: Array<[number, number]>, b: Array<[number, number]>): boolean {
  if (a.length !== b.length) return false
  return a.every(([x, y], i) => b[i][0] === x && b[i][1] === y)
}

/**
 * True when `existing` is the same sitting as `incoming` (same two players and
 * identical game scores, accounting for A/B orientation) created within the
 * dedup window before `nowMs`.
 */
export function isDuplicateMatch(
  existing: ExistingMatch,
  incoming: IncomingMatch,
  nowMs: number,
  windowMs: number = DEDUP_WINDOW_MS
): boolean {
  if (nowMs - existing.createdAtMs > windowMs) return false
  const scores = existing.setScores ?? []
  if (existing.playerAId === incoming.playerAId && existing.playerBId === incoming.playerBId) {
    return sameScores(scores, incoming.sets)
  }
  if (existing.playerAId === incoming.playerBId && existing.playerBId === incoming.playerAId) {
    // flip incoming scores into existing's orientation
    return sameScores(scores, incoming.sets.map(([x, y]) => [y, x]))
  }
  return false
}
```

- [ ] **Step 4: Run tests, verify pass** — `npm test -- match-dedup` → PASS (4).
- [ ] **Step 5: Checkpoint.**

---

### Task 5: Game-level `stats-engine.ts`

**Files:**
- Modify: `lib/stats-engine.ts`
- Test: `lib/stats-engine.test.ts` *(new)*

- [ ] **Step 1: Write the failing test**

```ts
// lib/stats-engine.test.ts
import { describe, it, expect } from 'vitest'
import { playerAggregates, headToHead, type EngineMatch } from './stats-engine'

function m(p: Partial<EngineMatch>): EngineMatch {
  return {
    id: 'x', playerAId: 'a', playerBId: 'b', winnerId: 'a',
    setScores: [[11, 9]], durationSeconds: 600, playedAt: new Date('2026-01-01'),
    eloABefore: 1200, eloAAfter: 1216, eloBBefore: 1200, eloBAfter: 1184, ...p,
  }
}

describe('playerAggregates (game-level)', () => {
  it('counts individual games, not sittings', () => {
    const matches = [m({ setScores: [[11, 9], [8, 11], [11, 6]], winnerId: 'a' })]
    const s = playerAggregates(matches, 'a', 1216)
    expect(s.games).toBe(3)
    expect(s.wins).toBe(2)
    expect(s.losses).toBe(1)
    expect(s.winPct).toBe(67)
  })
  it('counts a tied sitting (no winnerId) at game level', () => {
    const matches = [m({ setScores: [[11, 9], [9, 11]], winnerId: null })]
    const s = playerAggregates(matches, 'a', 1200)
    expect(s.games).toBe(2)
    expect(s.wins).toBe(1)
    expect(s.losses).toBe(1)
  })
  it('sums playing time across sittings', () => {
    const matches = [m({ durationSeconds: 600 }), m({ durationSeconds: 300, playedAt: new Date('2026-01-02') })]
    const s = playerAggregates(matches, 'a', 1216)
    expect(s.totalPlayingSeconds).toBe(900)
  })
})

describe('headToHead (game-level)', () => {
  it('counts games won between two players', () => {
    const matches = [m({ setScores: [[11, 9], [8, 11], [11, 6]], winnerId: 'a' })]
    expect(headToHead(matches, 'a', 'b')).toEqual({ p1Wins: 2, p2Wins: 1 })
  })
})
```

- [ ] **Step 2: Run it, verify it fails** — `npm test -- stats-engine` → FAIL (`totalPlayingSeconds` missing; counts wrong).

- [ ] **Step 3: Implement changes in `lib/stats-engine.ts`:**

3a. Make `winnerId` nullable on the type:

```ts
export type EngineMatch = {
  id: string
  playerAId: string
  playerBId: string
  winnerId: string | null
  setScores: [number, number][]
  durationSeconds: number | null
  playedAt: Date
  eloABefore: number
  eloAAfter: number
  eloBBefore: number
  eloBAfter: number
}
```

3b. Add `totalPlayingSeconds` to `PlayerStats`:

```ts
export type PlayerStats = {
  playerId: string
  games: number
  wins: number
  losses: number
  winPct: number | null
  currentStreak: number
  longestWinStreak: number
  pointsFor: number
  pointsAgainst: number
  pointsRatio: number | null
  avgMargin: number | null
  avgPointsPerSet: number | null
  avgGameSeconds: number | null
  totalPlayingSeconds: number
  peakElo: number
  lastPlayedAt: Date | null
}
```

3c. Replace the body of `playerAggregates` (game-level wins/losses/streaks; `games` = individual games; sitting-level duration totals; points unchanged):

```ts
export function playerAggregates(
  all: EngineMatch[],
  playerId: string,
  currentElo: number,
  minGames = 1
): PlayerStats {
  const mine = all
    .filter((m) => m.playerAId === playerId || m.playerBId === playerId)
    .sort((x, y) => x.playedAt.getTime() - y.playedAt.getTime())

  let wins = 0, losses = 0, gameCount = 0
  let pointsFor = 0, pointsAgainst = 0, marginSum = 0, setSum = 0
  let durSum = 0, durCount = 0, peakElo = currentElo
  let streak = 0, longest = 0, run = 0

  for (const m of mine) {
    const isA = m.playerAId === playerId
    const p = matchPoints(m)
    pointsFor += isA ? p.aFor : p.bFor
    pointsAgainst += isA ? p.aAgainst : p.bAgainst
    marginSum += matchMargin(m)
    setSum += p.sets
    if (m.durationSeconds) { durSum += m.durationSeconds; durCount++ }
    const eloAfter = isA ? m.eloAAfter : m.eloBAfter
    if (eloAfter > peakElo) peakElo = eloAfter

    for (const [sa, sb] of m.setScores) {
      if (sa === sb) continue
      const iWonGame = isA ? sa > sb : sb > sa
      gameCount++
      if (iWonGame) { wins++; run = run >= 0 ? run + 1 : 1; if (run > longest) longest = run }
      else { losses++; run = run <= 0 ? run - 1 : -1 }
      streak = run
    }
  }

  const enough = gameCount >= minGames
  return {
    playerId,
    games: gameCount,
    wins,
    losses,
    winPct: enough && gameCount > 0 ? Math.round((wins / gameCount) * 100) : null,
    currentStreak: streak,
    longestWinStreak: longest,
    pointsFor,
    pointsAgainst,
    pointsRatio: enough && pointsAgainst > 0 ? pointsFor / pointsAgainst : null,
    avgMargin: enough && mine.length > 0 ? Math.round((marginSum / mine.length) * 10) / 10 : null,
    avgPointsPerSet: enough && setSum > 0 ? Math.round((pointsFor / setSum) * 10) / 10 : null,
    avgGameSeconds: durCount > 0 ? Math.round(durSum / durCount) : null,
    totalPlayingSeconds: durSum,
    peakElo,
    lastPlayedAt: mine.length ? mine[mine.length - 1].playedAt : null,
  }
}
```

3d. Replace `headToHead` with a game-level count:

```ts
export function headToHead(all: EngineMatch[], p1: string, p2: string): { p1Wins: number; p2Wins: number } {
  let p1Wins = 0, p2Wins = 0
  for (const m of all) {
    const pair = [m.playerAId, m.playerBId]
    if (!pair.includes(p1) || !pair.includes(p2)) continue
    const p1IsA = m.playerAId === p1
    for (const [sa, sb] of m.setScores) {
      if (sa === sb) continue
      const p1WonGame = p1IsA ? sa > sb : sb > sa
      if (p1WonGame) p1Wins++; else p2Wins++
    }
  }
  return { p1Wins, p2Wins }
}
```

3e. Guard `winnerBefore`/`loserBefore` against null winner (used by `upsetOfWeek`). In `upsetOfWeek`, skip matches with no winner:

```ts
export function upsetOfWeek(all: EngineMatch[], since: Date): EngineMatch | null {
  let best: EngineMatch | null = null
  let bestGap = 0
  for (const m of inWindow(all, since)) {
    if (!m.winnerId) continue
    const gap = loserBefore(m) - winnerBefore(m)
    if (gap > bestGap) { bestGap = gap; best = m }
  }
  return best
}
```

- [ ] **Step 4: Run tests, verify pass** — `npm test -- stats-engine` → PASS. Also run full `npm test` (duration tests still pass).
- [ ] **Step 5: Checkpoint** — `npx tsc --noEmit` will still show errors in `home-data.ts` / `players/[id]/page.tsx` consuming these; those are fixed in Group D. Note them and stop.

---

### Task 6: Shared ELO rebuild

**Files:**
- Create: `lib/elo-rebuild.ts`
- Modify: `app/actions/matches.ts` (remove local `replayAllAndWrite`, import shared)

- [ ] **Step 1: Create `lib/elo-rebuild.ts`** (moves logic out of `matches.ts`, builds history from game scores):

```ts
import { asc, eq } from 'drizzle-orm'
import { db, matches, players } from '@/lib/db'
import { replayHistory, type HistoryMatch } from '@/lib/elo-recompute'

/**
 * Replays the entire match history per game and rewrites every match's ELO
 * snapshots and each player's current rating. Safe to run anytime.
 */
export async function rebuildEloFromHistory(): Promise<void> {
  const allMatches = await db
    .select()
    .from(matches)
    .orderBy(asc(matches.playedAt), asc(matches.createdAt))
  const allPlayers = await db.select({ id: players.id }).from(players)

  const history: HistoryMatch[] = allMatches
    .filter((m) => m.playerAId && m.playerBId && m.playedAt && (m.setScores?.length ?? 0) > 0)
    .map((m) => ({
      id: m.id,
      playerAId: m.playerAId!,
      playerBId: m.playerBId!,
      games: m.setScores as Array<[number, number]>,
    }))

  const result = replayHistory(history, allPlayers.map((p) => p.id))

  await db.transaction(async (tx) => {
    for (const r of result.replayed) {
      await tx
        .update(matches)
        .set({
          eloABefore: r.eloABefore,
          eloBBefore: r.eloBBefore,
          eloAAfter: r.eloAAfter,
          eloBAfter: r.eloBAfter,
        })
        .where(eq(matches.id, r.id))
    }
    for (const [playerId, elo] of result.currentElo.entries()) {
      await tx.update(players).set({ currentElo: elo }).where(eq(players.id, playerId))
    }
  })
}
```

- [ ] **Step 2: In `app/actions/matches.ts`**, delete the local `replayAllAndWrite` function (lines ~69–106) and its now-unused imports (`asc`, `replayHistory`, `HistoryMatch`). Add at top:

```ts
import { rebuildEloFromHistory } from '@/lib/elo-rebuild'
```

Replace the three call sites `await replayAllAndWrite()` with `await rebuildEloFromHistory()` (in `editMatch`, `deleteMatch`, `rebuildElo`).

- [ ] **Step 3: Checkpoint** — `npx tsc --noEmit`: `matches.ts` should now only error on the `logMatch` tie rejection path if any; addressed in Task 7. Run `npm test`. Stop.

---

## GROUP B — Server actions  *(suggested model: sonnet)*

### Task 7: `logMatch` — dedup, per-game ELO, allow ties

**Files:**
- Modify: `app/actions/matches.ts` (`logMatch`, `editMatch`)

- [ ] **Step 1: Rewrite `logMatch`** (`app/actions/matches.ts`). Key changes: dedup query + `isDuplicateMatch`; remove tie rejection; `winnerId` may be null; ELO via `applyGames`.

```ts
import { and, eq, gte, inArray, or } from 'drizzle-orm'
import { applyGames } from '@/lib/elo'
import { inferWinnerSide, type SetScore } from '@/lib/match-format'
import { DEDUP_WINDOW_MS, isDuplicateMatch } from '@/lib/match-dedup'
// (keep existing imports: revalidatePath, db, matches, players, matchLogSchema, alias)

export async function logMatch(formData: FormData) {
  const setsRaw: Array<[number, number]> = []
  for (let i = 0; i < 7; i++) {
    const a = formData.get(`set_${i}_a`)
    const b = formData.get(`set_${i}_b`)
    if (a == null || b == null || a === '' || b === '') continue
    setsRaw.push([Number(a), Number(b)])
  }

  const parsed = matchLogSchema.safeParse({
    playerAId: formData.get('playerAId'),
    playerBId: formData.get('playerBId'),
    sets: setsRaw,
    playedAt: formData.get('playedAt'),
    durationSeconds: formData.get('durationSeconds'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  // ── Duplicate guard: identical sitting for this pair within the window ──
  const nowMs = Date.now()
  const recent = await db
    .select({
      playerAId: matches.playerAId,
      playerBId: matches.playerBId,
      setScores: matches.setScores,
      createdAt: matches.createdAt,
    })
    .from(matches)
    .where(
      and(
        gte(matches.createdAt, new Date(nowMs - DEDUP_WINDOW_MS)),
        or(
          and(eq(matches.playerAId, parsed.data.playerAId), eq(matches.playerBId, parsed.data.playerBId)),
          and(eq(matches.playerAId, parsed.data.playerBId), eq(matches.playerBId, parsed.data.playerAId))
        )
      )
    )
  const dup = recent.some((r) =>
    isDuplicateMatch(
      {
        playerAId: r.playerAId,
        playerBId: r.playerBId,
        setScores: (r.setScores as Array<[number, number]>) ?? null,
        createdAtMs: r.createdAt.getTime(),
      },
      { playerAId: parsed.data.playerAId, playerBId: parsed.data.playerBId, sets: parsed.data.sets },
      nowMs
    )
  )
  if (dup) return { error: 'Looks like that match was just logged.' }

  const both = await db
    .select()
    .from(players)
    .where(inArray(players.id, [parsed.data.playerAId, parsed.data.playerBId]))
  const a = both.find((p) => p.id === parsed.data.playerAId)
  const b = both.find((p) => p.id === parsed.data.playerBId)
  if (!a || !b) return { error: 'Player not found' }

  const winner = inferWinnerSide(parsed.data.sets) // null when tied
  const elo = applyGames(a.currentElo, b.currentElo, parsed.data.sets)
  const winnerId = winner === 'A' ? a.id : winner === 'B' ? b.id : null

  await db.transaction(async (tx) => {
    await tx.insert(matches).values({
      playerAId: a.id,
      playerBId: b.id,
      winnerId,
      setScores: parsed.data.sets,
      playedAt: parsed.data.playedAt ?? new Date(),
      durationSeconds: parsed.data.durationSeconds ?? null,
      eloABefore: a.currentElo,
      eloBBefore: b.currentElo,
      eloAAfter: elo.eloA,
      eloBAfter: elo.eloB,
    })
    await tx.update(players).set({ currentElo: elo.eloA }).where(eq(players.id, a.id))
    await tx.update(players).set({ currentElo: elo.eloB }).where(eq(players.id, b.id))
  })

  revalidatePath('/')
  revalidatePath('/matches')
  revalidatePath('/players')
  revalidatePath(`/players/${a.id}`)
  revalidatePath(`/players/${b.id}`)
  return { ok: true }
}
```

- [ ] **Step 2: Rewrite `editMatch`** — remove tie rejection; allow null winner; rebuild handles ELO. Replace the winner block:

```ts
  const winner = inferWinnerSide(parsed.data.sets) // null when tied — allowed for casual
  const winnerId =
    winner === 'A' ? parsed.data.playerAId : winner === 'B' ? parsed.data.playerBId : null

  await db
    .update(matches)
    .set({
      playerAId: parsed.data.playerAId,
      playerBId: parsed.data.playerBId,
      winnerId,
      setScores: parsed.data.sets,
      playedAt: parsed.data.playedAt ?? undefined,
      durationSeconds: parsed.data.durationSeconds ?? null,
    })
    .where(eq(matches.id, id))

  await rebuildEloFromHistory()
```

(Delete the `if (!winner) return { error: 'Sets are tied' }` line.)

- [ ] **Step 3: Manual verification** — start dev server (`npm run dev`), open the home logger, save a match, then immediately click again → second attempt returns "Looks like that match was just logged." Log a 1–1 casual match → saves with a "Tied" badge, no error. (Use throwaway preview data, not live Supabase.)
- [ ] **Step 4: Checkpoint** — `npm test`, `npx tsc --noEmit`. Stop.

---

### Task 8: Tournament results — per-game ELO + re-scoring

**Files:**
- Modify: `app/actions/tournaments.ts` (`recordTournamentResult`)

- [ ] **Step 1: Update imports** — add `import { applyGames } from '@/lib/elo'` and `import { rebuildEloFromHistory } from '@/lib/elo-rebuild'`. Keep `applyMatch` import only if still used elsewhere (it is in `createTournament`? no — remove if unused).

- [ ] **Step 2: Rewrite `recordTournamentResult`** so it (a) uses `applyGames`, (b) allows re-scoring an already-decided match, (c) re-advances the winner, (d) rebuilds ELO globally for consistency:

```ts
export async function recordTournamentResult(matchId: string, formData: FormData) {
  const setsRaw: Array<[number, number]> = []
  for (let i = 0; i < 7; i++) {
    const a = formData.get(`set_${i}_a`)
    const b = formData.get(`set_${i}_b`)
    if (a == null || b == null || a === '' || b === '') continue
    setsRaw.push([Number(a), Number(b)])
  }

  const [m] = await db.select().from(matches).where(eq(matches.id, matchId))
  if (!m || !m.playerAId || !m.playerBId || !m.tournamentId) {
    return { error: 'Match not ready' }
  }

  let aWins = 0, bWins = 0
  for (const [sa, sb] of setsRaw) {
    if (sa > sb) aWins++
    else if (sb > sa) bWins++
  }
  if (setsRaw.length === 0 || aWins === bWins) return { error: 'A tournament match needs a winner.' }
  const winner: 'A' | 'B' = aWins > bWins ? 'A' : 'B'
  const winnerId = winner === 'A' ? m.playerAId : m.playerBId

  await db.transaction(async (tx) => {
    await tx
      .update(matches)
      .set({ winnerId, setScores: setsRaw, playedAt: new Date() })
      .where(eq(matches.id, matchId))

    // Advance (or re-advance) winner into the next-round slot.
    const nextRound = (m.round ?? 0) + 1
    const nextSlot = Math.floor((m.bracketSlot ?? 0) / 2)
    const [next] = await tx
      .select()
      .from(matches)
      .where(
        and(
          eq(matches.tournamentId, m.tournamentId!),
          eq(matches.round, nextRound),
          eq(matches.bracketSlot, nextSlot)
        )
      )
    if (next) {
      const slotKey = (m.bracketSlot ?? 0) % 2 === 0 ? 'playerAId' : 'playerBId'
      await tx
        .update(matches)
        .set({ [slotKey]: winnerId } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .where(eq(matches.id, next.id))
    } else {
      await tx
        .update(tournaments)
        .set({ status: 'completed', completedAt: new Date() })
        .where(eq(tournaments.id, m.tournamentId!))
    }
  })

  // Per-game ELO is rebuilt from the full history so re-scores stay consistent.
  await rebuildEloFromHistory()

  revalidatePath(`/tournaments/${m.tournamentId}`)
  revalidatePath(`/admin/tournaments/${m.tournamentId}`)
  revalidatePath('/players')
  revalidatePath('/')
  return { ok: true }
}
```

(Removes the old per-player `applyMatch` + manual ELO writes — `rebuildEloFromHistory` now owns ELO. The `players` import may become unused; remove if so.)

- [ ] **Step 3: Checkpoint** — `npx tsc --noEmit`, `npm test`. Stop.

---

### Task 9: `renameTournament` + `deleteTournament`

**Files:**
- Modify: `app/actions/tournaments.ts`

- [ ] **Step 1: Add a rename validator** in `lib/validators.ts`:

```ts
export const tournamentRenameSchema = z.object({
  name: z.string().trim().min(1).max(80),
})
```

- [ ] **Step 2: Add the two actions** to `app/actions/tournaments.ts`:

```ts
import { tournamentRenameSchema } from '@/lib/validators'

export async function renameTournament(id: string, formData: FormData) {
  const parsed = tournamentRenameSchema.safeParse({ name: formData.get('name') })
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  await db.update(tournaments).set({ name: parsed.data.name }).where(eq(tournaments.id, id))
  revalidatePath('/admin/tournaments')
  revalidatePath(`/admin/tournaments/${id}`)
  revalidatePath('/tournaments')
  return { ok: true }
}

export async function deleteTournament(id: string) {
  // Matches cascade via the FK onDelete: 'cascade'.
  await db.delete(tournaments).where(eq(tournaments.id, id))
  await rebuildEloFromHistory()
  revalidatePath('/admin/tournaments')
  revalidatePath('/tournaments')
  revalidatePath('/players')
  revalidatePath('/')
}
```

- [ ] **Step 3: Checkpoint** — `npx tsc --noEmit`, `npm test`. Stop.

---

## GROUP C — Fix #1 client + game labels  *(suggested model: haiku)*

### Task 10: `match-log-form` — game labels, spinner, re-entrancy guard

**Files:**
- Modify: `components/match-log-form.tsx`

- [ ] **Step 1: Add a re-entrancy ref.** Add `import { useRef }` to the React import. Inside the component, near the other hooks:

```tsx
  const submitting = useRef(false)
```

- [ ] **Step 2: Guard the handler.** At the very top of `async function handle(formData: FormData)`:

```tsx
  async function handle(formData: FormData) {
    if (submitting.current) return
    submitting.current = true
    setError(null)
    setPending(true)
    try {
      const r = isEdit
        ? await editMatch(initial!.id, formData)
        : await logMatch(formData)
      if (r && 'error' in r) {
        setError(r.error ?? null)
        return
      }
      if (onSuccess) onSuccess()
      if (!isEdit) {
        setSavedTick((t) => t + 1)
        setDuration(0)
        setDurationText('')
        setPlayedAt(toLocalDatetimeValue(new Date()))
        setScores(Array.from({ length: 7 }, () => ['', '']))
        setSetCount(1)
        setMode('quick')
        setAId('')
        setBId('')
      }
    } finally {
      setPending(false)
      submitting.current = false
    }
  }
```

- [ ] **Step 3: Spinner on the button.** Replace the submit button block. Add a spinner span (Tailwind animate-spin):

```tsx
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending && (
          <span
            className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground"
            aria-hidden
          />
        )}
        {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Save match'}
      </button>
```

- [ ] **Step 4: Rename "set" UI labels → "game".** In the same file:
  - Legend: `{mode === 'quick' ? 'Score' : 'Sets'}` → `… : 'Games'`.
  - Per-row label: `Set {i + 1}` → `Game {i + 1}`.
  - Remove-button aria-label: `remove set ${i + 1}` → `remove game ${i + 1}`.
  - Add-button: `＋ Add set` → `＋ Add game`.
  - The aria-labels `set ${i + 1} player A/B` on the Steppers → `game ${i + 1} player A/B`.
  - Live badge multi-game text `wins the match (…)` may stay; ensure tie text already reads "Tied — adjust the score" (it does). Keep `name="set_${i}_a"` form field names UNCHANGED (server reads `set_${i}_a`).

- [ ] **Step 5: Manual verification** — dev server, click Save twice fast → only one save, spinner shows. Labels read "Games"/"Game 1". 
- [ ] **Step 6: Checkpoint** — `npx tsc --noEmit`. Stop.

---

### Task 11: Tournament record page — game labels + prefill existing scores

**Files:**
- Modify: `app/admin/tournaments/[id]/match/[matchId]/page.tsx`

- [ ] **Step 1: Prefill existing scores and relabel.** Replace the inputs loop so an already-played match shows its scores (enables re-scoring) and the label says "Game":

```tsx
  const existing = (m.setScores as Array<[number, number]> | null) ?? []
  // ...
      <form action={action} className="space-y-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-12 text-sm text-zinc-500">Game {i + 1}</span>
            <input name={`set_${i}_a`} type="number" min={0} max={99} defaultValue={existing[i]?.[0] ?? ''} className="w-20 rounded border px-2 py-1" />
            <span>–</span>
            <input name={`set_${i}_b`} type="number" min={0} max={99} defaultValue={existing[i]?.[1] ?? ''} className="w-20 rounded border px-2 py-1" />
          </div>
        ))}
        <button type="submit" className="rounded bg-black px-4 py-2 text-white">Save</button>
      </form>
```

- [ ] **Step 2: Checkpoint** — `npx tsc --noEmit`. Stop.

---

## GROUP D — Fix #2 display surfaces  *(suggested model: sonnet for D1/D4, haiku for the rest)*

### Task 12 (D1): `home-data` — keep ties, expose per-player stats

**Files:**
- Modify: `lib/home-data.ts`

- [ ] **Step 1: Stop dropping ties + build stats map.** Replace the matches query filter and add a stats map:

```ts
import { db, matches, players } from '@/lib/db'
import { and, asc, eq, isNotNull } from 'drizzle-orm'
import { playerAggregates, type EngineMatch } from '@/lib/stats-engine'

export type HomePlayer = { id: string; name: string; nickname: string | null; photoUrl: string | null; currentElo: number }
export type PlayerWL = { wins: number; losses: number; games: number }

export async function loadHomeData() {
  const activePlayers = await db
    .select({ id: players.id, name: players.name, nickname: players.nickname, photoUrl: players.photoUrl, currentElo: players.currentElo })
    .from(players)
    .where(eq(players.active, true))
    .orderBy(asc(players.name))

  // Include tied casual sittings (winnerId null) — only require a played_at.
  const rawMatches = await db
    .select()
    .from(matches)
    .where(and(isNotNull(matches.playedAt)))
    .orderBy(asc(matches.playedAt))

  const engineMatches: EngineMatch[] = rawMatches
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

  const nameById = new Map(activePlayers.map((p) => [p.id, p] as const))
  const wlById = new Map<string, PlayerWL>(
    activePlayers.map((p) => {
      const s = playerAggregates(engineMatches, p.id, p.currentElo)
      return [p.id, { wins: s.wins, losses: s.losses, games: s.games }] as const
    })
  )
  return { activePlayers, engineMatches, nameById, wlById }
}

export type HomeData = Awaited<ReturnType<typeof loadHomeData>>
```

- [ ] **Step 2: Pass stats to the leaderboard** in `app/(public)/page.tsx`:

```tsx
<Leaderboard players={data.activePlayers} movers={weekMovers} wlById={data.wlById} />
```

- [ ] **Step 3: Checkpoint** — `npx tsc --noEmit` (leaderboard prop error expected until Task 13).

---

### Task 13 (D2): Leaderboard W–L column

**Files:**
- Modify: `components/leaderboard.tsx`

- [ ] **Step 1: Accept and render W–L.** Add the prop and a column. Update the signature and header, and render per row:

```tsx
import type { PlayerWL } from '@/lib/home-data'

export function Leaderboard({ players, movers, wlById }: { players: HomePlayer[]; movers: Mover[]; wlById: Map<string, PlayerWL> }) {
```

In the header row, add a `W–L` label before `7d`:

```tsx
          <span className="w-14 text-right">W–L</span>
          <span className="w-12 text-right">7d</span>
          <span className="w-10 text-right">Rating</span>
          <span className="w-12 text-right">Gap</span>
```

In each row, before the `7d` span:

```tsx
              {(() => { const wl = wlById.get(p.id); return (
                <span className="w-14 shrink-0 text-right font-mono text-xs nums text-muted-foreground">
                  {wl ? `${wl.wins}–${wl.losses}` : '—'}
                </span>
              ) })()}
```

- [ ] **Step 2: Verify** with a preview fixture — leaderboard shows a W–L column reflecting game-level totals.
- [ ] **Step 3: Checkpoint** — `npx tsc --noEmit`. Stop.

---

### Task 14 (D3): Players list — quick stats per card

**Files:**
- Modify: `app/(public)/players/page.tsx`

- [ ] **Step 1: Load stats and render.** This page currently only queries `players`. Add match loading + aggregates. Replace the data fetch and the card body:

```tsx
import { desc, eq, isNotNull, and, asc } from 'drizzle-orm'
import { db, players, matches } from '@/lib/db'
import { playerAggregates, type EngineMatch } from '@/lib/stats-engine'
import { formatDuration } from '@/lib/stats'
// ...
  const roster = await db.select().from(players).where(eq(players.active, true)).orderBy(desc(players.currentElo))
  const raw = await db.select().from(matches).where(and(isNotNull(matches.playedAt))).orderBy(asc(matches.playedAt))
  const engineMatches: EngineMatch[] = raw
    .filter((m) => m.playerAId && m.playerBId && m.playedAt && (m.setScores?.length ?? 0) > 0)
    .map((m) => ({
      id: m.id, playerAId: m.playerAId!, playerBId: m.playerBId!, winnerId: m.winnerId,
      setScores: (m.setScores as [number, number][]) ?? [], durationSeconds: m.durationSeconds, playedAt: m.playedAt!,
      eloABefore: m.eloABefore ?? 1200, eloAAfter: m.eloAAfter ?? 1200, eloBBefore: m.eloBBefore ?? 1200, eloBAfter: m.eloBAfter ?? 1200,
    }))
  const statsById = new Map(roster.map((p) => [p.id, playerAggregates(engineMatches, p.id, p.currentElo)] as const))
```

In each card, below the name/bio block (inside the `min-w-0 flex-1` div), add a quick-stats line:

```tsx
                {(() => { const s = statsById.get(p.id)!; return (
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] font-mono nums text-muted-foreground">
                    <span><span className="text-gain">{s.wins}</span>W <span className="text-loss">{s.losses}</span>L</span>
                    <span>{s.games} games</span>
                    {s.totalPlayingSeconds > 0 && <span>{formatDuration(s.totalPlayingSeconds)} played</span>}
                  </div>
                ) })()}
```

- [ ] **Step 2: Verify** with preview fixture. **Step 3: Checkpoint** — `npx tsc --noEmit`. Stop.

---

### Task 15 (D4): Player profile — game-level W/L, tiers, stat tiles

**Files:**
- Modify: `app/(public)/players/[id]/page.tsx`

- [ ] **Step 1: Replace the W/L + tier computation (lines ~66–86)** with game-level counting via `playerAggregates` for headline numbers and per-game tier loop:

```tsx
import { playerAggregates, classifyOpponentTier as _unused } from '@/lib/stats-engine' // see note
// Actually use existing import from '@/lib/stats' for classifyOpponentTier.
```

Replace the manual `wins/losses/tier` loop with:

```tsx
  const engineMatches = playerMatches
    .filter((m) => (m.setScores as SetScore[] | null)?.length)
    .map((m) => ({
      id: m.id, playerAId: m.playerAId!, playerBId: m.playerBId!, winnerId: m.winnerId,
      setScores: (m.setScores as [number, number][]) ?? [], durationSeconds: m.durationSeconds, playedAt: m.playedAt!,
      eloABefore: m.eloABefore ?? 1200, eloAAfter: m.eloAAfter ?? 1200, eloBBefore: m.eloBBefore ?? 1200, eloBAfter: m.eloBAfter ?? 1200,
    }))
  const stats = playerAggregates(engineMatches, id, player.currentElo)
  const wins = stats.wins
  const losses = stats.losses
  const winPct = stats.winPct

  // Per-game tier breakdown (classify each game by the sitting's starting elo gap)
  const tier = { higher: { w: 0, l: 0 }, similar: { w: 0, l: 0 }, lower: { w: 0, l: 0 } }
  for (const m of playerMatches) {
    const isA = m.playerAId === id
    const myEloBefore = isA ? m.eloABefore! : m.eloBBefore!
    const oppEloBefore = isA ? m.eloBBefore! : m.eloABefore!
    const t = classifyOpponentTier(myEloBefore, oppEloBefore)
    for (const [sa, sb] of (m.setScores as SetScore[]) ?? []) {
      if (sa === sb) continue
      const iWonGame = isA ? sa > sb : sb > sa
      if (iWonGame) tier[t].w++; else tier[t].l++
    }
  }
```

(Import `classifyOpponentTier` from `@/lib/stats` as it already is; import `playerAggregates` from `@/lib/stats-engine`.)

- [ ] **Step 2: Add stat tiles** in the header key-stats row (replace the `mt-3 flex … text-sm` block) with games, playing time, etc.:

```tsx
            <div className="mt-3 flex items-baseline gap-4 flex-wrap text-muted-foreground text-sm">
              <span><span className="font-mono nums text-foreground">{wins}</span>W <span className="font-mono nums text-foreground">{losses}</span>L</span>
              {winPct !== null && <span className="font-display font-semibold nums text-gain">{winPct}% wins</span>}
              <span className="font-mono nums">{stats.games} games</span>
              {stats.totalPlayingSeconds > 0 && <span className="font-mono nums">{formatDuration(stats.totalPlayingSeconds)} played</span>}
              {avgDuration !== null && <span className="font-mono nums text-muted-foreground">avg {formatDuration(avgDuration)}/game</span>}
            </div>
```

- [ ] **Step 3: Update history rows** — the row's `iWon` boolean is no longer meaningful for ties. Pass the game tally instead. Change the `historyRows` map to include `playerIsA` and `sets` (already there); the component change in Task 16 consumes them.

- [ ] **Step 4: Verify** profile with a preview fixture incl. a tied match. **Step 5: Checkpoint** — `npx tsc --noEmit`. Stop.

---

### Task 16 (D5): `player-games-history` — game tally + ties

**Files:**
- Modify: `components/player-games-history.tsx`

- [ ] **Step 1: Replace the W/L letter with the per-sitting game tally.** Update `HistoryRow` (drop reliance on `iWon`; keep it optional) and the badge. Import `gamesWon`:

```tsx
import { formatScoreForPlayer, gamesWon, type SetScore } from '@/lib/match-format'
```

Replace the W/L badge span (the `flex h-5 w-5 …` block) with a tally badge:

```tsx
          {(() => {
            const { a, b } = gamesWon(r.sets)
            const mine = r.playerIsA ? a : b
            const theirs = r.playerIsA ? b : a
            const tone = mine > theirs ? 'bg-gain/15 text-gain' : mine < theirs ? 'bg-loss/15 text-loss' : 'bg-muted text-muted-foreground'
            return (
              <span className={`flex h-5 min-w-[2.25rem] shrink-0 items-center justify-center rounded px-1 text-[11px] font-bold nums ${tone}`}>
                {mine}–{theirs}
              </span>
            )
          })()}
```

(Leave `formatScoreForPlayer` usage as the per-game scores on the right; it already shows sets-won for multi-game. Optionally keep it.)

- [ ] **Step 2: Verify** — a 2–1 win shows green "2–1"; a 1–1 tie shows neutral "1–1". **Step 3: Checkpoint** — `npx tsc --noEmit`. Stop.

---

### Task 17 (D6): `recent-matches` + `admin/history` — null-winner handling

**Files:**
- Modify: `components/recent-matches.tsx`, `app/admin/history/page.tsx`

- [ ] **Step 1: `recent-matches.tsx`** — `const aWon = r.winnerId === r.aId` is false for both on a tie (fine — no highlight). Add an explicit tie indicator so ties don't look like a B-win. After computing `aWon`, add `const tie = !r.winnerId` and gate the B-side winner bar on `!aWon && !tie`:

```tsx
          const aWon = r.winnerId === r.aId
          const bWon = r.winnerId === r.bId
```
Replace the two `aWon ? 'bg-gain' : 'bg-transparent'` / `!aWon ? …` winner bars with `aWon ? 'bg-gain' : 'bg-transparent'` and `bWon ? 'bg-gain' : 'bg-transparent'`, and the name-weight ternaries from `!aWon` → `bWon`. This makes a tie render with neither side bolded.

- [ ] **Step 2: `admin/history/page.tsx`** — same fix: compute `const bWon = r.winnerId === r.bId`, replace `!aWon` usages on the B side with `bWon` so ties don't falsely bold player B. Scores still render.

- [ ] **Step 3: Verify** with a tied preview fixture in Recent Results and admin history. **Step 4: Checkpoint** — `npx tsc --noEmit`. Stop.

---

## GROUP E — Fix #3 tournament view/edit/delete  *(suggested model: sonnet)*

### Task 18: Admin tournaments list + dashboard link

**Files:**
- Create: `app/admin/tournaments/page.tsx`
- Modify: `app/admin/page.tsx`

- [ ] **Step 1: Create the list page** `app/admin/tournaments/page.tsx`:

```tsx
import Link from 'next/link'
import { desc, eq, sql } from 'drizzle-orm'
import { db, tournaments, tournamentEntries } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function AdminTournamentsPage() {
  const rows = await db
    .select({
      id: tournaments.id,
      name: tournaments.name,
      status: tournaments.status,
      createdAt: tournaments.createdAt,
      players: sql<number>`count(${tournamentEntries.id})`.mapWith(Number),
    })
    .from(tournaments)
    .leftJoin(tournamentEntries, eq(tournamentEntries.tournamentId, tournaments.id))
    .groupBy(tournaments.id)
    .orderBy(desc(tournaments.createdAt))

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 md:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="font-display uppercase tracking-[0.2em] text-xs text-primary mb-1">Race Control</p>
          <h1 className="font-display text-3xl font-bold tracking-tight leading-none">Tournaments</h1>
        </div>
        <Link href="/admin/tournaments/new" className="rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">New tournament</Link>
      </div>
      <ul className="rounded-lg border border-border overflow-hidden bg-card">
        {rows.map((t) => (
          <li key={t.id} className="data-row">
            <Link href={`/admin/tournaments/${t.id}`} className="flex-1 font-medium hover:text-primary">{t.name}</Link>
            <span className="text-xs text-muted-foreground">{t.players} players</span>
            <span className="text-xs text-muted-foreground">{t.createdAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
            <span className="rounded-full bg-secondary px-2 py-0.5 font-display text-[10px] uppercase tracking-wider text-secondary-foreground">{t.status.replace('_', ' ')}</span>
          </li>
        ))}
        {rows.length === 0 && <li className="px-3 py-4 text-sm text-muted-foreground">No tournaments yet.</li>}
      </ul>
    </main>
  )
}
```

- [ ] **Step 2: Add a dashboard card** in `app/admin/page.tsx` `links` array (change "New tournament" to point at the list, add manage entry):

```tsx
  { href: '/admin/tournaments', title: 'Tournaments', desc: 'View, edit results, and delete tournaments' },
  { href: '/admin/tournaments/new', title: 'New tournament', desc: 'Seed and run a bracket' },
```

- [ ] **Step 3: Verify** `/admin/tournaments` lists tournaments. **Step 4: Checkpoint** — `npx tsc --noEmit`. Stop.

---

### Task 19: Manage page — rename, delete, edit decided matches

**Files:**
- Create: `components/admin/tournament-row-actions.tsx`
- Modify: `app/admin/tournaments/[id]/page.tsx`

- [ ] **Step 1: Create the client actions component** `components/admin/tournament-row-actions.tsx` (rename inline + delete with confirm), modelled on `match-row-actions.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { renameTournament, deleteTournament } from '@/app/actions/tournaments'

export function TournamentManageActions({ id, name }: { id: string; name: string }) {
  const router = useRouter()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [renaming, setRenaming] = useState(false)

  async function onRename(formData: FormData) {
    setPending(true)
    await renameTournament(id, formData)
    setPending(false)
    setRenaming(false)
    router.refresh()
  }
  async function confirmDelete() {
    setPending(true)
    await deleteTournament(id)
    setPending(false)
    router.push('/admin/tournaments')
  }

  return (
    <div className="flex items-center gap-2">
      {renaming ? (
        <form action={onRename} className="flex items-center gap-2">
          <input name="name" defaultValue={name} className="rounded-md border border-input bg-background px-2 py-1 text-sm" autoFocus />
          <button type="submit" disabled={pending} className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50">{pending ? 'Saving…' : 'Save'}</button>
          <button type="button" onClick={() => setRenaming(false)} className="text-sm text-muted-foreground">Cancel</button>
        </form>
      ) : (
        <button type="button" onClick={() => setRenaming(true)} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary">Rename</button>
      )}
      <button type="button" onClick={() => setDeleteOpen(true)} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-destructive">
        <Trash2 className="h-4 w-4" /> Delete
      </button>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Delete tournament?</DialogTitle>
            <DialogDescription>{name} — this removes the tournament and all its matches, then rebuilds ELO from the remaining history. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <button type="button" className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
            </DialogClose>
            <button type="button" onClick={confirmDelete} disabled={pending} className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{pending ? 'Deleting…' : 'Delete tournament'}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 2: Wire into the manage page** `app/admin/tournaments/[id]/page.tsx`. Add the actions row, and allow editing *decided* matches by changing the bracket `href` to link any match with two players (not just unplayed ones):

```tsx
import { TournamentManageActions } from '@/components/admin/tournament-row-actions'
// ...
      <div className="mb-4 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{data.tournament.name}</h1>
        <TournamentManageActions id={id} name={data.tournament.name} />
      </div>
      <p className="mb-2 text-sm text-zinc-500">Status: {data.tournament.status}</p>
      <p className="mb-6 text-xs text-muted-foreground">Tip: click any match with both players set to record or fix its result. Editing an early-round result re-advances the immediate next match only — deeper rounds aren&apos;t auto-rewritten.</p>
      <BracketView
        matches={data.bracket}
        href={(m) => (m.playerA && m.playerB ? `/admin/tournaments/${id}/match/${m.id}` : null)}
      />
```

- [ ] **Step 3: Verify** — rename persists; deleting redirects to the list and ratings rebuild; clicking a completed match opens the record page prefilled and re-scoring updates the bracket. Use a throwaway preview tournament.
- [ ] **Step 4: Checkpoint** — `npx tsc --noEmit`, full `npm test`. Stop.

---

## Final verification (after all tasks)

- [ ] `npm test` — all suites green.
- [ ] `npx tsc --noEmit` — no type errors.
- [ ] `npm run lint` — clean (or no new warnings).
- [ ] In the admin dashboard, run **"Rebuild ELO from match history"** once to backdate all ratings under per-game logic.
- [ ] Smoke test on preview data: log a normal match, a tied match, a double-click; view a player profile, the leaderboard, recent results; create/edit/delete a tournament.
- [ ] Hand back to repo owner for commit (do not commit).

---

## Self-review notes (author)

- **Spec coverage:** Fix #1 → Tasks 4, 7, 10. Fix #2 (game W/L, per-game ELO, ties, backdate, rename, new stats) → Tasks 1–3, 5–8, 12–17. Fix #3 → Tasks 8, 9, 11, 18, 19. K=32 unchanged (no K task — intentional). `winnerId == null` overload handled in Tasks 12, 17 and disambiguated via `playedAt`/`setScores.length`.
- **Single source of truth for ELO:** `applyGames` (Task 1) used by `logMatch` (7), `recordTournamentResult` (8), and `rebuildEloFromHistory` (6). 
- **Naming consistency:** `rebuildEloFromHistory`, `applyGames`, `isDuplicateMatch`, `gamesWon`/`gameTally`, `renameTournament`/`deleteTournament`, `wlById`, `TournamentManageActions` used consistently across tasks.
- **DB column `set_scores` intentionally not renamed; form field names `set_{i}_a/b` intentionally unchanged.**

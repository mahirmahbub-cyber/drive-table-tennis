# Quick Seeder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A public `/seeder` page that builds an egalitarian, ELO-seeded queue of casual 1v1 matchups for a session, logs results through the existing flow, and survives refresh via localStorage.

**Architecture:** A pure, deterministic core in `lib/seeder.ts` (PRNG, game-count math, pairing) is composed by a pure session reducer in `lib/seeder-session.ts` and a pure storage layer in `lib/seeder-storage.ts`. Thin client components (`components/quick-seeder.tsx` + `components/seeder/*`) hold state, mirror it to localStorage, and wire the existing `MatchStopwatch`, `Stepper`, and `logMatch` server action for play/logging.

**Tech Stack:** Next.js 16 (App Router, server + client components), React 19, TypeScript, Drizzle, Vitest, Tailwind v4.

> **Git note (project workflow):** The implementer does **NOT** run `git add/commit/push` — Mahir handles all git. "Checkpoint" markers indicate natural commit points for him; do not run git commands.

> **Spec:** `docs/superpowers/specs/2026-06-15-quick-seeder-design.md`

---

## File Structure

- **Create** `lib/seeder.ts` — pure generator: types, constants, `mulberry32`, `computeGameCount`, `opponentWeights`, `pickOpponent`, `buildMatchups`.
- **Create** `lib/seeder.test.ts` — unit tests for the generator.
- **Create** `lib/seeder-session.ts` — pure session reducer: `SessionState` + transition functions + `buildLogFields`.
- **Create** `lib/seeder-session.test.ts` — unit tests for the reducer.
- **Create** `lib/seeder-storage.ts` — `STORAGE_KEY`, `serializeSession`, `parseStoredSession`.
- **Create** `lib/seeder-storage.test.ts` — unit tests for storage round-trip + version guard.
- **Create** `app/(public)/seeder/page.tsx` — server component, fetches active players, renders `<QuickSeeder>`.
- **Create** `components/quick-seeder.tsx` — client root: state, persistence, orchestration.
- **Create** `components/seeder/seeder-setup.tsx` — roster + config + generate.
- **Create** `components/seeder/seeder-queue.tsx` — queue list, active matchup card, condensed log, walk-in/generate-more/clear controls.
- **Modify** `components/site-header.tsx:11-17` — add `{ href: '/seeder', label: 'Seeder' }` to `NAV`.

Reuses (no changes): `MatchStopwatch`, `Stepper`, `logMatch` (`app/actions/matches.ts`), `formatDuration` (`lib/stats.ts`).

---

## Task 1: Seeder core scaffolding (types, constants, PRNG, game count)

**Files:**
- Create: `lib/seeder.ts`
- Test: `lib/seeder.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/seeder.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mulberry32, computeGameCount, GAME_MINUTES } from './seeder'

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(123)
    const b = mulberry32(123)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })
  it('produces values in [0, 1)', () => {
    const r = mulberry32(7)
    for (let i = 0; i < 50; i++) {
      const v = r()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('computeGameCount', () => {
  it('uses the time budget when it exceeds the everyone-once minimum', () => {
    // 30 min / 5 (target 11) = 6 budget games; 4 players => min 2 => 6
    expect(computeGameCount(4, { target: 11, minutes: 30 })).toBe(6)
  })
  it('overrides the budget to guarantee everyone plays once', () => {
    // 5 min / 5 = 1 budget game; 7 players => min ceil(7/2)=4 => 4
    expect(computeGameCount(7, { target: 11, minutes: 5 })).toBe(4)
  })
  it('reflects the per-target game minutes', () => {
    expect(GAME_MINUTES).toEqual({ 7: 3, 11: 5, 21: 12 })
    // 24 min / 12 (target 21) = 2 budget; 2 players => min 1 => 2
    expect(computeGameCount(2, { target: 21, minutes: 24 })).toBe(2)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/seeder.test.ts`
Expected: FAIL — cannot import from `./seeder` (module/exports missing).

- [ ] **Step 3: Write the minimal implementation**

Create `lib/seeder.ts`:

```ts
export type Target = 7 | 11 | 21

/** Fixed estimate of minutes per single game, by target points. Tunable. */
export const GAME_MINUTES: Record<Target, number> = { 7: 3, 11: 5, 21: 12 }

/** ELO distance scale for opponent weighting (points per "unit" of closeness). */
export const ELO_SCALE = 100

export type PlayerRef = { id: string; name: string; elo: number }

export type MatchupStatus = 'pending' | 'playing' | 'done'

export type Matchup = {
  id: string
  aId: string
  bId: string
  status: MatchupStatus
  startedAt?: number
  durationSeconds?: number
  score?: [number, number]
}

export type SeederConfig = {
  target: Target
  minutes: number
  mix: number // 0..1 — probability of a deliberate high-v-low "upset" pairing
  seed: number
}

/** Small, fast, seedable PRNG. Returns a function yielding floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * How many games to schedule: the larger of the time-budget count and the
 * everyone-plays-once minimum (one table → ceil(N/2) games seats everyone).
 */
export function computeGameCount(
  playerCount: number,
  opts: { target: Target; minutes: number }
): number {
  if (playerCount < 2) return 0
  const perGame = GAME_MINUTES[opts.target]
  const budget = Math.floor(opts.minutes / perGame)
  const min = Math.ceil(playerCount / 2)
  return Math.max(budget, min)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/seeder.test.ts`
Expected: PASS (all 5 tests).

- [ ] **Step 5: Checkpoint** — `lib/seeder.ts` scaffolding complete (natural commit point for Mahir).

---

## Task 2: Opponent selection (ELO closeness vs upset weighting)

**Files:**
- Modify: `lib/seeder.ts`
- Test: `lib/seeder.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `lib/seeder.test.ts`:

```ts
import { opponentWeights, pickOpponent } from './seeder'
import type { PlayerRef } from './seeder'

const P = (id: string, elo: number): PlayerRef => ({ id, name: id, elo })

describe('opponentWeights', () => {
  const cands = [P('close', 1210), P('mid', 1400), P('far', 1800)]
  it('competitive weighting favours the closest ELO', () => {
    const w = opponentWeights(1200, cands, false)
    expect(w[0]).toBeGreaterThan(w[1])
    expect(w[1]).toBeGreaterThan(w[2])
  })
  it('upset weighting favours the farthest ELO', () => {
    const w = opponentWeights(1200, cands, true)
    expect(w[2]).toBeGreaterThan(w[1])
    expect(w[1]).toBeGreaterThan(w[0])
  })
  it('returns one weight per candidate, all positive', () => {
    const w = opponentWeights(1200, cands, false)
    expect(w).toHaveLength(3)
    expect(w.every((x) => x > 0)).toBe(true)
  })
})

describe('pickOpponent', () => {
  const cands = [P('close', 1210), P('mid', 1400), P('far', 1800)]
  it('returns one of the candidates', () => {
    const rng = mulberry32(1)
    const chosen = pickOpponent({ pickedElo: 1200, candidates: cands, upset: false, rng })
    expect(cands.map((c) => c.id)).toContain(chosen.id)
  })
  it('is deterministic for a fixed seed', () => {
    const a = pickOpponent({ pickedElo: 1200, candidates: cands, upset: false, rng: mulberry32(42) })
    const b = pickOpponent({ pickedElo: 1200, candidates: cands, upset: false, rng: mulberry32(42) })
    expect(a.id).toBe(b.id)
  })
  it('competitive picks lean toward close over many seeds', () => {
    let closeWins = 0
    for (let s = 0; s < 200; s++) {
      const c = pickOpponent({ pickedElo: 1200, candidates: cands, upset: false, rng: mulberry32(s) })
      if (c.id === 'close') closeWins++
    }
    expect(closeWins).toBeGreaterThan(200 / 3) // beats uniform share
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/seeder.test.ts`
Expected: FAIL — `opponentWeights` / `pickOpponent` not exported.

- [ ] **Step 3: Write the minimal implementation**

Append to `lib/seeder.ts`:

```ts
/**
 * Weight each candidate by ELO relation to the picked player.
 * Competitive (upset=false): closer ELO → higher weight.
 * Upset (upset=true): farther ELO → higher weight.
 */
export function opponentWeights(
  pickedElo: number,
  candidates: PlayerRef[],
  upset: boolean
): number[] {
  return candidates.map((c) => {
    const dist = Math.abs(c.elo - pickedElo) / ELO_SCALE
    return upset ? 1 + dist : 1 / (1 + dist)
  })
}

/** Weighted-random opponent choice driven by the supplied PRNG. */
export function pickOpponent(args: {
  pickedElo: number
  candidates: PlayerRef[]
  upset: boolean
  rng: () => number
}): PlayerRef {
  const { pickedElo, candidates, upset, rng } = args
  const weights = opponentWeights(pickedElo, candidates, upset)
  const total = weights.reduce((s, w) => s + w, 0)
  let roll = rng() * total
  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i]
    if (roll < 0) return candidates[i]
  }
  return candidates[candidates.length - 1]
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/seeder.test.ts`
Expected: PASS (all tests, including the 4 new ones).

- [ ] **Step 5: Checkpoint** — opponent selection complete.

---

## Task 3: `buildMatchups` — the pairing loop

**Files:**
- Modify: `lib/seeder.ts`
- Test: `lib/seeder.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `lib/seeder.test.ts`:

```ts
import { buildMatchups } from './seeder'
import type { Matchup, SeederConfig } from './seeder'

const roster = (n: number): PlayerRef[] =>
  Array.from({ length: n }, (_, i) => P(`p${i}`, 1100 + i * 50))
const cfg = (over: Partial<SeederConfig> = {}): SeederConfig => ({
  target: 11, minutes: 30, mix: 0.2, seed: 1, ...over,
})
const counts = (players: PlayerRef[], q: Matchup[]) => {
  const m = new Map(players.map((p) => [p.id, 0]))
  for (const x of q) { m.set(x.aId, (m.get(x.aId) ?? 0) + 1); m.set(x.bId, (m.get(x.bId) ?? 0) + 1) }
  return m
}

describe('buildMatchups', () => {
  it('emits exactly `count` matchups', () => {
    const q = buildMatchups({ players: roster(5), config: cfg(), history: [], count: 6 })
    expect(q).toHaveLength(6)
    expect(q.every((m) => m.status === 'pending')).toBe(true)
  })

  it('returns [] when fewer than 2 players', () => {
    expect(buildMatchups({ players: roster(1), config: cfg(), count: 4 })).toEqual([])
  })

  it('never pairs a player with themselves', () => {
    const q = buildMatchups({ players: roster(6), config: cfg(), count: 12 })
    expect(q.every((m) => m.aId !== m.bId)).toBe(true)
  })

  it('keeps game counts within ±1 for even and odd rosters', () => {
    for (const n of [3, 4, 5, 7]) {
      const players = roster(n)
      const count = computeGameCount(n, { target: 11, minutes: 60 })
      const q = buildMatchups({ players, config: cfg(), count })
      const vals = [...counts(players, q).values()]
      expect(Math.max(...vals) - Math.min(...vals)).toBeLessThanOrEqual(1)
    }
  })

  it('guarantees everyone plays at least once (incl. odd rosters)', () => {
    for (const n of [3, 5, 7]) {
      const players = roster(n)
      const count = computeGameCount(n, { target: 11, minutes: 1 }) // forces the min
      const q = buildMatchups({ players, config: cfg(), count })
      for (const v of counts(players, q).values()) expect(v).toBeGreaterThanOrEqual(1)
    }
  })

  it('avoids back-to-back appearances when the roster allows', () => {
    const q = buildMatchups({ players: roster(5), config: cfg(), count: 10 })
    for (let i = 1; i < q.length; i++) {
      const prev = new Set([q[i - 1].aId, q[i - 1].bId])
      expect(prev.has(q[i].aId) && prev.has(q[i].bId)).toBe(false) // not the exact same pair
      // and ideally no shared player back-to-back:
      expect(prev.has(q[i].aId) || prev.has(q[i].bId)).toBe(false)
    }
  })

  it('is deterministic for identical inputs', () => {
    const a = buildMatchups({ players: roster(6), config: cfg(), count: 8 })
    const b = buildMatchups({ players: roster(6), config: cfg(), count: 8 })
    expect(a.map((m) => [m.aId, m.bId])).toEqual(b.map((m) => [m.aId, m.bId]))
  })

  it('seeds fairness from history and continues counts', () => {
    const players = roster(4)
    const history: Matchup[] = [
      { id: 'h0', aId: 'p0', bId: 'p1', status: 'done' },
      { id: 'h1', aId: 'p0', bId: 'p2', status: 'done' },
    ]
    const q = buildMatchups({ players, config: cfg(), history, count: 2 })
    const all = counts(players, [...history, ...q])
    // p0 already had 2; the tail should not keep picking p0 — counts stay within ±1 overall
    expect(Math.max(...all.values()) - Math.min(...all.values())).toBeLessThanOrEqual(1)
    // new ids do not collide with history ids
    expect(q.every((m) => m.id !== 'h0' && m.id !== 'h1')).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/seeder.test.ts`
Expected: FAIL — `buildMatchups` not exported.

- [ ] **Step 3: Write the minimal implementation**

Append to `lib/seeder.ts`:

```ts
function inMatchup(m: Matchup | null, id: string): boolean {
  return !!m && (m.aId === id || m.bId === id)
}

/**
 * Emit exactly `count` new pending matchups for a single-table session.
 *
 * Fairness/order rules (no rounds, no byes — incl. odd rosters):
 *  - The "picked" side is always a player with the fewest games so far, never
 *    in the immediately previous matchup when avoidable.
 *  - The opponent is drawn from the fewest-games eligible tier (coverage), then
 *    ELO-weighted within it (close by default; far on an `mix`-probability upset).
 *  - PRNG-seeded → fully deterministic for a given (players, config, history).
 */
export function buildMatchups(input: {
  players: PlayerRef[]
  config: SeederConfig
  history?: Matchup[]
  count: number
}): Matchup[] {
  const { players, config } = input
  const history = input.history ?? []
  if (players.length < 2 || input.count <= 0) return []

  const rng = mulberry32(config.seed)
  const games = new Map(players.map((p) => [p.id, 0]))
  for (const m of history) {
    if (games.has(m.aId)) games.set(m.aId, (games.get(m.aId) ?? 0) + 1)
    if (games.has(m.bId)) games.set(m.bId, (games.get(m.bId) ?? 0) + 1)
  }
  let last: Matchup | null = history.length ? history[history.length - 1] : null

  const out: Matchup[] = []
  for (let i = 0; i < input.count; i++) {
    // 1. Picked = fewest games; prefer those not in the previous matchup.
    const minGames = Math.min(...players.map((p) => games.get(p.id) ?? 0))
    const minPool = players.filter((p) => (games.get(p.id) ?? 0) === minGames)
    const freshPool = minPool.filter((p) => !inMatchup(last, p.id))
    const pickPool = freshPool.length ? freshPool : minPool
    const picked = pickPool[Math.floor(rng() * pickPool.length)]

    // 2. Coverage first: fewest-games tier across all non-picked players.
    //    (Coverage MUST precede back-to-back avoidance, or fairness can drift to ±2.)
    const allOpp = players.filter((p) => p.id !== picked.id)
    const minElig = Math.min(...allOpp.map((p) => games.get(p.id) ?? 0))
    const tier = allOpp.filter((p) => (games.get(p.id) ?? 0) === minElig)

    // 3. Within the tier, prefer non-back-to-back; relax if the tier forces it.
    const freshTier = tier.filter((p) => !inMatchup(last, p.id))
    const oppPool = freshTier.length ? freshTier : tier
    const upset = rng() < config.mix
    const opp = pickOpponent({ pickedElo: picked.elo, candidates: oppPool, upset, rng })

    const m: Matchup = {
      id: `${config.seed.toString(36)}-${history.length + i}`,
      aId: picked.id,
      bId: opp.id,
      status: 'pending',
    }
    out.push(m)
    games.set(picked.id, (games.get(picked.id) ?? 0) + 1)
    games.set(opp.id, (games.get(opp.id) ?? 0) + 1)
    last = m
  }
  return out
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/seeder.test.ts`
Expected: PASS (all generator tests).

> Note: the "seeds fairness from history" test uses history ids `h0/h1`; new ids are `seed-base36 + '-' + (history.length+i)` → no collision. If the back-to-back test ever flakes on a small roster, that is expected only for N=2 (single pair) — N≥3 must pass.

- [ ] **Step 5: Checkpoint** — generator core complete.

---

## Task 4: Session reducer — setup phase + log payload

**Files:**
- Create: `lib/seeder-session.ts`
- Test: `lib/seeder-session.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/seeder-session.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  createSession, setConfig, toggleRosterPlayer, generate, buildLogFields, DEFAULT_CONFIG,
} from './seeder-session'
import type { PlayerRef } from './seeder'

const P = (id: string, elo = 1200): PlayerRef => ({ id, name: id, elo })

describe('createSession', () => {
  it('starts empty with default config and the given seed', () => {
    const s = createSession(99)
    expect(s.roster).toEqual([])
    expect(s.queue).toEqual([])
    expect(s.config).toEqual({ ...DEFAULT_CONFIG, seed: 99 })
  })
})

describe('setConfig', () => {
  it('merges config without touching the seed', () => {
    const s = setConfig(createSession(1), { target: 21, minutes: 45 })
    expect(s.config.target).toBe(21)
    expect(s.config.minutes).toBe(45)
    expect(s.config.seed).toBe(1)
  })
})

describe('toggleRosterPlayer', () => {
  it('adds a player not present and removes one already present', () => {
    let s = createSession(1)
    s = toggleRosterPlayer(s, P('a'))
    expect(s.roster.map((p) => p.id)).toEqual(['a'])
    s = toggleRosterPlayer(s, P('a'))
    expect(s.roster).toEqual([])
  })
})

describe('generate', () => {
  it('builds a queue from the roster sized by config', () => {
    let s = createSession(1)
    for (const id of ['a', 'b', 'c', 'd']) s = toggleRosterPlayer(s, P(id))
    s = setConfig(s, { target: 11, minutes: 30 }) // 6 games
    s = generate(s)
    expect(s.queue).toHaveLength(6)
    expect(s.queue.every((m) => m.status === 'pending')).toBe(true)
  })
})

describe('buildLogFields', () => {
  it('maps a finished matchup to logMatch form fields', () => {
    expect(buildLogFields({ aId: 'a', bId: 'b' }, [11, 7], 240)).toEqual({
      playerAId: 'a', playerBId: 'b', set_0_a: '11', set_0_b: '7',
      durationSeconds: '240', playedAt: '',
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/seeder-session.test.ts`
Expected: FAIL — `./seeder-session` not found.

- [ ] **Step 3: Write the minimal implementation**

Create `lib/seeder-session.ts`:

```ts
import {
  buildMatchups, computeGameCount, type Matchup, type PlayerRef, type SeederConfig, type Target,
} from './seeder'

export type SessionState = {
  config: SeederConfig
  roster: PlayerRef[]
  queue: Matchup[]
}

export const DEFAULT_CONFIG: Omit<SeederConfig, 'seed'> = {
  target: 11 as Target,
  minutes: 30,
  mix: 0.2,
}

export function createSession(seed: number): SessionState {
  return { config: { ...DEFAULT_CONFIG, seed }, roster: [], queue: [] }
}

export function setConfig(
  s: SessionState,
  partial: Partial<Omit<SeederConfig, 'seed'>>
): SessionState {
  return { ...s, config: { ...s.config, ...partial } }
}

export function toggleRosterPlayer(s: SessionState, p: PlayerRef): SessionState {
  const present = s.roster.some((r) => r.id === p.id)
  const roster = present ? s.roster.filter((r) => r.id !== p.id) : [...s.roster, p]
  return { ...s, roster }
}

export function generate(s: SessionState): SessionState {
  const count = computeGameCount(s.roster.length, s.config)
  const queue = buildMatchups({ players: s.roster, config: s.config, history: [], count })
  return { ...s, queue }
}

/** Build the field map the existing `logMatch` server action expects (single game). */
export function buildLogFields(
  matchup: { aId: string; bId: string },
  score: [number, number],
  durationSeconds: number
): Record<string, string> {
  return {
    playerAId: matchup.aId,
    playerBId: matchup.bId,
    set_0_a: String(score[0]),
    set_0_b: String(score[1]),
    durationSeconds: String(durationSeconds),
    playedAt: '',
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/seeder-session.test.ts`
Expected: PASS (all setup-phase tests).

- [ ] **Step 5: Checkpoint** — session setup reducer complete.

---

## Task 5: Session reducer — play & mutation (start/finish, add/remove, generate-more)

**Files:**
- Modify: `lib/seeder-session.ts`
- Test: `lib/seeder-session.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `lib/seeder-session.test.ts`:

```ts
import {
  startMatchup, finishMatchup, addPlayer, removePlayer, generateMore,
} from './seeder-session'

function generated(ids: string[], over = {}) {
  let s = createSession(1)
  for (const id of ids) s = toggleRosterPlayer(s, P(id))
  s = setConfig(s, { minutes: 30, ...over })
  return generate(s)
}

describe('startMatchup', () => {
  it('marks the matchup playing and stamps startedAt', () => {
    const s0 = generated(['a', 'b', 'c', 'd'])
    const id = s0.queue[0].id
    const s = startMatchup(s0, id, 1000)
    const m = s.queue.find((x) => x.id === id)!
    expect(m.status).toBe('playing')
    expect(m.startedAt).toBe(1000)
  })
})

describe('finishMatchup', () => {
  it('marks the matchup done with score and duration', () => {
    const s0 = generated(['a', 'b', 'c', 'd'])
    const id = s0.queue[0].id
    const s = finishMatchup(startMatchup(s0, id, 1000), id, [11, 9], 300)
    const m = s.queue.find((x) => x.id === id)!
    expect(m.status).toBe('done')
    expect(m.score).toEqual([11, 9])
    expect(m.durationSeconds).toBe(300)
  })
})

describe('addPlayer', () => {
  it('weaves a newcomer in and keeps played games untouched', () => {
    let s = generated(['a', 'b', 'c', 'd'])
    const firstId = s.queue[0].id
    s = finishMatchup(startMatchup(s, firstId, 1), firstId, [11, 5], 200)
    const before = s.queue.filter((m) => m.status === 'done').map((m) => m.id)
    s = addPlayer(s, P('e'))
    const after = s.queue.filter((m) => m.status === 'done').map((m) => m.id)
    expect(after).toEqual(before) // done games preserved
    expect(s.roster.map((p) => p.id)).toContain('e')
    expect(s.queue.some((m) => m.aId === 'e' || m.bId === 'e')).toBe(true) // newcomer scheduled
  })
})

describe('removePlayer', () => {
  it('drops the player and any pending matchup that includes them', () => {
    let s = generated(['a', 'b', 'c', 'd'])
    s = removePlayer(s, 'a')
    expect(s.roster.some((p) => p.id === 'a')).toBe(false)
    expect(s.queue.some((m) => m.status === 'pending' && (m.aId === 'a' || m.bId === 'a'))).toBe(false)
  })
})

describe('generateMore', () => {
  it('appends a fresh batch sized by the new time budget', () => {
    const s0 = generated(['a', 'b', 'c', 'd'])
    const len0 = s0.queue.length
    const s = generateMore(s0, 15, 999) // 15/5 = 3 budget; 4 players => 3
    expect(s.queue.length).toBe(len0 + 3)
    expect(s.config.minutes).toBe(15)
    expect(s.config.seed).toBe(999)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/seeder-session.test.ts`
Expected: FAIL — new functions not exported.

- [ ] **Step 3: Write the minimal implementation**

Append to `lib/seeder-session.ts`:

```ts
function regenerateTail(s: SessionState): SessionState {
  const kept = s.queue.filter((m) => m.status !== 'pending') // done + playing stay
  const total = computeGameCount(s.roster.length, s.config)
  const count = Math.max(0, total - kept.length)
  const tail = buildMatchups({ players: s.roster, config: s.config, history: kept, count })
  return { ...s, queue: [...kept, ...tail] }
}

export function startMatchup(s: SessionState, id: string, now: number): SessionState {
  return {
    ...s,
    queue: s.queue.map((m) =>
      m.id === id ? { ...m, status: 'playing', startedAt: now } : m
    ),
  }
}

export function finishMatchup(
  s: SessionState,
  id: string,
  score: [number, number],
  durationSeconds: number
): SessionState {
  return {
    ...s,
    queue: s.queue.map((m) =>
      m.id === id ? { ...m, status: 'done', score, durationSeconds } : m
    ),
  }
}

export function addPlayer(s: SessionState, p: PlayerRef): SessionState {
  if (s.roster.some((r) => r.id === p.id)) return s
  const withPlayer = { ...s, roster: [...s.roster, p] }
  return s.queue.length === 0 ? withPlayer : regenerateTail(withPlayer)
}

export function removePlayer(s: SessionState, playerId: string): SessionState {
  const roster = s.roster.filter((r) => r.id !== playerId)
  // Drop pending matchups that include the player; keep their played history.
  const queue = s.queue.filter(
    (m) => m.status !== 'pending' || (m.aId !== playerId && m.bId !== playerId)
  )
  return regenerateTail({ ...s, roster, queue })
}

export function generateMore(s: SessionState, minutes: number, seed: number): SessionState {
  const config = { ...s.config, minutes, seed }
  const count = computeGameCount(s.roster.length, { target: config.target, minutes })
  const more = buildMatchups({ players: s.roster, config, history: s.queue, count })
  return { ...s, config, queue: [...s.queue, ...more] }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/seeder-session.test.ts`
Expected: PASS (all reducer tests).

- [ ] **Step 5: Checkpoint** — session reducer complete.

---

## Task 6: Storage layer (serialize + version-guarded parse)

**Files:**
- Create: `lib/seeder-storage.ts`
- Test: `lib/seeder-storage.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/seeder-storage.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { STORAGE_KEY, serializeSession, parseStoredSession } from './seeder-storage'
import { createSession, toggleRosterPlayer, generate, setConfig } from './seeder-session'

describe('storage', () => {
  it('uses a versioned key', () => {
    expect(STORAGE_KEY).toBe('quick-seeder:v1')
  })

  it('round-trips a session', () => {
    let s = createSession(7)
    s = toggleRosterPlayer(s, { id: 'a', name: 'A', elo: 1200 })
    s = toggleRosterPlayer(s, { id: 'b', name: 'B', elo: 1300 })
    s = generate(setConfig(s, { minutes: 30 }))
    const back = parseStoredSession(serializeSession(s))
    expect(back).toEqual(s)
  })

  it('returns null for missing or malformed data', () => {
    expect(parseStoredSession(null)).toBeNull()
    expect(parseStoredSession('not json')).toBeNull()
    expect(parseStoredSession('{"roster":[]}')).toBeNull() // missing config/queue
    expect(parseStoredSession('{"config":{},"roster":"x","queue":[]}')).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/seeder-storage.test.ts`
Expected: FAIL — `./seeder-storage` not found.

- [ ] **Step 3: Write the minimal implementation**

Create `lib/seeder-storage.ts`:

```ts
import type { SessionState } from './seeder-session'

export const STORAGE_KEY = 'quick-seeder:v1'

export function serializeSession(s: SessionState): string {
  return JSON.stringify(s)
}

/** Parse a stored session, returning null for anything that isn't a valid shape. */
export function parseStoredSession(raw: string | null): SessionState | null {
  if (!raw) return null
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof data !== 'object' || data === null) return null
  const d = data as Record<string, unknown>
  const config = d.config as Record<string, unknown> | undefined
  const okConfig =
    !!config &&
    typeof config.target === 'number' &&
    typeof config.minutes === 'number' &&
    typeof config.mix === 'number' &&
    typeof config.seed === 'number'
  if (!okConfig || !Array.isArray(d.roster) || !Array.isArray(d.queue)) return null
  return data as SessionState
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/seeder-storage.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full suite** — `npx vitest run` → all seeder tests green alongside the existing suite.

- [ ] **Step 6: Checkpoint** — pure layers complete; UI next.

---

## Task 7: Page, nav link, and client root with persistence

**Files:**
- Create: `app/(public)/seeder/page.tsx`
- Create: `components/quick-seeder.tsx`
- Modify: `components/site-header.tsx:11-17`

- [ ] **Step 1: Add the nav link**

In `components/site-header.tsx`, add to the `NAV` array (after the Calculator entry):

```ts
const NAV = [
  { href: '/players', label: 'Players' },
  { href: '/matches', label: 'Matches' },
  { href: '/matrix', label: 'Mogboard' },
  { href: '/tournaments', label: 'Tournaments' },
  { href: '/calculator', label: 'Calculator' },
  { href: '/seeder', label: 'Seeder' },
]
```

- [ ] **Step 2: Create the server page**

Create `app/(public)/seeder/page.tsx` (mirrors `calculator/page.tsx`):

```tsx
import { asc, eq } from 'drizzle-orm'
import { db, players } from '@/lib/db'
import { QuickSeeder } from '@/components/quick-seeder'

export const dynamic = 'force-dynamic'

export default async function SeederPage() {
  const roster = await db
    .select({ id: players.id, name: players.name, currentElo: players.currentElo })
    .from(players)
    .where(eq(players.active, true))
    .orderBy(asc(players.name))

  const options = roster.map((p) => ({ id: p.id, name: p.name, elo: p.currentElo }))

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8 md:px-6">
      <div className="mb-6">
        <p className="font-display uppercase tracking-[0.2em] text-xs text-primary mb-1">
          Casual play
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight leading-none">
          Quick Seeder
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pick who&rsquo;s playing, set a time budget, and get a fair, ELO-seeded run of games.
        </p>
      </div>
      <QuickSeeder players={options} />
    </main>
  )
}
```

- [ ] **Step 3: Create the client root with persistence**

Create `components/quick-seeder.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import type { PlayerRef } from '@/lib/seeder'
import {
  type SessionState, createSession,
} from '@/lib/seeder-session'
import { STORAGE_KEY, serializeSession, parseStoredSession } from '@/lib/seeder-storage'

function randomSeed(): number {
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0
}

export function QuickSeeder({ players }: { players: PlayerRef[] }) {
  // Client-only init to avoid SSR/hydration mismatch (mirrors match-log-form.tsx).
  const [session, setSession] = useState<SessionState | null>(null)

  useEffect(() => {
    const stored = parseStoredSession(
      typeof window === 'undefined' ? null : window.localStorage.getItem(STORAGE_KEY)
    )
    setSession(stored ?? createSession(randomSeed()))
  }, [])

  useEffect(() => {
    if (session) window.localStorage.setItem(STORAGE_KEY, serializeSession(session))
  }, [session])

  if (!session) return <div className="text-sm text-muted-foreground">Loading…</div>

  // Placeholder until Task 8/9 wire the setup + queue UIs.
  return (
    <div data-testid="quick-seeder" className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Roster options: {players.length} · In session: {session.roster.length} · Queued:{' '}
        {session.queue.length}
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Verify in preview** (no DB writes — read-only page)

  1. `preview_start` (dev server). 2. Navigate to `/seeder`.
  3. `preview_snapshot` → confirm the heading "Quick Seeder" and the placeholder line render; "Seeder" appears in the nav.
  4. `preview_console_logs` → no hydration errors.
  5. Reload → still renders (localStorage init path works).

  Expected: page renders, nav link present, no console errors.

- [ ] **Step 5: Checkpoint** — page + persistence shell live.

---

## Task 8: Setup UI (roster, config, generate) + queue with play/log

**Files:**
- Create: `components/seeder/seeder-setup.tsx`
- Create: `components/seeder/seeder-queue.tsx`
- Modify: `components/quick-seeder.tsx`

- [ ] **Step 1: Create the setup component**

Create `components/seeder/seeder-setup.tsx`:

```tsx
'use client'

import type { PlayerRef, Target } from '@/lib/seeder'
import type { SessionState } from '@/lib/seeder-session'

const TARGETS: Target[] = [7, 11, 21]

export function SeederSetup({
  players,
  session,
  onToggle,
  onConfig,
  onGenerate,
}: {
  players: PlayerRef[]
  session: SessionState
  onToggle: (p: PlayerRef) => void
  onConfig: (partial: Partial<{ target: Target; minutes: number; mix: number }>) => void
  onGenerate: () => void
}) {
  const inRoster = (id: string) => session.roster.some((r) => r.id === id)
  const { config, roster } = session

  return (
    <div className="space-y-6">
      <fieldset className="space-y-2">
        <legend className="section-header font-display w-full">Players ({roster.length})</legend>
        <div className="grid grid-cols-2 gap-2">
          {players.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onToggle(p)}
              aria-pressed={inRoster(p.id)}
              className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors ${
                inRoster(p.id)
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-input text-foreground hover:bg-secondary'
              }`}
            >
              <span className="truncate">{p.name}</span>
              <span className="ml-2 font-mono nums text-xs text-muted-foreground">{p.elo}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2">
        <div className="section-header font-display">Game to</div>
        <div className="flex gap-1 rounded-lg bg-secondary p-1">
          {TARGETS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onConfig({ target: t })}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                config.target === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="font-display uppercase tracking-widest text-xs text-muted-foreground">
          Time available (minutes)
        </span>
        <input
          type="number"
          min={1}
          max={600}
          value={config.minutes}
          onChange={(e) => onConfig({ minutes: Math.max(1, Number(e.target.value) || 0) })}
          className="mt-1.5 block w-28 rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </label>

      <label className="block">
        <span className="font-display uppercase tracking-widest text-xs text-muted-foreground">
          Mix · {Math.round(config.mix * 100)}% upsets
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(config.mix * 100)}
          onChange={(e) => onConfig({ mix: Number(e.target.value) / 100 })}
          className="mt-2 block w-full"
        />
        <span className="text-xs text-muted-foreground">Competitive ↔ Mixed</span>
      </label>

      <button
        type="button"
        onClick={onGenerate}
        disabled={roster.length < 2}
        className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        Generate games
      </button>
      {roster.length < 2 && (
        <p className="text-xs text-muted-foreground">Add at least two players to generate.</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create the queue component with play/log**

Create `components/seeder/seeder-queue.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { MatchStopwatch } from '@/components/match-stopwatch'
import { Stepper } from '@/components/stepper'
import { formatDuration } from '@/lib/stats'
import { logMatch } from '@/app/actions/matches'
import { buildLogFields, type SessionState } from '@/lib/seeder-session'
import type { Matchup } from '@/lib/seeder'

function nameOf(session: SessionState, id: string) {
  return session.roster.find((p) => p.id === id)?.name ?? '—'
}

export function SeederQueue({
  session,
  onStart,
  onFinish,
}: {
  session: SessionState
  onStart: (id: string, now: number) => void
  onFinish: (id: string, score: [number, number], durationSeconds: number) => void
}) {
  const done = session.queue.filter((m) => m.status === 'done')
  const active = session.queue.find((m) => m.status === 'playing') ?? null
  const upcoming = session.queue.filter((m) => m.status === 'pending')

  return (
    <div className="space-y-6">
      <ActiveCard session={session} active={active} firstPending={upcoming[0] ?? null} onStart={onStart} onFinish={onFinish} />

      {upcoming.length > 0 && (
        <div className="space-y-1.5">
          <div className="section-header font-display">Up next</div>
          <ol className="space-y-1">
            {upcoming.slice(active ? 0 : 1).map((m) => (
              <li key={m.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <span>{nameOf(session, m.aId)} <span className="text-muted-foreground">vs</span> {nameOf(session, m.bId)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {done.length > 0 && (
        <div className="space-y-1.5">
          <div className="section-header font-display">Played ({done.length})</div>
          <ol className="space-y-1">
            {done.map((m) => (
              <li key={m.id} className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-sm text-muted-foreground">
                <span>{nameOf(session, m.aId)} vs {nameOf(session, m.bId)}</span>
                <span className="font-mono nums">{m.score ? `${m.score[0]}–${m.score[1]}` : ''}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

function ActiveCard({
  session, active, firstPending, onStart, onFinish,
}: {
  session: SessionState
  active: Matchup | null
  firstPending: Matchup | null
  onStart: (id: string, now: number) => void
  onFinish: (id: string, score: [number, number], durationSeconds: number) => void
}) {
  const current = active ?? firstPending
  const [duration, setDuration] = useState(0)
  const [a, setA] = useState<number | ''>('')
  const [b, setB] = useState<number | ''>('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  if (!current) {
    return <div className="rounded-lg border border-border px-4 py-6 text-center text-sm text-muted-foreground">All games played. Generate more below.</div>
  }

  const isPlaying = current.status === 'playing'

  async function save() {
    if (a === '' || b === '') { setError('Enter both scores.'); return }
    setError(null)
    setPending(true)
    try {
      const fields = buildLogFields(current!, [Number(a), Number(b)], duration)
      const fd = new FormData()
      Object.entries(fields).forEach(([k, v]) => fd.set(k, v))
      const r = await logMatch(fd)
      if (r && 'error' in r) { setError(r.error ?? 'Could not save.'); return }
      onFinish(current!.id, [Number(a), Number(b)], duration)
      setDuration(0); setA(''); setB('')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="rounded-lg border border-primary/40 bg-primary/5 p-4 space-y-4">
      <div className="text-center">
        <span className="font-display text-xl font-bold">{nameOf(session, current.aId)}</span>
        <span className="mx-2 text-muted-foreground">vs</span>
        <span className="font-display text-xl font-bold">{nameOf(session, current.bId)}</span>
      </div>

      {!isPlaying ? (
        <button
          type="button"
          onClick={() => onStart(current.id, Date.now())}
          className="w-full rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Start game
        </button>
      ) : (
        <div className="space-y-4">
          <MatchStopwatch value={duration} onChange={setDuration} />
          <div className="flex items-center justify-center gap-3">
            <Stepper name="a" ariaLabel="player A score" defaultValue={a} onValueChange={setA} />
            <span className="text-muted-foreground">–</span>
            <Stepper name="b" ariaLabel="player B score" defaultValue={b} onValueChange={setB} />
          </div>
          {error && <div className="text-sm text-loss text-center">{error}</div>}
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="w-full rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {pending ? 'Saving…' : `Save ${formatDuration(duration)}`}
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Wire setup + queue into the root**

Replace the placeholder return in `components/quick-seeder.tsx` and import the reducer actions. Full updated file:

```tsx
'use client'

import { useEffect, useState } from 'react'
import type { PlayerRef, Target } from '@/lib/seeder'
import {
  type SessionState, createSession, toggleRosterPlayer, setConfig, generate,
  startMatchup, finishMatchup,
} from '@/lib/seeder-session'
import { STORAGE_KEY, serializeSession, parseStoredSession } from '@/lib/seeder-storage'
import { SeederSetup } from '@/components/seeder/seeder-setup'
import { SeederQueue } from '@/components/seeder/seeder-queue'

function randomSeed(): number {
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0
}

export function QuickSeeder({ players }: { players: PlayerRef[] }) {
  const [session, setSession] = useState<SessionState | null>(null)

  useEffect(() => {
    const stored = parseStoredSession(
      typeof window === 'undefined' ? null : window.localStorage.getItem(STORAGE_KEY)
    )
    setSession(stored ?? createSession(randomSeed()))
  }, [])

  useEffect(() => {
    if (session) window.localStorage.setItem(STORAGE_KEY, serializeSession(session))
  }, [session])

  if (!session) return <div className="text-sm text-muted-foreground">Loading…</div>

  const hasQueue = session.queue.length > 0

  return (
    <div data-testid="quick-seeder" className="space-y-6">
      {!hasQueue ? (
        <SeederSetup
          players={players}
          session={session}
          onToggle={(p) => setSession((s) => (s ? toggleRosterPlayer(s, p) : s))}
          onConfig={(partial: Partial<{ target: Target; minutes: number; mix: number }>) =>
            setSession((s) => (s ? setConfig(s, partial) : s))
          }
          onGenerate={() => setSession((s) => (s ? generate(s) : s))}
        />
      ) : (
        <SeederQueue
          session={session}
          onStart={(id, now) => setSession((s) => (s ? startMatchup(s, id, now) : s))}
          onFinish={(id, score, dur) =>
            setSession((s) => (s ? finishMatchup(s, id, score, dur) : s))
          }
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Typecheck + lint the new files**

Run: `npx tsc --noEmit` then `npm run lint`
Expected: no errors in the new/modified files.

- [ ] **Step 5: Verify the setup → generate flow in preview**

> Per project convention: drive the page with `preview_eval` `.click()` and read the DOM with separate `preview_eval` calls (preview_click misses React handlers; preview_screenshot can time out). Do **not** click "Save" yet — that writes a real match (covered in Step 6).

  1. `preview_start`, navigate `/seeder`.
  2. `preview_eval`: click two player buttons, e.g.
     `document.querySelectorAll('[data-testid=quick-seeder] button[aria-pressed]')[0].click()` then `[1].click()`.
  3. `preview_eval` (separate): read `document.querySelectorAll('button[aria-pressed=true]').length` → expect `2`.
  4. `preview_eval`: click the "Generate games" button (find by text content).
  5. `preview_eval` (separate): assert an "Up next" section exists and the active card shows two names + a "Start game" button.
  6. `preview_console_logs` → no errors.

  Expected: roster toggles, generate produces the queue and active card.

- [ ] **Step 6: Verify the log path WITHOUT writing to the live DB**

The `logMatch` write path is already covered structurally by `buildLogFields` unit tests (Task 4). To exercise the live save, point the dev server at a local/throwaway database (not prod Supabase) per project convention, then: click "Start game", set scores via the Steppers, click "Save", and confirm the matchup moves to "Played". If a throwaway DB isn't available, stop here and flag for Mahir rather than saving real matches to prod.

- [ ] **Step 7: Checkpoint** — full setup + play/log flow working.

---

## Task 9: Walk-in add, generate-more, remove, and clear

**Files:**
- Modify: `components/seeder/seeder-queue.tsx` (add a controls footer)
- Modify: `components/quick-seeder.tsx` (wire the new callbacks)

- [ ] **Step 1: Add a controls footer to the queue component**

In `components/seeder/seeder-queue.tsx`, extend the `SeederQueue` props and append a controls block. Update the signature and add the block just before the component's closing `</div>`:

```tsx
// extend props:
export function SeederQueue({
  session, players, onStart, onFinish, onAddPlayer, onGenerateMore, onRemovePlayer, onClear,
}: {
  session: SessionState
  players: PlayerRef[]
  onStart: (id: string, now: number) => void
  onFinish: (id: string, score: [number, number], durationSeconds: number) => void
  onAddPlayer: (p: PlayerRef) => void
  onGenerateMore: (minutes: number) => void
  onRemovePlayer: (id: string) => void
  onClear: () => void
}) {
```

Add `import type { PlayerRef } from '@/lib/seeder'` to the existing type import line. Then, before the final closing `</div>` of the returned JSX, insert:

```tsx
      <SeederControls
        session={session}
        players={players}
        onAddPlayer={onAddPlayer}
        onGenerateMore={onGenerateMore}
        onRemovePlayer={onRemovePlayer}
        onClear={onClear}
      />
```

And add this component at the bottom of the file:

```tsx
function SeederControls({
  session, players, onAddPlayer, onGenerateMore, onRemovePlayer, onClear,
}: {
  session: SessionState
  players: PlayerRef[]
  onAddPlayer: (p: PlayerRef) => void
  onGenerateMore: (minutes: number) => void
  onRemovePlayer: (id: string) => void
  onClear: () => void
}) {
  const [adding, setAdding] = useState(false)
  const [moreMinutes, setMoreMinutes] = useState(15)
  const available = players.filter((p) => !session.roster.some((r) => r.id === p.id))

  return (
    <div className="space-y-4 border-t border-border pt-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="section-header font-display">In session ({session.roster.length})</span>
          <button type="button" onClick={() => setAdding((v) => !v)} className="text-sm text-primary">
            {adding ? 'Done' : '+ Add player'}
          </button>
        </div>
        {adding && (
          <div className="grid grid-cols-2 gap-2">
            {available.length === 0 && <p className="text-xs text-muted-foreground">Everyone active is in.</p>}
            {available.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onAddPlayer(p)}
                className="flex items-center justify-between rounded-md border border-input px-3 py-2 text-sm hover:bg-secondary"
              >
                <span className="truncate">{p.name}</span>
                <span className="ml-2 font-mono nums text-xs text-muted-foreground">{p.elo}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {session.roster.map((p) => (
            <span key={p.id} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs">
              {p.name}
              <button type="button" aria-label={`remove ${p.name}`} onClick={() => onRemovePlayer(p.id)} className="text-muted-foreground hover:text-loss">×</button>
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-end gap-3">
        <label className="block">
          <span className="font-display uppercase tracking-widest text-xs text-muted-foreground">More minutes</span>
          <input
            type="number" min={1} max={600} value={moreMinutes}
            onChange={(e) => setMoreMinutes(Math.max(1, Number(e.target.value) || 0))}
            className="mt-1.5 block w-24 rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <button type="button" onClick={() => onGenerateMore(moreMinutes)} className="rounded-md border border-primary px-4 py-2 text-sm text-primary hover:bg-primary/10">
          Generate more
        </button>
      </div>

      <button type="button" onClick={onClear} className="text-sm text-muted-foreground hover:text-loss">
        Clear session
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Wire the new callbacks in the root**

In `components/quick-seeder.tsx`, import the extra reducer functions and a random seed for generate-more, and pass the new props to `<SeederQueue>`:

```tsx
import {
  type SessionState, createSession, toggleRosterPlayer, setConfig, generate,
  startMatchup, finishMatchup, addPlayer, removePlayer, generateMore,
} from '@/lib/seeder-session'
```

Replace the `<SeederQueue ... />` usage with:

```tsx
        <SeederQueue
          session={session}
          players={players}
          onStart={(id, now) => setSession((s) => (s ? startMatchup(s, id, now) : s))}
          onFinish={(id, score, dur) => setSession((s) => (s ? finishMatchup(s, id, score, dur) : s))}
          onAddPlayer={(p) => setSession((s) => (s ? addPlayer(s, p) : s))}
          onGenerateMore={(minutes) => setSession((s) => (s ? generateMore(s, minutes, randomSeed()) : s))}
          onRemovePlayer={(id) => setSession((s) => (s ? removePlayer(s, id) : s))}
          onClear={() => setSession(createSession(randomSeed()))}
        />
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit` then `npm run lint`
Expected: no errors.

- [ ] **Step 4: Verify in preview**

  1. With a generated queue (from Task 8), `preview_eval`: click "+ Add player", then click an available player button.
  2. `preview_eval` (separate): assert the player's name chip now appears in the "In session" list and the queue length grew / includes them.
  3. `preview_eval`: set "More minutes" and click "Generate more"; assert "Up next" count increased.
  4. `preview_eval`: click a remove "×" on a roster chip; assert that player's pending matchups disappear.
  5. `preview_eval`: click "Clear session"; assert it returns to the setup view (player toggle grid visible).
  6. Reload between steps 2 and 3 once to confirm localStorage persistence survives refresh.
  7. `preview_console_logs` → no errors.

  Expected: walk-in, generate-more, remove, clear, and persistence all behave.

- [ ] **Step 5: Final full test run** — `npx vitest run` → entire suite green.

- [ ] **Step 6: Checkpoint** — feature complete.

---

## Self-Review notes (author)

- **Spec coverage:** roster select (T7/T8), target/time/mix config (T8), generator with everyone-once + ±1 + no-byes for odd N + ELO-bias + upset slider (T1–T3), localStorage persistence (T6/T7), log via `logMatch` with stopwatch + condensed scores (T8), walk-in add + tail rebalance (T5/T9), generate-more fresh time budget (T5/T9), edge cases <2 players / remove / clear (T5/T8/T9). All mapped.
- **Determinism:** every random choice flows through `mulberry32(config.seed)`; `Date.now()`/`Math.random()` live only in the client component (`randomSeed`, `startMatchup` now), never in the pure libs — keeps tests reproducible.
- **Type consistency:** `PlayerRef`, `Matchup`, `SeederConfig`, `SessionState`, and function names are reused verbatim across `lib/seeder.ts`, `lib/seeder-session.ts`, and components.

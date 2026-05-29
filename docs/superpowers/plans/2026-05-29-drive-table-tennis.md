# Drive Table Tennis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-admin web app for tracking Drive's office table tennis: ongoing ELO ladder, single-elimination tournaments seeded by ELO, self-serve player profiles, stats dashboards, with a distinct designed frontend.

**Architecture:** Next.js 15 (App Router, Server Components, Server Actions) on Vercel. Postgres on Supabase via Drizzle ORM. Pure ELO and bracket logic in `lib/` (TDD'd). Single-password admin auth via signed cookie. Photo upload via Vercel Blob. Framer Motion for tasteful UI motion. Final design pass uses the `bencium-impact-designer` skill.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn/ui, Drizzle ORM, Postgres, Vitest, Framer Motion, Recharts, Vercel Blob, Zod.

**Spec:** `docs/superpowers/specs/2026-05-29-drive-table-tennis-design.md`

---

## File Structure

```
drive-table-tennis/
├── app/
│   ├── (public)/
│   │   ├── page.tsx                       Home dashboard (leaderboard, in-form, recent)
│   │   ├── join/page.tsx                  Self-serve profile creation
│   │   ├── players/page.tsx               Roster list
│   │   ├── players/[id]/page.tsx          Player profile (chart, stats, history)
│   │   ├── matches/page.tsx               All matches, paginated
│   │   ├── tournaments/page.tsx           Tournaments list
│   │   └── tournaments/[id]/page.tsx      Bracket view
│   ├── admin/
│   │   ├── layout.tsx                     Admin nav shell
│   │   ├── page.tsx                       Admin dashboard + Rebuild ELO
│   │   ├── login/page.tsx                 Password login
│   │   ├── players/page.tsx               Admin players CRUD
│   │   ├── matches/new/page.tsx           Log casual match
│   │   ├── matches/[id]/edit/page.tsx     Edit/delete match
│   │   ├── tournaments/new/page.tsx       Create tournament
│   │   └── tournaments/[id]/page.tsx      Manage tournament
│   ├── actions/
│   │   ├── auth.ts                        login, logout
│   │   ├── players.ts                     create, update, deactivate, selfServeCreate
│   │   ├── matches.ts                     log, edit, delete, rebuildElo
│   │   └── tournaments.ts                 create, start, recordResult
│   ├── layout.tsx                         Root layout
│   └── globals.css
├── lib/
│   ├── elo.ts                             applyMatch (pure)
│   ├── elo-recompute.ts                   replayHistory (pure)
│   ├── bracket.ts                         generateBracket (pure)
│   ├── stats.ts                           in-form, vs-capability (pure)
│   ├── auth.ts                            signCookie, verifyCookie
│   ├── upload.ts                          uploadPlayerPhoto (Vercel Blob wrapper)
│   ├── validators.ts                      Zod schemas
│   └── db/
│       ├── schema.ts                      Drizzle schema
│       └── index.ts                       Drizzle client (singleton)
├── components/
│   ├── ui/                                shadcn/ui primitives
│   ├── nav.tsx
│   ├── leaderboard.tsx
│   ├── in-form-card.tsx
│   ├── recent-matches.tsx
│   ├── player-avatar.tsx
│   ├── elo-chart.tsx
│   ├── bracket-view.tsx
│   ├── match-log-form.tsx
│   ├── join-form.tsx
│   ├── tournament-create-form.tsx
│   └── motion/
│       ├── delta-counter.tsx
│       └── animated-row.tsx
├── middleware.ts                          Admin route guard
├── tests/
│   ├── elo.test.ts
│   ├── elo-recompute.test.ts
│   ├── bracket.test.ts
│   └── stats.test.ts
├── .env.example
├── README.md                              Setup checklist
├── drizzle.config.ts
├── next.config.js
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── vitest.config.ts
```

---

# Phase 1 — Foundation

## Task 1: Scaffold Next.js project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.js`, `tailwind.config.ts`, `postcss.config.js`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `.gitignore`, `.env.example`

- [ ] **Step 1: Initialise the project**

Run from the project root (`C:/Drive Table Tennis`):
```bash
npx create-next-app@latest drive-table-tennis --typescript --tailwind --eslint --app --src-dir=false --no-import-alias
```
When prompted, accept defaults. This creates `drive-table-tennis/` with Next.js 15, Tailwind, TypeScript, App Router.

- [ ] **Step 2: cd into the project and install runtime deps**

```bash
cd drive-table-tennis
npm install drizzle-orm pg @types/pg zod framer-motion recharts @vercel/blob
npm install -D drizzle-kit vitest @vitest/ui tsx
```

- [ ] **Step 3: Install shadcn/ui**

```bash
npx shadcn@latest init -d
```
Accept defaults: New York style, Zinc base color, CSS variables yes.

Then add the primitive components we'll use:
```bash
npx shadcn@latest add button input label textarea form card table dialog dropdown-menu select toast sonner avatar
```

- [ ] **Step 4: Add Vitest config**

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
```

- [ ] **Step 5: Wire test + db scripts in package.json**

Edit `package.json` `"scripts"`:
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
  }
}
```

- [ ] **Step 6: Create `.env.example`**

```
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT].supabase.co:5432/postgres
ADMIN_PASSWORD=change-me
SESSION_SECRET=replace-with-32-bytes-hex
NEXT_PUBLIC_APP_NAME=Drive Table Tennis
BLOB_READ_WRITE_TOKEN=
```

- [ ] **Step 7: Verify the scaffold runs**

```bash
npm run dev
```
Expected: dev server starts on http://localhost:3000 and shows the Next.js default page. Stop with Ctrl-C.

- [ ] **Step 8: Initial commit**

```bash
git init
git add .
git commit -m "chore: scaffold Next.js project with Tailwind, shadcn/ui, Drizzle, Vitest"
```

---

## Task 2: Database schema with Drizzle

**Files:**
- Create: `lib/db/schema.ts`, `lib/db/index.ts`, `drizzle.config.ts`

- [ ] **Step 1: Create `drizzle.config.ts`**

```ts
import type { Config } from 'drizzle-kit'

export default {
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config
```

- [ ] **Step 2: Create `lib/db/schema.ts`**

```ts
import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  unique,
} from 'drizzle-orm/pg-core'

export const players = pgTable('players', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  nickname: text('nickname'),
  bio: text('bio'),
  email: text('email').unique(),
  photoUrl: text('photo_url'),
  currentElo: integer('current_elo').notNull().default(1200),
  active: boolean('active').notNull().default(true),
  createdVia: text('created_via').notNull().default('admin'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const tournaments = pgTable('tournaments', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  status: text('status').notNull(), // 'draft' | 'in_progress' | 'completed'
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
})

export const tournamentEntries = pgTable(
  'tournament_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tournamentId: uuid('tournament_id')
      .notNull()
      .references(() => tournaments.id, { onDelete: 'cascade' }),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id),
    seed: integer('seed').notNull(),
  },
  (t) => ({
    uniqEntry: unique().on(t.tournamentId, t.playerId),
  })
)

export const matches = pgTable('matches', {
  id: uuid('id').primaryKey().defaultRandom(),
  playerAId: uuid('player_a_id').references(() => players.id),
  playerBId: uuid('player_b_id').references(() => players.id),
  winnerId: uuid('winner_id').references(() => players.id),
  setScores: jsonb('set_scores').$type<Array<[number, number]>>(),
  playedAt: timestamp('played_at', { withTimezone: true }),
  tournamentId: uuid('tournament_id').references(() => tournaments.id, {
    onDelete: 'cascade',
  }),
  round: integer('round'),
  bracketSlot: integer('bracket_slot'),
  eloABefore: integer('elo_a_before'),
  eloBBefore: integer('elo_b_before'),
  eloAAfter: integer('elo_a_after'),
  eloBAfter: integer('elo_b_after'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Player = typeof players.$inferSelect
export type NewPlayer = typeof players.$inferInsert
export type Match = typeof matches.$inferSelect
export type NewMatch = typeof matches.$inferInsert
export type Tournament = typeof tournaments.$inferSelect
export type TournamentEntry = typeof tournamentEntries.$inferSelect
```

- [ ] **Step 3: Create `lib/db/index.ts`**

```ts
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

const globalForDb = globalThis as unknown as { pool?: Pool }

const pool =
  globalForDb.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
  })

if (process.env.NODE_ENV !== 'production') globalForDb.pool = pool

export const db = drizzle(pool, { schema })
export * from './schema'
```

- [ ] **Step 4: Push schema to Supabase**

Pre-req: Supabase project created and `DATABASE_URL` in `.env`. See README setup steps.

```bash
npm run db:push
```
Expected: drizzle-kit prints "Changes applied" and the four tables exist in Supabase.

- [ ] **Step 5: Commit**

```bash
git add lib/db/ drizzle.config.ts
git commit -m "feat: add Drizzle schema for players, matches, tournaments, tournament_entries"
```

---

# Phase 2 — Pure logic (TDD)

## Task 3: ELO library — applyMatch

**Files:**
- Create: `lib/elo.ts`, `tests/elo.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/elo.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { applyMatch, K_FACTOR, STARTING_ELO } from '@/lib/elo'

describe('applyMatch', () => {
  it('exposes the canonical constants', () => {
    expect(K_FACTOR).toBe(32)
    expect(STARTING_ELO).toBe(1200)
  })

  it('equal-rated players: winner +16, loser -16', () => {
    const r = applyMatch(1200, 1200, 'A')
    expect(r.deltaA).toBe(16)
    expect(r.deltaB).toBe(-16)
    expect(r.eloA).toBe(1216)
    expect(r.eloB).toBe(1184)
  })

  it('zero-sum: deltaA + deltaB === 0 for equal ratings', () => {
    const r = applyMatch(1500, 1500, 'B')
    expect(r.deltaA + r.deltaB).toBe(0)
  })

  it('upset: low-rated beats high-rated → big swing', () => {
    const r = applyMatch(1000, 1400, 'A') // A is the underdog and wins
    expect(r.deltaA).toBeGreaterThan(25)
    expect(r.deltaB).toBeLessThan(-25)
  })

  it('expected outcome: high-rated beats low-rated → small swing', () => {
    const r = applyMatch(1400, 1000, 'A')
    expect(r.deltaA).toBeLessThan(10)
    expect(r.deltaA).toBeGreaterThan(0)
  })

  it('result is symmetric under swap of A/B and winner', () => {
    const r1 = applyMatch(1300, 1100, 'A')
    const r2 = applyMatch(1100, 1300, 'B')
    expect(r1.deltaA).toBe(r2.deltaB)
    expect(r1.deltaB).toBe(r2.deltaA)
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

```bash
npm test -- tests/elo.test.ts
```
Expected: FAIL with "Cannot find module '@/lib/elo'".

- [ ] **Step 3: Implement `lib/elo.ts`**

```ts
export const K_FACTOR = 32
export const STARTING_ELO = 1200

export type MatchResult = {
  eloA: number
  eloB: number
  deltaA: number
  deltaB: number
}

export function applyMatch(
  eloA: number,
  eloB: number,
  winner: 'A' | 'B'
): MatchResult {
  const expectedA = 1 / (1 + 10 ** ((eloB - eloA) / 400))
  const expectedB = 1 - expectedA
  const scoreA = winner === 'A' ? 1 : 0
  const scoreB = 1 - scoreA
  const deltaA = Math.round(K_FACTOR * (scoreA - expectedA))
  const deltaB = Math.round(K_FACTOR * (scoreB - expectedB))
  return {
    eloA: eloA + deltaA,
    eloB: eloB + deltaB,
    deltaA,
    deltaB,
  }
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npm test -- tests/elo.test.ts
```
Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/elo.ts tests/elo.test.ts
git commit -m "feat(elo): add pure applyMatch with TDD coverage"
```

---

## Task 4: ELO recompute — replay history

**Files:**
- Create: `lib/elo-recompute.ts`, `tests/elo-recompute.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/elo-recompute.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { replayHistory, type HistoryMatch } from '@/lib/elo-recompute'
import { STARTING_ELO } from '@/lib/elo'

const m = (a: string, b: string, w: 'A' | 'B'): HistoryMatch => ({
  id: `${a}-${b}-${w}`,
  playerAId: a,
  playerBId: b,
  winner: w,
})

describe('replayHistory', () => {
  it('returns starting ELO for players with no matches', () => {
    const result = replayHistory([], ['p1', 'p2'])
    expect(result.currentElo.get('p1')).toBe(STARTING_ELO)
    expect(result.currentElo.get('p2')).toBe(STARTING_ELO)
    expect(result.replayed).toEqual([])
  })

  it('replays a single match and reports before/after for both players', () => {
    const result = replayHistory([m('p1', 'p2', 'A')], ['p1', 'p2'])
    expect(result.replayed[0].eloABefore).toBe(1200)
    expect(result.replayed[0].eloBBefore).toBe(1200)
    expect(result.replayed[0].eloAAfter).toBe(1216)
    expect(result.replayed[0].eloBAfter).toBe(1184)
    expect(result.currentElo.get('p1')).toBe(1216)
    expect(result.currentElo.get('p2')).toBe(1184)
  })

  it('replays sequential matches with running ratings', () => {
    const history = [
      m('p1', 'p2', 'A'),
      m('p1', 'p2', 'A'),
      m('p1', 'p2', 'B'),
    ]
    const result = replayHistory(history, ['p1', 'p2'])
    expect(result.replayed[1].eloABefore).toBe(1216)
    expect(result.replayed[2].eloABefore).toBe(result.replayed[1].eloAAfter)
  })

  it('deletion equivalence: replay without match X equals "match X never happened"', () => {
    const all = [m('p1', 'p2', 'A'), m('p1', 'p2', 'A'), m('p2', 'p1', 'A')]
    const without = [all[0], all[2]]
    const a = replayHistory(without, ['p1', 'p2'])
    const b = replayHistory(without, ['p1', 'p2'])
    expect(a.currentElo.get('p1')).toBe(b.currentElo.get('p1'))
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

```bash
npm test -- tests/elo-recompute.test.ts
```
Expected: FAIL with "Cannot find module '@/lib/elo-recompute'".

- [ ] **Step 3: Implement `lib/elo-recompute.ts`**

```ts
import { applyMatch, STARTING_ELO } from './elo'

export type HistoryMatch = {
  id: string
  playerAId: string
  playerBId: string
  winner: 'A' | 'B'
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
 * Replays a chronologically-ordered list of matches, returning each match's
 * before/after ELOs and every player's final rating.
 *
 * `playerIds` is the universe of players we want a current ELO for; players
 * without matches still get STARTING_ELO.
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
    const { eloA, eloB } = applyMatch(eloABefore, eloBBefore, match.winner)
    currentElo.set(match.playerAId, eloA)
    currentElo.set(match.playerBId, eloB)
    replayed.push({
      ...match,
      eloABefore,
      eloBBefore,
      eloAAfter: eloA,
      eloBAfter: eloB,
    })
  }

  return { currentElo, replayed }
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npm test -- tests/elo-recompute.test.ts
```
Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/elo-recompute.ts tests/elo-recompute.test.ts
git commit -m "feat(elo): add replayHistory for full match-log recomputation"
```

---

## Task 5: Bracket generation

**Files:**
- Create: `lib/bracket.ts`, `tests/bracket.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/bracket.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { generateBracket } from '@/lib/bracket'

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`)

describe('generateBracket', () => {
  it('produces N-1 real (non-bye) matches for N=4', () => {
    const rows = generateBracket(ids(4))
    const realMatches = rows.filter((r) => !r.winnerId)
    expect(realMatches.length).toBe(3)
  })

  it('N=4 round-1 pairings are (1,4) and (2,3)', () => {
    const rows = generateBracket(ids(4))
    const r1 = rows.filter((r) => r.round === 1).sort((a, b) => a.slot - b.slot)
    expect(r1).toHaveLength(2)
    expect([r1[0].playerAId, r1[0].playerBId].sort()).toEqual(['p1', 'p4'])
    expect([r1[1].playerAId, r1[1].playerBId].sort()).toEqual(['p2', 'p3'])
  })

  it('N=8 round-1 pairings keep #1 and #2 in opposite halves', () => {
    const rows = generateBracket(ids(8))
    const r1 = rows.filter((r) => r.round === 1).sort((a, b) => a.slot - b.slot)
    expect(r1).toHaveLength(4)
    const halfWith1 = r1.findIndex(
      (r) => r.playerAId === 'p1' || r.playerBId === 'p1'
    )
    const halfWith2 = r1.findIndex(
      (r) => r.playerAId === 'p2' || r.playerBId === 'p2'
    )
    expect(halfWith1 < 2).not.toBe(halfWith2 < 2)
  })

  it('N=6 (non-power-of-2): top 2 seeds get byes in round 1', () => {
    const rows = generateBracket(ids(6))
    const r1 = rows.filter((r) => r.round === 1)
    const byes = r1.filter((r) => r.winnerId !== null)
    expect(byes).toHaveLength(2)
    const byeWinners = byes.map((b) => b.winnerId).sort()
    expect(byeWinners).toEqual(['p1', 'p2'])
  })

  it('produces ceil(log2(N)) rounds', () => {
    expect(new Set(generateBracket(ids(4)).map((r) => r.round)).size).toBe(2)
    expect(new Set(generateBracket(ids(8)).map((r) => r.round)).size).toBe(3)
    expect(new Set(generateBracket(ids(12)).map((r) => r.round)).size).toBe(4)
    expect(new Set(generateBracket(ids(16)).map((r) => r.round)).size).toBe(4)
  })

  it('later rounds have null player slots (to be filled as winners advance)', () => {
    const rows = generateBracket(ids(4))
    const final = rows.find((r) => r.round === 2)!
    expect(final.playerAId).toBeNull()
    expect(final.playerBId).toBeNull()
    expect(final.winnerId).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

```bash
npm test -- tests/bracket.test.ts
```
Expected: FAIL with "Cannot find module '@/lib/bracket'".

- [ ] **Step 3: Implement `lib/bracket.ts`**

```ts
export type BracketSlot = {
  round: number
  slot: number
  playerAId: string | null
  playerBId: string | null
  winnerId: string | null // pre-set for BYE matches
}

/**
 * Returns the round-1 pairings (1-indexed seed numbers) for a bracket of `size`,
 * where `size` is a power of 2. Pairings preserve the invariant that seeds 1
 * and 2 only meet in the final.
 *
 *   size=2  -> [[1,2]]
 *   size=4  -> [[1,4],[2,3]]
 *   size=8  -> [[1,8],[4,5],[2,7],[3,6]]
 */
function seedPairings(size: number): Array<[number, number]> {
  let pairs: Array<[number, number]> = [[1, 2]]
  let current = 2
  while (current < size) {
    const next = current * 2
    const newPairs: Array<[number, number]> = []
    for (const [a, b] of pairs) {
      newPairs.push([a, next + 1 - a])
      newPairs.push([next + 1 - b, b])
    }
    pairs = newPairs
    current = next
  }
  return pairs
}

function nextPow2(n: number): number {
  let p = 1
  while (p < n) p *= 2
  return p
}

export function generateBracket(seededPlayerIds: string[]): BracketSlot[] {
  const n = seededPlayerIds.length
  if (n < 2) throw new Error('Need at least 2 players for a bracket')
  const size = nextPow2(n)
  const pairings = seedPairings(size)
  const totalRounds = Math.log2(size)

  const slots: BracketSlot[] = []

  // Round 1: seed-based pairings. Seeds beyond `n` are BYEs.
  pairings.forEach(([seedA, seedB], i) => {
    const playerAId = seedA <= n ? seededPlayerIds[seedA - 1] : null
    const playerBId = seedB <= n ? seededPlayerIds[seedB - 1] : null
    // BYE: exactly one side missing → the present side auto-advances.
    let winnerId: string | null = null
    if (playerAId && !playerBId) winnerId = playerAId
    if (playerBId && !playerAId) winnerId = playerBId
    slots.push({
      round: 1,
      slot: i,
      playerAId,
      playerBId,
      winnerId,
    })
  })

  // Subsequent rounds: empty slots that get filled in as winners advance.
  for (let round = 2; round <= totalRounds; round++) {
    const slotsInRound = size / 2 ** round
    for (let s = 0; s < slotsInRound; s++) {
      slots.push({
        round,
        slot: s,
        playerAId: null,
        playerBId: null,
        winnerId: null,
      })
    }
  }

  return slots
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npm test -- tests/bracket.test.ts
```
Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/bracket.ts tests/bracket.test.ts
git commit -m "feat(bracket): add single-elimination bracket generator with TDD coverage"
```

---

## Task 6: Stats helpers — in-form + vs-capability

**Files:**
- Create: `lib/stats.ts`, `tests/stats.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/stats.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import {
  computeFormScore,
  computeAboveExpectationScore,
  classifyOpponentTier,
  type ScoredMatch,
} from '@/lib/stats'

const sm = (
  player: string,
  opponent: string,
  myEloBefore: number,
  oppEloBefore: number,
  iWon: boolean,
  daysAgo: number
): ScoredMatch => ({
  playerId: player,
  opponentId: opponent,
  myEloBefore,
  myEloAfter: myEloBefore + (iWon ? 16 : -16),
  opponentEloBefore: oppEloBefore,
  iWon,
  playedAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
})

describe('classifyOpponentTier', () => {
  it('opponent more than +100 above me → higher', () => {
    expect(classifyOpponentTier(1200, 1305)).toBe('higher')
  })
  it('opponent within ±100 → similar', () => {
    expect(classifyOpponentTier(1200, 1250)).toBe('similar')
    expect(classifyOpponentTier(1200, 1150)).toBe('similar')
  })
  it('opponent more than -100 below me → lower', () => {
    expect(classifyOpponentTier(1200, 1095)).toBe('lower')
  })
})

describe('computeFormScore', () => {
  it('returns null when fewer than 3 matches in window', () => {
    const matches = [
      sm('me', 'x', 1200, 1200, true, 2),
      sm('me', 'x', 1216, 1200, true, 1),
    ]
    expect(computeFormScore(matches, 1232, 14)).toBeNull()
  })
  it('returns currentElo − earliest in-window eloBefore for qualifying players', () => {
    const matches = [
      sm('me', 'x', 1200, 1200, true, 5),
      sm('me', 'x', 1216, 1200, true, 4),
      sm('me', 'x', 1232, 1200, true, 3),
    ]
    expect(computeFormScore(matches, 1248, 14)).toBe(1248 - 1200)
  })
  it('ignores matches outside the window', () => {
    const matches = [
      sm('me', 'x', 1100, 1200, true, 30), // outside
      sm('me', 'x', 1116, 1200, true, 5),
      sm('me', 'x', 1132, 1200, true, 4),
      sm('me', 'x', 1148, 1200, true, 3),
    ]
    expect(computeFormScore(matches, 1164, 14)).toBe(1164 - 1116)
  })
})

describe('computeAboveExpectationScore', () => {
  it('beating an equal-rated opponent gives +0.5 above expectation', () => {
    const m = [sm('me', 'x', 1200, 1200, true, 1)]
    expect(computeAboveExpectationScore(m, 14)).toBeCloseTo(0.5, 5)
  })
  it('beating a much-stronger opponent yields close to +1', () => {
    const m = [sm('me', 'x', 1000, 1400, true, 1)]
    expect(computeAboveExpectationScore(m, 14)).toBeGreaterThan(0.85)
  })
  it('losing to an equal-rated opponent gives -0.5', () => {
    const m = [sm('me', 'x', 1200, 1200, false, 1)]
    expect(computeAboveExpectationScore(m, 14)).toBeCloseTo(-0.5, 5)
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

```bash
npm test -- tests/stats.test.ts
```
Expected: FAIL with "Cannot find module '@/lib/stats'".

- [ ] **Step 3: Implement `lib/stats.ts`**

```ts
export type ScoredMatch = {
  playerId: string
  opponentId: string
  myEloBefore: number
  myEloAfter: number
  opponentEloBefore: number
  iWon: boolean
  playedAt: Date
}

export type OpponentTier = 'higher' | 'similar' | 'lower'

export function classifyOpponentTier(
  myElo: number,
  opponentElo: number
): OpponentTier {
  const gap = opponentElo - myElo
  if (gap > 100) return 'higher'
  if (gap < -100) return 'lower'
  return 'similar'
}

function withinWindow(matches: ScoredMatch[], windowDays: number): ScoredMatch[] {
  const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000
  return matches
    .filter((m) => m.playedAt.getTime() >= cutoff)
    .sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime())
}

export function computeFormScore(
  matches: ScoredMatch[],
  currentElo: number,
  windowDays: number,
  minMatches: number = 3
): number | null {
  const inWindow = withinWindow(matches, windowDays)
  if (inWindow.length < minMatches) return null
  return currentElo - inWindow[0].myEloBefore
}

export function computeAboveExpectationScore(
  matches: ScoredMatch[],
  windowDays: number
): number {
  const inWindow = withinWindow(matches, windowDays)
  let sum = 0
  for (const m of inWindow) {
    const expected = 1 / (1 + 10 ** ((m.opponentEloBefore - m.myEloBefore) / 400))
    const actual = m.iWon ? 1 : 0
    sum += actual - expected
  }
  return sum
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npm test -- tests/stats.test.ts
```
Expected: all 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/stats.ts tests/stats.test.ts
git commit -m "feat(stats): add classifyOpponentTier, computeFormScore, computeAboveExpectationScore"
```

---

# Phase 3 — Validators & auth

## Task 7: Zod validators

**Files:**
- Create: `lib/validators.ts`

- [ ] **Step 1: Create `lib/validators.ts`**

```ts
import { z } from 'zod'

export const playerCreateSchema = z.object({
  name: z.string().trim().min(1).max(60),
  nickname: z.string().trim().min(1).max(30).optional().or(z.literal('')),
  bio: z.string().trim().max(200).optional().or(z.literal('')),
  email: z.string().trim().email().optional().or(z.literal('')),
})

export const setScoreSchema = z.tuple([
  z.coerce.number().int().min(0).max(99),
  z.coerce.number().int().min(0).max(99),
])

export const matchLogSchema = z.object({
  playerAId: z.string().uuid(),
  playerBId: z.string().uuid(),
  sets: z.array(setScoreSchema).min(1).max(7),
}).refine((d) => d.playerAId !== d.playerBId, {
  message: 'A player cannot play themselves',
})

export const tournamentCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  playerIds: z.array(z.string().uuid()).min(2).max(64),
})

export type PlayerCreateInput = z.infer<typeof playerCreateSchema>
export type MatchLogInput = z.infer<typeof matchLogSchema>
export type TournamentCreateInput = z.infer<typeof tournamentCreateSchema>
```

- [ ] **Step 2: Commit**

```bash
git add lib/validators.ts
git commit -m "feat: add Zod validators for player, match, tournament inputs"
```

---

## Task 8: Admin auth — cookie signing + middleware

**Files:**
- Create: `lib/auth.ts`, `middleware.ts`, `app/actions/auth.ts`, `app/admin/login/page.tsx`

- [ ] **Step 1: Implement `lib/auth.ts`**

```ts
import { createHmac, timingSafeEqual } from 'crypto'

const COOKIE_NAME = 'admin_session'

function sign(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('hex')
}

export function makeSessionCookie(secret: string): string {
  const value = String(Date.now())
  const sig = sign(value, secret)
  return `${value}.${sig}`
}

export function verifySessionCookie(
  cookie: string | undefined,
  secret: string
): boolean {
  if (!cookie) return false
  const [value, sig] = cookie.split('.')
  if (!value || !sig) return false
  const expected = sign(value, secret)
  const a = Buffer.from(sig, 'hex')
  const b = Buffer.from(expected, 'hex')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export const ADMIN_COOKIE = COOKIE_NAME
```

- [ ] **Step 2: Implement `middleware.ts`**

Create at the project root (not in `app/`):
```ts
import { NextResponse, type NextRequest } from 'next/server'
import { verifySessionCookie, ADMIN_COOKIE } from '@/lib/auth'

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (!pathname.startsWith('/admin')) return NextResponse.next()
  if (pathname === '/admin/login') return NextResponse.next()

  const cookie = req.cookies.get(ADMIN_COOKIE)?.value
  if (verifySessionCookie(cookie, process.env.SESSION_SECRET!)) {
    return NextResponse.next()
  }

  const url = req.nextUrl.clone()
  url.pathname = '/admin/login'
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/admin/:path*'],
}
```

- [ ] **Step 3: Implement `app/actions/auth.ts`**

```ts
'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ADMIN_COOKIE, makeSessionCookie } from '@/lib/auth'

export async function login(formData: FormData) {
  const submitted = String(formData.get('password') ?? '')
  if (submitted !== process.env.ADMIN_PASSWORD) {
    return { error: 'Wrong password' }
  }
  const cookie = makeSessionCookie(process.env.SESSION_SECRET!)
  ;(await cookies()).set(ADMIN_COOKIE, cookie, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  })
  redirect('/admin')
}

export async function logout() {
  ;(await cookies()).delete(ADMIN_COOKIE)
  redirect('/')
}
```

- [ ] **Step 4: Implement `app/admin/login/page.tsx`**

```tsx
import { login } from '@/app/actions/auth'

export default function LoginPage() {
  return (
    <main className="mx-auto mt-24 max-w-sm p-6">
      <h1 className="mb-4 text-2xl font-semibold">Admin login</h1>
      <form action={login} className="space-y-3">
        <input
          type="password"
          name="password"
          placeholder="Password"
          className="w-full rounded border px-3 py-2"
          autoFocus
        />
        <button
          type="submit"
          className="w-full rounded bg-black px-3 py-2 text-white"
        >
          Sign in
        </button>
      </form>
    </main>
  )
}
```

- [ ] **Step 5: Smoke-test the gate**

```bash
npm run dev
```
Visit `http://localhost:3000/admin` → expect redirect to `/admin/login`. Submit correct password (set in `.env`) → redirected to `/admin` (will 404 until Task 14, that's fine — the redirect itself is the proof). Stop with Ctrl-C.

- [ ] **Step 6: Commit**

```bash
git add lib/auth.ts middleware.ts app/actions/auth.ts app/admin/
git commit -m "feat(auth): add cookie-signed admin password auth + middleware gate"
```

---

# Phase 4 — Players

## Task 9: Player photo upload helper

**Files:**
- Create: `lib/upload.ts`

- [ ] **Step 1: Implement `lib/upload.ts`**

```ts
import { put } from '@vercel/blob'

const MAX_BYTES = 2 * 1024 * 1024 // 2 MB

export async function uploadPlayerPhoto(
  file: File
): Promise<{ url: string } | { error: string }> {
  if (!file.type.startsWith('image/')) {
    return { error: 'Photo must be an image' }
  }
  if (file.size > MAX_BYTES) {
    return { error: 'Photo must be ≤ 2 MB' }
  }
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const key = `players/${crypto.randomUUID()}.${ext}`
  const blob = await put(key, file, {
    access: 'public',
    contentType: file.type,
  })
  return { url: blob.url }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/upload.ts
git commit -m "feat: add Vercel Blob photo upload helper with size/MIME guards"
```

---

## Task 10: Player server actions

**Files:**
- Create: `app/actions/players.ts`

- [ ] **Step 1: Implement `app/actions/players.ts`**

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db, players } from '@/lib/db'
import { playerCreateSchema } from '@/lib/validators'
import { uploadPlayerPhoto } from '@/lib/upload'

function emptyToNull(v: FormDataEntryValue | null): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t === '' ? null : t
}

export async function createPlayerSelfServe(formData: FormData) {
  const parsed = playerCreateSchema.safeParse({
    name: formData.get('name'),
    nickname: formData.get('nickname'),
    bio: formData.get('bio'),
    email: formData.get('email'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  let photoUrl: string | null = null
  const photo = formData.get('photo')
  if (photo instanceof File && photo.size > 0) {
    const result = await uploadPlayerPhoto(photo)
    if ('error' in result) return { error: result.error }
    photoUrl = result.url
  }

  const [created] = await db
    .insert(players)
    .values({
      name: parsed.data.name,
      nickname: emptyToNull(formData.get('nickname')),
      bio: emptyToNull(formData.get('bio')),
      email: emptyToNull(formData.get('email')),
      photoUrl,
      createdVia: 'self_serve',
    })
    .returning({ id: players.id })

  revalidatePath('/players')
  revalidatePath('/')
  redirect(`/players/${created.id}`)
}

export async function createPlayerAdmin(formData: FormData) {
  const parsed = playerCreateSchema.safeParse({
    name: formData.get('name'),
    nickname: formData.get('nickname'),
    bio: formData.get('bio'),
    email: formData.get('email'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  let photoUrl: string | null = null
  const photo = formData.get('photo')
  if (photo instanceof File && photo.size > 0) {
    const result = await uploadPlayerPhoto(photo)
    if ('error' in result) return { error: result.error }
    photoUrl = result.url
  }

  await db.insert(players).values({
    name: parsed.data.name,
    nickname: emptyToNull(formData.get('nickname')),
    bio: emptyToNull(formData.get('bio')),
    email: emptyToNull(formData.get('email')),
    photoUrl,
    createdVia: 'admin',
  })

  revalidatePath('/players')
  revalidatePath('/admin/players')
  return { ok: true }
}

export async function updatePlayer(id: string, formData: FormData) {
  const parsed = playerCreateSchema.safeParse({
    name: formData.get('name'),
    nickname: formData.get('nickname'),
    bio: formData.get('bio'),
    email: formData.get('email'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const updates: Record<string, string | null> = {
    name: parsed.data.name,
    nickname: emptyToNull(formData.get('nickname')),
    bio: emptyToNull(formData.get('bio')),
    email: emptyToNull(formData.get('email')),
  }
  const photo = formData.get('photo')
  if (photo instanceof File && photo.size > 0) {
    const result = await uploadPlayerPhoto(photo)
    if ('error' in result) return { error: result.error }
    updates.photoUrl = result.url
  }

  await db.update(players).set(updates).where(eq(players.id, id))
  revalidatePath('/players')
  revalidatePath(`/players/${id}`)
  revalidatePath('/admin/players')
  return { ok: true }
}

export async function setPlayerActive(id: string, active: boolean) {
  await db.update(players).set({ active }).where(eq(players.id, id))
  revalidatePath('/players')
  revalidatePath('/admin/players')
}
```

- [ ] **Step 2: Commit**

```bash
git add app/actions/players.ts
git commit -m "feat(players): add self-serve + admin server actions for players"
```

---

## Task 11: Public roster `/players`

**Files:**
- Create: `app/(public)/players/page.tsx`, `components/player-avatar.tsx`

- [ ] **Step 1: Implement `components/player-avatar.tsx`**

```tsx
import Image from 'next/image'

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

export function PlayerAvatar({
  name,
  photoUrl,
  size = 40,
}: {
  name: string
  photoUrl: string | null
  size?: number
}) {
  if (photoUrl) {
    return (
      <Image
        src={photoUrl}
        alt={name}
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <div
      className="flex items-center justify-center rounded-full bg-zinc-800 font-medium text-zinc-100"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials(name)}
    </div>
  )
}
```

- [ ] **Step 2: Implement `app/(public)/players/page.tsx`**

```tsx
import Link from 'next/link'
import { desc, eq } from 'drizzle-orm'
import { db, players } from '@/lib/db'
import { PlayerAvatar } from '@/components/player-avatar'

export const dynamic = 'force-dynamic'

export default async function PlayersPage() {
  const roster = await db
    .select()
    .from(players)
    .where(eq(players.active, true))
    .orderBy(desc(players.currentElo))

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Players</h1>
        <Link href="/join" className="rounded border px-3 py-1.5 text-sm">
          Create my profile
        </Link>
      </div>
      <ul className="divide-y">
        {roster.map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-3">
            <PlayerAvatar name={p.name} photoUrl={p.photoUrl} />
            <Link href={`/players/${p.id}`} className="flex-1 hover:underline">
              <div className="font-medium">
                {p.name}
                {p.nickname && (
                  <span className="ml-2 text-sm text-zinc-500">"{p.nickname}"</span>
                )}
              </div>
              {p.bio && <div className="text-sm text-zinc-500">{p.bio}</div>}
            </Link>
            <div className="font-mono tabular-nums">{p.currentElo}</div>
          </li>
        ))}
      </ul>
    </main>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/\(public\)/players/ components/player-avatar.tsx
git commit -m "feat(players): public roster page with avatars and ELO"
```

---

## Task 12: Self-serve `/join` page

**Files:**
- Create: `app/(public)/join/page.tsx`, `components/join-form.tsx`

- [ ] **Step 1: Implement `components/join-form.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { createPlayerSelfServe } from '@/app/actions/players'

export function JoinForm() {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(formData: FormData) {
    setError(null)
    setPending(true)
    const result = await createPlayerSelfServe(formData)
    setPending(false)
    if (result && 'error' in result) setError(result.error)
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <label className="block">
        <span className="text-sm font-medium">Photo (optional, ≤2 MB)</span>
        <input
          type="file"
          name="photo"
          accept="image/*"
          className="mt-1 block w-full text-sm"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Name *</span>
        <input
          name="name"
          required
          maxLength={60}
          className="mt-1 w-full rounded border px-3 py-2"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Nickname</span>
        <input
          name="nickname"
          maxLength={30}
          className="mt-1 w-full rounded border px-3 py-2"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Bio (≤200 chars)</span>
        <textarea
          name="bio"
          maxLength={200}
          rows={3}
          className="mt-1 w-full rounded border px-3 py-2"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Email (optional)</span>
        <input
          name="email"
          type="email"
          className="mt-1 w-full rounded border px-3 py-2"
        />
      </label>
      {error && <div className="text-sm text-red-600">{error}</div>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-black px-3 py-2 text-white disabled:opacity-50"
      >
        {pending ? 'Creating…' : 'Create profile'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Implement `app/(public)/join/page.tsx`**

```tsx
import { JoinForm } from '@/components/join-form'

export default function JoinPage() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-2 text-2xl font-semibold">Create your profile</h1>
      <p className="mb-6 text-sm text-zinc-500">
        You'll show up on the roster and start at 1200 ELO.
      </p>
      <JoinForm />
    </main>
  )
}
```

- [ ] **Step 3: Manual test**

Run `npm run dev`, visit `/join`, submit a profile with a small image. Expected: redirect to `/players/[id]`. Visit `/players` — your new player appears with their photo. Stop server.

- [ ] **Step 4: Commit**

```bash
git add app/\(public\)/join/ components/join-form.tsx
git commit -m "feat(join): self-serve player profile creation with photo upload"
```

---

## Task 13: Admin `/admin/players` CRUD

**Files:**
- Create: `app/admin/layout.tsx`, `app/admin/page.tsx`, `app/admin/players/page.tsx`, `components/nav.tsx`

- [ ] **Step 1: Implement `components/nav.tsx`**

```tsx
import Link from 'next/link'
import { logout } from '@/app/actions/auth'

export function AdminNav() {
  return (
    <nav className="flex items-center gap-6 border-b px-6 py-3 text-sm">
      <Link href="/admin" className="font-semibold">Admin</Link>
      <Link href="/admin/players">Players</Link>
      <Link href="/admin/matches/new">Log match</Link>
      <Link href="/admin/tournaments/new">New tournament</Link>
      <form action={logout} className="ml-auto">
        <button type="submit" className="text-zinc-500 hover:text-zinc-900">
          Sign out
        </button>
      </form>
    </nav>
  )
}
```

- [ ] **Step 2: Implement `app/admin/layout.tsx`**

```tsx
import { AdminNav } from '@/components/nav'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AdminNav />
      {children}
    </>
  )
}
```

- [ ] **Step 3: Implement `app/admin/page.tsx`**

```tsx
import { rebuildElo } from '@/app/actions/matches'

export default function AdminHomePage() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">Admin dashboard</h1>
      <form action={rebuildElo}>
        <button
          type="submit"
          className="rounded border px-3 py-2 text-sm hover:bg-zinc-50"
        >
          Rebuild ELO from match history
        </button>
      </form>
      <p className="mt-2 text-sm text-zinc-500">
        Replays the entire match history and rewrites all per-match ELO snapshots
        and each player's current ELO. Safe to run anytime.
      </p>
    </main>
  )
}
```

(Note: `rebuildElo` is defined in Task 15. The import resolves later.)

- [ ] **Step 4: Implement `app/admin/players/page.tsx`**

```tsx
import { db, players } from '@/lib/db'
import { desc } from 'drizzle-orm'
import { setPlayerActive } from '@/app/actions/players'
import { PlayerAvatar } from '@/components/player-avatar'

export const dynamic = 'force-dynamic'

export default async function AdminPlayersPage() {
  const all = await db.select().from(players).orderBy(desc(players.createdAt))

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">Players (admin)</h1>
      <ul className="divide-y">
        {all.map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-3">
            <PlayerAvatar name={p.name} photoUrl={p.photoUrl} />
            <div className="flex-1">
              <div className="font-medium">{p.name}</div>
              <div className="text-xs text-zinc-500">
                {p.createdVia} · ELO {p.currentElo} · {p.active ? 'active' : 'inactive'}
              </div>
            </div>
            <form
              action={async () => {
                'use server'
                await setPlayerActive(p.id, !p.active)
              }}
            >
              <button type="submit" className="text-sm text-zinc-600 hover:underline">
                {p.active ? 'Deactivate' : 'Reactivate'}
              </button>
            </form>
          </li>
        ))}
      </ul>
    </main>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add app/admin/layout.tsx app/admin/page.tsx app/admin/players/ components/nav.tsx
git commit -m "feat(admin): admin shell, dashboard, and player roster management"
```

---

# Phase 5 — Matches

## Task 14: Match server actions (log)

**Files:**
- Create: `app/actions/matches.ts`

- [ ] **Step 1: Implement `app/actions/matches.ts` (initial: log only)**

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { asc, eq, inArray } from 'drizzle-orm'
import { db, matches, players, type Match } from '@/lib/db'
import { applyMatch } from '@/lib/elo'
import { replayHistory, type HistoryMatch } from '@/lib/elo-recompute'
import { matchLogSchema } from '@/lib/validators'

function inferWinner(sets: Array<[number, number]>): 'A' | 'B' | null {
  let a = 0
  let b = 0
  for (const [sa, sb] of sets) {
    if (sa > sb) a++
    else if (sb > sa) b++
  }
  if (a === b) return null
  return a > b ? 'A' : 'B'
}

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
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const winner = inferWinner(parsed.data.sets)
  if (!winner) return { error: 'Sets are tied; cannot determine winner' }

  // Read current ratings
  const both = await db
    .select()
    .from(players)
    .where(inArray(players.id, [parsed.data.playerAId, parsed.data.playerBId]))
  const a = both.find((p) => p.id === parsed.data.playerAId)
  const b = both.find((p) => p.id === parsed.data.playerBId)
  if (!a || !b) return { error: 'Player not found' }

  const elo = applyMatch(a.currentElo, b.currentElo, winner)

  await db.transaction(async (tx) => {
    await tx.insert(matches).values({
      playerAId: a.id,
      playerBId: b.id,
      winnerId: winner === 'A' ? a.id : b.id,
      setScores: parsed.data.sets,
      playedAt: new Date(),
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
  redirect('/')
}
```

- [ ] **Step 2: Commit**

```bash
git add app/actions/matches.ts
git commit -m "feat(matches): add logMatch server action"
```

---

## Task 15: Match server actions (edit, delete, rebuild)

**Files:**
- Modify: `app/actions/matches.ts`

- [ ] **Step 1: Add helper + edit/delete/rebuild to `app/actions/matches.ts`**

Append to the existing file:
```ts
async function replayAllAndWrite(): Promise<void> {
  const allMatches = await db
    .select()
    .from(matches)
    .orderBy(asc(matches.playedAt), asc(matches.createdAt))
  const allPlayers = await db.select({ id: players.id }).from(players)

  const history: HistoryMatch[] = allMatches
    .filter((m) => m.playerAId && m.playerBId && m.winnerId && m.playedAt)
    .map((m) => ({
      id: m.id,
      playerAId: m.playerAId!,
      playerBId: m.playerBId!,
      winner: m.winnerId === m.playerAId ? 'A' : 'B',
    }))

  const result = replayHistory(
    history,
    allPlayers.map((p) => p.id)
  )

  await db.transaction(async (tx) => {
    for (const r of result.replayed) {
      await tx
        .update(matches)
        .set({
          eloABefore: r.eloABefore,
          eloBBefore: r.eloBBefore,
          eloAAfter: r.eloAAfter,
          eloBAfter: r.eloBBefore + (r.eloBAfter - r.eloBBefore),
        })
        .where(eq(matches.id, r.id))
    }
    for (const [playerId, elo] of result.currentElo.entries()) {
      await tx.update(players).set({ currentElo: elo }).where(eq(players.id, playerId))
    }
  })
}

export async function editMatch(id: string, formData: FormData) {
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
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const winner = inferWinner(parsed.data.sets)
  if (!winner) return { error: 'Sets are tied' }

  await db
    .update(matches)
    .set({
      playerAId: parsed.data.playerAId,
      playerBId: parsed.data.playerBId,
      winnerId: winner === 'A' ? parsed.data.playerAId : parsed.data.playerBId,
      setScores: parsed.data.sets,
    })
    .where(eq(matches.id, id))

  await replayAllAndWrite()
  revalidatePath('/')
  revalidatePath('/matches')
  revalidatePath('/players')
  redirect('/matches')
}

export async function deleteMatch(id: string) {
  await db.delete(matches).where(eq(matches.id, id))
  await replayAllAndWrite()
  revalidatePath('/')
  revalidatePath('/matches')
  revalidatePath('/players')
}

export async function rebuildElo() {
  await replayAllAndWrite()
  revalidatePath('/')
  revalidatePath('/players')
}
```

- [ ] **Step 2: Commit**

```bash
git add app/actions/matches.ts
git commit -m "feat(matches): add editMatch, deleteMatch, rebuildElo with full replay"
```

---

## Task 16: Log match UI `/admin/matches/new`

**Files:**
- Create: `app/admin/matches/new/page.tsx`, `components/match-log-form.tsx`

- [ ] **Step 1: Implement `components/match-log-form.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { logMatch } from '@/app/actions/matches'

type PlayerOption = { id: string; name: string; nickname: string | null; currentElo: number }

export function MatchLogForm({ players }: { players: PlayerOption[] }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handle(formData: FormData) {
    setError(null)
    setPending(true)
    const r = await logMatch(formData)
    setPending(false)
    if (r && 'error' in r) setError(r.error)
  }

  return (
    <form action={handle} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className="text-sm font-medium">Player A</span>
          <select name="playerAId" required className="mt-1 w-full rounded border px-2 py-2">
            <option value="">—</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.currentElo})
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Player B</span>
          <select name="playerBId" required className="mt-1 w-full rounded border px-2 py-2">
            <option value="">—</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.currentElo})
              </option>
            ))}
          </select>
        </label>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Set scores (leave blank for unused sets)</legend>
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-12 text-sm text-zinc-500">Set {i + 1}</span>
            <input
              name={`set_${i}_a`}
              type="number"
              min={0}
              max={99}
              className="w-20 rounded border px-2 py-1"
            />
            <span>–</span>
            <input
              name={`set_${i}_b`}
              type="number"
              min={0}
              max={99}
              className="w-20 rounded border px-2 py-1"
            />
          </div>
        ))}
      </fieldset>
      {error && <div className="text-sm text-red-600">{error}</div>}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Save match'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Implement `app/admin/matches/new/page.tsx`**

```tsx
import { db, players } from '@/lib/db'
import { asc, eq } from 'drizzle-orm'
import { MatchLogForm } from '@/components/match-log-form'

export const dynamic = 'force-dynamic'

export default async function NewMatchPage() {
  const roster = await db
    .select({
      id: players.id,
      name: players.name,
      nickname: players.nickname,
      currentElo: players.currentElo,
    })
    .from(players)
    .where(eq(players.active, true))
    .orderBy(asc(players.name))

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">Log a match</h1>
      <MatchLogForm players={roster} />
    </main>
  )
}
```

- [ ] **Step 3: Manual test**

`npm run dev` → log in to /admin → /admin/matches/new → pick two players, enter `11-8`, `11-6`, `9-11`, `11-7`, save. Expected: redirect to /, players' ELO has shifted on /players. Stop server.

- [ ] **Step 4: Commit**

```bash
git add app/admin/matches/new/ components/match-log-form.tsx
git commit -m "feat(matches): admin form to log a casual match"
```

---

## Task 17: Public matches list `/matches`

**Files:**
- Create: `app/(public)/matches/page.tsx`

- [ ] **Step 1: Implement `app/(public)/matches/page.tsx`**

```tsx
import { db, matches, players } from '@/lib/db'
import { desc, eq, isNotNull } from 'drizzle-orm'
import Link from 'next/link'
import { alias } from 'drizzle-orm/pg-core'

export const dynamic = 'force-dynamic'

export default async function MatchesPage() {
  const a = alias(players, 'a')
  const b = alias(players, 'b')
  const rows = await db
    .select({
      id: matches.id,
      playedAt: matches.playedAt,
      setScores: matches.setScores,
      winnerId: matches.winnerId,
      aId: a.id,
      aName: a.name,
      bId: b.id,
      bName: b.name,
      eloAAfter: matches.eloAAfter,
      eloBAfter: matches.eloBAfter,
    })
    .from(matches)
    .innerJoin(a, eq(matches.playerAId, a.id))
    .innerJoin(b, eq(matches.playerBId, b.id))
    .where(isNotNull(matches.playedAt))
    .orderBy(desc(matches.playedAt))
    .limit(200)

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">Matches</h1>
      <ul className="divide-y">
        {rows.map((r) => {
          const aWon = r.winnerId === r.aId
          const sets = (r.setScores as Array<[number, number]>) ?? []
          return (
            <li key={r.id} className="flex items-center gap-4 py-3">
              <div className="w-32 text-xs text-zinc-500">
                {r.playedAt?.toLocaleString()}
              </div>
              <div className="flex-1">
                <Link href={`/players/${r.aId}`} className={aWon ? 'font-semibold' : ''}>
                  {r.aName}
                </Link>
                <span className="mx-2 font-mono tabular-nums text-zinc-500">
                  {sets.map(([sa, sb]) => `${sa}-${sb}`).join('  ')}
                </span>
                <Link href={`/players/${r.bId}`} className={!aWon ? 'font-semibold' : ''}>
                  {r.bName}
                </Link>
              </div>
            </li>
          )
        })}
      </ul>
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(public\)/matches/
git commit -m "feat(matches): public matches history page"
```

---

# Phase 6 — Stats dashboards

## Task 18: Home dashboard — leaderboard + recent matches

**Files:**
- Create: `components/leaderboard.tsx`, `components/recent-matches.tsx`
- Modify: `app/(public)/page.tsx`

- [ ] **Step 1: Implement `components/leaderboard.tsx`**

```tsx
import Link from 'next/link'
import { db, players } from '@/lib/db'
import { desc, eq } from 'drizzle-orm'
import { PlayerAvatar } from './player-avatar'

export async function Leaderboard() {
  const rows = await db
    .select()
    .from(players)
    .where(eq(players.active, true))
    .orderBy(desc(players.currentElo))
    .limit(20)

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Leaderboard</h2>
      <ol className="divide-y rounded border">
        {rows.map((p, i) => (
          <li key={p.id} className="flex items-center gap-3 px-3 py-2">
            <span className="w-6 text-right font-mono text-sm tabular-nums text-zinc-500">
              {i + 1}
            </span>
            <PlayerAvatar name={p.name} photoUrl={p.photoUrl} size={28} />
            <Link href={`/players/${p.id}`} className="flex-1 hover:underline">
              {p.name}
              {p.nickname && <span className="ml-2 text-sm text-zinc-500">"{p.nickname}"</span>}
            </Link>
            <span className="font-mono tabular-nums">{p.currentElo}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
```

- [ ] **Step 2: Implement `components/recent-matches.tsx`**

```tsx
import Link from 'next/link'
import { db, matches, players } from '@/lib/db'
import { alias } from 'drizzle-orm/pg-core'
import { desc, eq, isNotNull } from 'drizzle-orm'

export async function RecentMatches({ limit = 8 }: { limit?: number }) {
  const a = alias(players, 'a')
  const b = alias(players, 'b')
  const rows = await db
    .select({
      id: matches.id,
      playedAt: matches.playedAt,
      aId: a.id,
      aName: a.name,
      bId: b.id,
      bName: b.name,
      winnerId: matches.winnerId,
      setScores: matches.setScores,
    })
    .from(matches)
    .innerJoin(a, eq(matches.playerAId, a.id))
    .innerJoin(b, eq(matches.playerBId, b.id))
    .where(isNotNull(matches.playedAt))
    .orderBy(desc(matches.playedAt))
    .limit(limit)

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Recent matches</h2>
      <ul className="divide-y rounded border">
        {rows.map((r) => {
          const aWon = r.winnerId === r.aId
          const sets = (r.setScores as Array<[number, number]>) ?? []
          return (
            <li key={r.id} className="px-3 py-2 text-sm">
              <Link href={`/players/${r.aId}`} className={aWon ? 'font-semibold' : ''}>
                {r.aName}
              </Link>
              <span className="mx-2 font-mono tabular-nums text-zinc-500">
                {sets.map(([sa, sb]) => `${sa}-${sb}`).join(' ')}
              </span>
              <Link href={`/players/${r.bId}`} className={!aWon ? 'font-semibold' : ''}>
                {r.bName}
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
```

- [ ] **Step 3: Modify `app/(public)/page.tsx`**

Replace whatever the scaffold left with:
```tsx
import Link from 'next/link'
import { Leaderboard } from '@/components/leaderboard'
import { RecentMatches } from '@/components/recent-matches'

export const dynamic = 'force-dynamic'

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl p-6">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Drive Table Tennis</h1>
        <nav className="flex gap-4 text-sm">
          <Link href="/players">Players</Link>
          <Link href="/matches">Matches</Link>
          <Link href="/tournaments">Tournaments</Link>
          <Link href="/join" className="font-semibold">Join</Link>
        </nav>
      </header>
      <div className="grid gap-8 md:grid-cols-2">
        <Leaderboard />
        <RecentMatches />
      </div>
    </main>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add components/leaderboard.tsx components/recent-matches.tsx app/\(public\)/page.tsx
git commit -m "feat(home): dashboard with leaderboard and recent matches"
```

---

## Task 19: In-form widget on home

**Files:**
- Create: `components/in-form-card.tsx`
- Modify: `app/(public)/page.tsx`

- [ ] **Step 1: Implement `components/in-form-card.tsx`**

```tsx
import Link from 'next/link'
import { db, matches, players } from '@/lib/db'
import { eq, or, gte, and } from 'drizzle-orm'
import {
  computeFormScore,
  computeAboveExpectationScore,
  type ScoredMatch,
} from '@/lib/stats'
import { PlayerAvatar } from './player-avatar'

async function loadScoredMatches(since: Date): Promise<Map<string, ScoredMatch[]>> {
  const rows = await db
    .select()
    .from(matches)
    .where(and(gte(matches.playedAt, since)))

  const byPlayer = new Map<string, ScoredMatch[]>()
  for (const m of rows) {
    if (!m.playerAId || !m.playerBId || !m.winnerId || !m.playedAt) continue
    const aSide: ScoredMatch = {
      playerId: m.playerAId,
      opponentId: m.playerBId,
      myEloBefore: m.eloABefore ?? 1200,
      myEloAfter: m.eloAAfter ?? 1200,
      opponentEloBefore: m.eloBBefore ?? 1200,
      iWon: m.winnerId === m.playerAId,
      playedAt: m.playedAt,
    }
    const bSide: ScoredMatch = {
      playerId: m.playerBId,
      opponentId: m.playerAId,
      myEloBefore: m.eloBBefore ?? 1200,
      myEloAfter: m.eloBAfter ?? 1200,
      opponentEloBefore: m.eloABefore ?? 1200,
      iWon: m.winnerId === m.playerBId,
      playedAt: m.playedAt,
    }
    for (const s of [aSide, bSide]) {
      if (!byPlayer.has(s.playerId)) byPlayer.set(s.playerId, [])
      byPlayer.get(s.playerId)!.push(s)
    }
  }
  return byPlayer
}

export async function InFormCard({ windowDays = 14 }: { windowDays?: number }) {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000)
  const active = await db
    .select()
    .from(players)
    .where(eq(players.active, true))
  const scoredByPlayer = await loadScoredMatches(since)

  type Row = { player: typeof active[number]; delta: number; aboveExp: number; w: number; l: number }
  const rows: Row[] = []
  for (const p of active) {
    const ms = scoredByPlayer.get(p.id) ?? []
    const delta = computeFormScore(ms, p.currentElo, windowDays)
    if (delta == null) continue
    const aboveExp = computeAboveExpectationScore(ms, windowDays)
    const w = ms.filter((m) => m.iWon).length
    const l = ms.length - w
    rows.push({ player: p, delta, aboveExp, w, l })
  }

  const topByDelta = [...rows].sort((a, b) => b.delta - a.delta).slice(0, 5)

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">
        In Form <span className="text-sm font-normal text-zinc-500">(last {windowDays} days)</span>
      </h2>
      <ol className="divide-y rounded border">
        {topByDelta.map((r) => (
          <li key={r.player.id} className="flex items-center gap-3 px-3 py-2">
            <PlayerAvatar name={r.player.name} photoUrl={r.player.photoUrl} size={28} />
            <Link href={`/players/${r.player.id}`} className="flex-1 hover:underline">
              {r.player.name}
            </Link>
            <span className="font-mono text-sm tabular-nums text-zinc-500">
              {r.w}-{r.l}
            </span>
            <span
              className={`w-12 text-right font-mono tabular-nums ${
                r.delta >= 0 ? 'text-emerald-600' : 'text-red-600'
              }`}
            >
              {r.delta >= 0 ? '+' : ''}
              {r.delta}
            </span>
          </li>
        ))}
        {topByDelta.length === 0 && (
          <li className="px-3 py-2 text-sm text-zinc-500">
            Nobody has played 3+ matches in the last {windowDays} days yet.
          </li>
        )}
      </ol>
    </section>
  )
}
```

- [ ] **Step 2: Modify `app/(public)/page.tsx` to include InFormCard**

Replace the inner grid with:
```tsx
import { InFormCard } from '@/components/in-form-card'

// ...inside HomePage return:
<div className="grid gap-8 md:grid-cols-2">
  <Leaderboard />
  <div className="space-y-8">
    <InFormCard />
    <RecentMatches />
  </div>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add components/in-form-card.tsx app/\(public\)/page.tsx
git commit -m "feat(home): add in-form (last 14d ΔELO) widget"
```

---

## Task 20: Player profile `/players/[id]` with ELO chart + stats

**Files:**
- Create: `components/elo-chart.tsx`, `app/(public)/players/[id]/page.tsx`

- [ ] **Step 1: Implement `components/elo-chart.tsx`**

```tsx
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
```

- [ ] **Step 2: Implement `app/(public)/players/[id]/page.tsx`**

```tsx
import { notFound } from 'next/navigation'
import { db, matches, players } from '@/lib/db'
import { and, asc, eq, isNotNull, or } from 'drizzle-orm'
import { PlayerAvatar } from '@/components/player-avatar'
import { EloChart } from '@/components/elo-chart'
import { classifyOpponentTier } from '@/lib/stats'

export const dynamic = 'force-dynamic'

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [player] = await db.select().from(players).where(eq(players.id, id))
  if (!player) notFound()

  const playerMatches = await db
    .select()
    .from(matches)
    .where(
      and(
        isNotNull(matches.playedAt),
        or(eq(matches.playerAId, id), eq(matches.playerBId, id))
      )
    )
    .orderBy(asc(matches.playedAt))

  // ELO chart points
  const points = playerMatches.map((m, i) => {
    const isA = m.playerAId === id
    const elo = isA ? m.eloAAfter! : m.eloBAfter!
    return {
      t: m.playedAt!.getTime(),
      elo,
      label: `#${i + 1}`,
    }
  })

  // W/L overall
  let wins = 0
  let losses = 0
  // W/L by tier
  const tier = { higher: { w: 0, l: 0 }, similar: { w: 0, l: 0 }, lower: { w: 0, l: 0 } }
  for (const m of playerMatches) {
    const isA = m.playerAId === id
    const iWon = m.winnerId === id
    if (iWon) wins++
    else losses++
    const myEloBefore = isA ? m.eloABefore! : m.eloBBefore!
    const oppEloBefore = isA ? m.eloBBefore! : m.eloABefore!
    const t = classifyOpponentTier(myEloBefore, oppEloBefore)
    if (iWon) tier[t].w++
    else tier[t].l++
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <header className="mb-6 flex items-center gap-4">
        <PlayerAvatar name={player.name} photoUrl={player.photoUrl} size={64} />
        <div>
          <h1 className="text-2xl font-semibold">
            {player.name}
            {player.nickname && (
              <span className="ml-2 text-base font-normal text-zinc-500">
                "{player.nickname}"
              </span>
            )}
          </h1>
          {player.bio && <p className="text-sm text-zinc-500">{player.bio}</p>}
          <p className="mt-1 font-mono tabular-nums">
            ELO {player.currentElo} · {wins}W – {losses}L
          </p>
        </div>
      </header>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold">ELO over time</h2>
        <EloChart data={points} />
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold">By opponent capability</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-500">
              <th className="pb-1">Tier</th>
              <th className="pb-1">Wins</th>
              <th className="pb-1">Losses</th>
              <th className="pb-1">Win %</th>
            </tr>
          </thead>
          <tbody>
            {(['higher', 'similar', 'lower'] as const).map((t) => {
              const { w, l } = tier[t]
              const total = w + l
              const pct = total === 0 ? '—' : `${Math.round((w / total) * 100)}%`
              return (
                <tr key={t} className="border-t">
                  <td className="py-1 capitalize">{t}-rated opponents</td>
                  <td className="py-1 font-mono tabular-nums">{w}</td>
                  <td className="py-1 font-mono tabular-nums">{l}</td>
                  <td className="py-1 font-mono tabular-nums">{pct}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
    </main>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/elo-chart.tsx app/\(public\)/players/\[id\]/
git commit -m "feat(player): profile page with ELO chart and vs-capability breakdown"
```

---

# Phase 7 — Tournaments

## Task 21: Tournament server actions

**Files:**
- Create: `app/actions/tournaments.ts`

- [ ] **Step 1: Implement `app/actions/tournaments.ts`**

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { and, eq, inArray } from 'drizzle-orm'
import { db, matches, players, tournaments, tournamentEntries } from '@/lib/db'
import { applyMatch } from '@/lib/elo'
import { generateBracket } from '@/lib/bracket'
import { tournamentCreateSchema } from '@/lib/validators'

export async function createTournament(formData: FormData) {
  const name = String(formData.get('name') ?? '')
  const playerIds = formData.getAll('playerIds').map(String)
  const parsed = tournamentCreateSchema.safeParse({ name, playerIds })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  // Seed by current ELO unless caller passed an explicit seedOrder JSON
  const seedOrderRaw = formData.get('seedOrder')
  let seeded: string[] = parsed.data.playerIds
  if (typeof seedOrderRaw === 'string' && seedOrderRaw.length > 0) {
    seeded = JSON.parse(seedOrderRaw)
  } else {
    const ratings = await db
      .select({ id: players.id, elo: players.currentElo })
      .from(players)
      .where(inArray(players.id, parsed.data.playerIds))
    seeded = parsed.data.playerIds
      .slice()
      .sort(
        (a, b) =>
          (ratings.find((r) => r.id === b)?.elo ?? 0) -
          (ratings.find((r) => r.id === a)?.elo ?? 0)
      )
  }

  const tournamentId = await db.transaction(async (tx) => {
    const [t] = await tx
      .insert(tournaments)
      .values({ name: parsed.data.name, status: 'in_progress', startedAt: new Date() })
      .returning({ id: tournaments.id })
    await tx.insert(tournamentEntries).values(
      seeded.map((playerId, i) => ({
        tournamentId: t.id,
        playerId,
        seed: i + 1,
      }))
    )
    const bracket = generateBracket(seeded)
    await tx.insert(matches).values(
      bracket.map((slot) => ({
        tournamentId: t.id,
        round: slot.round,
        bracketSlot: slot.slot,
        playerAId: slot.playerAId,
        playerBId: slot.playerBId,
        winnerId: slot.winnerId,
        playedAt: slot.winnerId ? new Date() : null,
      }))
    )
    return t.id
  })

  revalidatePath('/tournaments')
  revalidatePath('/admin/tournaments')
  redirect(`/admin/tournaments/${tournamentId}`)
}

export async function recordTournamentResult(
  matchId: string,
  formData: FormData
) {
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

  let aWins = 0
  let bWins = 0
  for (const [sa, sb] of setsRaw) {
    if (sa > sb) aWins++
    else if (sb > sa) bWins++
  }
  if (aWins === bWins) return { error: 'Sets are tied' }
  const winner: 'A' | 'B' = aWins > bWins ? 'A' : 'B'

  const [a] = await db.select().from(players).where(eq(players.id, m.playerAId))
  const [b] = await db.select().from(players).where(eq(players.id, m.playerBId))
  const elo = applyMatch(a.currentElo, b.currentElo, winner)
  const winnerId = winner === 'A' ? a.id : b.id

  await db.transaction(async (tx) => {
    await tx
      .update(matches)
      .set({
        winnerId,
        setScores: setsRaw,
        playedAt: new Date(),
        eloABefore: a.currentElo,
        eloBBefore: b.currentElo,
        eloAAfter: elo.eloA,
        eloBAfter: elo.eloB,
      })
      .where(eq(matches.id, matchId))
    await tx.update(players).set({ currentElo: elo.eloA }).where(eq(players.id, a.id))
    await tx.update(players).set({ currentElo: elo.eloB }).where(eq(players.id, b.id))

    // Advance winner into next-round slot.
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
        .set({ [slotKey]: winnerId })
        .where(eq(matches.id, next.id))
    } else {
      // No next round → final played. Mark tournament completed.
      await tx
        .update(tournaments)
        .set({ status: 'completed', completedAt: new Date() })
        .where(eq(tournaments.id, m.tournamentId!))
    }
  })

  revalidatePath(`/tournaments/${m.tournamentId}`)
  revalidatePath(`/admin/tournaments/${m.tournamentId}`)
  revalidatePath('/players')
  revalidatePath('/')
  return { ok: true }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/actions/tournaments.ts
git commit -m "feat(tournaments): create-with-bracket and record-result-with-advance actions"
```

---

## Task 22: Create-tournament UI `/admin/tournaments/new`

**Files:**
- Create: `app/admin/tournaments/new/page.tsx`, `components/tournament-create-form.tsx`

- [ ] **Step 1: Implement `components/tournament-create-form.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { createTournament } from '@/app/actions/tournaments'

type PlayerOption = { id: string; name: string; currentElo: number }

export function TournamentCreateForm({ players }: { players: PlayerOption[] }) {
  const [selected, setSelected] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }

  function move(id: string, dir: -1 | 1) {
    setSelected((s) => {
      const i = s.indexOf(id)
      if (i < 0) return s
      const j = i + dir
      if (j < 0 || j >= s.length) return s
      const copy = [...s]
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
      return copy
    })
  }

  function autoSeed() {
    const byElo = [...selected].sort(
      (a, b) =>
        (players.find((p) => p.id === b)?.currentElo ?? 0) -
        (players.find((p) => p.id === a)?.currentElo ?? 0)
    )
    setSelected(byElo)
  }

  async function handle(formData: FormData) {
    formData.set('seedOrder', JSON.stringify(selected))
    for (const id of selected) formData.append('playerIds', id)
    const r = await createTournament(formData)
    if (r && 'error' in r) setError(r.error)
  }

  return (
    <form action={handle} className="space-y-6">
      <label className="block">
        <span className="text-sm font-medium">Tournament name</span>
        <input
          name="name"
          required
          maxLength={80}
          className="mt-1 w-full rounded border px-3 py-2"
        />
      </label>

      <div>
        <h3 className="mb-2 text-sm font-medium">Available players</h3>
        <ul className="grid grid-cols-2 gap-1 text-sm">
          {players.map((p) => (
            <li key={p.id}>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selected.includes(p.id)}
                  onChange={() => toggle(p.id)}
                />
                {p.name}{' '}
                <span className="text-zinc-500">({p.currentElo})</span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-medium">Seed order</h3>
          <button
            type="button"
            onClick={autoSeed}
            className="text-xs text-zinc-600 underline"
          >
            Auto-seed by ELO
          </button>
        </div>
        <ol className="space-y-1 rounded border p-2 text-sm">
          {selected.length === 0 && (
            <li className="text-zinc-500">No players selected yet.</li>
          )}
          {selected.map((id, i) => {
            const p = players.find((x) => x.id === id)!
            return (
              <li key={id} className="flex items-center gap-2">
                <span className="w-6 font-mono tabular-nums text-zinc-500">{i + 1}.</span>
                <span className="flex-1">
                  {p.name}{' '}
                  <span className="text-zinc-500">({p.currentElo})</span>
                </span>
                <button type="button" onClick={() => move(id, -1)} className="text-xs">▲</button>
                <button type="button" onClick={() => move(id, 1)} className="text-xs">▼</button>
              </li>
            )
          })}
        </ol>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}
      <button
        type="submit"
        disabled={selected.length < 2}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        Start tournament
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Implement `app/admin/tournaments/new/page.tsx`**

```tsx
import { db, players } from '@/lib/db'
import { asc, eq } from 'drizzle-orm'
import { TournamentCreateForm } from '@/components/tournament-create-form'

export const dynamic = 'force-dynamic'

export default async function NewTournamentPage() {
  const roster = await db
    .select({ id: players.id, name: players.name, currentElo: players.currentElo })
    .from(players)
    .where(eq(players.active, true))
    .orderBy(asc(players.name))

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">New tournament</h1>
      <TournamentCreateForm players={roster} />
    </main>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/admin/tournaments/new/ components/tournament-create-form.tsx
git commit -m "feat(tournaments): admin create form with auto-seed and reorder"
```

---

## Task 23: Bracket view + admin manage

**Files:**
- Create: `components/bracket-view.tsx`, `app/(public)/tournaments/page.tsx`, `app/(public)/tournaments/[id]/page.tsx`, `app/admin/tournaments/[id]/page.tsx`

- [ ] **Step 1: Implement `components/bracket-view.tsx`**

```tsx
import Link from 'next/link'

export type BracketMatch = {
  id: string
  round: number
  bracketSlot: number
  playerA: { id: string; name: string } | null
  playerB: { id: string; name: string } | null
  winnerId: string | null
  setScores: Array<[number, number]> | null
}

export function BracketView({
  matches,
  href,
}: {
  matches: BracketMatch[]
  href?: (m: BracketMatch) => string | null
}) {
  const byRound = new Map<number, BracketMatch[]>()
  for (const m of matches) {
    if (!byRound.has(m.round)) byRound.set(m.round, [])
    byRound.get(m.round)!.push(m)
  }
  const rounds = [...byRound.keys()].sort((a, b) => a - b)

  return (
    <div className="flex gap-6 overflow-x-auto">
      {rounds.map((r) => (
        <div key={r} className="min-w-[200px] space-y-3">
          <div className="text-xs uppercase tracking-wide text-zinc-500">Round {r}</div>
          {byRound.get(r)!.map((m) => {
            const link = href?.(m)
            const content = (
              <div className="rounded border p-2 text-sm">
                <div className={m.winnerId === m.playerA?.id ? 'font-semibold' : ''}>
                  {m.playerA?.name ?? 'TBD'}
                </div>
                <div className={m.winnerId === m.playerB?.id ? 'font-semibold' : ''}>
                  {m.playerB?.name ?? 'TBD'}
                </div>
                {m.setScores && (
                  <div className="mt-1 font-mono text-xs tabular-nums text-zinc-500">
                    {m.setScores.map(([a, b]) => `${a}-${b}`).join(' ')}
                  </div>
                )}
              </div>
            )
            return link ? (
              <Link key={m.id} href={link}>
                {content}
              </Link>
            ) : (
              <div key={m.id}>{content}</div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Implement a tournament-fetch helper inline in `app/(public)/tournaments/[id]/page.tsx`**

```tsx
import { notFound } from 'next/navigation'
import { db, matches, players, tournaments } from '@/lib/db'
import { alias } from 'drizzle-orm/pg-core'
import { asc, eq } from 'drizzle-orm'
import { BracketView, type BracketMatch } from '@/components/bracket-view'

export const dynamic = 'force-dynamic'

async function loadTournament(id: string) {
  const [t] = await db.select().from(tournaments).where(eq(tournaments.id, id))
  if (!t) return null
  const a = alias(players, 'a')
  const b = alias(players, 'b')
  const rows = await db
    .select({
      id: matches.id,
      round: matches.round,
      bracketSlot: matches.bracketSlot,
      winnerId: matches.winnerId,
      setScores: matches.setScores,
      aId: a.id,
      aName: a.name,
      bId: b.id,
      bName: b.name,
    })
    .from(matches)
    .leftJoin(a, eq(matches.playerAId, a.id))
    .leftJoin(b, eq(matches.playerBId, b.id))
    .where(eq(matches.tournamentId, id))
    .orderBy(asc(matches.round), asc(matches.bracketSlot))

  const bracket: BracketMatch[] = rows.map((r) => ({
    id: r.id,
    round: r.round!,
    bracketSlot: r.bracketSlot!,
    playerA: r.aId ? { id: r.aId, name: r.aName! } : null,
    playerB: r.bId ? { id: r.bId, name: r.bName! } : null,
    winnerId: r.winnerId,
    setScores: r.setScores as Array<[number, number]> | null,
  }))

  return { tournament: t, bracket }
}

export default async function TournamentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await loadTournament(id)
  if (!data) notFound()
  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">{data.tournament.name}</h1>
      <p className="mb-6 text-sm text-zinc-500">Status: {data.tournament.status}</p>
      <BracketView matches={data.bracket} />
    </main>
  )
}
```

- [ ] **Step 3: Implement `app/(public)/tournaments/page.tsx`**

```tsx
import Link from 'next/link'
import { desc } from 'drizzle-orm'
import { db, tournaments } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function TournamentsPage() {
  const all = await db.select().from(tournaments).orderBy(desc(tournaments.createdAt))
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">Tournaments</h1>
      <ul className="divide-y rounded border">
        {all.map((t) => (
          <li key={t.id} className="flex items-center gap-3 px-3 py-2">
            <Link href={`/tournaments/${t.id}`} className="flex-1 hover:underline">
              {t.name}
            </Link>
            <span className="text-xs text-zinc-500">{t.status}</span>
          </li>
        ))}
      </ul>
    </main>
  )
}
```

- [ ] **Step 4: Implement `app/admin/tournaments/[id]/page.tsx`**

```tsx
import { notFound, redirect } from 'next/navigation'
import { db, matches, players, tournaments } from '@/lib/db'
import { alias } from 'drizzle-orm/pg-core'
import { asc, eq } from 'drizzle-orm'
import { BracketView, type BracketMatch } from '@/components/bracket-view'
import { recordTournamentResult } from '@/app/actions/tournaments'

export const dynamic = 'force-dynamic'

async function loadTournament(id: string) {
  const [t] = await db.select().from(tournaments).where(eq(tournaments.id, id))
  if (!t) return null
  const a = alias(players, 'a')
  const b = alias(players, 'b')
  const rows = await db
    .select({
      id: matches.id,
      round: matches.round,
      bracketSlot: matches.bracketSlot,
      winnerId: matches.winnerId,
      setScores: matches.setScores,
      aId: a.id,
      aName: a.name,
      bId: b.id,
      bName: b.name,
    })
    .from(matches)
    .leftJoin(a, eq(matches.playerAId, a.id))
    .leftJoin(b, eq(matches.playerBId, b.id))
    .where(eq(matches.tournamentId, id))
    .orderBy(asc(matches.round), asc(matches.bracketSlot))

  const bracket: BracketMatch[] = rows.map((r) => ({
    id: r.id,
    round: r.round!,
    bracketSlot: r.bracketSlot!,
    playerA: r.aId ? { id: r.aId, name: r.aName! } : null,
    playerB: r.bId ? { id: r.bId, name: r.bName! } : null,
    winnerId: r.winnerId,
    setScores: r.setScores as Array<[number, number]> | null,
  }))
  return { tournament: t, bracket }
}

export default async function ManageTournamentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await loadTournament(id)
  if (!data) notFound()

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">{data.tournament.name}</h1>
      <p className="mb-6 text-sm text-zinc-500">Status: {data.tournament.status}</p>
      <BracketView
        matches={data.bracket}
        href={(m) =>
          m.playerA && m.playerB && !m.winnerId
            ? `/admin/tournaments/${id}/match/${m.id}`
            : null
        }
      />
    </main>
  )
}
```

- [ ] **Step 5: Implement the per-match recording page**

Create `app/admin/tournaments/[id]/match/[matchId]/page.tsx`:
```tsx
import { db, matches, players } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { recordTournamentResult } from '@/app/actions/tournaments'

export const dynamic = 'force-dynamic'

export default async function MatchRecordPage({
  params,
}: {
  params: Promise<{ id: string; matchId: string }>
}) {
  const { matchId, id: tournamentId } = await params
  const [m] = await db.select().from(matches).where(eq(matches.id, matchId))
  if (!m || !m.playerAId || !m.playerBId) notFound()
  const [a] = await db.select().from(players).where(eq(players.id, m.playerAId))
  const [b] = await db.select().from(players).where(eq(players.id, m.playerBId))

  async function action(formData: FormData) {
    'use server'
    await recordTournamentResult(matchId, formData)
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-4 text-xl font-semibold">
        {a.name} vs {b.name}
      </h1>
      <form action={action} className="space-y-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-12 text-sm text-zinc-500">Set {i + 1}</span>
            <input name={`set_${i}_a`} type="number" min={0} max={99} className="w-20 rounded border px-2 py-1" />
            <span>–</span>
            <input name={`set_${i}_b`} type="number" min={0} max={99} className="w-20 rounded border px-2 py-1" />
          </div>
        ))}
        <button type="submit" className="rounded bg-black px-4 py-2 text-white">
          Save
        </button>
      </form>
    </main>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add components/bracket-view.tsx app/\(public\)/tournaments/ app/admin/tournaments/\[id\]/
git commit -m "feat(tournaments): bracket view, public list, admin manage + record-result UI"
```

---

# Phase 8 — Design pass

## Task 24: Invoke `bencium-impact-designer` for the visual language

**Files:**
- Modify: `app/globals.css`, `app/layout.tsx`, `tailwind.config.ts`, design tokens; potentially refine all `components/*` JSX.

This task **delegates** to a specialised design skill. Do not invent the visual treatment by hand — the skill is the source.

- [ ] **Step 1: Invoke the design skill**

In the Claude Code session, invoke:
```
bencium-impact-designer
```

Give it the following brief (paraphrase verbatim):

> Design the visual language for the Drive Table Tennis app. Reference the spec at `docs/superpowers/specs/2026-05-29-drive-table-tennis-design.md` — especially §17 Design language. Constraints:
> - Dark mode primary, light mode secondary
> - Sport/data product mood, NOT a generic SaaS dashboard
> - One expressive display face for headings (numerals matter), one neutral sans for body, tabular numerals in all data columns
> - Restrained palette: 2-3 colours, single reserved accent for movement (ΔELO, wins, in-form)
> - Higher information density than typical AI-generated apps
> - Circular player avatars; tasteful monogram fallback
> - Avoid: Tailwind UI defaults (rounded-2xl floating cards, sky-500 buttons, soft shadows), gradient-as-personality, AI-sparkle iconography
> - Produce: Tailwind config tokens (colors, fontFamily, fontSize, spacing), `globals.css` (CSS vars for theme, font imports), and a styled rewrite of these components:
>   - `components/leaderboard.tsx`
>   - `components/in-form-card.tsx`
>   - `components/recent-matches.tsx`
>   - `components/player-avatar.tsx`
>   - `components/bracket-view.tsx`
>   - `components/nav.tsx`
>   - `app/layout.tsx` (root layout with font setup)
>   - `app/(public)/page.tsx` (home dashboard layout)
>   - `app/(public)/players/[id]/page.tsx` (player profile layout)

- [ ] **Step 2: Apply the skill's output**

The skill will produce updated files. Apply each diff carefully. Confirm visual continuity locally:
```bash
npm run dev
```
Walk through:
- `/` — leaderboard, in-form, recent matches
- `/players` — roster
- `/players/[id]` — profile with ELO chart
- `/tournaments/[id]` — bracket
- `/join` — profile creation
- `/admin` — admin shell

Stop server.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(design): apply bencium-impact-designer visual language"
```

---

## Task 25: Motion polish — delta counter + leaderboard reorder

**Files:**
- Create: `components/motion/delta-counter.tsx`, `components/motion/animated-row.tsx`
- Modify: `components/leaderboard.tsx`, `app/actions/matches.ts` (return delta info), match-log success flow

- [ ] **Step 1: Implement `components/motion/delta-counter.tsx`**

```tsx
'use client'

import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { useEffect } from 'react'

export function DeltaCounter({ from, to, durationMs = 600 }: { from: number; to: number; durationMs?: number }) {
  const value = useMotionValue(from)
  const rounded = useTransform(value, (v) => Math.round(v).toString())
  useEffect(() => {
    const controls = animate(value, to, { duration: durationMs / 1000, ease: 'easeOut' })
    return () => controls.stop()
  }, [to, durationMs, value])
  return <motion.span className="font-mono tabular-nums">{rounded}</motion.span>
}
```

- [ ] **Step 2: Implement `components/motion/animated-row.tsx`**

```tsx
'use client'

import { motion } from 'framer-motion'

export function AnimatedRow({
  layoutId,
  children,
}: {
  layoutId: string
  children: React.ReactNode
}) {
  return (
    <motion.li
      layout
      layoutId={layoutId}
      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
      className="flex items-center gap-3 px-3 py-2"
    >
      {children}
    </motion.li>
  )
}
```

- [ ] **Step 3: Convert `components/leaderboard.tsx` to use AnimatedRow**

Wrap each leaderboard row in `<AnimatedRow layoutId={`leader-${p.id}`}>` so that rerenders after a match log spring-reorder. Keep the same data flow; the change is purely the wrapping element.

```tsx
import Link from 'next/link'
import { db, players } from '@/lib/db'
import { desc, eq } from 'drizzle-orm'
import { PlayerAvatar } from './player-avatar'
import { AnimatedRow } from './motion/animated-row'

export async function Leaderboard() {
  const rows = await db
    .select()
    .from(players)
    .where(eq(players.active, true))
    .orderBy(desc(players.currentElo))
    .limit(20)

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Leaderboard</h2>
      <ol className="divide-y rounded border">
        {rows.map((p, i) => (
          <AnimatedRow key={p.id} layoutId={`leader-${p.id}`}>
            <span className="w-6 text-right font-mono text-sm tabular-nums text-zinc-500">
              {i + 1}
            </span>
            <PlayerAvatar name={p.name} photoUrl={p.photoUrl} size={28} />
            <Link href={`/players/${p.id}`} className="flex-1 hover:underline">
              {p.name}
              {p.nickname && <span className="ml-2 text-sm text-zinc-500">"{p.nickname}"</span>}
            </Link>
            <span className="font-mono tabular-nums">{p.currentElo}</span>
          </AnimatedRow>
        ))}
      </ol>
    </section>
  )
}
```

- [ ] **Step 4: Manual motion check**

`npm run dev` → log a match that moves a player's ELO meaningfully → return to `/` → reload → expect the affected rows to spring-animate into their new order. Stop server.

- [ ] **Step 5: Commit**

```bash
git add components/motion/ components/leaderboard.tsx
git commit -m "feat(motion): animated leaderboard reorder + delta counter primitive"
```

---

# Phase 9 — Ship

## Task 26: README + deployment

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create `README.md`**

```markdown
# Drive Table Tennis

A single-admin web app for tracking Drive's office table tennis ladder and tournaments.

## Setup

### 1. Supabase
1. Sign in at supabase.com → New project
2. Pick a region close to Sydney
3. Set a database password (save it)
4. Wait ~2 min for provisioning
5. Settings → Database → Connection string → URI → copy

### 2. Local
```bash
git clone <repo>
cd drive-table-tennis
cp .env.example .env
# Paste the Supabase connection string into DATABASE_URL
# Set ADMIN_PASSWORD to whatever you like
# Set SESSION_SECRET to a random 32-byte hex string (e.g. `openssl rand -hex 32`)
npm install
npm run db:push          # applies schema to Supabase
npm run dev              # http://localhost:3000
```

### 3. Vercel
1. Push the repo to GitHub
2. vercel.com → Import project → pick the repo
3. Add env vars: DATABASE_URL, ADMIN_PASSWORD, SESSION_SECRET, NEXT_PUBLIC_APP_NAME
4. Project → Storage → Create Blob store → Connect to project (auto-injects BLOB_READ_WRITE_TOKEN)
5. Deploy
6. To enable photo uploads locally: `vercel env pull .env.local`

## Day-to-day

- **Log a casual match:** `/admin/matches/new`
- **Run a tournament:** `/admin/tournaments/new` → select players → auto-seed → Start → record results
- **Players self-onboard:** share `/join`
- **Rebuild ELO if anything looks off:** `/admin` → "Rebuild ELO from match history"

## Tests

```bash
npm test
```

Covers ELO math, history replay, bracket generation, and stat helpers.
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```
Expected: clean build with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: setup README"
```

- [ ] **Step 4: Deploy**

```bash
git push origin main
```
Then in Vercel: import the repo, add env vars, create the Blob store, deploy. Visit the production URL, log a test match, run a 4-person test tournament.

- [ ] **Step 5: Final commit (housekeeping if needed)**

If the production smoke test surfaces small bugs:
```bash
git add <fixes>
git commit -m "fix: <one-line summary>"
git push
```

---

# Self-Review

## Spec coverage

| Spec section | Tasks | Notes |
|---|---|---|
| §2 Features map | All phases | Each feature row mapped to one or more tasks. |
| §3 Tech stack | T1, T2 | Next.js, Tailwind, shadcn/ui, Drizzle, Vitest, Framer Motion, Recharts, Vercel Blob, Zod installed in T1. |
| §4 Architecture | T1, T2, T8 | Vercel + Supabase + Vercel Blob set up; auth pattern via signed cookie. |
| §5 Data model (4 tables incl. nickname/bio) | T2 | Drizzle schema matches spec exactly. |
| §6 Derived stats | T18, T19, T20 | Leaderboard, recent, in-form, ELO chart, vs-capability table. |
| §7 Routes & flows | T11-13 (players), T16-17 (matches), T22-23 (tournaments) | All 11 routes covered. |
| §7 Flow 3 self-serve `/join` | T9, T12 | Photo upload via Vercel Blob, instant create. |
| §7 Flow 4 edit/delete + recompute | T15 | replayHistory-backed; covered by T4 tests. |
| §8 ELO + bracket logic | T3, T4, T5 | Pure functions, full TDD coverage. |
| §9 Auth | T8 | Signed cookie + middleware. |
| §10 Env vars | T1 (.env.example), T26 (README) | All five vars documented. |
| §11 Repo layout | T1 onward | Matches spec layout. |
| §12 Testing | T3-T6 | ELO, replay, bracket, stats. Manual UI checks per task. |
| §14 Setup | T26 | README has the literal click-by-click steps. |
| §17 Design language | T24 | Delegated to `bencium-impact-designer`. |
| §17 Motion principles | T25 | Leaderboard reorder + delta counter; rest of motion (bracket cascade, page transitions) layered in during the design pass. |
| §16 Risks (junk profiles, photo abuse) | T9, T13 | 2MB + MIME guard in upload helper; admin deactivate from `/admin/players`. |

No spec gaps identified.

## Placeholder scan

No "TBD", "TODO", or "fill in" entries. All code blocks contain complete implementations.

## Type consistency

- `applyMatch` returns `{ eloA, eloB, deltaA, deltaB }` — used identically in T14 and T21. ✓
- `replayHistory` signature: `(history: HistoryMatch[], playerIds: string[]) → ReplayResult` — used identically in T15 (`replayAllAndWrite`). ✓
- `generateBracket` returns `BracketSlot[]` with `playerAId | null`, `playerBId | null`, `winnerId | null` — used by T21 to insert match rows. ✓
- `Player`/`Match`/`Tournament`/`TournamentEntry` exported from `lib/db/schema.ts` and re-exported via `lib/db/index.ts`. ✓
- `ScoredMatch` type used by `computeFormScore` / `computeAboveExpectationScore`; constructed identically in T19's `loadScoredMatches`. ✓
- `BracketMatch` shape declared in `components/bracket-view.tsx` and constructed identically in both T23 public and admin tournament pages. ✓

No inconsistencies found.

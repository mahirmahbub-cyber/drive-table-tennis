# Elo Look-Ahead Calculator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public screen where you pick two players and how many games each wins, and see the projected Elo change for both — computed client-side, nothing persisted.

**Architecture:** A pure projection function in `lib/elo.ts` (single source of truth, reuses `applyMatch`), a `force-dynamic` server-component page that fetches the active roster, and a `'use client'` calculator component that computes live. One nav entry wires it into both desktop and mobile menus.

**Tech Stack:** Next.js 16 (app router), React, Drizzle, Tailwind, Vitest.

**Conventions:** The page mirrors `app/admin/matches/new/page.tsx` and the component mirrors `components/match-log-form.tsx` — no new Next APIs. Commit messages are one imperative subject line; do not add any trailer.

---

## File Structure

- `lib/elo.ts` — **modify** (append): add `ProjectionStep`, `Projection`, `projectGamesWon`, and a private `buildSequence`. The single source of truth for the maths.
- `tests/elo.test.ts` — **modify**: add a `projectGamesWon` describe block.
- `components/elo-calculator.tsx` — **create**: client component (inputs + live projection UI).
- `app/(public)/calculator/page.tsx` — **create**: server component, fetches roster, renders the calculator.
- `components/site-header.tsx` — **modify** (`NAV` array): add the `/calculator` nav entry.

---

## Task 1: Projection function in `lib/elo.ts`

**Files:**
- Modify: `lib/elo.ts` (append after `applyGames`)
- Test: `tests/elo.test.ts`

**Convention (from the spec):** games-won-only input has no real order, but Elo is threaded per game, so we fix an ordering: **interleave each player's wins as evenly as possible across the sequence**. Ties for a slot go to whoever has placed fewer wins so far, then to A. Deterministic; the order effect is ≤ a few Elo.

- [ ] **Step 1: Add the import + failing tests**

In `tests/elo.test.ts`, add `projectGamesWon` to the existing import:

```ts
import { applyMatch, applyGames, projectGamesWon, K_FACTOR, STARTING_ELO } from '@/lib/elo'
```

Append this describe block at the end of the file:

```ts
describe('projectGamesWon', () => {
  it('a single A win matches applyMatch', () => {
    const p = projectGamesWon(1200, 1200, 1, 0)
    expect(p.eloAAfter).toBe(1216)
    expect(p.eloBAfter).toBe(1184)
    expect(p.deltaA).toBe(16)
    expect(p.deltaB).toBe(-16)
    expect(p.steps).toHaveLength(1)
    expect(p.steps[0]).toMatchObject({ game: 1, winner: 'A', eloA: 1216, eloB: 1184 })
  })

  it('no games → no change, no steps', () => {
    const p = projectGamesWon(1200, 1300, 0, 0)
    expect(p.deltaA).toBe(0)
    expect(p.deltaB).toBe(0)
    expect(p.steps).toEqual([])
    expect(p.eloAAfter).toBe(1200)
    expect(p.eloBAfter).toBe(1300)
  })

  it('interleaves wins evenly (3-1 → A,B,A,A)', () => {
    const p = projectGamesWon(1200, 1200, 3, 1)
    expect(p.steps.map((s) => s.winner)).toEqual(['A', 'B', 'A', 'A'])
  })

  it('interleaves wins evenly (2-2 → A,B,A,B)', () => {
    const p = projectGamesWon(1200, 1200, 2, 2)
    expect(p.steps.map((s) => s.winner)).toEqual(['A', 'B', 'A', 'B'])
  })

  it('one-sided sweep is all one winner', () => {
    const p = projectGamesWon(1200, 1200, 4, 0)
    expect(p.steps.map((s) => s.winner)).toEqual(['A', 'A', 'A', 'A'])
  })

  it('net matches threading the same sequence through applyGames', () => {
    const p = projectGamesWon(1300, 1100, 3, 2)
    const scores = p.steps.map((s) => (s.winner === 'A' ? [1, 0] : [0, 1]) as [number, number])
    const viaGames = applyGames(1300, 1100, scores)
    expect(p.eloAAfter).toBe(viaGames.eloA)
    expect(p.eloBAfter).toBe(viaGames.eloB)
  })

  it('last step running ratings equal the net result', () => {
    const p = projectGamesWon(1250, 1180, 2, 3)
    const last = p.steps[p.steps.length - 1]
    expect(last.eloA).toBe(p.eloAAfter)
    expect(last.eloB).toBe(p.eloBAfter)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/elo.test.ts -t projectGamesWon`
Expected: FAIL — `projectGamesWon is not a function` (or import error).

- [ ] **Step 3: Implement `projectGamesWon`**

Append to `lib/elo.ts`:

```ts
export type ProjectionStep = {
  game: number // 1-based index in the played sequence
  winner: 'A' | 'B'
  eloA: number // running rating after this game
  eloB: number
}

export type Projection = {
  eloABefore: number
  eloBBefore: number
  eloAAfter: number
  eloBAfter: number
  deltaA: number
  deltaB: number
  steps: ProjectionStep[]
}

/**
 * Builds an evenly-interleaved win sequence from games-won counts. Each player's
 * wins are spread across the sequence proportionally; ties for a slot go to
 * whoever has placed fewer wins so far, then to A. Deterministic.
 */
function buildSequence(gamesWonA: number, gamesWonB: number): Array<'A' | 'B'> {
  const total = gamesWonA + gamesWonB
  const seq: Array<'A' | 'B'> = []
  let usedA = 0
  let usedB = 0
  for (let i = 0; i < total; i++) {
    if (usedA >= gamesWonA) {
      seq.push('B')
      usedB++
      continue
    }
    if (usedB >= gamesWonB) {
      seq.push('A')
      usedA++
      continue
    }
    const placed = i + 1
    const deficitA = (gamesWonA * placed) / total - usedA
    const deficitB = (gamesWonB * placed) / total - usedB
    let pickA: boolean
    if (deficitA !== deficitB) pickA = deficitA > deficitB
    else if (usedA !== usedB) pickA = usedA < usedB
    else pickA = true
    if (pickA) {
      seq.push('A')
      usedA++
    } else {
      seq.push('B')
      usedB++
    }
  }
  return seq
}

/**
 * Projects the Elo change of a hypothetical sitting from games-won counts, with
 * no point scores (margins never affect Elo). Threads each game through
 * applyMatch in the evenly-interleaved order and records the running ratings.
 */
export function projectGamesWon(
  eloA: number,
  eloB: number,
  gamesWonA: number,
  gamesWonB: number
): Projection {
  const sequence = buildSequence(gamesWonA, gamesWonB)
  let a = eloA
  let b = eloB
  const steps: ProjectionStep[] = []
  sequence.forEach((winner, idx) => {
    const r = applyMatch(a, b, winner)
    a = r.eloA
    b = r.eloB
    steps.push({ game: idx + 1, winner, eloA: a, eloB: b })
  })
  return {
    eloABefore: eloA,
    eloBBefore: eloB,
    eloAAfter: a,
    eloBAfter: b,
    deltaA: a - eloA,
    deltaB: b - eloB,
    steps,
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/elo.test.ts`
Expected: PASS — all existing tests plus the 7 new `projectGamesWon` cases.

- [ ] **Step 5: Commit**

```bash
git add lib/elo.ts tests/elo.test.ts
git commit -m "Add projectGamesWon Elo look-ahead helper"
```

---

## Task 2: Calculator component

**Files:**
- Create: `components/elo-calculator.tsx`

No unit test (per the spec — the maths is tested in Task 1; this is presentation). Verified by typecheck/lint in Task 5 and the manual smoke check.

- [ ] **Step 1: Create the component**

Create `components/elo-calculator.tsx`:

```tsx
'use client'

import { useMemo, useState } from 'react'
import { Stepper } from '@/components/stepper'
import { projectGamesWon } from '@/lib/elo'

type PlayerOption = {
  id: string
  name: string
  nickname: string | null
  currentElo: number
}

function DeltaBadge({ delta }: { delta: number }) {
  const tone =
    delta > 0 ? 'text-gain' : delta < 0 ? 'text-loss' : 'text-muted-foreground'
  const sign = delta > 0 ? '+' : ''
  return (
    <span className={`font-mono font-bold ${tone}`}>
      {sign}
      {delta}
    </span>
  )
}

export function EloCalculator({ players }: { players: PlayerOption[] }) {
  const [aId, setAId] = useState('')
  const [bId, setBId] = useState('')
  const [gamesA, setGamesA] = useState(0)
  const [gamesB, setGamesB] = useState(0)

  const samePlayer = aId !== '' && aId === bId
  const nameFor = (id: string) => players.find((p) => p.id === id)?.name ?? 'Player'

  const projection = useMemo(() => {
    const pa = players.find((p) => p.id === aId)
    const pb = players.find((p) => p.id === bId)
    if (!pa || !pb || aId === bId || gamesA + gamesB === 0) return null
    return projectGamesWon(pa.currentElo, pb.currentElo, gamesA, gamesB)
  }, [players, aId, bId, gamesA, gamesB])

  return (
    <div className="space-y-6">
      {/* Players */}
      <div className="grid grid-cols-2 gap-4">
        {(['A', 'B'] as const).map((side) => {
          const value = side === 'A' ? aId : bId
          const setValue = side === 'A' ? setAId : setBId
          return (
            <label key={side} className="block">
              <span className="font-display uppercase tracking-widest text-xs text-muted-foreground">
                Player {side}
              </span>
              <select
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">—</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.currentElo})
                  </option>
                ))}
              </select>
            </label>
          )
        })}
      </div>

      {samePlayer && (
        <div className="rounded-md border border-border px-3 py-2 text-center text-sm text-muted-foreground">
          Pick two different players.
        </div>
      )}

      {/* Games won */}
      <fieldset className="grid grid-cols-2 gap-4">
        <legend className="section-header font-display w-full">Games won</legend>
        {(['A', 'B'] as const).map((side) => (
          <label key={side} className="flex flex-col gap-1.5">
            <span className="font-mono text-xs text-muted-foreground">
              {nameFor(side === 'A' ? aId : bId)}
            </span>
            <Stepper
              name={side === 'A' ? 'gamesA' : 'gamesB'}
              ariaLabel={`games won by player ${side}`}
              defaultValue={0}
              min={0}
              max={7}
              onValueChange={(v) =>
                (side === 'A' ? setGamesA : setGamesB)(v === '' ? 0 : v)
              }
            />
          </label>
        ))}
      </fieldset>

      {/* Projection */}
      {projection && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {[
              {
                side: 'A' as const,
                id: aId,
                before: projection.eloABefore,
                after: projection.eloAAfter,
                delta: projection.deltaA,
              },
              {
                side: 'B' as const,
                id: bId,
                before: projection.eloBBefore,
                after: projection.eloBAfter,
                delta: projection.deltaB,
              },
            ].map((row) => (
              <div key={row.side} className="rounded-lg border border-border bg-card p-4">
                <div className="font-display text-sm font-semibold">{nameFor(row.id)}</div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-mono nums text-muted-foreground">{row.before}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-mono nums text-xl font-bold">{row.after}</span>
                  <DeltaBadge delta={row.delta} />
                </div>
              </div>
            ))}
          </div>

          {/* Per-game breakdown */}
          <div className="rounded-lg border border-border bg-card">
            <div className="section-header font-display border-b border-border px-4 py-2">
              Game by game
            </div>
            <ol className="divide-y divide-border">
              {projection.steps.map((step) => (
                <li
                  key={step.game}
                  className="flex items-center justify-between px-4 py-2 text-sm"
                >
                  <span className="text-muted-foreground">
                    Game {step.game} · {nameFor(step.winner === 'A' ? aId : bId)} wins
                  </span>
                  <span className="font-mono nums">
                    {step.eloA} · {step.eloB}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {!projection && !samePlayer && (
        <p className="text-sm text-muted-foreground">
          Pick both players and enter how many games each wins to see the projection.
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/elo-calculator.tsx
git commit -m "Add Elo calculator component"
```

---

## Task 3: Calculator page

**Files:**
- Create: `app/(public)/calculator/page.tsx`

- [ ] **Step 1: Create the page**

Create `app/(public)/calculator/page.tsx` (roster query copied verbatim from `app/admin/matches/new/page.tsx`):

```tsx
import { asc, eq } from 'drizzle-orm'
import { db, players } from '@/lib/db'
import { EloCalculator } from '@/components/elo-calculator'

export const dynamic = 'force-dynamic'

export default async function CalculatorPage() {
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
    <main className="mx-auto w-full max-w-xl px-4 py-8 md:px-6">
      <div className="mb-6">
        <p className="font-display uppercase tracking-[0.2em] text-xs text-primary mb-1">
          What-if
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight leading-none">
          Elo calculator
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pick two players and how many games each wins to project the Elo change.
          Points don&rsquo;t matter — only who wins each game.
        </p>
      </div>
      <EloCalculator players={roster} />
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/(public)/calculator/page.tsx"
git commit -m "Add Elo calculator page route"
```

---

## Task 4: Nav entry

**Files:**
- Modify: `components/site-header.tsx` (the `NAV` array, ~line 11)

- [ ] **Step 1: Add the nav entry**

In `components/site-header.tsx`, change the `NAV` array from:

```tsx
const NAV = [
  { href: '/players', label: 'Players' },
  { href: '/matches', label: 'Matches' },
  { href: '/matrix', label: 'Mogboard' },
  { href: '/tournaments', label: 'Tournaments' },
]
```

to:

```tsx
const NAV = [
  { href: '/players', label: 'Players' },
  { href: '/matches', label: 'Matches' },
  { href: '/matrix', label: 'Mogboard' },
  { href: '/tournaments', label: 'Tournaments' },
  { href: '/calculator', label: 'Calculator' },
]
```

Both the desktop nav and the mobile menu map over `NAV`, so this is the only edit needed.

- [ ] **Step 2: Commit**

```bash
git add components/site-header.tsx
git commit -m "Add calculator link to site nav"
```

---

## Task 5: Verify the feature end to end

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS — all suites green, including the new `projectGamesWon` cases.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 4: Manual smoke check**

Run: `npm run dev`, then open `http://localhost:3000/calculator`.
Confirm:
- "Calculator" appears in the header nav (desktop and mobile menu).
- Selecting two different players and entering games shows each player's `before → after` with a coloured delta, plus a "Game by game" breakdown whose row count equals the total games entered.
- Selecting the same player for A and B shows the "Pick two different players" hint and no projection.
- 0–0 games shows the prompt and no projection.

---

## Self-review notes

- **Spec coverage:** public page (Task 3) + nav (Task 4); games-won-only input via two Steppers (Task 2); even-interleave convention + per-game running ratings (Task 1); net + breakdown output (Task 2); edge cases — same player, unset, 0–0, cap 7 (Task 2); tests for the pure fn (Task 1). All spec sections map to a task.
- **No placeholders:** every code/step is concrete.
- **Type consistency:** `projectGamesWon`, `Projection` (`eloABefore/eloBBefore/eloAAfter/eloBAfter/deltaA/deltaB/steps`), and `ProjectionStep` (`game/winner/eloA/eloB`) are used identically across `lib/elo.ts`, the tests, and the component.

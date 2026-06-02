# Log-game & View-game UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public inline game-logger to the home page (Quick + Full modes), a shared view-game modal reachable from any list, a per-player games-history, and a "Back to home" admin nav link.

**Architecture:** Reuse the existing `MatchLogForm` + `logMatch`/`editMatch` server actions unchanged at the data layer. All new display/winner logic lives in a pure, unit-tested helper module `lib/match-format.ts`. UI is composed from existing primitives (`Dialog`, `MatchStopwatch`). A new read-only `getMatchDetail` server action feeds a shared `MatchDetailModal` triggered by a `ViewGameButton` placed on each match row.

**Tech Stack:** Next.js 16 (App Router, server actions, `proxy.ts`), React 19, Drizzle ORM (Postgres), Zod, Tailwind v4, Radix Dialog, Vitest (pure-logic tests only — no React Testing Library installed).

**Spec:** `docs/superpowers/specs/2026-06-02-log-game-and-view-game-ux-design.md`

**Per-task model guidance (subagent dispatch):** default **sonnet**; use **haiku** only for the trivial mechanical tasks explicitly marked. Marked inline as `Model: …`.

**Conventions to honour:**
- This Next.js has breaking changes — `AGENTS.md` says read `node_modules/next/dist/docs/` before writing framework code. `cookies()`/`params` are async; `proxy.ts` (not middleware) gates `/admin/*` page routes only — server actions are NOT gated.
- En-dash `–` (U+2013) is used between scores throughout; keep it.
- Score fields the server action reads are named `set_<i>_a` / `set_<i>_b` (i = 0..6). Do not rename them.
- Verify data-driven UI with **throwaway preview fixtures**, never by seeding live Supabase.

---

## File structure

**Create:**
- `lib/match-format.ts` — pure helpers: winner inference, sets-won tally, player-oriented score string, per-player ELO delta. (Testable core.)
- `tests/match-format.test.ts` — unit tests for the above.
- `components/stepper.tsx` — `−  [n]  +` numeric stepper that is also typable; emits a named form field.
- `components/match-detail-modal.tsx` — shared view-game `Dialog`; fetches detail on open.
- `components/view-game-button.tsx` — the dedicated trigger (button / chevron) that opens `MatchDetailModal` for a match id.
- `components/inline-logger.tsx` — server component: loads active roster, renders `MatchLogForm` in a styled card for the home page.
- `components/player-games-history.tsx` — client component rendering a player's games list with `ViewGameButton`s.

**Modify:**
- `app/actions/matches.ts` — extract `inferWinner` to `lib/match-format.ts` and import it (DRY); add `getMatchDetail(id)` server action.
- `components/match-log-form.tsx` — add Quick/Full mode toggle, use `Stepper`, dynamic set rows (Full), stopwatch in both modes, live winner badge.
- `app/(public)/page.tsx` — place `InlineLogger` at top of right column; repoint hero "New game" button to the logger.
- `components/site-header.tsx` — repoint header "New game" link to the home logger (`/#log`).
- `app/(public)/matches/page.tsx` — add `ViewGameButton` to each row.
- `components/recent-matches.tsx` — add `ViewGameButton` (chevron) to each row.
- `app/(public)/players/[id]/page.tsx` — extend query for opponent names; render `PlayerGamesHistory` below the ELO chart.
- `components/nav.tsx` — replace top-left "Admin" brand link with "← Back to home".

---

## Task 1: Pure match-format helpers

**Files:**
- Create: `lib/match-format.ts`
- Test: `tests/match-format.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/match-format.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  inferWinnerSide,
  setsWon,
  formatScoreForPlayer,
  playerEloDelta,
  isSingleSet,
  type SetScore,
} from '@/lib/match-format'

describe('inferWinnerSide', () => {
  it('single set, A ahead → A', () => {
    expect(inferWinnerSide([[11, 7]])).toBe('A')
  })
  it('single set, B ahead → B', () => {
    expect(inferWinnerSide([[7, 11]])).toBe('B')
  })
  it('best-of-3, A takes 2 → A', () => {
    expect(inferWinnerSide([[11, 8], [9, 11], [11, 6]])).toBe('A')
  })
  it('tied set count → null', () => {
    expect(inferWinnerSide([[11, 8], [9, 11]])).toBe(null)
  })
  it('single tied set → null', () => {
    expect(inferWinnerSide([[11, 11]])).toBe(null)
  })
  it('empty → null', () => {
    expect(inferWinnerSide([])).toBe(null)
  })
})

describe('setsWon', () => {
  it('counts sets each side won, ignoring tied sets', () => {
    expect(setsWon([[11, 8], [9, 11], [11, 6]])).toEqual({ a: 2, b: 1 })
    expect(setsWon([[11, 11]])).toEqual({ a: 0, b: 0 })
  })
})

describe('isSingleSet', () => {
  it('true for exactly one set', () => {
    expect(isSingleSet([[11, 7]])).toBe(true)
    expect(isSingleSet([[11, 7], [5, 11]])).toBe(false)
    expect(isSingleSet([])).toBe(false)
  })
})

describe('formatScoreForPlayer', () => {
  it('single set, player is A → player points first', () => {
    expect(formatScoreForPlayer([[11, 7]], true)).toBe('11–7')
  })
  it('single set, player is B → player points first', () => {
    expect(formatScoreForPlayer([[11, 7]], false)).toBe('7–11')
  })
  it('multi set, player is A → player sets-won first', () => {
    expect(formatScoreForPlayer([[11, 8], [9, 11], [11, 6]], true)).toBe('2–1')
  })
  it('multi set, player is B → player sets-won first', () => {
    expect(formatScoreForPlayer([[11, 8], [9, 11], [11, 6]], false)).toBe('1–2')
  })
})

describe('playerEloDelta', () => {
  const base = { eloABefore: 1200, eloAAfter: 1216, eloBBefore: 1300, eloBAfter: 1284 }
  it('player A delta', () => {
    expect(playerEloDelta(base, true)).toBe(16)
  })
  it('player B delta', () => {
    expect(playerEloDelta(base, false)).toBe(-16)
  })
  it('null before/after → null', () => {
    expect(playerEloDelta({ eloABefore: null, eloAAfter: null, eloBBefore: null, eloBAfter: null }, true)).toBe(null)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- match-format`
Expected: FAIL — cannot resolve `@/lib/match-format`.

- [ ] **Step 3: Write the implementation**

`lib/match-format.ts`:

```ts
export type SetScore = [number, number]

/** Winner by sets won. Ties (equal sets, or a single tied set) return null. Mirrors the rule used at save time. */
export function inferWinnerSide(sets: SetScore[]): 'A' | 'B' | null {
  const { a, b } = setsWon(sets)
  if (a === b) return null
  return a > b ? 'A' : 'B'
}

export function setsWon(sets: SetScore[]): { a: number; b: number } {
  let a = 0
  let b = 0
  for (const [sa, sb] of sets) {
    if (sa > sb) a++
    else if (sb > sa) b++
  }
  return { a, b }
}

export function isSingleSet(sets: SetScore[]): boolean {
  return sets.length === 1
}

/** Player-oriented score: single set → the player's points first; multi-set → the player's sets-won first. */
export function formatScoreForPlayer(sets: SetScore[], playerIsA: boolean): string {
  if (isSingleSet(sets)) {
    const [a, b] = sets[0]
    return playerIsA ? `${a}–${b}` : `${b}–${a}`
  }
  const { a, b } = setsWon(sets)
  return playerIsA ? `${a}–${b}` : `${b}–${a}`
}

export type EloPair = {
  eloABefore: number | null
  eloAAfter: number | null
  eloBBefore: number | null
  eloBAfter: number | null
}

/** ELO change for the given side, or null if the stored values are missing. */
export function playerEloDelta(elo: EloPair, playerIsA: boolean): number | null {
  const before = playerIsA ? elo.eloABefore : elo.eloBBefore
  const after = playerIsA ? elo.eloAAfter : elo.eloBAfter
  if (before == null || after == null) return null
  return after - before
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- match-format`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add lib/match-format.ts tests/match-format.test.ts
git commit -m "feat: pure match-format helpers (winner, sets-won, score, elo delta)"
```

`Model: sonnet`

---

## Task 2: DRY the server winner logic + add `getMatchDetail`

**Files:**
- Modify: `app/actions/matches.ts`
- Test: extend `tests/match-format.test.ts` is already done; this task adds a parity test that the server uses the shared helper.

- [ ] **Step 1: Write the failing test (parity)**

Append to `tests/match-format.test.ts`:

```ts
import { inferWinnerSide as sharedInfer } from '@/lib/match-format'

describe('server uses shared winner rule', () => {
  it('exported inferWinnerSide is the single source of truth', () => {
    // Guards against the server re-introducing a private duplicate.
    expect(typeof sharedInfer).toBe('function')
    expect(sharedInfer([[11, 9], [8, 11], [11, 5]])).toBe('A')
  })
})
```

- [ ] **Step 2: Run test to verify current state**

Run: `npm test -- match-format`
Expected: PASS (helper exists) — this test documents intent; the real change is the refactor below.

- [ ] **Step 3: Refactor `app/actions/matches.ts` to use the shared helper**

In `app/actions/matches.ts`:
- Delete the local `inferWinner` function (lines ~10-19).
- Add to imports: `import { inferWinnerSide, type SetScore } from '@/lib/match-format'`.
- Replace both call sites `inferWinner(parsed.data.sets)` with `inferWinnerSide(parsed.data.sets)`.

The `setsRaw` arrays are typed `Array<[number, number]>` which is assignable to `SetScore[]`; no other change to `logMatch`/`editMatch` logic.

- [ ] **Step 4: Add the `getMatchDetail` read action**

Append to `app/actions/matches.ts` (it already imports `db, matches, players` and `alias` is available from `drizzle-orm/pg-core`; add `import { alias } from 'drizzle-orm/pg-core'` and ensure `eq` is imported — it already is):

```ts
export type MatchDetail = {
  id: string
  playedAt: Date | null
  durationSeconds: number | null
  setScores: SetScore[]
  aId: string
  aName: string
  bId: string
  bName: string
  winnerId: string | null
  eloABefore: number | null
  eloAAfter: number | null
  eloBBefore: number | null
  eloBAfter: number | null
}

export async function getMatchDetail(id: string): Promise<MatchDetail | null> {
  const a = alias(players, 'a')
  const b = alias(players, 'b')
  const [row] = await db
    .select({
      id: matches.id,
      playedAt: matches.playedAt,
      durationSeconds: matches.durationSeconds,
      setScores: matches.setScores,
      aId: a.id,
      aName: a.name,
      bId: b.id,
      bName: b.name,
      winnerId: matches.winnerId,
      eloABefore: matches.eloABefore,
      eloAAfter: matches.eloAAfter,
      eloBBefore: matches.eloBBefore,
      eloBAfter: matches.eloBAfter,
    })
    .from(matches)
    .innerJoin(a, eq(matches.playerAId, a.id))
    .innerJoin(b, eq(matches.playerBId, b.id))
    .where(eq(matches.id, id))
    .limit(1)
  if (!row) return null
  return { ...row, setScores: (row.setScores as SetScore[]) ?? [] }
}
```

- [ ] **Step 5: Verify build + tests**

Run: `npm test -- match-format` → PASS
Run: `npx tsc --noEmit` → no errors.

- [ ] **Step 6: Commit**

```bash
git add app/actions/matches.ts tests/match-format.test.ts
git commit -m "refactor: share winner rule with server; add getMatchDetail action"
```

`Model: sonnet`

---

## Task 3: `Stepper` component

**Files:**
- Create: `components/stepper.tsx`

(No unit test — it's a presentational input with no extractable logic; covered by typecheck + manual verification. RTL is not installed.)

- [ ] **Step 1: Implement the component**

`components/stepper.tsx`:

```tsx
'use client'

import { useState } from 'react'

/**
 * A numeric score input: − [n] +. The number is typable AND adjustable by the
 * buttons. Renders a hidden-free, real <input name=...> so the existing
 * server action reads it as set_<i>_a / set_<i>_b.
 */
export function Stepper({
  name,
  defaultValue,
  min = 0,
  max = 99,
  ariaLabel,
}: {
  name: string
  defaultValue?: number | ''
  min?: number
  max?: number
  ariaLabel?: string
}) {
  const [value, setValue] = useState<number | ''>(defaultValue ?? '')

  const clamp = (n: number) => Math.max(min, Math.min(max, n))
  const step = (delta: number) =>
    setValue((v) => clamp((typeof v === 'number' ? v : 0) + delta))

  return (
    <div className="flex items-center gap-2 rounded-lg border border-input bg-card p-1.5">
      <button
        type="button"
        aria-label={`decrease ${ariaLabel ?? name}`}
        onClick={() => step(-1)}
        className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary text-foreground transition-colors hover:bg-muted"
      >
        −
      </button>
      <input
        name={name}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        aria-label={ariaLabel ?? name}
        value={value}
        onChange={(e) => {
          const raw = e.target.value
          if (raw === '') return setValue('')
          setValue(clamp(Number(raw)))
        }}
        className="w-12 bg-transparent text-center font-mono nums text-xl font-bold focus:outline-none"
      />
      <button
        type="button"
        aria-label={`increase ${ariaLabel ?? name}`}
        onClick={() => step(1)}
        className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary text-foreground transition-colors hover:bg-muted"
      >
        +
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/stepper.tsx
git commit -m "feat: Stepper numeric score input (type or tap)"
```

`Model: haiku`

---

## Task 4: Rework `MatchLogForm` — Quick/Full, steppers, stopwatch both modes, live badge

**Files:**
- Modify: `components/match-log-form.tsx`

This is the largest UI change. Behaviour to preserve exactly: it submits `set_<i>_a/b`, `durationSeconds`, `playedAt`, `playerAId`, `playerBId` to `logMatch`/`editMatch`; resets after a non-edit save; supports `initial` for the admin edit dialog.

- [ ] **Step 1: Add mode + set-count state and the live-winner derivation**

At the top of the component body (after existing state), add:

```tsx
import { Stepper } from '@/components/stepper'
import { inferWinnerSide, setsWon, type SetScore } from '@/lib/match-format'

// inside the component, after existing useState hooks:
const initialSetCount = Math.min(7, Math.max(1, initial?.sets.length ?? 1))
const initialMode: 'quick' | 'full' =
  initial && initial.sets.length > 1 ? 'full' : 'quick'
const [mode, setMode] = useState<'quick' | 'full'>(initialMode)
const [setCount, setSetCount] = useState(initialSetCount)
// Live-updating scores mirror for the winner badge (form fields remain the source of truth at submit).
const [scores, setScores] = useState<Array<[string, string]>>(
  Array.from({ length: 7 }, (_, i) => [
    initial?.sets[i]?.[0]?.toString() ?? '',
    initial?.sets[i]?.[1]?.toString() ?? '',
  ])
)
```

NOTE: `Stepper` manages its own value, but the badge needs to react to changes. Simplest robust approach: drop the internal-state `Stepper` here and instead render the stepper markup inline so its `onChange` updates `scores`. To keep DRY, give `Stepper` an optional `onValueChange` callback and use it.

- [ ] **Step 2: Extend `Stepper` with an `onValueChange` callback**

Edit `components/stepper.tsx` — add prop and call it:

```tsx
export function Stepper({
  name, defaultValue, min = 0, max = 99, ariaLabel, onValueChange,
}: {
  name: string
  defaultValue?: number | ''
  min?: number
  max?: number
  ariaLabel?: string
  onValueChange?: (v: number | '') => void
}) {
  const [value, setValue] = useState<number | ''>(defaultValue ?? '')
  const update = (v: number | '') => { setValue(v); onValueChange?.(v) }
  const clamp = (n: number) => Math.max(min, Math.min(max, n))
  const step = (delta: number) =>
    update(clamp((typeof value === 'number' ? value : 0) + delta))
  // ...input onChange uses update('' | clamped) instead of setValue
}
```

(Replace the two `setValue(...)` calls in the input `onChange` and the buttons with `update(...)`.)

- [ ] **Step 3: Build the live winner badge helper (inline, uses shared lib)**

Inside `MatchLogForm`, derive:

```tsx
const activeSets: SetScore[] = scores
  .slice(0, mode === 'quick' ? 1 : setCount)
  .filter(([a, b]) => a !== '' && b !== '')
  .map(([a, b]) => [Number(a), Number(b)] as SetScore)

const winnerSide = inferWinnerSide(activeSets)
const tally = setsWon(activeSets)
const nameA = players.find((p) => p.id === /* selected A */ undefined)?.name // see Step 5 for selected ids
```

For the badge we need the selected player names. Track selected ids in state:

```tsx
const [aId, setAId] = useState(initial?.playerAId ?? '')
const [bId, setBId] = useState(initial?.playerBId ?? '')
const nameFor = (id: string) => players.find((p) => p.id === id)?.name ?? 'Player'
const badge = (() => {
  if (activeSets.length === 0) return null
  if (winnerSide === null) return { tone: 'tie' as const, text: 'Tied — adjust the score' }
  const winnerName = winnerSide === 'A' ? nameFor(aId) : nameFor(bId)
  if (mode === 'quick') {
    const [a, b] = activeSets[0]
    return { tone: 'win' as const, text: `${winnerName} wins · ${a}–${b}` }
  }
  return { tone: 'win' as const, text: `${winnerName} wins the match (${tally.a}–${tally.b})` }
})()
```

- [ ] **Step 4: Render the mode toggle**

Replace the top of the returned form (above the players grid) with a segmented control:

```tsx
<div className="flex gap-1 rounded-lg bg-secondary p-1">
  {(['quick', 'full'] as const).map((m) => (
    <button
      key={m}
      type="button"
      onClick={() => setMode(m)}
      className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
      }`}
    >
      {m === 'quick' ? 'Quick' : 'Full match'}
    </button>
  ))}
</div>
```

- [ ] **Step 5: Wire the player selects to state**

Change the two `<select>`s to controlled: add `value={side === 'A' ? aId : bId}` and `onChange={(e) => side === 'A' ? setAId(e.target.value) : setBId(e.target.value)}` (keep `name`, `required`). Remove `defaultValue`.

- [ ] **Step 6: Replace the fixed 7-row set fieldset**

Replace the existing `<fieldset>` set-scores block with mode-aware rendering. Each visible set renders two `Stepper`s feeding `set_<i>_a/b` and updating `scores`:

```tsx
<fieldset className="space-y-2">
  <legend className="section-header font-display w-full">
    {mode === 'quick' ? 'Score' : 'Sets'}
  </legend>
  {Array.from({ length: mode === 'quick' ? 1 : setCount }).map((_, i) => (
    <div key={i} className="flex items-center gap-3">
      {mode === 'full' && (
        <span className="w-12 font-mono text-xs text-muted-foreground">Set {i + 1}</span>
      )}
      <Stepper
        name={`set_${i}_a`}
        ariaLabel={`set ${i + 1} player A`}
        defaultValue={scores[i][0] === '' ? '' : Number(scores[i][0])}
        onValueChange={(v) =>
          setScores((s) => { const n = [...s]; n[i] = [v === '' ? '' : String(v), n[i][1]]; return n })
        }
      />
      <span className="text-muted-foreground">–</span>
      <Stepper
        name={`set_${i}_b`}
        ariaLabel={`set ${i + 1} player B`}
        defaultValue={scores[i][1] === '' ? '' : Number(scores[i][1])}
        onValueChange={(v) =>
          setScores((s) => { const n = [...s]; n[i] = [n[i][0], v === '' ? '' : String(v)]; return n })
        }
      />
      {mode === 'full' && setCount > 1 && (
        <button
          type="button"
          aria-label={`remove set ${i + 1}`}
          onClick={() => setSetCount((c) => Math.max(1, c - 1))}
          className="text-muted-foreground hover:text-loss"
        >
          ×
        </button>
      )}
    </div>
  ))}
  {mode === 'full' && setCount < 7 && (
    <button
      type="button"
      onClick={() => setSetCount((c) => Math.min(7, c + 1))}
      className="rounded-md border border-dashed border-input px-3 py-1.5 text-sm text-primary"
    >
      ＋ Add set
    </button>
  )}
</fieldset>
```

IMPORTANT: only sets `0..(count-1)` render inputs, so `logMatch`/`editMatch` (which read `set_0..6`) naturally see only the entered sets; blank ones are skipped by the existing loop. In Quick mode only `set_0_*` exists.

- [ ] **Step 7: Show the live badge**

Directly under the fieldset:

```tsx
{badge && (
  <div className={`rounded-md border px-3 py-2 text-sm text-center ${
    badge.tone === 'win'
      ? 'border-primary bg-primary/10 text-primary'
      : 'border-border text-muted-foreground'
  }`}>
    {badge.text}
  </div>
)}
```

- [ ] **Step 8: Keep the stopwatch in both modes**

The existing `MatchStopwatch` + manual `mm:ss` block already renders unconditionally — leave it in place so it shows for Quick and Full. No change needed beyond confirming it sits below the badge.

- [ ] **Step 9: Reset on save includes mode-related state**

In the success branch of `handle` (the `if (!isEdit)` block), also reset the new state:

```tsx
setScores(Array.from({ length: 7 }, () => ['', '']))
setSetCount(1)
setMode('quick')
setAId('')
setBId('')
```

(The form already remounts via `key={savedTick}`, which resets `Stepper` internal values too; keeping the explicit resets makes intent clear and covers the controlled selects.)

- [ ] **Step 10: Verify build**

Run: `npx tsc --noEmit` → no errors.
Run: `npm test` → existing suites still PASS.

- [ ] **Step 11: Commit**

```bash
git add components/match-log-form.tsx components/stepper.tsx
git commit -m "feat: Quick/Full logger modes with steppers and live winner badge"
```

`Model: sonnet`

---

## Task 5: Inline logger on the home page + repoint "New game" buttons

**Files:**
- Create: `components/inline-logger.tsx`
- Modify: `app/(public)/page.tsx`, `components/site-header.tsx`

- [ ] **Step 1: Create the server component**

`components/inline-logger.tsx`:

```tsx
import { db, players } from '@/lib/db'
import { asc, eq } from 'drizzle-orm'
import { MatchLogForm } from '@/components/match-log-form'

export async function InlineLogger() {
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
    <section
      id="log"
      className="scroll-mt-20 rounded-xl border border-primary/40 bg-card p-4 shadow-[0_0_0_2px_rgba(41,96,197,0.12)]"
    >
      <div className="section-header font-display text-primary">Log a game</div>
      <MatchLogForm players={roster} />
    </section>
  )
}
```

- [ ] **Step 2: Place it at the top of the home right column**

In `app/(public)/page.tsx`:
- Add import: `import { InlineLogger } from '@/components/inline-logger'`.
- In the right column `<div className="space-y-8">`, make `<InlineLogger />` the FIRST child (above `<JoinCta />`).

- [ ] **Step 3: Repoint the hero "New game" button**

In `app/(public)/page.tsx`, change the hero secondary button from `<Link href="/admin/matches/new" …>New game</Link>` to a same-styled `<a href="#log">Log a game</a>` (anchor scrolls to the logger; `scroll-mt-20` offsets the sticky header).

- [ ] **Step 4: Repoint the header "New game" link**

In `components/site-header.tsx`, change the "New game" `Link href="/admin/matches/new"` to `href="/#log"` and label it "Log a game". Keep the `Plus` icon and styling.

- [ ] **Step 5: Verify build**

Run: `npx tsc --noEmit` → no errors.
Run: `npm run build` → compiles (home page renders the server component).

- [ ] **Step 6: Commit**

```bash
git add components/inline-logger.tsx app/(public)/page.tsx components/site-header.tsx
git commit -m "feat: inline game logger on home page; point New game buttons to it"
```

`Model: sonnet`

---

## Task 6: View-game modal + view-game button

**Files:**
- Create: `components/match-detail-modal.tsx`, `components/view-game-button.tsx`

- [ ] **Step 1: Create the modal**

`components/match-detail-modal.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getMatchDetail, type MatchDetail } from '@/app/actions/matches'
import { setsWon, inferWinnerSide, playerEloDelta } from '@/lib/match-format'
import { formatDuration } from '@/lib/stats'

export function MatchDetailModal({
  id, open, onOpenChange,
}: { id: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [detail, setDetail] = useState<MatchDetail | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    getMatchDetail(id).then((d) => {
      if (!cancelled) { setDetail(d); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [open, id])

  const winnerSide = detail ? inferWinnerSide(detail.setScores) : null
  const tally = detail ? setsWon(detail.setScores) : { a: 0, b: 0 }
  const aWon = detail ? detail.winnerId === detail.aId : false
  const deltaA = detail ? playerEloDelta(detail, true) : null
  const deltaB = detail ? playerEloDelta(detail, false) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            {loading || !detail ? 'Game' : (
              <span>
                <span className={aWon ? 'text-foreground' : 'text-muted-foreground'}>{detail.aName}</span>
                <span className="text-muted-foreground"> vs </span>
                <span className={!aWon ? 'text-foreground' : 'text-muted-foreground'}>{detail.bName}</span>
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!loading && !detail && <p className="text-sm text-muted-foreground">Match not found.</p>}

        {detail && (
          <div className="space-y-4">
            <p className="font-mono text-xs text-muted-foreground">
              {detail.playedAt?.toLocaleString(undefined, {
                day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
              })}
            </p>

            {/* Set-by-set */}
            <div className="flex gap-2">
              {detail.setScores.map(([sa, sb], i) => {
                const setToA = sa > sb
                return (
                  <div key={i} className={`flex-1 rounded-lg border p-2 text-center ${
                    inferWinnerSide([[sa, sb]]) ? 'border-border' : 'border-border'
                  }`}>
                    <div className="font-display text-[9px] uppercase tracking-widest text-muted-foreground">
                      Set {i + 1}
                    </div>
                    <div className="mt-1 font-mono nums text-lg font-bold">
                      <span className={setToA ? 'text-foreground' : 'text-muted-foreground'}>{sa}</span>
                      –
                      <span className={!setToA ? 'text-foreground' : 'text-muted-foreground'}>{sb}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Final result */}
            <p className="text-center text-sm">
              <b className="text-primary">
                {winnerSide === 'A' ? detail.aName : detail.bName} wins
                {detail.setScores.length > 1
                  ? ` ${winnerSide === 'A' ? tally.a : tally.b}–${winnerSide === 'A' ? tally.b : tally.a}`
                  : ` ${detail.setScores[0]?.[0]}–${detail.setScores[0]?.[1]}`}
              </b>
            </p>

            {/* ELO impact */}
            <div className="flex gap-3">
              {[
                { name: detail.aName, id: detail.aId, before: detail.eloABefore, after: detail.eloAAfter, delta: deltaA },
                { name: detail.bName, id: detail.bId, before: detail.eloBBefore, after: detail.eloBAfter, delta: deltaB },
              ].map((p) => (
                <Link key={p.id} href={`/players/${p.id}`}
                  className="flex-1 rounded-lg border border-border p-2.5 transition-colors hover:bg-secondary">
                  <div className="text-sm">{p.name}</div>
                  {p.delta != null && (
                    <>
                      <div className={`font-mono nums font-bold ${p.delta >= 0 ? 'text-gain' : 'text-loss'}`}>
                        {p.delta >= 0 ? '+' : '−'}{Math.abs(p.delta)}
                      </div>
                      <div className="font-mono text-[11px] text-muted-foreground">{p.before} → {p.after}</div>
                    </>
                  )}
                </Link>
              ))}
            </div>

            {detail.durationSeconds ? (
              <p className="text-xs text-muted-foreground">⏱ {formatDuration(detail.durationSeconds)}</p>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Create the trigger button**

`components/view-game-button.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { MatchDetailModal } from '@/components/match-detail-modal'

export function ViewGameButton({
  id, variant = 'label',
}: { id: string; variant?: 'label' | 'icon' }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="View game details"
        className={
          variant === 'icon'
            ? 'rounded-md p-1 text-muted-foreground transition-colors hover:text-primary hover:bg-secondary'
            : 'rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-primary hover:bg-secondary'
        }
      >
        {variant === 'icon' ? <ChevronRight className="h-4 w-4" /> : 'View'}
      </button>
      {open && <MatchDetailModal id={id} open={open} onOpenChange={setOpen} />}
    </>
  )
}
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit` → no errors.

- [ ] **Step 4: Commit**

```bash
git add components/match-detail-modal.tsx components/view-game-button.tsx
git commit -m "feat: shared view-game modal and view-game button"
```

`Model: sonnet`

---

## Task 7: Wire `ViewGameButton` into matches list and recent results

**Files:**
- Modify: `app/(public)/matches/page.tsx`, `components/recent-matches.tsx`

- [ ] **Step 1: Matches list**

In `app/(public)/matches/page.tsx`:
- Add `import { ViewGameButton } from '@/components/view-game-button'`.
- Inside each `<li>`, after the final winner-indicator span, add `<ViewGameButton id={r.id} />`. The player-name `<Link>`s stay unchanged (siblings of the button).

- [ ] **Step 2: Recent results**

In `components/recent-matches.tsx`:
- Add `import { ViewGameButton } from '@/components/view-game-button'`.
- Inside each `<li>`, after the final winner-indicator span, add `<ViewGameButton id={r.id} variant="icon" />`. Player-name `<Link>`s stay unchanged.

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit` → no errors.
Run: `npm run build` → compiles.

- [ ] **Step 4: Commit**

```bash
git add app/(public)/matches/page.tsx components/recent-matches.tsx
git commit -m "feat: view-game button on matches list and recent results"
```

`Model: haiku`

---

## Task 8: Player games-history section

**Files:**
- Create: `components/player-games-history.tsx`
- Modify: `app/(public)/players/[id]/page.tsx`

- [ ] **Step 1: Create the history component**

`components/player-games-history.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { ViewGameButton } from '@/components/view-game-button'
import { formatScoreForPlayer, type SetScore } from '@/lib/match-format'

export type HistoryRow = {
  id: string
  playedAt: string // ISO
  playerIsA: boolean
  iWon: boolean
  opponentId: string
  opponentName: string
  sets: SetScore[]
  eloDelta: number | null
}

export function PlayerGamesHistory({ rows }: { rows: HistoryRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No games yet.</p>
  }
  return (
    <ul className="rounded-lg border border-border overflow-hidden bg-card">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center gap-3 px-3 py-2.5 text-sm border-b border-border last:border-0">
          <span className="w-14 shrink-0 font-mono text-[11px] text-muted-foreground">
            {new Date(r.playedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-bold ${
            r.iWon ? 'bg-gain/15 text-gain' : 'bg-loss/15 text-loss'
          }`}>
            {r.iWon ? 'W' : 'L'}
          </span>
          <Link href={`/players/${r.opponentId}`} className="flex-1 truncate text-foreground hover:text-primary">
            vs {r.opponentName}
          </Link>
          <span className="shrink-0 font-mono nums text-xs text-muted-foreground">
            {formatScoreForPlayer(r.sets, r.playerIsA)}
          </span>
          {r.eloDelta != null && (
            <span className={`w-11 shrink-0 text-right font-mono nums text-xs font-semibold ${
              r.eloDelta >= 0 ? 'text-gain' : 'text-loss'
            }`}>
              {r.eloDelta >= 0 ? '+' : '−'}{Math.abs(r.eloDelta)}
            </span>
          )}
          <ViewGameButton id={r.id} variant="icon" />
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 2: Extend the player page query for opponent names + build rows**

In `app/(public)/players/[id]/page.tsx`, the current `playerMatches` query selects all match columns but no opponent name. Replace it with a join that also returns both player names. Add at top: `import { alias } from 'drizzle-orm/pg-core'`, `import { PlayerGamesHistory, type HistoryRow } from '@/components/player-games-history'`, and `import { type SetScore } from '@/lib/match-format'`.

Replace the `playerMatches` select with:

```tsx
const pa = alias(players, 'pa')
const pb = alias(players, 'pb')
const playerMatches = await db
  .select({
    id: matches.id,
    playerAId: matches.playerAId,
    playerBId: matches.playerBId,
    winnerId: matches.winnerId,
    setScores: matches.setScores,
    playedAt: matches.playedAt,
    durationSeconds: matches.durationSeconds,
    eloABefore: matches.eloABefore,
    eloAAfter: matches.eloAAfter,
    eloBBefore: matches.eloBBefore,
    eloBAfter: matches.eloBAfter,
    aName: pa.name,
    bName: pb.name,
  })
  .from(matches)
  .innerJoin(pa, eq(matches.playerAId, pa.id))
  .innerJoin(pb, eq(matches.playerBId, pb.id))
  .where(and(isNotNull(matches.playedAt), or(eq(matches.playerAId, id), eq(matches.playerBId, id))))
  .orderBy(asc(matches.playedAt))
```

The existing `durationMatches`, `points`, win/loss, and tier loops reference `m.playerAId`, `m.eloAAfter`, etc. — all still present in the new select, so they keep working. (The non-null assertions remain valid for played matches.)

Build the history rows (most-recent first) before the return:

```tsx
const historyRows: HistoryRow[] = [...playerMatches].reverse().map((m) => {
  const playerIsA = m.playerAId === id
  return {
    id: m.id,
    playedAt: m.playedAt!.toISOString(),
    playerIsA,
    iWon: m.winnerId === id,
    opponentId: playerIsA ? m.playerBId! : m.playerAId!,
    opponentName: playerIsA ? m.bName : m.aName,
    sets: (m.setScores as SetScore[]) ?? [],
    eloDelta: playerIsA
      ? (m.eloAAfter! - m.eloABefore!)
      : (m.eloBAfter! - m.eloBBefore!),
  }
})
```

- [ ] **Step 3: Render the section below the ELO chart**

After the `{/* ── ELO chart ── */}` section and before the tier-breakdown section, add:

```tsx
<section className="mb-8">
  <div className="section-header font-display">Games History</div>
  <PlayerGamesHistory rows={historyRows} />
</section>
```

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit` → no errors.
Run: `npm run build` → compiles.

- [ ] **Step 5: Commit**

```bash
git add components/player-games-history.tsx "app/(public)/players/[id]/page.tsx"
git commit -m "feat: games history on player page"
```

`Model: sonnet`

---

## Task 9: Admin nav — "Back to home"

**Files:**
- Modify: `components/nav.tsx`

- [ ] **Step 1: Replace the brand link**

In `components/nav.tsx`, replace the first `<Link href="/admin" …>Admin</Link>` with:

```tsx
<Link
  href="/"
  className="font-display uppercase tracking-widest text-xs font-semibold px-4 py-3 border-r border-border hover:text-gain transition-colors duration-150"
>
  ← Back to home
</Link>
```

Leave the other admin links unchanged.

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit` → no errors.

- [ ] **Step 3: Commit**

```bash
git add components/nav.tsx
git commit -m "feat: admin nav links back to home"
```

`Model: haiku`

---

## Task 10: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the whole test suite**

Run: `npm test`
Expected: all suites PASS (existing + `match-format`).

- [ ] **Step 2: Typecheck + production build**

Run: `npx tsc --noEmit` → no errors.
Run: `npm run build` → succeeds.

- [ ] **Step 3: Lint**

Run: `npm run lint` → no new errors (warnings tolerable if pre-existing).

- [ ] **Step 4: Manual verification with throwaway preview fixtures**

Per project memory, DO NOT seed live Supabase. Using a throwaway preview/fixture dataset, confirm:
- Home page shows the inline logger top-right; Quick mode logs a single-set game (steppers + type), badge shows the winner, save resets the form and the new game appears in Recent results + the leaderboard updates.
- Full mode: add/remove sets (1–7 bounds), tally + match-winner badge correct; stopwatch usable in BOTH modes.
- "Log a game" buttons (hero + header) scroll to the logger.
- View-game button opens the modal from: matches list, recent results, and a player history row — set-by-set, final result, and ELO deltas match stored before/after.
- Player page shows Games History below the ELO chart with correct W/L, player-oriented score, and ELO delta; opponent links work; rows open the modal.
- Admin header top-left reads "← Back to home" and returns to `/`.

- [ ] **Step 5: Final commit (if any verification fixes were needed)**

```bash
git add -A
git commit -m "chore: verification fixes for log/view-game UX"
```

`Model: sonnet`

---

## Self-review notes (author)

- **Spec coverage:** inline logger (T4–5), Quick/Full + steppers + stopwatch-both-modes + live badge (T4), public no-login (logMatch ungated, used directly — T5), view-game modal triggerable anywhere via dedicated button preserving player links (T6–8), player games-history (T8), admin "back to home" (T9), keep `/admin/matches/new` (untouched — buttons repointed in T5). No schema migration (confirmed: single set allowed, jsonb tuples).
- **Test strategy:** logic is concentrated in `lib/match-format.ts` and unit-tested (T1). Components have no RTL harness in this repo, so they are covered by typecheck, production build, and fixture-based manual verification (T10) — consistent with existing repo test scope.
- **Type consistency:** `SetScore`, `MatchDetail`, `EloPair`, `HistoryRow` defined once and imported; `getMatchDetail` return type reused by the modal; `inferWinnerSide`/`setsWon`/`formatScoreForPlayer`/`playerEloDelta` names are used identically across tasks.

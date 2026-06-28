# Flip-pad Logger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the match logger's Quick/Full toggle + stepper inputs with a single table-tennis-style flip-pad scoreboard, and tighten the surrounding block.

**Architecture:** Pure scoring logic lives in a new, TDD'd `lib/flip-pad.ts`. The UI is a small family of focused client components under `components/flip-pad/`, orchestrated by a rewritten `components/match-log-form.tsx`. The server action and its Zod schema are unchanged — the form still submits `set_<i>_a/b`, `playerAId/playerBId`, `durationSeconds`, `playedAt` via hidden inputs.

**Tech Stack:** Next.js (React client components), TypeScript, Tailwind v4 (CSS-var theme), Vitest, lucide-react icons.

---

## File Structure

- Create `lib/flip-pad.ts` — pure logic: types + game/tally/winner derivation, win-under-target + game-point detection, bank/cap guards, edit-mode split. Reuses `setsWon`/`inferWinnerSide` from `lib/match-format.ts`.
- Create `tests/flip-pad.test.ts` — Vitest unit tests for the above.
- Create `components/flip-pad/flip-card.tsx` — one player's card; three tap-regions (+1 / type / −1).
- Create `components/flip-pad/player-label-select.tsx` — gold first-name picker (transparent native `<select>` overlay).
- Create `components/flip-pad/flip-pad.tsx` — the stand: two cards + labels + tally + editable target.
- Create `components/flip-pad/games-strip.tsx` — completed-game chips (inline-editable) + "+ next game".
- Create `components/flip-pad/duration-pill.tsx` — condensed timer (start/pause + type mm:ss).
- Create `components/flip-pad/played-at-line.tsx` — collapsed date line expanding to `datetime-local`.
- Modify `components/match-log-form.tsx` — new state model + composition (full rewrite).
- Modify `app/globals.css` — `flip-card` keyframes + `.flip-card-anim` class + reduced-motion entry.

**Not touched:** `components/stepper.tsx`, `components/match-stopwatch.tsx` (still used by `elo-calculator`, `seeder-queue`), `components/log-game-expander.tsx`, `app/actions/matches.ts`, `lib/match-format.ts`.

---

### Task 1: Pure scoring logic (`lib/flip-pad.ts`)

**Files:**
- Create: `lib/flip-pad.ts`
- Test: `tests/flip-pad.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/flip-pad.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  currentAsGame, allGames, tally, matchWinner,
  gameWonBy, gamePoint, canBank, canAddGame, splitForEdit,
  MAX_GAMES,
} from '@/lib/flip-pad'

describe('currentAsGame', () => {
  it('both filled, not tied → the pair', () => {
    expect(currentAsGame([11, 9])).toEqual([11, 9])
  })
  it('an empty card → null', () => {
    expect(currentAsGame([11, null])).toBeNull()
    expect(currentAsGame([null, null])).toBeNull()
  })
  it('a tie → null (a game cannot end level)', () => {
    expect(currentAsGame([10, 10])).toBeNull()
  })
})

describe('allGames', () => {
  it('appends the current game when complete', () => {
    expect(allGames([[11, 7]], [9, 11])).toEqual([[11, 7], [9, 11]])
  })
  it('omits an incomplete current game', () => {
    expect(allGames([[11, 7]], [5, null])).toEqual([[11, 7]])
  })
})

describe('tally / matchWinner', () => {
  it('counts games won across banked + current', () => {
    expect(tally([[11, 7], [8, 11]], [11, 9])).toEqual({ a: 2, b: 1 })
  })
  it('winner is whoever leads on games; level → null', () => {
    expect(matchWinner([[11, 7]], [9, 11])).toBeNull()
    expect(matchWinner([[11, 7], [11, 5]], [null, null])).toBe('A')
  })
})

describe('gameWonBy (default 11, win by 2)', () => {
  it('11–9 → A', () => expect(gameWonBy([11, 9])).toBe('A'))
  it('9–11 → B', () => expect(gameWonBy([9, 11])).toBe('B'))
  it('11–10 → null (deuce continues)', () => expect(gameWonBy([11, 10])).toBeNull())
  it('13–11 → A', () => expect(gameWonBy([13, 11])).toBe('A'))
  it('respects a custom target', () => expect(gameWonBy([21, 19], 21)).toBe('A'))
})

describe('gamePoint', () => {
  it('10–9 → A on game point', () => expect(gamePoint([10, 9])).toEqual({ a: true, b: false }))
  it('10–10 → neither (deuce)', () => expect(gamePoint([10, 10])).toEqual({ a: false, b: false }))
  it('11–10 → A on game point', () => expect(gamePoint([11, 10])).toEqual({ a: true, b: false }))
  it('empty cards → neither', () => expect(gamePoint([null, null])).toEqual({ a: false, b: false }))
})

describe('canBank / canAddGame', () => {
  it('bankable only when both filled and not tied', () => {
    expect(canBank([11, 9])).toBe(true)
    expect(canBank([5, null])).toBe(false)
    expect(canBank([7, 7])).toBe(false)
  })
  it('can add a game until one short of the cap', () => {
    expect(canAddGame([])).toBe(true)
    expect(canAddGame(new Array(MAX_GAMES - 2).fill([11, 0]))).toBe(true)
    expect(canAddGame(new Array(MAX_GAMES - 1).fill([11, 0]))).toBe(false)
  })
})

describe('splitForEdit', () => {
  it('single game → live on the pad, nothing banked', () => {
    expect(splitForEdit([[11, 9]])).toEqual({ banked: [], current: [11, 9] })
  })
  it('multi game → last is live, rest banked', () => {
    expect(splitForEdit([[11, 9], [9, 11], [11, 7]]))
      .toEqual({ banked: [[11, 9], [9, 11]], current: [11, 7] })
  })
  it('empty → blank pad', () => {
    expect(splitForEdit([])).toEqual({ banked: [], current: [null, null] })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/flip-pad.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/flip-pad"`.

- [ ] **Step 3: Implement `lib/flip-pad.ts`**

Create `lib/flip-pad.ts`:

```ts
import { setsWon, inferWinnerSide, type SetScore } from '@/lib/match-format'

export type PadScore = number | null
export type LiveGame = [PadScore, PadScore]
export type BankedGame = [number, number]

export const MAX_GAMES = 7
export const DEFAULT_TARGET = 11
export const WIN_BY = 2

/** The current game contributes a completed pair only when both cards are filled and it isn't a tie. */
export function currentAsGame(current: LiveGame): BankedGame | null {
  const [a, b] = current
  if (a === null || b === null) return null
  if (a === b) return null
  return [a, b]
}

/** All games for derivation/submit: banked plus the current game when complete. */
export function allGames(banked: BankedGame[], current: LiveGame): BankedGame[] {
  const c = currentAsGame(current)
  return c ? [...banked, c] : [...banked]
}

/** Games-won tally over banked + current. */
export function tally(banked: BankedGame[], current: LiveGame): { a: number; b: number } {
  return setsWon(allGames(banked, current) as SetScore[])
}

/** Match winner side over banked + current, or null when tied/empty. */
export function matchWinner(banked: BankedGame[], current: LiveGame): 'A' | 'B' | null {
  return inferWinnerSide(allGames(banked, current) as SetScore[])
}

/** Has a single game been won under the target (reach target, lead >= winBy)? */
export function gameWonBy(game: BankedGame, target = DEFAULT_TARGET, winBy = WIN_BY): 'A' | 'B' | null {
  const [a, b] = game
  if (a >= target && a - b >= winBy) return 'A'
  if (b >= target && b - a >= winBy) return 'B'
  return null
}

/** Is a side one point from winning the current game under the target? */
export function gamePoint(current: LiveGame, target = DEFAULT_TARGET, winBy = WIN_BY): { a: boolean; b: boolean } {
  const a = current[0] ?? 0
  const b = current[1] ?? 0
  const onePointWins = (x: number, y: number) => x + 1 >= target && (x + 1) - y >= winBy
  return { a: onePointWins(a, b), b: onePointWins(b, a) }
}

/** Bankable when both cards are filled and it isn't a tie. */
export function canBank(current: LiveGame): boolean {
  return currentAsGame(current) !== null
}

/** Another game can be started only while we stay within MAX_GAMES total (banked + the new current). */
export function canAddGame(banked: BankedGame[]): boolean {
  return banked.length < MAX_GAMES - 1
}

/** Split a saved match for editing: the last game is live on the pad, the rest are banked. */
export function splitForEdit(sets: BankedGame[]): { banked: BankedGame[]; current: LiveGame } {
  if (sets.length <= 1) {
    return { banked: [], current: (sets[0] ?? [null, null]) as LiveGame }
  }
  return { banked: sets.slice(0, -1), current: sets[sets.length - 1] as LiveGame }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/flip-pad.test.ts`
Expected: PASS (all cases green).

- [ ] **Step 5: Commit**

```bash
git add lib/flip-pad.ts tests/flip-pad.test.ts
git commit -m "feat: flip-pad scoring logic"
```

---

### Task 2: FlipCard component

**Files:**
- Create: `components/flip-pad/flip-card.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Add the flip animation to `app/globals.css`**

Append after the `.rally-*` declarations (around line 235), matching the file's existing keyframe convention:

```css
@keyframes flip-card {
  0%   { transform: rotateX(-88deg); opacity: 0; }
  60%  { opacity: 1; }
  100% { transform: rotateX(0deg); opacity: 1; }
}

.flip-card-anim {
  animation: flip-card 200ms cubic-bezier(0.2, 0.7, 0.3, 1);
  transform-origin: top center;
  backface-visibility: hidden;
}
```

Then add `.flip-card-anim` to the existing reduced-motion block so it reads:

```css
@media (prefers-reduced-motion: reduce) {
  .rally-ball-x, .rally-ball-y, .rally-ball-squash, .rally-paddle-l, .rally-paddle-r, .rally-trail, .flip-card-anim {
    animation: none;
  }
}
```

- [ ] **Step 2: Implement `flip-card.tsx`**

The card is `grid-rows-[1fr_auto_1fr]`: a **+1** button on top, the digit in the middle, a **−1** button on the bottom. The faint +/− cues fade out once the score reaches 2; leader/game-point styling is computed (no conflicting class order). The digit is shown as a visible `<span>` (carries the dashed "editable" underline + the `flip-card-anim` flip) with a **transparent `<input>` overlaid** for typing/keypad. A `flip` nonce, bumped **only on +/− steps**, is the span's `key` — so each step remounts the span and replays the flip, while typing updates it in place with no flip. Reduced-motion users get no animation (Step 1).

```tsx
'use client'

import { useState } from 'react'

export function FlipCard({
  value,
  name,
  lead,
  gamePoint,
  onChange,
}: {
  value: number | null
  name: string
  lead: boolean
  gamePoint: boolean
  onChange: (v: number | null) => void
}) {
  const v = value ?? 0
  const clamp = (n: number) => Math.max(0, Math.min(99, n))
  // Bumped only on +/− steps, so the flip plays on live scoring but not while typing.
  const [flip, setFlip] = useState(0)
  const step = (delta: number) => {
    onChange(clamp(v + delta))
    setFlip((f) => f + 1)
  }
  const cuesHidden = (value ?? 0) >= 2
  const bg = lead ? 'bg-[#fffaf0]' : 'bg-[#fdf6e3]'
  const shadow = lead
    ? 'shadow-[0_3px_10px_rgba(231,200,106,0.5),inset_0_-6px_0_rgba(0,0,0,0.06)]'
    : 'shadow-[0_3px_6px_rgba(0,0,0,0.35),inset_0_-6px_0_rgba(0,0,0,0.06)]'

  return (
    <div
      className={`relative grid h-[90px] w-[70px] grid-rows-[1fr_auto_1fr] overflow-hidden rounded-[6px_6px_9px_9px] sm:h-[94px] sm:w-[78px] ${bg} ${shadow} ${gamePoint ? 'ring-2 ring-[#e0a92a]' : ''}`}
    >
      <button
        type="button"
        aria-label={`add point ${name}`}
        onClick={() => step(1)}
        className={`flex items-start justify-center pt-1 text-sm font-bold text-[#2960c5]/45 transition-opacity ${cuesHidden ? 'opacity-0' : 'opacity-100'}`}
      >
        +
      </button>

      <div className="relative grid place-items-center">
        {/* Visible digit: remounts on each step (key={flip}) to replay the flip; updates in place while typing. */}
        <span
          key={flip}
          aria-hidden
          className={`flip-card-anim pointer-events-none font-mono nums text-[36px] font-bold leading-none underline decoration-dashed decoration-[#2960c5]/50 underline-offset-4 sm:text-[40px] ${
            value === null ? 'text-[#1b1d22]/30' : 'text-[#1b1d22]'
          }`}
        >
          {value ?? 0}
        </span>
        {/* Transparent input over the digit: owns typing + the keypad; the span renders the value. */}
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={99}
          aria-label={`${name} score`}
          value={value ?? ''}
          onChange={(e) => {
            const raw = e.target.value
            onChange(raw === '' ? null : clamp(Number(raw)))
          }}
          className="absolute inset-0 h-full w-full bg-transparent text-center font-mono text-[36px] font-bold leading-none text-transparent caret-[#1b1d22] focus:outline-none sm:text-[40px] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
      </div>

      <button
        type="button"
        aria-label={`remove point ${name}`}
        onClick={() => step(-1)}
        className={`flex items-end justify-center pb-1 text-sm font-bold text-black/30 transition-opacity ${cuesHidden ? 'opacity-0' : 'opacity-100'}`}
      >
        −
      </button>

      <span className="pointer-events-none absolute inset-x-0 top-1/2 z-10 h-[2px] bg-black/15" aria-hidden />
    </div>
  )
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors referencing `flip-card.tsx`.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css components/flip-pad/flip-card.tsx
git commit -m "feat: flip-card with single-axis flip animation"
```

---

### Task 3: PlayerLabelSelect component

**Files:**
- Create: `components/flip-pad/player-label-select.tsx`

- [ ] **Step 1: Implement `player-label-select.tsx`**

Shows the selected player's **first name** in gold; a transparent native `<select>` overlays the whole label so a tap opens the platform picker (full names shown there). Excludes the opponent, but always keeps the current value selectable.

```tsx
'use client'

type PlayerOption = { id: string; name: string; nickname: string | null; currentElo: number }

export function PlayerLabelSelect({
  players,
  value,
  exclude,
  onChange,
}: {
  players: PlayerOption[]
  value: string
  exclude?: string
  onChange: (id: string) => void
}) {
  const opts = players.filter((p) => p.id !== exclude || p.id === value)
  const selected = players.find((p) => p.id === value)
  const first = selected ? selected.name.split(' ')[0] : 'Pick'

  return (
    <div className="relative inline-flex max-w-[92px] items-center gap-1 text-[#e7c86a]">
      <span className="truncate text-xs font-bold uppercase tracking-wide">{first}</span>
      <span aria-hidden className="text-[8px] opacity-70">▼</span>
      <select
        aria-label="select player"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        <option value="">—</option>
        {opts.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} ({p.currentElo})
          </option>
        ))}
      </select>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors referencing `player-label-select.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/flip-pad/player-label-select.tsx
git commit -m "feat: gold first-name player picker"
```

---

### Task 4: FlipPad stand component

**Files:**
- Create: `components/flip-pad/flip-pad.tsx`

- [ ] **Step 1: Implement `flip-pad.tsx`**

Composes the dark stand: label + card per side, with the games tally and an editable target in the middle. Leader/game-point flags come from `lib/flip-pad`.

```tsx
'use client'

import { FlipCard } from './flip-card'
import { PlayerLabelSelect } from './player-label-select'
import { gamePoint as calcGamePoint, type LiveGame } from '@/lib/flip-pad'

type PlayerOption = { id: string; name: string; nickname: string | null; currentElo: number }

function firstNameFor(players: PlayerOption[], id: string, fallback: string) {
  const p = players.find((x) => x.id === id)
  return p ? p.name.split(' ')[0] : fallback
}

function TargetControl({ target, onTarget }: { target: number; onTarget: (n: number) => void }) {
  return (
    <label className="mt-0.5 text-[9px] text-[#9aa3b2]">
      to{' '}
      <select
        aria-label="points per game"
        value={target}
        onChange={(e) => onTarget(Number(e.target.value))}
        className="cursor-pointer bg-transparent text-[#cfd2d8] underline decoration-dotted focus:outline-none"
      >
        {[7, 11, 15, 21].map((n) => (
          <option key={n} value={n} className="text-black">
            {n}
          </option>
        ))}
      </select>
    </label>
  )
}

export function FlipPad({
  players,
  aId,
  bId,
  onA,
  onB,
  current,
  onCurrent,
  tallyA,
  tallyB,
  target,
  onTarget,
}: {
  players: PlayerOption[]
  aId: string
  bId: string
  onA: (id: string) => void
  onB: (id: string) => void
  current: LiveGame
  onCurrent: (g: LiveGame) => void
  tallyA: number
  tallyB: number
  target: number
  onTarget: (n: number) => void
}) {
  const [a, b] = current
  const leadA = a !== null && (b === null || a > b)
  const leadB = b !== null && (a === null || b > a)
  const gp = calcGamePoint(current, target)

  return (
    <div className="flex items-end justify-center gap-3 rounded-[13px] bg-linear-to-b from-[#2a2d33] to-[#1b1d22] p-3 shadow-[0_5px_12px_rgba(0,0,0,0.22)]">
      <div className="flex min-w-0 flex-col items-center gap-1.5">
        <PlayerLabelSelect players={players} value={aId} exclude={bId} onChange={onA} />
        <FlipCard
          value={a}
          name={firstNameFor(players, aId, 'Player A')}
          lead={leadA}
          gamePoint={gp.a}
          onChange={(v) => onCurrent([v, current[1]])}
        />
      </div>

      <div className="flex flex-col items-center gap-0.5 pb-1.5 text-center text-[9px] uppercase tracking-wider text-[#cfd2d8]">
        <span>Games</span>
        <span className="font-mono nums text-[22px] font-bold leading-none text-white">
          {tallyA}–{tallyB}
        </span>
        <TargetControl target={target} onTarget={onTarget} />
      </div>

      <div className="flex min-w-0 flex-col items-center gap-1.5">
        <PlayerLabelSelect players={players} value={bId} exclude={aId} onChange={onB} />
        <FlipCard
          value={b}
          name={firstNameFor(players, bId, 'Player B')}
          lead={leadB}
          gamePoint={gp.b}
          onChange={(v) => onCurrent([current[0], v])}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors referencing `flip-pad.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/flip-pad/flip-pad.tsx
git commit -m "feat: flip-pad stand with tally and target"
```

---

### Task 5: GamesStrip component

**Files:**
- Create: `components/flip-pad/games-strip.tsx`

- [ ] **Step 1: Implement `games-strip.tsx`**

Renders one chip per banked game (winning side's number tinted blue), each tappable to edit inline (two small numeric inputs + remove), then the "+ next game" button — solid blue when the current game is bankable and under the cap, dashed otherwise.

```tsx
'use client'

import { useState } from 'react'
import { gameWonBy, type BankedGame } from '@/lib/flip-pad'

function Chip({
  game,
  target,
  onEdit,
  onRemove,
}: {
  game: BankedGame
  target: number
  onEdit: (g: BankedGame) => void
  onRemove: () => void
}) {
  const [editing, setEditing] = useState(false)
  const won = gameWonBy(game, target)
  const clamp = (n: number) => Math.max(0, Math.min(99, n))

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border-2 border-[#e7c86a] bg-card px-2 py-1 font-mono nums text-sm font-bold">
        <input
          type="number"
          aria-label="game score left"
          value={game[0]}
          onChange={(e) => onEdit([clamp(Number(e.target.value || 0)), game[1]])}
          className="w-8 bg-transparent text-center focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span className="text-muted-foreground">–</span>
        <input
          type="number"
          aria-label="game score right"
          value={game[1]}
          onChange={(e) => onEdit([game[0], clamp(Number(e.target.value || 0))])}
          className="w-8 bg-transparent text-center focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button type="button" aria-label="done editing game" onClick={() => setEditing(false)} className="px-1 text-primary">
          ✓
        </button>
        <button type="button" aria-label="remove game" onClick={onRemove} className="px-1 text-muted-foreground hover:text-loss">
          ×
        </button>
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="rounded-md border border-input bg-secondary/60 px-2.5 py-1 font-mono nums text-sm font-bold"
    >
      <span className={won === 'A' ? 'text-primary' : ''}>{game[0]}</span>
      <span className="text-muted-foreground">–</span>
      <span className={won === 'B' ? 'text-primary' : ''}>{game[1]}</span>
    </button>
  )
}

export function GamesStrip({
  banked,
  canBank,
  canAdd,
  target,
  onBank,
  onEditChip,
  onRemoveChip,
}: {
  banked: BankedGame[]
  canBank: boolean
  canAdd: boolean
  target: number
  onBank: () => void
  onEditChip: (index: number, game: BankedGame) => void
  onRemoveChip: (index: number) => void
}) {
  const ready = canBank && canAdd
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {banked.map((g, i) => (
        <Chip key={i} game={g} target={target} onEdit={(ng) => onEditChip(i, ng)} onRemove={() => onRemoveChip(i)} />
      ))}
      <button
        type="button"
        onClick={onBank}
        disabled={!ready}
        className={`rounded-md px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wide transition-colors ${
          ready
            ? 'border-2 border-primary bg-primary text-primary-foreground'
            : 'border-2 border-dashed border-input text-muted-foreground'
        }`}
      >
        + next game
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors referencing `games-strip.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/flip-pad/games-strip.tsx
git commit -m "feat: banked-games strip with inline edit"
```

---

### Task 6: DurationPill component

**Files:**
- Create: `components/flip-pad/duration-pill.tsx`

- [ ] **Step 1: Implement `duration-pill.tsx`**

One pill: a play/pause button plus a typeable `mm:ss` field. The interval logic mirrors `MatchStopwatch` (stamp start on first run; can't read the clock during render). Focusing the field pauses the clock. Digit-parsing reads the entry from the right as `mm:ss` (Android keypads lack a colon).

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Play, Pause } from 'lucide-react'
import { formatDuration } from '@/lib/stats'

export function DurationPill({ value, onChange }: { value: number; onChange: (seconds: number) => void }) {
  const [running, setRunning] = useState(false)
  const startedAt = useRef<number | null>(null)
  const baseSeconds = useRef(value)

  useEffect(() => {
    if (!running) return
    startedAt.current ??= Date.now()
    const id = setInterval(() => {
      onChange(baseSeconds.current + Math.floor((Date.now() - (startedAt.current ?? Date.now())) / 1000))
    }, 250)
    return () => clearInterval(id)
  }, [running, onChange])

  function toggle() {
    if (running) {
      setRunning(false)
    } else {
      baseSeconds.current = value
      startedAt.current = Date.now()
      setRunning(true)
    }
  }

  function onText(text: string) {
    const digits = text.replace(/\D/g, '').replace(/^0+/, '').slice(0, 6)
    if (digits === '') return onChange(0)
    const n = parseInt(digits, 10)
    onChange(Math.floor(n / 100) * 60 + (n % 100))
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-md border border-input bg-card px-2 py-1.5">
      <button
        type="button"
        onClick={toggle}
        aria-label={running ? 'pause timer' : 'start timer'}
        className="grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground"
      >
        {running ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
      </button>
      <input
        value={formatDuration(value)}
        onFocus={() => setRunning(false)}
        onChange={(e) => onText(e.target.value)}
        inputMode="numeric"
        aria-label="match duration mm:ss"
        className="w-12 bg-transparent font-mono nums text-sm font-bold focus:outline-none"
      />
    </span>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors referencing `duration-pill.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/flip-pad/duration-pill.tsx
git commit -m "feat: condensed duration pill"
```

---

### Task 7: PlayedAtLine component

**Files:**
- Create: `components/flip-pad/played-at-line.tsx`

- [ ] **Step 1: Implement `played-at-line.tsx`**

A compact trigger showing the wall-clock value as "Today 2:45pm" / "28 Jun 2:45pm". The real `datetime-local` input (`name="playedAt"`) is always in the DOM so it submits; it's hidden until the trigger is tapped (a `display:none` input still posts its value). `value` is the wall-clock string produced by `instantToWallClock` (`YYYY-MM-DDTHH:mm`), so it can be parsed locally without timezone work.

```tsx
'use client'

import { useState } from 'react'
import { Calendar } from 'lucide-react'

function labelFor(value: string): string {
  if (!value) return 'Set time'
  const [date, time] = value.split('T')
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = (time ?? '00:00').split(':').map(Number)
  const at = new Date(y, m - 1, d, hh, mm)
  const today = new Date()
  const sameDay =
    at.getFullYear() === today.getFullYear() &&
    at.getMonth() === today.getMonth() &&
    at.getDate() === today.getDate()
  const h12 = ((hh + 11) % 12) + 1
  const ampm = hh < 12 ? 'am' : 'pm'
  const clock = `${h12}:${String(mm).padStart(2, '0')}${ampm}`
  if (sameDay) return `Today ${clock}`
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${d} ${months[m - 1]} ${clock}`
}

export function PlayedAtLine({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative text-right">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground"
      >
        <Calendar className="h-3.5 w-3.5" />
        <span className="border-b border-dashed border-input text-secondary-foreground">{labelFor(value)}</span>
      </button>
      <input
        type="datetime-local"
        name="playedAt"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${open ? 'block' : 'hidden'} mt-1 rounded-md border border-input bg-card px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring`}
      />
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors referencing `played-at-line.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/flip-pad/played-at-line.tsx
git commit -m "feat: collapsible played-at line"
```

---

### Task 8: Rewrite `match-log-form.tsx`

**Files:**
- Modify (full replace): `components/match-log-form.tsx`

- [ ] **Step 1: Replace the file contents**

New state model: `{ banked, current, target, aId, bId, duration, playedAt }`. Scores/players/duration/date are submitted via hidden inputs so the existing `handle(formData)` + server action are unchanged. Edit mode seeds from `splitForEdit`. Save is disabled until both players and at least one game exist, and carries the live result as a suffix.

```tsx
'use client'

import { useState, useEffect, useRef, Fragment } from 'react'
import { logMatch, editMatch } from '@/app/actions/matches'
import { LoadingOverlay } from '@/components/loading-overlay'
import { RaceResult } from '@/components/race-result'
import { FlipPad } from '@/components/flip-pad/flip-pad'
import { GamesStrip } from '@/components/flip-pad/games-strip'
import { DurationPill } from '@/components/flip-pad/duration-pill'
import { PlayedAtLine } from '@/components/flip-pad/played-at-line'
import {
  splitForEdit,
  allGames,
  tally,
  matchWinner,
  canBank,
  canAddGame,
  type BankedGame,
  type LiveGame,
} from '@/lib/flip-pad'
import type { LogResult } from '@/app/actions/matches'
import { instantToWallClock } from '@/lib/tz'

type PlayerOption = { id: string; name: string; nickname: string | null; currentElo: number }

export type MatchFormInitial = {
  id: string
  playerAId: string
  playerBId: string
  sets: Array<[number, number]>
  playedAt: Date | null
  durationSeconds: number | null
}

export function MatchLogForm({
  players,
  initial,
  onSuccess,
}: {
  players: PlayerOption[]
  initial?: MatchFormInitial
  onSuccess?: () => void
}) {
  const isEdit = !!initial
  const editSplit = initial ? splitForEdit(initial.sets) : null

  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [savedTick, setSavedTick] = useState(0)
  const [result, setResult] = useState<LogResult | null>(null)
  const [duration, setDuration] = useState<number>(initial?.durationSeconds ?? 0)
  const [playedAt, setPlayedAt] = useState<string>(initial?.playedAt ? instantToWallClock(initial.playedAt) : '')

  const [banked, setBanked] = useState<BankedGame[]>(editSplit?.banked ?? [])
  const [current, setCurrent] = useState<LiveGame>(editSplit?.current ?? [null, null])
  const [target, setTarget] = useState<number>(11)
  const [aId, setAId] = useState(initial?.playerAId ?? '')
  const [bId, setBId] = useState(initial?.playerBId ?? '')
  const submitting = useRef(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!isEdit && playedAt === '') setPlayedAt(instantToWallClock(new Date()))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const games = allGames(banked, current)
  const t = tally(banked, current)
  const winnerSide = matchWinner(banked, current)
  const firstNameFor = (id: string) => (players.find((p) => p.id === id)?.name ?? 'Player').split(' ')[0]

  const resultSuffix = (() => {
    if (games.length === 0) return ''
    if (winnerSide === null) return `· ${t.a}–${t.b}, tied`
    const who = winnerSide === 'A' ? firstNameFor(aId) : firstNameFor(bId)
    return `· ${who} ${Math.max(t.a, t.b)}–${Math.min(t.a, t.b)}`
  })()

  function bankGame() {
    if (!canBank(current) || !canAddGame(banked)) return
    setBanked((b) => [...b, current as BankedGame])
    setCurrent([null, null])
  }

  async function handle(formData: FormData) {
    if (submitting.current) return
    submitting.current = true
    setError(null)
    setPending(true)
    try {
      const r = isEdit ? await editMatch(initial!.id, formData) : await logMatch(formData)
      if (r && 'error' in r) {
        setError(r.error ?? null)
        return
      }
      if (onSuccess) onSuccess()
      if (!isEdit) {
        if (r && 'result' in r && (r as { result?: LogResult }).result) setResult((r as { result: LogResult }).result)
        setSavedTick((s) => s + 1)
        setDuration(0)
        setPlayedAt(instantToWallClock(new Date()))
        setBanked([])
        setCurrent([null, null])
        setTarget(11)
        setAId('')
        setBId('')
      }
    } finally {
      setPending(false)
      submitting.current = false
    }
  }

  if (!isEdit && result) {
    return (
      <RaceResult
        result={result}
        onLogAnother={() => {
          setResult(null)
          setSavedTick((s) => s + 1)
        }}
      />
    )
  }

  const canSave = !pending && !!aId && !!bId && games.length > 0

  return (
    <form key={savedTick} action={handle} className="space-y-4">
      <LoadingOverlay open={pending} label="Saving match…" />

      <FlipPad
        players={players}
        aId={aId}
        bId={bId}
        onA={setAId}
        onB={setBId}
        current={current}
        onCurrent={setCurrent}
        tallyA={t.a}
        tallyB={t.b}
        target={target}
        onTarget={setTarget}
      />

      <GamesStrip
        banked={banked}
        canBank={canBank(current)}
        canAdd={canAddGame(banked)}
        target={target}
        onBank={bankGame}
        onEditChip={(i, g) => setBanked((b) => b.map((x, idx) => (idx === i ? g : x)))}
        onRemoveChip={(i) => setBanked((b) => b.filter((_, idx) => idx !== i))}
      />

      {/* Hidden fields carry the pad state into the existing server action. */}
      {games.map((g, i) => (
        <Fragment key={i}>
          <input type="hidden" name={`set_${i}_a`} value={g[0]} readOnly />
          <input type="hidden" name={`set_${i}_b`} value={g[1]} readOnly />
        </Fragment>
      ))}
      <input type="hidden" name="playerAId" value={aId} readOnly />
      <input type="hidden" name="playerBId" value={bId} readOnly />
      <input type="hidden" name="durationSeconds" value={duration || ''} readOnly />

      <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
        <DurationPill value={duration} onChange={setDuration} />
        <PlayedAtLine value={playedAt} onChange={setPlayedAt} />
      </div>

      {error && <div className="text-sm text-loss">{error}</div>}
      {!isEdit && savedTick > 0 && !error && (
        <div className="text-sm text-gain">Match saved. Log another below.</div>
      )}

      <button
        type="submit"
        disabled={!canSave}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending && (
          <span
            className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground"
            aria-hidden
          />
        )}
        {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Save match'}
        {resultSuffix && <span className="font-normal opacity-85">{resultSuffix}</span>}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npx next lint --file components/match-log-form.tsx`
Expected: no errors. (If `next lint` is unavailable, run `npx eslint components/match-log-form.tsx`.)

- [ ] **Step 3: Commit**

```bash
git add components/match-log-form.tsx
git commit -m "feat: rebuild logger around the flip-pad"
```

---

### Task 9: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the test suite**

Run: `npm run test`
Expected: PASS, including `tests/flip-pad.test.ts`.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: build succeeds with no type/lint errors.

- [ ] **Step 3: Manual verification (dev server)**

Run: `npm run dev`, open the homepage logger, and confirm:
- Pick two players via the gold labels (first name shows; opponent is excluded from the other list).
- Tap **above** a digit → +1; **below** → −1; tap the **digit** → keypad to type. +/− cues fade once a score hits 2.
- Tapping +/− **flips** the digit (single-axis); typing updates it without a flip; reduced-motion users see no flip.
- Leader card lifts/glows; at 10–9 the leader shows the gold game-point ring; "+ next game" turns solid blue.
- Tap "+ next game": current game banks to a chip, tally ticks, cards reset. Tap a chip → edit/remove inline.
- Add up to 7 games total; "+ next game" disables at the cap.
- Timer pill starts/pauses; typing in it pauses the clock and accepts `mm:ss`.
- Played-at shows "Today h:mmam/pm"; tapping reveals the datetime input.
- Save shows the live result suffix and is disabled until both players + ≥1 game are set.
- Save a quick (single-game) match → `RaceResult` reveal plays; form resets.
- From the admin edit screen, open an existing multi-game match → last game is live on the pad, earlier games are chips; "Save changes" persists edits.

- [ ] **Step 4: Commit any fixes from manual testing**

```bash
git add -A
git commit -m "fix: flip-pad logger manual-test adjustments"
```

(Skip if no fixes were needed.)

---

## Self-Review

**Spec coverage:**
- Tournament-pad visuals (dark stand, cream cards, gold labels) → Tasks 2, 4. ✓
- One emergent pad, no toggle (quick = one game; full = bank games) → Tasks 5, 8. ✓
- Per-card +1/−1/type gesture, fading cues → Task 2. ✓
- Default-to-11 smarts (game point, win glow, editable target, never blocks) → Tasks 1, 4, 5. ✓
- Games tally + chips (inline-editable), 7-game cap → Tasks 1, 4, 5. ✓
- Players fold into labels (first name) → Task 3. ✓
- Duration → one pill; played-at → one line → Tasks 6, 7. ✓
- Save carries result → Task 8. ✓
- Responsive (mobile/desktop reflow, larger cards on `sm`) → Tasks 2, 4. ✓
- Split-flap flip animation per card, reduced-motion safe, only on +/− steps → Task 2 (globals keyframes + span `key={flip}` nonce). ✓
- Edit mode (last game live, rest banked) → Tasks 1, 8. ✓
- Unchanged FormData contract / server action → Task 8 (hidden inputs). ✓

**Placeholder scan:** No TBD/TODO; every code step is complete. ✓

**Type consistency:** `BankedGame`/`LiveGame`/`PadScore` from `lib/flip-pad` used consistently; `FlipPad` props (`onA/onB/onCurrent/onTarget/tallyA/tallyB`) match the call site in Task 8; `GamesStrip` props (`canBank/canAdd/onBank/onEditChip/onRemoveChip`) match Task 8; `FlipCard` props (`value/name/lead/gamePoint/onChange`) match Task 4. ✓

## Notes / decisions

- The leader/tie tint for the live game is computed in `FlipPad` (not in `lib/flip-pad`) since it's view-only; match-level winner/tally use the tested `lib/flip-pad` helpers.
- Banking is blocked on a tie (`canBank` requires non-equal scores) so the strip never holds a meaningless level game.
- The **flip animation** is a single-axis `rotateX` from the top edge (Task 1/2): a tasteful one-flap motion rather than a full two-panel split-flap, which keeps the typeable `<input>` intact. It fires only on +/− steps (via the span's `key={flip}` nonce), never while typing, and is disabled under `prefers-reduced-motion`. A true two-panel split-flap could replace it later inside `FlipCard` without touching any interface.

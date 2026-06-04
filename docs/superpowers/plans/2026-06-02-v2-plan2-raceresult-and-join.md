# v2 — Plan 2: Logging Payoff (RaceResult) + Join Glow-up

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make logging a game *rewarding* (a "RaceResult" reveal: lights-out → tachometer needle sweep → ΔELO count-up → rank change) and make joining attractive (a "you're on the grid" welcome + characterful empty states). Kills the two leaks: *play-but-don't-log* and *never-join*.

**Architecture:** `logMatch` returns a result payload (player names, ELO before/after, rank before/after). A reusable `AnimatedDial` tweens an ELO value into the existing `SpeedoGauge` (needle + number animate, reduced-motion safe). `RaceResult` composes two dials + a lights-out intro + deltas + rank change; it's shown by `MatchLogForm` after a successful log and (a lighter variant) inside the view-game modal. Join glow-up = a one-time welcome banner via a `?welcome=1` redirect param + warmer empty-state copy.

**Tech Stack:** Next.js 16 (server actions, async `searchParams`), React 19, framer-motion (installed; `components/motion/delta-counter.tsx` reused), Tailwind v4, Vitest (pure-logic only; visual verified via build + preview screenshots).

**Spec:** `docs/design/2026-06-02-v2.0-design-uplift.md` (Pillars 2 + 5).

---

## Project conventions (READ FIRST)
- **GIT: do NOT run `git add`/`commit`/`push`.** Leave changes in the working tree; Mahir commits. Each task ends in a **verification** step.
- **Subagent models:** sonnet by default; haiku only where marked.
- **Next 16:** `searchParams` and `params` are **async** (await them). `cookies()` async. Read `node_modules/next/dist/docs/` before framework-level work.
- **Stale dev types:** if `npx tsc --noEmit` shows errors ONLY in `.next/dev/types/routes.d.ts`, ignore them — the authoritative gate is `npm run build`. If they block, `rm -rf .next` then `npm run build`.
- **Chars:** EN DASH `–` (U+2013) between scores/ELOs; MINUS `−` (U+2212) for negative deltas. Use Write/Edit, not bash heredocs.
- **Reduced motion:** every animation must no-op (jump to final state) under `prefers-reduced-motion: reduce`.
- The repo's ELO is sets-based (`applyGames` in `lib/elo.ts`); `logMatch` already computes and stores `eloABefore/After`, `eloBBefore/After`. This plan does NOT change ELO logic.

## File structure
**Create:**
- `components/animated-dial.tsx` — client; tweens ELO `from`→`to` and renders `SpeedoGauge`.
- `components/race-result.tsx` — client; the reveal (lights-out + two dials + deltas + winner + rank change).
- `tests/stats-engine.rank.test.ts` — test for the new `rankWithin` helper.

**Modify:**
- `lib/stats-engine.ts` — add pure `rankWithin(elos, elo)` helper.
- `app/actions/matches.ts` — `logMatch` returns `{ ok: true, result: LogResult }`; add `LogResult` type + rank computation.
- `components/match-log-form.tsx` — on a successful (non-edit) log, show `RaceResult` with a "Log another" reset.
- `components/match-detail-modal.tsx` — animate the ELO section (AnimatedDial + count-up) on open.
- `app/actions/players.ts` — `createPlayerSelfServe` redirect adds `?welcome=1`.
- `app/(public)/players/[id]/page.tsx` — one-time welcome banner when `?welcome=1`.
- `components/leaderboard.tsx`, `app/(public)/matches/page.tsx`, `app/(public)/players/[id]/page.tsx` — warmer empty-state copy.

---

## Task 1: `rankWithin` helper + `logMatch` returns a result payload

**Files:**
- Modify: `lib/stats-engine.ts` (append), `app/actions/matches.ts`
- Test: `tests/stats-engine.rank.test.ts`

- [ ] **Step 1: Write the failing test** `tests/stats-engine.rank.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { rankWithin } from '@/lib/stats-engine'

describe('rankWithin', () => {
  it('competition rank = count strictly greater + 1', () => {
    const elos = [1300, 1200, 1200, 1100]
    expect(rankWithin(elos, 1300)).toBe(1)
    expect(rankWithin(elos, 1200)).toBe(2) // one player above
    expect(rankWithin(elos, 1100)).toBe(4) // three above
  })
  it('a value above everyone ranks 1', () => {
    expect(rankWithin([1000, 1050], 1400)).toBe(1)
  })
  it('empty pool ranks 1', () => {
    expect(rankWithin([], 1200)).toBe(1)
  })
})
```

- [ ] **Step 2: Run, verify fail** — `npm test -- stats-engine.rank` → FAIL (rankWithin undefined).

- [ ] **Step 3: Append `rankWithin` to `lib/stats-engine.ts`:**

```ts
/** Competition rank of `elo` within a pool: (number of elos strictly greater) + 1. */
export function rankWithin(elos: number[], elo: number): number {
  let above = 0
  for (const e of elos) if (e > elo) above++
  return above + 1
}
```

- [ ] **Step 4: Run, verify pass** — `npm test -- stats-engine.rank` → PASS.

- [ ] **Step 5: Make `logMatch` return a result payload.** In `app/actions/matches.ts`:

Add imports: `import { rankWithin } from '@/lib/stats-engine'`.

Add the type (top-level export):
```ts
export type LogResult = {
  aId: string; aName: string; bId: string; bName: string
  winnerId: string | null
  eloABefore: number; eloAAfter: number; eloBBefore: number; eloBAfter: number
  aRankBefore: number; aRankAfter: number; bRankBefore: number; bRankAfter: number
}
```

In `logMatch`, AFTER the existing `const both = ...` / `a` / `b` lookup and BEFORE the transaction, fetch the active ELO pool for ranking:
```ts
  const activeElos = await db
    .select({ id: players.id, currentElo: players.currentElo })
    .from(players)
    .where(eq(players.active, true))
  const beforePool = activeElos.map((p) => p.currentElo)
  const afterPool = activeElos.map((p) =>
    p.id === a.id ? elo.eloA : p.id === b.id ? elo.eloB : p.currentElo
  )
```
(`eq` is already imported.) Then, replace the final `return { ok: true }` with:
```ts
  const result: LogResult = {
    aId: a.id, aName: a.name, bId: b.id, bName: b.name,
    winnerId,
    eloABefore: a.currentElo, eloAAfter: elo.eloA,
    eloBBefore: b.currentElo, eloBAfter: elo.eloB,
    aRankBefore: rankWithin(beforePool, a.currentElo),
    aRankAfter: rankWithin(afterPool, elo.eloA),
    bRankBefore: rankWithin(beforePool, b.currentElo),
    bRankAfter: rankWithin(afterPool, elo.eloB),
  }
  return { ok: true as const, result }
```
Leave `editMatch` and everything else unchanged. (The `MatchLogForm` already discriminates on `'error' in r`; adding `result` to the success branch is backward-compatible.)

- [ ] **Step 6: Verify** — `npm test` (all pass), `npm run build` (compiles).

- [ ] **Step 7: Verification checkpoint (NO git).**

`Model: sonnet`

---

## Task 2: `AnimatedDial` component

**Files:** Create `components/animated-dial.tsx`. (Presentational/animation; verified via build + screenshot.)

- [ ] **Step 1: Read `components/speedo-gauge.tsx`** to confirm its props: `SpeedoGauge({ elo, min?, max?, label?, size? })` where `size: 'lg' | 'sm'` and `lg` renders the centered ELO number.

- [ ] **Step 2: Implement `components/animated-dial.tsx`:**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { SpeedoGauge } from '@/components/speedo-gauge'

/**
 * Tweens an ELO value from `from` to `to` (easeOutCubic) and renders the
 * SpeedoGauge with the interpolated value — so the needle sweeps and the
 * (lg) centre number counts up. Jumps straight to `to` under reduced motion.
 */
export function AnimatedDial({
  from,
  to,
  label,
  size = 'lg',
  durationMs = 950,
  delayMs = 0,
}: {
  from: number
  to: number
  label?: string
  size?: 'lg' | 'sm'
  durationMs?: number
  delayMs?: number
}) {
  const [value, setValue] = useState(from)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(to)
      return
    }
    let raf = 0
    let startTs = 0
    const tick = (ts: number) => {
      if (!startTs) startTs = ts
      const elapsed = ts - startTs - delayMs
      if (elapsed < 0) { raf = requestAnimationFrame(tick); return }
      const p = Math.min(1, elapsed / durationMs)
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(Math.round(from + (to - from) * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [from, to, durationMs, delayMs])

  return <SpeedoGauge elo={value} label={label} size={size} />
}
```

- [ ] **Step 3: Build check** — `npx tsc --noEmit` (ignore `.next` noise). 
- [ ] **Step 4: Verification checkpoint (NO git).**

`Model: sonnet`

---

## Task 3: `RaceResult` reveal component

**Files:** Create `components/race-result.tsx`.

- [ ] **Step 1: Read `app/actions/matches.ts`** to import `type LogResult`, and `components/motion/delta-counter.tsx` to confirm `DeltaCounter` props (it animates a number `from`→`to`; confirm the exact prop names and use them).

- [ ] **Step 2: Implement `components/race-result.tsx`:**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { ArrowUp } from 'lucide-react'
import { AnimatedDial } from '@/components/animated-dial'
import type { LogResult } from '@/app/actions/matches'

function LightsOut({ onDone }: { onDone: () => void }) {
  const [lit, setLit] = useState(0)
  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) { onDone(); return }
    const timers: ReturnType<typeof setTimeout>[] = []
    for (let i = 1; i <= 5; i++) timers.push(setTimeout(() => setLit(i), i * 140))
    timers.push(setTimeout(onDone, 5 * 140 + 260))
    return () => timers.forEach(clearTimeout)
  }, [onDone])
  return (
    <div className="flex items-center justify-center gap-2 py-6" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={`h-4 w-4 rounded-full transition-colors duration-150 ${i < lit ? 'bg-loss' : 'bg-muted'}`}
        />
      ))}
    </div>
  )
}

function RankBadge({ before, after }: { before: number; after: number }) {
  if (after >= before) return null // only celebrate climbs
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-gain/10 px-2 py-0.5 font-display text-xs font-bold text-gain">
      <ArrowUp className="h-3.5 w-3.5" /> P{before} → P{after}
    </span>
  )
}

export function RaceResult({ result, onLogAnother }: { result: LogResult; onLogAnother?: () => void }) {
  const [revealed, setRevealed] = useState(false)
  const aWon = result.winnerId === result.aId
  const bWon = result.winnerId === result.bId

  return (
    <div className="text-center">
      {!revealed ? (
        <LightsOut onDone={() => setRevealed(true)} />
      ) : (
        <div className="space-y-5">
          <div className="font-display text-xs uppercase tracking-widest text-primary">Result</div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { name: result.aName, won: aWon, before: result.eloABefore, after: result.eloAAfter, rb: result.aRankBefore, ra: result.aRankAfter },
              { name: result.bName, won: bWon, before: result.eloBBefore, after: result.eloBAfter, rb: result.bRankBefore, ra: result.bRankAfter },
            ].map((p) => {
              const delta = p.after - p.before
              return (
                <div key={p.name} className="flex flex-col items-center gap-2">
                  <AnimatedDial from={p.before} to={p.after} label={p.name} size="lg" />
                  <div className={`font-display text-sm font-bold nums ${delta >= 0 ? 'text-gain' : 'text-loss'}`}>
                    {delta >= 0 ? '+' : '−'}{Math.abs(delta)}
                  </div>
                  <RankBadge before={p.rb} after={p.ra} />
                  {p.won && <div className="font-display text-[10px] uppercase tracking-widest text-primary">Winner</div>}
                </div>
              )
            })}
          </div>
          {onLogAnother && (
            <button
              type="button"
              onClick={onLogAnother}
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Log another
            </button>
          )}
        </div>
      )}
    </div>
  )
}
```

(The `→` is U+2192; `−` is U+2212.)

- [ ] **Step 3: Build check** — `npx tsc --noEmit` (ignore `.next` noise).
- [ ] **Step 4: Verification checkpoint (NO git).**

`Model: sonnet`

---

## Task 4: Wire `RaceResult` into `MatchLogForm` success

**Files:** Modify `components/match-log-form.tsx`.

- [ ] **Step 1: Read the current `components/match-log-form.tsx`** (especially the `handle` function around lines 85–110 and the JSX return).

- [ ] **Step 2: Add result state + capture the payload.**
Add import: `import { RaceResult } from '@/components/race-result'` and `import type { LogResult } from '@/app/actions/matches'`.
Add state near the other `useState`s:
```tsx
const [result, setResult] = useState<LogResult | null>(null)
```
In `handle`, in the success branch for the non-edit path, capture the result. Replace the success handling so that after `if (r && 'error' in r) {...}`:
```tsx
      if (onSuccess) onSuccess()
      if (!isEdit) {
        if (r && 'result' in r && r.result) setResult(r.result)
        setSavedTick((t) => t + 1)
        setDuration(0)
        setDurationText('')
        setPlayedAt(toLocalDatetimeValue(new Date()))
        setScores(Array.from({ length: 7 }, () => ['', '']))
        // ...keep any other existing resets (setSetCount, setMode, setAId, setBId) exactly as they are
      }
```
(Keep every existing reset line that's already there — only ADD the `setResult(r.result)` capture.)

- [ ] **Step 3: Render the reveal when there's a result (non-edit).**
At the very top of the returned JSX (before the `<form>`), short-circuit to the reveal:
```tsx
  if (!isEdit && result) {
    return (
      <RaceResult
        result={result}
        onLogAnother={() => {
          setResult(null)
          setSavedTick((t) => t + 1)
        }}
      />
    )
  }
```
This replaces the form with the reveal after a log; "Log another" clears it and remounts a fresh form. (The `key={savedTick}` on the form already resets field state.)

- [ ] **Step 4: Verify** — `npx tsc --noEmit` (ignore `.next` noise); `npm run build`; `npm test`.
- [ ] **Step 5: Visual check (preview).** Start the preview server, open the home logger, log a Quick game between two players, and confirm: lights-out runs, both dials sweep to new ELO, deltas show (+/−), a rank-climb badge shows if applicable, and "Log another" returns to a fresh form. Screenshot the reveal. (Use real existing players; this WILL write a match to the DB — that's expected for a logger test. Pick two players and a normal score.)

NOTE: logging writes real data. If you prefer not to persist a test match, you may verify the reveal visually by temporarily rendering `<RaceResult>` with a hardcoded `LogResult` fixture in a scratch route — but the simplest acceptance is one real logged game. Confirm with the controller which to do; default to one real game with a sensible score.

- [ ] **Step 6: Verification checkpoint (NO git).**

`Model: sonnet`

---

## Task 5: Animate the view-game modal's ELO section

**Files:** Modify `components/match-detail-modal.tsx`.

- [ ] **Step 1: Read the current `components/match-detail-modal.tsx`** (the ELO-impact section that renders each player's delta and `before → after`).

- [ ] **Step 2: Animate the ELO numbers on open.** Import the count-up + dial:
```tsx
import { AnimatedDial } from '@/components/animated-dial'
import { DeltaCounter } from '@/components/motion/delta-counter'
```
In the ELO-impact card for each player, add a compact dial and animate the "after" number:
- Add `<AnimatedDial from={p.before} to={p.after} size="sm" />` above or beside the existing numbers (keep layout tidy; `sm` is the small gauge with no centre number).
- Replace the static after-value text with a count-up: render the "before → after" as `{p.before} → <DeltaCounter from={p.before} to={p.after} />` (confirm DeltaCounter's prop names from its source and match them; if its API differs, animate by passing the right props).
Keep the colored delta (`+16` / `−16`) as-is (it can stay static or also use DeltaCounter from 0 → delta).
The modal fetches detail on open and only mounts when open, so the dial/counter animate once per open — good.

- [ ] **Step 3: Verify** — `npx tsc --noEmit` (ignore `.next` noise); `npm run build`.
- [ ] **Step 4: Visual check (preview).** Open a game from the Race Log; confirm the small dials sweep and the after-ELO counts up. Screenshot.
- [ ] **Step 5: Verification checkpoint (NO git).**

`Model: sonnet`

---

## Task 6: Join glow-up — "you're on the grid" + warmer empty states

**Files:** Modify `app/actions/players.ts`, `app/(public)/players/[id]/page.tsx`, `components/leaderboard.tsx`, `app/(public)/matches/page.tsx`.

- [ ] **Step 1: Redirect new joiners with a welcome flag.** In `app/actions/players.ts`, in `createPlayerSelfServe`, change the final redirect from `redirect(\`/players/${created.id}\`)` to:
```ts
  redirect(`/players/${created.id}?welcome=1`)
```
Leave everything else unchanged.

- [ ] **Step 2: One-time welcome banner on the profile.** In `app/(public)/players/[id]/page.tsx`:
- The page signature must accept async `searchParams`. Next 16: `searchParams` is a `Promise`. Update the component to also receive it, e.g.:
```tsx
export default async function PlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ welcome?: string }>
}) {
  const { id } = await params
  const sp = await searchParams
  const welcome = sp.welcome === '1'
  // ...existing data loading...
```
- Render a banner near the top of the returned JSX (above the player header) when `welcome` is true:
```tsx
{welcome && (
  <div className="mb-6 rounded-xl border border-primary/40 bg-secondary px-4 py-3.5">
    <div className="font-display text-sm font-bold text-primary">🏁 You&apos;re on the grid!</div>
    <p className="mt-0.5 text-sm text-muted-foreground">
      Starting at 1200 ELO. <a href="/#log" className="text-primary hover:underline">Log your first game</a> to start climbing.
    </p>
  </div>
)}
```
(Use the apostrophe HTML entity `&apos;` as shown to satisfy the linter.)

- [ ] **Step 3: Warmer empty states.** Replace the bare empty-state strings with on-brand copy:
- `components/leaderboard.tsx`: change `No players yet.` → `The grid is empty — be the first to join.`
- `app/(public)/matches/page.tsx`: change the matches empty state (currently "No matches yet.") → `No races logged yet. The first result sets the grid.`
- `app/(public)/players/[id]/page.tsx`: change the games-history empty state (the `PlayerGamesHistory` "No games yet." lives in `components/player-games-history.tsx`) → in `components/player-games-history.tsx` change `No games yet.` → `No races yet — challenge someone and log your first game.`
(Keep surrounding markup; only the copy changes.)

- [ ] **Step 4: Verify** — `npx tsc --noEmit` (ignore `.next` noise); `npm run build`; `npm test`.
- [ ] **Step 5: Visual check (preview).** Navigate to `/players/<an-id>?welcome=1` and confirm the banner shows; navigate without the param and confirm it's gone. Screenshot the welcome banner. (No need to actually create a player.)
- [ ] **Step 6: Verification checkpoint (NO git).**

`Model: sonnet`

---

## Task 7: Full verification

- [ ] **Step 1:** `rm -rf .next` then `npm run build` → success (authoritative gate, clean types).
- [ ] **Step 2:** `npx tsc --noEmit` → clean (our code).
- [ ] **Step 3:** `npm test` → all pass (engine + rank + existing).
- [ ] **Step 4:** Preview screenshots: (a) the RaceResult reveal after logging a game (desktop + mobile), (b) the animated view-game modal, (c) the welcome banner via `?welcome=1`. Confirm reduced-motion safety by emulating `prefers-reduced-motion` (preview_resize supports colorScheme; for reduced-motion, note it in the report if not emulable — the code guards it). Confirm no console errors.
- [ ] **Step 5:** Verification checkpoint (NO git) — hand back a clean tree + screenshots for Mahir to commit.

`Model: sonnet`

---

## Self-review notes (author)
- **Spec coverage:** Pillar 2 (RaceResult: lights → tacho sweep → ΔELO → rank change) ✓ via Tasks 1–4; lighter modal animation ✓ Task 5; Pillar 5 (you're-on-the-grid welcome + characterful empty states) ✓ Task 6.
- **Reuse:** `SpeedoGauge` (existing) powers `AnimatedDial`; `DeltaCounter` (existing) reused in the modal; `rankWithin` lives in the stats engine alongside Plan 1.
- **No infra, no schema change.** `logMatch` return shape is additive (backward-compatible with the `'error' in r` discriminator).
- **Type consistency:** `LogResult` defined once in `app/actions/matches.ts`, imported by `RaceResult` and `MatchLogForm`. `AnimatedDial` props (`from,to,label,size,durationMs,delayMs`) used consistently. `rankWithin(elos, elo)` signature stable across Task 1 + logMatch.
- **Reduced motion:** `AnimatedDial` and `LightsOut` both short-circuit to final state under `prefers-reduced-motion`.
- **Known cost:** Task 4's visual acceptance logs one real match (writes to DB) — flagged with a fixture alternative.
- **Git:** no commit steps — Mahir commits.
```

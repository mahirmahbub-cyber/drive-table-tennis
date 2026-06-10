# Elo Look-Ahead Calculator — Design

**Date:** 2026-06-10
**Branch:** `feat/elo-calculator`
**Status:** Approved design, pending spec review

## Goal

A public "what-if" screen where you pick two players and enter how many games
each one wins, and see the projected Elo change for both — without persisting
anything. A look-ahead tool, not a logging tool.

## Decisions

- **Placement:** new public page with a nav link. Anyone viewing the ladder can use it.
- **Input model:** games-won-only. You enter how many games Player A wins and how
  many Player B wins — not per-game point scores. This reflects reality: the Elo
  engine only ever uses who won each game (`applyGames` in `lib/elo.ts` keys off
  `ga > gb ? 'A' : 'B'`), so point margins never change the projection.
- **Output:** net before→after and total delta for each player, **plus** a per-game
  breakdown showing the running rating after each game.
- **Computation:** client-side, pure maths. No server action, no DB writes.

## Key constraint: order-sensitivity

Elo is threaded game-by-game — each game updates the rating the next game is scored
against — so the net result is mildly **order-sensitive**. "A wins 2, B wins 1"
lands a point or two differently for A-A-B vs A-B-A. Games-won-only input carries no
order, so the calculator fixes a convention:

> **Interleave the wins as evenly as possible** (e.g. 3-1 → A, B, A, A), distributing
> each player's wins proportionally across the sequence.

This mimics a realistic back-and-forth match, reads naturally in the per-game
breakdown, and makes the result deterministic. The order effect is ≤ a few Elo and
below look-ahead noise.

## Architecture

Approach A (client-side projection on a new public page). Three small units plus a
nav entry:

```
app/(public)/calculator/page.tsx   server component — fetch roster, render calculator
components/elo-calculator.tsx       client component — inputs + live projection UI
lib/elo.ts                          new pure projection function (single source of truth)
components/site-header.tsx          add one NAV entry
```

### 1. Pure logic — `lib/elo.ts`

Add a pure, testable function that reuses the existing `applyMatch`:

```ts
export type ProjectionStep = {
  game: number       // 1-based index in the played sequence
  winner: 'A' | 'B'
  eloA: number       // running rating after this game
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

export function projectGamesWon(
  eloA: number,
  eloB: number,
  gamesWonA: number,
  gamesWonB: number
): Projection
```

- Build the win sequence via even interleaving: across `gamesWonA + gamesWonB`
  slots, assign each slot to whichever player is furthest behind their proportional
  share of wins so far (largest-remainder / Bresenham-style spread). Deterministic.
- Thread the sequence through `applyMatch`, recording a `ProjectionStep` per game.
- `gamesWonA + gamesWonB === 0` → zero deltas, empty `steps`.

`applyMatch` is reused unchanged; `applyGames` is untouched.

### 2. Page — `app/(public)/calculator/page.tsx`

Server component, `export const dynamic = 'force-dynamic'` (reads live ratings, same
as the log page). Reuses the existing roster query verbatim:

```ts
const roster = await db
  .select({ id: players.id, name: players.name, nickname: players.nickname, currentElo: players.currentElo })
  .from(players)
  .where(eq(players.active, true))
  .orderBy(asc(players.name))
```

Renders a heading in the existing page style and `<EloCalculator players={roster} />`.

### 3. Component — `components/elo-calculator.tsx`

`'use client'`. Props: `players: { id, name, nickname, currentElo }[]`.

- **Inputs:** Player A and Player B `<select>`s styled like the log form's (each
  option shows `name (currentElo)`); two `Stepper`s — "Games won by A" and "Games
  won by B".
- **Live recompute:** on any change, look up both players' `currentElo`, call
  `projectGamesWon`, render. No submit button.
- **Output:**
  - Per player: `currentElo → projectedElo` with a coloured delta (reuse the
    `gain`/`loss` colour tokens already in the codebase).
  - Per-game breakdown: ordered list of `steps`, each showing the game number, who
    won, and both running ratings.

### 4. Nav — `components/site-header.tsx`

Add `{ href: '/calculator', label: 'Calculator' }` to the `NAV` array. Both the
desktop and mobile menus map over `NAV`, so this is the only change needed.

## Edge cases

- **Same player A and B:** block — show a hint, render no projection.
- **Player not selected:** prompt to pick both players; no projection yet.
- **0–0 games:** neutral state, no delta shown.
- **Games cap:** cap each side via the `Stepper`'s `max` at **7** — enough to explore
  a long set or a streak, bounded so the breakdown stays readable and inputs can't run away.

## Testing

Extend `tests/elo.test.ts` with unit tests for `projectGamesWon`:

- Even-interleave order for representative counts (e.g. 3-1, 2-2, 4-0).
- Net deltas conserve points (`deltaA === -deltaB` per game; verified across the run).
- Equal start + equal games won → near-zero, order-determined net.
- Edge cases: 0-0 (empty steps, zero deltas), one side 0 (consecutive wins).
- Sanity vs `applyGames`: a sequence fed as synthetic scores produces the same net.

The component is not unit-tested.

## Out of scope

- Persisting or logging projected matches.
- Per-game point-score entry (margins don't affect Elo).
- Any change to the anti-farming / K-factor behaviour.

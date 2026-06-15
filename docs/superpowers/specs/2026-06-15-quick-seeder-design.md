# Quick Seeder — Design

**Date:** 2026-06-15
**Status:** Approved for planning

## Purpose

A lightweight, casual-play matchmaking tool. The person running the table picks who's
playing this session, says how long they've got and what each game is played to, and the
Seeder produces an ordered queue of matchups. The aim is **egalitarian casual play**:
everyone gets a roughly equal number of games, matchups mostly pair similar ELOs so
high-ELO players don't constantly crush low-ELO players, with an occasional deliberate
high-v-low game to mix things up. People can walk in mid-session and get woven in.

This is a **temporary, single-sitting tool** — not a tournament, not a persisted entity.

## Scope decisions (locked)

- **No DB tables.** Session state lives in React, mirrored to `localStorage` so an
  accidental refresh restores it.
- **Public page**, no auth (sits alongside Calculator).
- **One table** — matchups are a sequential ordered queue.
- **Results log through the existing `logMatch` flow**, so played games write real matches
  and update ELO.
- **Fixed game-time constants** size the queue (DB duration data is too sparse to derive from).

## 1. Placement & shape

- New page at **`/seeder`**, public. Add a **"Seeder"** link to `components/site-header.tsx`
  `NAV` (after Calculator).
- `app/(public)/seeder/page.tsx` — server component, fetches active players
  (`id, name, nickname, currentElo`) and renders `<QuickSeeder players={...} />`.
- `components/quick-seeder.tsx` — `'use client'` root component holding all session state.
- State mirrored to `localStorage` under key **`quick-seeder:v1`**. Hydrate from storage in a
  post-mount `useEffect` (mirrors the SSR-safe pattern already used in `match-log-form.tsx`
  for `playedAt`) to avoid hydration mismatch.

## 2. Session state (the localStorage blob)

```ts
type PlayerRef = { id: string; name: string; elo: number } // snapshot at add-time

type Matchup = {
  id: string                 // local uuid
  aId: string
  bId: string
  status: 'pending' | 'playing' | 'done'
  startedAt?: number         // epoch ms, set on Start
  durationSeconds?: number   // captured on Finish
  score?: [number, number]   // [aPoints, bPoints], captured on Finish
}

type SessionState = {
  config: { target: 7 | 11 | 21; minutes: number; mix: number /* 0..1 */; seed: number }
  roster: PlayerRef[]
  queue: Matchup[]           // ordered; done/playing first, then pending
}
```

## 3. Setup flow

- Tap active players to toggle them into the **roster** (each row shows ELO).
- **Target points**: segmented control `7 / 11 / 21`.
- **Time available**: minutes stepper/input.
- **Mix slider**: *Competitive ↔ Mixed* — drives upset frequency (`mix` 0..1).
- **Generate** → builds the ordered queue. Disabled with a hint when roster < 2.

## 4. The generator — pure, deterministic (`lib/seeder.ts`)

Signature (pure, no I/O):

```ts
buildQueue(input: {
  players: PlayerRef[]
  config: { target: 7|11|21; minutes: number; mix: number; seed: number }
  played: Matchup[]   // already done/playing — seeds counts & last pairing; [] on first gen
}): Matchup[]         // the ordered PENDING matchups to append after `played`
```

### Game-count math

- `GAME_MINUTES = { 7: 3, 11: 5, 21: 12 }` — fixed, tunable constants.
- `perGame = GAME_MINUTES[target]`
- `Gbudget = floor(minutes / perGame)`
- `Gmin = ceil(N / 2)` (one table; every player appears at least once)
- **`G = max(Gbudget, Gmin)`** — the everyone-plays-once guarantee may overrun the time
  budget. The UI surfaces an estimated finish time and a "runs ~X min over your budget" note
  when `Gmin > Gbudget`.

### Pairing loop

There are **no structured rounds and no byes** — not even for odd rosters. The loop simply
emits matchups one at a time; "waiting" just means not being in the current game, and the
fewest-games rule below guarantees the longest-waiting player is always picked next, so an
odd player is never benched for a round — they're dynamically paired by ELO as soon as
they're the most-deserving.

Seed `gamesPlayed[playerId]` and `lastMatch` (the immediately previous pairing) from `played`,
then emit `G - played.length` pending matchups:

1. **Pick the most-deserving player** = fewest games so far. Ties broken by the seeded PRNG.
2. **Eligible opponents** = roster minus the picked player, minus anyone in the immediately
   previous matchup (back-to-back avoidance), minus a repeat of the exact previous pairing.
   These exclusions relax one at a time only if no candidate remains (small rosters).
3. **Round-robin rotation:** within the fewest-games coverage tier, restrict candidates
   to those the picked player has faced the **fewest** times (pair counts tracked across
   the session, seeded from history). So everyone plays everyone before a pairing repeats —
   within the ±1 game-balance tier (when balance and rotation conflict near a round
   boundary, balance wins, so an occasional early repeat can appear).
4. **Choose opponent (ELO weight):**
   - With probability derived from `mix`, pick a deliberate **upset** — weight candidates by
     ELO *distance* (favour far opponents).
   - Otherwise pick a **competitive** match — weight candidates by ELO *closeness*.
   - `mix = 0` → effectively always closest; higher `mix` → upsets get common.
4. Append the matchup, bump both players' counts, update `lastMatch`.

**Determinism:** all randomness flows through a seeded PRNG (e.g. `mulberry32`) keyed on
`config.seed`. Same inputs → same queue. The seed is generated once at session creation and
stored, so re-seeds are stable.

## 5. Play & log (reuses existing pieces)

The current (first `pending`) matchup renders as the active card:

- **Start** → status `playing`, records `startedAt`, starts the existing `MatchStopwatch`.
- **Finish** → a **condensed single-game log**: two `Stepper` score inputs and the
  auto-tracked duration (editable mm:ss, same `handleDurationText` behaviour as
  `match-log-form.tsx`). **Save** calls the existing **`logMatch`** server action with a
  single set `[[aPoints, bPoints]]`, the duration, and `playedAt = now`.
- On success: matchup → `done` (store `score`, `durationSeconds`), the next `pending`
  becomes the active card.

Because games are sequential and `logMatch` reads each player's *current* ELO at save time,
ratings evolve naturally across the session — no special handling needed.

`logMatch`'s existing duplicate-guard window still applies; the condensed form surfaces any
returned `error` inline (same as the full form).

## 6. Walk-in & generate-more

- **Add player** (existing active players only, searchable list of those not already in the
  roster): adds to `roster`, then **rebalances only the pending tail** — `done` and `playing`
  matchups are untouched; `buildQueue` is re-run with `played` = those kept matchups and the
  new roster, recomputing `G` for the new `N`. The newcomer (0 games) is pulled in quickly by
  the fewest-games rule.
- **Generate more**: prompts for a **fresh time budget** (minutes), then runs `buildQueue`
  again for the **current roster** with that new budget, sized by the same game-time math, and
  **appends** the result — fairness counts continue from everything played/queued so far.

## 7. Edge cases

- **Roster < 2:** Generate disabled with a hint.
- **Odd N (common):** no byes or sit-outs. The generator keeps producing ELO-paired
  matchups continuously; the fewest-games rule ensures the odd-one-out is always next in line
  rather than benched. Counts still settle within ±1 across the whole queue.
- **Remove a player** mid-session: drop their `pending` matchups, rebalance the tail.
- **Clear / New session:** resets state and clears the `localStorage` key.
- **Storage versioning:** key carries `:v1`; unknown/legacy shapes are ignored and treated as
  an empty session.

## 8. Testing

- **`lib/seeder.ts` unit tests (TDD, Vitest):**
  - Game-count math: budget-derived count; `Gmin` override when budget too small.
  - Everyone plays at least once.
  - Game counts stay within ±1 across the roster (including odd N — no player is benched;
    the longest-waiting player is always the next picked).
  - No back-to-back appearances when the roster allows it.
  - `mix` extremes: `mix=0` overwhelmingly closest-ELO pairings; high `mix` produces frequent
    far-ELO pairings.
  - Determinism: same `(players, config, played)` → identical queue.
  - Re-seed: `played` matchups preserved; tail rebalances and includes a newly added player.
- **UI:** verified in preview with throwaway fixtures (per project convention: drive the page
  via `preview_eval` `.click()` + separate-eval DOM reads; never seed the live Supabase).

## Components / files touched

- `lib/seeder.ts` (new) + `lib/seeder.test.ts` (new) — generator + PRNG helper.
- `app/(public)/seeder/page.tsx` (new) — server wrapper.
- `components/quick-seeder.tsx` (new) — client root: roster, config, queue, play/log,
  walk-in, generate-more, localStorage persistence.
- Possibly small sub-components (roster picker, active-matchup card, condensed log form) split
  out of `quick-seeder.tsx` to keep files focused.
- `components/site-header.tsx` — add the `/seeder` nav link.
- Reuses: `MatchStopwatch`, `Stepper`, `logMatch`, `formatDuration`, match-format helpers.

# Flip-pad logger — design

**Date:** 2026-06-28
**Branch:** `flip-pad-logger`
**Status:** Approved (brainstorm), ready for implementation plan

## Goal

Replace the logger's score input with a table-tennis-style **flip-pad scoreboard**, and
tighten the whole logging block visually. The pad must serve both fast post-game entry
and live point-by-point scoring, and must look good across quick/full matches on desktop
and mobile.

This is a **client-side presentation/interaction rework only**. The server action
(`logMatch`/`editMatch`) and its Zod schema are unchanged — the new pad emits the same
`FormData` contract on submit.

## Current state

- `components/match-log-form.tsx` — the form. Has a **Quick/Full toggle**, two player
  `<select>` dropdowns, per-game `Stepper` rows (`− [n] +`), a live winner badge, a
  `MatchStopwatch` plus a manual `mm:ss` field, a `datetime-local` field, and a save button.
- `components/stepper.tsx` — the numeric score input (removed from the logger after this work).
- `components/log-game-expander.tsx` — wraps the form in the "Log a game" card; mobile
  collapses to a button, desktop always expanded. **Unchanged** by this work.
- `lib/match-format.ts` — `setsWon`, `inferWinnerSide`, `gameTally`. Winner = whoever won
  more games; ties → null. No enforced point target. **Reused as-is.**
- Layout: logger is the wide left column on desktop (`lg:grid-cols-[1fr_360px]`), full-width
  on mobile.

## The design

### Concept: one emergent pad

There is no Quick/Full toggle. A single flip-pad always shows the **current game's points**
(two big cards) and a **games tally** in the middle. The mode is emergent:

- **Quick** = you score one game and save. The tally reads `1–0`/`0–1`; the games strip is
  effectively empty.
- **Full** = you tap **"+ next game"**, which banks the current game into a chip, ticks the
  tally, and resets the cards to `0–0`. Repeat, then save. Quick is simply "never banked a
  second game".

### Visual language (tournament pad)

Matches the app's light theme (`#f7f7f8` page, Drive blue `#2960c5`, IBM Plex Sans
Condensed display, IBM Plex Mono numerals).

- **Stand**: dark gradient panel (`#2a2d33`→`#1b1d22`), rounded `13px`, soft drop shadow.
- **Cards**: cream (`#fdf6e3`), mono numerals, a horizontal flip seam across the middle, a
  subtle inset bottom edge, two faux "binder" dots at the top. The **leader's** card lifts to
  `#fffaf0` with a gold glow. **Game point** adds a gold ring.
- **Labels**: gold (`#e7c86a`), uppercase, **first name only**, with a chevron — they are the
  player pickers.
- **Tally**: white mono numerals in the middle, small "GAMES" caption, with the editable
  target beneath ("to 11").

### Per-card gesture model (the live game)

Three non-overlapping tap regions on each card:

- **Above the digit** → flip **+1**
- **Below the digit** → flip **−1**
- **The digit itself** (dashed underline = editable) → open a numeric keypad / focus an input
  to **type a final score** directly

Faint `+` / `−` cues sit top and bottom of each card and **fade out once either score
reaches 2** so the board stays clean. The digit's tap-target is ~30px tall at mobile size; the
+/− bands stay the larger, easier targets for fast live taps. Each flip animates (split-flap
style); respects `prefers-reduced-motion`.

Only the **current** game's cards are interactive. Banked games are shown as chips.

### Scoring smarts (default-to-11, never block)

- Default target **11, win by 2**. Editable inline ("to 11" → 21, etc.); per-session, not
  persisted.
- **Game point**: when a player is one point from winning the game under the current target,
  their card gets the gold ring.
- **"+ next game"** button **lights up** (solid blue) once the current game is mathematically
  won under the target; otherwise it's a dashed outline and still tappable. The user can bank
  at any score — the target only drives hints, never enforcement.

### Games strip

Below the stand: one **chip per completed game** (mono, e.g. `11–9`, with the winning side's
number tinted blue), then the **"+ next game"** button.

- Tap a chip → it becomes **inline-editable**: the two numbers turn into small typeable
  inputs in place. Editing a past game is a correction (a deliberate typing action), so the
  big pad stays reserved for "the game you're on". The tally re-derives on edit.
- Hard cap of **7 total games** (banked + current), matching the server's `set_0…set_6`
  range. At 7, "+ next game" is disabled.

### Tightened block layout

Top → bottom inside the existing "Log a game" card:

1. **Stand** — player-picker labels + cards + tally + target.
2. **Games strip** — chips + "+ next game".
3. **Meta row** (one line, divided from above by a hairline): a **timer pill** on the left
   (tap to start/pause; tap the number to type `mm:ss`), and a **played-at line** on the right
   ("Today 2:45pm") that expands to a `datetime-local` only when tapped.
4. **Save button** — full width, carries the live result as a quiet suffix
   (e.g. "Save match · 2–1").

Removed: the Quick/Full toggle, the two large player dropdowns (folded into labels), the
stacked `Stepper` rows, the standalone winner badge (the tally + save suffix replace it), and
the separate bulky stopwatch + manual field + datetime blocks (collapsed into the meta row).

### Responsive

- **Mobile (~344px)**: single column. Cards ~70×90px. Meta row: timer left, date right.
- **Desktop (wide column)**: same structure, larger cards (~78×94px); the editable target can
  sit beside the tally; meta row has more breathing room. No layout fork — the same component
  reflows.

### Edit mode

`MatchLogForm` is reused for editing (`initial.sets`). Load existing games so the **last game
is the live one on the pad** and the rest are banked chips:

- 1 game → current = that game, banked = [] (reads as quick).
- N games → banked = `sets[0..N-2]`, current = `sets[N-1]`.

### Data contract (unchanged)

On submit, emit the existing fields:

- `playerAId`, `playerBId` (from the label pickers)
- `set_<i>_a` / `set_<i>_b` for each game in `[...bankedGames, current]` where the game has
  both scores entered (matches the server's skip-empty loop, `i` in `0..6`)
- `durationSeconds` (from the timer pill)
- `playedAt` (from the played-at line)

Winner/tally derived client-side via the existing `setsWon` / `inferWinnerSide` over
`[...bankedGames, current]`.

## Component decomposition

Each unit has one purpose, a clear interface, and is testable in isolation:

- **`FlipPad`** — the stand: renders both `FlipCard`s + tally + target; owns no state, driven
  by props (current scores, games tally, target, leader/game-point flags) and emits
  change/select events upward.
- **`FlipCard`** — one player's card: the three-region gesture handling (+1 / −1 / type), flip
  animation, leader/game-point styling. Emits `onChange(value)`.
- **`PlayerLabelSelect`** — the gold first-name picker (renders full names in the dropdown,
  first name in the label).
- **`GamesStrip`** — completed-game chips (tap to edit) + "+ next game" button with
  lit/idle/disabled states.
- **`DurationPill`** — condensed timer (start/pause + type `mm:ss`); wraps or replaces the
  `MatchStopwatch` usage. Emits seconds.
- **`PlayedAtLine`** — collapsed date line that expands to `datetime-local`.
- **`MatchLogForm`** — orchestrates the above, holds `{ bankedGames, current, target,
  aId, bId, duration, playedAt }`, builds `FormData`, and submits (success/`RaceResult`
  flow unchanged).

## Non-goals

- No change to the server action, Zod schema, ELO engine, or `RaceResult` reveal.
- No change to `LogGameExpander` (the outer card / mobile collapse).
- Target is not persisted across sessions.
- No new match-format rules in `lib/match-format.ts` (reused as-is).

## Reference mockups

Persisted (gitignored) under `.superpowers/brainstorm/1588281-1782625559/content/`:
`flipboard-style.html`, `unified-pad.html`, `full-block.html`, `gesture.html`,
`gesture-combo.html`.

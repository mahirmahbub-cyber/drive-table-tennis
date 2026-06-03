# Game-level scoring, duplicate-submit guard, and tournament management

**Date:** 2026-06-03
**Status:** Approved (design) — pending implementation plan

## Summary

Three fixes to the Drive Table Tennis app:

1. **Block duplicate game submissions** — a fast double-click (or retry / second tab) on "Save match" currently records the same match twice.
2. **Game is the unit of record** — each individual game within a sitting counts toward win/loss; ELO moves per game; a casual sitting may finish tied. Existing terminology ("set") is renamed to "game", and all historical data is backdated through the new logic.
3. **See / edit / delete previous tournaments** — an admin list of past tournaments, the ability to re-score outcomes, and delete-with-ELO-rebuild.

Guiding constraint for this codebase: **simplicity**. No new infra, no speculative abstraction, minimal schema change.

---

## Terminology

| Term | Meaning |
|------|---------|
| **Match / sitting / encounter** | One logged session between two players. Stored as one `matches` row. Holds duration, played-at, and an array of game scores. |
| **Game** | One `[a, b]` score pair within a sitting (formerly called a "set" in code). The unit of win/loss and ELO. |

The rename "set → game" applies to **UI labels and new code identifiers**. The database column `set_scores` (Drizzle `setScores`) is **left as-is** to avoid a migration; only its conceptual meaning and the surrounding labels change. New helper code uses "game" naming.

---

## Fix #1 — Block duplicate game submissions

### Three layers

1. **Button spinner + disabled state** — `match-log-form.tsx` already flips a `pending` state and disables the button. Add a small inline spinner to the button label while saving, so the user gets immediate feedback (the missing feedback is part of why people click twice).
2. **Client re-entrancy guard** — a `useRef` flag set synchronously at the top of the submit handler. A second submit fired before the first resolves is ignored outright (closes the race that `pending` state alone leaves open because state updates are async).
3. **Server dedup window** — in `logMatch`, before inserting, reject a match with the **same two players and identical game scores created within the last ~10 seconds**. This is the real backstop: it catches double-clicks, network retries, and two open tabs regardless of the client. Returns a friendly `{ error: 'Looks like that match was just logged.' }`. No schema change — a single bounded query against `matches`.

The dedup window value (10s) lives as a named constant.

---

## Fix #2 — Game is the unit of record

### Architecture: encounter stays a container, everything derives from game scores

A `matches` row keeps storing all game scores in `setScores` (e.g. `[[11,9],[9,11],[11,7]]`). We **do not** split games into their own rows. Rationale:

- Zero data migration — existing scores are simply reinterpreted.
- Duration is logged once per sitting; keeping the container keeps "total playing time" correct (no double-counting).
- Tournament brackets still need a single advancing winner per match — the container holds that.

### Win/loss is game-level

For a sitting, each game `[a, b]` with `a ≠ b` yields one game-win for one player and one game-loss for the other. Games with `a == b` (shouldn't occur in real play, but possible in data) are ignored — no result. A 2–1 sitting gives the winner 2W/1L and the loser 1W/2L.

All W/L, win%, and streak stats become **game-level**. Streaks run across games in chronological order (and within a sitting, in game order).

### ELO moves per game

New helper `applyGames(eloA, eloB, games)` in `lib/elo.ts`: threads the rating through each game in order via the existing `applyMatch` logic, returns the final `eloA`/`eloB` (and net deltas). Games with `a == b` are skipped.

The `matches` row continues to store **net snapshots only**: `eloABefore`/`eloBBefore` = ratings before game 1, `eloAAfter`/`eloBAfter` = ratings after the last game. No schema change. The per-match ELO delta shown in the UI is the net swing across the sitting.

### Ties allowed for casual matches

- `logMatch` / `editMatch`: **stop rejecting ties.** A casual sitting that ends with equal games won is saved with `winnerId = null`. ELO still moves per game (a 1–1 sitting applies one win to each).
- **Tournaments still reject ties** — a bracket must advance someone. `recordTournamentResult` keeps requiring a decided winner (most games won), but uses `applyGames` for the ELO portion so tournament ELO is per-game too.

### Backdating

The ELO replay engine becomes the single source of truth and is re-run over all history:

- `lib/elo-recompute.ts`: `HistoryMatch` carries the game scores (`games: [number, number][]`) instead of a single `winner`. `replayHistory` applies ELO per game. `matches.ts`'s `replayAllAndWrite` maps each row's `setScores` into this shape and orders by `playedAt` then `createdAt`.
- After deploy, run the existing **"Rebuild ELO from match history"** admin action (or it runs automatically on the next edit/delete) to backdate all ratings and per-match snapshots under the new per-game logic.

### Stats engine (`lib/stats-engine.ts`)

`playerAggregates` changes from "one sitting = one game" to true game counting:

- `games` = total individual games played.
- `wins` / `losses` / `winPct` = game-level.
- `currentStreak` / `longestWinStreak` = game-level.
- `pointsFor` / `pointsAgainst` = unchanged (already point-level sums).
- `avgGameSeconds` / total playing time = derived from **sitting** durations (per encounter), not per game — surfaced as a new aggregate alongside W/L.

`EngineMatch.winnerId` becomes nullable (ties). Functions using it handle null:
- `headToHead` → counts **game-level** wins between two players.
- `upsetOfWeek` / `demolitionOfWeek` → stay encounter-based; skip sittings with `winnerId == null`.

### Display surfaces

| Surface | Change |
|---------|--------|
| `lib/home-data.ts` | Stop filtering out `winnerId == null` so tied sittings' games still count. Pass game-level W/L per player to the leaderboard. |
| `components/leaderboard.tsx` | Add a **W–L** column (game-level). |
| `app/(public)/players/page.tsx` | Add quick all-time stats per card: **W, L, games, playing time.** |
| `app/(public)/players/[id]/page.tsx` | W/L, win%, and the opponent-tier breakdown become game-level. Add stat tiles: **total games, total wins, total losses, total playing time.** |
| `components/player-games-history.tsx` | Each row = one sitting. Replace the single W/L letter with the **game tally** for that sitting (e.g. "2–1") plus the net ELO delta. Handles ties (no winner). |
| `components/recent-matches.tsx`, `app/admin/history/page.tsx` | Handle `winnerId == null` (no winner highlight); show the game tally. |
| `components/match-log-form.tsx` and any label saying "Set(s)" | Rename UI labels to **"Game(s)"**, "Game 1", "Add game", etc. Live winner badge handles ties (already does). |
| `lib/match-format.ts` | Comments/labels reflect game terminology; `inferWinnerSide` already returns `null` on a tie (used for casual `winnerId`). |

### History display decision

One **row per sitting** showing the game tally — keeps duration and net-ELO grouping intact. (Exploding into one row per game was considered and rejected: it would orphan per-sitting duration/ELO.)

---

## Fix #3 — See / edit / delete previous tournaments

### New surfaces

- **`/admin/tournaments` list page** (linked from the admin dashboard): every tournament with name, status, date, and player count, each linking to its manage page. Add a card to `app/admin/page.tsx`.
- **Manage page (`/admin/tournaments/[id]`) gains:**
  - **Rename** the tournament.
  - **Edit any match outcome** — today the bracket only links matches that haven't been played (`!m.winnerId`). Allow re-opening a decided match to re-score it. Re-scoring re-advances the winner into the immediate next slot and replays ELO.
  - **Delete tournament** button (with confirm).

### New actions in `app/actions/tournaments.ts`

- `renameTournament(id, name)` — validated, updates name.
- `deleteTournament(id)` — deletes the tournament (its matches cascade via the existing FK `onDelete: 'cascade'`), then runs the shared ELO replay to rebuild ratings from remaining history.
- `recordTournamentResult` — extended to allow re-scoring an already-decided match: re-write scores/winner, re-advance into the next slot (overwriting the prior advancement), use `applyGames` for ELO, and replay globally so ratings stay consistent.

`replayAllAndWrite` (currently private in `matches.ts`) is extracted to a shared location (e.g. `lib/elo-recompute.ts` orchestration or a small `lib/elo-rebuild.ts`) so `tournaments.ts` can call it.

### Known limitation (accepted)

Editing an outcome in an **early** round of an already-completed bracket re-advances only the immediate next match; it does not deep-rewrite every downstream round. This is rare admin-correction territory and explicitly out of scope. Surface a small note on the manage page near the edit affordance.

---

## Data flow summary

```
Save casual match
  match-log-form (spinner + re-entrancy guard)
    → logMatch (server dedup window → reject if duplicate)
      → applyGames(eloA, eloB, games)  // per-game ELO, ties → winnerId null
      → insert match row (net ELO snapshots) + update both players' ELO

Edit / delete casual match, delete tournament, edit tournament outcome
  → write change
  → replayAllAndWrite()  // per-game replay over full history = backdated ratings

Stats / leaderboard / profiles
  → read matches → expand setScores into games → game-level W/L, streaks, totals
```

## Schema impact

**None.** `set_scores` column reused; `winner_id` already nullable; ELO columns unchanged. The only conceptual change is that `winner_id == null` now legitimately means "tied casual sitting" rather than "not yet played" — code that distinguishes the two uses `playedAt` (already the convention).

## Testing

- `lib/elo.ts` — `applyGames` unit tests: single game, 2–1, 1–1 tie net effect, skip equal-score game.
- `lib/elo-recompute.ts` — replay with multi-game matches reproduces expected ratings; tie sitting nets correctly.
- `lib/stats-engine.ts` — `playerAggregates` game-level counts, streaks across games, `headToHead` game-level.
- `lib/match-format.ts` — existing tie/winner inference still holds.
- Dedup: `logMatch` rejects an identical match within the window, allows it after.
- Verify UI surfaces with throwaway preview fixtures (per project convention) — **not** by seeding live Supabase.

## Risks & decisions

Stats are **computed on read** from `setScores`, never stored as counters — so total wins/losses/games/playing-time cannot silently drift; they recompute every load. ELO replay is deterministic and idempotent. The genuine risks:

1. **`winnerId == null` is now overloaded** — it means both "tournament match not played yet" (existing) and "tied casual sitting" (new). This is the most likely source of a subtle bug. **Mitigation:** the implementation audits *every* `winnerId` usage in the codebase and disambiguates via `playedAt`; a regression test asserts a tied casual match counts its games.
2. **Incremental vs. replay drift** — `logMatch`, `recordTournamentResult`, and the full replay all write ELO. **Mitigation:** all three call one shared `applyGames` helper (single source of truth), unit-tested.
3. **Transition window** — until "Rebuild ELO" is run once after deploy, `currentElo` mixes old per-encounter snapshots with new per-game increments. **Mitigation:** running the rebuild is a required, explicit post-deploy step (safe to run anytime).

**Decision — K-factor:** keep **K = 32 applied per game** (not scaled down). Consequence accepted: on rebuild, every rating shifts, and ratings swing faster going forward (a multi-game sitting can move ~N× a single game). This is a deliberate feel change, not a defect.

## Out of scope

- Splitting games into separate DB rows / schema migration.
- Renaming the `set_scores` DB column.
- Deep downstream re-advancement when editing early-round tournament outcomes.
- Full tournament re-seed / player-swap editing (only outcomes, name, delete).

# Log-game & view-game UX — design

**Date:** 2026-06-02
**Status:** Approved design, ready for implementation plan

## Goal

Make recording and reviewing games delightful, fast, and reachable from the home page. Four threads:

1. **Inline logger on the home page** — log a game without leaving the dashboard, with a **Quick** (single set) and **Full match** (best-of sets) mode.
2. **View-game modal** — a shared detail dialog, openable from anywhere a played game is shown.
3. **Player games-history** — a per-player list of games on `/players/[id]`.
4. **Admin nav** — replace the top-left "Admin" brand link with a "Back to home" link so it's easy to return to the home page to log games.

Design constraint (per project memory): **simplicity is the primary goal** — no clever infra, reuse existing patterns (server actions, the `Dialog` component, the existing `MatchLogForm` logic) wherever possible.

## Key facts that shape the design

- **ELO depends only on the winner.** `applyMatch(eloA, eloB, winner)` ignores scores. Set scores are stored (`matches.setScores`) purely for display and records. So a "Quick" single-set game is fully rating-fair.
- **Winner is inferred from sets** via `inferWinner` (counts sets won; ties are rejected). A single set `[11,7]` → A wins. This logic is unchanged.
- **Schema already supports a single set.** `matchLogSchema.sets` is `min(1).max(7)`; `setScores` is a `jsonb` array of `[a,b]` tuples. **No schema or DB migration required.**
- **`logMatch` is a public server action** — it has no auth check, and `proxy.ts` only gates `/admin/*` *page routes*. So an inline logger on the public home page works with no auth changes.
- Match rows already store `eloABefore/After`, `eloBBefore/After`, `durationSeconds`, `playedAt` — everything the view-game modal needs.

## Decisions locked in brainstorming

| Decision | Choice |
|---|---|
| Who can log | **Anyone, no login.** Admin login stays only for edit/delete + roster/tournament management. |
| Logger placement | **Right-rail, always open** — top of the home page's right column (replaces the `JoinCta` slot position; see Open question). |
| Quick vs Full | **Single toggle** in one card. Quick = one score line. Full = dynamic set rows. |
| Score entry | **Steppers + type** — big +/− buttons that are also typable number fields. |
| Stopwatch | **Available in both modes** (not just Full). |
| View-game detail | **Modal**, reusing the `Dialog` component. **Triggerable from anywhere** a played game is shown. |
| Player history | New list **below the ELO chart** on `/players/[id]`. |

---

## Architecture & components

### 1. `MatchLogForm` rework (`components/match-log-form.tsx`)

The existing form is reused and extended; the server actions (`logMatch`, `editMatch`) are **unchanged**. The form gains:

- **Mode toggle** — a segmented control: `Quick | Full match`. Local state `mode: 'quick' | 'full'`. Default `quick`.
- **Score entry**
  - **Quick:** one score row with a `Stepper` for each side. Renders hidden inputs `set_0_a` / `set_0_b` so the existing server action reads it with zero changes.
  - **Full:** dynamic set rows. Local state `setCount` starting at 1, "＋ Add set" increments up to 7, each row removable. Each row is a `Stepper` pair writing `set_i_a`/`set_i_b`. Replaces today's fixed 7 rows.
- **`Stepper` component** (new, small) — `−  [n]  +` where `[n]` is a typable numeric input. Props: `name`, `defaultValue`/`value`, `min=0`, `max=99`. Emits the same form field names the server action already expects. Used by both modes.
- **Live winner badge** — derived client-side from the current set values using the same rule as `inferWinner` (count sets won; for Quick, compare the single pair). Shows "**X** wins · 11–7" (Quick) or "**X** wins the match (2–1)" (Full), or "Tied — enter a winner" when unresolved. Purely presentational; the server re-infers on save.
- **Stopwatch** — `MatchStopwatch` shown in both modes (today it's effectively full-form only). Manual `mm:ss` entry retained.
- **Edit mode unchanged in behaviour** — the admin edit dialog keeps using `MatchLogForm` with `initial`. When editing, default `mode` to `quick` if the match has exactly one set, else `full`.

**Why reuse the form:** keeps one validation + submission path, one source of truth. The Quick/Full split is a presentation layer over the same `set_i_a/b` fields.

### 2. Home-page inline logger (`app/(public)/page.tsx`)

- A new server-rendered card, `InlineLogger`, placed at the **top of the right column** of the dashboard grid, above the existing `JoinCta` / `InFormCard` / `RecentMatches` widgets (which shift down, kept).
- It fetches the active roster (same query as `app/admin/matches/new/page.tsx`: active players, id/name/nickname/currentElo, ordered by name) and renders `MatchLogForm` inside a styled card.
- On successful save, `MatchLogForm`'s existing `onSuccess` + the server action's `revalidatePath('/')` refresh the leaderboard and recent results in place. The form already resets itself after a non-edit save.
- The hero's secondary "New game" button and the header "New game" button are **repointed** from `/admin/matches/new` to the home page (e.g. a `#log` anchor / scroll-to), since logging now lives on the home page. `/admin/matches/new` can remain as an admin convenience or be retired — see Open questions.

### 3. View-game modal (shared, trigger from anywhere)

- **`getMatchDetail(id)`** — a new read-only server action in `app/actions/matches.ts` returning everything the modal shows: both player ids + names, `setScores`, `winnerId`, `playedAt`, `durationSeconds`, and `eloABefore/After`, `eloBBefore/After`. Fetching on open keeps every list surface light (they only need the match `id`) and gives the modal a single source of truth.
- **`MatchDetailModal`** (new client component) — controlled `Dialog`. Given a match `id`, fetches detail on open and renders:
  - Header: `Player A vs Player B` (winner emphasised), date + time.
  - **Set-by-set cells** — one cell per set, score with the set-winner side highlighted.
  - **Final result** — "X wins 2–1" (or the single score for Quick).
  - **ELO impact** — per player: delta (`+16` / `−16`, coloured) and `before → after`. Computed from stored `eloXBefore/After`.
  - Meta: duration (if any).
  - Player names link to `/players/[id]`.
- **`MatchRowTrigger`** (new client wrapper) — wraps a row's content in a button that opens `MatchDetailModal` for that `id`. Used by all surfaces below.

**Interactivity note:** to avoid nested interactive elements (a link inside a button), surfaces that currently link player names within a row will make the **whole row open the modal** instead; the modal provides the linked player names. This is a deliberate, documented change (see Risks).

### 4. Surfaces that adopt the trigger

| Surface | File | Change |
|---|---|---|
| Matches list | `app/(public)/matches/page.tsx` | Each `<li>` becomes a `MatchRowTrigger`. Visual layout unchanged. |
| Recent results | `components/recent-matches.tsx` | Each row becomes a `MatchRowTrigger`. |
| Player history | `app/(public)/players/[id]/page.tsx` | New section (below ELO chart) — see #5. |

The matches list and recent-matches queries already select `id`; no query change needed for them to act as triggers.

### 5. Player games-history (`app/(public)/players/[id]/page.tsx`)

- The page **already loads `playerMatches`** (all of the player's matches, ordered). A new **`PlayerGamesHistory`** section renders below the ELO chart — no new query.
- Each row: date, **W/L badge** (from `winnerId === playerId`), `vs Opponent` (the opponent's name — needs opponent names; extend the existing `playerMatches` select to join opponent name, or do a light follow-up lookup), score (single-set → raw `11–7`; multi-set → sets-won `2–1`), and **this player's ELO delta** for that game (`eloAAfter − eloABefore` or the B-side equivalent, depending on which side the player was).
- Rows are `MatchRowTrigger`s opening the shared modal.
- Display order: most-recent first (reverse of the chart's chronological order).

### 6. Admin nav (`components/nav.tsx`)

- Replace the top-left "Admin" brand link (currently `→ /admin`, label "Admin") with a **"← Back to home"** link (`→ /`), keeping the same styling slot. The remaining admin links (Players, Log match, Tournament, History, Sign out) are unchanged.

---

## Data flow

**Logging (home page):**
`InlineLogger` (server, loads roster) → `MatchLogForm` (client, Quick/Full) → existing `logMatch` server action → DB insert + ELO update via `applyMatch` → `revalidatePath('/')` refreshes leaderboard/recent in place.

**Viewing a game (any surface):**
List row (`MatchRowTrigger`, has match `id`) → opens `MatchDetailModal` → calls `getMatchDetail(id)` → renders sets + ELO impact + duration.

## Error handling

- Logger: server-side `matchLogSchema` validation is the source of truth; client live-badge is advisory. Tied set count → save blocked with the existing "Sets are tied" error. Same-player selection → existing schema refinement error.
- `getMatchDetail`: missing match → modal shows a short "Match not found" state; never throws to the user.
- Stepper inputs clamp to 0–99 (matches `setScoreSchema`).

## Testing

- **Unit (existing patterns in `tests/`):** `inferWinner`/live-badge parity for single-set and multi-set; the existing `elo.test.ts` / `elo-recompute.test.ts` are untouched (ELO logic unchanged).
- **Component-level:** Quick mode emits `set_0_a/b` only; Full mode emits `set_i_a/b` for added rows; Add/remove set bounds (1–7).
- **Verification (per project memory):** verify the data-driven UI with **throwaway preview fixtures**, not by seeding live Supabase. Manually exercise: log a Quick game from home → appears in Recent + leaderboard moves; open the modal from matches list, recent results, and a player history row; confirm ELO deltas match stored before/after.

## Out of scope (YAGNI)

- Head-to-head records in the modal.
- Recent-opponent quick-pick chips / avatars in the player picker (dropdowns stay).
- Tournament-match logging changes.
- Any DB/schema migration.

## Risks & tradeoffs

- **Whole-row-opens-modal replaces in-row player links** on the matches and recent-results lists. Mitigation: the modal exposes linked player names, so navigation is preserved in one extra click. Documented for review.
- **Public logging = no abuse protection.** Accepted explicitly (office honour system). Edit/delete remain admin-only, so bad entries are correctable.
- **`getMatchDetail` adds one query per modal open.** Acceptable; keeps list surfaces light and avoids over-fetching ELO/duration everywhere.

## Open questions (non-blocking — sensible defaults chosen)

1. **`JoinCta` placement.** The logger takes the top of the right column; `JoinCta` moves below it (kept) unless you'd rather drop it. *Default: keep, moved down.*
2. **Retire `/admin/matches/new`?** Logging now lives on the home page. *Default: leave it (harmless admin convenience), repoint the public "New game" buttons to the home logger.*
3. **"New game" buttons → home logger.** Hero + header buttons scroll to / focus the inline logger. *Default: yes.*

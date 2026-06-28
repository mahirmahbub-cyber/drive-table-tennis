# Homepage redesign — logger-first, condensed stats

**Date:** 2026-06-27
**Branch:** `redesign-homepage-logger-hero`
**Status:** Approved design, pre-implementation

## Goal

Reorient the public homepage (`app/(public)/page.tsx`) around two changes:

1. **Logging a game becomes the most prominent block.** The marketing hero ("Race
   to the top of the table" + PixelRally) is removed and replaced by a slim brand
   strip; the log-a-game form sits directly below it, open and ready, as the
   centrepiece.
2. **The stats area is condensed.** The page currently carries ~8 separate bordered
   cards. The small per-week stat blocks (By the Numbers, Superlatives, Rivalry of
   the Week) collapse into a single compact "This Week" strip, and the ladder goes
   full-width (the right sidebar is removed).

The ladder (starting grid) remains the page's core content and stays prominent.

## New page structure (top → bottom)

1. **H2H banner** — unchanged. The existing personalised head-to-head banner stays
   thin at the very top.
2. **Slim brand strip** — `DRIVE · OFFICE LADDER · LIVE STANDINGS` wordmark on the
   left; a **Join the ladder** button (→ `/join`) on the right. Replaces the hero.
3. **Logger** — the existing `MatchLogForm`, rendered **open by default** (not behind
   the collapsed "+" button), centred (`max-w-2xl`) and framed with the primary
   accent it already uses. Full form: Quick/Full toggle, player pickers, score
   steppers, live winner badge, auto-running stopwatch + manual duration, date/time,
   Save. Nothing hidden.
4. **"This Week" strip** — one new component replacing three. Two compact rows:
   - **Number chips** (4-up grid): Games this week, Court time, Turnout, Biggest
     margin.
   - **Personality pills** (wrapping row): Locked in (top mover), Mog of the week
     (upset), Cooking (demolition), Rivalry of the week.
5. **Ladder** — `Leaderboard`, now full-width (single-column page; the
   `lg:grid-cols-[1fr_340px]` two-column grid is removed).
6. **Recent results** — `RecentMatches`, unchanged, full-width below the ladder.

## Components

| Component | Change |
|---|---|
| `app/(public)/page.tsx` | Remove hero `<section>` + `PixelRally` import. Remove the two-column grid wrapper; render brand strip, logger, This Week strip, ladder, recent results in a single column. |
| `components/home/this-week.tsx` | **New.** Merges the data + render of `ByTheNumbers`, `SuperlativesStrip`, and `RivalryWatch` into one section: number-chip row + pill row. Reuses the same `stats-engine` calls already used by the three (`participation`, `demolitionOfWeek`, `matchMargin`, `upsetOfWeek`, `mostPlayedRivalry`, `headToHead`, and `movers[0]`). Takes the same `{ data, now, movers }` props. |
| `components/inline-logger.tsx` / `log-game-expander.tsx` | Render the logger **open by default**. Either drop `LogGameExpander`'s collapsed initial state (form always shown) or default `open` to `true`. The brand-strip layout owns the surrounding framing/heading. |
| `components/home/by-the-numbers.tsx`, `home/superlatives-strip.tsx`, `home/rivalry-watch.tsx` | Superseded by `this-week.tsx`. Remove their usage from the page. **Deletion of the files to be confirmed before removing** (per repo rule: no deleting without asking). |
| `components/join-cta.tsx`, `components/pixel-rally.tsx` | No longer used on the homepage (CTA moves to brand strip; PixelRally dropped). Usage removed; file deletion to be confirmed separately. |
| `components/leaderboard.tsx`, `recent-matches.tsx` | Unchanged; now rendered full-width. |

## Data flow

No data-layer changes. `loadHomeData()` already supplies everything
(`engineMatches`, `activePlayers`, `nameById`, `wlById`). The new `ThisWeek`
component consumes the existing `HomeData` shape and the `movers` array already
computed in `page.tsx`. The title/aggregate computation feeding the leaderboard is
untouched.

## Decisions & accepted trade-offs

- **PixelRally dropped** from the homepage (decorative hero filler; conflicts with
  the condense goal).
- **Biggest margin / Cooking overlap.** "Biggest margin (16 pts)" and the "Cooking"
  pill (e.g. "Sanjay by 16") describe the same match. Kept both — they read
  differently (raw number vs. named, attributed superlative). Trivial to drop the
  number chip later if it feels redundant.
- **Logger stays full / open**, not quick-log-only, so the auto-running stopwatch
  stays front-and-centre for the intended "start logging when the match begins"
  flow.
- **Two-column layout removed** in favour of single column + full-width ladder.

## Out of scope

- No changes to the logging logic, stats-engine math, or data model.
- No restyling of the ladder rows or recent-results rows beyond making them
  full-width.
- Empty-state copy (no games this week) carries over from the existing components.

## Testing

To be decided with the user before the implementation plan is written.

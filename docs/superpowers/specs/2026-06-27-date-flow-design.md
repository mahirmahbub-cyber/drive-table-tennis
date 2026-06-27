# Date flow — coherent timezone handling

**Date:** 2026-06-27
**Branch:** `fix/date-flow`
**Status:** Design — awaiting review

## Problem

`played_at` is the field that drives leaderboard membership, the 7-day movers
column, ELO replay order, and every date display. It is currently written with
**three different conventions** and read with a fourth:

| Source | Writes | Correct? |
|---|---|---|
| Quick seeder (`seeder-queue.tsx`) | `new Date().toISOString()` → true UTC instant | ✅ |
| Manual log/edit form (`match-log-form.tsx`) | `datetime-local` wall-clock string, parsed server-side by `z.coerce.date()` | ❌ interpreted as UTC, not local |
| Seed data (`supabase/data.sql`) | mixed — some real instants, some round-minute values shifted +10h | ❌ |
| Display (`player-games-history`, `match-detail-modal`, `matches`, admin) | `toLocale*(undefined, …)` | ❌ implicit locale: server-side renders UTC, client-side renders viewer's zone |

The +10h skew is visible in the seed data (e.g. row with `played_at
2026-06-18 12:26:00+00` vs `created_at 2026-06-18 02:26:53+00`) — that gap is the
AEST (UTC+10) offset: a wall-clock time stored as if it were UTC.

## Root cause

There is no single convention for what `played_at` represents at the input and
output boundaries. The database column is `timestamptz` (a true UTC instant) and
is correct; the breakage is entirely at conversion time — input parses a naive
wall-clock as UTC, and output formats with an implicit, environment-dependent
zone.

## Key finding

The correct, DST-aware timezone code **already exists** in `lib/slack/windows.ts`
(`SYDNEY_TZ`, `tzOffsetMs`, `ymdInTz`, `zonedMidnightUtc` with DST-edge
correction, formatters). The Slack digest uses it correctly. The leaderboard and
logging side never adopted it. This work applies the existing toolkit to the two
boundaries that skipped it — no new dependency, no new DST math.

## Decisions

- **Canonical zone:** fixed `Australia/Sydney` (the venue), applied at input and
  output boundaries. The DB keeps UTC instants.
- **Inactivity filter:** unchanged — leaderboard keeps hiding players with no game
  in the last 7 days (rolling window). Old seed games stay hidden; this is by
  design.
- **Existing data:** fix-forward only. No migration; `supabase/data.sql` is left
  as-is. Existing skewed rows remain skewed.
- **Approach:** extract the generic TZ primitives from `lib/slack/windows.ts` into
  a shared `lib/tz.ts`, have `windows.ts` import them, and apply at both
  boundaries.
- **Tests:** unit tests for the new pure helpers in `lib/tz.ts`.

## Design

### 1. `lib/tz.ts` (new — shared primitives)

```ts
export const VENUE_TZ = 'Australia/Sydney'

// ms that tz is ahead of UTC at the given instant (DST-aware). Moved from windows.ts.
export function tzOffsetMs(instant: Date, tz?: string): number

// "yyyy-MM-ddTHH:mm" (or with seconds) read as wall-clock in tz → UTC instant. DST-aware.
export function wallClockToInstant(wallClock: string, tz?: string): Date

// UTC instant → "yyyy-MM-ddTHH:mm" wall-clock in tz (for <input type="datetime-local">).
export function instantToWallClock(instant: Date, tz?: string): string

// true if the string carries an explicit zone (trailing Z or ±HH:mm / ±HHmm).
export function hasExplicitZone(s: string): boolean

// thin wrapper: Intl.DateTimeFormat in the venue zone.
export function formatInZone(instant: Date, opts: Intl.DateTimeFormatOptions, tz?: string): string
```

`wallClockToInstant` generalises `windows.ts`'s `zonedMidnightUtc`: interpret the
string as if UTC, subtract the zone offset at that instant, apply the same
DST-edge correction already used in `windows.ts`.

### 2. Refactor `lib/slack/windows.ts`

- Import `tzOffsetMs` and `VENUE_TZ` from `lib/tz.ts` instead of defining locally.
- Keep `SYDNEY_TZ` as a re-export alias of `VENUE_TZ` so existing importers
  (`digest.ts`, cron routes, `slack.ts`) are untouched.
- Keep the calendar/week utilities (`ymdInTz`, `addDays`, `weekday`,
  `zonedMidnightUtc`, range/format functions) here; `zonedMidnightUtc` delegates
  to shared `tzOffsetMs`. The existing `windows.test.ts` continues to cover them.

### 3. Input boundary — single chokepoint in the validator

In `lib/validators.ts`, normalise `playedAt` in `matchLogSchema`:

```ts
playedAt: z.preprocess((v) => {
  if (v === '' || v == null) return undefined
  if (typeof v === 'string' && !hasExplicitZone(v)) return wallClockToInstant(v)
  return v
}, z.coerce.date().optional()),
```

Enforced rule: **a `playedAt` with no zone means Sydney wall-clock.** The form
(naive string) is converted; the seeder (ISO with `Z`) passes straight through.
`logMatch` and `editMatch` both use this schema, so both are fixed at once. No
change to the form's submit code is required.

### 4. Picker — `match-log-form.tsx`

Replace the browser-local `toLocalDatetimeValue` with `instantToWallClock(d,
VENUE_TZ)` for the "now" default and for pre-filling an edited game's time, so the
picker always shows Sydney wall-clock. Round-trip: picker (Sydney) → submit
(naive) → validator (→ instant) → edit pre-fill (instant → Sydney).

### 5. Output boundary — pin every display to `VENUE_TZ`

Add `timeZone: VENUE_TZ` to the formatting options at:

- `components/player-games-history.tsx:27`
- `components/match-detail-modal.tsx:55`
- `app/(public)/matches/page.tsx:88, 93`
- `app/admin/history/page.tsx:113`
- `app/admin/tournaments/page.tsx:35` (createdAt — for cross-page consistency)
- `lib/stats-engine.ts:352` — replace the `getDate()` + `toLocaleString('en', …)`
  chart label with `formatInZone(m.playedAt, { day: 'numeric', month: 'short' })`

### 6. Admin history date-range filter — `app/admin/history/page.tsx:23-24`

Interpret the `from`/`to` query params as Sydney day boundaries:

```ts
if (sp.from) conditions.push(gte(matches.playedAt, wallClockToInstant(sp.from + 'T00:00')))
if (sp.to)   conditions.push(lte(matches.playedAt, wallClockToInstant(sp.to + 'T23:59:59')))
```

### Out of scope (unchanged)

- No migration of existing rows or `supabase/data.sql` (fix-forward).
- 7-day inactivity filter and its rolling-window semantics.
- All `now − Nd` window comparisons — already instant-based and correct.
- Server-side `new Date()` writes (seeder fallback, tournament timestamps) —
  already true instants.
- Slack digest behaviour — already correct; only refactored to share helpers.

## Testing

`lib/tz.test.ts` (Vitest, matching existing `*.test.ts` style):

- `wallClockToInstant('2026-06-18T12:19')` → `2026-06-18T02:19:00Z` (winter, AEST +10).
- `wallClockToInstant('2026-01-15T12:00')` → `2026-01-15T01:00:00Z` (summer, AEDT +11).
- `instantToWallClock` round-trips both seasons.
- `wallClock → instant → wallClock` equals the original input (both seasons).
- `hasExplicitZone`: `…Z` → true, `+10:00`/`+1000` → true, naive → false.

## Risks / known limitations

- Existing skewed rows stay skewed (accepted: fix-forward). ELO replay order over
  historical rows is unchanged; new rows order correctly.
- At the exact DST transition hour, a wall-clock time can be ambiguous/non-existent
  — handled by the same single-step offset correction `windows.ts` already uses;
  acceptable for a table-tennis ladder.

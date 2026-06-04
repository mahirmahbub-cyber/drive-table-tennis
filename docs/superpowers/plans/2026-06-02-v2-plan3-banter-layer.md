# v2 — Plan 3: Banter Layer (titles + head-to-head matrix + lingo)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add the "banter" layer (Pillar 4) — player **titles** (Gigachad / Mogger / Locked In / Washed / Down Bad / Jester / Mid), a **head-to-head "Mogboard" matrix**, and a centralised **looksmaxxing/mogging lingo** voice — fuel for office trash talk and team bonding.

**Architecture:** Two new pure, tested modules — `lib/banter.ts` (lexicon + caption helpers) and `lib/titles.ts` (derives titles from stats) — plus a `giantKills` helper in the existing stats engine. UI: a `TitleBadge` shown on leaderboard rows + player profiles, a `/matrix` page, and lingo woven into the superlatives + RaceResult captions. No schema change, no infra.

**Tone (locked):** *Curated playful, office-safe* — lingo aimed at rank/results, never personal; avoid `-pilled`/`-cel`/crude terms. **ELO numbers stay pure** (no "aura" wording on ratings); lingo lives in titles, superlative labels, and result captions.

**Tech Stack:** Next.js 16 (server components), React 19, Tailwind v4, Vitest (pure logic; visuals via build + preview screenshots).

**Spec:** `docs/design/2026-06-02-v2.0-design-uplift.md` (Pillar 4) + the lexicon mapping agreed in chat.

---

## Conventions (READ FIRST)
- **GIT: do NOT run git.** Leave changes in the working tree; Mahir commits. Each task ends in a verification checkpoint.
- **Models:** sonnet by default; haiku where marked.
- **Next 16:** async `params`/`searchParams`/`cookies()`. Read `node_modules/next/dist/docs/` before framework work.
- **Stale dev types:** ignore tsc errors ONLY in `.next/dev/types/routes.d.ts`; the gate is `npm run build` (`rm -rf .next` first if needed).
- **Chars:** EN DASH `–` (U+2013) for scores; MINUS `−` (U+2212) for negatives. Use Write/Edit, not bash heredocs.
- **Reuse Plan 1/2:** `lib/stats-engine.ts` (`playerAggregates`, `movers`, `headToHead`, `rankWithin`), `lib/home-data.ts` (`loadHomeData`, `HomePlayer`, `HomeData`), `components/leaderboard.tsx` (`{players, movers}`), `app/(public)/page.tsx`, `components/race-result.tsx`, `components/home/superlatives-strip.tsx`.

## File structure
**Create:** `lib/banter.ts`, `tests/banter.test.ts`, `lib/titles.ts`, `tests/titles.test.ts`, `components/title-badge.tsx`, `components/home/mogboard.tsx`, `app/(public)/matrix/page.tsx`.
**Modify:** `lib/stats-engine.ts` (+`giantKills`, +test), `app/(public)/page.tsx` (compute titles, pass to leaderboard), `components/leaderboard.tsx` (show top title), `app/(public)/players/[id]/page.tsx` (title badges in header), `components/race-result.tsx` (mog caption), `components/home/superlatives-strip.tsx` (banter labels), `components/site-header.tsx` (Matrix nav link).

---

## Task 1: `lib/banter.ts` — lexicon + caption helpers (TDD)

**Files:** Create `lib/banter.ts`, `tests/banter.test.ts`.

- [ ] **Step 1: failing test** `tests/banter.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { mogCaption, cookedCaption, SUPERLATIVE_LABELS } from '@/lib/banter'

describe('banter captions', () => {
  it('mogCaption', () => {
    expect(mogCaption('Sasha', 'Marcus')).toBe('Sasha mogged Marcus')
  })
  it('cookedCaption', () => {
    expect(cookedCaption('Marcus', 18)).toBe('Marcus got cooked by 18')
  })
  it('superlative labels are the banter versions', () => {
    expect(SUPERLATIVE_LABELS.upset).toBe('Mog of the Week')
    expect(SUPERLATIVE_LABELS.demolition).toBe('Cooking of the Week')
    expect(SUPERLATIVE_LABELS.mostImproved).toBe('Locked In')
  })
})
```
- [ ] **Step 2: run `npm test -- banter`, verify FAIL.**
- [ ] **Step 3: implement `lib/banter.ts`:**
```ts
/**
 * Centralised "banter" voice (curated, office-safe looksmaxxing/mogging lingo).
 * Lingo targets rank/results only — never anything personal. ELO numbers stay pure.
 */

export const SUPERLATIVE_LABELS = {
  mostImproved: 'Locked In',
  upset: 'Mog of the Week',
  demolition: 'Cooking of the Week',
} as const

/** "{winner} mogged {loser}" — the standard win caption. */
export function mogCaption(winner: string, loser: string): string {
  return `${winner} mogged ${loser}`
}

/** "{loser} got cooked by {margin}" — blowout caption. */
export function cookedCaption(loser: string, margin: number): string {
  return `${loser} got cooked by ${margin}`
}
```
- [ ] **Step 4: run `npm test -- banter`, verify PASS.**
- [ ] **Step 5: `npx tsc --noEmit` (ignore `.next` noise).**
- [ ] **Step 6: verification checkpoint (NO git).** `Model: sonnet`

---

## Task 2: `giantKills` helper + `lib/titles.ts` titles engine (TDD)

**Files:** Modify `lib/stats-engine.ts` (+test in `tests/stats-engine.giantkills.test.ts`); Create `lib/titles.ts`, `tests/titles.test.ts`.

- [ ] **Step 1: failing test for giantKills** `tests/stats-engine.giantkills.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { giantKills, type EngineMatch } from '@/lib/stats-engine'

const d = (iso: string) => new Date(iso)
function m(p: Partial<EngineMatch> & { id: string }): EngineMatch {
  return {
    id: p.id, playerAId: p.playerAId ?? 'A', playerBId: p.playerBId ?? 'B',
    winnerId: p.winnerId ?? 'A', setScores: p.setScores ?? [[11, 5]],
    durationSeconds: p.durationSeconds ?? 600, playedAt: p.playedAt ?? d('2026-06-01T10:00:00Z'),
    eloABefore: p.eloABefore ?? 1200, eloAAfter: p.eloAAfter ?? 1216,
    eloBBefore: p.eloBBefore ?? 1200, eloBAfter: p.eloBAfter ?? 1184,
  }
}

describe('giantKills', () => {
  it('counts wins over opponents rated >= gap higher (default 100)', () => {
    const ms: EngineMatch[] = [
      m({ id: '1', winnerId: 'A', eloABefore: 1200, eloBBefore: 1350 }), // A beat +150 → giant kill
      m({ id: '2', winnerId: 'A', eloABefore: 1200, eloBBefore: 1250 }), // +50 → not
      m({ id: '3', winnerId: 'B', eloABefore: 1200, eloBBefore: 1400 }), // A lost → not
    ]
    expect(giantKills(ms, 'A')).toBe(1)
    expect(giantKills(ms, 'A', 40)).toBe(2)
  })
})
```
- [ ] **Step 2: run `npm test -- giantkills`, verify FAIL.**
- [ ] **Step 3: append `giantKills` to `lib/stats-engine.ts`:**
```ts
/** Count of `playerId`'s wins where the opponent was rated at least `gap` ELO higher (before the match). */
export function giantKills(all: EngineMatch[], playerId: string, gap = 100): number {
  let n = 0
  for (const mt of all) {
    if (mt.winnerId !== playerId) continue
    const isA = mt.playerAId === playerId
    const myBefore = isA ? mt.eloABefore : mt.eloBBefore
    const oppBefore = isA ? mt.eloBBefore : mt.eloABefore
    if (oppBefore - myBefore >= gap) n++
  }
  return n
}
```
- [ ] **Step 4: run `npm test -- giantkills`, verify PASS.**

- [ ] **Step 5: failing test for titles** `tests/titles.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { titlesForPlayer, topTitle, type TitleInput } from '@/lib/titles'

const base: TitleInput = {
  rank: 6, totalPlayers: 12, games: 5, currentStreak: 0, weeklyDelta: 0, giantKills: 0, currentElo: 1200, peakElo: 1200,
}

describe('titlesForPlayer', () => {
  it('rank 1 → Gigachad (top)', () => {
    expect(topTitle({ ...base, rank: 1 })?.key).toBe('gigachad')
  })
  it('3+ giant kills → Mogger', () => {
    expect(topTitle({ ...base, giantKills: 3 })?.key).toBe('mogger')
  })
  it('win streak ≥ 3 → Locked In', () => {
    expect(topTitle({ ...base, currentStreak: 4 })?.key).toBe('lockedIn')
  })
  it('weekly delta ≤ −30 → Washed (beats down-bad)', () => {
    expect(topTitle({ ...base, weeklyDelta: -40, currentStreak: -3 })?.key).toBe('washed')
  })
  it('loss streak ≤ −3 → Down Bad', () => {
    expect(topTitle({ ...base, currentStreak: -3 })?.key).toBe('downBad')
  })
  it('last place → Jester', () => {
    expect(topTitle({ ...base, rank: 12, totalPlayers: 12 })?.key).toBe('jester')
  })
  it('middle third → Mid', () => {
    expect(topTitle({ ...base, rank: 6, totalPlayers: 12 })?.key).toBe('mid')
  })
  it('no games → no titles', () => {
    expect(titlesForPlayer({ ...base, games: 0 })).toEqual([])
  })
})
```
- [ ] **Step 6: run `npm test -- titles`, verify FAIL.**
- [ ] **Step 7: implement `lib/titles.ts`:**
```ts
export type TitleTone = 'good' | 'bad' | 'neutral'
export type Title = { key: string; label: string; tone: TitleTone; blurb: string }

export type TitleInput = {
  rank: number
  totalPlayers: number
  games: number
  currentStreak: number // signed: + win run, − loss run
  weeklyDelta: number   // 7d ELO change
  giantKills: number
  currentElo: number
  peakElo: number
}

const WASHED_DROP = 30
const STREAK_MIN = 3
const MOGGER_MIN = 3

/** Titles in priority order (most flattering / notable first). May be empty. */
export function titlesForPlayer(i: TitleInput): Title[] {
  if (i.games < 1) return []
  const out: Title[] = []
  const inThird = (lo: number, hi: number) => i.rank > lo && i.rank <= hi

  if (i.rank === 1) out.push({ key: 'gigachad', label: 'Gigachad', tone: 'good', blurb: 'Top of the grid.' })
  if (i.giantKills >= MOGGER_MIN) out.push({ key: 'mogger', label: 'Mogger', tone: 'good', blurb: 'Beats players above their weight.' })
  if (i.currentStreak >= STREAK_MIN) out.push({ key: 'lockedIn', label: 'Locked In', tone: 'good', blurb: `On a ${i.currentStreak}-win heater.` })
  if (i.weeklyDelta <= -WASHED_DROP) out.push({ key: 'washed', label: 'Washed', tone: 'bad', blurb: 'Sliding down the grid this week.' })
  if (i.currentStreak <= -STREAK_MIN) out.push({ key: 'downBad', label: 'Down Bad', tone: 'bad', blurb: `${Math.abs(i.currentStreak)}-loss skid.` })
  if (i.totalPlayers >= 4 && i.rank === i.totalPlayers) out.push({ key: 'jester', label: 'Jester', tone: 'bad', blurb: 'Propping up the grid.' })
  // Mid: middle third, and not already carrying a stronger title
  if (out.length === 0 && inThird(i.totalPlayers / 3, (2 * i.totalPlayers) / 3)) {
    out.push({ key: 'mid', label: 'Mid', tone: 'neutral', blurb: 'Comfortably mid-table.' })
  }
  return out
}

export function topTitle(i: TitleInput): Title | null {
  return titlesForPlayer(i)[0] ?? null
}
```
NOTE on the "washed beats down-bad" test: `washed` is pushed before `downBad`, so when both apply `topTitle` returns `washed`. The "middle third → Mid" test uses rank 6 of 12: `6 > 4 && 6 <= 8` is true and no stronger title applies → `mid`. The "rank 1" path also is not in the middle third. Confirm these against the implementation; the priority order in the array IS the display priority.

- [ ] **Step 8: run `npm test -- titles`, verify PASS.**
- [ ] **Step 9: `npx tsc --noEmit` (ignore `.next`).**
- [ ] **Step 10: verification checkpoint (NO git).** `Model: sonnet`

---

## Task 3: `TitleBadge` + show top title on the leaderboard

**Files:** Create `components/title-badge.tsx`; Modify `app/(public)/page.tsx`, `components/leaderboard.tsx`.

- [ ] **Step 1: create `components/title-badge.tsx`:**
```tsx
import type { Title } from '@/lib/titles'

const toneClass: Record<Title['tone'], string> = {
  good: 'bg-primary/10 text-primary',
  bad: 'bg-loss/10 text-loss',
  neutral: 'bg-muted text-muted-foreground',
}

export function TitleBadge({ title, className = '' }: { title: Title; className?: string }) {
  return (
    <span
      title={title.blurb}
      className={`rounded-sm px-1.5 py-0.5 font-display text-[9px] font-bold uppercase tracking-wider ${toneClass[title.tone]} ${className}`}
    >
      {title.label}
    </span>
  )
}
```

- [ ] **Step 2: compute titles in `app/(public)/page.tsx`.** After `loadHomeData()` + `weekMovers`, build a title map. Add imports:
```tsx
import { playerAggregates, giantKills, rankWithin } from '@/lib/stats-engine'
import { topTitle, type Title } from '@/lib/titles'
```
Build the map (the page already has `data.activePlayers`, `data.engineMatches`, `weekMovers`):
```tsx
  const allElos = data.activePlayers.map((p) => p.currentElo)
  const moverById = new Map(weekMovers.map((mv) => [mv.playerId, mv.delta] as const))
  const titleByPlayer = new Map<string, Title>()
  for (const p of data.activePlayers) {
    const agg = playerAggregates(data.engineMatches, p.id, p.currentElo)
    const t = topTitle({
      rank: rankWithin(allElos, p.currentElo),
      totalPlayers: data.activePlayers.length,
      games: agg.games,
      currentStreak: agg.currentStreak,
      weeklyDelta: moverById.get(p.id) ?? 0,
      giantKills: giantKills(data.engineMatches, p.id),
      currentElo: p.currentElo,
      peakElo: agg.peakElo,
    })
    if (t) titleByPlayer.set(p.id, t)
  }
```
Pass it to the leaderboard: `<Leaderboard players={data.activePlayers} movers={weekMovers} titles={titleByPlayer} />`.

- [ ] **Step 3: render the title on leaderboard rows.** In `components/leaderboard.tsx`:
- Add to props: `titles?: Map<string, import('@/lib/titles').Title>` (or import the type at top: `import type { Title } from '@/lib/titles'` and use `titles?: Map<string, Title>`). Add `import { TitleBadge } from '@/components/title-badge'`.
- In each row, replace the existing `Pole` badge with the player's title when present, falling back to `Pole` only if rank 1 has no title (rank 1 always yields `gigachad`, so effectively Gigachad shows for P1). Concretely, where the `{pole && <span ...>Pole</span>}` currently renders, use:
```tsx
{titles?.get(p.id) ? <TitleBadge title={titles.get(p.id)!} /> : pole ? (
  <span className="rounded-sm bg-primary/10 px-1.5 py-0.5 font-display text-[9px] font-bold uppercase tracking-wider text-primary">Pole</span>
) : null}
```
Keep `titles` optional so the component still renders if not passed.

- [ ] **Step 4: verify** — `npx tsc --noEmit` (ignore `.next`), `npm run build`, `npm test`.
- [ ] **Step 5: visual (read-only):** preview the home; confirm titles (Gigachad on P1, Jester on last, etc.) render on rows. Screenshot. 
- [ ] **Step 6: verification checkpoint (NO git).** `Model: sonnet`

---

## Task 4: Title badges on the player profile header

**Files:** Modify `app/(public)/players/[id]/page.tsx`.

- [ ] **Step 1: read the current player page** (it already loads the player + `playerMatches`; it computes win/loss and uses `playerEloDelta`). Confirm what aggregate data is available.

- [ ] **Step 2: compute the player's titles and render badges in the header.**
- Add imports: `import { playerAggregates, giantKills, rankWithin, movers } from '@/lib/stats-engine'`, `import { titlesForPlayer } from '@/lib/titles'`, `import { TitleBadge } from '@/components/title-badge'`. Also load all active players' elos to compute rank + totalPlayers — add a small query (the page already imports `db, players`): 
```tsx
import { eq } from 'drizzle-orm' // confirm it's already imported; if so don't duplicate
const activeElos = await db.select({ id: players.id, currentElo: players.currentElo }).from(players).where(eq(players.active, true))
```
- Build an `EngineMatch[]` from `playerMatches` if not already in that shape — the page's `playerMatches` rows have the elo/set fields. Map them to the `EngineMatch` shape (id, playerAId, playerBId, winnerId, setScores, durationSeconds, playedAt, eloABefore/After, eloBBefore/After), defaulting nulls to 1200 like `lib/home-data.ts` does. (If the page already has a suitable array, reuse it.)
- Compute:
```tsx
const agg = playerAggregates(engineMatches, id, player.currentElo)
const now7 = await /* not needed */ undefined
const weekly = movers(engineMatches, new Date(Date.now() - 7 * 86400 * 1000)).find((x) => x.playerId === id)?.delta ?? 0
const titles = titlesForPlayer({
  rank: rankWithin(activeElos.map((p) => p.currentElo), player.currentElo),
  totalPlayers: activeElos.length,
  games: agg.games,
  currentStreak: agg.currentStreak,
  weeklyDelta: weekly,
  giantKills: giantKills(engineMatches, id),
  currentElo: player.currentElo,
  peakElo: agg.peakElo,
})
```
Note: `Date.now()` here runs in the async server component body (not in a child's render), which is allowed. If the repo's lint flags `Date.now()` in a server component, compute `const now = Date.now()` once at the top of the function and reuse — match how `app/(public)/page.tsx` does it.
- Render the badges in the header, near the player name / W-L row:
```tsx
{titles.length > 0 && (
  <div className="mt-2 flex flex-wrap gap-1.5">
    {titles.map((t) => <TitleBadge key={t.key} title={t} />)}
  </div>
)}
```

- [ ] **Step 3: verify** — `npx tsc --noEmit` (ignore `.next`), `npm run build`.
- [ ] **Step 4: visual (read-only):** open a player profile; confirm titles render. Screenshot.
- [ ] **Step 5: verification checkpoint (NO git).** `Model: sonnet`

---

## Task 5: "Mogboard" — head-to-head matrix page

**Files:** Create `components/home/mogboard.tsx`, `app/(public)/matrix/page.tsx`; Modify `components/site-header.tsx`.

- [ ] **Step 1: create `components/home/mogboard.tsx`** (server component; takes players + engineMatches):
```tsx
import { PlayerAvatar } from '@/components/player-avatar'
import { headToHead } from '@/lib/stats-engine'
import type { HomePlayer } from '@/lib/home-data'
import type { EngineMatch } from '@/lib/stats-engine'

export function Mogboard({ players, matches }: { players: HomePlayer[]; matches: EngineMatch[] }) {
  const ranked = [...players].sort((a, b) => b.currentElo - a.currentElo)
  if (ranked.length < 2) {
    return <p className="text-sm text-muted-foreground">Need at least two players on the grid to start mogging.</p>
  }
  const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-background p-2 text-left font-display text-[10px] uppercase tracking-widest text-muted-foreground">vs →</th>
            {ranked.map((c) => (
              <th key={c.id} className="p-2 font-mono text-[11px] text-muted-foreground" title={c.name}>{initials(c.name)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ranked.map((r) => (
            <tr key={r.id} className="border-t border-border">
              <th className="sticky left-0 z-10 bg-background p-2 text-left">
                <span className="flex items-center gap-2">
                  <PlayerAvatar name={r.name} photoUrl={r.photoUrl} size={22} />
                  <span className="truncate text-xs font-medium max-w-[120px]">{r.name}</span>
                </span>
              </th>
              {ranked.map((c) => {
                if (c.id === r.id) return <td key={c.id} className="p-2 text-center text-muted-foreground/30">—</td>
                const h = headToHead(matches, r.id, c.id)
                const total = h.p1Wins + h.p2Wins
                const cls = total === 0 ? 'text-muted-foreground/40' : h.p1Wins > h.p2Wins ? 'text-gain font-semibold' : h.p1Wins < h.p2Wins ? 'text-loss' : 'text-muted-foreground'
                return (
                  <td key={c.id} className="p-2 text-center font-mono nums text-xs">
                    <span className={cls}>{total === 0 ? '·' : `${h.p1Wins}–${h.p2Wins}`}</span>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```
(The `—` is U+2014; the `–` in the score is U+2013; `·` is U+00B7.)

- [ ] **Step 2: create `app/(public)/matrix/page.tsx`:**
```tsx
import { loadHomeData } from '@/lib/home-data'
import { Mogboard } from '@/components/home/mogboard'

export const dynamic = 'force-dynamic'

export default async function MatrixPage() {
  const data = await loadHomeData()
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 md:px-6">
      <div className="mb-6">
        <p className="font-display uppercase tracking-[0.2em] text-xs text-primary mb-1">Who mogs who</p>
        <h1 className="font-display text-3xl font-bold tracking-tight leading-none">The Mogboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">Head-to-head record, row vs column. Blue = you mog them.</p>
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <Mogboard players={data.activePlayers} matches={data.engineMatches} />
      </div>
    </main>
  )
}
```

- [ ] **Step 3: add a nav link in `components/site-header.tsx`.** Read the file; the `NAV` array currently has `Players`, `Matches`, `Tournaments`. Add `{ href: '/matrix', label: 'Mogboard' }` (after Matches). Keep everything else unchanged.

- [ ] **Step 4: verify** — `npx tsc --noEmit` (ignore `.next`), `npm run build`.
- [ ] **Step 5: visual (read-only):** preview `/matrix`; confirm the grid renders, diagonal blank, blue/red cells, horizontal scroll on mobile. Screenshot desktop + mobile.
- [ ] **Step 6: verification checkpoint (NO git).** `Model: sonnet`

---

## Task 6: Lingo in RaceResult + superlatives

**Files:** Modify `components/race-result.tsx`, `components/home/superlatives-strip.tsx`.

- [ ] **Step 1: RaceResult mog caption.** In `components/race-result.tsx`, add `import { mogCaption } from '@/lib/banter'`. The component knows `result.winnerId`, `result.aName`, `result.bName`. Derive winner/loser names and, in the revealed state (below the "Result" label, above or below the dials grid), render the caption when there's a winner:
```tsx
{result.winnerId && (
  <div className="font-display text-sm font-semibold">
    {mogCaption(
      result.winnerId === result.aId ? result.aName : result.bName,
      result.winnerId === result.aId ? result.bName : result.aName,
    )}
  </div>
)}
```
Keep the ΔELO numbers exactly as they are (pure — no lingo on the numbers). Place the caption tastefully (e.g. just under the "Result" heading).

- [ ] **Step 2: banter labels in the superlatives strip.** In `components/home/superlatives-strip.tsx`, add `import { SUPERLATIVE_LABELS, mogCaption } from '@/lib/banter'`. Update the three cards:
  - Most Improved card: `label: SUPERLATIVE_LABELS.mostImproved` ("Locked In"), keep `value` = player name, `sub` = `+${topMover.delta} ELO`.
  - Upset card: `label: SUPERLATIVE_LABELS.upset` ("Mog of the Week"), `value` = winner name, `sub` = `mogged ${loserName}` (compute the loser as the non-winner side, as it already does for "beat ...").
  - Demolition card: `label: SUPERLATIVE_LABELS.demolition` ("Cooking of the Week"), `value` = winner name, `sub` = `cooked ${loserName} by ${matchMargin(demo)}` (compute loser as the non-winner side of `demo`).
  Keep the icons and layout; only labels + sub copy change. Keep the empty-state line.

- [ ] **Step 3: verify** — `npx tsc --noEmit` (ignore `.next`), `npm run build`, `npm test`.
- [ ] **Step 4: visual (read-only):** preview home; confirm superlative cards read "Locked In / Mog of the Week / Cooking of the Week" with banter subs. Screenshot. (RaceResult caption was verified via fixture in Plan 2's pattern — re-verify with a throwaway `_rr-preview` fixture if you want to see the caption, then delete it; do NOT log real data.)
- [ ] **Step 5: verification checkpoint (NO git).** `Model: haiku`

---

## Task 7: Full verification

- [ ] **Step 1:** `rm -rf .next` then `npm run build` → success.
- [ ] **Step 2:** `npx tsc --noEmit` → clean (our code).
- [ ] **Step 3:** `npm test` → all pass (banter + titles + giantKills + existing).
- [ ] **Step 4:** Preview screenshots (read-only): home leaderboard with title badges (Gigachad/Jester/etc.), a player profile with title badges, the `/matrix` Mogboard (desktop + mobile), the relabelled superlatives. Confirm no console errors. If you create any throwaway fixture route, DELETE it before finishing.
- [ ] **Step 5:** Verification checkpoint — hand back a clean tree + screenshots for Mahir to commit. (NO git.)
`Model: sonnet`

---

## Self-review notes (author)
- **Spec coverage (Pillar 4):** titles ✓ (`lib/titles.ts` — Gigachad/Mogger/Locked-In/Washed/Down-Bad/Jester/Mid), title badges on leaderboard + profile ✓, head-to-head **matrix** (Mogboard) ✓, centralised lingo ✓ (`lib/banter.ts`) woven into superlatives + RaceResult caption. Tone = curated-playful, ELO numbers kept pure (lingo only in titles/labels/captions).
- **Pure + tested:** `banter`, `titles`, `giantKills` all unit-tested; UI verified via build + screenshots.
- **Reuse:** stats-engine (`playerAggregates`, `movers`, `headToHead`, `rankWithin`, new `giantKills`), `loadHomeData`, `Leaderboard`, `SuperlativesStrip`, `RaceResult`.
- **Type consistency:** `Title`/`TitleInput`/`TitleTone` defined once in `lib/titles.ts`; `TitleBadge` consumes `Title`; `titleByPlayer: Map<string, Title>` threaded page→leaderboard; `SUPERLATIVE_LABELS`/`mogCaption`/`cookedCaption` from `lib/banter.ts`.
- **No schema change, no infra.** **Git:** no commit steps — Mahir commits.
- **Embedded fixes flagged:** the `mogCaption` defensive-replace and the `<p class=...>` JSX typo are explicitly corrected inline so an implementer copying the block doesn't ship them.
```

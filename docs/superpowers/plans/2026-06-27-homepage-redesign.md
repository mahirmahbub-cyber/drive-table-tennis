# Homepage Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make logging a game the most prominent block on the public homepage and condense the per-week stats into a single "This Week" strip with a full-width ladder.

**Architecture:** Pure presentational refactor of `app/(public)/page.tsx`. The marketing hero + PixelRally are removed and replaced by a slim brand strip; the existing logger renders open by default as the centrepiece; three small stat components (By the Numbers, Superlatives, Rivalry) are merged into one new `ThisWeek` component; the two-column grid is dropped so the ladder is full-width. No data-layer, stats-engine, or logging-logic changes — `loadHomeData()` already supplies everything.

**Tech Stack:** Next.js (project-local build, see `node_modules/next/dist/docs/`), React Server Components, TypeScript, Tailwind v4 (`@apply` utilities in `app/globals.css`), lucide-react icons, Drizzle.

**Testing note:** Per the spec and user decision, this change ships **without automated tests** — it is presentational. Verification is TypeScript compile + visual check in the running dev server. Do not add vitest tests.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `components/home/this-week.tsx` | Single condensed "This Week" section: 4 number chips + a wrapping row of superlative/rivalry pills. Merges the data + render of the three old blocks. | **Create** |
| `components/log-game-expander.tsx` | Logger panel. Change default state to open so the full form shows immediately. | **Modify** |
| `app/(public)/page.tsx` | Page composition: H2H banner → brand strip → logger → This Week → full-width ladder → recent results. | **Modify** |
| `components/home/by-the-numbers.tsx` | Superseded by `this-week.tsx`. | **Delete (confirm)** |
| `components/home/superlatives-strip.tsx` | Superseded by `this-week.tsx`. | **Delete (confirm)** |
| `components/home/rivalry-watch.tsx` | Superseded by `this-week.tsx`. | **Delete (confirm)** |
| `components/join-cta.tsx` | CTA moves into the brand strip. | **Delete (confirm)** |
| `components/pixel-rally.tsx` | Hero animation dropped. | **Delete (confirm)** |

`components/leaderboard.tsx` and `components/recent-matches.tsx` are unchanged (rendered full-width).

---

### Task 1: Create the `ThisWeek` component

**Files:**
- Create: `components/home/this-week.tsx`

This component reproduces exactly the data calls used today by `by-the-numbers.tsx`, `superlatives-strip.tsx`, and `rivalry-watch.tsx`, rendering them as one section. All function signatures below already exist in `lib/stats-engine.ts` and are used by those three components.

- [ ] **Step 1: Write the component**

```tsx
import { TrendingUp, Zap, Flame, Swords } from 'lucide-react'
import type { HomeData } from '@/lib/home-data'
import type { Mover } from '@/lib/stats-engine'
import {
  participation,
  demolitionOfWeek,
  matchMargin,
  upsetOfWeek,
  mostPlayedRivalry,
  headToHead,
} from '@/lib/stats-engine'
import { SUPERLATIVE_LABELS } from '@/lib/banter'
import { formatDuration } from '@/lib/stats'

const WINDOW_DAYS = 7

export function ThisWeek({ data, now, movers }: { data: HomeData; now: number; movers: Mover[] }) {
  const since = new Date(now - WINDOW_DAYS * 86400 * 1000)
  const name = (id: string | null | undefined) => (id ? data.nameById.get(id)?.name : undefined) ?? '—'

  const part = participation(data.engineMatches, data.activePlayers.map((p) => p.id), since)
  const demo = demolitionOfWeek(data.engineMatches, since)
  const upset = upsetOfWeek(data.engineMatches, since)
  const topMover = movers[0]
  const rivalry = mostPlayedRivalry(data.engineMatches, since)

  const numbers = [
    { label: 'Games', value: String(part.games) },
    { label: 'Court time', value: part.totalCourtSeconds > 0 ? formatDuration(part.totalCourtSeconds) : '—' },
    { label: 'Turnout', value: `${part.rate}%` },
    { label: 'Biggest margin', value: demo ? `${matchMargin(demo)} pts` : '—' },
  ]

  const pills = [
    topMover && topMover.delta > 0
      ? { icon: TrendingUp, label: SUPERLATIVE_LABELS.mostImproved, value: `${name(topMover.playerId)} +${topMover.delta}` }
      : null,
    upset
      ? {
          icon: Zap,
          label: SUPERLATIVE_LABELS.upset,
          value: `${name(upset.winnerId)} ▸ ${name(upset.winnerId === upset.playerAId ? upset.playerBId : upset.playerAId)}`,
        }
      : null,
    demo
      ? { icon: Flame, label: SUPERLATIVE_LABELS.demolition, value: `${name(demo.winnerId)} by ${matchMargin(demo)}` }
      : null,
    rivalry
      ? (() => {
          const h2h = headToHead(data.engineMatches, rivalry.p1, rivalry.p2)
          return { icon: Swords, label: 'Rivalry', value: `${name(rivalry.p1)} ${h2h.p1Wins}–${h2h.p2Wins} ${name(rivalry.p2)}` }
        })()
      : null,
  ].filter(Boolean) as { icon: typeof TrendingUp; label: string; value: string }[]

  return (
    <section>
      <div className="section-header font-display">
        This Week
        <span className="normal-case tracking-normal font-sans font-normal text-muted-foreground/70 ml-1">7d</span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {numbers.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card px-4 py-3">
            <div className="font-display uppercase tracking-widest text-[10px] text-muted-foreground">{s.label}</div>
            <div className="mt-0.5 font-display text-xl font-semibold nums">{s.value}</div>
          </div>
        ))}
      </div>
      {pills.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {pills.map((p) => (
            <div
              key={p.label}
              className="flex min-w-0 grow basis-[calc(50%-0.25rem)] items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 sm:basis-[calc(25%-0.375rem)]"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <p.icon className="h-3 w-3" />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-display uppercase tracking-widest text-[9px] text-muted-foreground">
                  {p.label}
                </span>
                <span className="block truncate text-xs font-semibold">{p.value}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no errors). If `participation` / `upsetOfWeek` / `mostPlayedRivalry` field names mismatch, cross-check against `components/home/by-the-numbers.tsx`, `superlatives-strip.tsx`, `rivalry-watch.tsx` — this component must use the identical shapes.

- [ ] **Step 3: Commit**

```bash
git add components/home/this-week.tsx
git commit -m "feat: add condensed This Week stats component"
```

---

### Task 2: Open the logger by default

**Files:**
- Modify: `components/log-game-expander.tsx:20`

The logger currently starts collapsed (a "+" button). As the homepage centrepiece it should show the full form immediately, keeping the collapse control and live stopwatch intact.

- [ ] **Step 1: Change the initial state**

Change:

```tsx
  const [open, setOpen] = useState(false)
```

to:

```tsx
  const [open, setOpen] = useState(true)
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/log-game-expander.tsx
git commit -m "feat: open the home logger by default"
```

---

### Task 3: Restructure the homepage

**Files:**
- Modify: `app/(public)/page.tsx` (full rewrite of imports + JSX; computation block unchanged)

Remove the hero `<section>`, PixelRally, the two-column grid, the three old stat components, and JoinCta. Add the brand strip and the `ThisWeek` component, in a single column.

- [ ] **Step 1: Replace the file contents**

```tsx
import Link from 'next/link'
import { InlineLogger } from '@/components/inline-logger'
import { Leaderboard } from '@/components/leaderboard'
import { RecentMatches } from '@/components/recent-matches'
import { ThisWeek } from '@/components/home/this-week'
import { H2hBanner } from '@/components/home/h2h-banner'
import { loadHomeData } from '@/lib/home-data'
import { movers, playerAggregates, giantKills, rankWithin, recentlyActive } from '@/lib/stats-engine'
import { topTitle, type Title } from '@/lib/titles'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const data = await loadHomeData()
  const now = data.now
  const since = new Date(now - 7 * 86400 * 1000)
  const weekMovers = movers(data.engineMatches, since)
  const activeIds = recentlyActive(data.engineMatches, since)
  const leaderboardPlayers = data.activePlayers.filter((p) => activeIds.has(p.id))

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

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6">
      <H2hBanner />

      {/* ── Brand strip ── */}
      <div className="mb-6 flex items-center justify-between gap-4 border-b border-border pb-4">
        <p className="font-display text-lg font-bold tracking-tight">
          Drive
          <span className="ml-2 align-middle font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Office Ladder · Live Standings
          </span>
        </p>
        <Link
          href="/join"
          className="inline-flex shrink-0 items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors duration-150 hover:bg-[#10489e]"
        >
          Join the ladder
        </Link>
      </div>

      {/* ── Logger (centered, open) — most prominent block ── */}
      <div className="mx-auto mb-8 w-full max-w-2xl">
        <InlineLogger />
      </div>

      {/* ── This Week (condensed stats) ── */}
      <div className="mb-8">
        <ThisWeek data={data} now={now} movers={weekMovers} />
      </div>

      {/* ── Ladder (full width) ── */}
      <div className="mb-8">
        <Leaderboard players={leaderboardPlayers} movers={weekMovers} wlById={data.wlById} titles={titleByPlayer} />
      </div>

      {/* ── Recent results ── */}
      <RecentMatches />
    </main>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS. The removed imports (`PixelRally`, `SuperlativesStrip`, `RivalryWatch`, `ByTheNumbers`, `JoinCta`) must no longer be referenced anywhere in this file.

- [ ] **Step 3: Visual verification**

Run: `npm run dev`, open the homepage. Confirm, top to bottom: H2H banner, brand strip with "Join the ladder" button, the **open** log form, the "This Week" number chips + pills, full-width ladder, recent results. Resize to mobile width and confirm the chips go 2-up and pills wrap.

- [ ] **Step 4: Commit**

```bash
git add app/(public)/page.tsx
git commit -m "feat: logger-first homepage with condensed stats and full-width ladder"
```

---

### Task 4: Remove the superseded components

**Files:**
- Delete (after confirmation): `components/home/by-the-numbers.tsx`, `components/home/superlatives-strip.tsx`, `components/home/rivalry-watch.tsx`, `components/join-cta.tsx`, `components/pixel-rally.tsx`

Repo rule: never delete files without asking first. This task verifies the files are now unused, then deletes them only with the user's go-ahead.

- [ ] **Step 1: Verify no remaining usages**

Run:
```bash
rg -n "ByTheNumbers|by-the-numbers|SuperlativesStrip|superlatives-strip|RivalryWatch|rivalry-watch|JoinCta|join-cta|PixelRally|pixel-rally" --glob '!docs/**'
```
Expected: no matches outside the files being deleted themselves. If any other file imports one of these, stop and report it — that file needs handling before deletion.

- [ ] **Step 2: Confirm with the user, then delete**

Ask the user to confirm deletion of the five files. On confirmation:
```bash
git rm components/home/by-the-numbers.tsx components/home/superlatives-strip.tsx components/home/rivalry-watch.tsx components/join-cta.tsx components/pixel-rally.tsx
```

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit` then `npm run build`
Expected: both PASS with no unresolved imports.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: remove homepage components superseded by This Week"
```

---

## Self-Review

- **Spec coverage:** Logger-as-hero → Tasks 2 + 3 (brand strip + open logger). Condensed stats → Task 1 + 3 (ThisWeek replaces three blocks). Full-width ladder / sidebar removal → Task 3 (single column). Join CTA into brand strip → Task 3. PixelRally dropped, H2H banner kept → Task 3. Cleanup of dead files → Task 4. All spec sections covered.
- **Placeholder scan:** No TBD/TODO; every code step shows complete code; commands have expected output.
- **Type consistency:** `ThisWeek` props `{ data, now, movers }` match the call site in Task 3. Stat-engine calls mirror the exact shapes used by the three existing components. `weekMovers` (page) is passed as the `movers` prop.

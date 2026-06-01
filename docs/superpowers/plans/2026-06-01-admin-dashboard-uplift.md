# Admin Dashboard Uplift Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the admin dashboard a real management surface — add/edit/delete completed matches (with date/time + a live stopwatch for game duration), edit player profiles, and a filterable history view — all elevated to the app's existing Drive-brand design system.

**Architecture:** Most backend logic already exists (`editMatch`, `deleteMatch`, `updatePlayer` in `app/actions/`). This work is mostly UI wiring on top of those actions, plus: one new `matches.durationSeconds` column, pure duration-stat helpers in `lib/stats.ts`, a redesigned reusable match form with a stopwatch, a new `/admin/history` filtered list, and profile-edit + records display. No backfill of historical matches, so `logMatch` keeps its incremental ELO; `editMatch`/`deleteMatch` already replay full history (correct when edits reorder time).

**Tech Stack:** Next.js (this repo's modified version — read `node_modules/next/dist/docs/` before touching framework APIs), React, Drizzle ORM + Postgres, Zod, Tailwind v4 + shadcn (`@/components/ui`), `lucide-react` icons, `vitest`.

**Design language (apply to every UI task):** Extend — do not reinvent — the existing public design system defined in `app/globals.css`:
- Fonts: `font-display` (IBM Plex Condensed, uppercase tracked headers), `font-mono` + `.nums` for scores/numbers, IBM Plex Sans body.
- Color tokens only (never hardcode hex): `bg-background`, `bg-card`, `border-border`, `text-foreground`, `text-muted-foreground`, `primary` (Drive blue, wins/CTAs), `destructive` (delete), `text-gain`/`text-loss`, `secondary`.
- Utilities: `.data-row`, `.section-header`, `.nums`. Cards = `rounded-lg border border-border bg-card`.
- Icons from `lucide-react` ONLY (phosphor is NOT installed). Match the look of `app/(public)/matches/page.tsx` and `app/(public)/players/[id]/page.tsx`.

**CRITICAL Next.js-version constraint (this repo):** A server action used directly as `<form action={serverAction}>` may NOT return a value. The established pattern (see `components/match-log-form.tsx`) is a `'use client'` wrapper: `<form action={handle}>` where `handle(formData)` calls the server action and inspects its `{ ok }` / `{ error }` return. ALL forms in this plan use that wrapper pattern. Never bind a value-returning server action straight to `<form action>`.

**DB migration note:** Task 1 adds a column. `npm run db:push` against the live Supabase is Mahir's call — do NOT run it against live data. Verify code via `vitest`, `npm run lint`, and `npx tsc --noEmit`. Per project convention, data-driven UI is verified with throwaway preview fixtures, never by seeding live Supabase.

---

### Task 1: Schema column + duration helpers + validator (pure logic, TDD)

**Files:**
- Modify: `lib/db/schema.ts` (add `durationSeconds` to `matches`)
- Modify: `lib/stats.ts` (add duration helpers)
- Modify: `lib/validators.ts` (extend `matchLogSchema`)
- Create: `lib/stats.duration.test.ts`
- Create: `lib/validators.test.ts`

- [ ] **Step 1: Write failing tests for duration helpers**

Create `lib/stats.duration.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  formatDuration,
  parseDurationInput,
  averageDurationForPlayer,
  computeDurationRecords,
  type DurationMatch,
} from './stats'

const m = (over: Partial<DurationMatch>): DurationMatch => ({
  id: 'm', playerAId: 'a', playerBId: 'b', winnerId: 'a',
  durationSeconds: 600, playedAt: new Date('2026-01-01'), ...over,
})

describe('formatDuration', () => {
  it('formats mm:ss with zero-padded seconds', () => {
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(65)).toBe('1:05')
    expect(formatDuration(600)).toBe('10:00')
  })
})

describe('parseDurationInput', () => {
  it('parses mm:ss', () => { expect(parseDurationInput('10:30')).toBe(630) })
  it('parses plain seconds', () => { expect(parseDurationInput('90')).toBe(90) })
  it('returns null for empty', () => { expect(parseDurationInput('')).toBeNull() })
  it('rejects bad seconds field', () => { expect(parseDurationInput('1:75')).toBeNull() })
  it('rejects non-numeric', () => { expect(parseDurationInput('abc')).toBeNull() })
})

describe('averageDurationForPlayer', () => {
  it('averages only the player\'s timed matches, rounded', () => {
    const matches = [
      m({ playerAId: 'a', durationSeconds: 600 }),
      m({ playerBId: 'a', playerAId: 'x', durationSeconds: 700 }),
      m({ playerAId: 'y', playerBId: 'z', durationSeconds: 999 }),
      m({ playerAId: 'a', durationSeconds: 0 }),
    ]
    expect(averageDurationForPlayer(matches, 'a')).toBe(650)
  })
  it('returns null when player has no timed matches', () => {
    expect(averageDurationForPlayer([m({ playerAId: 'a', durationSeconds: 0 })], 'a')).toBeNull()
  })
})

describe('computeDurationRecords', () => {
  it('finds longest, fastest, and total over timed matches', () => {
    const matches = [
      m({ id: '1', durationSeconds: 300 }),
      m({ id: '2', durationSeconds: 1200 }),
      m({ id: '3', durationSeconds: 0 }),
    ]
    const r = computeDurationRecords(matches)
    expect(r.longestMatch?.id).toBe('2')
    expect(r.fastestWin?.id).toBe('1')
    expect(r.totalCourtTimeSeconds).toBe(1500)
  })
  it('returns nulls and zero total when no timed matches', () => {
    const r = computeDurationRecords([m({ durationSeconds: 0 })])
    expect(r.longestMatch).toBeNull()
    expect(r.fastestWin).toBeNull()
    expect(r.totalCourtTimeSeconds).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm run test -- stats.duration`
Expected: FAIL (helpers not exported).

- [ ] **Step 3: Implement duration helpers in `lib/stats.ts`** (append to existing file, keep existing exports)

```ts
export type DurationMatch = {
  id: string
  playerAId: string
  playerBId: string
  winnerId: string
  durationSeconds: number
  playedAt: Date
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Accepts "mm:ss" or a plain seconds string. Returns total seconds, or null if invalid/empty. */
export function parseDurationInput(input: string): number | null {
  const trimmed = input.trim()
  if (trimmed === '') return null
  if (trimmed.includes(':')) {
    const [mm, ss] = trimmed.split(':')
    const min = Number(mm)
    const sec = Number(ss)
    if (!Number.isInteger(min) || !Number.isInteger(sec) || min < 0 || sec < 0 || sec > 59) {
      return null
    }
    return min * 60 + sec
  }
  const n = Number(trimmed)
  return Number.isInteger(n) && n >= 0 ? n : null
}

export function averageDurationForPlayer(
  matches: DurationMatch[],
  playerId: string
): number | null {
  const mine = matches.filter(
    (x) => (x.playerAId === playerId || x.playerBId === playerId) && x.durationSeconds > 0
  )
  if (mine.length === 0) return null
  const sum = mine.reduce((acc, x) => acc + x.durationSeconds, 0)
  return Math.round(sum / mine.length)
}

export type DurationRecords = {
  longestMatch: DurationMatch | null
  fastestWin: DurationMatch | null
  totalCourtTimeSeconds: number
}

export function computeDurationRecords(matches: DurationMatch[]): DurationRecords {
  const timed = matches.filter((x) => x.durationSeconds > 0)
  let longestMatch: DurationMatch | null = null
  let fastestWin: DurationMatch | null = null
  let totalCourtTimeSeconds = 0
  for (const x of timed) {
    totalCourtTimeSeconds += x.durationSeconds
    if (!longestMatch || x.durationSeconds > longestMatch.durationSeconds) longestMatch = x
    if (!fastestWin || x.durationSeconds < fastestWin.durationSeconds) fastestWin = x
  }
  return { longestMatch, fastestWin, totalCourtTimeSeconds }
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npm run test -- stats.duration`
Expected: PASS.

- [ ] **Step 5: Add `durationSeconds` column to `matches` in `lib/db/schema.ts`**

Inside the `matches = pgTable('matches', { ... })` definition, add after `bracketSlot`:

```ts
  durationSeconds: integer('duration_seconds'),
```

(`integer` is already imported.)

- [ ] **Step 6: Write failing test for extended `matchLogSchema`**

Create `lib/validators.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { matchLogSchema } from './validators'

const base = {
  playerAId: '11111111-1111-1111-1111-111111111111',
  playerBId: '22222222-2222-2222-2222-222222222222',
  sets: [[11, 7]],
}

describe('matchLogSchema duration + playedAt', () => {
  it('accepts optional durationSeconds and playedAt', () => {
    const r = matchLogSchema.safeParse({ ...base, durationSeconds: '630', playedAt: '2026-05-01T14:30' })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.durationSeconds).toBe(630)
      expect(r.data.playedAt instanceof Date).toBe(true)
    }
  })
  it('treats empty strings as undefined', () => {
    const r = matchLogSchema.safeParse({ ...base, durationSeconds: '', playedAt: '' })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.durationSeconds).toBeUndefined()
      expect(r.data.playedAt).toBeUndefined()
    }
  })
  it('rejects same player on both sides', () => {
    const r = matchLogSchema.safeParse({ ...base, playerBId: base.playerAId })
    expect(r.success).toBe(false)
  })
})
```

- [ ] **Step 7: Run test, verify it fails**

Run: `npm run test -- validators`
Expected: FAIL (durationSeconds/playedAt stripped or undefined-handling missing).

- [ ] **Step 8: Extend `matchLogSchema` in `lib/validators.ts`**

Replace the `matchLogSchema` definition with:

```ts
const emptyToUndefined = (v: unknown) => (v === '' || v == null ? undefined : v)

export const matchLogSchema = z
  .object({
    playerAId: z.string().uuid(),
    playerBId: z.string().uuid(),
    sets: z.array(setScoreSchema).min(1).max(7),
    playedAt: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
    durationSeconds: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().min(0).max(86400).optional()
    ),
  })
  .refine((d) => d.playerAId !== d.playerBId, {
    message: 'A player cannot play themselves',
  })
```

- [ ] **Step 9: Run all tests + typecheck**

Run: `npm run test && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 10: Commit**

```bash
git add lib/db/schema.ts lib/stats.ts lib/validators.ts lib/stats.duration.test.ts lib/validators.test.ts
git commit -m "feat: add match duration column, duration stat helpers, extended match validator"
```

---

### Task 2: Server actions — accept playedAt + duration, return instead of redirect

**Files:**
- Modify: `app/actions/matches.ts` (`logMatch`, `editMatch`)

**Context:** `logMatch` currently always stamps `playedAt = now`, computes incremental ELO, and `redirect('/')`. We keep incremental ELO (no backfill) but read optional `playedAt`/`durationSeconds`, persist them, and RETURN `{ ok: true }` so the new client form controls success UX (toast/reset/close dialog) instead of a hard redirect. `editMatch` already replays full history; extend it to also persist `playedAt`/`durationSeconds` and return `{ ok: true }` (it currently redirects to `/matches`). `deleteMatch` and `replayAllAndWrite` are unchanged — replay only rewrites ELO fields, so `durationSeconds` is preserved across edits/deletes.

- [ ] **Step 1: Update `logMatch`**

In `app/actions/matches.ts`, change the `matchLogSchema.safeParse({...})` call inside `logMatch` to include the two new fields:

```ts
  const parsed = matchLogSchema.safeParse({
    playerAId: formData.get('playerAId'),
    playerBId: formData.get('playerBId'),
    sets: setsRaw,
    playedAt: formData.get('playedAt'),
    durationSeconds: formData.get('durationSeconds'),
  })
```

In the `tx.insert(matches).values({...})` call, replace `playedAt: new Date(),` with:

```ts
      playedAt: parsed.data.playedAt ?? new Date(),
      durationSeconds: parsed.data.durationSeconds ?? null,
```

Then DELETE the final `redirect('/')` line and replace it with:

```ts
  return { ok: true }
```

(Keep all the `revalidatePath(...)` calls above it. Remove the now-unused `redirect` import only if no other function in the file uses it — `editMatch` currently does, so leave the import for now; Step 2 removes editMatch's redirect, after which you MUST remove the unused `redirect` import to satisfy lint.)

- [ ] **Step 2: Update `editMatch`**

Change `editMatch`'s `matchLogSchema.safeParse({...})` to include playedAt + durationSeconds (same four-field shape as above). Then change its `db.update(matches).set({...})` to also set the new fields:

```ts
  await db
    .update(matches)
    .set({
      playerAId: parsed.data.playerAId,
      playerBId: parsed.data.playerBId,
      winnerId: winner === 'A' ? parsed.data.playerAId : parsed.data.playerBId,
      setScores: parsed.data.sets,
      playedAt: parsed.data.playedAt ?? undefined,
      durationSeconds: parsed.data.durationSeconds ?? null,
    })
    .where(eq(matches.id, id))
```

(`playedAt: ... ?? undefined` leaves the existing timestamp untouched when the field is blank.)

After `replayAllAndWrite()` and the `revalidatePath(...)` calls, DELETE `redirect('/matches')` and replace with:

```ts
  return { ok: true }
```

- [ ] **Step 3: Remove the now-unused `redirect` import**

At the top of `app/actions/matches.ts`, delete `import { redirect } from 'next/navigation'` (no function uses it anymore).

- [ ] **Step 4: Verify typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors, no unused-import warnings.

- [ ] **Step 5: Commit**

```bash
git add app/actions/matches.ts
git commit -m "feat: persist playedAt + duration in logMatch/editMatch, return ok for client-driven UX"
```

---

### Task 3: Stopwatch component

**Files:**
- Create: `components/match-stopwatch.tsx`

**Context:** A controlled live stopwatch for the log-match form. The form owns the duration value (in seconds) as state; the stopwatch reads `value` and reports changes via `onChange`. It must reconcile with a manual `mm:ss` field that also writes the same state (handled in Task 4). Uses `formatDuration` from `lib/stats.ts` and `lucide-react` icons. `Date.now()` in browser runtime is fine here.

- [ ] **Step 1: Implement the component**

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Play, Pause, RotateCcw } from 'lucide-react'
import { formatDuration } from '@/lib/stats'

export function MatchStopwatch({
  value,
  onChange,
}: {
  value: number
  onChange: (seconds: number) => void
}) {
  const [running, setRunning] = useState(false)
  const startedAt = useRef<number | null>(null)
  const baseSeconds = useRef(value)

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      const elapsed =
        baseSeconds.current +
        Math.floor((Date.now() - (startedAt.current ?? Date.now())) / 1000)
      onChange(elapsed)
    }, 250)
    return () => clearInterval(id)
  }, [running, onChange])

  function toggle() {
    if (running) {
      setRunning(false)
    } else {
      baseSeconds.current = value
      startedAt.current = Date.now()
      setRunning(true)
    }
  }

  function reset() {
    setRunning(false)
    baseSeconds.current = 0
    onChange(0)
  }

  return (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-secondary/40 px-4 py-3">
      <span className="font-mono nums text-3xl font-semibold tabular-nums tracking-tight">
        {formatDuration(value)}
      </span>
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          aria-label={running ? 'Pause timer' : 'Start timer'}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
        >
          {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {running ? 'Pause' : 'Start'}
        </button>
        <button
          type="button"
          onClick={reset}
          aria-label="Reset timer"
          className="inline-flex items-center justify-center rounded-md border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground hover:bg-secondary"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/match-stopwatch.tsx
git commit -m "feat: add live match stopwatch component"
```

---

### Task 4: Redesign the match form (reusable create + edit) with stopwatch, date/time, manual duration

**Files:**
- Rewrite: `components/match-log-form.tsx`
- Modify: `app/admin/matches/new/page.tsx` (header styling only)

**Context:** Replace the plain form with a design-system version that ALSO works as the edit form inside the history dialog (Task 5). It integrates the stopwatch (Task 3) + a manual `mm:ss` field (both write one `durationSeconds` state), a `datetime-local` field (default = now in create mode), and reuses the client-wrapper action pattern. `logMatch`/`editMatch` now return `{ ok: true }` (Task 2).

- [ ] **Step 1: Rewrite `components/match-log-form.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { logMatch, editMatch } from '@/app/actions/matches'
import { MatchStopwatch } from '@/components/match-stopwatch'
import { formatDuration, parseDurationInput } from '@/lib/stats'

type PlayerOption = { id: string; name: string; nickname: string | null; currentElo: number }

export type MatchFormInitial = {
  id: string
  playerAId: string
  playerBId: string
  sets: Array<[number, number]>
  playedAt: Date | null
  durationSeconds: number | null
}

function toLocalDatetimeValue(d: Date): string {
  // yyyy-MM-ddThh:mm in local time, for <input type="datetime-local">
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function MatchLogForm({
  players,
  initial,
  onSuccess,
}: {
  players: PlayerOption[]
  initial?: MatchFormInitial
  onSuccess?: () => void
}) {
  const isEdit = !!initial
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [savedTick, setSavedTick] = useState(0)
  const [duration, setDuration] = useState<number>(initial?.durationSeconds ?? 0)
  const [durationText, setDurationText] = useState<string>(
    initial?.durationSeconds ? formatDuration(initial.durationSeconds) : ''
  )
  const [playedAt, setPlayedAt] = useState<string>(
    initial?.playedAt ? toLocalDatetimeValue(initial.playedAt) : ''
  )

  // Default the date/time to "now" on mount in create mode (avoids SSR hydration mismatch).
  useEffect(() => {
    if (!isEdit && playedAt === '') setPlayedAt(toLocalDatetimeValue(new Date()))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep the manual text field in sync when the stopwatch updates the value.
  useEffect(() => {
    setDurationText(duration > 0 ? formatDuration(duration) : '')
  }, [duration])

  function handleDurationText(text: string) {
    setDurationText(text)
    const parsed = parseDurationInput(text)
    if (parsed !== null) setDuration(parsed)
    if (text.trim() === '') setDuration(0)
  }

  async function handle(formData: FormData) {
    setError(null)
    setPending(true)
    const r = isEdit
      ? await editMatch(initial!.id, formData)
      : await logMatch(formData)
    setPending(false)
    if (r && 'error' in r) {
      setError(r.error)
      return
    }
    if (onSuccess) onSuccess()
    if (!isEdit) {
      setSavedTick((t) => t + 1)
      setDuration(0)
      setDurationText('')
      setPlayedAt(toLocalDatetimeValue(new Date()))
    }
  }

  const setDefaults = initial?.sets ?? []

  return (
    <form action={handle} className="space-y-6">
      <input type="hidden" name="durationSeconds" value={duration || ''} readOnly />

      {/* Players */}
      <div className="grid grid-cols-2 gap-4">
        {(['A', 'B'] as const).map((side) => {
          const fieldName = side === 'A' ? 'playerAId' : 'playerBId'
          const def = side === 'A' ? initial?.playerAId : initial?.playerBId
          return (
            <label key={side} className="block">
              <span className="font-display uppercase tracking-widest text-xs text-muted-foreground">
                Player {side}
              </span>
              <select
                name={fieldName}
                required
                defaultValue={def ?? ''}
                className="mt-1.5 w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">—</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.currentElo})
                  </option>
                ))}
              </select>
            </label>
          )
        })}
      </div>

      {/* Set scores */}
      <fieldset className="space-y-2">
        <legend className="section-header font-display w-full">Set scores</legend>
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="w-12 font-mono text-xs text-muted-foreground">Set {i + 1}</span>
            <input
              name={`set_${i}_a`}
              type="number"
              min={0}
              max={99}
              defaultValue={setDefaults[i]?.[0] ?? ''}
              className="w-20 rounded-md border border-input bg-card px-2 py-1.5 font-mono nums text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <span className="text-muted-foreground">–</span>
            <input
              name={`set_${i}_b`}
              type="number"
              min={0}
              max={99}
              defaultValue={setDefaults[i]?.[1] ?? ''}
              className="w-20 rounded-md border border-input bg-card px-2 py-1.5 font-mono nums text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        ))}
      </fieldset>

      {/* Duration */}
      <div className="space-y-2">
        <div className="section-header font-display">Game duration</div>
        <MatchStopwatch value={duration} onChange={setDuration} />
        <label className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">Or enter manually (mm:ss)</span>
          <input
            value={durationText}
            onChange={(e) => handleDurationText(e.target.value)}
            placeholder="12:30"
            inputMode="numeric"
            className="w-24 rounded-md border border-input bg-card px-2 py-1.5 font-mono nums text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
      </div>

      {/* Date/time */}
      <label className="block">
        <span className="font-display uppercase tracking-widest text-xs text-muted-foreground">
          Played at
        </span>
        <input
          type="datetime-local"
          name="playedAt"
          value={playedAt}
          onChange={(e) => setPlayedAt(e.target.value)}
          className="mt-1.5 block rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </label>

      {error && <div className="text-sm text-loss">{error}</div>}
      {!isEdit && savedTick > 0 && !error && (
        <div className="text-sm text-gain">Match saved. Log another below.</div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Save match'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Restyle `app/admin/matches/new/page.tsx` header to match the public design system**

Replace the `return (...)` block with:

```tsx
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8 md:px-6">
      <div className="mb-6">
        <p className="font-display uppercase tracking-[0.2em] text-xs text-primary mb-1">
          Score Entry
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight leading-none">
          Log a match
        </h1>
      </div>
      <MatchLogForm players={roster} />
    </main>
  )
```

- [ ] **Step 3: Verify typecheck + lint + build**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors. (`MatchLogForm`'s public call site in `new/page.tsx` still passes only `players`, which is valid since `initial`/`onSuccess` are optional.)

- [ ] **Step 4: Commit**

```bash
git add components/match-log-form.tsx app/admin/matches/new/page.tsx
git commit -m "feat: redesign reusable match form with stopwatch, manual duration, and played-at"
```

---

### Task 5: New /admin/history page with filters + inline edit/delete dialogs

**Files:**
- Create: `app/admin/history/page.tsx` (server component, filtered list)
- Create: `components/admin/match-row-actions.tsx` (client: edit + delete dialogs)
- Modify: `components/nav.tsx` (add "History" link)

**Context:** The management hub for completed matches. Filters come from URL search params (no client state). Each row shows date, players, score, winner highlight, duration, ELO deltas, and Edit/Delete controls. Edit opens a dialog reusing `MatchLogForm` with `initial` + `onSuccess` (closes dialog + `router.refresh()`). Delete opens a confirm dialog calling `deleteMatch(id)` (returns void → safe to bind, but we still wrap to manage pending + close). Uses the `Dialog` primitives from `@/components/ui/dialog` and `lucide-react` icons. Mirror the data-fetch/join pattern in `app/(public)/matches/page.tsx`.

- [ ] **Step 1: Create `components/admin/match-row-actions.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { MatchLogForm, type MatchFormInitial } from '@/components/match-log-form'
import { deleteMatch } from '@/app/actions/matches'

type PlayerOption = { id: string; name: string; nickname: string | null; currentElo: number }

export function MatchRowActions({
  initial,
  players,
  label,
}: {
  initial: MatchFormInitial
  players: PlayerOption[]
  label: string
}) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [pending, setPending] = useState(false)

  async function confirmDelete() {
    setPending(true)
    await deleteMatch(initial.id)
    setPending(false)
    setDeleteOpen(false)
    router.refresh()
  }

  return (
    <div className="flex items-center gap-1">
      {/* Edit */}
      <button
        type="button"
        onClick={() => setEditOpen(true)}
        aria-label="Edit match"
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-primary hover:bg-secondary"
      >
        <Pencil className="h-4 w-4" />
      </button>
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Edit match</DialogTitle>
            <DialogDescription>{label}</DialogDescription>
          </DialogHeader>
          <MatchLogForm
            players={players}
            initial={initial}
            onSuccess={() => {
              setEditOpen(false)
              router.refresh()
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <button
        type="button"
        onClick={() => setDeleteOpen(true)}
        aria-label="Delete match"
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-destructive hover:bg-secondary"
      >
        <Trash2 className="h-4 w-4" />
      </button>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Delete match?</DialogTitle>
            <DialogDescription>
              {label} — this removes the match and rebuilds ELO from the remaining history. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <button
                type="button"
                className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </DialogClose>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={pending}
              className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {pending ? 'Deleting…' : 'Delete match'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 2: Create `app/admin/history/page.tsx`**

```tsx
import Link from 'next/link'
import { db, matches, players, tournaments } from '@/lib/db'
import { and, asc, desc, eq, gte, ilike, isNotNull, lte, or, type SQL } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { formatDuration } from '@/lib/stats'
import { MatchRowActions } from '@/components/admin/match-row-actions'

export const dynamic = 'force-dynamic'

export default async function AdminHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ playerId?: string; from?: string; to?: string; type?: string; q?: string }>
}) {
  const sp = await searchParams
  const a = alias(players, 'a')
  const b = alias(players, 'b')

  const conditions: SQL[] = [isNotNull(matches.playedAt)]
  if (sp.playerId) {
    conditions.push(or(eq(matches.playerAId, sp.playerId), eq(matches.playerBId, sp.playerId))!)
  }
  if (sp.from) conditions.push(gte(matches.playedAt, new Date(sp.from)))
  if (sp.to) conditions.push(lte(matches.playedAt, new Date(sp.to + 'T23:59:59')))
  if (sp.type === 'tournament') conditions.push(isNotNull(matches.tournamentId))
  if (sp.type === 'casual') conditions.push(eq(matches.tournamentId, matches.tournamentId)) // placeholder; replaced below

  // 'casual' = no tournament. Build explicitly to avoid the placeholder above.
  const baseConditions = conditions.filter((_, i) => !(sp.type === 'casual' && i === conditions.length - 1))
  if (sp.type === 'casual') {
    const { isNull } = await import('drizzle-orm')
    baseConditions.push(isNull(matches.tournamentId))
  }
  if (sp.q) baseConditions.push(or(ilike(a.name, `%${sp.q}%`), ilike(b.name, `%${sp.q}%`))!)

  const rows = await db
    .select({
      id: matches.id,
      playedAt: matches.playedAt,
      setScores: matches.setScores,
      winnerId: matches.winnerId,
      durationSeconds: matches.durationSeconds,
      tournamentId: matches.tournamentId,
      eloAAfter: matches.eloAAfter,
      eloBAfter: matches.eloBAfter,
      aId: a.id,
      aName: a.name,
      bId: b.id,
      bName: b.name,
    })
    .from(matches)
    .innerJoin(a, eq(matches.playerAId, a.id))
    .innerJoin(b, eq(matches.playerBId, b.id))
    .where(and(...baseConditions))
    .orderBy(desc(matches.playedAt))
    .limit(300)

  const roster = await db
    .select({ id: players.id, name: players.name, nickname: players.nickname, currentElo: players.currentElo })
    .from(players)
    .orderBy(asc(players.name))

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 md:px-6">
      <div className="mb-6">
        <p className="font-display uppercase tracking-[0.2em] text-xs text-primary mb-1">Records Office</p>
        <h1 className="font-display text-3xl font-bold tracking-tight leading-none">Match history</h1>
      </div>

      {/* Filters */}
      <form className="mb-6 grid grid-cols-1 gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-5">
        <label className="block sm:col-span-1">
          <span className="font-display uppercase tracking-widest text-[10px] text-muted-foreground">Player</span>
          <select name="playerId" defaultValue={sp.playerId ?? ''} className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm">
            <option value="">All players</option>
            {roster.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="font-display uppercase tracking-widest text-[10px] text-muted-foreground">From</span>
          <input type="date" name="from" defaultValue={sp.from ?? ''} className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm" />
        </label>
        <label className="block">
          <span className="font-display uppercase tracking-widest text-[10px] text-muted-foreground">To</span>
          <input type="date" name="to" defaultValue={sp.to ?? ''} className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm" />
        </label>
        <label className="block">
          <span className="font-display uppercase tracking-widest text-[10px] text-muted-foreground">Type</span>
          <select name="type" defaultValue={sp.type ?? ''} className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm">
            <option value="">All</option>
            <option value="tournament">Tournament</option>
            <option value="casual">Casual</option>
          </select>
        </label>
        <label className="block">
          <span className="font-display uppercase tracking-widest text-[10px] text-muted-foreground">Search</span>
          <input name="q" defaultValue={sp.q ?? ''} placeholder="Player name" className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm" />
        </label>
        <div className="flex items-end gap-2 sm:col-span-5">
          <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
            Apply filters
          </button>
          <Link href="/admin/history" className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
            Clear
          </Link>
        </div>
      </form>

      {/* Results */}
      <ul className="rounded-lg border border-border overflow-hidden bg-card">
        {rows.map((r) => {
          const aWon = r.winnerId === r.aId
          const sets = (r.setScores as Array<[number, number]>) ?? []
          return (
            <li key={r.id} className="data-row text-sm">
              <span className="hidden w-24 shrink-0 font-mono text-[11px] text-muted-foreground sm:block">
                {r.playedAt?.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
              <span className={`shrink-0 ${aWon ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{r.aName}</span>
              <span className="flex-1 text-center font-mono nums text-xs text-muted-foreground">
                {sets.map(([sa, sb]) => `${sa}–${sb}`).join('  ')}
              </span>
              <span className={`shrink-0 ${!aWon ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{r.bName}</span>
              <span className="hidden w-16 shrink-0 text-right font-mono text-[11px] text-muted-foreground sm:block">
                {r.durationSeconds ? formatDuration(r.durationSeconds) : '—'}
              </span>
              {r.tournamentId && (
                <span className="hidden shrink-0 rounded-full bg-secondary px-2 py-0.5 font-display text-[9px] uppercase tracking-wider text-secondary-foreground sm:inline">
                  Cup
                </span>
              )}
              <MatchRowActions
                players={roster}
                label={`${r.aName} vs ${r.bName}`}
                initial={{
                  id: r.id,
                  playerAId: r.aId,
                  playerBId: r.bId,
                  sets,
                  playedAt: r.playedAt,
                  durationSeconds: r.durationSeconds,
                }}
              />
            </li>
          )
        })}
        {rows.length === 0 && (
          <li className="px-3 py-4 text-sm text-muted-foreground">No matches found for these filters.</li>
        )}
      </ul>
    </main>
  )
}
```

> **Implementer note:** The `sp.type === 'casual'` placeholder logic above is intentionally awkward to keep the code block self-contained. Prefer this cleaner equivalent — build the conditions array directly: start with `[isNotNull(matches.playedAt)]`, then push player/from/to, then for `type` push `isNotNull(matches.tournamentId)` (tournament) or `isNull(matches.tournamentId)` (casual) by importing `isNull` at the top, then push the `q` ilike. Import `isNull` from `drizzle-orm` at the top rather than dynamically. Remove the placeholder/`baseConditions` filter dance. The end behavior must match: all filters AND together, casual = no tournamentId, tournament = has tournamentId.

- [ ] **Step 3: Add "History" link to `components/nav.tsx`**

In `AdminNav`, add this link after the "Tournament" link (before the sign-out form):

```tsx
      <Link
        href="/admin/history"
        className="px-4 py-3 text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors duration-150"
      >
        History
      </Link>
```

- [ ] **Step 4: Verify typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors. Confirm the filter query compiles with proper Drizzle `and(...)`/`or(...)` typing (use the cleaner `isNull` approach from the implementer note).

- [ ] **Step 5: Commit**

```bash
git add app/admin/history/page.tsx components/admin/match-row-actions.tsx components/nav.tsx
git commit -m "feat: add filterable admin match history with inline edit/delete dialogs"
```

---

### Task 6: Profile editing on the admin players page

**Files:**
- Create: `components/admin/player-edit-dialog.tsx` (client)
- Rewrite: `app/admin/players/page.tsx` (design uplift + Edit button)

**Context:** `updatePlayer(id, formData)` already exists and returns `{ ok }`/`{ error }`. Add an Edit dialog (name, nickname, bio, email, photo) per player, keeping the existing activate/deactivate toggle. Uses the client-wrapper action pattern + `router.refresh()` on success. Lift the page to the design system.

- [ ] **Step 1: Create `components/admin/player-edit-dialog.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { updatePlayer } from '@/app/actions/players'

type PlayerData = {
  id: string
  name: string
  nickname: string | null
  bio: string | null
  email: string | null
}

export function PlayerEditDialog({ player }: { player: PlayerData }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handle(formData: FormData) {
    setError(null)
    setPending(true)
    const r = await updatePlayer(player.id, formData)
    setPending(false)
    if (r && 'error' in r) {
      setError(r.error)
      return
    }
    setOpen(false)
    router.refresh()
  }

  const field =
    'mt-1.5 w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'
  const labelText = 'font-display uppercase tracking-widest text-xs text-muted-foreground'

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-primary hover:underline"
      >
        Edit
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Edit {player.name}</DialogTitle>
          </DialogHeader>
          <form action={handle} className="space-y-4">
            <label className="block">
              <span className={labelText}>Name</span>
              <input name="name" required defaultValue={player.name} className={field} />
            </label>
            <label className="block">
              <span className={labelText}>Nickname</span>
              <input name="nickname" defaultValue={player.nickname ?? ''} className={field} />
            </label>
            <label className="block">
              <span className={labelText}>Bio</span>
              <textarea name="bio" defaultValue={player.bio ?? ''} rows={3} className={field} />
            </label>
            <label className="block">
              <span className={labelText}>Email</span>
              <input name="email" type="email" defaultValue={player.email ?? ''} className={field} />
            </label>
            <label className="block">
              <span className={labelText}>Photo (replace)</span>
              <input name="photo" type="file" accept="image/*" className="mt-1.5 block w-full text-sm text-muted-foreground" />
            </label>
            {error && <div className="text-sm text-loss">{error}</div>}
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {pending ? 'Saving…' : 'Save profile'}
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
```

- [ ] **Step 2: Rewrite `app/admin/players/page.tsx`** (design uplift + Edit, keep toggle)

```tsx
import { db, players } from '@/lib/db'
import { desc } from 'drizzle-orm'
import { setPlayerActive } from '@/app/actions/players'
import { PlayerAvatar } from '@/components/player-avatar'
import { PlayerEditDialog } from '@/components/admin/player-edit-dialog'

export const dynamic = 'force-dynamic'

export default async function AdminPlayersPage() {
  const all = await db.select().from(players).orderBy(desc(players.createdAt))

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 md:px-6">
      <div className="mb-6">
        <p className="font-display uppercase tracking-[0.2em] text-xs text-primary mb-1">Roster</p>
        <h1 className="font-display text-3xl font-bold tracking-tight leading-none">Players</h1>
      </div>

      <ul className="rounded-lg border border-border overflow-hidden bg-card">
        {all.map((p) => (
          <li key={p.id} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0">
            <PlayerAvatar name={p.name} photoUrl={p.photoUrl} />
            <div className="min-w-0 flex-1">
              <div className="font-medium">{p.name}</div>
              <div className="font-mono text-[11px] text-muted-foreground">
                {p.createdVia} · ELO {p.currentElo} · {p.active ? 'active' : 'inactive'}
              </div>
            </div>
            <PlayerEditDialog
              player={{ id: p.id, name: p.name, nickname: p.nickname, bio: p.bio, email: p.email }}
            />
            <form
              action={async () => {
                'use server'
                await setPlayerActive(p.id, !p.active)
              }}
            >
              <button type="submit" className="text-sm text-muted-foreground hover:text-foreground">
                {p.active ? 'Deactivate' : 'Reactivate'}
              </button>
            </form>
          </li>
        ))}
      </ul>
    </main>
  )
}
```

- [ ] **Step 3: Verify typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/admin/player-edit-dialog.tsx app/admin/players/page.tsx
git commit -m "feat: admin profile editing dialog + players page design uplift"
```

---

### Task 7: Duration stats display (per-match, player average, records)

**Files:**
- Modify: `app/(public)/matches/page.tsx` (per-match duration column + Records block)
- Modify: `app/(public)/players/[id]/page.tsx` (avg duration stat)

**Context:** Surface the duration data. `formatDuration`, `averageDurationForPlayer`, `computeDurationRecords`, and `DurationMatch` come from `lib/stats.ts` (Task 1). Keep additions consistent with existing markup.

- [ ] **Step 1: Add a duration column + Records block to `app/(public)/matches/page.tsx`**

First, extend the select to include `durationSeconds: matches.durationSeconds,` and `winnerId`/player ids already present. Add `playerAId`/`playerBId` to the select for records mapping:

```ts
      durationSeconds: matches.durationSeconds,
      playerAId: a.id,
      playerBId: b.id,
```

(Note `aId`/`bId` already alias `a.id`/`b.id`; reuse those for records — no need to duplicate. Use `r.aId`/`r.bId` when building `DurationMatch`.)

Import the helpers at the top:

```ts
import { computeDurationRecords, formatDuration, type DurationMatch } from '@/lib/stats'
```

Before the `return (`, compute records from the fetched rows:

```ts
  const durationMatches: DurationMatch[] = rows
    .filter((r) => r.durationSeconds && r.playedAt)
    .map((r) => ({
      id: r.id,
      playerAId: r.aId,
      playerBId: r.bId,
      winnerId: r.winnerId!,
      durationSeconds: r.durationSeconds!,
      playedAt: r.playedAt!,
    }))
  const records = computeDurationRecords(durationMatches)
```

Immediately after the page header `<div className="mb-6">...</div>`, insert a Records block (only when there is timed data):

```tsx
      {records.totalCourtTimeSeconds > 0 && (
        <div className="mb-6 grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <div className="font-display uppercase tracking-widest text-[10px] text-muted-foreground">Longest match</div>
            <div className="font-mono nums text-xl font-semibold">
              {records.longestMatch ? formatDuration(records.longestMatch.durationSeconds) : '—'}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <div className="font-display uppercase tracking-widest text-[10px] text-muted-foreground">Fastest game</div>
            <div className="font-mono nums text-xl font-semibold">
              {records.fastestWin ? formatDuration(records.fastestWin.durationSeconds) : '—'}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <div className="font-display uppercase tracking-widest text-[10px] text-muted-foreground">Total court time</div>
            <div className="font-mono nums text-xl font-semibold">
              {formatDuration(records.totalCourtTimeSeconds)}
            </div>
          </div>
        </div>
      )}
```

Then in the match `<li>`, add a duration span just before the closing right-side rating pill (after the player B link, before the final win marker span):

```tsx
              <span className="hidden w-14 shrink-0 text-right font-mono text-[11px] text-muted-foreground sm:block">
                {r.durationSeconds ? formatDuration(r.durationSeconds) : ''}
              </span>
```

- [ ] **Step 2: Add average duration to `app/(public)/players/[id]/page.tsx`**

Import at top:

```ts
import { averageDurationForPlayer, formatDuration, type DurationMatch } from '@/lib/stats'
```

After `playerMatches` is fetched, compute the average:

```ts
  const durationMatches: DurationMatch[] = playerMatches
    .filter((m) => m.durationSeconds)
    .map((m) => ({
      id: m.id,
      playerAId: m.playerAId!,
      playerBId: m.playerBId!,
      winnerId: m.winnerId!,
      durationSeconds: m.durationSeconds!,
      playedAt: m.playedAt!,
    }))
  const avgDuration = averageDurationForPlayer(durationMatches, id)
```

In the "Key stats row" `<div className="mt-3 flex ...">`, add after the win-% span:

```tsx
              {avgDuration !== null && (
                <span className="font-mono nums text-muted-foreground">
                  avg {formatDuration(avgDuration)}/game
                </span>
              )}
```

- [ ] **Step 3: Verify typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "app/(public)/matches/page.tsx" "app/(public)/players/[id]/page.tsx"
git commit -m "feat: surface match duration — per-match, player average, and records"
```

---

### Task 8: Admin home polish + final build

**Files:**
- Rewrite: `app/admin/page.tsx` (design uplift + link the new sections)

**Context:** Lift the admin landing page to the design system and add quick links so the new history/management surfaces are discoverable. Keep the existing "Rebuild ELO" action.

- [ ] **Step 1: Rewrite `app/admin/page.tsx`**

```tsx
import Link from 'next/link'
import { rebuildElo } from '@/app/actions/matches'

const links = [
  { href: '/admin/matches/new', title: 'Log a match', desc: 'Record a game with a live stopwatch' },
  { href: '/admin/history', title: 'Match history', desc: 'Search, filter, edit, and delete matches' },
  { href: '/admin/players', title: 'Players', desc: 'Edit profiles and toggle active status' },
  { href: '/admin/tournaments/new', title: 'New tournament', desc: 'Seed and run a bracket' },
]

export default function AdminHomePage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 md:px-6">
      <div className="mb-6">
        <p className="font-display uppercase tracking-[0.2em] text-xs text-primary mb-1">Pit Wall</p>
        <h1 className="font-display text-3xl font-bold tracking-tight leading-none">Admin dashboard</h1>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-lg border border-border bg-card px-4 py-4 transition-colors hover:border-primary hover:bg-secondary/40"
          >
            <div className="font-display font-semibold">{l.title}</div>
            <div className="text-sm text-muted-foreground">{l.desc}</div>
          </Link>
        ))}
      </div>

      <div className="mt-8 rounded-lg border border-border bg-card p-4">
        <div className="section-header font-display">Maintenance</div>
        <form action={rebuildElo}>
          <button
            type="submit"
            className="rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary"
          >
            Rebuild ELO from match history
          </button>
        </form>
        <p className="mt-2 text-sm text-muted-foreground">
          Replays the entire match history and rewrites all per-match ELO snapshots and each
          player&apos;s current ELO. Safe to run anytime.
        </p>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Full verification**

Run: `npm run test && npx tsc --noEmit && npm run lint && npm run build`
Expected: tests pass, no type errors, lint clean, production build succeeds.

- [ ] **Step 3: Commit**

```bash
git add app/admin/page.tsx
git commit -m "feat: admin home dashboard uplift with section links"
```

---

## Post-implementation (Mahir / human)

- Run `npm run db:push` to apply the `duration_seconds` column to Supabase (NOT run by agents).
- Verify the new screens against throwaway preview fixtures (not live Supabase), per project convention.

## Out of scope (this phase)

- Manual ELO override on profiles (ELO stays derived).
- Backfilling historical matches in bulk.
- Tournament-record / tournament editing UI beyond the history filter (tournament matches are editable via history like any match).
- Any extra duration stat beyond per-match / average / records (the "something else" option) — revisit if Mahir specifies one.

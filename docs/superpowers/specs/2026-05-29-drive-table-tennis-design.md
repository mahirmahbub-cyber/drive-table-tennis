# Drive Table Tennis — Design Spec

**Date:** 2026-05-29
**Owner:** Mahir Mahbub
**Status:** Draft for review

## 1. Purpose & scope

A single-admin web app for tracking Drive.com.au's office table tennis: ongoing ladder with continuous ELO, occasional single-elimination tournaments seeded from current ELO, and dashboards covering leaderboard, form, head-to-head, and "win/loss vs capability" stats.

**Scale:** ~10-50 players. One admin (Mahir) records all matches and runs tournaments. Anyone with the URL can view stats and brackets.

**Hosting:** Vercel (web) + Supabase Postgres (free tier) + Vercel Blob (player photos).

**Guiding principle:** simplicity. One obvious way to do each thing. No abstraction layers added "for later". No infrastructure ceremony beyond a one-page setup checklist.

**Design quality:** the frontend must look and feel distinctly designed — clean, considered, with tasteful motion — not a generic AI/dashboard template. See Section 17 (Design language).

## 2. Features → implementation map

| Requested feature | How it's covered |
|---|---|
| Analyse games | Match history, per-player profile pages, dashboards |
| Record players | Players CRUD by admin **plus** self-serve `/join` page for anyone to create their own profile |
| Self-serve profile creation | Public `/join` form: name, nickname, bio, photo upload (Vercel Blob). Instant; no approval gate. |
| Assign seedings | Auto-seed by current ELO; admin can drag-reorder before starting a tournament |
| Record statistics and wins | Log a match (players + set scores + winner); stats derived |
| ELO ratings + tournament matchups | Standard ELO (K=32, start 1200); single-elim bracket |
| Dashboards for stats | Leaderboard, in-form, recent matches, most active, head-to-head matrix |
| Overall + vs-capability W/L | Aggregate `matches` by opponent ELO bucket at match time (higher / similar / lower) |

## 3. Tech stack

- **Next.js 15** (App Router, TypeScript, Server Components, Server Actions)
- **Tailwind CSS + shadcn/ui** for UI primitives
- **Drizzle ORM** for Postgres access
- **Recharts** for the ELO trend chart and sparklines
- **Framer Motion** for tasteful UI motion (see Section 17)
- **Vitest** for the small unit-test suite
- **Supabase Postgres** as the database (accessed via standard Postgres connection string, not Supabase client libraries — keeps us portable and simple)
- **Vercel Blob** for player photo storage (auto-injects `BLOB_READ_WRITE_TOKEN` on Vercel)
- **Vercel** for deployment

Explicitly rejected:
- Prisma (heavier than needed; Drizzle is smaller-surface).
- Supabase JS client (we only need raw Postgres; using their SDK adds a layer we don't want).
- Auth providers (NextAuth, Clerk, etc.) — single password is sufficient.
- Background jobs / queues / caching — every read hits Postgres.

## 4. Architecture

```
┌────────────────────────────────────────────┐
│  Browser                                   │
│  - Public: /, /players, /matches,          │
│    /tournaments                            │
│  - /admin/*: gated by single password      │
└────────────────────────────────────────────┘
                  │  HTTPS
                  ▼
┌────────────────────────────────────────────┐
│  Next.js 15 on Vercel                      │
│  - App Router, Server Components           │
│  - Server Actions for mutations            │
│  - Drizzle queries inline in actions       │
└────────────────────────────────────────────┘
                  │  Postgres wire protocol
                  ▼
┌────────────────────────────────────────────┐
│  Supabase Postgres (free tier)             │
│  - 4 tables: players, matches,             │
│    tournaments, tournament_entries         │
└────────────────────────────────────────────┘
```

Key architectural decisions:

- **Server Actions over a REST API.** Single-admin app; collocating mutations with the UI keeps things readable.
- **No service / repository layer.** Drizzle queries live directly in Server Actions. Three layers maximum: page → action → query.
- **Admin auth = single password env var.** A Server Action verifies the password and sets an HTTP-only cookie; middleware checks the cookie on `/admin/*` and redirects to `/admin/login` if missing. No user accounts, no roles, no JWTs.
- **ELO is recomputable from match history.** `current_elo` on `players` is a denormalised cache. The source of truth is the match history (`elo_*_after` on each match). A manual "Rebuild ELO" button on the admin dashboard replays matches in chronological order to repair drift.
- **Single environment.** No staging, no preview-specific config. Vercel preview deployments hit the same Supabase database; that's fine at this scale.

## 5. Data model

Four tables. Everything required for stats is derivable from these.

```sql
-- 1. Players
players (
  id            uuid pk,
  name          text not null,           -- full name
  nickname      text nullable,           -- displayed alongside name (optional)
  bio           text nullable,           -- short description, ~200 char max
  email         text unique nullable,
  photo_url     text nullable,           -- Vercel Blob URL (uploaded via /join or admin)
  current_elo   int  default 1200,       -- denormalised cache
  active        bool default true,       -- soft delete
  created_via   text default 'admin',    -- 'admin' | 'self_serve' — diagnostic
  created_at    timestamptz default now()
)

-- 2. Matches (casual AND tournament matches both live here)
matches (
  id              uuid pk,
  player_a_id     uuid fk players nullable,    -- nullable for un-determined
  player_b_id     uuid fk players nullable,    -- tournament bracket slots
  winner_id       uuid fk players nullable,    -- null until played
  set_scores      jsonb nullable,              -- e.g. [[11,8],[11,6],[9,11],[11,7]]
  played_at       timestamptz nullable,
  tournament_id   uuid fk tournaments nullable,
  round           int nullable,                -- 1 = first round; final round = ceil(log2(N))
  bracket_slot    int nullable,                -- 0-indexed within round
  elo_a_before    int nullable,
  elo_b_before    int nullable,
  elo_a_after     int nullable,
  elo_b_after     int nullable,
  created_at      timestamptz default now()
)

-- 3. Tournaments
tournaments (
  id            uuid pk,
  name          text not null,
  status        text not null,    -- 'draft' | 'in_progress' | 'completed'
  created_at    timestamptz default now(),
  started_at    timestamptz nullable,
  completed_at  timestamptz nullable
)

-- 4. Tournament entries (roster + seeds)
tournament_entries (
  id              uuid pk,
  tournament_id   uuid fk tournaments,
  player_id       uuid fk players,
  seed            int not null,
  unique(tournament_id, player_id)
)
```

**Why these shapes:**

- **One `matches` table covers everything.** Casual matches have `tournament_id = null`. Tournament matches have it set, along with `round` and `bracket_slot`. No duplicate "tournament_match" table.
- **`current_elo` is denormalised on `players`** for a fast leaderboard query. Truth lives in the latest match row's `elo_*_after`. If they ever disagree, the Rebuild ELO action wins.
- **`elo_*_before/after` on every match enables "vs capability" stats trivially** — we already know what each player's rating was when the match happened, so bucketing opponents into higher/similar/lower-rated requires no joins.
- **Tournament brackets are pre-created on tournament start.** Round 2+ matches start with null `player_a_id` / `player_b_id` and get populated as previous-round winners are recorded. The UI just queries all matches by `tournament_id` ordered by `(round, bracket_slot)`.

## 6. Derived statistics

All computed at read time from `matches` + `players`. No additional tables.

| Stat | Query shape |
|---|---|
| Leaderboard | `SELECT * FROM players WHERE active ORDER BY current_elo DESC` |
| Player ELO over time | `SELECT played_at, elo_*_after FROM matches WHERE player_*_id = $player ORDER BY played_at` |
| Head-to-head | Aggregate matches by `(player_a_id, player_b_id)` (canonicalising order) |
| W/L vs higher/similar/lower | Group player's matches by opponent ELO bucket at match time (gap > +100, ±100, < -100) |
| Activity heatmap | Matches grouped by `date_trunc('day', played_at)` |
| Tournament bracket | `SELECT * FROM matches WHERE tournament_id = $t ORDER BY round, bracket_slot` |

### In-form players

Primary metric: **ELO change over the last 14 days**, with a minimum 3 matches played in that window to qualify.

```
form_score(player) = current_elo − (earliest elo_*_before for that player in the window)
```

Secondary toggle: **Above-expectation score** — for each match in the window, compute the expected score using ELO (`1 / (1 + 10^((opp − me) / 400))`), subtract from actual (1 if win, 0 if loss), and sum. Tells you who is genuinely beating opponents they "shouldn't" be, controlling for opponent strength. We get this effectively free because every match stores `elo_*_before`.

UI: "In Form (last 14 days)" card on the home dashboard, top 5 players, with a toggle for the above-expectation view. Each row: name · ΔELO · W-L · sparkline of last 10 results.

## 7. Pages & flows

### Routes

```
PUBLIC (no auth)
  /                         Home dashboard
  /join                     Self-serve profile creation (name, nickname, bio, photo)
  /players                  Roster + search
  /players/[id]             Player profile (ELO chart, W/L, vs-capability, H2H, history)
  /matches                  All matches, paginated, filterable by player and tournament
  /tournaments              List of tournaments
  /tournaments/[id]         Bracket view + standings

ADMIN (single password, cookie session)
  /admin/login              Password form
  /admin/players            Create / edit / deactivate
  /admin/matches/new        Log casual match
  /admin/matches/[id]/edit  Fix typos (triggers ELO recompute from that match forward)
  /admin/tournaments/new    Create + pick players + auto-seed + start
  /admin/tournaments/[id]   Manage in-progress: record results, advance winners
  /admin                    Dashboard with "Rebuild ELO" button as escape hatch
```

11 pages total. Admin nav has 3 links: Players · Matches · Tournaments.

### Flow 1 — Log a casual match (the most-used flow)

```
/admin/matches/new
  Player A: [combobox of active players, keyboard searchable]
  Player B: [combobox]
  Sets:    [11-8] [11-6] [9-11] [11-7]   (up to 5 set inputs, optional)
  Winner:  inferred from sets (player with more set wins), shown for confirmation
  [Save]
```

Server Action steps (single transaction):
1. Validate that A ≠ B, sets are non-empty, winner is unambiguous from sets.
2. Read current ELO for A and B.
3. Call `applyMatch(eloA, eloB, winner)` to get new ratings.
4. Insert `matches` row with all ELO fields populated.
5. Update `players.current_elo` for both.
6. Redirect to `/` with a toast: "ELO: Alice 1240→1252, Bob 1260→1248".

### Flow 2 — Run a tournament

**Create:**
```
/admin/tournaments/new
  Name: [Q1 Tournament]
  Players: [✓ multi-select from active roster]
  [Auto-seed by ELO]    → assigns seeds 1..N by current_elo DESC
  Drag to reorder seeds (override is allowed)
  [Start]
```

**On Start:**
1. Insert `tournaments` row with `status = 'in_progress'`, `started_at = now()`.
2. Insert one `tournament_entries` row per player with their seed.
3. Call `generateBracket(seededPlayerIds)` → returns all bracket match rows for all rounds (R1 with players filled, later rounds with null players, BYE matches with `winner_id` pre-set).
4. Batch insert all match rows.
5. Redirect to `/admin/tournaments/[id]`.

**Manage:**
- Bracket view shows all rounds. Each match slot is clickable once both players are known.
- Click a slot → modal to enter set scores → Save.
- Save action: compute ELO delta (same `applyMatch` path), update both players, write match result, find next-round slot via `(round + 1, floor(slot / 2))` and write the winner into `player_a_id` (if `slot % 2 == 0`) or `player_b_id`.
- When the final is recorded, set `tournament.status = 'completed'` and `completed_at = now()`.

### Flow 3 — Self-serve profile creation (public `/join`)

A public page anyone with the URL can use. No auth, no approval — instant.

```
/join
  Photo:       [drag-and-drop / file picker, optional, image only, ≤2 MB]
  Name:        [required, 1-60 chars]
  Nickname:    [optional, 1-30 chars]
  Bio:         [optional, ≤200 chars]
  Email:       [optional]
  [Create profile]
```

Server Action steps:
1. Validate inputs (length, image MIME type, file size).
2. If a photo was provided, upload to Vercel Blob → get public URL.
3. Insert `players` row with `created_via = 'self_serve'`, `current_elo = 1200`, `active = true`.
4. Redirect to `/players/[id]` with a "You're in!" toast.

Anti-abuse for v1: none. Trust-based. If someone creates a junk profile, the admin can deactivate it from `/admin/players` (toggles `active = false`, removes from leaderboard and from match-logging comboboxes). Existing matches involving a deactivated player are preserved for historical integrity.

The same upload widget is reused on `/admin/players` (admin edit) so the admin can also update names/photos.

### Flow 4 — Edit / delete a match

Rare but important. ELO is path-dependent, so editing match #47 invalidates ELO for all matches after #47.

The server action that edits or deletes a match:
1. Apply the edit / deletion to the row.
2. Re-read all matches from #47 onward in chronological order.
3. For each, recompute ELO from scratch using each player's running rating, rewriting `elo_*_before/after` on the match row and updating each player's `current_elo` at the end.
4. Commit transactionally.

For 50 players × a few hundred matches this is sub-100ms.

The same recompute function is called by the manual "Rebuild ELO" button on `/admin`, which replays the entire match history from the beginning. Escape hatch.

## 8. ELO + bracket logic

### ELO

Standard ELO formula. K factor 32. Starting rating 1200.

```ts
// lib/elo.ts — pure, deterministic, no DB
const K_FACTOR = 32
const STARTING_ELO = 1200

export function applyMatch(
  eloA: number,
  eloB: number,
  winner: 'A' | 'B'
): { eloA: number; eloB: number; deltaA: number; deltaB: number } {
  const expectedA = 1 / (1 + 10 ** ((eloB - eloA) / 400))
  const expectedB = 1 - expectedA
  const scoreA = winner === 'A' ? 1 : 0
  const scoreB = 1 - scoreA
  const deltaA = Math.round(K_FACTOR * (scoreA - expectedA))
  const deltaB = Math.round(K_FACTOR * (scoreB - expectedB))
  return { eloA: eloA + deltaA, eloB: eloB + deltaB, deltaA, deltaB }
}
```

**Decisions:**
- No set-count weighting. A 3-0 sweep counts the same as 3-2. Margin-of-victory ELO can come later if anyone asks.
- No provisional period for new players. They start at 1200 and the rating moves organically with K=32.
- K is a single exported constant.

### Bracket generation (single elimination)

```ts
// lib/bracket.ts — pure, deterministic, no DB
export function generateBracket(
  seededPlayerIds: string[]
): Array<{
  round: number
  slot: number
  playerAId: string | null
  playerBId: string | null
  winnerId: string | null   // pre-set for BYE matches
}>
```

Algorithm:
- Round up N to the next power of 2. The added slots are BYEs, assigned to the top seeds.
- Use the standard recursive bracket pairing (so seeds 1 and 2 only meet in the final):
  - N=2: (1, 2)
  - N=4: (1, 4) (2, 3)
  - N=8: (1, 8) (4, 5) (2, 7) (3, 6)
  - N=16: (1, 16) (8, 9) (4, 13) (5, 12) (2, 15) (7, 10) (3, 14) (6, 11)
- A BYE means the opposing slot is null and the seeded player auto-advances. The match row is inserted with `winner_id` pre-set and `played_at = started_at`.

## 9. Authentication

Single admin password.

- `ADMIN_PASSWORD` env var holds the password (plaintext is fine at this scale; it's an office leaderboard).
- `/admin/login` posts the password to a Server Action that, on match, sets an HTTP-only signed cookie `admin_session` and redirects to `/admin`.
- Middleware (`middleware.ts`) checks for the cookie on `/admin/*` and redirects to `/admin/login` if missing or invalid.
- `SESSION_SECRET` env var signs the cookie.
- Logout = clear cookie + redirect to `/`.

## 10. Environment variables

Five variables. One `.env` file locally; the same five set in Vercel project settings (the Blob token is auto-injected on Vercel once you create the Blob store).

```
DATABASE_URL=postgresql://...            # Supabase connection string
ADMIN_PASSWORD=...                       # whatever Mahir picks
SESSION_SECRET=...                       # random 32-byte hex
NEXT_PUBLIC_APP_NAME=Drive Table Tennis  # for display only
BLOB_READ_WRITE_TOKEN=...                # Vercel Blob; auto-injected on Vercel,
                                         # pull locally with `vercel env pull`
```

No feature flags, no optional knobs.

## 11. Repo layout

```
drive-table-tennis/
├── app/
│   ├── (public)/
│   │   ├── page.tsx                Home dashboard
│   │   ├── players/
│   │   ├── matches/
│   │   └── tournaments/
│   ├── admin/
│   │   ├── login/
│   │   ├── players/
│   │   ├── matches/
│   │   ├── tournaments/
│   │   └── page.tsx                Admin dashboard with Rebuild ELO button
│   ├── layout.tsx
│   └── globals.css
├── lib/
│   ├── elo.ts                      applyMatch + recompute
│   ├── bracket.ts                  generateBracket
│   ├── db/
│   │   ├── schema.ts               Drizzle schema
│   │   └── index.ts                Drizzle client
│   └── auth.ts                     Cookie sign / verify helpers
├── components/                     shadcn/ui + custom
├── middleware.ts                   Admin route guard
├── tests/
│   ├── elo.test.ts
│   ├── bracket.test.ts
│   └── recompute.test.ts
├── drizzle.config.ts
├── .env.example
├── README.md                       Click-by-click setup
└── package.json
```

## 12. Testing

Automated tests live only where bugs would be silent or hard to detect manually.

| Subject | How | Cases |
|---|---|---|
| `applyMatch` | Vitest unit tests | Symmetric outcomes net to zero; equal ELO → ±K/2 winner/loser; expected score at known reference points; large gaps cap appropriately. ~6 cases. |
| `generateBracket` | Vitest unit tests | N=4, 8, 12, 16 produce expected pairings; total match count = N-1; byes go to top seeds; final pairs come from opposite halves. ~5 cases. |
| ELO recompute on edit | Vitest unit tests | Edit a 10-match history; verify all subsequent `elo_*_after` match a fresh-from-zero replay; deletion produces the same result as if the match never existed. ~3 cases. |
| Pages / Server Actions / UI | Manual click-through | Single-admin app; you'll exercise every path within minutes of using it. |

No E2E framework. No component tests.

## 13. Rollout

1. **Local first.** Build the app, log fake matches, run a 4-person test tournament. Iterate.
2. **Soft launch.** Share the Vercel URL in the Drive table tennis Slack channel. Either backfill historical matches or start everyone at 1200 and let the ladder self-correct.
3. **Iterate on feedback.** Likely v1.5 candidates: CSV export, Slack notification on tournament results, mobile-tuned match-logging form, set-count-weighted ELO.

## 14. Setup (the one-page version)

A literal copy-pasteable README that ships with the repo:

```
1. Supabase
   a. Sign in at supabase.com → New project
   b. Pick a region close to Sydney
   c. Set a database password
   d. Wait ~2 min for provisioning
   e. Settings → Database → Connection string → URI → copy

2. Local
   a. git clone <repo>
   b. cd drive-table-tennis
   c. cp .env.example .env
   d. Paste the connection string into DATABASE_URL
   e. Set ADMIN_PASSWORD and SESSION_SECRET to anything
   f. npm install
   g. npm run db:push       (applies schema to Supabase)
   h. npm run dev           (visit http://localhost:3000)

3. Vercel
   a. Push the repo to GitHub
   b. vercel.com → Import project → pick the repo
   c. Add the same env vars (DATABASE_URL, ADMIN_PASSWORD, SESSION_SECRET, NEXT_PUBLIC_APP_NAME)
   d. Project → Storage → Create Blob store → Connect to project (auto-injects BLOB_READ_WRITE_TOKEN)
   e. Deploy
   f. To run locally with photo uploads working: `vercel env pull .env.local`
```

Nothing else.

## 15. What's explicitly out of scope for v1

- Comments / chat / reactions on matches.
- Email or Slack notifications.
- Mobile app (responsive web is enough).
- CSV / JSON export.
- Real-time updates (refresh the page).
- Public / private tournament toggles.
- Round-robin, Swiss, or double-elimination brackets.
- Point-by-point or shot-by-shot game analysis.
- Multi-admin or per-player accounts.
- Internationalisation.

## 16. Risks

| Risk | Mitigation |
|---|---|
| Admin edits an old match and ELO drifts | Single recompute path; tested; manual "Rebuild ELO" escape hatch on `/admin`. |
| Supabase free-tier pauses an inactive project | Active during work hours. If it ever pauses, click "restore" in the dashboard. Not a real problem at this scale. |
| Admin password leaks | Rotate the env var. It's an office leaderboard, not a bank. |
| Default 1200 ELO is unfair for the office's actual best players | Either backfill historical matches at launch or let the ladder self-correct over a few weeks of play. Either works. |
| Free Postgres tier outgrown | At 50 players × ~500 matches/year × ~1 KB/match = ~25 MB/year. Won't happen for years. |
| Junk profiles via public `/join` | Office-only URL share + admin can deactivate from `/admin/players` in one click. Add a basic per-IP rate limit (1 profile per 10 min) in v1.5 if it becomes a problem. |
| Photo upload abuse (huge files, non-image MIME) | Server-side validation: max 2 MB, MIME type must be `image/*`. Vercel Blob accepts whatever we hand it. |

## 17. Design language

The frontend is **not** to be built with the default shadcn/Vercel-template look. The brief is: clean, considered, distinctive, with tasteful motion that reinforces meaning rather than decorates.

### Implementation skill

When building components and pages, the implementation plan should invoke the **`bencium-impact-designer`** skill (declared user preference, 2026-05-29). That skill is responsible for producing the distinctive, production-grade visual language; this section captures the intent it should work within.

### Aesthetic direction

- **Mood:** a sports/data product, not a SaaS dashboard. Confident, fast, slightly editorial. Think a credible sports-data brand more than a generic admin panel.
- **Density:** higher information density than the typical AI-generated app — the leaderboard should reward scanning. Headers can breathe; data rows should be tight.
- **Typography:** one expressive display face for headings (numerals matter — ELO and scores are the stars of the show), one neutral sans for body. Tabular numerals everywhere a number lives in a column.
- **Palette:** restrained. Two or three brand colours max. Reserve a single accent colour for "movement" (positive ΔELO, wins, in-form indicators). The accent should never be wasted on chrome.
- **Mode:** dark mode as the primary visual identity (sport feels right in the dark); light mode supported but secondary.
- **Imagery:** player photos are circular, sized to feel like a roster, not a profile page. Default avatar should be a tasteful monogram, not a generic silhouette.

### Motion principles

Motion is required, but every animation has to justify itself. The test: would removing this animation change what the user understands? If no, remove it.

| Where | What | Why it earns its place |
|---|---|---|
| Leaderboard reorder | Spring-eased rank changes when a match is logged | Makes the ladder feel alive; communicates exactly who moved and by how much. |
| ELO delta toast after match log | Number ticks from old to new ELO over ~600ms | Reinforces the cause-and-effect of a recorded result. |
| In-form sparklines | Subtle draw-in on mount | Gives the eye a path to follow across the trend. |
| Bracket reveal on tournament start | Round-by-round cascade as bracket is generated | Communicates the structure of the tournament without a static dump. |
| Match-log form Save | Tactile press / success state, not a generic spinner | This is the most-used action; it should feel good. |
| Page transitions | Soft, ~150ms cross-fades between routes | Provides continuity without slowing navigation. |
| Hover/focus states | Considered, distinctive, not the shadcn defaults | Cumulative micro-interactions are where polish lives. |

### What to avoid

- The "Tailwind UI default" look: rounded-2xl cards floating on white, sky-500 buttons, soft drop shadows.
- Gradient-as-a-shortcut for personality.
- Floating "AI sparkle" iconography or chat-style affordances.
- Animations that block input (long stagger reveals on every page load).
- Cute illustrations or 3D mascots.

### Specific motion library

- **Framer Motion** for component-level animation.
- **CSS / Tailwind transitions** for hover and focus state polish.
- **No Lottie** unless a specific illustrated need emerges.

### Acceptance check for the design pass

Before declaring the frontend "done", a person who has never seen the project should be able to say: "this looks like a real product, not a template." If it could plausibly be mistaken for the output of any generic AI scaffolder, the design is not finished.

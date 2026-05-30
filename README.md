# Drive Table Tennis

A single-admin web app for tracking Drive's office table tennis ladder and tournaments. Continuous ELO ratings, single-elimination tournaments seeded by ELO, self-serve player profiles, stats dashboards.

## Stack

Next.js 16, React 19, TypeScript, Tailwind v4, shadcn/ui (new-york / zinc), Drizzle ORM + Supabase Postgres, Vercel Blob for player photos, Framer Motion, Recharts, Vitest. Designed dark-mode-first.

## Setup

### 1. Supabase
1. Sign in at supabase.com → New project
2. Pick a region close to Sydney (e.g. ap-southeast-2)
3. Set a database password (save it)
4. Wait ~2 min for provisioning
5. **Settings → Database → Connection string → "Session pooler"** → copy the URI. (The "Direct connection" string is IPv6-only on free tier and won't work from most networks.)

### 2. Local

```bash
git clone <your-repo>
cd drive-table-tennis
cp .env.example .env
```

Edit `.env`:
- `DATABASE_URL` — paste the Supabase session pooler URI
- `ADMIN_PASSWORD` — anything you like (this is what you'll log in with)
- `SESSION_SECRET` — run `openssl rand -hex 32` or paste any 64-char hex string
- `BLOB_READ_WRITE_TOKEN` — leave blank for now (filled when you deploy)

```bash
npm install
npm run db:push          # applies schema to Supabase
npm run dev              # http://localhost:3000
```

### 3. Vercel deployment

1. Push the repo to GitHub
2. vercel.com → New Project → Import the repo
3. Add env vars: `DATABASE_URL`, `ADMIN_PASSWORD`, `SESSION_SECRET`, `NEXT_PUBLIC_APP_NAME`
4. Project → Storage → Create Blob store → Connect to project (this auto-injects `BLOB_READ_WRITE_TOKEN`)
5. Deploy
6. To enable photo uploads on your local dev too: `vercel env pull .env.local`

## Day-to-day

- **Log a casual match:** `/admin/matches/new`
- **Run a tournament:** `/admin/tournaments/new` → pick players → auto-seed → Start → record results from the bracket page
- **Players self-onboard:** share `/join`
- **Rebuild ELO if anything looks off:** `/admin` → "Rebuild ELO from match history" (replays the entire match history)

## Tests

```bash
npm test
```

Covers the pure logic: ELO math, history replay, bracket generation, stats helpers. UI is tested by clicking around.

## Project structure

- `app/(public)/` — public pages: home, players, matches, tournaments, /join
- `app/admin/` — admin pages (password-gated by `proxy.ts`)
- `app/actions/` — Server Actions (mutations)
- `lib/elo.ts` — pure ELO math
- `lib/elo-recompute.ts` — replay match history (used by edit/delete/rebuild)
- `lib/bracket.ts` — single-elim bracket generation
- `lib/stats.ts` — in-form and vs-capability helpers
- `lib/db/` — Drizzle schema + client
- `components/` — UI components
- `docs/superpowers/specs/` — design spec
- `docs/superpowers/plans/` — implementation plan

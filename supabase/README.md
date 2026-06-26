# Local DB: dump from prod, seed locally

Runbook for cloning the **linked (remote) Supabase project's data** into a **local Supabase** instance for development. Commands are written for `fish`.

## Prerequisites

- Docker running (for `npx supabase start`)
- `psql` on PATH
- Supabase CLI via `npx supabase` (no global install needed)
- Project linked once: `npx supabase login` then `npx supabase link --project-ref <ref>`
  (`<ref>` is the ID in your dashboard URL `https://supabase.com/dashboard/project/<ref>`)

The local DB connection string is `postgresql://postgres:postgres@127.0.0.1:54322/postgres` by default — confirm with `npx supabase status` (the "DB URL" line).

## 1. Pull a dump from the remote DB

Scope the dump to the **`public` schema only**. The `auth.*` and `storage.*` schemas are Supabase internals — this app uses its own admin-password auth and Vercel Blob (not Supabase Auth/Storage), so that data is irrelevant and dumping it causes permission errors on load.

```fish
# Schema (DDL) and data, public schema only
npx supabase db dump --linked -s public -f supabase/schema.sql
npx supabase db dump --linked -s public --data-only --use-copy -f supabase/data.sql
```

We dump the **schema from prod** rather than relying on `npm run db:push`, because prod's public schema may contain tables not defined in the Drizzle schema (`lib/db/schema.ts`) — e.g. `casual_tournaments`. Dumping prod's DDL keeps local an exact replica.

> If you linked via `--db-url` instead, swap `--linked` for `--db-url "$DATABASE_URL"` (URL must be percent-encoded; `DATABASE_URL` must be in your shell env).

## 2. Start local Supabase and reset the public schema

```fish
npx supabase start

# Clear any previous (or partial) load — only touches the local public schema
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
```

## 3. Load schema, then data

```fish
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/schema.sql
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/data.sql
```

## Notes / gotchas

- **fish env vars:** use `env VAR=value cmd`, not the bash-style `VAR=value cmd` prefix (which fails in fish).
- **Don't run a bare `npm run db:push`** while seeding — it reads `.env` and hits the **remote** DB. To push schema to *local* instead: `env DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run db:push`.
- **FK / ordering errors** on a data-only load: defer constraints with
  `psql "<local-url>" -c "SET session_replication_role = replica;" -f supabase/data.sql`.
- **Don't commit real player data:** `supabase/data.sql` contains production data. Add it to `.gitignore` (or don't `git add` it) unless you intend to share it.
- **Schema drift:** `casual_tournaments` exists in prod but is not in `lib/db/schema.ts` and is unreferenced by app code. Dumping prod's DDL sidesteps it for seeding, but it should be reconciled (add to Drizzle, or drop in prod) separately.

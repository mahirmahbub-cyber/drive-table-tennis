# Drive Table Tennis — Five Additions

- **Date:** 2026-06-19
- **Status:** Approved design, ready for implementation planning
- **Author:** Mahir + Claude (brainstorming session)

## Overview

Five independent additions to the existing Drive Table Tennis app (Next.js 16.2.6, React 19, App Router, Drizzle + Postgres/Supabase, Tailwind v4, Radix, framer-motion, sonner, zod):

1. **Slack digest bot** — a weekly Monday recap + a daily (Tue–Fri) recap posted to one Slack channel via Incoming Webhook, on Vercel Cron, with admin "post now" preview buttons.
2. **Duplicate-prevention + blocking loading modal** — a full-screen overlay across *every* write flow that makes a second submit impossible while the first is in flight, plus server-side player dedup to match the existing match dedup.
3. **Seeder current-time default** — seeder-logged games stamped with the real play time instead of landing at midnight.
4. **Desktop top-nav cleanup** — regroup the crowded desktop nav into typed clusters (stats/views vs tools vs actions).
5. **Leaderboard 7-day inactivity filter** — players with no game in the last 7 days drop off the home "Starting Grid" leaderboard.

A sixth idea (1.5× ELO for games won to 21) was explicitly **deferred** — see [Deferred](#deferred).

The features are almost fully independent and well-suited to parallel subagent execution. See [Parallelization & shared files](#parallelization--shared-files).

---

## Cross-cutting concerns

### Environment / config
- New env vars (add placeholders to `.env.example`):
  - `SLACK_WEBHOOK_URL` — **Slack Workflow Builder webhook trigger** URL (`hooks.slack.com/triggers/…`), bound to a workflow that posts to the target channel. **Not** a classic Incoming Webhook.
  - `SLACK_DAILY_WEBHOOK_URL` — the **daily** workflow's trigger URL (decision: two separate triggers, see below).
  - `CRON_SECRET` — shared secret; Vercel Cron automatically sends `Authorization: Bearer $CRON_SECRET`.
- **`.env` is local development only — it is not deployed.** For production, every variable (the three new ones plus the existing `DATABASE_URL`, `ADMIN_PASSWORD`, `SESSION_SECRET`, `BLOB_READ_WRITE_TOKEN`, `NEXT_PUBLIC_APP_NAME`) must also be set in the **Vercel dashboard**. Full steps in [Enablement checklist](#enablement-checklist--manual-setup--mahir).
- `vercel.json` is **new** (does not exist yet) — holds the cron schedule.

### Timezone
- All digest windows compute boundaries in **`Australia/Sydney`** (AEST/AEDT). Vercel runs in UTC, so this is non-negotiable for correct "yesterday"/"last week" boundaries.
- No date library — use `Intl.DateTimeFormat` with `timeZone: 'Australia/Sydney'`. Keep the timezone as a single exported constant so it's trivial to change.
- The leaderboard filter (Feature 5) uses a simpler **rolling 7×24h** window (not calendar), reusing the value the home page already computes.

### Admin authorization (for manual Slack triggers)
- Reuse existing auth: read the `admin_session` cookie (`ADMIN_COOKIE` in `lib/auth.ts`) via `cookies()` (async in Next 16) and verify with `verifySessionCookie(cookie, process.env.SESSION_SECRET!)`. Reject with an error result if invalid.
- The admin pages are already route-guarded by `proxy.ts`, but server actions are independently reachable, so verify inside the action too.

### Git
- **Do not run any git commands.** Write/edit files only; Mahir handles all `git add`/`commit`/`push` himself.

### Lint
- `npm run lint` is broken (space in repo path breaks `next lint`). Lint touched files with `npx eslint <paths>` directly.

### Turbopack CSS cache
- If any change edits `globals.css`, it won't hot-reload — delete `.next` to see it in preview. (Feature 4 is expected to use Tailwind utilities only, so likely N/A.)

### Verification approach
- Verify data-driven UI with **throwaway preview fixtures**, never by seeding the live Supabase.
- `preview_click` misses React handlers and `preview_screenshot` can time out — verify via `preview_eval` `.click()` + separate-eval DOM reads.

### Subagent model (execution phase)
- Implementer subagents on **Sonnet**; reviewer/verification subagents on **Haiku**. Never Opus by default.

---

## Feature 1 — Slack digest bot

### Purpose
Keep the channel updated automatically: a meaty **weekly** recap every Monday morning and a light **daily** recap Tue–Fri morning. Admin can also fire either on demand to preview.

### Cadence (Vercel Cron, UTC)
- **Weekly** (whole prior week, Mon–Sun): `0 22 * * 0` → Sunday 22:00 UTC ≈ **Monday ~9am Sydney**.
- **Daily** (yesterday): `0 22 * * 1-4` → Mon–Thu 22:00 UTC ≈ **Tue–Fri ~9am Sydney**.
- Sat/Sun mornings: no post. Friday + weekend games surface in Monday's weekly recap. No Monday double-post (daily does not run Mon).
- **Known limitation:** fixed cron can't follow DST, so the post *time* drifts ±1h across the year (8 vs 9am). Window *content* is always correct because it's computed in Sydney time.

### Content
**Weekly recap** (window = previous Mon 00:00 → this Mon 00:00, Sydney). Include each line only when data exists:
- 🏆 **Biggest beatdown** — `demolitionOfWeek` (largest score margin).
- 😱 **Biggest upset** — `upsetOfWeek` (lower-rated beats higher-rated by ELO gap).
- 📈 **Top risers** — top 3 by net ELO over the window (`movers`).
- 📉 **Biggest fallers** — bottom 3 by net ELO over the window (`movers`).
- 🔥 **Most-played rivalry** — `mostPlayedRivalry`.
- ⏱️ **Longest / fastest game** — `durationRecords`.

**Daily recap** (window = yesterday 00:00 → today 00:00, Sydney):
- ⚡ **Biggest ELO-swing match** — the single match with the largest winner ELO delta.
- 👑 **Biggest winner** — most ELO gained yesterday (`movers`, top entry).

**Empty-window guard:** if zero games in the window, **skip the post entirely** (return a "skipped" result; do not post "nothing happened").

Names use player `name` (+ `nickname` when present). Plain text — no @-mentions (webhook can't map Slack users without extra config).

### Delivery
- **Slack Workflow Builder webhook trigger** (the URL Mahir provided is a `hooks.slack.com/triggers/…` URL, not a classic Incoming Webhook). The app POSTs a **flat JSON object of named variables** (`Content-Type: application/json`); the **Slack-side workflow owns the message template/formatting**. This is the "templated message" originally requested.
- **Format constraints:** payload must be flat (no nested objects/arrays, no Block Kit); keys must exactly match the variables defined in the trigger; values are plain strings (line breaks via `\n`). Bold/emoji/labels live in the Slack template, not in our values.
- **Two triggers** (decided): separate weekly and daily workflows. Weekly posts to `SLACK_WEBHOOK_URL`, daily to `SLACK_DAILY_WEBHOOK_URL`. No `digest_type` variable needed.
- **Always send every defined key** (use `—` for a missing datum) so the trigger never errors on an absent field. Skip the whole post only when there were zero games in the window.

### Payload variables
**Weekly** (`week_range`, `games_played`, `biggest_beatdown`, `biggest_upset`, `top_risers`, `biggest_fallers`, `top_rivalry`, `longest_game`, `fastest_game`) — all Text. Examples:
- `week_range`: `9–15 Jun`
- `biggest_beatdown`: `Alice beat Bob 11–2`
- `biggest_upset`: `Carol beat Dave (1180 vs 1320)`
- `top_risers`: `Alice +45 · Bob +30 · Carol +22`
- `biggest_fallers`: `Dave −38 · Eve −25 · Frank −19`
- `top_rivalry`: `Alice vs Bob · 6 games`
- `longest_game` / `fastest_game`: `Alice vs Bob · 14:32`

**Daily** (`day`, `games_played`, `biggest_swing_match`, `biggest_winner`) — all Text. Examples:
- `day`: `Thu 18 Jun`
- `biggest_swing_match`: `Alice beat Bob 11–9 · +22 ELO`
- `biggest_winner`: `Alice · +38 ELO over 4 games`

### Modules (small, isolated, testable)
- `lib/slack/windows.ts` — pure TZ math. Exports `SYDNEY_TZ = 'Australia/Sydney'`, `yesterdayRange(now: Date): { start: Date; end: Date }`, `lastWeekRange(now: Date): { start: Date; end: Date }`. `now` is passed in so the functions stay pure/testable. Uses `Intl.DateTimeFormat` to read the local calendar date/day, then derives UTC instants for the range.
- `lib/slack/data.ts` — `loadDigestData()`: loads **all** players (id → {name, nickname}) for name resolution (not just active, so an inactive player who played still resolves) and maps `matches` rows into `EngineMatch[]` (reuse the existing mapping shape from `home-data.ts`/players page). Returns `{ engineMatches, playersById }`.
- `lib/slack/digest.ts` — pure builders. `buildWeeklyDigest(input): DigestVariables | null` and `buildDailyDigest(input): DigestVariables | null` where `input = { engineMatches, playersById, range, now }` and `DigestVariables = Record<string, string>` (the flat variables above). Each pre-filters via `inRange(engineMatches, range.start, range.end)` then reuses the existing stats functions by passing `range.start` as `since` (pre-filtering means nothing past `range.end` leaks in). Returns `null` when the windowed set is empty (caller skips the post). Always populates every key, using `—` for a missing datum.
- `lib/slack/send.ts` — `postToSlackTrigger(url: string, variables: DigestVariables): Promise<void>`: POST flat JSON (`Content-Type: application/json`) to the trigger `url`; throw on non-2xx. The only impure (network) piece. URL comes from `SLACK_WEBHOOK_URL` (weekly) / `SLACK_DAILY_WEBHOOK_URL` (daily), or a single URL + `digest_type` if one workflow handles both.
- `app/api/cron/weekly-digest/route.ts` & `app/api/cron/daily-digest/route.ts` — `GET` handlers (Vercel Cron uses GET). Verify `Authorization: Bearer ${process.env.CRON_SECRET}` (401 otherwise). Then `loadDigestData()` → compute range with `now = new Date()` → build → if `null` return `200 { skipped: true }`, else `postToSlackTrigger(url, vars)` and return `200 { ok: true }`. Wrap in try/catch; on send failure return `500` and log.
- `app/actions/slack.ts` — server actions `postWeeklyNow()` / `postDailyNow()`: verify admin cookie; same build+send; return `{ ok: true } | { skipped: true } | { error: string }`.
- `components/admin/post-to-slack-buttons.tsx` — `'use client'`. Two buttons ("Post weekly recap now", "Post daily recap now") calling the actions; show sonner toasts for ok/skipped/error; disable while pending (reuse the Feature 2 overlay/guard). Used here (not `<form action={fn}>`) specifically so the action *can* return a result.
- `app/admin/page.tsx` — add a "Slack" card in the Maintenance area rendering `<PostToSlackButtons />`.
- `vercel.json` — `{ "crons": [ { "path": "/api/cron/weekly-digest", "schedule": "0 22 * * 0" }, { "path": "/api/cron/daily-digest", "schedule": "0 22 * * 1-4" } ] }`.

### New stats-engine functions (additive)
- `inRange(all: EngineMatch[], start: Date, end: Date): EngineMatch[]` — matches with `playedAt` in `[start, end)`.
- `biggestEloSwingMatch(matches: EngineMatch[]): EngineMatch | null` — over the given (already range-filtered) matches, the one with the largest winner ELO delta (`|eloAfter − eloBefore|` of the winning side); ignores tied/null-winner matches.
- Existing `demolitionOfWeek`, `upsetOfWeek`, `movers`, `mostPlayedRivalry`, `durationRecords` are reused unchanged (fed pre-filtered matches + `since = range.start`).

### Error handling / edge cases
- Missing `SLACK_WEBHOOK_URL` or `CRON_SECRET`: cron route returns 500 with a clear log; manual action returns `{ error }`.
- Empty window: skip (see above).
- Ties / null winners: excluded from swing/upset/beatdown computations (existing functions already guard `winnerId`).

### Tests
- `lib/slack/windows.test.ts` — boundary correctness in Sydney time, incl. an AEST date and an AEDT date (DST), and the Mon/Sun week boundary.
- `lib/slack/digest.test.ts` — fixture matches → assert weekly and daily variable maps contain the right names/values; assert `null` on empty window; assert every key is present and set to `—` when its datum is missing.
- `stats-engine` tests for `inRange` and `biggestEloSwingMatch`.
- Route handlers: assert 401 without the bearer secret; assert the "skipped" path doesn't call send (mock `postToSlackTrigger`). Do **not** hit real Slack in tests.
- Manual: use the admin preview buttons to confirm real Slack rendering.

---

## Feature 2 — Duplicate prevention + blocking loading modal (every write flow)

### Purpose
Stop duplicate games and players. Root cause: the async write takes time and a second click/submit fires before the first completes. Primary fix is a blocking overlay that appears the instant a write starts and stays until the server fully responds, so a second interaction is impossible; server-side dedup is the belt-and-suspenders backstop.

### Components
- `components/loading-overlay.tsx` — presentational. `<LoadingOverlay open label />`: when `open`, render a `fixed inset-0` element at a high z-index above dialogs, dimmed/blurred backdrop, centered spinner + `label`, `role="status"` + `aria-live="polite"` + `aria-busy="true"`. Covering the viewport captures pointer events (blocks clicks). Renders `null` when `!open`. No Radix dependency needed.

### Applied to (every mutating flow)
- `components/match-log-form.tsx` — already has `pending` + a `submitting` ref; add `<LoadingOverlay open={pending} label="Saving match…" />`. (This also covers the **admin** match-create page, which renders `MatchLogForm`.)
- `components/seeder/seeder-queue.tsx` (`ActiveCard.save`) — add a `submitting` ref guard + `<LoadingOverlay open={pending} label="Saving game…" />`.
- `components/join-form.tsx` — add a `submitting` ref guard (currently none) + `<LoadingOverlay open={pending} label="Creating profile…" />`.
- `components/admin/player-edit-dialog.tsx` — create/edit player.
- `components/tournament-create-form.tsx` — tournament create.
- `components/admin/match-row-actions.tsx` — edit/delete match.
- `components/match-detail-modal.tsx` — only if it performs edits.

In each handler, keep/add an in-flight `submitting` ref so the action body can't run twice even if React re-fires.

### Server-side hardening
- **Players** (new): in `app/actions/players.ts`, both `createPlayerSelfServe` and `createPlayerAdmin`, before insert, reject if a player with the same trimmed name (case-insensitive, `ilike`) was created within a short window (mirror the match `DEDUP_WINDOW_MS = 10_000`). Return `{ error: 'Looks like that player was just added.' }`. Add a small `lib/player-dedup.ts` constant/helper to mirror `lib/match-dedup.ts` for consistency, or inline the query. Email already has a unique DB constraint.
- **Matches** (existing): keep the current 10s `isDuplicateMatch` guard as-is.

### Error handling / edge cases
- Overlay must clear in a `finally` so a server error doesn't leave it stuck.
- Self-serve join `redirect()`s on success (no return) — the overlay naturally unmounts on navigation; ensure the dedup `{ error }` path returns before redirect.

### Tests
- `loading-overlay` behaviour: shows when `open`, hidden otherwise, has `role="status"`/`aria-busy`.
- Double-submit guard: a second invocation while pending does not call the action twice.
- Player dedup: unit-test the window/name comparison helper; same-name within window rejected, outside window allowed, different name allowed.
- Verify a representative form end-to-end via preview fixtures (overlay appears, blocks interaction, confirmation follows).

---

## Feature 3 — Seeder current-time default

### Purpose
Seeder-logged games should carry the real play time, not midnight.

### Root cause (verify first)
Today `buildLogFields` sends `playedAt: ''`, which the server coerces to `new Date()` — which *should* be correct, so the "12am" symptom must be confirmed by reproduction before assuming the fix. Use systematic-debugging: reproduce with a preview fixture, confirm whether the midnight comes from the `''`→server-default path, the `z.coerce.date()` interpretation of a local datetime string as UTC on the server, or a display path.

### Fix (robust regardless of root cause)
- Change `lib/seeder-session.ts` `buildLogFields` to take an explicit `playedAtISO: string` argument and set `playedAt: playedAtISO` (instead of `''`). Keeps the function pure/testable.
- In `components/seeder/seeder-queue.tsx` (`ActiveCard.save`), pass `new Date().toISOString()` — a full UTC instant, unambiguous through `z.coerce.date()`.
- Update `lib/seeder-session.test.ts` for the new signature/behaviour.
- If the investigation shows the shared `z.coerce.date()` coercion (local datetime-local string parsed as server-UTC) is the real culprit affecting the **main** `MatchLogForm` too, note a small follow-up — but keep this feature scoped to the seeder unless they're literally the same defect.

### Scope note
`buildLogFields` is only called from `seeder-queue.tsx`; no other call sites to update.

### Tests
- `seeder-session.test.ts`: `buildLogFields` passes the given ISO string through to `playedAt`.
- Reproduction confirmation in preview (a seeder-logged game shows the correct local time).

---

## Feature 4 — Desktop top-nav cleanup (group by type)

### Purpose
The desktop nav row is crowded (6 links + "Log a game" + Admin/Sign-out + Join). Regroup into clear, typed clusters.

### Design
Rework the desktop nav block in `components/site-header.tsx` (the `hidden … lg:flex` `<nav>`) into clusters separated by subtle vertical dividers:
- **Stats / views:** Players · Matches · Mogboard · Tournaments
- **Tools:** Calculator · Seeder
- **Actions:** `Log a game` button · `Join` button (primary CTA)
- **Utility (far right):** Admin / Sign out (logged in) or Admin Log In (logged out)

Dividers: thin `border-l border-border` separators (self-centered, short height) or deliberate spacing between groups. Preserve `aria-current`, the logo, sticky header, and existing hover/active treatments.

- **Desktop only.** The mobile `Dialog` menu stays as-is for this scope (optional future: mirror the grouping with section labels).
- Use the **frontend-design** skill during implementation for the visual polish (divider treatment, spacing rhythm, hover/active states) so it doesn't read as generic.

### Tests / verification
- Preview at desktop width: groups render with dividers; `aria-current` still marks the active route; all links resolve.
- No `globals.css` change expected (Tailwind utilities only); if that changes, delete `.next` before previewing.

---

## Feature 5 — Leaderboard 7-day inactivity filter

### Purpose
A player only appears on the home "Starting Grid" leaderboard if they've played at least one game in the last 7 days. No recent game → fully removed from the board (not greyed). Their ELO is untouched; they reappear the moment they play again.

### Scope
- **Home-page "Starting Grid" leaderboard only** (`components/leaderboard.tsx`, fed by `app/(public)/page.tsx`).
- The `/players` directory keeps **everyone** (it's the find-anyone roster, including dormant players). *(Decision: directory intentionally unfiltered. Change only if requested.)*

### Design
- Window: rolling 7 days — reuse the exact `since = new Date(now − 7×86400×1000)` the home page already computes for the "7d" movement column, so the board and that column stay consistent.
- New pure stats-engine helper: `recentlyActive(matches: EngineMatch[], since: Date): Set<string>` — the set of player ids appearing as A or B in any match with `playedAt >= since`.
- In `app/(public)/page.tsx`, compute `const activeIds = recentlyActive(data.engineMatches, since)` and pass `players={data.activePlayers.filter(p => activeIds.has(p.id))}` to `<Leaderboard>`. The `Leaderboard` component stays presentational/unchanged.
- Ranks are computed over the visible set (the component already does `ranked.map((p, i) => i + 1)`), so the board reads 1…N with no gaps; if #1 goes quiet, #2 becomes the displayed pole.

### Edge cases
- Players who've never played: excluded (correct — not on the competitive board yet).
- Everyone inactive: existing "The grid is empty" empty state shows.

### Tests
- `recentlyActive`: player with a game inside the window is included; outside excluded; never-played excluded; both A-side and B-side appearances count.

---

## Enablement checklist — manual setup — Mahir

Everything below is human setup; the rest is in code. **Supabase needs nothing.**

### Supabase
- **Nothing.** No schema changes, no new tables, no migrations, no new env. All five features use existing tables/columns. (Player dedup reuses `players.name` + `players.created_at`.)

### Slack — build two Workflow Builder workflows
1. **Weekly workflow:** Workflow Builder → new workflow → start from **Webhook**. Define these variables, all type **Text**: `week_range`, `games_played`, `biggest_beatdown`, `biggest_upset`, `top_risers`, `biggest_fallers`, `top_rivalry`, `longest_game`, `fastest_game`. Add a **"Send a message to channel"** step targeting the channel and compose the layout with `{{variable}}` placeholders (bold/emoji/labels go here, in Slack). Publish → copy the trigger URL → this is `SLACK_WEBHOOK_URL`. *(The URL already created is this one.)*
2. **Daily workflow:** same process, variables `day`, `games_played`, `biggest_swing_match`, `biggest_winner`. Publish → copy the trigger URL → `SLACK_DAILY_WEBHOOK_URL`.

Example weekly message template (inside Slack):
```
🏓 *Table Tennis — week of {{week_range}}*  ({{games_played}} games)
🏆 Beatdown: {{biggest_beatdown}}
😱 Upset: {{biggest_upset}}
📈 Risers: {{top_risers}}
📉 Fallers: {{biggest_fallers}}
🔥 Rivalry: {{top_rivalry}}
⏱️ Longest {{longest_game}} · Fastest {{fastest_game}}
```

### Environment variables
`.env` covers local dev; the **Vercel dashboard** covers production. Set the three new vars in both.

| Var | Local `.env` | Vercel dashboard | Value |
|---|---|---|---|
| `SLACK_WEBHOOK_URL` | ✅ | ✅ | weekly trigger URL |
| `SLACK_DAILY_WEBHOOK_URL` | ✅ | ✅ | daily trigger URL |
| `CRON_SECRET` | ✅ | ✅ | a random secret — `openssl rand -hex 32` |
| existing vars (`DATABASE_URL`, `ADMIN_PASSWORD`, `SESSION_SECRET`, `BLOB_READ_WRITE_TOKEN`, `NEXT_PUBLIC_APP_NAME`) | ✅ | ✅ already | unchanged |

- `.env.example` gets placeholder lines for the three new vars (committed; no real values).
- **`CRON_SECRET` is special on Vercel:** when set, Vercel automatically attaches `Authorization: Bearer <CRON_SECRET>` to cron invocations — the route handlers verify exactly that. No extra wiring.
- In Vercel, add the vars to **Production** (and **Preview** too if you want preview deploys to be able to post).

### Vercel Cron
- The schedule lives in `vercel.json` (committed). On the next deploy Vercel registers both cron jobs automatically — verify under **Project → Settings → Cron Jobs**.
- **Plan check:** both jobs fire at most once per day, which the **Hobby** tier supports; on Hobby the time isn't exact (fires within the hour) — fine for a morning digest. Exact-minute timing / more jobs need **Pro**. Confirm current limits in Vercel's docs after deploy.
- Times are UTC: weekly `0 22 * * 0` (Sun 22:00 UTC ≈ Mon ~9am Sydney); daily `0 22 * * 1-4` (≈ Tue–Fri ~9am Sydney).

### Test without waiting for the schedule
- Once env vars are set (locally or on a deploy), use **Admin → Maintenance → Slack → "Post weekly recap now" / "Post daily recap now"** to fire a real post on demand. Fastest way to validate the template + variables.

### Order of operations
1. Build the two Slack workflows → copy both trigger URLs.
2. Add the 3 new env vars to `.env` (local) **and** Vercel (prod).
3. Deploy (registers the crons).
4. Click the admin preview buttons; tweak the Slack template wording as needed.

## Parallelization & shared files
- All five features are independent and can be implemented by separate subagents in parallel.
- **Only shared file:** `lib/stats-engine.ts` — Feature 1 adds `inRange` + `biggestEloSwingMatch`; Feature 5 adds `recentlyActive`. All additive. To avoid two agents editing the same file at once, either assign both stats-engine additions to one agent or sequence those edits. Everything else is disjoint.
- `app/admin/page.tsx` is touched only by Feature 1 (Slack card). `components/match-log-form.tsx` only by Feature 2.

## Consolidated testing strategy
- **Unit-test pure logic** (vitest): Slack window math + digest builders, new stats functions (`inRange`, `biggestEloSwingMatch`, `recentlyActive`), `buildLogFields`, player-dedup comparison, loading-overlay behaviour.
- **No external calls in tests** — mock `postToSlack`; never hit real Slack or live Supabase.
- **UI verification** via throwaway preview fixtures using `preview_eval` `.click()` + separate-eval DOM reads (not `preview_click`/`preview_screenshot`).
- Lint touched files: `npx eslint <paths>`.

## Deferred
- **1.5× ELO for a game won to 21** — deferred at Mahir's request; the scoring rule still needs tuning (exact-21 vs ≥21, and the multiplier). When revisited: the single choke point is `applyGames`/`applyMatch` in `lib/elo.ts` (used by both live logging and `replayHistory`), so it's retroactive by construction and would need a one-time "Rebuild ELO" after deploy.

## Open questions / decisions log
- Daily vs Monday overlap → **resolved:** daily Tue–Fri, weekly Mon.
- "Biggest mogs" → **resolved:** weekly shows both biggest beatdown and biggest upset as separate lines.
- Modal scope → **resolved:** every write flow.
- Nav strategy → **resolved:** group by type (desktop only).
- Timezone → **resolved:** Australia/Sydney (AEST/AEDT).
- "Biggest winner" → **resolved:** most ELO gained.
- Slack delivery → **resolved:** Workflow Builder webhook trigger (flat variables, template in Slack), not a classic Incoming Webhook.
- One trigger vs two → **resolved:** two triggers (separate weekly + daily workflows / URLs).
- Manual trigger → **resolved:** yes, daily + weekly preview buttons.
- Supabase changes → **resolved:** none required.
- Production env → **resolved:** vars set in both `.env` (local) and Vercel dashboard (prod); `.env` is not deployed.
- Feature 6 (21-point ELO) → **resolved:** deferred.
- 21-point interpretation (exact vs ≥) → **moot** (feature deferred).

# Vintage Scoreboard Design System — Design

**Date:** 2026-06-28
**Status:** Approved for planning
**Branch:** `design-system-vintage-scoreboard`

## Context

The flip-pad scorer (`components/flip-pad/*`, `components/flip-number.tsx`) introduced a
distinct "gold / old-school" visual language — aged-cream tiles, a brass accent,
charcoal frames, mono numerals, a split-flap hinge seam, and tactile inset shadows.
It currently lives only in those components as hardcoded hex values, sitting apart from
the site's "Drive brand" design system (light off-white page, Drive blue, IBM Plex,
clean modern cards) defined in `app/globals.css`.

The goal: promote that scoreboard language to the **site-wide design system**, so the
whole public app reads as a warm, tactile, vintage scoreboard rather than a clean
fintech dashboard.

## Goal & Non-Goals

**Goal:** Replace the Drive-blue design system with a vintage-scoreboard token set,
restyle the shadcn primitives, add a small reusable component vocabulary for the
tactile panels, and apply the bespoke treatment across the public competitive surfaces.

**Non-goals:**
- No layout or information-architecture changes. Same pages, same structure — purely
  visual / design-system.
- No dark-mode variant. The app is effectively light-only today (`.dark` unused); the
  two-tone scheme *is* the theme.
- No bespoke styling of admin screens (they inherit tokens only).
- No new features.

## Direction Decisions (settled in brainstorming)

| Decision | Choice |
| --- | --- |
| How far the look goes | **Full overhaul** — the whole site adopts the vintage language |
| Base surface | **Two-tone** — warm cream/paper page, charcoal scoreboard data panels |
| Win / loss / ±ELO semantics | **Ledger green/red** — muted green = gain, terracotta = loss; brass stays the neutral highlight |
| Headings | **Slab serif** (Zilla Slab); IBM Plex Sans body; IBM Plex Mono numerals |
| Texture level | **Tactile** — flip-card-style panels (rounded-bottom silhouette, inset base shadow, brass rules, raised "key" buttons). No paper grain / rivets |
| Scope | **Public-first** — competitive surfaces get full bespoke treatment; admin & seeder inherit tokens only |
| Implementation | **Token-first + a small new component set** (Panel, SectionHeading, StatReadout, Pill) |

## Section A — Token Palette & Type

These become the `:root` token set and `@theme inline` mappings in `app/globals.css`,
replacing the Drive-brand values. Drive blue (`#2960c5`) and coral are retired.

### Semantic tokens (shadcn-aligned)

| Token | Value | Notes |
| --- | --- | --- |
| `--background` | `#efe6d0` | warm aged paper (page) |
| `--foreground` | `#1b1d22` | near-black warm ink |
| `--card` / `--popover` | `#fdf6e3` | cream card surface |
| `--card-foreground` / `--popover-foreground` | `#1b1d22` | |
| `--primary` | `#e0a92a` | brass — buttons, key accents |
| `--primary-foreground` | `#1b1d22` | ink text on brass (AA-safe) |
| `--secondary` | `#f3ead2` | pale cream surface |
| `--secondary-foreground` | `#7a6c4d` | |
| `--muted` | `#ece1c9` | muted cream surface |
| `--muted-foreground` | `#7a6c4d` | warm muted ink |
| `--accent` | `#f3e6c4` | brass-tinted surface |
| `--accent-foreground` | `#a97c14` | brass-deep |
| `--destructive` | `#c0553b` | loss terracotta |
| `--border` | `#e3d6ad` | cream hairline |
| `--input` | `#d8c9a0` | slightly deeper field border |
| `--ring` | `#e0a92a` | brass focus ring (was blue) |

### Raw palette tokens (referenced by utilities/components)

| Token | Value |
| --- | --- |
| `--paper` | `#efe6d0` |
| `--cream` | `#fdf6e3` |
| `--cream-lift` | `#fffaf0` |
| `--panel` | `#1b1d22` |
| `--panel-raised` | `#2a2d33` |
| `--panel-line` | `#34383f` |
| `--panel-foreground` | `#f3ede0` |
| `--panel-muted` | `#9c958a` |
| `--ink` | `#1b1d22` |
| `--ink-muted` | `#7a6c4d` |
| `--brass` | `#e0a92a` |
| `--brass-deep` | `#a97c14` |
| `--brass-glow` | `rgb(231 200 106 / 0.5)` |

### Ledger semantics (two tunings — one per surface, for contrast)

| Token | Value | Use |
| --- | --- | --- |
| `--gain` | `#3f7d4f` | gain text on cream |
| `--gain-strong` | `#7cc08a` | gain text on charcoal panels |
| `--gain-muted` | `rgb(63 125 79 / 0.16)` | gain pill / fill backgrounds |
| `--loss` | `#c0553b` | loss text on cream |
| `--loss-strong` | `#e0795f` | loss text on charcoal panels |
| `--loss-muted` | `rgb(192 85 59 / 0.16)` | loss pill / fill backgrounds |

A single green/red cannot stay AA-legible on both cream and charcoal, hence the paired
tunings. Components on charcoal use the `-strong` variants.

### Charts

Remap `--chart-1..5` from the current blues+coral to the vintage palette:

| Token | Value |
| --- | --- |
| `--chart-1` | `#e0a92a` (brass) |
| `--chart-2` | `#3f7d4f` (gain green) |
| `--chart-3` | `#c0553b` (terracotta) |
| `--chart-4` | `#1b1d22` (ink) |
| `--chart-5` | `#9c958a` (muted) |

### Sidebar tokens

Remap to the charcoal nav world: `--sidebar` `#1b1d22`, `--sidebar-foreground`
`#f3ede0`, `--sidebar-primary` `#e0a92a`, `--sidebar-primary-foreground` `#1b1d22`,
`--sidebar-accent` `#2a2d33`, `--sidebar-accent-foreground` `#e0a92a`,
`--sidebar-border` `#000000`, `--sidebar-ring` `#e0a92a`.

### Typography

Remap the display font; sans and mono are unchanged.

- `--font-display` → `var(--font-zilla-slab)` (was `--font-ibm-plex-condensed`)
- `--font-sans` → `var(--font-ibm-plex-sans)` (unchanged)
- `--font-mono` → `var(--font-ibm-plex-mono)` (unchanged)

The `.font-display` utility is updated for slab: weight 700, normal tracking (remove the
condensed-specific negative letter-spacing). IBM Plex Sans Condensed can optionally be
dropped from `layout.tsx` to save a font payload, since nothing else uses it — confirm
no remaining `.font-display`-via-condensed assumptions first.

### Shadow & radius tokens

| Token | Value |
| --- | --- |
| `--shadow-panel` | `0 5px 12px rgb(0 0 0 / 0.28), inset 0 -6px 0 rgb(0 0 0 / 0.22), inset 0 1px 0 rgb(255 255 255 / 0.05)` |
| `--shadow-key` | `0 2px 0 var(--brass-deep), 0 3px 5px rgb(0 0 0 / 0.3)` |
| `--shadow-tile` | `0 2px 4px rgb(0 0 0 / 0.3), inset 0 -4px 0 rgb(0 0 0 / 0.05)` |
| `--radius` | `0.45rem` (slightly tighter, more mechanical) |

Panels use an asymmetric bottom radius (heavier bottom corners, echoing the flip tile)
expressed via the `.panel` utility, not a token.

## Section B — Primitives, Utilities & New Components

### Restyled shadcn primitives (`components/ui/*`)

Mostly inherit from the token swap; deliberate variant changes:

- **`button.tsx`** — `default` becomes the brass *key*: `bg-primary` (brass), ink text,
  `--shadow-key` raised edge, press-down (`active:translate-y-px active:shadow-none`).
  `destructive` → terracotta. `secondary` / `outline` / `ghost` retuned for cream and
  charcoal contexts. Focus ring → brass.
- **`card.tsx`** — cream surface (`bg-card`, `border` `#e3d6ad`), subtle inset bottom lip.
- **`table.tsx`** — cream rows, mono ink/brass column headers, `#e3d6ad` hairlines.
- **`input.tsx` / `textarea.tsx` / `select.tsx`** — cream field, inset shadow, brass focus ring.
- **`dialog.tsx` / `dropdown-menu.tsx`** — cream surface, brass accents.

### New utility classes (`globals.css @layer utilities`)

- `.font-display` → remapped to Zilla Slab (see above).
- `.panel` → charcoal gradient (`--panel-raised` → `--panel`), asymmetric bottom radius,
  `--shadow-panel`.
- `.brass-rule` → 2px brass divider (`background: var(--brass)`).
- `.hinge` → centre split-flap seam line (promoted out of the flip components).
- `.text-gain` / `.text-loss` → retuned to ledger tokens; add `.text-gain-strong` /
  `.text-loss-strong` for charcoal contexts.
- `.bg-gain-muted` / `.bg-loss-muted` → pill fills.
- Existing `.nums`, `.data-row`, `.section-header` updated to the new look.

### New components (`components/scoreboard/`)

1. **`Panel`** — the charcoal scoreboard frame. Props: optional `kicker`, `title`,
   `rule` (show brass rule), `children`. Renders `.panel`. The workhorse for the ladder,
   stat blocks, and match panels.
2. **`SectionHeading`** — slab title + optional uppercase brass kicker + optional brass
   rule; `surface` variant (`cream` | `panel`) to pick text colours.
3. **`StatReadout`** — generalises the existing `FlipNumber` flip-tile look into a
   reusable hero/stat number (count-up + flip, reduced-motion aware).
4. **`Pill`** — W/L / status chip; `variant` = `gain` | `loss` | `brass` | `neutral`;
   mono text, muted fill.

### Flip-component reconciliation (in-scope cleanup)

`flip-pad.tsx`, `flip-card.tsx`, `flip-number.tsx` currently hardcode `#fdf6e3`,
`#e0a92a`, `#1b1d22`, `#9aa3b2`, etc. As the origin of the look, they are refactored to
consume the new tokens/utilities — **behaviour unchanged**, no value drift, fully
themeable. The cool blue-greys (`#9aa3b2`, `#cfd2d8`) move to the warm `--panel-muted`.

## Section C — Application Plan & Gotchas

### Full bespoke tactile treatment (public competitive surfaces)

- **Home** — `app/(public)/page.tsx`: hero `StatReadout`, ladder `Panel`, weekly stats, logger
- **Players** — `players/page.tsx`, `players/[id]/page.tsx`: leaderboard panel, profile, ELO chart, history
- **Matches** — `matches/page.tsx`: recent matches + `match-detail-modal`
- **Matrix** — `matrix/page.tsx`: the H2H matrix
- **Tournaments** — `tournaments/page.tsx`, `tournaments/[id]`: bracket view
- **Logger / scorer** — `inline-logger`, `match-log-form`, `flip-pad` (origin look, reconciled)
- **Shared chrome** — `site-header`, `nav`, `site-nav-shared`: charcoal nav bar, brass links/active

### Inherit tokens, light touch — no bespoke panels (public but utilitarian)

- Seeder (`seeder/page.tsx` + seeder components), Calculator (`calculator/page.tsx`),
  Join (`join/page.tsx`).

### Inherit tokens only — out of bespoke scope

- All of `app/admin/*`. Picks up cream / brass / slab automatically via tokens + primitives.

### Gotchas

- **Fonts** — add Zilla Slab via `next/font/google` in `app/layout.tsx`, following the
  existing IBM Plex pattern (new `--font-zilla-slab` variable on `<html>`), then point
  `--font-display` at it in `globals.css`. ⚠️ **AGENTS.md notes this is a modified
  Next.js — verify the `next/font` API against `node_modules/next/dist/docs/` before
  writing; do not assume the API matches training data.**
- **Contrast** — brass `#e0a92a` fails AA for small body text; reserve it for labels,
  accents, and large text. Body on panels uses `#f3ede0`. Brass buttons use ink text
  (`#1b1d22` on `#e0a92a`) — AA-safe. The paired gain/loss tunings exist to hold contrast
  on both surfaces.
- **Reduced motion** — flip animations are already gated by `prefers-reduced-motion`
  (`globals.css`); preserve that and ensure new readouts respect it.
- **Charts** — confirm the charting lib (`elo-chart`, `h2h-elo-chart`, in-form sparkline,
  `speedo-gauge`, `animated-dial`) reads the CSS-var chart tokens; update any hardcoded
  series colours.
- **Colour policy** — component code references colours only through tokens (`var(--token)`
  or Tailwind `fill-*`/`stroke-*`/`text-*` token utilities). Raw hex literals live solely in
  `:root` of `globals.css`; the only exception is neutral black/white alpha values in shadows.

## Implementation Approach

**Token-first + a small new component set** (option 2). Order of work:

1. Token foundation — rewrite `globals.css` `:root` + `@theme` tokens, shadow/radius
   tokens, utility classes; wire Zilla Slab in `layout.tsx`.
2. Primitives — restyle `button`, `card`, `table`, `input`/`textarea`/`select`,
   `dialog`, `dropdown-menu`.
3. New components — `Panel`, `SectionHeading`, `StatReadout`, `Pill`.
4. Flip-component reconciliation to tokens.
5. Apply bespoke treatment to public competitive surfaces (home → players → matches →
   matrix → tournaments → shared chrome).
6. Charts palette remap.
7. Verify admin/seeder/calculator/join inherit cleanly (no broken contrast).

## Risks & Open Questions

- Modified Next.js `next/font` API (mitigated by reading the local docs first).
- Charcoal-heavy panels on a cream page must stay legible across dense tables (matrix,
  history) — watch row contrast and panel-muted text.
- The optional removal of IBM Plex Sans Condensed needs a quick usage check before
  pulling it from `layout.tsx`.

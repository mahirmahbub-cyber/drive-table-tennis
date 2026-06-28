# Vintage Scoreboard Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Drive-blue design system with a warm, tactile "vintage scoreboard" design system (cream paper page, charcoal scoreboard panels, brass accents, slab headings, mono numerals, ledger green/red semantics) and apply it across the public competitive surfaces.

**Architecture:** Token-first. Rewrite the CSS-variable token set and shadcn primitives in one pass so every surface inherits the new look, then add a small reusable component vocabulary (`Panel`, `SectionHeading`, `StatReadout`, `Pill`) for the bespoke scoreboard panels, reconcile the origin flip components to tokens, remap hardcoded chart/gauge/logo hexes, and compose the public pages. Admin/seeder/calculator/join inherit tokens only.

**Tech Stack:** Next.js 16.2.6 (modified — verify APIs against `node_modules/next/dist/docs/`), React 19.2.4, Tailwind v4 (`@theme inline` in `app/globals.css`), shadcn/ui primitives, Recharts 3.8.1, `next/font/google`.

**No testing in this plan** (per project decision). Each task verifies via `npx tsc --noEmit`, `npm run lint`, and a manual dev-server visual check. Commit after each task.

**Reference spec:** `docs/superpowers/specs/2026-06-28-vintage-scoreboard-design-system-design.md`

---

## File Structure

**Created:**
- `components/scoreboard/panel.tsx` — charcoal scoreboard frame
- `components/scoreboard/section-heading.tsx` — slab heading + brass kicker/rule
- `components/scoreboard/stat-readout.tsx` — reusable flip-tile hero/stat number
- `components/scoreboard/pill.tsx` — W/L / status chip with semantic variants
- `components/scoreboard/index.ts` — barrel export

**Modified (foundation):**
- `app/layout.tsx` — add Zilla Slab font variable
- `app/globals.css` — full token rewrite, shadow tokens, utilities

**Modified (primitives):** `components/ui/{button,card,table,input,textarea,select,dialog,dropdown-menu}.tsx`

**Modified (origin look → tokens):** `components/flip-pad/{flip-pad,flip-card,games-strip,player-label-select}.tsx`, `components/flip-number.tsx`, `components/race-result.tsx`

**Modified (hardcoded hex remap):** `components/{elo-chart,speedo-gauge,pixel-rally,site-nav-shared,animated-dial}.tsx`, `components/home/h2h-elo-chart.tsx`

**Modified (chrome):** `components/{site-header,nav,site-nav-shared}.tsx`

**Modified (page application):** `app/(public)/page.tsx`, `app/(public)/players/page.tsx`, `app/(public)/players/[id]/page.tsx`, `app/(public)/matches/page.tsx`, `app/(public)/matrix/page.tsx`, `app/(public)/tournaments/page.tsx`, `app/(public)/tournaments/[id]/page.tsx`, and the components they render (`leaderboard`, `recent-matches`, `match-detail-modal`, `match-scoreline`, `bracket-view`, `in-form-card`, `home/*`).

---

## Task 1: Wire the Zilla Slab display font

**Files:**
- Read first: `node_modules/next/dist/docs/01-app/01-getting-started/13-fonts.md` and `node_modules/next/dist/docs/01-app/03-api-reference/02-components/font.md`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Verify the `next/font/google` API for this Next version**

Run: `bat node_modules/next/dist/docs/01-app/01-getting-started/13-fonts.md`
Confirm the `next/font/google` import + `variable` + `weight` + `subsets` pattern matches what `app/layout.tsx` already does for IBM Plex. Do **not** assume the API; if it differs, follow the doc.

- [ ] **Step 2: Add Zilla Slab alongside the existing fonts**

In `app/layout.tsx`, add `Zilla_Slab` to the `next/font/google` import and define it after `plexMono`:

```tsx
import {
  IBM_Plex_Sans,
  IBM_Plex_Sans_Condensed,
  IBM_Plex_Mono,
  Zilla_Slab,
} from "next/font/google";

// ...existing plex definitions...

const zillaSlab = Zilla_Slab({
  variable: "--font-zilla-slab",
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
});
```

Add the variable to the `<html>` className:

```tsx
<html
  lang="en"
  className={`${plexSans.variable} ${plexCondensed.variable} ${plexMono.variable} ${zillaSlab.variable} h-full antialiased`}
>
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: load Zilla Slab display font"
```

---

## Task 2: Rewrite the design tokens in globals.css

**Files:**
- Modify: `app/globals.css`

This task replaces the Drive-brand token block, adds new `@theme` colour mappings so Tailwind generates `bg-panel`/`text-brass`/etc. utilities, adds shadow tokens, remaps the display font, and updates the utility classes.

- [ ] **Step 1: Add new colour tokens to the `@theme inline` block**

In `app/globals.css`, inside `@theme inline { ... }`, after the existing `--color-loss: var(--loss);` line, add:

```css
  /* ── Vintage scoreboard surfaces ── */
  --color-paper: var(--paper);
  --color-cream: var(--cream);
  --color-cream-lift: var(--cream-lift);
  --color-ink: var(--ink);
  --color-ink-muted: var(--ink-muted);
  --color-panel: var(--panel);
  --color-panel-raised: var(--panel-raised);
  --color-panel-line: var(--panel-line);
  --color-panel-foreground: var(--panel-foreground);
  --color-panel-muted: var(--panel-muted);
  --color-brass: var(--brass);
  --color-brass-deep: var(--brass-deep);
  --color-gain-strong: var(--gain-strong);
  --color-loss-strong: var(--loss-strong);
```

- [ ] **Step 2: Remap the display font in `@theme inline`**

Change the existing line:

```css
  --font-display: var(--font-ibm-plex-condensed);
```

to:

```css
  --font-display: var(--font-zilla-slab);
```

Leave `--font-sans` and `--font-mono` unchanged.

- [ ] **Step 3: Replace the entire `:root` block with the vintage palette**

Replace the whole `:root { ... }` block (the Drive-brand theme, roughly lines 70–116) and its banner comment with:

```css
/* ═══════════════════════════════════════════════
   VINTAGE SCOREBOARD THEME — warm two-tone.
   Cream/paper page, charcoal scoreboard panels, brass accents.
   Ledger semantics: muted green = gain/win, terracotta = loss.
   ═══════════════════════════════════════════════ */
:root {
  /* Raw palette */
  --paper: #efe6d0;
  --cream: #fdf6e3;
  --cream-lift: #fffaf0;
  --ink: #1b1d22;
  --ink-muted: #7a6c4d;
  --panel: #1b1d22;
  --panel-raised: #2a2d33;
  --panel-line: #34383f;
  --panel-foreground: #f3ede0;
  --panel-muted: #9c958a;
  --brass: #e0a92a;
  --brass-deep: #a97c14;
  --brass-glow: rgb(231 200 106 / 0.5);

  /* Semantic (shadcn-aligned) */
  --background: #efe6d0;
  --foreground: #1b1d22;
  --card: #fdf6e3;
  --card-foreground: #1b1d22;
  --popover: #fdf6e3;
  --popover-foreground: #1b1d22;

  --primary: #e0a92a;
  --primary-foreground: #1b1d22;

  --secondary: #f3ead2;
  --secondary-foreground: #7a6c4d;
  --muted: #ece1c9;
  --muted-foreground: #7a6c4d;
  --accent: #f3e6c4;
  --accent-foreground: #a97c14;
  --destructive: #c0553b;

  --border: #e3d6ad;
  --input: #d8c9a0;
  --ring: #e0a92a;

  /* Ledger semantics — two tunings for contrast on each surface */
  --gain: #3f7d4f;
  --gain-strong: #7cc08a;
  --gain-muted: rgb(63 125 79 / 0.16);
  --loss: #c0553b;
  --loss-strong: #e0795f;
  --loss-muted: rgb(192 85 59 / 0.16);

  --radius: 0.45rem;

  /* Charts — brass lead, ledger green/red, ink + muted */
  --chart-1: #e0a92a;
  --chart-2: #3f7d4f;
  --chart-3: #c0553b;
  --chart-4: #1b1d22;
  --chart-5: #9c958a;

  /* Sidebar / nav — charcoal world */
  --sidebar: #1b1d22;
  --sidebar-foreground: #f3ede0;
  --sidebar-primary: #e0a92a;
  --sidebar-primary-foreground: #1b1d22;
  --sidebar-accent: #2a2d33;
  --sidebar-accent-foreground: #e0a92a;
  --sidebar-border: #000000;
  --sidebar-ring: #e0a92a;

  /* Tactile shadows */
  --shadow-panel: 0 5px 12px rgb(0 0 0 / 0.28), inset 0 -6px 0 rgb(0 0 0 / 0.22), inset 0 1px 0 rgb(255 255 255 / 0.05);
  --shadow-key: 0 2px 0 var(--brass-deep), 0 3px 5px rgb(0 0 0 / 0.3);
  --shadow-tile: 0 2px 4px rgb(0 0 0 / 0.3), inset 0 -4px 0 rgb(0 0 0 / 0.05);
}
```

- [ ] **Step 4: Update the utility classes**

In the `@layer utilities` block, update `.font-display` and the gain/loss helpers, and add the panel utilities. Replace the existing `.font-display`, `.text-gain`, `.bg-gain-muted`, `.text-loss` rules with:

```css
  /* Display / heading font — slab */
  .font-display {
    font-family: var(--font-display), 'Zilla Slab', Georgia, 'Times New Roman', serif;
    font-feature-settings: "kern" 1, "tnum" 1;
  }

  /* Ledger semantics */
  .text-gain { color: var(--gain); }
  .text-gain-strong { color: var(--gain-strong); }
  .text-loss { color: var(--loss); }
  .text-loss-strong { color: var(--loss-strong); }
  .bg-gain-muted { background-color: var(--gain-muted); }
  .bg-loss-muted { background-color: var(--loss-muted); }

  /* Charcoal scoreboard panel */
  .panel {
    background-image: linear-gradient(var(--panel-raised), var(--panel));
    color: var(--panel-foreground);
    border-radius: var(--radius) var(--radius) calc(var(--radius) + 0.25rem) calc(var(--radius) + 0.25rem);
    box-shadow: var(--shadow-panel);
  }
  /* Brass divider rule */
  .brass-rule {
    height: 2px;
    background-color: var(--brass);
    border-radius: 2px;
  }
  /* Split-flap centre seam */
  .hinge {
    position: absolute;
    left: 0; right: 0; top: 50%;
    height: 1px;
    background-color: rgb(0 0 0 / 0.18);
    pointer-events: none;
  }
```

Leave `.nums`, `.data-row`, and `.section-header` rules in place (they reference tokens that still exist). Update `.section-header` only if its `text-muted-foreground`/`border-border` still reads well against cream (it does — no change needed).

- [ ] **Step 5: Typecheck + lint + visual smoke**

Run: `npx tsc --noEmit`
Run: `npm run lint`
Run: `npm run dev`, open `http://localhost:3000` — confirm the page background is warm cream, default buttons are brass, and nothing is unstyled/black-on-black. (Pages will look half-converted until later tasks — that's expected. You're only checking the tokens resolve.)
Expected: no type/lint errors; cream page, brass primary buttons.

- [ ] **Step 6: Commit**

```bash
git add app/globals.css
git commit -m "feat: vintage scoreboard design tokens"
```

---

## Task 3: Restyle the Button primitive

**Files:**
- Modify: `components/ui/button.tsx`

- [ ] **Step 1: Update the `buttonVariants` variants**

In `components/ui/button.tsx`, replace the `variant` map inside `cva(...)` with brass-key styling. The base string keeps its layout classes; change the focus ring reference is already `ring-ring` (now brass via token). Replace the `variant` object with:

```tsx
      variant: {
        default:
          "bg-primary text-primary-foreground font-display shadow-[var(--shadow-key)] hover:brightness-105 active:translate-y-px active:shadow-none",
        destructive:
          "bg-destructive text-white shadow-[var(--shadow-key)] hover:brightness-105 active:translate-y-px active:shadow-none focus-visible:ring-destructive/30",
        outline:
          "border border-border bg-cream text-ink shadow-xs hover:bg-cream-lift",
        secondary:
          "bg-secondary text-secondary-foreground hover:brightness-[0.98]",
        ghost:
          "hover:bg-accent hover:text-accent-foreground",
        link: "text-brass-deep underline-offset-4 hover:underline",
      },
```

Keep the `size` map unchanged.

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 3: Visual check**

Run (if not already): `npm run dev`, open `http://localhost:3000`. Confirm the primary button reads as a raised brass "key" (ink text, brass body, subtle bottom edge), and it presses down on click.

- [ ] **Step 4: Commit**

```bash
git add components/ui/button.tsx
git commit -m "feat: brass key button variant"
```

---

## Task 4: Restyle the remaining shadcn primitives

**Files:**
- Modify: `components/ui/card.tsx`, `components/ui/table.tsx`, `components/ui/input.tsx`, `components/ui/textarea.tsx`, `components/ui/select.tsx`, `components/ui/dialog.tsx`, `components/ui/dropdown-menu.tsx`

Most of these already read `bg-card`/`border`/`bg-background`/`ring-ring` tokens and convert automatically. Make only the deliberate tweaks below; do not rewrite working markup.

- [ ] **Step 1: Card — add the tactile bottom lip**

In `components/ui/card.tsx`, change the root `Card` className from:

```tsx
"rounded-xl border bg-card text-card-foreground shadow"
```

to:

```tsx
"rounded-lg border border-border bg-card text-card-foreground shadow-[inset_0_-4px_0_rgb(0_0_0_/_0.04)]"
```

- [ ] **Step 2: Inputs — cream field + inset + brass ring**

In `components/ui/input.tsx` and `components/ui/textarea.tsx`, ensure the field uses the cream surface and an inset shadow. Add these classes to the existing className string (keep all other classes): `bg-cream shadow-[inset_0_1px_2px_rgb(0_0_0_/_0.06)]`. The focus ring already uses `ring-ring` (brass). For `components/ui/select.tsx`, add `bg-cream` to the `SelectTrigger` className.

- [ ] **Step 3: Table — mono brass headers**

In `components/ui/table.tsx`, on the `TableHead` component add `font-mono uppercase tracking-wider text-xs text-ink-muted` to its className (keep existing). On `TableRow` confirm the divider uses `border-border` (cream hairline) — if it references another token, leave it; the token now resolves to cream.

- [ ] **Step 4: Dialog / DropdownMenu — confirm token inheritance**

Open `components/ui/dialog.tsx` and `components/ui/dropdown-menu.tsx`. They use `bg-popover`/`bg-background`/`border` tokens — confirm no hardcoded light-mode hex remains. No change unless a literal hex is present (none expected).

- [ ] **Step 5: Typecheck + lint + visual**

Run: `npx tsc --noEmit && npm run lint`
Run: `npm run dev`, open `http://localhost:3000/join` and `http://localhost:3000/calculator` — confirm inputs are cream with brass focus rings and cards have the subtle bottom lip.
Expected: no errors; cream fields, brass focus.

- [ ] **Step 6: Commit**

```bash
git add components/ui/card.tsx components/ui/table.tsx components/ui/input.tsx components/ui/textarea.tsx components/ui/select.tsx components/ui/dialog.tsx components/ui/dropdown-menu.tsx
git commit -m "feat: restyle ui primitives for cream surfaces"
```

---

## Task 5: Add the scoreboard component vocabulary

**Files:**
- Create: `components/scoreboard/panel.tsx`, `components/scoreboard/section-heading.tsx`, `components/scoreboard/stat-readout.tsx`, `components/scoreboard/pill.tsx`, `components/scoreboard/index.ts`

- [ ] **Step 1: Create `Panel`**

Create `components/scoreboard/panel.tsx`:

```tsx
import * as React from 'react'
import { cn } from '@/lib/utils'

export function Panel({
  kicker,
  title,
  rule = true,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  kicker?: string
  title?: string
  rule?: boolean
}) {
  return (
    <div className={cn('panel px-3.5 py-3.5 sm:px-4 sm:py-4', className)} {...props}>
      {(kicker || title) && (
        <div className="mb-2">
          {kicker && (
            <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-brass">
              {kicker}
            </div>
          )}
          {title && (
            <div className="font-display text-lg leading-tight text-panel-foreground">
              {title}
            </div>
          )}
          {rule && <div className="brass-rule mt-1.5 opacity-85" />}
        </div>
      )}
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Create `SectionHeading`**

Create `components/scoreboard/section-heading.tsx`:

```tsx
import * as React from 'react'
import { cn } from '@/lib/utils'

export function SectionHeading({
  kicker,
  surface = 'cream',
  rule = true,
  className,
  children,
}: {
  kicker?: string
  surface?: 'cream' | 'panel'
  rule?: boolean
  className?: string
  children: React.ReactNode
}) {
  const titleColor = surface === 'panel' ? 'text-panel-foreground' : 'text-ink'
  const kickerColor = surface === 'panel' ? 'text-brass' : 'text-ink-muted'
  return (
    <div className={cn('mb-3', className)}>
      {kicker && (
        <div className={cn('font-mono text-[10px] uppercase tracking-[0.16em]', kickerColor)}>
          {kicker}
        </div>
      )}
      <h2 className={cn('font-display text-2xl leading-tight', titleColor)}>{children}</h2>
      {rule && <div className="brass-rule mt-2 opacity-85" />}
    </div>
  )
}
```

- [ ] **Step 3: Create `StatReadout`** (composes the existing `FlipNumber`)

Create `components/scoreboard/stat-readout.tsx`:

```tsx
import { FlipNumber } from '@/components/flip-number'

export function StatReadout({
  label,
  value,
  from = 0,
}: {
  label: string
  value: number
  from?: number
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-brass">
        {label}
      </span>
      <FlipNumber from={from} to={value} />
    </div>
  )
}
```

- [ ] **Step 4: Create `Pill`**

Create `components/scoreboard/pill.tsx`:

```tsx
import * as React from 'react'
import { cn } from '@/lib/utils'

const variants = {
  gain: 'bg-gain-muted text-gain',
  loss: 'bg-loss-muted text-loss',
  brass: 'bg-[color-mix(in_srgb,var(--brass)_18%,transparent)] text-brass-deep',
  neutral: 'bg-muted text-ink-muted',
} as const

export function Pill({
  variant = 'neutral',
  className,
  children,
}: {
  variant?: keyof typeof variants
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-block rounded-md px-2 py-0.5 font-mono nums text-xs font-bold',
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}
```

- [ ] **Step 5: Create the barrel export**

Create `components/scoreboard/index.ts`:

```ts
export { Panel } from './panel'
export { SectionHeading } from './section-heading'
export { StatReadout } from './stat-readout'
export { Pill } from './pill'
```

- [ ] **Step 6: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add components/scoreboard
git commit -m "feat: scoreboard component vocabulary"
```

---

## Task 6: Reconcile the flip components to tokens

**Files:**
- Modify: `components/flip-pad/flip-pad.tsx`, `components/flip-pad/flip-card.tsx`, `components/flip-pad/games-strip.tsx`, `components/flip-pad/player-label-select.tsx`, `components/flip-number.tsx`, `components/race-result.tsx`

Swap hardcoded hexes for the matching tokens. Behaviour and layout are unchanged — only the literal colours change. Mapping:

| Literal | Replace with class/value |
| --- | --- |
| `#fdf6e3` | `bg-cream` / `var(--cream)` |
| `#fffaf0` | `bg-cream-lift` / `var(--cream-lift)` |
| `#1b1d22` | `text-ink` / `var(--ink)` |
| `#e0a92a` | `text-brass` / `bg-brass` / `var(--brass)` |
| `#9aa3b2`, `#cfd2d8` | `text-panel-muted` / `var(--panel-muted)` |
| `#2a2d33`→`#1b1d22` gradient | the `.panel` utility, or `from-panel-raised to-panel` |
| `ring-[#e0a92a]` | `ring-brass` |

- [ ] **Step 1: flip-pad.tsx**

Replace the outer frame `bg-linear-to-b from-[#2a2d33] to-[#1b1d22] ... shadow-[...]` with `panel` (the utility now carries the gradient + shadow). Replace `text-[#9aa3b2]` → `text-panel-muted`, `text-[#cfd2d8]` → `text-panel-muted`, `bg-[#e0a92a] text-[#1b1d22]` → `bg-brass text-ink`, `text-white` on the games tally stays (it's on charcoal) or becomes `text-panel-foreground`. Update the `GamePointTag` brass pill and `TargetSelector` active state the same way.

- [ ] **Step 2: flip-card.tsx**

Replace `bg-[#fffaf0]` → `bg-cream-lift`, `bg-[#fdf6e3]` → `bg-cream`, `ring-[#e0a92a]` → `ring-brass`, `text-[#e0a92a]/70` → `text-brass/70`, `text-[#e0a92a]/55` → `text-brass/55`, `text-[#1b1d22]` → `text-ink`, `text-[#1b1d22]/30` → `text-ink/30`, `caret-[#1b1d22]` → `caret-ink`, `group-focus-within:border-[#e0a92a]` → `group-focus-within:border-brass`. The lead-tile glow shadow keeps its rgba but swap the gold rgba to `var(--brass-glow)`: `shadow-[0_3px_10px_var(--brass-glow),inset_0_-6px_0_rgb(0_0_0_/_0.06)]`. The centre seam `bg-black/15` → use the `hinge` utility class on that span (drop the inline bg).

- [ ] **Step 3: games-strip.tsx + player-label-select.tsx**

Run `rg -n '#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}\b' components/flip-pad/games-strip.tsx components/flip-pad/player-label-select.tsx` and replace each literal per the mapping table.

- [ ] **Step 4: flip-number.tsx**

Replace `bg-[#fdf6e3]` → `bg-cream`, `text-[#1b1d22]` → `text-ink`. Replace the inline tile shadow with `shadow-[var(--shadow-tile)]`. Replace the `bg-black/20` seam span with the `hinge` utility class.

- [ ] **Step 5: race-result.tsx**

Run `rg -n '#[0-9a-fA-F]{6}' components/race-result.tsx` and replace literals per the mapping table.

- [ ] **Step 6: Typecheck + lint + visual**

Run: `npx tsc --noEmit && npm run lint`
Run: `npm run dev`, open the logger (homepage logging flow) and confirm the flip-pad scorer looks identical to before (cream tiles, brass accents, charcoal frame) — now token-driven.
Expected: no errors; scorer visually unchanged.

- [ ] **Step 7: Commit**

```bash
git add components/flip-pad components/flip-number.tsx components/race-result.tsx
git commit -m "refactor: flip components consume design tokens"
```

---

## Task 7: Remap hardcoded chart, gauge, and logo hexes

**Files:**
- Modify: `components/elo-chart.tsx`, `components/home/h2h-elo-chart.tsx`, `components/speedo-gauge.tsx`, `components/pixel-rally.tsx`, `components/site-nav-shared.tsx`, `components/animated-dial.tsx`

Recharts series colours are passed as literal props, so tokens won't reach them — edit the literals. Mapping: `#2960c5` → `#e0a92a` (brass, primary series); `#3b97fa` → `#3f7d4f` (gain green, secondary series); `#ff5e55` → `#c0553b` (terracotta); `#10489e` → `#1b1d22` (ink); grid `#e3e3e5` → `#e3d6ad`; `#cfcfcf` reference line → `#c9b98a`.

- [ ] **Step 1: elo-chart.tsx**

Replace `stroke="#2960c5"` → `stroke="#e0a92a"`, the cursor `stroke: '#2960c5'` → `'#e0a92a'`, grid `stroke="#e3e3e5"` → `"#e3d6ad"`, reference `stroke="#cfcfcf"` → `"#c9b98a"`, and any `fill="#2960c5"` dots → `fill="#e0a92a"`.

- [ ] **Step 2: h2h-elo-chart.tsx**

Same mapping: `#2960c5` (stroke/cursor/dot/activeDot fill) → `#e0a92a`; grid `#e3e3e5` → `#e3d6ad`; reference `#cfcfcf` → `#c9b98a`. If the chart plots two players, give the second series `#3f7d4f` (gain green) so the two lines stay distinguishable — check the component for a second `<Line>`/`stroke` and set it.

- [ ] **Step 3: speedo-gauge.tsx**

Gradient stops: `#2960c5` → `#e0a92a`, `#3b97fa` → `#3f7d4f`, `#ff5e55` → `#c0553b`.

- [ ] **Step 4: pixel-rally.tsx (logo animation)**

`color="#2960c5"` (left paddle) → `"#1b1d22"` (ink), `color="#ff5e55"` (right paddle) → `"#e0a92a"` (brass), trail `fill="#3b97fa"` → `"#c9b98a"`.

- [ ] **Step 5: site-nav-shared.tsx (logo SVG)**

`fill="#2960c5"` → `"#1b1d22"`, `fill="#10489e"` → `"#a97c14"` (brass-deep), `fill="#ff5e55"` → `"#e0a92a"` (brass).

- [ ] **Step 6: animated-dial.tsx**

Run `rg -n '#[0-9a-fA-F]{6}' components/animated-dial.tsx` and remap any blue/coral literals per the mapping table. If none, skip.

- [ ] **Step 7: Typecheck + lint + visual**

Run: `npx tsc --noEmit && npm run lint`
Run: `npm run dev`, open `http://localhost:3000/players/<some-id>` (ELO chart) and the homepage (logo) — confirm no Drive-blue remains in charts, gauges, or the logo.
Expected: no errors; charts brass/green, logo ink/brass.

- [ ] **Step 8: Commit**

```bash
git add components/elo-chart.tsx components/home/h2h-elo-chart.tsx components/speedo-gauge.tsx components/pixel-rally.tsx components/site-nav-shared.tsx components/animated-dial.tsx
git commit -m "feat: remap charts, gauges, logo to vintage palette"
```

---

## Task 8: Restyle the shared chrome (nav/header)

**Files:**
- Modify: `components/site-header.tsx`, `components/nav.tsx`, `components/site-nav-shared.tsx`

- [ ] **Step 1: Charcoal nav bar**

In `components/site-header.tsx`, set the header container surface to the charcoal panel world: background `bg-panel`, text `text-panel-foreground`, bottom border `border-b border-black`. Nav links: default `text-panel-muted`, hover/active `text-brass`. Replace the two `hover:bg-[#10489e]` occurrences (the CTA buttons) with `hover:brightness-105` (they already use `bg-primary`/brass). Confirm any active-link underline/indicator uses `bg-brass`.

- [ ] **Step 2: nav.tsx**

Apply the same link colours (`text-panel-muted` default, `text-brass` active/hover) to `components/nav.tsx`. If it renders on a cream surface anywhere, use `surface`-appropriate colours; the primary nav is charcoal.

- [ ] **Step 3: Typecheck + lint + visual**

Run: `npx tsc --noEmit && npm run lint`
Run: `npm run dev`, open `http://localhost:3000` — confirm the top nav is charcoal with brass active link and the ink/brass logo.
Expected: no errors; charcoal nav.

- [ ] **Step 4: Commit**

```bash
git add components/site-header.tsx components/nav.tsx components/site-nav-shared.tsx
git commit -m "feat: charcoal scoreboard nav chrome"
```

---

## Task 9: Apply bespoke treatment to the Home page

**Files:**
- Modify: `app/(public)/page.tsx`, and the home components it renders: `components/home/this-week.tsx`, `components/home/mogboard.tsx`, `components/leaderboard.tsx`, `components/recent-matches.tsx`, `components/in-form-card.tsx`

- [ ] **Step 1: Map the home composition**

Run: `bat app/(public)/page.tsx` and note each section block. Wrap the ladder/leaderboard and weekly-stat blocks in the new `Panel` (charcoal), and replace ad-hoc section titles with `SectionHeading`. Import from `@/components/scoreboard`.

- [ ] **Step 2: Leaderboard panel**

In `components/leaderboard.tsx`, render rows inside a `Panel` (or apply `.panel` to its container). Rank/name use `text-panel-foreground`, ELO uses `font-mono text-panel-foreground`, ΔELO uses `text-gain-strong`/`text-loss-strong` (panel tunings). Row dividers: `border-panel-line`.

- [ ] **Step 3: Hero stat**

If the home hero shows a count (e.g. matches logged this week), render it with `StatReadout`. Otherwise apply `SectionHeading` to the hero title (slab).

- [ ] **Step 4: in-form-card.tsx**

Update the ΔELO colours: the existing comment says "blue for gain, coral for loss". Replace the gain/loss colour classes with `text-gain`/`text-loss` (cream surface) or `-strong` variants if the card sits on a panel. Replace any `bg-gain-muted` usage — token already remapped.

- [ ] **Step 5: recent-matches.tsx + this-week.tsx + mogboard.tsx**

Apply `SectionHeading` for titles; wrap data blocks in `Panel` where they represent scoreboard data. W/L counts use `Pill`. Run `rg -n '#[0-9a-fA-F]{6}|text-blue|text-\[#' components/home components/recent-matches.tsx` and clear any residual literals.

- [ ] **Step 6: Typecheck + lint + visual**

Run: `npx tsc --noEmit && npm run lint`
Run: `npm run dev`, open `http://localhost:3000` — confirm the homepage reads as cream page + charcoal scoreboard panels + slab headings + brass accents + green/red deltas, and the logger still works.
Expected: no errors; cohesive home page.

- [ ] **Step 7: Commit**

```bash
git add app/\(public\)/page.tsx components/home components/leaderboard.tsx components/recent-matches.tsx components/in-form-card.tsx
git commit -m "feat: vintage scoreboard treatment on home"
```

---

## Task 10: Apply treatment to Players (list + profile)

**Files:**
- Modify: `app/(public)/players/page.tsx`, `app/(public)/players/[id]/page.tsx`, `components/player-avatar.tsx`, `components/player-games-history.tsx`, `components/title-badge.tsx`

- [ ] **Step 1: Players list**

In `app/(public)/players/page.tsx`, wrap the leaderboard/standings in `Panel` and title with `SectionHeading`. Reuse the leaderboard styling from Task 9.

- [ ] **Step 2: Player profile**

In `app/(public)/players/[id]/page.tsx`, apply `SectionHeading` to section titles, wrap stat blocks in `Panel`, render the ELO chart inside a cream `Card` (charts read better on cream). W/L and streaks use `Pill`. ΔELO history uses `text-gain`/`text-loss`.

- [ ] **Step 3: Supporting components**

In `components/player-games-history.tsx` and `components/title-badge.tsx`, run `rg -n 'text-\[#|#[0-9a-fA-F]{6}|blue|coral'` and replace residual brand colours with tokens (`text-brass`, `text-gain`, `text-loss`, `text-ink-muted`).

- [ ] **Step 4: Typecheck + lint + visual**

Run: `npx tsc --noEmit && npm run lint`
Run: `npm run dev`, open `http://localhost:3000/players` and a profile — confirm panels, slab headings, brass/green/red, and a brass/green ELO chart on cream.
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/\(public\)/players components/player-avatar.tsx components/player-games-history.tsx components/title-badge.tsx
git commit -m "feat: vintage scoreboard treatment on players"
```

---

## Task 11: Apply treatment to Matches + match detail

**Files:**
- Modify: `app/(public)/matches/page.tsx`, `components/match-detail-modal.tsx`, `components/match-scoreline.tsx`, `components/view-game-button.tsx`

- [ ] **Step 1: Matches list**

In `app/(public)/matches/page.tsx`, title with `SectionHeading`, wrap the match list in `Panel` (or cream `Card` per row). Scores use `font-mono`.

- [ ] **Step 2: Match detail modal**

In `components/match-detail-modal.tsx`, the dialog surface is cream (token). Set the scoreline header on a charcoal `.panel` strip, set-scores in `font-mono`, ΔELO via `DeltaCounter` coloured `text-gain`/`text-loss`. Run `rg -n 'text-\[#|#[0-9a-fA-F]{6}|zinc|blue|coral' components/match-detail-modal.tsx components/match-scoreline.tsx` and replace literals (e.g. `text-zinc-500` → `text-ink-muted`).

- [ ] **Step 3: Typecheck + lint + visual**

Run: `npx tsc --noEmit && npm run lint`
Run: `npm run dev`, open `http://localhost:3000/matches`, open a match — confirm the modal reads cream with a charcoal scoreline and green/red deltas.
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/\(public\)/matches components/match-detail-modal.tsx components/match-scoreline.tsx components/view-game-button.tsx
git commit -m "feat: vintage scoreboard treatment on matches"
```

---

## Task 12: Apply treatment to the Matrix

**Files:**
- Modify: `app/(public)/matrix/page.tsx`, `components/home/mogboard.tsx` (if shared), and any matrix table component

- [ ] **Step 1: Matrix grid**

In `app/(public)/matrix/page.tsx`, title with `SectionHeading`. The H2H grid is dense — keep it on cream `Card` for legibility (a full charcoal matrix would be hard to read). Cells: win = `text-gain`/`bg-gain-muted`, loss = `text-loss`/`bg-loss-muted`, diagonal/empty = `bg-muted`. Headers `font-mono text-ink-muted`. Run `rg -n 'text-\[#|#[0-9a-fA-F]{6}|blue|coral'` on the file and any matrix component and clear literals.

- [ ] **Step 2: Contrast check (dense data)**

Verify small cell text stays AA-legible: never brass-on-cream for small text; use `text-ink`/`text-gain`/`text-loss`. Adjust any cell that fails.

- [ ] **Step 3: Typecheck + lint + visual**

Run: `npx tsc --noEmit && npm run lint`
Run: `npm run dev`, open `http://localhost:3000/matrix` — confirm the grid is legible, green wins / red losses, no blue.
Expected: no errors; legible matrix.

- [ ] **Step 4: Commit**

```bash
git add app/\(public\)/matrix components/home/mogboard.tsx
git commit -m "feat: vintage scoreboard treatment on matrix"
```

---

## Task 13: Apply treatment to Tournaments + bracket

**Files:**
- Modify: `app/(public)/tournaments/page.tsx`, `app/(public)/tournaments/[id]/page.tsx`, `components/bracket-view.tsx`, `components/tournament-create-form.tsx`

- [ ] **Step 1: Tournaments list + detail**

Titles via `SectionHeading`; tournament cards as cream `Card`. Run `rg -n 'text-\[#|#[0-9a-fA-F]{6}|zinc|blue|coral' app/\(public\)/tournaments components/tournament-create-form.tsx` and replace literals (e.g. `text-zinc-500` → `text-ink-muted`).

- [ ] **Step 2: Bracket view**

In `components/bracket-view.tsx`, match nodes become small charcoal `.panel` cards or cream `Card`s with `font-mono` scores; winner highlighted with `text-brass`/`ring-brass`; connector lines `border-border` (cream) or `border-panel-line` on charcoal. Clear any blue/coral literals.

- [ ] **Step 3: Typecheck + lint + visual**

Run: `npx tsc --noEmit && npm run lint`
Run: `npm run dev`, open `http://localhost:3000/tournaments` and a bracket — confirm vintage styling and brass winner highlight.
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/\(public\)/tournaments components/bracket-view.tsx components/tournament-create-form.tsx
git commit -m "feat: vintage scoreboard treatment on tournaments"
```

---

## Task 14: Verify utilitarian + admin surfaces inherit cleanly

**Files:**
- Modify (only if contrast breaks): `app/(public)/seeder/*`, `components/seeder/*`, `app/(public)/calculator/page.tsx`, `components/elo-calculator.tsx`, `app/(public)/join/page.tsx`, `components/join-form.tsx`, `app/admin/**`

These inherit tokens only — no bespoke panels. The job is to confirm they read correctly and fix any residual brand literals or broken contrast.

- [ ] **Step 1: Sweep for residual brand literals**

Run: `rg -n '#2960c5|#10489e|#3b97fa|#ff5e55|#c7301f|#eef3fc|text-blue|bg-blue|hover:bg-\[#10489e\]' app components | rg -v node_modules`
Replace every remaining hit with the token equivalent (`bg-primary`/`text-brass`/`text-gain`/`text-loss`/`text-ink-muted`). The `join-form.tsx` `hover:bg-[#10489e]` → `hover:brightness-105`.

- [ ] **Step 2: Visual contrast pass**

Run: `npm run dev` and open `/seeder`, `/calculator`, `/join`, `/admin` (log in if needed). Confirm: text is legible on cream, inputs are cream with brass focus, primary actions are brass keys, no black-on-black or blue remnants.

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors; `rg` sweep from Step 1 returns nothing.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "fix: clear residual brand colours on utility + admin surfaces"
```

---

## Task 15: Final pass — build, font cleanup, full visual review

**Files:**
- Modify (optional): `app/layout.tsx`

- [ ] **Step 1: Optional — drop the now-unused condensed font**

Run: `rg -n 'font-ibm-plex-condensed|plexCondensed|IBM_Plex_Sans_Condensed|IBM Plex Sans Condensed'`
If the only hits are the import/definition/variable wiring in `app/layout.tsx` and the now-replaced fallback (no live `.font-display`-via-condensed usage), remove `IBM_Plex_Sans_Condensed` from the import, delete the `plexCondensed` definition, and drop `${plexCondensed.variable}` from the `<html>` className. If anything still references it, leave it.

- [ ] **Step 2: Full production build**

Run: `npm run build`
Expected: build succeeds with no type errors. Fix any surfaced issues.

- [ ] **Step 3: Final visual review across all public routes**

Run: `npm run dev` and walk every public route: `/`, `/players`, `/players/[id]`, `/matches`, `/matrix`, `/tournaments`, `/tournaments/[id]`, `/seeder`, `/calculator`, `/join`. Confirm a cohesive vintage scoreboard look, no Drive-blue/coral anywhere, legible contrast, working logger, and intact reduced-motion behaviour (toggle OS reduce-motion and confirm flips are suppressed).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: finalise vintage scoreboard design system"
```

---

## Self-Review Notes

- **Spec coverage:** Tokens (Task 2) ✓; slab font (Task 1) ✓; primitives (Tasks 3–4) ✓; new components (Task 5) ✓; flip reconciliation (Task 6) ✓; charts/gauge/logo remap (Task 7) ✓; chrome (Task 8) ✓; bespoke public surfaces — home/players/matches/matrix/tournaments (Tasks 9–13) ✓; inherit-only utility + admin (Task 14) ✓; contrast + reduced-motion + fonts gotchas (Tasks 12/14/15) ✓; out-of-scope dark mode honoured (never added). 
- **Two-tuning semantics:** panel surfaces use `-strong`, cream surfaces use base — applied consistently in Tasks 9–13.
- **No automated tests** by project decision; verification is typecheck + lint + dev visual + final build.

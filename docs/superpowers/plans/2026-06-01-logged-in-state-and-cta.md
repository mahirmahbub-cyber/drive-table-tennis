# Logged-in State, Admin Entry Points & Join CTA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make the public site session-aware — show admin entry points and a "New game" shortcut, route logged-out users through login (and back to where they were going), and add a small "create a profile" CTA card to the home sidebar.

**Architecture:** There is ONE identity: the admin, via a signed httpOnly `admin_session` cookie (`lib/auth.ts`). The public `SiteHeader` is a client component and cannot read the httpOnly cookie, so the public **layout** (server) reads it via `verifySessionCookie` and passes `isLoggedIn` down. `/admin/*` is already protected by `proxy.ts`; we add a `next` return-path so logged-out users land on their target after login. No schema/data changes.

**Tech Stack:** Next.js (this repo's modified version — server actions used as `<form action={fn}>` must return void/redirect, NOT a value; `cookies()`/`searchParams`/`params` are async), React, Tailwind v4 + design tokens, lucide-react.

**Design language:** Use existing tokens only — `font-display`, `bg-card`, `border-border`, `text-muted-foreground`, `primary` (Drive blue; hover `#10489e`), `secondary`. Match `components/site-header.tsx` and the home hero in `app/(public)/page.tsx`. Icons from `lucide-react`.

**Behaviour summary:**
- Logged OUT: header shows **New game** + **Admin Log In**. Clicking New game → `/admin/matches/new` → proxy bounces to `/admin/login?next=/admin/matches/new` → after login, lands on the log-game form.
- Logged IN: header shows **New game** + **Admin** (→ `/admin`) + **Sign out**.
- Home hero gains a **New game** button (everyone); existing "Join the ladder" button stays.
- Home right sidebar gains a small **"Create a profile"** CTA card.

---

### Task 1: Return-to auth flow (proxy + login page + login action) with open-redirect guard

**Files:**
- Modify: `lib/auth.ts` (add pure `safeAdminNext` helper)
- Create: `lib/auth.test.ts`
- Modify: `proxy.ts` (attach `next` on redirect)
- Modify: `app/actions/auth.ts` (honor `next`)
- Rewrite: `app/admin/login/page.tsx` (carry `next`, light design-system restyle)

**Context:** `proxy.ts` redirects unauthenticated `/admin/*` to `/admin/login` but loses the intended destination; `login` always redirects to `/admin`. We thread a `next` param through, guarded so it can only be an internal `/admin…` path (no open redirect).

- [ ] **Step 1: Write failing test for the guard**

Create `lib/auth.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { safeAdminNext } from './auth'

describe('safeAdminNext', () => {
  it('allows internal /admin paths', () => {
    expect(safeAdminNext('/admin/matches/new')).toBe('/admin/matches/new')
    expect(safeAdminNext('/admin')).toBe('/admin')
  })
  it('falls back to /admin for non-admin or unsafe paths', () => {
    expect(safeAdminNext('/players')).toBe('/admin')
    expect(safeAdminNext('//evil.com')).toBe('/admin')
    expect(safeAdminNext('https://evil.com')).toBe('/admin')
    expect(safeAdminNext(null)).toBe('/admin')
    expect(safeAdminNext(undefined)).toBe('/admin')
    expect(safeAdminNext('')).toBe('/admin')
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm run test -- auth`
Expected: FAIL (safeAdminNext not exported).

- [ ] **Step 3: Add the guard to `lib/auth.ts`** (append; keep it pure — no `next/headers` import, the edge proxy imports this file)

```ts
/**
 * Returns `next` only if it's a safe internal admin path, else '/admin'.
 * Guards against open redirects (//host, https://, non-admin routes).
 */
export function safeAdminNext(next: string | null | undefined): string {
  if (typeof next !== 'string') return '/admin'
  if (!next.startsWith('/admin')) return '/admin'
  if (next.startsWith('//')) return '/admin'
  return next
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `npm run test -- auth`
Expected: PASS.

- [ ] **Step 5: Attach `next` in `proxy.ts`**

Replace the redirect block (the `const url = req.nextUrl.clone()` ... `return NextResponse.redirect(url)` lines) with:

```ts
  const url = req.nextUrl.clone()
  url.pathname = '/admin/login'
  url.searchParams.set('next', pathname)
  return NextResponse.redirect(url)
```

- [ ] **Step 6: Honor `next` in `login` (`app/actions/auth.ts`)**

Add the import at the top alongside the existing auth import:

```ts
import { ADMIN_COOKIE, makeSessionCookie, safeAdminNext } from '@/lib/auth'
```

In `login`, read `next` and use it for both the error redirect and the success redirect. Replace the body of `login` with:

```ts
export async function login(formData: FormData) {
  const submitted = String(formData.get('password') ?? '')
  const next = safeAdminNext(String(formData.get('next') ?? ''))
  if (submitted !== process.env.ADMIN_PASSWORD) {
    redirect(`/admin/login?error=1&next=${encodeURIComponent(next)}`)
  }
  const cookie = makeSessionCookie(process.env.SESSION_SECRET!)
  ;(await cookies()).set(ADMIN_COOKIE, cookie, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  })
  redirect(next)
}
```

(Leave `logout` unchanged.)

- [ ] **Step 7: Rewrite `app/admin/login/page.tsx`** — carry `next` as a hidden field + light design-system restyle

```tsx
import { login } from '@/app/actions/auth'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>
}) {
  const { error, next } = await searchParams

  return (
    <main className="mx-auto mt-24 w-full max-w-sm px-4">
      <p className="font-display uppercase tracking-[0.2em] text-xs text-primary mb-1">
        Pit Wall
      </p>
      <h1 className="font-display text-3xl font-bold tracking-tight leading-none mb-6">
        Admin login
      </h1>
      <form action={login} className="space-y-3">
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <input
          type="password"
          name="password"
          placeholder="Password"
          autoFocus
          className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="submit"
          className="w-full rounded-md bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Sign in
        </button>
        {error ? <p className="text-sm text-loss">Wrong password</p> : null}
      </form>
    </main>
  )
}
```

- [ ] **Step 8: Verify**

Run: `npm run test && npx tsc --noEmit && npx eslint proxy.ts app/actions/auth.ts app/admin/login/page.tsx lib/auth.ts`
Expected: tests pass, no type errors, no new lint errors (ignore the known pre-existing `react-hooks/purity` error in `components/in-form-card.tsx`).

- [ ] **Step 9: Commit**

```bash
git add lib/auth.ts lib/auth.test.ts proxy.ts app/actions/auth.ts app/admin/login/page.tsx
git commit -m "feat: return-to after admin login with open-redirect guard; restyle login"
```

---

### Task 2: Session-aware public layout + header

**Files:**
- Modify: `app/(public)/layout.tsx` (read session, pass `isLoggedIn`)
- Rewrite: `components/site-header.tsx` (accept `isLoggedIn`; New game + Admin/Login/Sign out)

**Context:** `lib/auth.ts` stays pure; the layout (server component) reads the cookie. `SiteHeader` is `'use client'` (uses `usePathname`). `logout` is a void/redirecting server action, so `<form action={logout}>` bound directly is fine (AdminNav already does this).

- [ ] **Step 1: Update `app/(public)/layout.tsx`**

```tsx
import { cookies } from 'next/headers'
import { SiteHeader } from '@/components/site-header'
import { verifySessionCookie, ADMIN_COOKIE } from '@/lib/auth'

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookie = (await cookies()).get(ADMIN_COOKIE)?.value
  const isLoggedIn = verifySessionCookie(cookie, process.env.SESSION_SECRET ?? '')

  return (
    <>
      <SiteHeader isLoggedIn={isLoggedIn} />
      {children}
    </>
  )
}
```

- [ ] **Step 2: Rewrite `components/site-header.tsx`**

Keep the existing `LogoMark`, brand block, and primary NAV exactly as-is. Add the `isLoggedIn` prop, a "New game" link, and the admin/auth controls. Full file:

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import { Plus } from 'lucide-react'
import { logout } from '@/app/actions/auth'

const NAV = [
  { href: '/players', label: 'Players' },
  { href: '/matches', label: 'Matches' },
  { href: '/tournaments', label: 'Tournaments' },
]

function LogoMark() {
  return (
    <svg
      viewBox="0 0 32 32"
      width={30}
      height={30}
      aria-hidden
      style={{ shapeRendering: 'crispEdges' as const }}
    >
      <rect x={2} y={2} width={28} height={28} rx={6} fill="#2960c5" />
      {/* paddle blade */}
      <rect x={9} y={7} width={11} height={13} rx={2} fill="#ffffff" />
      <rect x={12} y={19} width={4} height={7} rx={1} fill="#10489e" />
      {/* ball */}
      <rect x={21} y={9} width={5} height={5} rx={1} fill="#ff5e55" />
    </svg>
  )
}

export function SiteHeader({ isLoggedIn }: { isLoggedIn: boolean }) {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/75">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-2 px-4 md:px-6">
        <Link href="/" className="group flex items-center gap-2.5">
          <LogoMark />
          <span className="hidden flex-col leading-none sm:flex">
            <span className="font-display text-[10px] uppercase tracking-[0.2em] text-primary">
              Drive.com.au
            </span>
            <span className="font-display text-lg font-semibold tracking-tight leading-none">
              Table Tennis
            </span>
          </span>
        </Link>

        <nav className="flex items-center gap-0.5 text-sm sm:gap-1">
          {NAV.map((item) => {
            const active =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  'rounded-md px-2.5 py-1.5 transition-colors duration-150 sm:px-3',
                  active
                    ? 'text-primary font-medium bg-secondary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                )}
              >
                {item.label}
              </Link>
            )
          })}

          {/* New game — visible to everyone; logged-out users get bounced to login */}
          <Link
            href="/admin/matches/new"
            className="ml-1 inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1.5 font-medium text-foreground transition-colors duration-150 hover:bg-secondary sm:px-3"
          >
            <Plus className="h-3.5 w-3.5" />
            New game
          </Link>

          {/* Admin auth controls */}
          {isLoggedIn ? (
            <>
              <Link
                href="/admin"
                className="rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors duration-150 hover:text-foreground hover:bg-muted sm:px-3"
              >
                Admin
              </Link>
              <form action={logout}>
                <button
                  type="submit"
                  className="rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors duration-150 hover:text-foreground hover:bg-muted sm:px-3"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/admin/login"
              className="rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors duration-150 hover:text-foreground hover:bg-muted sm:px-3"
            >
              Admin Log In
            </Link>
          )}

          <Link
            href="/join"
            className="ml-1 rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground transition-colors duration-150 hover:bg-[#10489e] sm:ml-2 sm:px-3.5"
          >
            Join
          </Link>
        </nav>
      </div>
    </header>
  )
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npx eslint "app/(public)/layout.tsx" components/site-header.tsx`
Expected: no errors. Confirm SiteHeader's only other usage is the public layout (it now requires `isLoggedIn`).

- [ ] **Step 4: Commit**

```bash
git add "app/(public)/layout.tsx" components/site-header.tsx
git commit -m "feat: session-aware public header with New game and admin login/sign-out"
```

---

### Task 3: Home hero "New game" button + right-sidebar Join CTA card

**Files:**
- Create: `components/join-cta.tsx`
- Modify: `app/(public)/page.tsx` (hero button + CTA card in right column)

**Context:** The home page right column is a `space-y-8` stack (`InFormCard`, `RecentMatches`) inside a `md:grid-cols-[1fr_320px]` grid. Add the CTA card at the TOP of that stack. Add a "New game" button into the hero next to "Join the ladder".

- [ ] **Step 1: Create `components/join-cta.tsx`**

```tsx
import Link from 'next/link'

export function JoinCta() {
  return (
    <section className="rounded-xl border border-border bg-gradient-to-br from-secondary to-card p-5">
      <p className="font-display uppercase tracking-[0.2em] text-[10px] text-primary mb-1">
        New here?
      </p>
      <h2 className="font-display text-lg font-bold tracking-tight leading-tight">
        Want in on the fun?
      </h2>
      <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
        Create your profile and start climbing the Drive ladder.
      </p>
      <Link
        href="/join"
        className="mt-3 inline-flex items-center rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-colors duration-150 hover:bg-[#10489e]"
      >
        Create a profile
      </Link>
    </section>
  )
}
```

- [ ] **Step 2: Wire into `app/(public)/page.tsx`**

Add the import near the other component imports:

```tsx
import { JoinCta } from '@/components/join-cta'
```

In the hero, replace the single `<Link href="/join" ...>Join the ladder</Link>` with a button row that adds "New game":

```tsx
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link
                href="/join"
                className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors duration-150 hover:bg-[#10489e]"
              >
                Join the ladder
              </Link>
              <Link
                href="/admin/matches/new"
                className="inline-flex items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-secondary"
              >
                New game
              </Link>
            </div>
```

In the right column stack, add `<JoinCta />` as the FIRST child (before `<InFormCard />`):

```tsx
        {/* Right — secondary widgets */}
        <div className="space-y-8">
          <JoinCta />
          <InFormCard />
          <RecentMatches />
        </div>
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npx eslint "app/(public)/page.tsx" components/join-cta.tsx`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "app/(public)/page.tsx" components/join-cta.tsx
git commit -m "feat: home hero New game button + create-a-profile CTA card"
```

---

### Task 4: Final verification

- [ ] **Step 1: Full gate**

Run: `npm run test && npx tsc --noEmit && npm run build`
Expected: tests pass, no type errors, production build succeeds.

- [ ] **Step 2: Manual behaviour checklist (note for human verification with preview fixtures, not live Supabase):**
- Logged out: header shows New game + Admin Log In; New game → login → after correct password, lands on `/admin/matches/new`.
- Logged in: header shows New game + Admin + Sign out; Sign out returns to `/`.
- Home: hero has Join the ladder + New game; right sidebar shows the Create-a-profile card.

## Out of scope
- Per-player (non-admin) login — there is only the single admin identity.
- Persisting `next` query strings beyond the pathname (only the path is preserved).

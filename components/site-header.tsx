'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import * as Dialog from '@radix-ui/react-dialog'
import clsx from 'clsx'
import { ChevronDown, CircleUser, Menu, Plus, X } from 'lucide-react'
import { logout } from '@/app/actions/auth'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  LogoMark,
  isActive,
  navLinkClass,
  mobileNavLinkClass,
} from '@/components/site-nav-shared'

const STATS_NAV = [
  { href: '/players', label: 'Players' },
  { href: '/matches', label: 'Matches' },
  { href: '/matrix', label: 'Mogboard' },
  { href: '/tournaments', label: 'Tournaments' },
]
const TOOLS_NAV = [
  { href: '/calculator', label: 'Calculator' },
  { href: '/seeder', label: 'Seeder' },
]

export function SiteHeader({ isLoggedIn }: { isLoggedIn: boolean }) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPathname, setMenuPathname] = useState(pathname)
  const toolsActive = TOOLS_NAV.some((item) => isActive(pathname, item.href))

  // Close the mobile menu when navigation changes the route — adjust during render, not in an effect.
  if (pathname !== menuPathname) {
    setMenuPathname(pathname)
    setMenuOpen(false)
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/75">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-2 px-4 md:px-6">
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

        <nav className="hidden items-center gap-1 text-sm xl:flex">
          {STATS_NAV.map((item) => {
            const active = isActive(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={navLinkClass(active)}
              >
                {item.label}
              </Link>
            )
          })}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-current={toolsActive ? 'page' : undefined}
                className={clsx(navLinkClass(toolsActive), 'inline-flex items-center gap-1')}
              >
                Tools
                <ChevronDown className="h-3.5 w-3.5 opacity-70" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40">
              {TOOLS_NAV.map((item) => {
                const active = isActive(pathname, item.href)
                return (
                  <DropdownMenuItem key={item.href} asChild>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={clsx(active && 'text-primary font-medium')}
                    >
                      {item.label}
                    </Link>
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-border" />

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Account menu"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
                >
                  <CircleUser className="h-5 w-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                {isLoggedIn ? (
                  <>
                    <DropdownMenuItem asChild>
                      <Link href="/admin">Admin</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <form action={logout}>
                      <DropdownMenuItem asChild>
                        <button type="submit" className="w-full text-left">
                          Sign out
                        </button>
                      </DropdownMenuItem>
                    </form>
                  </>
                ) : (
                  <DropdownMenuItem asChild>
                    <Link href="/admin/login">Admin Log In</Link>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <Link
              href="/join"
              className="rounded-md bg-primary px-3.5 py-1.5 font-medium text-primary-foreground transition-colors duration-150 hover:bg-[#10489e]"
            >
              Join
            </Link>
          </div>
        </nav>

        <div className="flex items-center gap-1.5 xl:hidden">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- intentional plain anchor: in-page #log scroll, avoids client-route round-trip */}
          <a
            href="/#log"
            className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1.5 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-secondary"
          >
            <Plus className="h-3.5 w-3.5" />
            Log a game
          </a>

          <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
            <Dialog.Trigger asChild>
              <button
                type="button"
                aria-label="Open menu"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
              >
                <Menu className="h-5 w-5" />
              </button>
            </Dialog.Trigger>

            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 xl:hidden" />
              <Dialog.Content
                aria-describedby={undefined}
                className="fixed inset-0 z-50 flex flex-col bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 xl:hidden"
              >
                <Dialog.Title className="sr-only">Menu</Dialog.Title>

                <div className="flex h-14 items-center justify-between border-b border-border px-4">
                  <Link
                    href="/"
                    className="flex items-center gap-2.5"
                    onClick={() => setMenuOpen(false)}
                  >
                    <LogoMark />
                    <span className="font-display text-base font-semibold tracking-tight">
                      Table Tennis
                    </span>
                  </Link>
                  <Dialog.Close
                    aria-label="Close menu"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-5 w-5" />
                  </Dialog.Close>
                </div>

                <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-4 text-base">
                  {STATS_NAV.map((item) => {
                    const active = isActive(pathname, item.href)
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        onClick={() => setMenuOpen(false)}
                        className={mobileNavLinkClass(active)}
                      >
                        {item.label}
                      </Link>
                    )
                  })}

                  <p className="px-4 pb-1 pt-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Tools
                  </p>
                  {TOOLS_NAV.map((item) => {
                    const active = isActive(pathname, item.href)
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        onClick={() => setMenuOpen(false)}
                        className={mobileNavLinkClass(active)}
                      >
                        {item.label}
                      </Link>
                    )
                  })}

                  {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- intentional plain anchor: in-page #log scroll, avoids client-route round-trip */}
                  <a
                    href="/#log"
                    onClick={() => setMenuOpen(false)}
                    className={clsx(mobileNavLinkClass(false), 'mt-1 flex items-center gap-2')}
                  >
                    <Plus className="h-4 w-4" />
                    Log a game
                  </a>

                  {isLoggedIn ? (
                    <>
                      <Link
                        href="/admin"
                        onClick={() => setMenuOpen(false)}
                        className={mobileNavLinkClass(false)}
                      >
                        Admin
                      </Link>
                      <form action={logout} className="contents">
                        <button
                          type="submit"
                          className={clsx(mobileNavLinkClass(false), 'text-left')}
                        >
                          Sign out
                        </button>
                      </form>
                    </>
                  ) : (
                    <Link
                      href="/admin/login"
                      onClick={() => setMenuOpen(false)}
                      className={mobileNavLinkClass(false)}
                    >
                      Admin Log In
                    </Link>
                  )}
                </nav>

                <div className="border-t border-border p-4">
                  <Link
                    href="/join"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center justify-center rounded-lg bg-primary px-4 py-3 text-base font-medium text-primary-foreground transition-colors duration-150 hover:bg-[#10489e]"
                  >
                    Join
                  </Link>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      </div>
    </header>
  )
}

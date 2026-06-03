'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import * as Dialog from '@radix-ui/react-dialog'
import clsx from 'clsx'
import { Menu, Plus, X } from 'lucide-react'
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

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href)
}

export function SiteHeader({ isLoggedIn }: { isLoggedIn: boolean }) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

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

        <nav className="hidden items-center gap-0.5 text-sm lg:flex lg:gap-1">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  'rounded-md px-2.5 py-1.5 transition-colors duration-150 lg:px-3',
                  active
                    ? 'text-primary font-medium bg-secondary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                )}
              >
                {item.label}
              </Link>
            )
          })}

          {/* Log a game — visible to everyone; scrolls to the inline logger */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- intentional plain anchor: in-page #log scroll, avoids client-route round-trip */}
          <a
            href="/#log"
            className="ml-1 inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1.5 font-medium text-foreground transition-colors duration-150 hover:bg-secondary lg:px-3"
          >
            <Plus className="h-3.5 w-3.5" />
            Log a game
          </a>

          {/* Admin auth controls */}
          {isLoggedIn ? (
            <>
              <Link
                href="/admin"
                className="rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors duration-150 hover:text-foreground hover:bg-muted lg:px-3"
              >
                Admin
              </Link>
              <form action={logout}>
                <button
                  type="submit"
                  className="rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors duration-150 hover:text-foreground hover:bg-muted lg:px-3"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/admin/login"
              className="rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors duration-150 hover:text-foreground hover:bg-muted lg:px-3"
            >
              Admin Log In
            </Link>
          )}

          <Link
            href="/join"
            className="ml-1 rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground transition-colors duration-150 hover:bg-[#10489e] lg:ml-2 lg:px-3.5"
          >
            Join
          </Link>
        </nav>

        <div className="flex items-center gap-1.5 lg:hidden">
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
              <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 lg:hidden" />
              <Dialog.Content
                aria-describedby={undefined}
                className="fixed inset-0 z-50 flex flex-col bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 lg:hidden"
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
                  {NAV.map((item) => {
                    const active = isActive(pathname, item.href)
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        onClick={() => setMenuOpen(false)}
                        className={clsx(
                          'rounded-lg px-4 py-3 font-medium transition-colors duration-150',
                          active
                            ? 'bg-secondary text-primary'
                            : 'text-foreground hover:bg-muted',
                        )}
                      >
                        {item.label}
                      </Link>
                    )
                  })}

                  {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- intentional plain anchor: in-page #log scroll, avoids client-route round-trip */}
                  <a
                    href="/#log"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-4 py-3 font-medium text-foreground transition-colors duration-150 hover:bg-muted"
                  >
                    <Plus className="h-4 w-4" />
                    Log a game
                  </a>

                  {isLoggedIn ? (
                    <>
                      <Link
                        href="/admin"
                        onClick={() => setMenuOpen(false)}
                        className="rounded-lg px-4 py-3 font-medium text-foreground transition-colors duration-150 hover:bg-muted"
                      >
                        Admin
                      </Link>
                      <form action={logout} className="contents">
                        <button
                          type="submit"
                          className="rounded-lg px-4 py-3 text-left font-medium text-foreground transition-colors duration-150 hover:bg-muted"
                        >
                          Sign out
                        </button>
                      </form>
                    </>
                  ) : (
                    <Link
                      href="/admin/login"
                      onClick={() => setMenuOpen(false)}
                      className="rounded-lg px-4 py-3 font-medium text-foreground transition-colors duration-150 hover:bg-muted"
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

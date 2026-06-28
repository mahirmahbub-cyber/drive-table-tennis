'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import * as Dialog from '@radix-ui/react-dialog'
import { CircleUser, Menu, X } from 'lucide-react'
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

// `match` is the section root used for active highlighting — it can be broader
// than `href` so a link stays active across its sub-pages (e.g. tournament detail).
const ADMIN_NAV = [
  { href: '/admin/players', label: 'Players', match: '/admin/players' },
  { href: '/admin/tournaments/new', label: 'Tournament', match: '/admin/tournaments' },
  { href: '/admin/history', label: 'History', match: '/admin/history' },
]

const ADMIN_PILL =
  'rounded-md border border-panel-line px-1.5 py-0.5 font-display text-[10px] font-semibold uppercase tracking-widest text-panel-muted'

export function AdminNav() {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPathname, setMenuPathname] = useState(pathname)

  // Close the mobile menu when navigation changes the route — adjust during render, not in an effect.
  if (pathname !== menuPathname) {
    setMenuPathname(pathname)
    setMenuOpen(false)
  }

  return (
    <header className="sticky top-0 z-30 border-b border-black bg-panel text-panel-foreground">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-2 px-4 md:px-6">
        <div className="flex items-center gap-2">
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
          <span className={ADMIN_PILL}>Admin</span>
        </div>

        <nav className="hidden items-center gap-1 text-sm xl:flex">
          {ADMIN_NAV.map((item) => {
            const active = isActive(pathname, item.match)
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

          <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-panel-line" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Account menu"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-panel-muted transition-colors duration-150 hover:bg-panel-raised hover:text-panel-foreground"
              >
                <CircleUser className="h-5 w-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem asChild>
                <Link href="/">View site</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <form action={logout}>
                <DropdownMenuItem asChild>
                  <button type="submit" className="w-full text-left">
                    Sign out
                  </button>
                </DropdownMenuItem>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        <div className="flex items-center xl:hidden">
          <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
            <Dialog.Trigger asChild>
              <button
                type="button"
                aria-label="Open menu"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-panel-muted transition-colors duration-150 hover:bg-panel-raised hover:text-panel-foreground"
              >
                <Menu className="h-5 w-5" />
              </button>
            </Dialog.Trigger>

            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 xl:hidden" />
              <Dialog.Content
                aria-describedby={undefined}
                className="fixed inset-0 z-50 flex flex-col bg-panel text-panel-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 xl:hidden"
              >
                <Dialog.Title className="sr-only">Admin menu</Dialog.Title>

                <div className="flex h-14 items-center justify-between border-b border-black px-4">
                  <Link
                    href="/"
                    className="flex items-center gap-2.5"
                    onClick={() => setMenuOpen(false)}
                  >
                    <LogoMark />
                    <span className="font-display text-base font-semibold tracking-tight">
                      Table Tennis
                    </span>
                    <span className={ADMIN_PILL}>Admin</span>
                  </Link>
                  <Dialog.Close
                    aria-label="Close menu"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md text-panel-muted transition-colors duration-150 hover:bg-panel-raised hover:text-panel-foreground"
                  >
                    <X className="h-5 w-5" />
                  </Dialog.Close>
                </div>

                <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-4 text-base">
                  {ADMIN_NAV.map((item) => {
                    const active = isActive(pathname, item.match)
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

                  <Link
                    href="/"
                    onClick={() => setMenuOpen(false)}
                    className={mobileNavLinkClass(false)}
                  >
                    View site
                  </Link>
                  <form action={logout} className="contents">
                    <button
                      type="submit"
                      className={`${mobileNavLinkClass(false)} text-left`}
                    >
                      Sign out
                    </button>
                  </form>
                </nav>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      </div>
    </header>
  )
}

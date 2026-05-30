'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'

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

export function SiteHeader() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/75">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 md:px-6">
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

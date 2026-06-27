import clsx from 'clsx'

export function LogoMark() {
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

export function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href)
}

export function navLinkClass(active: boolean) {
  return clsx(
    'rounded-md px-2.5 py-1.5 transition-colors duration-150 xl:px-3',
    active
      ? 'text-primary font-medium bg-secondary'
      : 'text-muted-foreground hover:text-foreground hover:bg-muted',
  )
}

export function mobileNavLinkClass(active: boolean) {
  return clsx(
    'rounded-lg px-4 py-3 font-medium transition-colors duration-150',
    active ? 'bg-secondary text-primary' : 'text-foreground hover:bg-muted',
  )
}

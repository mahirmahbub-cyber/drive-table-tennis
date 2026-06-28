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
      <rect x={2} y={2} width={28} height={28} rx={6} className="fill-ink" />
      {/* paddle blade */}
      <rect x={9} y={7} width={11} height={13} rx={2} fill="#ffffff" />
      <rect x={12} y={19} width={4} height={7} rx={1} className="fill-brass-deep" />
      {/* ball */}
      <rect x={21} y={9} width={5} height={5} rx={1} className="fill-brass" />
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
      ? 'text-brass font-medium bg-panel-raised'
      : 'text-panel-muted hover:text-brass hover:bg-panel-raised',
  )
}

export function mobileNavLinkClass(active: boolean) {
  return clsx(
    'rounded-lg px-4 py-3 font-medium transition-colors duration-150',
    active ? 'bg-panel-raised text-brass' : 'text-panel-muted hover:text-brass hover:bg-panel-raised',
  )
}

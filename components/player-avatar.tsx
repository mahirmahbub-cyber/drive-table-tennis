import Image from 'next/image'

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

export function PlayerAvatar({
  name,
  photoUrl,
  size = 40,
}: {
  name: string
  photoUrl: string | null
  size?: number
}) {
  if (photoUrl) {
    return (
      <Image
        src={photoUrl}
        alt={name}
        width={size}
        height={size}
        className="rounded-full object-cover ring-1 ring-border shrink-0"
        style={{ width: size, height: size }}
      />
    )
  }

  // Monogram fallback — dark bg, gain-coloured text for visual pop
  return (
    <div
      className="flex items-center justify-center rounded-full bg-secondary ring-1 ring-border font-display font-semibold text-gain shrink-0 select-none"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.38),
        letterSpacing: '-0.02em',
      }}
      aria-label={name}
    >
      {initials(name)}
    </div>
  )
}

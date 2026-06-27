/** The office/venue timezone. Game times are interpreted and displayed here. */
export const VENUE_TZ = 'Australia/Sydney'

/** Milliseconds that `tz` is ahead of UTC at the given instant (DST-aware). */
export function tzOffsetMs(instant: Date, tz: string = VENUE_TZ): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const map: Record<string, string> = {}
  for (const p of dtf.formatToParts(instant)) map[p.type] = p.value
  const asUTC = Date.UTC(
    Number(map.year), Number(map.month) - 1, Number(map.day),
    Number(map.hour), Number(map.minute), Number(map.second),
  )
  return asUTC - instant.getTime()
}

/**
 * Interpret a zone-less wall-clock string ("yyyy-MM-ddTHH:mm" or with seconds)
 * as local time in `tz`, returning the corresponding UTC instant. DST-aware.
 */
export function wallClockToInstant(wallClock: string, tz: string = VENUE_TZ): Date {
  const utcGuess = new Date(`${wallClock}Z`).getTime()
  const offset = tzOffsetMs(new Date(utcGuess), tz)
  let instant = utcGuess - offset
  const offset2 = tzOffsetMs(new Date(instant), tz)
  if (offset2 !== offset) instant = utcGuess - offset2 // DST-edge correction
  return new Date(instant)
}

/** UTC instant → "yyyy-MM-ddTHH:mm" wall-clock in `tz`, for <input type="datetime-local">. */
export function instantToWallClock(instant: Date, tz: string = VENUE_TZ): string {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
  const map: Record<string, string> = {}
  for (const p of dtf.formatToParts(instant)) map[p.type] = p.value
  // Some runtimes emit '24' for midnight under hourCycle 'h23'; normalise to '00'.
  // No date change needed — '24' already pairs with the day midnight begins.
  const hour = map.hour === '24' ? '00' : map.hour
  return `${map.year}-${map.month}-${map.day}T${hour}:${map.minute}`
}

/** True if the string carries an explicit timezone (trailing Z or ±HH:mm / ±HHmm). */
export function hasExplicitZone(s: string): boolean {
  return /(?:Z|[+-]\d{2}:?\d{2})$/.test(s.trim())
}

/** Format a UTC instant in the venue zone with a fixed (en-AU) locale. */
export function formatInZone(
  instant: Date,
  opts: Intl.DateTimeFormatOptions,
  tz: string = VENUE_TZ,
): string {
  return new Intl.DateTimeFormat('en-AU', { ...opts, timeZone: tz }).format(instant)
}

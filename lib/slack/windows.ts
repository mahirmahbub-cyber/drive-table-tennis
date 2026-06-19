export const SYDNEY_TZ = 'Australia/Sydney'

export type Range = { start: Date; end: Date }
type YMD = { year: number; month: number; day: number }

/** Offset in ms that `tz` is ahead of UTC at the given instant. */
function tzOffsetMs(instant: Date, tz: string): number {
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

/** Local calendar date (Y/M/D) in `tz` at the given instant. */
function ymdInTz(instant: Date, tz: string): YMD {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  })
  const map: Record<string, string> = {}
  for (const p of dtf.formatToParts(instant)) map[p.type] = p.value
  return { year: Number(map.year), month: Number(map.month), day: Number(map.day) }
}

/** UTC instant of local midnight (00:00) on the given calendar date in `tz`. */
function zonedMidnightUtc({ year, month, day }: YMD, tz: string): Date {
  const utcGuess = Date.UTC(year, month - 1, day, 0, 0, 0)
  const offset = tzOffsetMs(new Date(utcGuess), tz)
  let instant = utcGuess - offset
  const offset2 = tzOffsetMs(new Date(instant), tz)
  if (offset2 !== offset) instant = utcGuess - offset2 // DST-edge correction
  return new Date(instant)
}

/** Shift a calendar date by `days`, staying calendar-correct across month/year. */
function addDays(ymd: YMD, days: number): YMD {
  const d = new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day + days))
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }
}

/** Day of week for a calendar date: 0=Sun … 6=Sat. */
function weekday(ymd: YMD): number {
  return new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day)).getUTCDay()
}

/** Yesterday 00:00 → today 00:00, Sydney time, as UTC instants. */
export function yesterdayRange(now: Date, tz: string = SYDNEY_TZ): Range {
  const today = ymdInTz(now, tz)
  return {
    start: zonedMidnightUtc(addDays(today, -1), tz),
    end: zonedMidnightUtc(today, tz),
  }
}

/** Previous Mon 00:00 → this Mon 00:00 (last full week), Sydney time, as UTC instants. */
export function lastWeekRange(now: Date, tz: string = SYDNEY_TZ): Range {
  const today = ymdInTz(now, tz)
  const daysSinceMonday = (weekday(today) + 6) % 7
  const thisMonday = addDays(today, -daysSinceMonday)
  return {
    start: zonedMidnightUtc(addDays(thisMonday, -7), tz),
    end: zonedMidnightUtc(thisMonday, tz),
  }
}

/** "Thu 18 Jun" in Sydney time. */
export function formatSydneyDay(instant: Date, tz: string = SYDNEY_TZ): string {
  const opts = { timeZone: tz } as const
  const weekday = new Intl.DateTimeFormat('en-AU', { ...opts, weekday: 'short' }).format(instant)
  const day = new Intl.DateTimeFormat('en-AU', { ...opts, day: 'numeric' }).format(instant)
  const month = new Intl.DateTimeFormat('en-AU', { ...opts, month: 'short' }).format(instant)
  return `${weekday} ${day} ${month}`
}

/** "8–14 Jun" (or "29 Jun–5 Jul"); `end` is exclusive. */
export function formatSydneyWeekRange(start: Date, end: Date, tz: string = SYDNEY_TZ): string {
  const lastDay = new Date(end.getTime() - 1)
  const d = (i: Date) => new Intl.DateTimeFormat('en-AU', { timeZone: tz, day: 'numeric' }).format(i)
  const mon = (i: Date) => new Intl.DateTimeFormat('en-AU', { timeZone: tz, month: 'short' }).format(i)
  return mon(start) === mon(lastDay)
    ? `${d(start)}–${d(lastDay)} ${mon(lastDay)}`
    : `${d(start)} ${mon(start)}–${d(lastDay)} ${mon(lastDay)}`
}

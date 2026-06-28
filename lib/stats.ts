export type ScoredMatch = {
  playerId: string
  opponentId: string
  myEloBefore: number
  myEloAfter: number
  opponentEloBefore: number
  iWon: boolean
  playedAt: Date
}

export type OpponentTier = 'higher' | 'similar' | 'lower'

export function classifyOpponentTier(
  myElo: number,
  opponentElo: number
): OpponentTier {
  const gap = opponentElo - myElo
  if (gap > 100) return 'higher'
  if (gap < -100) return 'lower'
  return 'similar'
}

function withinWindow(matches: ScoredMatch[], windowDays: number): ScoredMatch[] {
  const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000
  return matches
    .filter((m) => m.playedAt.getTime() >= cutoff)
    .sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime())
}

export function computeFormScore(
  matches: ScoredMatch[],
  currentElo: number,
  windowDays: number,
  minMatches: number = 3
): number | null {
  const inWindow = withinWindow(matches, windowDays)
  if (inWindow.length < minMatches) return null
  return currentElo - inWindow[0].myEloBefore
}

export function computeAboveExpectationScore(
  matches: ScoredMatch[],
  windowDays: number
): number {
  const inWindow = withinWindow(matches, windowDays)
  let sum = 0
  for (const m of inWindow) {
    const expected = 1 / (1 + 10 ** ((m.opponentEloBefore - m.myEloBefore) / 400))
    const actual = m.iWon ? 1 : 0
    sum += actual - expected
  }
  return sum
}

export type DurationMatch = {
  id: string
  playerAId: string
  playerBId: string
  winnerId: string
  durationSeconds: number
  playedAt: Date
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Coarse duration as "3h 20min" (or "44min" under an hour, "3h" on the hour). */
export function formatHoursMinutes(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}min`
}

/** Accepts "mm:ss" or a plain seconds string. Returns total seconds, or null if invalid/empty. */
export function parseDurationInput(input: string): number | null {
  const trimmed = input.trim()
  if (trimmed === '') return null
  if (trimmed.includes(':')) {
    const [mm, ss] = trimmed.split(':')
    const min = Number(mm)
    const sec = Number(ss)
    if (!Number.isInteger(min) || !Number.isInteger(sec) || min < 0 || sec < 0 || sec > 59) {
      return null
    }
    return min * 60 + sec
  }
  const n = Number(trimmed)
  return Number.isInteger(n) && n >= 0 ? n : null
}

export function averageDurationForPlayer(
  matches: DurationMatch[],
  playerId: string
): number | null {
  const mine = matches.filter(
    (x) => (x.playerAId === playerId || x.playerBId === playerId) && x.durationSeconds > 0
  )
  if (mine.length === 0) return null
  const sum = mine.reduce((acc, x) => acc + x.durationSeconds, 0)
  return Math.round(sum / mine.length)
}

export type DurationRecords = {
  longestMatch: DurationMatch | null
  fastestWin: DurationMatch | null
  totalCourtTimeSeconds: number
}

export function computeDurationRecords(matches: DurationMatch[]): DurationRecords {
  const timed = matches.filter((x) => x.durationSeconds > 0)
  let longestMatch: DurationMatch | null = null
  let fastestWin: DurationMatch | null = null
  let totalCourtTimeSeconds = 0
  for (const x of timed) {
    totalCourtTimeSeconds += x.durationSeconds
    if (!longestMatch || x.durationSeconds > longestMatch.durationSeconds) longestMatch = x
    if (!fastestWin || x.durationSeconds < fastestWin.durationSeconds) fastestWin = x
  }
  return { longestMatch, fastestWin, totalCourtTimeSeconds }
}

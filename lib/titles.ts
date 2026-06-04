export type TitleTone = 'good' | 'bad' | 'neutral'
export type Title = { key: string; label: string; tone: TitleTone; blurb: string }

export type TitleInput = {
  rank: number
  totalPlayers: number
  games: number
  currentStreak: number
  weeklyDelta: number
  giantKills: number
  currentElo: number
  peakElo: number
}

const WASHED_DROP = 30
const STREAK_MIN = 3
const MOGGER_MIN = 3

/** Titles in priority order (most flattering / notable first). May be empty. */
export function titlesForPlayer(i: TitleInput): Title[] {
  if (i.games < 1) return []
  const out: Title[] = []
  const inThird = (lo: number, hi: number) => i.rank > lo && i.rank <= hi

  if (i.rank === 1) out.push({ key: 'gigachad', label: 'Gigachad', tone: 'good', blurb: 'Top of the grid.' })
  if (i.giantKills >= MOGGER_MIN) out.push({ key: 'mogger', label: 'Mogger', tone: 'good', blurb: 'Beats players above their weight.' })
  if (i.currentStreak >= STREAK_MIN) out.push({ key: 'lockedIn', label: 'Locked In', tone: 'good', blurb: `On a ${i.currentStreak}-win heater.` })
  if (i.weeklyDelta <= -WASHED_DROP) out.push({ key: 'washed', label: 'Washed', tone: 'bad', blurb: 'Sliding down the grid this week.' })
  if (i.currentStreak <= -STREAK_MIN) out.push({ key: 'downBad', label: 'Down Bad', tone: 'bad', blurb: `${Math.abs(i.currentStreak)}-loss skid.` })
  if (i.totalPlayers >= 4 && i.rank === i.totalPlayers) out.push({ key: 'jester', label: 'Jester', tone: 'bad', blurb: 'Propping up the grid.' })
  if (out.length === 0 && inThird(i.totalPlayers / 3, (2 * i.totalPlayers) / 3)) {
    out.push({ key: 'mid', label: 'Mid', tone: 'neutral', blurb: 'Comfortably mid-table.' })
  }
  return out
}

export function topTitle(i: TitleInput): Title | null {
  return titlesForPlayer(i)[0] ?? null
}

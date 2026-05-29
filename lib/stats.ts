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

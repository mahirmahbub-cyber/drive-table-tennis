export const K_FACTOR = 32
export const STARTING_ELO = 1200

export type MatchResult = {
  eloA: number
  eloB: number
  deltaA: number
  deltaB: number
}

export function applyMatch(
  eloA: number,
  eloB: number,
  winner: 'A' | 'B'
): MatchResult {
  const expectedA = 1 / (1 + 10 ** ((eloB - eloA) / 400))
  const expectedB = 1 - expectedA
  const scoreA = winner === 'A' ? 1 : 0
  const scoreB = 1 - scoreA
  const deltaA = Math.round(K_FACTOR * (scoreA - expectedA))
  const deltaB = Math.round(K_FACTOR * (scoreB - expectedB))
  return {
    eloA: eloA + deltaA,
    eloB: eloB + deltaB,
    deltaA,
    deltaB,
  }
}

/**
 * Applies ELO per game, threading the rating through each game in order.
 * Games with an equal score are skipped (no result). Returns the net
 * before→after for the whole sitting.
 */
export function applyGames(
  eloA: number,
  eloB: number,
  games: Array<[number, number]>
): MatchResult {
  let a = eloA
  let b = eloB
  for (const [ga, gb] of games) {
    if (ga === gb) continue
    const r = applyMatch(a, b, ga > gb ? 'A' : 'B')
    a = r.eloA
    b = r.eloB
  }
  return { eloA: a, eloB: b, deltaA: a - eloA, deltaB: b - eloB }
}

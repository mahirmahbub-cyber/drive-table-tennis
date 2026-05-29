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

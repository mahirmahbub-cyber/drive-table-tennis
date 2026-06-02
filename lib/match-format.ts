export type SetScore = [number, number]

/** Winner by sets won. Ties (equal sets, or a single tied set) return null. Mirrors the rule used at save time. */
export function inferWinnerSide(sets: SetScore[]): 'A' | 'B' | null {
  const { a, b } = setsWon(sets)
  if (a === b) return null
  return a > b ? 'A' : 'B'
}

export function setsWon(sets: SetScore[]): { a: number; b: number } {
  let a = 0
  let b = 0
  for (const [sa, sb] of sets) {
    if (sa > sb) a++
    else if (sb > sa) b++
  }
  return { a, b }
}

export function isSingleSet(sets: SetScore[]): boolean {
  return sets.length === 1
}

/** Player-oriented score: single set → the player's points first; multi-set → the player's sets-won first. */
export function formatScoreForPlayer(sets: SetScore[], playerIsA: boolean): string {
  if (isSingleSet(sets)) {
    const [a, b] = sets[0]
    return playerIsA ? `${a}–${b}` : `${b}–${a}`
  }
  const { a, b } = setsWon(sets)
  return playerIsA ? `${a}–${b}` : `${b}–${a}`
}

export type EloPair = {
  eloABefore: number | null
  eloAAfter: number | null
  eloBBefore: number | null
  eloBAfter: number | null
}

/** ELO change for the given side, or null if the stored values are missing. */
export function playerEloDelta(elo: EloPair, playerIsA: boolean): number | null {
  const before = playerIsA ? elo.eloABefore : elo.eloBBefore
  const after = playerIsA ? elo.eloAAfter : elo.eloBAfter
  if (before == null || after == null) return null
  return after - before
}

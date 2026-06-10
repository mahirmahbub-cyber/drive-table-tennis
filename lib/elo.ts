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

export type ProjectionStep = {
  game: number // 1-based index in the played sequence
  winner: 'A' | 'B'
  eloA: number // running rating after this game
  eloB: number
}

export type Projection = {
  eloABefore: number
  eloBBefore: number
  eloAAfter: number
  eloBAfter: number
  deltaA: number
  deltaB: number
  steps: ProjectionStep[]
}

/**
 * Builds an evenly-interleaved win sequence from games-won counts. Each player's
 * wins are spread across the sequence proportionally; ties for a slot go to
 * whoever has placed fewer wins so far, then to A. Deterministic. Assumes
 * non-negative counts.
 */
function buildSequence(gamesWonA: number, gamesWonB: number): Array<'A' | 'B'> {
  const total = gamesWonA + gamesWonB
  const seq: Array<'A' | 'B'> = []
  let usedA = 0
  let usedB = 0
  for (let i = 0; i < total; i++) {
    if (usedA >= gamesWonA) {
      seq.push('B')
      usedB++
      continue
    }
    if (usedB >= gamesWonB) {
      seq.push('A')
      usedA++
      continue
    }
    const placed = i + 1
    const deficitA = (gamesWonA * placed) / total - usedA
    const deficitB = (gamesWonB * placed) / total - usedB
    let pickA: boolean
    if (Math.abs(deficitA - deficitB) > 1e-9) pickA = deficitA > deficitB
    else if (usedA !== usedB) pickA = usedA < usedB
    else pickA = true
    if (pickA) {
      seq.push('A')
      usedA++
    } else {
      seq.push('B')
      usedB++
    }
  }
  return seq
}

/**
 * Projects the Elo change of a hypothetical sitting from games-won counts, with
 * no point scores (margins never affect Elo). Threads each game through
 * applyMatch in the evenly-interleaved order and records the running ratings.
 */
export function projectGamesWon(
  eloA: number,
  eloB: number,
  gamesWonA: number,
  gamesWonB: number
): Projection {
  const sequence = buildSequence(gamesWonA, gamesWonB)
  let a = eloA
  let b = eloB
  const steps: ProjectionStep[] = []
  for (const [i, winner] of sequence.entries()) {
    const r = applyMatch(a, b, winner)
    a = r.eloA
    b = r.eloB
    steps.push({ game: i + 1, winner, eloA: a, eloB: b })
  }
  return {
    eloABefore: eloA,
    eloBBefore: eloB,
    eloAAfter: a,
    eloBAfter: b,
    deltaA: a - eloA,
    deltaB: b - eloB,
    steps,
  }
}

import { applyGames, STARTING_ELO } from './elo'

export type HistoryMatch = {
  id: string
  playerAId: string
  playerBId: string
  games: Array<[number, number]>
}

export type ReplayedMatch = HistoryMatch & {
  eloABefore: number
  eloBBefore: number
  eloAAfter: number
  eloBAfter: number
}

export type ReplayResult = {
  currentElo: Map<string, number>
  replayed: ReplayedMatch[]
}

/**
 * Replays chronologically-ordered matches, applying ELO per game within each
 * match. Returns each match's net before/after ELOs and every player's final
 * rating. `playerIds` is the universe of players to seed at STARTING_ELO.
 */
export function replayHistory(
  history: HistoryMatch[],
  playerIds: string[]
): ReplayResult {
  const currentElo = new Map<string, number>()
  for (const id of playerIds) currentElo.set(id, STARTING_ELO)

  const replayed: ReplayedMatch[] = []
  for (const match of history) {
    const eloABefore = currentElo.get(match.playerAId) ?? STARTING_ELO
    const eloBBefore = currentElo.get(match.playerBId) ?? STARTING_ELO
    const { eloA, eloB } = applyGames(eloABefore, eloBBefore, match.games)
    currentElo.set(match.playerAId, eloA)
    currentElo.set(match.playerBId, eloB)
    replayed.push({ ...match, eloABefore, eloBBefore, eloAAfter: eloA, eloBAfter: eloB })
  }

  return { currentElo, replayed }
}

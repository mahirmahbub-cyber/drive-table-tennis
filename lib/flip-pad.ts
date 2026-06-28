import { setsWon, inferWinnerSide, type SetScore } from '@/lib/match-format'

export type PadScore = number | null
export type LiveGame = [PadScore, PadScore]
export type BankedGame = [number, number]

export const MAX_GAMES = 7
export const DEFAULT_TARGET = 11
export const WIN_BY = 2

/** The current game contributes a completed pair only when both cards are filled and it isn't a tie. */
export function currentAsGame(current: LiveGame): BankedGame | null {
  const [a, b] = current
  if (a === null || b === null) return null
  if (a === b) return null
  return [a, b]
}

/** All games for derivation/submit: banked plus the current game when complete. */
export function allGames(banked: BankedGame[], current: LiveGame): BankedGame[] {
  const c = currentAsGame(current)
  return c ? [...banked, c] : [...banked]
}

/** Games-won tally over banked + current. */
export function tally(banked: BankedGame[], current: LiveGame): { a: number; b: number } {
  return setsWon(allGames(banked, current) as SetScore[])
}

/** Match winner side over banked + current, or null when tied/empty. */
export function matchWinner(banked: BankedGame[], current: LiveGame): 'A' | 'B' | null {
  return inferWinnerSide(allGames(banked, current) as SetScore[])
}

/** Has a single game been won under the target (reach target, lead >= winBy)? */
export function gameWonBy(game: BankedGame, target = DEFAULT_TARGET, winBy = WIN_BY): 'A' | 'B' | null {
  const [a, b] = game
  if (a >= target && a - b >= winBy) return 'A'
  if (b >= target && b - a >= winBy) return 'B'
  return null
}

/** Is a side one point from winning the current game under the target? */
export function gamePoint(current: LiveGame, target = DEFAULT_TARGET, winBy = WIN_BY): { a: boolean; b: boolean } {
  const a = current[0] ?? 0
  const b = current[1] ?? 0
  const onePointWins = (x: number, y: number) => x + 1 >= target && (x + 1) - y >= winBy
  return { a: onePointWins(a, b), b: onePointWins(b, a) }
}

/** Bankable when both cards are filled and it isn't a tie. */
export function canBank(current: LiveGame): boolean {
  return currentAsGame(current) !== null
}

/** Another game can be started only while we stay within MAX_GAMES total (banked + the new current). */
export function canAddGame(banked: BankedGame[]): boolean {
  return banked.length < MAX_GAMES - 1
}

/** Split a saved match for editing: the last game is live on the pad, the rest are banked. */
export function splitForEdit(sets: BankedGame[]): { banked: BankedGame[]; current: LiveGame } {
  if (sets.length <= 1) {
    return { banked: [], current: (sets[0] ?? [null, null]) as LiveGame }
  }
  return { banked: sets.slice(0, -1), current: sets[sets.length - 1] as LiveGame }
}

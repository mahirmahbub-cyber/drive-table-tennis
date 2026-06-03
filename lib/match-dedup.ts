export const DEDUP_WINDOW_MS = 10_000

type ExistingMatch = {
  playerAId: string | null
  playerBId: string | null
  setScores: Array<[number, number]> | null
  createdAtMs: number
}
type IncomingMatch = {
  playerAId: string
  playerBId: string
  sets: Array<[number, number]>
}

function sameScores(a: Array<[number, number]>, b: Array<[number, number]>): boolean {
  if (a.length !== b.length) return false
  return a.every(([x, y], i) => b[i][0] === x && b[i][1] === y)
}

/**
 * True when `existing` is the same sitting as `incoming` (same two players and
 * identical game scores, accounting for A/B orientation) created within the
 * dedup window before `nowMs`.
 */
export function isDuplicateMatch(
  existing: ExistingMatch,
  incoming: IncomingMatch,
  nowMs: number,
  windowMs: number = DEDUP_WINDOW_MS
): boolean {
  if (nowMs - existing.createdAtMs > windowMs) return false
  const scores = existing.setScores ?? []
  if (existing.playerAId === incoming.playerAId && existing.playerBId === incoming.playerBId) {
    return sameScores(scores, incoming.sets)
  }
  if (existing.playerAId === incoming.playerBId && existing.playerBId === incoming.playerAId) {
    return sameScores(scores, incoming.sets.map(([x, y]) => [y, x]))
  }
  return false
}

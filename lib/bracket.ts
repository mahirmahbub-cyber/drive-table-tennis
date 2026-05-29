export type BracketSlot = {
  round: number
  slot: number
  playerAId: string | null
  playerBId: string | null
  winnerId: string | null // pre-set for BYE matches
}

/**
 * Returns the round-1 pairings (1-indexed seed numbers) for a bracket of `size`,
 * where `size` is a power of 2. Pairings preserve the invariant that seeds 1
 * and 2 only meet in the final.
 *
 *   size=2  -> [[1,2]]
 *   size=4  -> [[1,4],[2,3]]
 *   size=8  -> [[1,8],[4,5],[2,7],[3,6]]
 */
function seedPairings(size: number): Array<[number, number]> {
  let pairs: Array<[number, number]> = [[1, 2]]
  let current = 2
  while (current < size) {
    const next = current * 2
    const newPairs: Array<[number, number]> = []
    for (const [a, b] of pairs) {
      newPairs.push([a, next + 1 - a])
      newPairs.push([next + 1 - b, b])
    }
    pairs = newPairs
    current = next
  }
  return pairs
}

function nextPow2(n: number): number {
  let p = 1
  while (p < n) p *= 2
  return p
}

export function generateBracket(seededPlayerIds: string[]): BracketSlot[] {
  const n = seededPlayerIds.length
  if (n < 2) throw new Error('Need at least 2 players for a bracket')
  const size = nextPow2(n)
  const pairings = seedPairings(size)
  const totalRounds = Math.log2(size)

  const slots: BracketSlot[] = []

  // Round 1: seed-based pairings. Seeds beyond `n` are BYEs.
  pairings.forEach(([seedA, seedB], i) => {
    const playerAId = seedA <= n ? seededPlayerIds[seedA - 1] : null
    const playerBId = seedB <= n ? seededPlayerIds[seedB - 1] : null
    // BYE: exactly one side missing → the present side auto-advances.
    let winnerId: string | null = null
    if (playerAId && !playerBId) winnerId = playerAId
    if (playerBId && !playerAId) winnerId = playerBId
    slots.push({
      round: 1,
      slot: i,
      playerAId,
      playerBId,
      winnerId,
    })
  })

  // Subsequent rounds: empty slots that get filled in as winners advance.
  for (let round = 2; round <= totalRounds; round++) {
    const slotsInRound = size / 2 ** round
    for (let s = 0; s < slotsInRound; s++) {
      slots.push({
        round,
        slot: s,
        playerAId: null,
        playerBId: null,
        winnerId: null,
      })
    }
  }

  return slots
}

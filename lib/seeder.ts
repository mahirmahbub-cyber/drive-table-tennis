export type Target = 7 | 11 | 21

/** Fixed estimate of minutes per single game, by target points. Tunable. */
export const GAME_MINUTES: Record<Target, number> = { 7: 3, 11: 5, 21: 12 }

/** ELO distance scale for opponent weighting (points per "unit" of closeness). */
export const ELO_SCALE = 100

export type PlayerRef = { id: string; name: string; elo: number }

export type MatchupStatus = 'pending' | 'playing' | 'done'

export type Matchup = {
  id: string
  aId: string
  bId: string
  status: MatchupStatus
  startedAt?: number
  durationSeconds?: number
  score?: [number, number]
}

export type SeederConfig = {
  target: Target
  minutes: number
  mix: number // 0..1 — probability of a deliberate high-v-low "upset" pairing
  seed: number
}

/** Small, fast, seedable PRNG. Returns a function yielding floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * How many games to schedule: the larger of the time-budget count and the
 * everyone-plays-once minimum (one table → ceil(N/2) games seats everyone).
 */
export function computeGameCount(
  playerCount: number,
  opts: { target: Target; minutes: number }
): number {
  if (playerCount < 2) return 0
  const perGame = GAME_MINUTES[opts.target]
  const budget = Math.floor(opts.minutes / perGame)
  const min = Math.ceil(playerCount / 2)
  return Math.max(budget, min)
}

/**
 * Weight each candidate by ELO relation to the picked player.
 * Competitive (upset=false): closer ELO → higher weight.
 * Upset (upset=true): farther ELO → higher weight.
 */
export function opponentWeights(
  pickedElo: number,
  candidates: PlayerRef[],
  upset: boolean
): number[] {
  return candidates.map((c) => {
    const dist = Math.abs(c.elo - pickedElo) / ELO_SCALE
    return upset ? 1 + dist : 1 / (1 + dist)
  })
}

/** Weighted-random opponent choice driven by the supplied PRNG. */
export function pickOpponent(args: {
  pickedElo: number
  candidates: PlayerRef[]
  upset: boolean
  rng: () => number
}): PlayerRef {
  const { pickedElo, candidates, upset, rng } = args
  const weights = opponentWeights(pickedElo, candidates, upset)
  const total = weights.reduce((s, w) => s + w, 0)
  let roll = rng() * total
  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i]
    if (roll < 0) return candidates[i]
  }
  return candidates[candidates.length - 1]
}

function inMatchup(m: Matchup | null, id: string): boolean {
  return !!m && (m.aId === id || m.bId === id)
}

/**
 * Emit exactly `count` new pending matchups for a single-table session.
 *
 * Fairness/order rules (no rounds, no byes — incl. odd rosters):
 *  - The "picked" side is always a player with the fewest games so far, never
 *    in the immediately previous matchup when avoidable.
 *  - The opponent is drawn from the fewest-games eligible tier (coverage), then
 *    ELO-weighted within it (close by default; far on an `mix`-probability upset).
 *  - PRNG-seeded → fully deterministic for a given (players, config, history).
 */
export function buildMatchups(input: {
  players: PlayerRef[]
  config: SeederConfig
  history?: Matchup[]
  count: number
}): Matchup[] {
  const { players, config } = input
  const history = input.history ?? []
  if (players.length < 2 || input.count <= 0) return []

  const rng = mulberry32(config.seed)
  const games = new Map(players.map((p) => [p.id, 0]))
  for (const m of history) {
    if (games.has(m.aId)) games.set(m.aId, (games.get(m.aId) ?? 0) + 1)
    if (games.has(m.bId)) games.set(m.bId, (games.get(m.bId) ?? 0) + 1)
  }
  let last: Matchup | null = history.length ? history[history.length - 1] : null

  const out: Matchup[] = []
  for (let i = 0; i < input.count; i++) {
    // 1. Picked = fewest games; prefer those not in the previous matchup.
    const minGames = Math.min(...players.map((p) => games.get(p.id) ?? 0))
    const minPool = players.filter((p) => (games.get(p.id) ?? 0) === minGames)
    const freshPool = minPool.filter((p) => !inMatchup(last, p.id))
    const pickPool = freshPool.length ? freshPool : minPool
    const picked = pickPool[Math.floor(rng() * pickPool.length)]

    // 2. Coverage: fewest-games tier across all non-picked players.
    const allOpp = players.filter((p) => p.id !== picked.id)
    const minElig = Math.min(...allOpp.map((p) => games.get(p.id) ?? 0))
    const tier = allOpp.filter((p) => (games.get(p.id) ?? 0) === minElig)

    // 3. Within tier, prefer those not in previous matchup (relax if none available).
    const freshTier = tier.filter((p) => !inMatchup(last, p.id))
    const oppPool = freshTier.length ? freshTier : tier

    const upset = rng() < config.mix
    const opp = pickOpponent({ pickedElo: picked.elo, candidates: oppPool, upset, rng })

    const m: Matchup = {
      id: `${config.seed.toString(36)}-${history.length + i}`,
      aId: picked.id,
      bId: opp.id,
      status: 'pending',
    }
    out.push(m)
    games.set(picked.id, (games.get(picked.id) ?? 0) + 1)
    games.set(opp.id, (games.get(opp.id) ?? 0) + 1)
    last = m
  }
  return out
}

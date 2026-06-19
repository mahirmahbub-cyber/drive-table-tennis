import {
  buildMatchups,
  computeGameCount,
  type Matchup,
  type PlayerRef,
  type SeederConfig,
  type Target,
} from './seeder'

export type SessionState = {
  config: SeederConfig
  roster: PlayerRef[]
  queue: Matchup[]
}

/** Defaults applied to every new session (seed is injected at creation time). */
export const DEFAULT_CONFIG: Omit<SeederConfig, 'seed'> = {
  target: 11 as Target,
  minutes: 30,
  mix: 0.2,
}

/**
 * Create a fresh session with an empty roster and queue.
 * The given seed is baked into the config; all other fields take DEFAULT_CONFIG values.
 */
export function createSession(seed: number): SessionState {
  return { config: { ...DEFAULT_CONFIG, seed }, roster: [], queue: [] }
}

/**
 * Merge a partial config into the session.
 * The seed is never overwritten by callers of this function.
 */
export function setConfig(
  s: SessionState,
  partial: Partial<Omit<SeederConfig, 'seed'>>
): SessionState {
  return { ...s, config: { ...s.config, ...partial } }
}

/**
 * Toggle a player's presence in the session roster.
 * If the player is already present, removes them; otherwise appends them.
 */
export function toggleRosterPlayer(s: SessionState, p: PlayerRef): SessionState {
  const present = s.roster.some((r) => r.id === p.id)
  const roster = present ? s.roster.filter((r) => r.id !== p.id) : [...s.roster, p]
  return { ...s, roster }
}

/**
 * Generate a matchup queue from the current roster and config.
 * Replaces any existing queue.
 */
export function generate(s: SessionState): SessionState {
  const count = computeGameCount(s.roster.length, s.config)
  const queue = buildMatchups({ players: s.roster, config: s.config, history: [], count })
  return { ...s, queue }
}

// ─── Play & mutation ────────────────────────────────────────────────────────

/** Private: keep non-pending matchups, then top-up to the target game count. */
function regenerateTail(s: SessionState): SessionState {
  const kept = s.queue.filter((m) => m.status !== 'pending') // done + playing stay
  const total = computeGameCount(s.roster.length, s.config)
  const count = Math.max(0, total - kept.length)
  const tail = buildMatchups({ players: s.roster, config: s.config, history: kept, count })
  return { ...s, queue: [...kept, ...tail] }
}

/**
 * Mark a pending matchup as 'playing' and stamp its start time.
 * `now` is caller-supplied so this function stays pure.
 */
export function startMatchup(s: SessionState, id: string, now: number): SessionState {
  return {
    ...s,
    queue: s.queue.map((m) =>
      m.id === id ? { ...m, status: 'playing' as const, startedAt: now } : m
    ),
  }
}

/**
 * Mark a playing matchup as 'done' with its final score and duration.
 */
export function finishMatchup(
  s: SessionState,
  id: string,
  score: [number, number],
  durationSeconds: number
): SessionState {
  return {
    ...s,
    queue: s.queue.map((m) =>
      m.id === id ? { ...m, status: 'done' as const, score, durationSeconds } : m
    ),
  }
}

/**
 * Add a player to the roster.
 * No-op if already present. During setup (empty queue) just appends to roster;
 * during a live session, regenerates the pending tail so the newcomer is scheduled.
 */
export function addPlayer(s: SessionState, p: PlayerRef): SessionState {
  if (s.roster.some((r) => r.id === p.id)) return s
  const withPlayer = { ...s, roster: [...s.roster, p] }
  return s.queue.length === 0 ? withPlayer : regenerateTail(withPlayer)
}

/**
 * Remove a player from the roster.
 * Drops any pending matchups that include them; their played history is kept.
 * The pending tail is then regenerated for the remaining roster.
 */
export function removePlayer(s: SessionState, playerId: string): SessionState {
  const roster = s.roster.filter((r) => r.id !== playerId)
  const queue = s.queue.filter(
    (m) => m.status !== 'pending' || (m.aId !== playerId && m.bId !== playerId)
  )
  return regenerateTail({ ...s, roster, queue })
}

/**
 * Append a fresh batch of games using a new time budget and seed.
 * The entire current queue counts as history for fairness weighting.
 */
export function generateMore(s: SessionState, minutes: number, seed: number): SessionState {
  const config = { ...s.config, minutes, seed }
  const count = computeGameCount(s.roster.length, { target: config.target, minutes })
  const more = buildMatchups({ players: s.roster, config, history: s.queue, count })
  return { ...s, config, queue: [...s.queue, ...more] }
}

// ─── Logging ────────────────────────────────────────────────────────────────

/** Build the field map the existing `logMatch` server action expects (single game).
 *  `playedAtISO` is the exact instant the game finished (e.g. `new Date().toISOString()`). */
export function buildLogFields(
  matchup: { aId: string; bId: string },
  score: [number, number],
  durationSeconds: number,
  playedAtISO: string
): Record<string, string> {
  return {
    playerAId: matchup.aId,
    playerBId: matchup.bId,
    set_0_a: String(score[0]),
    set_0_b: String(score[1]),
    durationSeconds: String(durationSeconds),
    playedAt: playedAtISO,
  }
}

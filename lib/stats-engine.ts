export type EngineMatch = {
  id: string
  playerAId: string
  playerBId: string
  winnerId: string | null
  setScores: [number, number][]
  durationSeconds: number | null
  playedAt: Date
  eloABefore: number
  eloAAfter: number
  eloBBefore: number
  eloBAfter: number
}

export type MatchPoints = { aFor: number; aAgainst: number; bFor: number; bAgainst: number; sets: number }

export function matchPoints(m: EngineMatch): MatchPoints {
  let aFor = 0, bFor = 0
  for (const [a, b] of m.setScores) { aFor += a; bFor += b }
  return { aFor, aAgainst: bFor, bFor, bAgainst: aFor, sets: m.setScores.length }
}

export function matchMargin(m: EngineMatch): number {
  const p = matchPoints(m)
  return Math.abs(p.aFor - p.bFor)
}

export type PlayerStats = {
  playerId: string
  games: number
  wins: number
  losses: number
  winPct: number | null
  currentStreak: number
  longestWinStreak: number
  pointsFor: number
  pointsAgainst: number
  pointsRatio: number | null
  avgMargin: number | null
  avgPointsPerSet: number | null
  avgGameSeconds: number | null
  totalPlayingSeconds: number
  peakElo: number
  lastPlayedAt: Date | null
}

export function playerAggregates(
  all: EngineMatch[],
  playerId: string,
  currentElo: number,
  minGames = 1
): PlayerStats {
  const mine = all
    .filter((m) => m.playerAId === playerId || m.playerBId === playerId)
    .sort((x, y) => x.playedAt.getTime() - y.playedAt.getTime())

  let wins = 0, losses = 0, gameCount = 0
  let pointsFor = 0, pointsAgainst = 0, marginSum = 0, setSum = 0
  let durSum = 0, durCount = 0, peakElo = currentElo
  let streak = 0, longest = 0, run = 0

  for (const m of mine) {
    const isA = m.playerAId === playerId
    const p = matchPoints(m)
    pointsFor += isA ? p.aFor : p.bFor
    pointsAgainst += isA ? p.aAgainst : p.bAgainst
    marginSum += matchMargin(m)
    setSum += p.sets
    if (m.durationSeconds) { durSum += m.durationSeconds; durCount++ }
    const eloAfter = isA ? m.eloAAfter : m.eloBAfter
    if (eloAfter > peakElo) peakElo = eloAfter

    for (const [sa, sb] of m.setScores) {
      if (sa === sb) continue
      const iWonGame = isA ? sa > sb : sb > sa
      gameCount++
      if (iWonGame) { wins++; run = run >= 0 ? run + 1 : 1; if (run > longest) longest = run }
      else { losses++; run = run <= 0 ? run - 1 : -1 }
      streak = run
    }
  }

  const enough = gameCount >= minGames
  return {
    playerId,
    games: gameCount,
    wins,
    losses,
    winPct: enough && gameCount > 0 ? Math.round((wins / gameCount) * 100) : null,
    currentStreak: streak,
    longestWinStreak: longest,
    pointsFor,
    pointsAgainst,
    pointsRatio: enough && pointsAgainst > 0 ? pointsFor / pointsAgainst : null,
    avgMargin: enough && mine.length > 0 ? Math.round((marginSum / mine.length) * 10) / 10 : null,
    avgPointsPerSet: enough && setSum > 0 ? Math.round((pointsFor / setSum) * 10) / 10 : null,
    avgGameSeconds: durCount > 0 ? Math.round(durSum / durCount) : null,
    totalPlayingSeconds: durSum,
    peakElo,
    lastPlayedAt: mine.length ? mine[mine.length - 1].playedAt : null,
  }
}

// ── Weekly-window functions ───────────────────────────────────────────────────

function inWindow(all: EngineMatch[], since: Date): EngineMatch[] {
  return all.filter((m) => m.playedAt.getTime() >= since.getTime())
}

export type Mover = { playerId: string; delta: number }

/** Net ELO change per player across the window (last after − first before), sorted desc. */
export function movers(all: EngineMatch[], since: Date): Mover[] {
  const win = inWindow(all, since).sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime())
  const first = new Map<string, number>()
  const last = new Map<string, number>()
  for (const m of win) {
    for (const side of ['A', 'B'] as const) {
      const id = side === 'A' ? m.playerAId : m.playerBId
      const before = side === 'A' ? m.eloABefore : m.eloBBefore
      const after = side === 'A' ? m.eloAAfter : m.eloBAfter
      if (!first.has(id)) first.set(id, before)
      last.set(id, after)
    }
  }
  return [...first.keys()]
    .map((id) => ({ playerId: id, delta: (last.get(id) ?? 0) - (first.get(id) ?? 0) }))
    .sort((a, b) => b.delta - a.delta)
}

function winnerBefore(m: EngineMatch) {
  return m.winnerId === m.playerAId ? m.eloABefore : m.eloBBefore
}
function loserBefore(m: EngineMatch) {
  return m.winnerId === m.playerAId ? m.eloBBefore : m.eloABefore
}

/** Match where the lower-rated player won by the biggest rating gap. */
export function upsetOfWeek(all: EngineMatch[], since: Date): EngineMatch | null {
  let best: EngineMatch | null = null
  let bestGap = 0
  for (const m of inWindow(all, since)) {
    if (!m.winnerId) continue
    const gap = loserBefore(m) - winnerBefore(m)
    if (gap > bestGap) { bestGap = gap; best = m }
  }
  return best
}

export function demolitionOfWeek(all: EngineMatch[], since: Date): EngineMatch | null {
  let best: EngineMatch | null = null
  let bestMargin = -1
  for (const m of inWindow(all, since)) {
    if (!m.winnerId) continue
    const margin = matchMargin(m)
    if (margin > bestMargin) { bestMargin = margin; best = m }
  }
  return best
}

export function durationRecords(all: EngineMatch[], since: Date): { longest: EngineMatch | null; fastest: EngineMatch | null } {
  let longest: EngineMatch | null = null
  let fastest: EngineMatch | null = null
  for (const m of inWindow(all, since)) {
    if (!m.durationSeconds) continue
    if (!longest || m.durationSeconds > (longest.durationSeconds ?? 0)) longest = m
    if (!fastest || m.durationSeconds < (fastest.durationSeconds ?? Infinity)) fastest = m
  }
  return { longest, fastest }
}

export type Rivalry = { p1: string; p2: string; games: number }

export function mostPlayedRivalry(all: EngineMatch[], since: Date): Rivalry | null {
  const counts = new Map<string, number>()
  for (const m of inWindow(all, since)) {
    const key = [m.playerAId, m.playerBId].sort().join('|')
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  let best: Rivalry | null = null
  for (const [key, games] of counts) {
    if (!best || games > best.games) {
      const [p1, p2] = key.split('|')
      best = { p1, p2, games }
    }
  }
  return best
}

export function headToHead(all: EngineMatch[], p1: string, p2: string): { p1Wins: number; p2Wins: number } {
  let p1Wins = 0, p2Wins = 0
  for (const m of all) {
    const pair = [m.playerAId, m.playerBId]
    if (!pair.includes(p1) || !pair.includes(p2)) continue
    const p1IsA = m.playerAId === p1
    for (const [sa, sb] of m.setScores) {
      if (sa === sb) continue
      const p1WonGame = p1IsA ? sa > sb : sb > sa
      if (p1WonGame) p1Wins++; else p2Wins++
    }
  }
  return { p1Wins, p2Wins }
}

export type Participation = { games: number; distinctPlayers: number; rate: number; totalCourtSeconds: number }

export function participation(all: EngineMatch[], activePlayerIds: string[], since: Date): Participation {
  const win = inWindow(all, since)
  const distinct = new Set<string>()
  let court = 0
  for (const m of win) {
    distinct.add(m.playerAId)
    distinct.add(m.playerBId)
    court += m.durationSeconds ?? 0
  }
  const active = activePlayerIds.length
  return {
    games: win.length,
    distinctPlayers: distinct.size,
    rate: active > 0 ? Math.round((distinct.size / active) * 100) : 0,
    totalCourtSeconds: court,
  }
}

/** Competition rank of `elo` within a pool: (number of elos strictly greater) + 1. */
export function rankWithin(elos: number[], elo: number): number {
  let above = 0
  for (const e of elos) if (e > elo) above++
  return above + 1
}

/** Count of `playerId`'s wins where the opponent was rated at least `gap` ELO higher (before the match). */
export function giantKills(all: EngineMatch[], playerId: string, gap = 100): number {
  let n = 0
  for (const mt of all) {
    if (mt.winnerId !== playerId) continue
    const isA = mt.playerAId === playerId
    const myBefore = isA ? mt.eloABefore : mt.eloBBefore
    const oppBefore = isA ? mt.eloBBefore : mt.eloABefore
    if (oppBefore - myBefore >= gap) n++
  }
  return n
}

// ── Digest / activity helpers ──────────────────────────────────────────────────

/** Matches whose playedAt falls in [start, end). */
export function inRange(all: EngineMatch[], start: Date, end: Date): EngineMatch[] {
  const s = start.getTime()
  const e = end.getTime()
  return all.filter((m) => {
    const t = m.playedAt.getTime()
    return t >= s && t < e
  })
}

/** Match with the largest winner ELO delta (most rating changed hands). Null-winner matches ignored. */
export function biggestEloSwingMatch(matches: EngineMatch[]): EngineMatch | null {
  let best: EngineMatch | null = null
  let bestSwing = -1
  for (const m of matches) {
    if (!m.winnerId) continue
    const winnerIsA = m.winnerId === m.playerAId
    const swing = Math.abs(winnerIsA ? m.eloAAfter - m.eloABefore : m.eloBAfter - m.eloBBefore)
    if (swing > bestSwing) {
      bestSwing = swing
      best = m
    }
  }
  return best
}

/** Set of player ids that appear in any match played at/after `since`. */
export function recentlyActive(matches: EngineMatch[], since: Date): Set<string> {
  const s = since.getTime()
  const ids = new Set<string>()
  for (const m of matches) {
    if (m.playedAt.getTime() >= s) {
      ids.add(m.playerAId)
      ids.add(m.playerBId)
    }
  }
  return ids
}

// ── Head-to-head detail ───────────────────────────────────────────────────────

export type H2HMatchResult = 'W' | 'L'

export type EloSwingPoint = {
  matchIndex: number
  date: string
  cumulativeDelta: number
  matchDelta: number
}

export type H2HDetail = {
  p1Id: string
  p2Id: string
  matchCount: number
  p1MatchWins: number
  p2MatchWins: number
  p1GameWins: number
  p2GameWins: number
  avgDurationSeconds: number | null
  avgScoreDifferential: number | null
  last5Form: H2HMatchResult[]
  totalEloTakenByP1: number
  totalEloTakenByP2: number
  eloSwingSeries: EloSwingPoint[]
}

export function headToHeadDetail(all: EngineMatch[], p1: string, p2: string): H2HDetail {
  const pairMatches = all
    .filter((m) => {
      const ids = [m.playerAId, m.playerBId]
      return ids.includes(p1) && ids.includes(p2)
    })
    .sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime())

  let p1MatchWins = 0, p2MatchWins = 0, p1GameWins = 0, p2GameWins = 0
  let durSum = 0, durCount = 0, marginSum = 0, gameCount = 0
  let totalEloTakenByP1 = 0, totalEloTakenByP2 = 0, cumulativeDelta = 0
  const formAll: H2HMatchResult[] = []
  const eloSwingSeries: EloSwingPoint[] = []

  for (let i = 0; i < pairMatches.length; i++) {
    const m = pairMatches[i]
    const p1IsA = m.playerAId === p1

    let p1Games = 0, p2Games = 0
    for (const [sa, sb] of m.setScores) {
      marginSum += Math.abs(sa - sb)
      gameCount++
      if (sa === sb) continue
      const p1Won = p1IsA ? sa > sb : sb > sa
      if (p1Won) { p1GameWins++; p1Games++ } else { p2GameWins++; p2Games++ }
    }

    if (p1Games > p2Games) { p1MatchWins++; formAll.push('W') }
    else if (p2Games > p1Games) { p2MatchWins++; formAll.push('L') }

    if (m.durationSeconds !== null && m.durationSeconds > 0) { durSum += m.durationSeconds; durCount++ }

    const p1Delta = p1IsA ? m.eloAAfter - m.eloABefore : m.eloBAfter - m.eloBBefore
    const p2Delta = p1IsA ? m.eloBAfter - m.eloBBefore : m.eloAAfter - m.eloABefore
    totalEloTakenByP1 += p1Delta
    totalEloTakenByP2 += p2Delta
    cumulativeDelta += p1Delta
    eloSwingSeries.push({
      matchIndex: i + 1,
      date: `${m.playedAt.getDate()} ${m.playedAt.toLocaleString('en', { month: 'short' })}`,
      cumulativeDelta,
      matchDelta: p1Delta,
    })
  }

  return {
    p1Id: p1, p2Id: p2,
    matchCount: pairMatches.length,
    p1MatchWins, p2MatchWins, p1GameWins, p2GameWins,
    avgDurationSeconds: durCount > 0 ? Math.round(durSum / durCount) : null,
    avgScoreDifferential: gameCount > 0 ? Math.round((marginSum / gameCount) * 10) / 10 : null,
    last5Form: formAll.slice(-5),
    totalEloTakenByP1: Math.round(totalEloTakenByP1),
    totalEloTakenByP2: Math.round(totalEloTakenByP2),
    eloSwingSeries,
  }
}

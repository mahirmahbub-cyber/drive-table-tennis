export type EngineMatch = {
  id: string
  playerAId: string
  playerBId: string
  winnerId: string
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

  let wins = 0, losses = 0, pointsFor = 0, pointsAgainst = 0, marginSum = 0, setSum = 0, durSum = 0, durCount = 0, peakElo = currentElo
  let streak = 0, longest = 0, run = 0

  for (const m of mine) {
    const isA = m.playerAId === playerId
    const won = m.winnerId === playerId
    const p = matchPoints(m)
    pointsFor += isA ? p.aFor : p.bFor
    pointsAgainst += isA ? p.aAgainst : p.bAgainst
    marginSum += matchMargin(m)
    setSum += p.sets
    if (m.durationSeconds) { durSum += m.durationSeconds; durCount++ }
    const eloAfter = isA ? m.eloAAfter : m.eloBAfter
    if (eloAfter > peakElo) peakElo = eloAfter
    if (won) { wins++; run = run >= 0 ? run + 1 : 1; if (run > longest) longest = run }
    else { losses++; run = run <= 0 ? run - 1 : -1 }
    streak = run
  }

  const games = mine.length
  const enough = games >= minGames
  return {
    playerId,
    games,
    wins,
    losses,
    winPct: enough && games > 0 ? Math.round((wins / games) * 100) : null,
    currentStreak: streak,
    longestWinStreak: longest,
    pointsFor,
    pointsAgainst,
    pointsRatio: enough && pointsAgainst > 0 ? pointsFor / pointsAgainst : null,
    avgMargin: enough && games > 0 ? Math.round((marginSum / games) * 10) / 10 : null,
    avgPointsPerSet: enough && setSum > 0 ? Math.round((pointsFor / setSum) * 10) / 10 : null,
    avgGameSeconds: durCount > 0 ? Math.round(durSum / durCount) : null,
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
    const gap = loserBefore(m) - winnerBefore(m)
    if (gap > bestGap) { bestGap = gap; best = m }
  }
  return best
}

export function demolitionOfWeek(all: EngineMatch[], since: Date): EngineMatch | null {
  let best: EngineMatch | null = null
  let bestMargin = -1
  for (const m of inWindow(all, since)) {
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
    if (m.winnerId === p1) p1Wins++
    else if (m.winnerId === p2) p2Wins++
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

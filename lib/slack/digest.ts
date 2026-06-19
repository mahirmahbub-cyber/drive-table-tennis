import {
  inRange, biggestEloSwingMatch, movers, demolitionOfWeek, upsetOfWeek,
  mostPlayedRivalry, durationRecords, type EngineMatch,
} from '@/lib/stats-engine'
import { formatDuration } from '@/lib/stats'
import { formatSydneyDay, formatSydneyWeekRange, type Range } from '@/lib/slack/windows'

export type PlayerLite = { name: string; nickname: string | null }
export type DigestInput = {
  engineMatches: EngineMatch[]
  playersById: Map<string, PlayerLite>
  range: Range
}
export type DigestVariables = Record<string, string>

const DASH = '—'

function nameOf(input: DigestInput, id: string): string {
  return input.playersById.get(id)?.name ?? 'Unknown'
}

function winnerLoser(m: EngineMatch) {
  const winnerIsA = m.winnerId === m.playerAId
  return {
    winnerId: winnerIsA ? m.playerAId : m.playerBId,
    loserId: winnerIsA ? m.playerBId : m.playerAId,
    winnerBefore: winnerIsA ? m.eloABefore : m.eloBBefore,
    loserBefore: winnerIsA ? m.eloBBefore : m.eloABefore,
    winnerDelta: winnerIsA ? m.eloAAfter - m.eloABefore : m.eloBAfter - m.eloBBefore,
  }
}

/** Winner-oriented scoreline, e.g. "11–5" or "11–9, 9–11, 11–7". */
function scoreline(m: EngineMatch): string {
  const winnerIsA = m.winnerId === m.playerAId
  return m.setScores.map(([a, b]) => (winnerIsA ? `${a}–${b}` : `${b}–${a}`)).join(', ')
}

const signed = (n: number): string => (n > 0 ? `+${n}` : `${n}`)

export function buildWeeklyDigest(input: DigestInput): DigestVariables | null {
  const ms = inRange(input.engineMatches, input.range.start, input.range.end)
  if (ms.length === 0) return null
  const since = input.range.start

  const demo = demolitionOfWeek(ms, since)
  const upset = upsetOfWeek(ms, since)
  const mv = movers(ms, since)
  const risers = mv.filter((x) => x.delta > 0).slice(0, 3)
  const fallers = mv.filter((x) => x.delta < 0).slice(-3).reverse()
  const rivalry = mostPlayedRivalry(ms, since)
  const { longest, fastest } = durationRecords(ms, since)

  const moverLine = (x: { playerId: string; delta: number }) => `${nameOf(input, x.playerId)} ${signed(x.delta)}`
  const pair = (m: EngineMatch) => `${nameOf(input, m.playerAId)} vs ${nameOf(input, m.playerBId)}`
  const beatdown = demo ? winnerLoser(demo) : null
  const up = upset ? winnerLoser(upset) : null

  return {
    week_range: formatSydneyWeekRange(input.range.start, input.range.end),
    games_played: String(ms.length),
    biggest_beatdown: demo && beatdown
      ? `${nameOf(input, beatdown.winnerId)} beat ${nameOf(input, beatdown.loserId)} ${scoreline(demo)}`
      : DASH,
    biggest_upset: upset && up
      ? `${nameOf(input, up.winnerId)} beat ${nameOf(input, up.loserId)} (${up.winnerBefore} vs ${up.loserBefore})`
      : DASH,
    top_risers: risers.length ? risers.map(moverLine).join(' · ') : DASH,
    biggest_fallers: fallers.length ? fallers.map(moverLine).join(' · ') : DASH,
    top_rivalry: rivalry
      ? `${nameOf(input, rivalry.p1)} vs ${nameOf(input, rivalry.p2)} · ${rivalry.games} games`
      : DASH,
    longest_game: longest?.durationSeconds ? `${pair(longest)} · ${formatDuration(longest.durationSeconds)}` : DASH,
    fastest_game: fastest?.durationSeconds ? `${pair(fastest)} · ${formatDuration(fastest.durationSeconds)}` : DASH,
  }
}

export function buildDailyDigest(input: DigestInput): DigestVariables | null {
  const ms = inRange(input.engineMatches, input.range.start, input.range.end)
  if (ms.length === 0) return null
  const since = input.range.start

  const swing = biggestEloSwingMatch(ms)
  const mv = movers(ms, since)
  const top = mv[0] && mv[0].delta > 0 ? mv[0] : null

  let biggestWinner = DASH
  if (top) {
    const games = ms.filter((m) => m.playerAId === top.playerId || m.playerBId === top.playerId).length
    biggestWinner = `${nameOf(input, top.playerId)} · ${signed(top.delta)} ELO over ${games} game${games === 1 ? '' : 's'}`
  }

  let swingLine = DASH
  if (swing) {
    const wl = winnerLoser(swing)
    swingLine = `${nameOf(input, wl.winnerId)} beat ${nameOf(input, wl.loserId)} ${scoreline(swing)} · ${signed(wl.winnerDelta)} ELO`
  }

  return {
    day: formatSydneyDay(input.range.start),
    games_played: String(ms.length),
    biggest_swing_match: swingLine,
    biggest_winner: biggestWinner,
  }
}

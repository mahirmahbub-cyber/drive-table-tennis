import { describe, it, expect } from 'vitest'
import {
  createSession, setConfig, toggleRosterPlayer, generate, buildLogFields, DEFAULT_CONFIG,
} from './seeder-session'
import type { PlayerRef } from './seeder'

const P = (id: string, elo = 1200): PlayerRef => ({ id, name: id, elo })

describe('createSession', () => {
  it('starts empty with default config and the given seed', () => {
    const s = createSession(99)
    expect(s.roster).toEqual([])
    expect(s.queue).toEqual([])
    expect(s.config).toEqual({ ...DEFAULT_CONFIG, seed: 99 })
  })
})

describe('setConfig', () => {
  it('merges config without touching the seed', () => {
    const s = setConfig(createSession(1), { target: 21, minutes: 45 })
    expect(s.config.target).toBe(21)
    expect(s.config.minutes).toBe(45)
    expect(s.config.seed).toBe(1)
  })
})

describe('toggleRosterPlayer', () => {
  it('adds a player not present and removes one already present', () => {
    let s = createSession(1)
    s = toggleRosterPlayer(s, P('a'))
    expect(s.roster.map((p) => p.id)).toEqual(['a'])
    s = toggleRosterPlayer(s, P('a'))
    expect(s.roster).toEqual([])
  })
})

describe('generate', () => {
  it('builds a queue from the roster sized by config', () => {
    let s = createSession(1)
    for (const id of ['a', 'b', 'c', 'd']) s = toggleRosterPlayer(s, P(id))
    s = setConfig(s, { target: 11, minutes: 30 }) // 6 games
    s = generate(s)
    expect(s.queue).toHaveLength(6)
    expect(s.queue.every((m) => m.status === 'pending')).toBe(true)
  })
})

describe('buildLogFields', () => {
  it('maps a finished matchup to logMatch form fields with an explicit playedAt', () => {
    expect(buildLogFields({ aId: 'a', bId: 'b' }, [11, 7], 240, '2026-06-19T03:30:00.000Z')).toEqual({
      playerAId: 'a', playerBId: 'b', set_0_a: '11', set_0_b: '7',
      durationSeconds: '240', playedAt: '2026-06-19T03:30:00.000Z',
    })
  })
})

import {
  startMatchup, finishMatchup, addPlayer, removePlayer, generateMore,
} from './seeder-session'

function generated(ids: string[], over = {}) {
  let s = createSession(1)
  for (const id of ids) s = toggleRosterPlayer(s, P(id))
  s = setConfig(s, { minutes: 30, ...over })
  return generate(s)
}

describe('startMatchup', () => {
  it('marks the matchup playing and stamps startedAt', () => {
    const s0 = generated(['a', 'b', 'c', 'd'])
    const id = s0.queue[0].id
    const s = startMatchup(s0, id, 1000)
    const m = s.queue.find((x) => x.id === id)!
    expect(m.status).toBe('playing')
    expect(m.startedAt).toBe(1000)
  })
})

describe('finishMatchup', () => {
  it('marks the matchup done with score and duration', () => {
    const s0 = generated(['a', 'b', 'c', 'd'])
    const id = s0.queue[0].id
    const s = finishMatchup(startMatchup(s0, id, 1000), id, [11, 9], 300)
    const m = s.queue.find((x) => x.id === id)!
    expect(m.status).toBe('done')
    expect(m.score).toEqual([11, 9])
    expect(m.durationSeconds).toBe(300)
  })
})

describe('addPlayer', () => {
  it('weaves a newcomer in and keeps played games untouched', () => {
    let s = generated(['a', 'b', 'c', 'd'])
    const firstId = s.queue[0].id
    s = finishMatchup(startMatchup(s, firstId, 1), firstId, [11, 5], 200)
    const before = s.queue.filter((m) => m.status === 'done').map((m) => m.id)
    s = addPlayer(s, P('e'))
    const after = s.queue.filter((m) => m.status === 'done').map((m) => m.id)
    expect(after).toEqual(before) // done games preserved
    expect(s.roster.map((p) => p.id)).toContain('e')
    expect(s.queue.some((m) => m.aId === 'e' || m.bId === 'e')).toBe(true) // newcomer scheduled
  })
})

describe('removePlayer', () => {
  it('drops the player and any pending matchup that includes them', () => {
    let s = generated(['a', 'b', 'c', 'd'])
    s = removePlayer(s, 'a')
    expect(s.roster.some((p) => p.id === 'a')).toBe(false)
    expect(s.queue.some((m) => m.status === 'pending' && (m.aId === 'a' || m.bId === 'a'))).toBe(false)
  })
})

describe('generateMore', () => {
  it('appends a fresh batch sized by the new time budget', () => {
    const s0 = generated(['a', 'b', 'c', 'd'])
    const len0 = s0.queue.length
    const s = generateMore(s0, 15, 999) // 15/5 = 3 budget; 4 players => 3
    expect(s.queue.length).toBe(len0 + 3)
    expect(s.config.minutes).toBe(15)
    expect(s.config.seed).toBe(999)
  })
})

'use client'

import { useEffect, useState } from 'react'
import type { PlayerRef, Target } from '@/lib/seeder'
import {
  type SessionState, createSession, toggleRosterPlayer, setConfig, generate,
  startMatchup, finishMatchup, addPlayer, removePlayer, generateMore,
} from '@/lib/seeder-session'
import { STORAGE_KEY, serializeSession, parseStoredSession } from '@/lib/seeder-storage'
import { SeederSetup } from '@/components/seeder/seeder-setup'
import { SeederQueue } from '@/components/seeder/seeder-queue'

function randomSeed(): number {
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0
}

export function QuickSeeder({ players }: { players: PlayerRef[] }) {
  const [session, setSession] = useState<SessionState | null>(null)

  useEffect(() => {
    const raw = typeof window === 'undefined' ? null : window.localStorage.getItem(STORAGE_KEY)
    const stored = parseStoredSession(raw)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession(stored ?? createSession(randomSeed()))
  }, [])

  useEffect(() => {
    if (session) window.localStorage.setItem(STORAGE_KEY, serializeSession(session))
  }, [session])

  if (!session) return <div className="text-sm text-muted-foreground">Loading…</div>

  const hasQueue = session.queue.length > 0

  return (
    <div data-testid="quick-seeder" className="space-y-6">
      {!hasQueue ? (
        <SeederSetup
          players={players}
          session={session}
          onToggle={(p) => setSession((s) => (s ? toggleRosterPlayer(s, p) : s))}
          onConfig={(partial: Partial<{ target: Target; minutes: number; mix: number }>) =>
            setSession((s) => (s ? setConfig(s, partial) : s))
          }
          onGenerate={() => setSession((s) => (s ? generate(s) : s))}
        />
      ) : (
        <SeederQueue
          session={session}
          players={players}
          onStart={(id, now) => setSession((s) => (s ? startMatchup(s, id, now) : s))}
          onFinish={(id, score, dur) => setSession((s) => (s ? finishMatchup(s, id, score, dur) : s))}
          onAddPlayer={(p) => setSession((s) => (s ? addPlayer(s, p) : s))}
          onGenerateMore={(minutes) => setSession((s) => (s ? generateMore(s, minutes, randomSeed()) : s))}
          onRemovePlayer={(id) => setSession((s) => (s ? removePlayer(s, id) : s))}
          onClear={() => setSession(createSession(randomSeed()))}
        />
      )}
    </div>
  )
}

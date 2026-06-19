'use client'

import { useState } from 'react'
import { postWeeklyNow, postDailyNow } from '@/app/actions/slack'

type R = { ok: true } | { skipped: true } | { error: string }

export function PostToSlackButtons() {
  const [pending, setPending] = useState<null | 'weekly' | 'daily'>(null)
  const [status, setStatus] = useState<string | null>(null)

  async function run(kind: 'weekly' | 'daily', fn: () => Promise<R>) {
    if (pending) return
    setPending(kind)
    setStatus(null)
    try {
      const r = await fn()
      if ('error' in r) setStatus(`⚠️ ${r.error}`)
      else if ('skipped' in r) setStatus('No games in the window — nothing posted.')
      else setStatus(`✓ ${kind === 'weekly' ? 'Weekly' : 'Daily'} recap posted to Slack.`)
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => run('weekly', postWeeklyNow)}
          className="rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary disabled:opacity-50"
        >
          {pending === 'weekly' ? 'Posting…' : 'Post weekly recap now'}
        </button>
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => run('daily', postDailyNow)}
          className="rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary disabled:opacity-50"
        >
          {pending === 'daily' ? 'Posting…' : 'Post daily recap now'}
        </button>
      </div>
      {status && <p className="text-sm text-muted-foreground">{status}</p>}
    </div>
  )
}

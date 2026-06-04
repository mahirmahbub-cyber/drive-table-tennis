import { loadHomeData } from '@/lib/home-data'
import { Mogboard } from '@/components/home/mogboard'

export const dynamic = 'force-dynamic'

export default async function MatrixPage() {
  const data = await loadHomeData()
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 md:px-6">
      <div className="mb-6">
        <p className="font-display uppercase tracking-[0.2em] text-xs text-primary mb-1">Who mogs who</p>
        <h1 className="font-display text-3xl font-bold tracking-tight leading-none">The Mogboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">Head-to-head record, row vs column. Blue = you mog them.</p>
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <Mogboard players={data.activePlayers} matches={data.engineMatches} />
      </div>
    </main>
  )
}

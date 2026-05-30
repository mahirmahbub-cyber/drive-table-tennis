import Link from 'next/link'
import { Leaderboard } from '@/components/leaderboard'
import { RecentMatches } from '@/components/recent-matches'
import { InFormCard } from '@/components/in-form-card'

export const dynamic = 'force-dynamic'

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl p-6">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Drive Table Tennis</h1>
        <nav className="flex gap-4 text-sm">
          <Link href="/players">Players</Link>
          <Link href="/matches">Matches</Link>
          <Link href="/tournaments">Tournaments</Link>
          <Link href="/join" className="font-semibold">Join</Link>
        </nav>
      </header>
      <div className="grid gap-8 md:grid-cols-2">
        <Leaderboard />
        <div className="space-y-8">
          <InFormCard />
          <RecentMatches />
        </div>
      </div>
    </main>
  )
}

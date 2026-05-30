import Link from 'next/link'
import { desc } from 'drizzle-orm'
import { db, tournaments } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function TournamentsPage() {
  const all = await db.select().from(tournaments).orderBy(desc(tournaments.createdAt))
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">Tournaments</h1>
      <ul className="divide-y rounded border">
        {all.map((t) => (
          <li key={t.id} className="flex items-center gap-3 px-3 py-2">
            <Link href={`/tournaments/${t.id}`} className="flex-1 hover:underline">
              {t.name}
            </Link>
            <span className="text-xs text-zinc-500">{t.status}</span>
          </li>
        ))}
      </ul>
    </main>
  )
}

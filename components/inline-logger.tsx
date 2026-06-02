import { db, players } from '@/lib/db'
import { asc, eq } from 'drizzle-orm'
import { LogGameExpander } from '@/components/log-game-expander'

export async function InlineLogger() {
  const roster = await db
    .select({
      id: players.id,
      name: players.name,
      nickname: players.nickname,
      currentElo: players.currentElo,
    })
    .from(players)
    .where(eq(players.active, true))
    .orderBy(asc(players.name))

  return <LogGameExpander players={roster} />
}

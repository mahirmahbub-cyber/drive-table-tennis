import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

const globalForDb = globalThis as unknown as { pool?: Pool }

const pool =
  globalForDb.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    // Serverless: each warm instance holds at most one client connection.
    // The Supabase transaction pooler (port 6543) multiplexes these across its server pool.
    max: 1,
  })

globalForDb.pool = pool

export const db = drizzle(pool, { schema })
export * from './schema'

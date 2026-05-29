import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  unique,
} from 'drizzle-orm/pg-core'

export const players = pgTable('players', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  nickname: text('nickname'),
  bio: text('bio'),
  email: text('email').unique(),
  photoUrl: text('photo_url'),
  currentElo: integer('current_elo').notNull().default(1200),
  active: boolean('active').notNull().default(true),
  createdVia: text('created_via').notNull().default('admin'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const tournaments = pgTable('tournaments', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  status: text('status').notNull(), // 'draft' | 'in_progress' | 'completed'
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
})

export const tournamentEntries = pgTable(
  'tournament_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tournamentId: uuid('tournament_id')
      .notNull()
      .references(() => tournaments.id, { onDelete: 'cascade' }),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id),
    seed: integer('seed').notNull(),
  },
  (t) => ({
    uniqEntry: unique().on(t.tournamentId, t.playerId),
  })
)

export const matches = pgTable('matches', {
  id: uuid('id').primaryKey().defaultRandom(),
  playerAId: uuid('player_a_id').references(() => players.id),
  playerBId: uuid('player_b_id').references(() => players.id),
  winnerId: uuid('winner_id').references(() => players.id),
  setScores: jsonb('set_scores').$type<Array<[number, number]>>(),
  playedAt: timestamp('played_at', { withTimezone: true }),
  tournamentId: uuid('tournament_id').references(() => tournaments.id, {
    onDelete: 'cascade',
  }),
  round: integer('round'),
  bracketSlot: integer('bracket_slot'),
  eloABefore: integer('elo_a_before'),
  eloBBefore: integer('elo_b_before'),
  eloAAfter: integer('elo_a_after'),
  eloBAfter: integer('elo_b_after'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Player = typeof players.$inferSelect
export type NewPlayer = typeof players.$inferInsert
export type Match = typeof matches.$inferSelect
export type NewMatch = typeof matches.$inferInsert
export type Tournament = typeof tournaments.$inferSelect
export type TournamentEntry = typeof tournamentEntries.$inferSelect

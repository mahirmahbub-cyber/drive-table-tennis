import { z } from 'zod'

export const playerCreateSchema = z.object({
  name: z.string().trim().min(1).max(60),
  nickname: z.string().trim().min(1).max(30).optional().or(z.literal('')),
  bio: z.string().trim().max(200).optional().or(z.literal('')),
  email: z.string().trim().email().optional().or(z.literal('')),
})

export const setScoreSchema = z.tuple([
  z.coerce.number().int().min(0).max(99),
  z.coerce.number().int().min(0).max(99),
])

const emptyToUndefined = (v: unknown) => (v === '' || v == null ? undefined : v)

export const matchLogSchema = z
  .object({
    playerAId: z.string().uuid(),
    playerBId: z.string().uuid(),
    sets: z.array(setScoreSchema).min(1).max(7),
    playedAt: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
    durationSeconds: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().min(0).max(86400).optional()
    ),
  })
  .refine((d) => d.playerAId !== d.playerBId, {
    message: 'A player cannot play themselves',
  })

export const tournamentCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  playerIds: z.array(z.string().uuid()).min(2).max(64),
})

export const tournamentRenameSchema = z.object({
  name: z.string().trim().min(1).max(80),
})

export type PlayerCreateInput = z.infer<typeof playerCreateSchema>
export type MatchLogInput = z.infer<typeof matchLogSchema>
export type TournamentCreateInput = z.infer<typeof tournamentCreateSchema>

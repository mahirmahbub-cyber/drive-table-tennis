export const PLAYER_DEDUP_WINDOW_MS = 10_000

type ExistingPlayer = { name: string; createdAtMs: number }

/** True when an existing player has the same name (case-insensitive, trimmed)
 *  created within `windowMs` before `nowMs`. */
export function isDuplicatePlayer(
  existing: ExistingPlayer,
  incomingName: string,
  nowMs: number,
  windowMs: number = PLAYER_DEDUP_WINDOW_MS,
): boolean {
  if (nowMs - existing.createdAtMs > windowMs) return false
  return existing.name.trim().toLowerCase() === incomingName.trim().toLowerCase()
}

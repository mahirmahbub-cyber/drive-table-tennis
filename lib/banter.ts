/**
 * Centralised "banter" voice (curated, office-safe looksmaxxing/mogging lingo).
 * Lingo targets rank/results only — never anything personal. ELO numbers stay pure.
 */

export const SUPERLATIVE_LABELS = {
  mostImproved: 'Locked In',
  upset: 'Mog of the Week',
  demolition: 'Cooking of the Week',
} as const

/** "{winner} mogged {loser}" — the standard win caption. */
export function mogCaption(winner: string, loser: string): string {
  return `${winner} mogged ${loser}`
}

/** "{loser} got cooked by {margin}" — blowout caption. */
export function cookedCaption(loser: string, margin: number): string {
  return `${loser} got cooked by ${margin}`
}

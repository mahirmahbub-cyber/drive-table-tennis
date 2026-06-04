import { describe, it, expect } from 'vitest'
import { mogCaption, cookedCaption, SUPERLATIVE_LABELS } from '@/lib/banter'

describe('banter captions', () => {
  it('mogCaption', () => {
    expect(mogCaption('Sasha', 'Marcus')).toBe('Sasha mogged Marcus')
  })
  it('cookedCaption', () => {
    expect(cookedCaption('Marcus', 18)).toBe('Marcus got cooked by 18')
  })
  it('superlative labels are the banter versions', () => {
    expect(SUPERLATIVE_LABELS.upset).toBe('Mog of the Week')
    expect(SUPERLATIVE_LABELS.demolition).toBe('Cooking of the Week')
    expect(SUPERLATIVE_LABELS.mostImproved).toBe('Locked In')
  })
})

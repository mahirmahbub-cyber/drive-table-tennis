import { describe, it, expect } from 'vitest'
import { safeAdminNext } from './auth'

describe('safeAdminNext', () => {
  it('allows internal /admin paths', () => {
    expect(safeAdminNext('/admin/matches/new')).toBe('/admin/matches/new')
    expect(safeAdminNext('/admin')).toBe('/admin')
  })
  it('falls back to /admin for non-admin or unsafe paths', () => {
    expect(safeAdminNext('/players')).toBe('/admin')
    expect(safeAdminNext('//evil.com')).toBe('/admin')
    expect(safeAdminNext('https://evil.com')).toBe('/admin')
    expect(safeAdminNext(null)).toBe('/admin')
    expect(safeAdminNext(undefined)).toBe('/admin')
    expect(safeAdminNext('')).toBe('/admin')
  })
})

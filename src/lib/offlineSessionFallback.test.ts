import { beforeEach, describe, expect, it, vi } from 'vitest'

const cached = vi.hoisted(() => ({ userId: 'user-a' as string | null }))
vi.mock('./authSessionStorage', () => ({
  AUTH_STORAGE_KEY: 'auth',
  authSessionStorage: { getItem: () => (cached.userId ? JSON.stringify({ user: { id: cached.userId } }) : null) },
}))
const { OFFLINE_GRACE_PERIOD_MS, clearVerifiedSession, offlineSessionUserId, recordVerifiedSession } = await import('./offlineSessionFallback')

const NOW = 1_800_000_000_000
beforeEach(() => { localStorage.clear(); cached.userId = 'user-a' })

describe('offline grace period (AUTH-03)', () => {
  it('opens offline only as an account the server confirmed on this computer within the grace period', () => {
    expect(offlineSessionUserId(NOW)).toBeNull()
    recordVerifiedSession('user-a', NOW - 1000)
    expect(offlineSessionUserId(NOW)).toBe('user-a')
    expect(offlineSessionUserId(NOW + OFFLINE_GRACE_PERIOD_MS)).toBeNull()
  })

  it('refuses a cached session for a different account than the one confirmed', () => {
    recordVerifiedSession('user-b', NOW)
    expect(offlineSessionUserId(NOW)).toBeNull()
  })

  it('forgets the confirmation on sign-out', () => {
    recordVerifiedSession('user-a', NOW)
    clearVerifiedSession()
    expect(offlineSessionUserId(NOW)).toBeNull()
  })
})

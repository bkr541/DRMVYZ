import { authSessionStorage, AUTH_STORAGE_KEY } from './authSessionStorage'

/**
 * Best-effort read of the locally cached Supabase session. Used only to keep
 * a previously-authenticated user in the app when getSession()'s refresh
 * attempt fails purely because the network is unavailable — Supabase leaves
 * the cached refresh token in storage on a retryable network failure, it
 * just doesn't hand it back through getSession() itself.
 */
export function peekCachedSessionUserId(): string | null {
  try {
    const raw = authSessionStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const userId = (parsed as { user?: { id?: unknown } }).user?.id
    return typeof userId === 'string' ? userId : null
  } catch {
    return null
  }
}

/** Matches supabase-js's own isAuthRetryableFetchError check, plus a plain
 *  navigator.onLine fallback, without importing an internal SDK class. */
export function isNetworkAuthError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  if ('name' in error && (error as { name?: unknown }).name === 'AuthRetryableFetchError') return true
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

// ── Offline grace period (beta remediation AUTH-03) ─────────────────────────────
// A performer who loses the network can keep working, but only as an account the server confirmed recently on this computer. The cached
// session alone is not enough: its user id is only read from local storage.

/** How long after the last confirmed sign-in the app still opens offline. */
export const OFFLINE_GRACE_PERIOD_MS = 14 * 24 * 60 * 60 * 1000
const LAST_VERIFIED_KEY = 'drmvyz:auth:last-verified:v1'

/** Records that the server has just confirmed `userId`'s session (called on every confirmed session and token refresh). */
export function recordVerifiedSession(userId: string, now = Date.now()): void {
  try { localStorage.setItem(LAST_VERIFIED_KEY, JSON.stringify({ userId, at: now })) } catch { /* Offline use is then simply unavailable. */ }
}

/** Forgets the confirmation (sign-out), so the app cannot be opened offline as that account until it signs in online again. */
export function clearVerifiedSession(): void {
  try { localStorage.removeItem(LAST_VERIFIED_KEY) } catch { /* Nothing to clear. */ }
}

/**
 * The account to open while offline, or null: the cached session's account, only if the server confirmed that same account on this computer
 * within the grace period. Admin access and other server-checked actions stay unavailable until the session is confirmed online again.
 */
export function offlineSessionUserId(now = Date.now()): string | null {
  const cached = peekCachedSessionUserId()
  if (!cached) return null
  try {
    const record = JSON.parse(localStorage.getItem(LAST_VERIFIED_KEY) ?? 'null') as { userId?: unknown; at?: unknown } | null
    if (!record || record.userId !== cached || typeof record.at !== 'number') return null
    const age = now - record.at
    return age >= 0 && age <= OFFLINE_GRACE_PERIOD_MS ? cached : null
  } catch {
    return null
  }
}

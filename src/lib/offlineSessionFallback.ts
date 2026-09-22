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

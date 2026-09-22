/**
 * Supabase-compatible storage adapter that lets "Remember me" control whether
 * a session survives an app restart. Remembered: persisted to localStorage as
 * usual. Not remembered: kept in memory only, so it disappears the next time
 * the app launches. Supabase always reads/writes JSON strings through this
 * interface, so it only ever moves opaque strings around.
 */

const memoryStore = new Map<string, string>()
let rememberSession = true

export function setRememberSession(remember: boolean): void {
  rememberSession = remember
}

export const authSessionStorage = {
  getItem(key: string): string | null {
    if (rememberSession) return localStorage.getItem(key)
    return memoryStore.get(key) ?? localStorage.getItem(key) ?? null
  },
  setItem(key: string, value: string): void {
    if (rememberSession) {
      localStorage.setItem(key, value)
      memoryStore.delete(key)
    } else {
      memoryStore.set(key, value)
      localStorage.removeItem(key)
    }
  },
  removeItem(key: string): void {
    memoryStore.delete(key)
    localStorage.removeItem(key)
  },
}

// Explicit (rather than Supabase's project-ref-derived default) so the
// offline-session fallback can read this exact key without guessing it.
export const AUTH_STORAGE_KEY = 'drmvyz-auth-token'

import { create } from 'zustand'
import { readAppearanceTheme, saveAppearanceTheme } from './appearanceDb'
import {
  DEFAULT_APPEARANCE_THEME,
  isAppearanceTheme,
  normalizeAppearanceTheme,
  type AppearanceTheme,
} from './appearanceTypes'

const GLOBAL_THEME_CACHE_KEY = 'drmvyz:appearance:theme:v1'
const USER_THEME_CACHE_PREFIX = 'drmvyz:appearance:user:v1:'
const CACHE_VERSION = 1

interface ThemeCacheEnvelope {
  version: typeof CACHE_VERSION
  theme: AppearanceTheme
  updatedAt: string
}

export interface AppearanceState {
  theme: AppearanceTheme
  currentUserId: string | null
  loading: boolean
  syncing: boolean
  error: string | null
  source: 'default' | 'local' | 'database'
  initializeForUser(userId: string): Promise<void>
  clearForSignedOut(): void
  setTheme(theme: AppearanceTheme): Promise<void>
  retrySync(): Promise<void>
}

let initializationGeneration = 0
let saveGeneration = 0

function userThemeCacheKey(userId: string): string {
  return `${USER_THEME_CACHE_PREFIX}${userId}`
}

function parseCache(raw: string | null): ThemeCacheEnvelope | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (
      !parsed
      || typeof parsed !== 'object'
      || !('version' in parsed)
      || !('theme' in parsed)
      || !('updatedAt' in parsed)
    ) return null
    const candidate = parsed as { version?: unknown; theme?: unknown; updatedAt?: unknown }
    if (
      candidate.version !== CACHE_VERSION
      || !isAppearanceTheme(candidate.theme)
      || typeof candidate.updatedAt !== 'string'
    ) return null
    return { version: CACHE_VERSION, theme: candidate.theme, updatedAt: candidate.updatedAt }
  } catch {
    return null
  }
}

function readCache(key: string): ThemeCacheEnvelope | null {
  if (typeof localStorage === 'undefined') return null
  try {
    return parseCache(localStorage.getItem(key))
  } catch {
    return null
  }
}

function writeCache(key: string, theme: AppearanceTheme, updatedAt = new Date().toISOString()): ThemeCacheEnvelope {
  const envelope: ThemeCacheEnvelope = { version: CACHE_VERSION, theme, updatedAt }
  if (typeof localStorage !== 'undefined') {
    try { localStorage.setItem(key, JSON.stringify(envelope)) } catch { /* local cache is best effort */ }
  }
  return envelope
}

function readInitialTheme(): { theme: AppearanceTheme; source: 'default' | 'local' } {
  const cached = readCache(GLOBAL_THEME_CACHE_KEY)
  return cached
    ? { theme: cached.theme, source: 'local' }
    : { theme: DEFAULT_APPEARANCE_THEME, source: 'default' }
}

function timestamp(value: string | null | undefined): number {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function applyAppearanceTheme(theme: AppearanceTheme): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.dataset.theme = theme
  root.style.colorScheme = theme === 'light' ? 'light' : 'dark'
}

export function bootstrapAppearanceTheme(): AppearanceTheme {
  const { theme } = readInitialTheme()
  applyAppearanceTheme(theme)
  return theme
}

const initial = readInitialTheme()

export const useAppearanceStore = create<AppearanceState>((set, get) => ({
  theme: initial.theme,
  currentUserId: null,
  loading: false,
  syncing: false,
  error: null,
  source: initial.source,

  async initializeForUser(userId) {
    const generation = ++initializationGeneration
    const userCache = readCache(userThemeCacheKey(userId))
    const immediateTheme = userCache?.theme ?? get().theme

    writeCache(GLOBAL_THEME_CACHE_KEY, immediateTheme, userCache?.updatedAt)
    applyAppearanceTheme(immediateTheme)
    set({
      currentUserId: userId,
      theme: immediateTheme,
      loading: true,
      syncing: true,
      error: null,
      source: userCache ? 'local' : get().source,
    })

    const remote = await readAppearanceTheme(userId)
    if (generation !== initializationGeneration || get().currentUserId !== userId) return

    if (remote.error) {
      set({ loading: false, syncing: false, error: remote.error })
      return
    }

    if (!remote.record || (userCache && timestamp(userCache.updatedAt) > timestamp(remote.record.updatedAt))) {
      const themeToSave = userCache?.theme ?? immediateTheme
      const saved = await saveAppearanceTheme(userId, themeToSave)
      if (generation !== initializationGeneration || get().currentUserId !== userId) return
      if (saved.error) {
        set({ loading: false, syncing: false, error: saved.error })
        return
      }
      const syncedAt = saved.record?.updatedAt ?? new Date().toISOString()
      writeCache(userThemeCacheKey(userId), themeToSave, syncedAt)
      writeCache(GLOBAL_THEME_CACHE_KEY, themeToSave, syncedAt)
      set({ theme: themeToSave, loading: false, syncing: false, error: null, source: 'database' })
      return
    }

    const remoteTheme = normalizeAppearanceTheme(remote.record.theme)
    const syncedAt = remote.record.updatedAt ?? new Date().toISOString()
    writeCache(userThemeCacheKey(userId), remoteTheme, syncedAt)
    writeCache(GLOBAL_THEME_CACHE_KEY, remoteTheme, syncedAt)
    applyAppearanceTheme(remoteTheme)
    set({ theme: remoteTheme, loading: false, syncing: false, error: null, source: 'database' })
  },

  clearForSignedOut() {
    initializationGeneration += 1
    saveGeneration += 1
    set({ currentUserId: null, loading: false, syncing: false, error: null })
  },

  async setTheme(theme) {
    // A direct user choice supersedes any in-flight startup hydration.
    initializationGeneration += 1
    const normalized = normalizeAppearanceTheme(theme)
    const userId = get().currentUserId
    const localRecord = writeCache(GLOBAL_THEME_CACHE_KEY, normalized)
    if (userId) writeCache(userThemeCacheKey(userId), normalized, localRecord.updatedAt)
    applyAppearanceTheme(normalized)
    set({ theme: normalized, loading: false, syncing: Boolean(userId), error: null, source: 'local' })

    if (!userId) return
    const generation = ++saveGeneration
    const saved = await saveAppearanceTheme(userId, normalized)
    if (generation !== saveGeneration || get().currentUserId !== userId || get().theme !== normalized) return

    if (saved.error) {
      set({ syncing: false, error: saved.error })
      return
    }

    const syncedAt = saved.record?.updatedAt ?? new Date().toISOString()
    writeCache(userThemeCacheKey(userId), normalized, syncedAt)
    writeCache(GLOBAL_THEME_CACHE_KEY, normalized, syncedAt)
    set({ syncing: false, error: null, source: 'database' })
  },

  async retrySync() {
    const { currentUserId, theme } = get()
    if (!currentUserId) return
    await get().setTheme(theme)
  },
}))

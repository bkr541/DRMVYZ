import { create } from 'zustand'
import {
  readContextualHelpPreference,
  saveContextualHelpPreference,
} from './contextualHelpDb'

const GLOBAL_CACHE_KEY = 'drmvyz:contextual-help:enabled:v1'
const USER_CACHE_PREFIX = 'drmvyz:contextual-help:user:v1:'
const CACHE_VERSION = 1

interface ContextualHelpCacheEnvelope {
  version: typeof CACHE_VERSION
  infoEnabled: boolean
  updatedAt: string
}

export interface ContextualHelpState {
  infoEnabled: boolean
  currentUserId: string | null
  loading: boolean
  syncing: boolean
  error: string | null
  source: 'default' | 'local' | 'database'
  initializeForUser(userId: string): Promise<void>
  clearForSignedOut(): void
  setInfoEnabled(infoEnabled: boolean): Promise<void>
  retrySync(): Promise<void>
}

let initializationGeneration = 0
let saveGeneration = 0

function userCacheKey(userId: string): string {
  return `${USER_CACHE_PREFIX}${userId}`
}

function parseCache(raw: string | null): ContextualHelpCacheEnvelope | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const candidate = parsed as {
      version?: unknown
      infoEnabled?: unknown
      updatedAt?: unknown
    }
    if (
      candidate.version !== CACHE_VERSION
      || typeof candidate.infoEnabled !== 'boolean'
      || typeof candidate.updatedAt !== 'string'
    ) return null

    return {
      version: CACHE_VERSION,
      infoEnabled: candidate.infoEnabled,
      updatedAt: candidate.updatedAt,
    }
  } catch {
    return null
  }
}

function readCache(key: string): ContextualHelpCacheEnvelope | null {
  if (typeof localStorage === 'undefined') return null
  try {
    return parseCache(localStorage.getItem(key))
  } catch {
    return null
  }
}

function writeCache(
  key: string,
  infoEnabled: boolean,
  updatedAt = new Date().toISOString(),
): ContextualHelpCacheEnvelope {
  const envelope: ContextualHelpCacheEnvelope = {
    version: CACHE_VERSION,
    infoEnabled,
    updatedAt,
  }
  if (typeof localStorage !== 'undefined') {
    try { localStorage.setItem(key, JSON.stringify(envelope)) } catch { /* best effort */ }
  }
  return envelope
}

function readInitialPreference(): {
  infoEnabled: boolean
  source: 'default' | 'local'
} {
  const cached = readCache(GLOBAL_CACHE_KEY)
  return cached
    ? { infoEnabled: cached.infoEnabled, source: 'local' }
    : { infoEnabled: true, source: 'default' }
}

function timestamp(value: string | null | undefined): number {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const initial = readInitialPreference()

export const useContextualHelpStore = create<ContextualHelpState>((set, get) => ({
  infoEnabled: initial.infoEnabled,
  currentUserId: null,
  loading: false,
  syncing: false,
  error: null,
  source: initial.source,

  async initializeForUser(userId) {
    const generation = ++initializationGeneration
    const userCache = readCache(userCacheKey(userId))
    const immediatePreference = userCache?.infoEnabled ?? true

    writeCache(GLOBAL_CACHE_KEY, immediatePreference, userCache?.updatedAt)
    set({
      currentUserId: userId,
      infoEnabled: immediatePreference,
      loading: true,
      syncing: true,
      error: null,
      source: userCache ? 'local' : 'default',
    })

    const remote = await readContextualHelpPreference(userId)
    if (generation !== initializationGeneration || get().currentUserId !== userId) return

    if (remote.error) {
      set({ loading: false, syncing: false, error: remote.error })
      return
    }

    if (!remote.record || (userCache && timestamp(userCache.updatedAt) > timestamp(remote.record.updatedAt))) {
      const preferenceToSave = userCache?.infoEnabled ?? immediatePreference
      const saved = await saveContextualHelpPreference(userId, preferenceToSave)
      if (generation !== initializationGeneration || get().currentUserId !== userId) return
      if (saved.error) {
        set({ loading: false, syncing: false, error: saved.error })
        return
      }

      const syncedAt = saved.record?.updatedAt ?? new Date().toISOString()
      writeCache(userCacheKey(userId), preferenceToSave, syncedAt)
      writeCache(GLOBAL_CACHE_KEY, preferenceToSave, syncedAt)
      set({
        infoEnabled: preferenceToSave,
        loading: false,
        syncing: false,
        error: null,
        source: 'database',
      })
      return
    }

    const remotePreference = remote.record.infoEnabled
    const syncedAt = remote.record.updatedAt ?? new Date().toISOString()
    writeCache(userCacheKey(userId), remotePreference, syncedAt)
    writeCache(GLOBAL_CACHE_KEY, remotePreference, syncedAt)
    set({
      infoEnabled: remotePreference,
      loading: false,
      syncing: false,
      error: null,
      source: 'database',
    })
  },

  clearForSignedOut() {
    initializationGeneration += 1
    saveGeneration += 1
    set({ currentUserId: null, loading: false, syncing: false, error: null })
  },

  async setInfoEnabled(infoEnabled) {
    // A direct user choice supersedes any in-flight startup hydration.
    initializationGeneration += 1
    const userId = get().currentUserId
    const localRecord = writeCache(GLOBAL_CACHE_KEY, infoEnabled)
    if (userId) writeCache(userCacheKey(userId), infoEnabled, localRecord.updatedAt)
    set({
      infoEnabled,
      loading: false,
      syncing: Boolean(userId),
      error: null,
      source: 'local',
    })

    if (!userId) return
    const generation = ++saveGeneration
    const saved = await saveContextualHelpPreference(userId, infoEnabled)
    if (
      generation !== saveGeneration
      || get().currentUserId !== userId
      || get().infoEnabled !== infoEnabled
    ) return

    if (saved.error) {
      set({ syncing: false, error: saved.error })
      return
    }

    const syncedAt = saved.record?.updatedAt ?? new Date().toISOString()
    writeCache(userCacheKey(userId), infoEnabled, syncedAt)
    writeCache(GLOBAL_CACHE_KEY, infoEnabled, syncedAt)
    set({ syncing: false, error: null, source: 'database' })
  },

  async retrySync() {
    const { currentUserId, infoEnabled } = get()
    if (!currentUserId) return
    await get().setInfoEnabled(infoEnabled)
  },
}))

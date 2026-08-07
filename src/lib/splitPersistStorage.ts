import type { PersistStorage, StorageValue } from 'zustand/middleware'

type PersistableState = object
type PersistableRecord = Record<string, unknown>

export type SplitPersistencePhase = 'dirty' | 'saving' | 'saved' | 'error'

export interface SplitPersistenceStatusEvent {
  phase: SplitPersistencePhase
  storageName: string
  error?: string
  lastSavedAt?: number
  retry?: () => Promise<boolean>
}

type SplitStorageOptions<S extends PersistableState> = {
  projectKeys: readonly (keyof S)[]
  databaseName?: string
  objectStoreName?: string
  onStatusChange?: (event: SplitPersistenceStatusEvent) => void
}

export interface SplitStorageValue<S extends PersistableState> {
  local: StorageValue<Partial<S>>
  project: StorageValue<Partial<S>>
  hasProjectData: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStorageValue<S extends PersistableState>(value: unknown): value is StorageValue<Partial<S>> {
  return isRecord(value) && isRecord(value.state)
}

/**
 * Splits one Zustand persistence envelope into a small local-preference envelope
 * and an IndexedDB project-data envelope. Exported for persistence regression tests.
 */
export function splitStorageValue<S extends PersistableState>(
  value: StorageValue<S> | StorageValue<Partial<S>>,
  projectKeys: readonly (keyof S)[],
): SplitStorageValue<S> {
  const projectKeySet = new Set<string>(projectKeys.map(String))
  const localState: Partial<S> = {}
  const projectState: Partial<S> = {}
  let hasProjectData = false

  for (const [key, fieldValue] of Object.entries(value.state)) {
    if (projectKeySet.has(key)) {
      ;(projectState as PersistableRecord)[key] = fieldValue
      hasProjectData = true
    } else {
      ;(localState as PersistableRecord)[key] = fieldValue
    }
  }

  return {
    local:   { state: localState,   version: value.version },
    project: { state: projectState, version: value.version },
    hasProjectData,
  }
}

/** Merges the two envelopes read from localStorage and IndexedDB. */
export function mergeStorageValues<S extends PersistableState>(
  local: StorageValue<Partial<S>> | null,
  project: StorageValue<Partial<S>> | null,
): StorageValue<S> | null {
  if (!local && !project) return null
  return {
    state: {
      ...(local?.state ?? {}),
      ...(project?.state ?? {}),
    } as S,
    version: local?.version ?? project?.version,
  }
}

function sameProjectReferences<S extends PersistableState>(
  a: Partial<S> | undefined,
  b: Partial<S>,
  projectKeys: readonly (keyof S)[],
): boolean {
  if (!a) return false
  return projectKeys.every(key => Object.is(a[key], b[key]))
}

/**
 * Creates a Zustand PersistStorage that keeps compact preferences in localStorage
 * and writes project-sized serializable data to IndexedDB using structured clone.
 *
 * The adapter also recognizes legacy all-in-localStorage snapshots. It first
 * copies their project fields into IndexedDB, then shrinks the local snapshot.
 */
export function createSplitPersistStorage<S extends PersistableState>({
  projectKeys,
  databaseName = 'drmvyz-project-state',
  objectStoreName = 'zustand-project-state',
  onStatusChange,
}: SplitStorageOptions<S>): PersistStorage<S, Promise<void>> {
  const indexedDbSupported = typeof indexedDB !== 'undefined'
  let databasePromise: Promise<IDBDatabase | null> | null = null
  const projectCache = new Map<string, StorageValue<Partial<S>>>()
  const localFallbackCache = new Map<string, string>()
  const lastProjectState = new Map<string, Partial<S>>()
  const lastLocalJson = new Map<string, string>()
  const writeChains = new Map<string, Promise<void>>()

  function openDatabase(): Promise<IDBDatabase | null> {
    if (databasePromise) return databasePromise
    if (!indexedDbSupported) {
      databasePromise = Promise.resolve(null)
      return databasePromise
    }

    databasePromise = new Promise(resolve => {
      let request: IDBOpenDBRequest
      try {
        request = indexedDB.open(databaseName, 1)
      } catch (error) {
        console.error('[splitPersistStorage] Unable to open IndexedDB', error)
        resolve(null)
        return
      }

      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(objectStoreName)) {
          db.createObjectStore(objectStoreName)
        }
      }
      request.onsuccess = () => {
        const db = request.result
        db.onversionchange = () => db.close()
        resolve(db)
      }
      request.onerror = () => {
        console.error('[splitPersistStorage] IndexedDB open failed', request.error)
        resolve(null)
      }
      request.onblocked = () => {
        console.warn('[splitPersistStorage] IndexedDB upgrade is blocked by another window')
      }
    })

    return databasePromise
  }

  async function readProject(name: string): Promise<StorageValue<Partial<S>> | null> {
    const cached = projectCache.get(name)
    if (cached) return cached

    const db = await openDatabase()
    if (!db) return null

    return new Promise(resolve => {
      try {
        const tx = db.transaction(objectStoreName, 'readonly')
        const request = tx.objectStore(objectStoreName).get(name)
        request.onsuccess = () => {
          const value = request.result
          if (isStorageValue<S>(value)) {
            projectCache.set(name, value)
            lastProjectState.set(name, value.state)
            resolve(value)
          } else {
            resolve(null)
          }
        }
        request.onerror = () => {
          console.error('[splitPersistStorage] IndexedDB read failed', request.error)
          resolve(null)
        }
      } catch (error) {
        console.error('[splitPersistStorage] IndexedDB read failed', error)
        resolve(null)
      }
    })
  }

  async function writeProjectNow(name: string, value: StorageValue<Partial<S>>): Promise<boolean> {
    const db = await openDatabase()
    // Node/unit-test environments have no IndexedDB. The in-memory cache still
    // exercises split persistence without polluting localStorage or test output.
    if (!db) return !indexedDbSupported

    return new Promise(resolve => {
      try {
        const tx = db.transaction(objectStoreName, 'readwrite')
        tx.objectStore(objectStoreName).put(value, name)
        tx.oncomplete = () => resolve(true)
        tx.onerror = () => {
          console.error('[splitPersistStorage] IndexedDB write failed', tx.error)
          resolve(false)
        }
        tx.onabort = () => {
          console.error('[splitPersistStorage] IndexedDB write aborted', tx.error)
          resolve(false)
        }
      } catch (error) {
        console.error('[splitPersistStorage] IndexedDB write failed', error)
        resolve(false)
      }
    })
  }

  function queueProjectWrite(name: string, value: StorageValue<Partial<S>>): Promise<boolean> {
    projectCache.set(name, value)
    const previous = writeChains.get(name) ?? Promise.resolve()
    let writeSucceeded = false
    const next = previous
      .catch(() => undefined)
      .then(async () => {
        writeSucceeded = await writeProjectNow(name, value)
      })
    writeChains.set(name, next)
    return next.then(() => writeSucceeded)
  }

  function reportFor(name: string, event: Omit<SplitPersistenceStatusEvent, 'storageName'>): void {
    onStatusChange?.({ ...event, storageName: name })
  }

  async function persistProject(
    name: string,
    value: StorageValue<Partial<S>>,
    announceDirty = true,
  ): Promise<boolean> {
    if (announceDirty) reportFor(name, { phase: 'dirty' })
    reportFor(name, { phase: 'saving' })
    const written = await queueProjectWrite(name, value)
    if (written) {
      lastProjectState.set(name, value.state)
      reportFor(name, { phase: 'saved', lastSavedAt: Date.now() })
      return true
    }

    lastProjectState.delete(name)
    const retry = () => persistProject(name, value, false)
    reportFor(name, {
      phase: 'error',
      error: 'Recent project edits could not be saved to IndexedDB.',
      retry,
    })
    console.error(`[splitPersistStorage] Project state for "${name}" was not persisted because IndexedDB is unavailable`)
    return false
  }

  async function removeProject(name: string): Promise<void> {
    projectCache.delete(name)
    lastProjectState.delete(name)
    const previous = writeChains.get(name) ?? Promise.resolve()
    const next = previous.catch(() => undefined).then(async () => {
      const db = await openDatabase()
      if (!db) return
      await new Promise<void>(resolve => {
        try {
          const tx = db.transaction(objectStoreName, 'readwrite')
          tx.objectStore(objectStoreName).delete(name)
          tx.oncomplete = () => resolve()
          tx.onerror = () => {
            console.error('[splitPersistStorage] IndexedDB delete failed', tx.error)
            resolve()
          }
          tx.onabort = () => resolve()
        } catch (error) {
          console.error('[splitPersistStorage] IndexedDB delete failed', error)
          resolve()
        }
      })
    })
    writeChains.set(name, next)
    await next
  }

  function readLocal(name: string): StorageValue<Partial<S>> | null {
    try {
      const raw = typeof localStorage === 'undefined'
        ? localFallbackCache.get(name) ?? null
        : localStorage.getItem(name)
      if (raw == null) return null
      const parsed: unknown = JSON.parse(raw)
      return isStorageValue<S>(parsed) ? parsed : null
    } catch (error) {
      console.warn(`[splitPersistStorage] Ignoring invalid local snapshot "${name}"`, error)
      return null
    }
  }

  function writeLocal(name: string, value: StorageValue<Partial<S>>): boolean {
    try {
      const json = JSON.stringify(value)
      if (lastLocalJson.get(name) === json) return true
      if (typeof localStorage === 'undefined') localFallbackCache.set(name, json)
      else localStorage.setItem(name, json)
      lastLocalJson.set(name, json)
      return true
    } catch (error) {
      console.error(`[splitPersistStorage] localStorage write failed for "${name}"`, error)
      return false
    }
  }

  return {
    getItem(name) {
      const local = readLocal(name)

      // Keep non-browser/unit-test hydration synchronous. This matches Zustand's
      // normal localStorage behaviour and prevents a later microtask from
      // overwriting state that a test or caller has already initialized.
      if (!indexedDbSupported) {
        return mergeStorageValues<S>(local, projectCache.get(name) ?? null)
      }

      return (async () => {
        // Legacy snapshots stored every field in localStorage. Move their project
        // fields first, and only shrink localStorage after the IndexedDB copy lands.
        if (local) {
          const legacySplit = splitStorageValue<S>(local, projectKeys)
          if (legacySplit.hasProjectData) {
            const migrated = await persistProject(name, legacySplit.project)
            if (migrated) {
              writeLocal(name, legacySplit.local)
            }
            return local as StorageValue<S>
          }
        }

        const project = await readProject(name)
        return mergeStorageValues<S>(local, project)
      })()
    },

    async setItem(name, value) {
      const split = splitStorageValue<S>(value, projectKeys)
      const localWritten = writeLocal(name, split.local)
      if (!localWritten) {
        reportFor(name, {
          phase: 'error',
          error: 'Workspace preferences could not be saved locally.',
          retry: async () => {
            const retried = writeLocal(name, split.local)
            if (retried) reportFor(name, { phase: 'saved', lastSavedAt: Date.now() })
            return retried
          },
        })
      }

      if (sameProjectReferences(lastProjectState.get(name), split.project.state, projectKeys)) {
        return
      }

      await persistProject(name, split.project)
    },

    async removeItem(name) {
      try {
        if (typeof localStorage === 'undefined') localFallbackCache.delete(name)
        else localStorage.removeItem(name)
        lastLocalJson.delete(name)
      } catch (error) {
        console.error(`[splitPersistStorage] localStorage delete failed for "${name}"`, error)
      }
      await removeProject(name)
    },
  }
}

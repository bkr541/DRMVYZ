import type { PersistStorage, StorageValue } from 'zustand/middleware'

/**
 * Account isolation for the locally persisted, user-authored stores (projects, shows, pads, user presets, shaders).
 *
 * Every such store saves through `scopeStorageToAccount`, which files its data under the signed-in account
 * (`<name>::account:<user id>`). Nothing is read or written while no account is signed in. Switching account resets each
 * registered store to its initial state and loads the new account's own data, so one account's work can never appear
 * in, or be saved into, another account on the same computer.
 *
 * Data saved before this existed sits under the old unscoped name. It is handed to exactly one account: the one that was
 * signed in on this computer when the update first ran (`recordLegacyOwner`). Any other account starts clean, and the
 * old data stays where it is until that owner signs in.
 *
 * Until the app enables account scoping (`enableAccountScopedPersistence`, called first thing by `main.tsx`) the storage
 * passes straight through to the unscoped name, as it always did. Unit tests and harnesses that never enable it keep
 * their existing behaviour.
 */

type Mode = 'device' | 'account'

const LEGACY_OWNER_KEY = 'drmvyz:local-data-owner:v1'

interface LegacyOwnerRecord {
  /** The account signed in on this computer when account scoping first ran, or null if nobody was. */
  userId: string | null
  recordedAt: string
  /** Storage names whose unscoped data has already been handed to the owner. */
  claimed: string[]
}

interface ScopedStoreApi {
  name: string
  reset: () => void
  rehydrate: () => Promise<void> | void
}

let mode: Mode = 'device'
let account: string | null = null
let generation = 0
let ready: Promise<boolean> = Promise.resolve(true)
/** The account whose data has finished loading into every scoped store (null while loading, or with no account). */
let loadedAccount: string | null = null
const stores = new Map<string, ScopedStoreApi>()

export function accountScopedStorageName(name: string, userId: string): string {
  return `${name}::account:${userId}`
}

function readLegacyOwner(): LegacyOwnerRecord | null {
  try {
    if (typeof localStorage === 'undefined') return null
    const raw = localStorage.getItem(LEGACY_OWNER_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<LegacyOwnerRecord>
    if (!parsed || typeof parsed !== 'object' || !('userId' in parsed)) return null
    return {
      userId: typeof parsed.userId === 'string' ? parsed.userId : null,
      recordedAt: typeof parsed.recordedAt === 'string' ? parsed.recordedAt : '',
      claimed: Array.isArray(parsed.claimed) ? parsed.claimed.filter((value): value is string => typeof value === 'string') : [],
    }
  } catch {
    return null
  }
}

function writeLegacyOwner(record: LegacyOwnerRecord): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(LEGACY_OWNER_KEY, JSON.stringify(record))
  } catch {
    // Without the record nobody can claim the unscoped data, which is the safe outcome.
  }
}

/**
 * Records, once per computer, which account owns the data saved before account scoping: the account whose session was
 * cached when the update first ran. A computer with no cached session records nobody, and its old data is never handed out.
 */
export function recordLegacyOwner(cachedUserId: string | null): void {
  if (readLegacyOwner()) return
  writeLegacyOwner({ userId: cachedUserId, recordedAt: new Date().toISOString(), claimed: [] })
}

function legacyOwnerFor(name: string): string | null {
  const record = readLegacyOwner()
  if (!record || record.userId === null || record.claimed.includes(name)) return null
  return record.userId
}

function markLegacyClaimed(name: string): void {
  const record = readLegacyOwner()
  if (!record || record.claimed.includes(name)) return
  writeLegacyOwner({ ...record, claimed: [...record.claimed, name] })
}

/** Turns account scoping on. `initialUserId` is the account expected to sign in (the cached session), or null. */
export function enableAccountScopedPersistence(initialUserId: string | null): void {
  recordLegacyOwner(initialUserId)
  mode = 'account'
  account = initialUserId
  loadedAccount = null
  trackReady(generation, initialUserId)
}

/** Marks `userId`'s data as loaded once `ready` resolves, unless another switch started first. */
function trackReady(trackedGeneration: number, userId: string | null): void {
  void ready.then(loaded => { if (loaded && trackedGeneration === generation && account === userId) loadedAccount = userId })
}

/** Back to unscoped storage. For tests that enabled scoping. */
export function disableAccountScopedPersistence(): void {
  mode = 'device'
  account = null
  loadedAccount = null
  generation += 1
  ready = Promise.resolve(true)
}

export function isAccountScopedPersistenceEnabled(): boolean {
  return mode === 'account'
}

/** The account whose data the scoped stores hold, or null (no account, or scoping off). */
export function getPersistenceAccount(): string | null {
  return mode === 'account' ? account : null
}

/**
 * Whether work for `userId` may read or write local, user-authored data right now: true when scoping is off, otherwise only
 * while that account's data is the one loaded.
 */
export function isPersistenceAccount(userId: string | null): boolean {
  return mode !== 'account' || (userId !== null && account === userId && loadedAccount === userId)
}

/**
 * Wraps a store's storage so its data is filed under the signed-in account. The account is read when each call is made, so
 * a write started for one account always lands under that account, even if the account changes before it completes.
 */
export function scopeStorageToAccount<S>(inner: PersistStorage<S, unknown>): PersistStorage<S, unknown> {
  type Read = StorageValue<S> | null
  const isPromise = (value: unknown): value is Promise<Read> => !!value && typeof (value as Promise<Read>).then === 'function'

  return {
    getItem(name) {
      if (mode !== 'account') return inner.getItem(name)
      const userId = account
      const requestedAt = generation
      if (!userId) return null
      // A read that finishes after the account changed must not load the previous account's data into the new one.
      const current = (value: Read): Read => (requestedAt === generation && account === userId ? value : null)
      const scopedName = accountScopedStorageName(name, userId)
      const claimLegacy = (scoped: Read): Read | Promise<Read> => {
        if (scoped || legacyOwnerFor(name) !== userId) return current(scoped)
        const legacy = inner.getItem(name)
        const adopt = async (value: Read): Promise<Read> => {
          if (!value) { markLegacyClaimed(name); return null }
          await inner.setItem(scopedName, value)
          await inner.removeItem(name)
          markLegacyClaimed(name)
          return current(value)
        }
        if (isPromise(legacy)) return legacy.then(adopt)
        if (!legacy) { markLegacyClaimed(name); return null }
        // Synchronous storage: hand the data over now, and finish moving it in the background.
        void adopt(legacy)
        return current(legacy)
      }
      const scoped = inner.getItem(scopedName)
      return isPromise(scoped) ? scoped.then(claimLegacy) : claimLegacy(scoped as Read)
    },
    setItem(name, value) {
      if (mode !== 'account') return inner.setItem(name, value)
      if (!account) return undefined
      return inner.setItem(accountScopedStorageName(name, account), value)
    },
    removeItem(name) {
      if (mode !== 'account') return inner.removeItem(name)
      if (!account) return undefined
      return inner.removeItem(accountScopedStorageName(name, account))
    },
  }
}

/** A persisted Zustand store whose saved data belongs to one account. */
interface PersistedZustandStore {
  getInitialState: () => unknown
  setState: (state: never, replace: true) => void
  persist: {
    rehydrate: () => Promise<void> | void
    hasHydrated: () => boolean
    onFinishHydration: (listener: () => void) => () => void
  }
}

function hydrated(store: PersistedZustandStore): Promise<void> {
  if (store.persist.hasHydrated()) return Promise.resolve()
  return new Promise(resolve => {
    const stop = store.persist.onFinishHydration(() => { stop(); resolve() })
  })
}

/**
 * Registers a store so an account switch resets it and loads the new account's data. The store's first load (from the
 * account expected at start-up) also counts toward `whenPersistenceAccountReady`.
 */
export function registerAccountScopedStore(name: string, store: PersistedZustandStore): void {
  stores.set(name, {
    name,
    reset: () => store.setState(store.getInitialState() as never, true),
    rehydrate: () => store.persist.rehydrate(),
  })
  if (mode === 'account') {
    const registeredAt = generation
    ready = Promise.all([ready, hydrated(store)]).then(([loaded]) => loaded && registeredAt === generation)
    loadedAccount = null
    trackReady(registeredAt, account)
  }
}

/**
 * Makes `userId` (or no account) the owner of the scoped stores. Each store is reset with writes switched off, so the reset
 * never overwrites anyone's saved data, then loads the new account's own data. Resolves true once that account's data is in
 * place, or false if another switch started first.
 */
export function switchPersistenceAccount(userId: string | null): Promise<boolean> {
  if (mode !== 'account') return Promise.resolve(true)
  if (userId === account) return ready
  const switchGeneration = ++generation
  loadedAccount = null
  account = null
  for (const store of stores.values()) store.reset()
  account = userId
  const loads = userId ? [...stores.values()].map(store => Promise.resolve(store.rehydrate())) : []
  ready = Promise.all(loads).then(() => switchGeneration === generation, () => switchGeneration === generation)
  trackReady(switchGeneration, userId)
  return ready
}

/**
 * Resolves true when `userId`'s data is loaded in the scoped stores (immediately when scoping is off), or false if the
 * account changed first. Anything that syncs local, user-authored data with the cloud waits for this.
 */
export async function whenPersistenceAccountReady(userId: string): Promise<boolean> {
  if (mode !== 'account') return true
  const loaded = await ready
  return loaded && account === userId
}

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { create } from 'zustand'
import { createJSONStorage, persist, type PersistStorage, type StorageValue } from 'zustand/middleware'
import {
  accountScopedStorageName,
  disableAccountScopedPersistence,
  enableAccountScopedPersistence,
  isPersistenceAccount,
  registerAccountScopedStore,
  scopeStorageToAccount,
  switchPersistenceAccount,
  whenPersistenceAccountReady,
} from './accountScopedPersistence'

const NAME = 'test:projects'
const OWNER_KEY = 'drmvyz:local-data-owner:v1'

interface Projects { projects: string[]; add: (name: string) => void }

function projectStore(storage: PersistStorage<unknown, unknown> = scopeStorageToAccount(createJSONStorage(() => localStorage)!)) {
  const store = create<Projects>()(persist(set => ({
    projects: [],
    add: name => set(state => ({ projects: [...state.projects, name] })),
  }), { name: NAME, storage: storage as never, partialize: state => ({ projects: state.projects }) as never }))
  registerAccountScopedStore(NAME, store as never)
  return store
}
const saved = (key: string) => JSON.parse(localStorage.getItem(key) ?? 'null')?.state?.projects ?? null

beforeEach(() => localStorage.clear())
afterEach(() => disableAccountScopedPersistence())

describe('account-scoped persistence', () => {
  it('passes straight through to the unscoped name until the app enables it', () => {
    const store = projectStore()
    store.getState().add('one')
    expect(saved(NAME)).toEqual(['one'])
  })

  it('files each account\'s data under that account and never shows one account\'s work to another', async () => {
    enableAccountScopedPersistence(null)
    const store = projectStore()
    await switchPersistenceAccount('user-a')
    store.getState().add('a-show')
    expect(saved(accountScopedStorageName(NAME, 'user-a'))).toEqual(['a-show'])

    await switchPersistenceAccount('user-b')
    expect(store.getState().projects).toEqual([])
    store.getState().add('b-show')

    await switchPersistenceAccount('user-a')
    expect(store.getState().projects).toEqual(['a-show'])
    expect(saved(accountScopedStorageName(NAME, 'user-b'))).toEqual(['b-show'])
    expect(saved(NAME)).toBeNull()
  })

  it('reads and writes nothing while no account is signed in, and the reset on sign-out never overwrites the account', async () => {
    enableAccountScopedPersistence(null)
    const store = projectStore()
    await switchPersistenceAccount('user-a')
    store.getState().add('a-show')
    await switchPersistenceAccount(null)
    expect(store.getState().projects).toEqual([])
    store.getState().add('typed while signed out')
    expect(saved(accountScopedStorageName(NAME, 'user-a'))).toEqual(['a-show'])
    expect(saved(NAME)).toBeNull()
  })

  it('hands data saved before scoping only to the account that was signed in when the update ran, and only once', async () => {
    localStorage.setItem(NAME, JSON.stringify({ state: { projects: ['legacy'] }, version: 0 }))
    // The update runs with user-a's session cached: user-a owns the old data and it loads straight into user-a's own space.
    enableAccountScopedPersistence('user-a')
    const store = projectStore()
    await whenPersistenceAccountReady('user-a')
    await Promise.resolve()
    expect(store.getState().projects).toEqual(['legacy'])
    expect(saved(accountScopedStorageName(NAME, 'user-a'))).toEqual(['legacy'])
    expect(saved(NAME)).toBeNull()
    expect(JSON.parse(localStorage.getItem(OWNER_KEY)!)).toMatchObject({ userId: 'user-a', claimed: [NAME] })

    // Any other account starts clean, and user-a's work comes back when user-a signs in again.
    await switchPersistenceAccount('user-b')
    expect(store.getState().projects).toEqual([])
    await switchPersistenceAccount('user-a')
    expect(store.getState().projects).toEqual(['legacy'])
  })

  it('leaves old data untouched for its owner while another account uses the computer', async () => {
    localStorage.setItem(NAME, JSON.stringify({ state: { projects: ['legacy'] }, version: 0 }))
    localStorage.setItem(OWNER_KEY, JSON.stringify({ userId: 'user-a', recordedAt: 'earlier', claimed: [] }))
    enableAccountScopedPersistence('user-b')
    const store = projectStore()
    await whenPersistenceAccountReady('user-b')
    expect(store.getState().projects).toEqual([])
    expect(saved(NAME)).toEqual(['legacy'])
    await switchPersistenceAccount('user-a')
    await Promise.resolve()
    expect(store.getState().projects).toEqual(['legacy'])
    expect(saved(NAME)).toBeNull()
  })

  it('never hands old data out when nobody was signed in at the update', async () => {
    localStorage.setItem(NAME, JSON.stringify({ state: { projects: ['legacy'] }, version: 0 }))
    enableAccountScopedPersistence(null)
    const store = projectStore()
    await switchPersistenceAccount('user-a')
    expect(store.getState().projects).toEqual([])
    expect(saved(NAME)).toEqual(['legacy'])
  })

  it('keeps the owner recorded the first time, whoever signs in later', () => {
    enableAccountScopedPersistence('user-a')
    disableAccountScopedPersistence()
    enableAccountScopedPersistence('user-b')
    expect(JSON.parse(localStorage.getItem(OWNER_KEY)!)).toMatchObject({ userId: 'user-a' })
  })

  it('drops a slow read for the previous account instead of loading it into the new one', async () => {
    const values = new Map<string, StorageValue<unknown>>()
    let releaseA: (() => void) | null = null
    const slow: PersistStorage<unknown, unknown> = {
      getItem: name => {
        const value = values.get(name) ?? null
        if (name !== accountScopedStorageName(NAME, 'user-a')) return value
        return new Promise(resolve => { releaseA = () => resolve(value) })
      },
      setItem: (name, value) => { values.set(name, value) },
      removeItem: name => { values.delete(name) },
    }
    values.set(accountScopedStorageName(NAME, 'user-a'), { state: { projects: ['a-secret'] }, version: 0 })
    enableAccountScopedPersistence(null)
    const store = projectStore(scopeStorageToAccount(slow))
    const loadingA = switchPersistenceAccount('user-a')
    await Promise.resolve()
    expect(await switchPersistenceAccount('user-b')).toBe(true)
    releaseA!()
    expect(await loadingA).toBe(false)
    await Promise.resolve()
    expect(store.getState().projects).toEqual([])
  })

  it('only reports an account ready, and only lets its sync work, once its data has finished loading', async () => {
    enableAccountScopedPersistence(null)
    projectStore()
    const loading = switchPersistenceAccount('user-a')
    expect(isPersistenceAccount('user-a')).toBe(false)
    await loading
    expect(isPersistenceAccount('user-a')).toBe(true)
    expect(isPersistenceAccount('user-b')).toBe(false)
    expect(await whenPersistenceAccountReady('user-a')).toBe(true)
    expect(await whenPersistenceAccountReady('user-b')).toBe(false)
  })
})

import { create } from 'zustand'
import { cinema2TextRepository, type Cinema2TextRepository } from './cinema2TextDb'
import {
  emptyTextLibrary, isCinema2TextPreset, textContentError, validateTextParameters,
  type Cinema2SavedText, type Cinema2TextPool, type Cinema2TextMembership, type Cinema2TextLibraryData, type Cinema2TextPresetId,
} from '../../components/vyzualz/cinema2/text/Cinema2TextConfiguration'

const cacheKey = (userId: string) => `drmvyz:cinema2-text:v1:${userId}`
const uuid = (id: unknown): id is string => typeof id === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)
const validName = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 100
const membershipKey = (item: Cinema2TextMembership) => `${item.poolId}:${item.recordId}`
const count = (data: Cinema2TextLibraryData) => data.records.length + data.pools.length + data.memberships.length
const message = (error: unknown) => error instanceof Error ? error.message : 'Text scene library could not be synchronized.'

/** Validate cached/network data before it can enter the library or the live runtime. */
export function parseTextLibrary(input: unknown): Cinema2TextLibraryData {
  const data = input as Cinema2TextLibraryData | null
  if (!data || !Array.isArray(data.records) || !Array.isArray(data.pools) || !Array.isArray(data.memberships)) throw new Error('Invalid text scene library data.')
  const records = data.records.map(record => {
    if (!record || !uuid(record.id) || !isCinema2TextPreset(record.presetId) || !validName(record.name) || record.schemaVersion !== 1 || !Number.isFinite(Date.parse(record.createdAt))) throw new Error('Invalid text scene.')
    return { ...record, parameters: validateTextParameters(record.presetId, record.parameters) }
  })
  const pools = data.pools.map(pool => {
    if (!pool || !uuid(pool.id) || !isCinema2TextPreset(pool.presetId) || !validName(pool.name) || !Number.isFinite(Date.parse(pool.createdAt))) throw new Error('Invalid text pool.')
    return { ...pool }
  })
  const memberships = data.memberships.map(item => {
    if (!item || !uuid(item.poolId) || !uuid(item.recordId) || !isCinema2TextPreset(item.presetId)) throw new Error('Invalid text pool membership.')
    return { ...item }
  })
  return { records, pools, memberships }
}
function merge(remote: Cinema2TextLibraryData, local: Cinema2TextLibraryData): Cinema2TextLibraryData {
  return {
    records: [...new Map([...remote.records, ...local.records].map(item => [item.id, item])).values()],
    pools: [...new Map([...remote.pools, ...local.pools].map(item => [item.id, item])).values()],
    memberships: [...new Map([...remote.memberships, ...local.memberships].map(item => [membershipKey(item), item])).values()],
  }
}
interface TextLibraryState {
  userId: string | null
  data: Cinema2TextLibraryData
  pending: Cinema2TextLibraryData
  syncing: boolean
  error: string | null
  initializeForUser(userId: string): Promise<void>
  clearForSignedOut(): void
  sync(): Promise<void>
  save(presetId: Cinema2TextPresetId, name: string, parameters: unknown): Cinema2SavedText
  createPool(presetId: Cinema2TextPresetId, name: string): Cinema2TextPool
  addToPool(poolId: string, recordId: string): void
}

export function createCinema2TextLibraryStore(repository: Cinema2TextRepository = cinema2TextRepository) {
  let generation = 0
  let inFlight: { generation: number; promise: Promise<void> } | null = null
  return create<TextLibraryState>((set, get) => {
    const commit = (data: Cinema2TextLibraryData, pending: Cinema2TextLibraryData) => {
      const userId = get().userId
      if (!userId) throw new Error('Sign in to save text scenes.')
      // Write before acknowledging Save. A full/unavailable cache must never silently lose pending changes.
      localStorage.setItem(cacheKey(userId), JSON.stringify({ version: 1, data, pending }))
      set({ data, pending })
    }
    const add = (patch: Cinema2TextLibraryData) => {
      commit(merge(get().data, patch), merge(get().pending, patch))
      void get().sync()
    }
    return {
      userId: null, data: emptyTextLibrary(), pending: emptyTextLibrary(), syncing: false, error: null,
      async initializeForUser(userId) {
        if (get().userId === userId) { await get().sync(); return }
        generation += 1
        let data = emptyTextLibrary(), pending = emptyTextLibrary(), error: string | null = null
        try {
          const raw = localStorage.getItem(cacheKey(userId))
          if (raw) {
            const cached = JSON.parse(raw)
            if (cached.version !== 1) throw new Error('Unsupported text scene library cache.')
            data = parseTextLibrary(cached.data)
            pending = parseTextLibrary(cached.pending)
          }
        } catch (cause) { error = message(cause) }
        set({ userId, data, pending, error, syncing: false })
        await get().sync()
      },
      clearForSignedOut() {
        generation += 1
        set({ userId: null, data: emptyTextLibrary(), pending: emptyTextLibrary(), syncing: false, error: null })
      },
      async sync() {
        const userId = get().userId
        if (!userId) return
        const token = generation
        if (inFlight?.generation === token) return inFlight.promise
        const current = () => generation === token && get().userId === userId
        set({ syncing: true, error: null })
        const promise = (async () => {
          try {
            do {
              const pending = get().pending
              await repository.insertRecords(userId, pending.records)
              if (!current()) return
              await repository.insertPools(userId, pending.pools)
              if (!current()) return
              await repository.insertMemberships(userId, pending.memberships)
              if (!current()) return
              commit(get().data, {
                records: get().pending.records.filter(item => !pending.records.some(saved => saved.id === item.id)),
                pools: get().pending.pools.filter(item => !pending.pools.some(saved => saved.id === item.id)),
                memberships: get().pending.memberships.filter(item => !pending.memberships.some(saved => membershipKey(saved) === membershipKey(item))),
              })
              const remote = parseTextLibrary(await repository.load(userId))
              if (!current()) return
              commit(merge(remote, get().pending), get().pending)
            } while (current() && count(get().pending) > 0)
          } catch (cause) {
            if (current()) set({ error: `Using local text scene library. ${message(cause)} Changes waiting to sync will retry when connected.` })
          } finally {
            if (current()) set({ syncing: false })
            if (inFlight?.generation === token) inFlight = null
          }
        })()
        inFlight = { generation: token, promise }
        return promise
      },
      save(presetId, name, input) {
        if (!validName(name)) throw new Error('Enter a name of up to 100 characters.')
        const parameters = validateTextParameters(presetId, input)
        const error = textContentError(presetId, parameters)
        if (error) throw new Error(error)
        const record: Cinema2SavedText = { id: crypto.randomUUID(), presetId, name: name.trim(), schemaVersion: 1, parameters, createdAt: new Date().toISOString() }
        add({ ...emptyTextLibrary(), records: [record] })
        return record
      },
      createPool(presetId, name) {
        if (!validName(name)) throw new Error('Enter a pool name of up to 100 characters.')
        const pool = { id: crypto.randomUUID(), presetId, name: name.trim(), createdAt: new Date().toISOString() }
        add({ ...emptyTextLibrary(), pools: [pool] })
        return pool
      },
      addToPool(poolId, recordId) {
        const pool = get().data.pools.find(item => item.id === poolId)
        const record = get().data.records.find(item => item.id === recordId)
        if (!pool || !record || pool.presetId !== record.presetId) throw new Error('The pool and text must belong to the same preset.')
        if (get().data.memberships.some(item => item.poolId === poolId && item.recordId === recordId)) return
        add({ ...emptyTextLibrary(), memberships: [{ poolId, recordId, presetId: pool.presetId }] })
      },
    }
  })
}
export const useCinema2TextLibraryStore = createCinema2TextLibraryStore()

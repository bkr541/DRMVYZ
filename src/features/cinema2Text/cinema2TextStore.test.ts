import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCinema2TextLibraryStore } from './cinema2TextStore'
import type { Cinema2TextRepository } from './cinema2TextDb'
import { emptyTextLibrary, createTextDraft, textParameters, type Cinema2TextLibraryData } from '../../components/vyzualz/cinema2/text/Cinema2TextConfiguration'

function values() {
  const draft = createTextDraft('drmvyz.cinema2.say-it')
  draft.setPersistentValues({ 'say-it-text': 'WELCOME' })
  return textParameters('drmvyz.cinema2.say-it', draft)
}
function repository() {
  const users = new Map<string, Cinema2TextLibraryData>()
  const data = (user: string) => { if (!users.has(user)) users.set(user, emptyTextLibrary()); return users.get(user)! }
  return {
    load: vi.fn(async (user: string) => structuredClone(data(user))),
    insertRecords: vi.fn(async (user, records) => { for (const item of records) if (!data(user).records.some(saved => saved.id === item.id)) data(user).records.push(item) }),
    insertPools: vi.fn(async (user, pools) => { for (const item of pools) if (!data(user).pools.some(saved => saved.id === item.id)) data(user).pools.push(item) }),
    insertMemberships: vi.fn(async (user, members) => { for (const item of members) if (!data(user).memberships.some(saved => saved.poolId === item.poolId && saved.recordId === item.recordId)) data(user).memberships.push(item) }),
  } satisfies Cinema2TextRepository
}
beforeEach(() => localStorage.clear())
describe('account-owned Cinema 2.0 text scene library', () => {
  it('syncs named records, pools and idempotent membership across devices', async () => {
    const db = repository(), first = createCinema2TextLibraryStore(db), second = createCinema2TextLibraryStore(db)
    await first.getState().initializeForUser('alice')
    const record = first.getState().save('drmvyz.cinema2.say-it', 'Welcome', values())
    const pool = first.getState().createPool('drmvyz.cinema2.say-it', 'Opening set')
    first.getState().addToPool(pool.id, record.id)
    first.getState().addToPool(pool.id, record.id)
    await first.getState().sync()
    await second.getState().initializeForUser('alice')
    expect(second.getState().data.records).toEqual([record])
    expect(second.getState().data.pools).toEqual([pool])
    expect(second.getState().data.memberships).toHaveLength(1)
    expect(first.getState().pending).toEqual(emptyTextLibrary())
  })

  it('keeps unsynced changes through restart, retries offline writes, and merges another device additions', async () => {
    const db = repository(), first = createCinema2TextLibraryStore(db)
    await first.getState().initializeForUser('alice')
    const remoteRecord = first.getState().save('drmvyz.cinema2.say-it', 'Remote', values())
    await first.getState().sync()
    db.insertRecords.mockRejectedValue(new Error('Offline'))
    const localRecord = first.getState().save('drmvyz.cinema2.say-it', 'Local', values())
    await first.getState().sync()
    expect(first.getState().error).toContain('waiting to sync')
    const restarted = createCinema2TextLibraryStore(db)
    await restarted.getState().initializeForUser('alice')
    expect(restarted.getState().data.records.map(record => record.id)).toContain(localRecord.id)
    expect(restarted.getState().pending.records).toHaveLength(1)
    db.insertRecords.mockImplementation(async (user: string, records: Cinema2TextLibraryData['records']) => {
      const remote: Cinema2TextLibraryData = await db.load(user)
      // replace fake loader with merged server state for the restored device
      db.load.mockResolvedValue({ ...remote, records: [...remote.records, ...records.filter(item => !remote.records.some(saved => saved.id === item.id))] })
    })
    await restarted.getState().sync()
    expect(restarted.getState().pending.records).toHaveLength(0)
    expect(restarted.getState().data.records.map(record => record.id)).toEqual(expect.arrayContaining([remoteRecord.id, localRecord.id]))
  })

  it('does not reveal another account cache or apply a late request after sign-out', async () => {
    const db = repository(), store = createCinema2TextLibraryStore(db)
    await store.getState().initializeForUser('alice')
    store.getState().save('drmvyz.cinema2.say-it', 'Private', values())
    await store.getState().sync()
    let finish!: (data: Cinema2TextLibraryData) => void
    db.load.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const loading = store.getState().sync()
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
    store.getState().clearForSignedOut()
    await store.getState().initializeForUser('bob')
    finish({ ...emptyTextLibrary(), records: [{ id: crypto.randomUUID(), name: 'Private', presetId: 'drmvyz.cinema2.say-it', schemaVersion: 1, parameters: values(), createdAt: new Date().toISOString() }] })
    await loading
    expect(store.getState().userId).toBe('bob')
    expect(store.getState().data).toEqual(emptyTextLibrary())
  })

  it('rejects cross-preset pools, unnamed entries, and failures to persist pending data', async () => {
    const store = createCinema2TextLibraryStore(repository())
    await store.getState().initializeForUser('alice')
    const record = store.getState().save('drmvyz.cinema2.say-it', 'Welcome', values())
    const pool = store.getState().createPool('drmvyz.cinema2.marquee', 'Theater')
    expect(() => store.getState().addToPool(pool.id, record.id)).toThrow('same preset')
    expect(() => store.getState().save('drmvyz.cinema2.say-it', ' ', values())).toThrow('name')
    await store.getState().sync()
    const before = store.getState().data.records.length
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('Cache full') })
    expect(() => store.getState().save('drmvyz.cinema2.say-it', 'Unsaved', values())).toThrow('Cache full')
    expect(store.getState().data.records).toHaveLength(before)
    spy.mockRestore()
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createShowManagerShow } from '../components/vyzualz/showManager/ShowManagerDomain'
import type { ReactPerformancePad } from '../components/vyzualz/react/ReactTypes'
import { PerformancePadSync, type PadSyncState } from '../features/performancePads/PerformancePadSync'
import {
  accountScopedStorageName,
  disableAccountScopedPersistence,
  enableAccountScopedPersistence,
  isPersistenceAccount,
  switchPersistenceAccount,
} from '../lib/accountScopedPersistence'

// Cloud Show calls are stubbed: the test only asks whether anything would be uploaded, and for which account.
const cloud = vi.hoisted(() => ({ listUserId: '', saved: [] as string[] }))
vi.mock('../lib/showManagerDb', async importOriginal => {
  const actual = await importOriginal<typeof import('../lib/showManagerDb')>()
  return {
    ...actual,
    listShowManagerCloudBundles: vi.fn(async () => ({ ok: true, mode: 'cloud', bundles: [], userId: cloud.listUserId })),
    saveShowManagerCloudBundle: vi.fn(async (bundle: { show: { name: string } }) => { cloud.saved.push(bundle.show.name); return { ok: false, message: 'not in this test' } }),
  }
})

const { useReactStore } = await import('./reactStore')
const { useVisualStore } = await import('./visualStore')

const REACT_STORE = 'drmvyz:react-store'
// Fresh account ids per test: the project store keeps an in-memory copy of what each account saved.
let run = 0
let A = 'user-a', B = 'user-b'

function customisePads(label: string): ReactPerformancePad[] {
  const pads = useReactStore.getState().performancePads.map((pad, index) => index === 0 ? { ...pad, label } : pad)
  useReactStore.setState({ performancePads: pads })
  return pads
}
function addShow(name: string) {
  const show = createShowManagerShow({ name, linkedAudioTrackId: `track-${name}` } as never)!
  useReactStore.setState(state => ({ showManagerShows: [...state.showManagerShows, show] }))
}
const showNames = () => useReactStore.getState().showManagerShows.map(show => show.name)
const firstPadLabel = () => useReactStore.getState().performancePads[0]?.label

beforeEach(async () => {
  localStorage.clear()
  cloud.saved = []
  run += 1
  A = `user-a-${run}`; B = `user-b-${run}`
  cloud.listUserId = B
  enableAccountScopedPersistence(null)
  await switchPersistenceAccount(null)
})
afterEach(() => disableAccountScopedPersistence())

describe('two accounts on one computer (SEC-01, SEC-02)', () => {
  it('keeps each account\'s projects, Shows, pads and presets to itself across sign-in, sign-out and switching back', async () => {
    const defaultPadLabel = firstPadLabel()

    await switchPersistenceAccount(A)
    addShow('A private show')
    customisePads('A kick pad')
    useVisualStore.setState({ presets: [...useVisualStore.getState().presets, { id: 'a-preset', name: 'A preset', isDefault: false } as never] })

    // Sign out: nothing of A's stays in memory.
    await switchPersistenceAccount(null)
    expect(showNames()).toEqual([])
    expect(firstPadLabel()).toBe(defaultPadLabel)

    // B signs in on the same computer and sees none of A's work.
    await switchPersistenceAccount(B)
    expect(showNames()).toEqual([])
    expect(firstPadLabel()).toBe(defaultPadLabel)
    expect(useVisualStore.getState().presets.some(preset => preset.id === 'a-preset')).toBe(false)
    addShow('B show')
    customisePads('B snare pad')

    // A signs back in and finds exactly A's work.
    await switchPersistenceAccount(A)
    expect(showNames()).toEqual(['A private show'])
    expect(firstPadLabel()).toBe('A kick pad')
    expect(useVisualStore.getState().presets.some(preset => preset.id === 'a-preset')).toBe(true)

    // On disk, each account's data is filed under its own key, and nothing went to the old shared key.
    const filedA = localStorage.getItem(accountScopedStorageName(REACT_STORE, A)) ?? ''
    const filedB = localStorage.getItem(accountScopedStorageName(REACT_STORE, B)) ?? ''
    expect(filedA).toContain('A kick pad')
    expect(filedA).not.toContain('B snare pad')
    expect(filedB).toContain('B snare pad')
    expect(filedB).not.toContain('A kick pad')
    expect(localStorage.getItem(REACT_STORE)).toBeNull()
  })

  it('never uploads one account\'s local Shows into another account\'s empty cloud library', async () => {
    await switchPersistenceAccount(A)
    addShow('A private show')
    // The cloud session now belongs to B (the account changed), while A's local library is still the one loaded.
    cloud.listUserId = B
    expect(await useReactStore.getState().loadShowManagerShowsFromCloud()).toBe(false)
    expect(cloud.saved).toEqual([])

    // Once B's own (empty) library is loaded, B's migration has nothing of A's to upload.
    await switchPersistenceAccount(B)
    await useReactStore.getState().loadShowManagerShowsFromCloud()
    expect(cloud.saved).toEqual([])
  })

  it('never pushes the previous account\'s pads into the next account\'s cloud set, and never overwrites them with it', async () => {
    await switchPersistenceAccount(A)
    const padsA = customisePads('A kick pad')
    const savedSets: string[][] = []
    let applied: ReactPerformancePad[] | null = null
    let state: PadSyncState = { revision: 0, syncedFingerprint: '' }
    // B's sync, started while A's pads are still the ones in memory (for example straight after B signs in).
    const syncB = new PerformancePadSync({
      fetchRemote: async () => null,
      save: async pads => { savedSets.push(pads.map(pad => pad.label)); return 1 },
      getLocalPads: () => useReactStore.getState().performancePads,
      applyRemotePads: pads => { applied = pads },
      subscribeLocalPads: listener => useReactStore.subscribe(listener),
      readState: () => state,
      writeState: next => { state = next },
      backupLocalPads: () => undefined,
      ownsLocalPads: () => isPersistenceAccount(B),
      setTimer: () => 0, clearTimer: () => undefined,
    })
    await syncB.start(); await syncB.idle()
    expect(savedSets).toEqual([])
    expect(useReactStore.getState().performancePads).toEqual(padsA)

    // After the switch, B's sync works on B's own pads only (the stock set, which it never pushes).
    await switchPersistenceAccount(B)
    await syncB.refresh(); await syncB.idle()
    expect(savedSets).toEqual([])
    expect(applied).toBeNull()
    syncB.dispose()
  })
})

import { describe, expect, it } from 'vitest'
import { DEFAULT_PERFORMANCE_PADS, type ReactPerformancePad } from '../../components/vyzualz/react/ReactTypes'
import { PerformancePadSync, StalePadRevisionError, type PadSyncState, type RemotePadSet } from './PerformancePadSync'
import { DEFAULT_PAD_SET_FINGERPRINT, isMobileUsablePad, padSetFingerprint, sanitizePad, sanitizePadSet } from './performancePadSets'

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T
const custom = (label: string): ReactPerformancePad[] => DEFAULT_PERFORMANCE_PADS.map((pad, index) => index === 0 ? { ...clone(pad), label } : clone(pad))

function harness(local: ReactPerformancePad[], remote: RemotePadSet | null, state: PadSyncState = { revision: 0, syncedFingerprint: '' }) {
  const h = {
    local, remote, state, saves: [] as { pads: ReactPerformancePad[]; base: number }[], backups: [] as ReactPerformancePad[][], applied: [] as ReactPerformancePad[][],
    listener: () => {}, errors: [] as unknown[], timers: [] as (() => void)[],
  }
  const sync = new PerformancePadSync({
    fetchRemote: async () => h.remote ? clone(h.remote) : null,
    save: async (pads, _schema, base) => {
      h.saves.push({ pads: clone(pads), base })
      const current = h.remote?.revision ?? 0
      if (base !== current) throw new StalePadRevisionError()
      h.remote = { pads: clone(pads), revision: current + 1, schemaVersion: 1 }
      return current + 1
    },
    getLocalPads: () => h.local,
    applyRemotePads: pads => { h.local = clone(pads); h.applied.push(clone(pads)); h.listener() },
    subscribeLocalPads: listener => { h.listener = listener; return () => { h.listener = () => {} } },
    readState: () => h.state,
    writeState: next => { h.state = next },
    backupLocalPads: pads => h.backups.push(clone(pads)),
    onError: error => h.errors.push(error),
    setTimer: cb => { h.timers.push(cb); return h.timers.length },
    clearTimer: () => {},
  })
  return { h, sync, flush: async () => { while (h.timers.length) h.timers.shift()!(); await sync.idle() } }
}

describe('sanitizePadSet', () => {
  it('accepts the stock pads and keeps only known fields', () => {
    const pads = sanitizePadSet([...DEFAULT_PERFORMANCE_PADS, { ...DEFAULT_PERFORMANCE_PADS[0], id: 'pad-99', extra: 'x' }])
    expect(pads).not.toBeNull()
    expect(pads!.every(pad => !('extra' in pad))).toBe(true)
  })
  it('rejects malformed, duplicated, empty and oversized sets', () => {
    expect(sanitizePadSet([])).toBeNull()
    expect(sanitizePadSet('nope')).toBeNull()
    expect(sanitizePadSet([DEFAULT_PERFORMANCE_PADS[0], DEFAULT_PERFORMANCE_PADS[0]])).toBeNull()
    expect(sanitizePadSet([{ ...DEFAULT_PERFORMANCE_PADS[0], id: '../x' }])).toBeNull()
    expect(sanitizePadSet([{ ...DEFAULT_PERFORMANCE_PADS[0], label: 'x'.repeat(200) }])).toBeNull()
    expect(sanitizePadSet(Array.from({ length: 65 }, (_, i) => ({ ...DEFAULT_PERFORMANCE_PADS[0], id: `pad-${i + 1}` })))).toBeNull()
    expect(sanitizePad({ ...DEFAULT_PERFORMANCE_PADS[0], destination: { schemaVersion: 2, engineId: 'cinema2', presetId: 'x' } })).toBeNull()
  })
  it('fingerprints content, not identity', () => {
    expect(padSetFingerprint(clone(DEFAULT_PERFORMANCE_PADS))).toBe(DEFAULT_PAD_SET_FINGERPRINT)
    expect(padSetFingerprint(custom('Changed'))).not.toBe(DEFAULT_PAD_SET_FINGERPRINT)
  })
  it('treats only Cinema 2.0 destinations as performable on a phone', () => {
    const base = DEFAULT_PERFORMANCE_PADS[0]
    expect(isMobileUsablePad({ ...base, destination: { schemaVersion: 1, engineId: 'cinema2', presetId: 'a' } })).toBe(true)
    expect(isMobileUsablePad({ ...base, destination: { schemaVersion: 1, engineId: 'canvas', presetId: 'a' } })).toBe(false)
    expect(isMobileUsablePad({ ...base, destination: null })).toBe(false)
  })
})

describe('PerformancePadSync', () => {
  it('pushes customised pads when the cloud has none', async () => {
    const { h, sync, flush } = harness(custom('Mine'), null)
    await sync.start(); await flush()
    expect(h.saves).toHaveLength(1)
    expect(h.saves[0].base).toBe(0)
    expect(h.state.revision).toBe(1)
  })
  it('never pushes the stock pads from a fresh device', async () => {
    const { h, sync } = harness(clone(DEFAULT_PERFORMANCE_PADS), null)
    await sync.start()
    expect(h.saves).toHaveLength(0)
  })
  it('a fresh phone takes the desktop pads and backs nothing up', async () => {
    const cloud = custom('Desktop')
    const { h, sync } = harness(clone(DEFAULT_PERFORMANCE_PADS), { pads: cloud, revision: 3, schemaVersion: 1 })
    await sync.start()
    expect(h.local[0].label).toBe('Desktop')
    expect(h.state.revision).toBe(3)
    expect(h.backups).toHaveLength(0)
    expect(h.saves).toHaveLength(0)
  })
  it('applying cloud pads does not push them back', async () => {
    const { h, sync, flush } = harness(clone(DEFAULT_PERFORMANCE_PADS), { pads: custom('Desktop'), revision: 2, schemaVersion: 1 })
    await sync.start(); await flush()
    expect(h.saves).toHaveLength(0)
  })
  it('debounces edits and saves against the last revision', async () => {
    const cloud = custom('A')
    const { h, sync, flush } = harness(clone(cloud), { pads: cloud, revision: 4, schemaVersion: 1 }, { revision: 4, syncedFingerprint: padSetFingerprint(cloud) })
    await sync.start()
    h.local = custom('B'); h.listener(); h.local = custom('C'); h.listener()
    expect(h.timers.length).toBe(2)
    await flush()
    expect(h.saves).toHaveLength(1) // the harness cannot cancel the first timer, but the second finds nothing new to save
    expect(h.saves.at(-1)!.pads[0].label).toBe('C')
    expect(h.state.revision).toBe(5)
  })
  it('keeps the cloud set and backs up local edits when another device saved first', async () => {
    const synced = custom('Base')
    const { h, sync } = harness(custom('Offline edit'), { pads: custom('Other device'), revision: 7, schemaVersion: 1 }, { revision: 6, syncedFingerprint: padSetFingerprint(synced) })
    await sync.start()
    expect(h.local[0].label).toBe('Other device')
    expect(h.backups).toHaveLength(1)
    expect(h.backups[0][0].label).toBe('Offline edit')
    expect(h.state.revision).toBe(7)
  })
  it('recovers from a stale save by taking the cloud set', async () => {
    const base = custom('Base')
    const { h, sync, flush } = harness(clone(base), { pads: base, revision: 1, schemaVersion: 1 }, { revision: 1, syncedFingerprint: padSetFingerprint(base) })
    await sync.start()
    h.local = custom('Mine'); h.listener()
    h.remote = { pads: custom('Theirs'), revision: 2, schemaVersion: 1 }
    await flush()
    expect(h.local[0].label).toBe('Theirs')
    expect(h.backups[0][0].label).toBe('Mine')
    expect(h.state.revision).toBe(2)
  })
  it('ignores an unusable cloud set and reports save errors instead of throwing', async () => {
    const { h, sync } = harness(custom('Mine'), { pads: 'garbage', revision: 5, schemaVersion: 1 })
    await sync.start()
    expect(h.saves[0].base).toBe(5)
    const failing = harness(custom('Mine'), null)
    failing.sync['deps'].save = async () => { throw new Error('offline') }
    await failing.sync.start()
    expect(failing.h.errors).toHaveLength(1)
  })
  it('stops pushing after dispose', async () => {
    const { h, sync, flush } = harness(clone(DEFAULT_PERFORMANCE_PADS), null)
    await sync.start()
    sync.dispose()
    h.local = custom('Late'); h.listener(); await flush()
    expect(h.saves).toHaveLength(0)
  })
})

import { describe, expect, it } from 'vitest'
import { Cinema2EverywherePool, EVERYWHERE_POOL_SLOTS, everywherePoolTrigger } from '../modules/everywhere/Cinema2EverywherePool'
import type { Cinema2MediaPoolSource } from '../media/Cinema2MediaPoolSource'
import type { Cinema2MediaSlotRuntime, Cinema2MediaSource } from '../media/Cinema2MediaSlotRuntime'

const sourceFor = (id: string): Cinema2MediaSource => ({ id, label: id, kind: 'image', url: `https://example.test/${id}.png` })
const flush = async () => { for (let i=0; i<12; i++) await Promise.resolve() }
function fixture() {
  let selection: ReturnType<Cinema2MediaPoolSource['getSelection']> = { id: 'p', mediaIds: ['a','b','c','d','e'] }
  let resolve = async (id: string): Promise<Cinema2MediaSource | null> => sourceFor(id)
  const resources = new Map<string, { source: Cinema2MediaSource }>()
  const replacements: string[] = []
  const pauses: boolean[] = []
  const slots = {
    remove: (slot: string) => resources.delete(slot),
    replace: async (slot: string, source: Cinema2MediaSource) => { replacements.push(source.id); resources.set(slot,{source}) },
    getManagedResource: (slot: string) => resources.get(slot) ?? null,
    updateVideoTextures: (paused: boolean) => pauses.push(paused),
    dispose: () => resources.clear(),
  } as unknown as Cinema2MediaSlotRuntime
  const pool = new Cinema2EverywherePool({ getSelection: () => selection, resolve: id => resolve(id) },slots)
  return { pool, replacements, pauses, select: (next: typeof selection) => { selection=next }, resolver: (fn: typeof resolve) => { resolve=fn }, resources }
}

describe('EVERYWHERE media pools', () => {
  it('uses three channels, advances one channel per unique shared event, and holds when there is no event', async () => {
    const f=fixture()
    f.pool.update('track', 'initial', true, false, false); await flush()
    expect(f.replacements).toEqual(['a','b','c'])
    f.pool.update('track','initial',false,false,false); await flush()
    expect(f.replacements).toHaveLength(3)
    f.pool.update('track','beat:2',false,false,false); await flush()
    expect(f.replacements).toEqual(['a','b','c','d'])
    f.pool.update('track','beat:2',false,false,false)
    f.pool.update('track',null,false,true,false); await flush()
    expect(f.replacements).toHaveLength(4)
    expect(f.pauses.at(-1)).toBe(true)
    expect(f.resources.size).toBe(3)
    f.pool.update('track','beat:4',false,false,true); await flush()
    expect(f.replacements).toHaveLength(4)
    f.pool.update('track','beat:6',false,false,false); await flush()
    expect(f.replacements.at(-1)).toBe('e')
  })
  it('invalidates obsolete signed loads on a pool change and restores fallback on deactivation', async () => {
    const f=fixture()
    let release!: (source: Cinema2MediaSource) => void
    f.resolver(id => id==='a' ? new Promise(resolve => { release=resolve }) : Promise.resolve(sourceFor(id)))
    f.pool.update('track',null,true,false,false); await flush()
    f.select({id:'other',mediaIds:['x']})
    f.pool.update('track',null,false,false,false); await flush()
    release(sourceFor('a')); await flush()
    expect(f.replacements).not.toContain('a')
    expect(f.resources.get(EVERYWHERE_POOL_SLOTS[0]!.id)?.source.id).toBe('x')
    f.select(null); f.pool.update('track',null,false,false,false)
    expect(f.pool.getResources()).toEqual([null,null,null])
    f.pool.dispose()
  })
  it('cycles small pools without duplicate decoders and exposes all six program cadences', async () => {
    const f=fixture(); f.select({id:'small',mediaIds:['a','b','a']})
    f.pool.update('track',null,true,false,false); await flush()
    f.pool.update('track','next',false,false,false); await flush()
    expect(f.replacements).toEqual(['a','b'])
    expect(f.pool.step).toBe(1)
    expect(['static-switch','retro-broadcast','tape-tracking','channel-mosaic','signal-relay','midnight-replay'].map(pattern => everywherePoolTrigger(pattern as Parameters<typeof everywherePoolTrigger>[0]))).toEqual(['beat2','bar','beat4','bar','beat2','bar4'])
  })
})

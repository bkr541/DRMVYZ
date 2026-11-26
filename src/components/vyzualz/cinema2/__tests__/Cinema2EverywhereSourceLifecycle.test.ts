import { describe, expect, it } from 'vitest'
import { cinema2StableId, type Cinema2MediaSlotId, type Cinema2PresetId } from '../contracts/Cinema2NativePresetManifest'
import { Cinema2MediaSlotRuntime, type Cinema2LoadedMedia, type Cinema2MediaSource } from '../media/Cinema2MediaSlotRuntime'
import { captureCinema2WorkspacePresetState, restoreCinema2WorkspaceMedia } from '../runtime/Cinema2WorkspaceSession'
import type { Cinema2Runtime } from '../runtime/Cinema2Runtime'

const slot = cinema2StableId<Cinema2MediaSlotId>('everywhere-screen-media')
const preset = cinema2StableId<Cinema2PresetId>('everywhere')
const source = (id: string, kind: Cinema2MediaSource['kind'] = 'image'): Cinema2MediaSource => ({ id, label: id, kind, url: `blob:${id}` })
function fixture() {
  let deleted = 0, disposed = 0
  const pending = new Map<string, { resolve: (media: Cinema2LoadedMedia) => void; reject: (error: Error) => void; signal: AbortSignal }>()
  const gl = { createTexture: () => ({}), deleteTexture: () => { deleted++ }, bindTexture() {}, texParameteri() {}, pixelStorei() {}, texImage2D() {} } as unknown as WebGL2RenderingContext
  const slots = new Cinema2MediaSlotRuntime(gl, [{ id: slot, label: 'Screen Media', accepts: ['image','video','svg'] }], {
    load: (candidate, signal) => new Promise((resolve, reject) => { pending.set(candidate.id, { resolve, reject, signal }) }),
  })
  const runtime = { getCompiledPresetPlan: () => ({ presetId: preset }), getMediaSlotRuntime: () => slots,
    getMediaSlotRuntimeSnapshot: () => slots.getSnapshot(), serializeParameterState: () => 'unchanged-design',
  } as unknown as Cinema2Runtime
  const finish = (id: string) => pending.get(id)!.resolve({ pixelSource: {} as TexImageSource, width: 20, height: 10, dynamic: false, dispose: () => { disposed++ } })
  return { slots, runtime, pending, finish, counters: () => ({ deleted, disposed }), save: () => captureCinema2WorkspacePresetState(runtime) }
}

describe('Everywhere committed source lifecycle', () => {
  it('persists only the last ready feed and restores default eyes after reset, even with a late video decode', async () => {
    const f = fixture()
    const first = f.slots.replace(slot, source('wordmark'))
    expect(f.save().mediaSlots).toEqual([])
    f.finish('wordmark'); await first
    expect(f.save().mediaSlots.map(item => item.source.id)).toEqual(['wordmark'])
    const video = f.slots.replace(slot, source('video', 'video'))
    expect(f.save().mediaSlots.map(item => item.source.id)).toEqual(['wordmark'])
    f.slots.remove(slot)
    expect(f.pending.get('video')!.signal.aborted).toBe(true)
    f.finish('video'); await video
    expect(f.slots.getManagedResource(slot)).toBeNull()
    expect(f.save().mediaSlots).toEqual([])
    expect(f.save().serializedParameterState).toBe('unchanged-design')
    expect(f.counters()).toEqual({ deleted: 1, disposed: 2 })
    const restored = fixture()
    await restoreCinema2WorkspaceMedia(restored.runtime, f.save())
    expect(restored.pending.size).toBe(0)
    const next = restored.slots.replace(slot, source('magenta'))
    restored.finish('magenta'); await next
    expect(restored.save().mediaSlots.map(item => item.source.id)).toEqual(['magenta'])
    f.slots.dispose(); restored.slots.dispose()
  })

  it('does not persist a failed first load and retains the valid source on failed replacement or context loss', async () => {
    const f = fixture()
    const bad = f.slots.replace(slot, source('bad'))
    f.pending.get('bad')!.reject(new Error('decode failed')); await bad
    expect(f.save().mediaSlots).toEqual([])
    const good = f.slots.replace(slot, source('good'))
    f.finish('good'); await good
    const replacement = f.slots.replace(slot, source('bad-again'))
    f.pending.get('bad-again')!.reject(new Error('decode failed')); await replacement
    expect(f.save().mediaSlots.map(item => item.source.id)).toEqual(['good'])
    f.slots.handleContextLost()
    expect(f.save().mediaSlots.map(item => item.source.id)).toEqual(['good'])
    f.slots.dispose()
  })
})

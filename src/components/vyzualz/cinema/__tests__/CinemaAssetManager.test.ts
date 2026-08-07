import { describe, expect, it, vi } from 'vitest'
import {
  CinemaAssetManager,
  cinemaStableId,
  type CinemaAssetBindingDefinition,
  type CinemaAssetBindingId,
  type CinemaAssetId,
  type CinemaExternalAssetSnapshot,
  type CinemaDiagnostic,
  type CinemaStableId,
} from '../index'
import { createCinemaMockWebGL } from './CinemaWebGLTestUtils'

function stable<T extends CinemaStableId>(value: string, kind: string): T {
  return cinemaStableId<T>(value, kind)
}

const bindingId = stable<CinemaAssetBindingId>('asset-manager-binding', 'asset binding')
const secondaryBindingId = stable<CinemaAssetBindingId>('asset-manager-secondary-binding', 'asset binding')
const assetId = stable<CinemaAssetId>('media-asset-manager-image', 'asset')
const binding: CinemaAssetBindingDefinition = {
  id: bindingId,
  assetId,
  role: 'image',
  fit: 'cover',
  preserveOriginalColors: true,
  opacity: 1,
  blendMode: 'normal',
}

function source(revision: number): CinemaExternalAssetSnapshot {
  return {
    assetId,
    revision,
    name: 'Runtime Image',
    mimeType: 'image/png',
    mediaKind: 'image',
    runtimeUrl: `https://signed.example/image-${revision}.png`,
    width: 640,
    height: 360,
  }
}

function createImageMock(): HTMLImageElement {
  let onload: ((this: GlobalEventHandlers, ev: Event) => unknown) | null = null
  const image = {
    naturalWidth: 640,
    naturalHeight: 360,
    onerror: null,
    removeAttribute: vi.fn(),
    get onload() { return onload },
    set onload(value) { onload = value },
    set src(_value: string) { queueMicrotask(() => onload?.call(image as unknown as GlobalEventHandlers, new Event('load'))) },
  }
  return image as unknown as HTMLImageElement
}

describe('CinemaAssetManager', () => {
  it('owns object URLs and textures, releases replacements, and reconstructs after context restore', async () => {
    const gl = createCinemaMockWebGL()
    const report = vi.fn()
    const revokeObjectUrl = vi.fn()
    let objectUrlSequence = 0
    const manager = new CinemaAssetManager(gl, { report }, {
      fetch: vi.fn(async () => new Response(new Blob(['image']), { status: 200 })) as unknown as typeof fetch,
      createImage: createImageMock,
      createVideo: () => { throw new Error('video not expected') },
      createObjectUrl: () => `blob:cinema-owned-${++objectUrlSequence}`,
      revokeObjectUrl,
    })

    manager.setSources([source(1)])
    const first = await manager.prepare(binding)
    expect(first.status).toBe('ready')
    expect(first.texture).not.toBeNull()
    expect(gl.__calls.createdTextures).toBe(1)
    expect(manager.getDiagnostics()).toEqual({ sourceCount: 1, resourceCount: 1, readyCount: 1 })

    manager.setSources([source(2)])
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:cinema-owned-1')
    expect(gl.__calls.deletedTextures).toBe(1)
    const second = await manager.prepare(binding)
    expect(second.status).toBe('ready')
    expect(gl.__calls.createdTextures).toBe(2)

    manager.handleContextLost()
    expect(manager.resolve(binding).texture).toBeNull()
    manager.rebuildAfterContextRestore()
    expect(manager.resolve(binding).texture).not.toBeNull()
    expect(gl.__calls.createdTextures).toBe(3)

    manager.dispose()
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:cinema-owned-2')
    expect(manager.getDiagnostics()).toEqual({ sourceCount: 0, resourceCount: 0, readyCount: 0 })
    expect(report.mock.calls.some((call: unknown[]) => (call[0] as CinemaDiagnostic).code === 'CINEMA_ASSET_RUNTIME_RELEASED')).toBe(true)
  })

  it('shares one decode while preserving each authored binding identity', async () => {
    const gl = createCinemaMockWebGL()
    let releaseFetch!: () => void
    const fetchGate = new Promise<void>(resolve => { releaseFetch = resolve })
    const manager = new CinemaAssetManager(gl, { report: vi.fn() }, {
      fetch: vi.fn(async () => {
        await fetchGate
        return new Response(new Blob(['shared']), { status: 200 })
      }) as unknown as typeof fetch,
      createImage: createImageMock,
      createVideo: () => { throw new Error('video not expected') },
      createObjectUrl: () => 'blob:cinema-shared',
      revokeObjectUrl: vi.fn(),
    })
    const secondaryBinding = { ...binding, id: secondaryBindingId, role: 'mask' as const }

    manager.setSources([source(1)])
    const primary = manager.prepare(binding)
    const secondary = manager.prepare(secondaryBinding)
    releaseFetch()

    expect((await primary).bindingId).toBe(bindingId)
    expect((await secondary).bindingId).toBe(secondaryBindingId)
    expect(gl.__calls.createdTextures).toBe(1)
  })

  it('aborts stale preparation when a source is replaced before decode completes', async () => {
    const gl = createCinemaMockWebGL()
    const report = vi.fn()
    let markFirstFetchStarted!: () => void
    const firstFetchStarted = new Promise<void>(resolve => { markFirstFetchStarted = resolve })
    let fetchCount = 0
    const createObjectUrl = vi.fn(() => 'blob:cinema-current')
    const manager = new CinemaAssetManager(gl, { report }, {
      fetch: vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        fetchCount += 1
        if (fetchCount === 1) {
          markFirstFetchStarted()
          return new Promise<Response>((_resolve, reject) => {
            const abort = () => {
              const error = new Error('aborted')
              error.name = 'AbortError'
              reject(error)
            }
            init?.signal?.addEventListener('abort', abort, { once: true })
          })
        }
        return Promise.resolve(new Response(new Blob(['current']), { status: 200 }))
      }) as unknown as typeof fetch,
      createImage: createImageMock,
      createVideo: () => { throw new Error('video not expected') },
      createObjectUrl,
      revokeObjectUrl: vi.fn(),
    })

    manager.setSources([source(1)])
    const stalePreparation = manager.prepare(binding)
    await firstFetchStarted
    manager.setSources([source(2)])

    expect(await stalePreparation).toMatchObject({ status: 'fallback', fallback: { reason: 'unavailable' } })
    const current = await manager.prepare(binding)
    expect(current.status).toBe('ready')
    expect(createObjectUrl).toHaveBeenCalledTimes(1)
    expect(gl.__calls.createdTextures).toBe(1)
    expect(manager.getDiagnostics()).toEqual({ sourceCount: 1, resourceCount: 1, readyCount: 1 })
  })

  it('returns readable deterministic fallbacks without creating runtime resources', async () => {
    const gl = createCinemaMockWebGL()
    const report = vi.fn()
    const manager = new CinemaAssetManager(gl, { report })

    const missing = await manager.prepare(binding)
    expect(missing.status).toBe('fallback')
    expect(missing.fallback).toMatchObject({ kind: 'checkerboard', reason: 'missing' })
    expect(gl.__calls.createdTextures).toBe(0)
    expect(report.mock.calls.some((call: unknown[]) => (call[0] as CinemaDiagnostic).code === 'CINEMA_ASSET_MISSING')).toBe(true)
  })
})

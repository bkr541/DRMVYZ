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
  type CinemaTransportFrame,
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

  it('synchronizes video to play, pause, seek, loop, and playback rate without owning an animation loop', async () => {
    const gl = createCinemaMockWebGL()
    const report = vi.fn()
    let paused = true
    let onloadeddata: ((this: GlobalEventHandlers, ev: Event) => unknown) | null = null
    const video = {
      preload: '',
      muted: false,
      playsInline: false,
      loop: true,
      crossOrigin: '',
      currentTime: 0,
      duration: 10,
      videoWidth: 1920,
      videoHeight: 1080,
      readyState: 4,
      playbackRate: 1,
      onerror: null,
      removeAttribute: vi.fn(),
      load: vi.fn(),
      pause: vi.fn(() => { paused = true }),
      play: vi.fn(() => { paused = false; return Promise.resolve() }),
      get paused() { return paused },
      get onloadeddata() { return onloadeddata },
      set onloadeddata(value) { onloadeddata = value },
      set src(_value: string) { queueMicrotask(() => onloadeddata?.call(video as unknown as GlobalEventHandlers, new Event('loadeddata'))) },
    } as unknown as HTMLVideoElement
    const videoAssetId = stable<CinemaAssetId>('media-asset-manager-video', 'asset')
    const videoBinding: CinemaAssetBindingDefinition = {
      ...binding,
      id: stable<CinemaAssetBindingId>('asset-manager-video-binding', 'asset binding'),
      assetId: videoAssetId,
      role: 'video',
    }
    const manager = new CinemaAssetManager(gl, { report }, {
      fetch: vi.fn() as unknown as typeof fetch,
      createImage: () => { throw new Error('image not expected') },
      createVideo: () => video,
      createObjectUrl: () => { throw new Error('object URL not expected') },
      revokeObjectUrl: vi.fn(),
    })
    manager.setSources([{
      assetId: videoAssetId,
      revision: 1,
      name: 'Runtime Video',
      mimeType: 'video/mp4',
      mediaKind: 'video',
      runtimeUrl: 'https://signed.example/video.mp4',
      width: 1920,
      height: 1080,
      durationSec: 10,
    }])
    expect((await manager.prepare(videoBinding)).status).toBe('ready')

    const transport = (overrides: Partial<CinemaTransportFrame> = {}): CinemaTransportFrame => ({
      trackId: 'track-stage-15',
      audioTimeSec: 12,
      durationSec: 30,
      playing: true,
      paused: false,
      seeking: false,
      looped: false,
      visibilitySuspended: false,
      discontinuity: true,
      discontinuityReasons: ['activation'],
      reset: { required: true, reconstruct: true, generation: 1, reasons: ['activation'], actionIds: ['cinema.reset.activation'], identity: 'stage-15' },
      ...overrides,
    })
    const requestAnimationFrame = vi.fn()
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrame)

    manager.synchronizeVideo(videoBinding, transport(), { loop: true, playbackRate: 1 })
    expect(video.currentTime).toBe(2)
    expect(video.play).toHaveBeenCalledTimes(1)
    expect(gl.texSubImage2D).toHaveBeenCalled()

    manager.synchronizeVideo(videoBinding, transport({ audioTimeSec: 4, playing: false, paused: true, seeking: true }), { loop: false, playbackRate: 1.5 })
    expect(video.currentTime).toBe(6)
    expect(video.playbackRate).toBe(1.5)
    expect(video.pause).toHaveBeenCalled()
    expect(requestAnimationFrame).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
    manager.dispose()
  })

  it('loads and revision-invalidates raw SVG source through the canonical Cinema asset identity path', async () => {
    const gl = createCinemaMockWebGL()
    const svgAssetId = stable<CinemaAssetId>('media-asset-manager-svg', 'asset')
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => new Response(
      String(input).includes('revision-2') ? '<svg><circle r="2" /></svg>' : '<svg><rect width="1" height="1" /></svg>',
      { status: 200, headers: { 'content-type': 'image/svg+xml' } },
    )) as unknown as typeof fetch
    const manager = new CinemaAssetManager(gl, { report: vi.fn() }, {
      fetch: fetchMock,
      createImage: () => { throw new Error('image decode not expected') },
      createVideo: () => { throw new Error('video decode not expected') },
      createObjectUrl: () => { throw new Error('object URL not expected') },
      revokeObjectUrl: vi.fn(),
    })
    const svgSource = (revision: number): CinemaExternalAssetSnapshot => ({
      assetId: svgAssetId,
      revision,
      name: 'Vector Logo',
      mimeType: 'image/svg+xml',
      mediaKind: 'svg',
      runtimeUrl: `https://signed.example/revision-${revision}.svg`,
    })

    manager.setSources([svgSource(1)])
    const first = await manager.loadRawSource(svgAssetId)
    const shared = await manager.loadRawSource(svgAssetId)
    expect(first).toMatchObject({ assetId: svgAssetId, revision: 1, mediaKind: 'svg' })
    expect(first?.text).toContain('<rect')
    expect(shared).toBe(first)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    manager.setSources([svgSource(2)])
    const second = await manager.loadRawSource(svgAssetId)
    expect(second).toMatchObject({ revision: 2 })
    expect(second?.text).toContain('<circle')
    expect(fetchMock).toHaveBeenCalledTimes(2)

    manager.setSources([{ ...svgSource(2), deleted: true }])
    expect(await manager.loadRawSource(svgAssetId)).toBeNull()
    manager.dispose()
  })

  it('loads Font Library binary source through the same revision-aware raw asset path', async () => {
    const gl = createCinemaMockWebGL()
    const fontAssetId = stable<CinemaAssetId>('font-asset-manager-outline', 'asset')
    const loadRawData = vi.fn(async () => new Uint8Array([0, 1, 2, 3]).buffer)
    const manager = new CinemaAssetManager(gl, { report: vi.fn() }, {
      fetch: vi.fn() as unknown as typeof fetch,
      createImage: () => { throw new Error('image decode not expected') },
      createVideo: () => { throw new Error('video decode not expected') },
      createObjectUrl: () => { throw new Error('object URL not expected') },
      revokeObjectUrl: vi.fn(),
    })
    manager.setSources([{
      assetId: fontAssetId,
      revision: 'font-v1',
      name: 'Outline Font',
      mimeType: 'font/ttf',
      mediaKind: 'font',
      runtimeUrl: null,
      loadRawData,
    }])

    const source = await manager.loadRawSource(fontAssetId)
    expect(source).toMatchObject({ assetId: fontAssetId, revision: 'font-v1', mediaKind: 'font', text: null })
    expect(Array.from(new Uint8Array(source?.bytes ?? new ArrayBuffer(0)))).toEqual([0, 1, 2, 3])
    expect(manager.getSourceRevision(fontAssetId)).toBe('font-v1')
    expect(loadRawData).toHaveBeenCalledTimes(1)
    expect(await manager.loadRawSource(fontAssetId)).toBe(source)
    expect(loadRawData).toHaveBeenCalledTimes(1)

    manager.setSources([])
    expect(manager.getSourceRevision(fontAssetId)).toBeNull()
    expect(await manager.loadRawSource(fontAssetId)).toBeNull()
    manager.dispose()
  })

})

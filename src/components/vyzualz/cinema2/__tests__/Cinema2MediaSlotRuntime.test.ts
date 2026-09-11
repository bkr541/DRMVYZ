import { describe, expect, it, vi } from 'vitest'
import { createCinemaMockWebGL } from '../../cinema/__tests__/CinemaWebGLTestUtils'
import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  Cinema2MediaSlotRuntime,
  Cinema2ModuleRegistry,
  Cinema2PresetRegistry,
  Cinema2Runtime,
  cinema2NamespacedId,
  cinema2Ref,
  cinema2StableId,
  type Cinema2LoadedMedia,
  type Cinema2MediaLoader,
  type Cinema2MediaSlotId,
  type Cinema2MediaSource,
  type Cinema2ModuleId,
  type Cinema2ModuleMediaFacet,
  type Cinema2ModuleTypeId,
  type Cinema2NativePresetManifest,
  type Cinema2PresetId,
} from '..'

class FakeCanvas extends EventTarget {
  width = 300
  height = 150
  readonly getContext: ReturnType<typeof vi.fn>

  constructor(gl: WebGL2RenderingContext | null) {
    super()
    this.getContext = vi.fn(() => gl)
  }
}

const requiredSlotId = cinema2StableId<Cinema2MediaSlotId>('required-media')
const optionalSlotId = cinema2StableId<Cinema2MediaSlotId>('optional-media')

function source(id: string, kind: Cinema2MediaSource['kind'] = 'image'): Cinema2MediaSource {
  return { id, label: id, kind, url: `blob:${id}` }
}

function loaded(
  overrides: Partial<Cinema2LoadedMedia> = {},
): Cinema2LoadedMedia {
  return {
    pixelSource: {} as TexImageSource,
    width: 1920,
    height: 1080,
    dynamic: false,
    dispose: vi.fn(),
    ...overrides,
  }
}

describe('Cinema 2.0 media-slot runtime', () => {
  it('reports required and optional missing state explicitly', () => {
    const runtime = new Cinema2MediaSlotRuntime(createCinemaMockWebGL(), [
      { id: requiredSlotId, label: 'Required Media', accepts: ['image'], required: true },
      { id: optionalSlotId, label: 'Optional Media', accepts: ['image', 'video'] },
    ], { load: vi.fn() })

    expect(runtime.getSnapshot()).toMatchObject({
      slotCount: 2,
      readyResourceCount: 0,
      missingRequiredCount: 1,
      slots: [
        expect.objectContaining({ id: requiredSlotId, status: 'missing-required', required: true }),
        expect.objectContaining({ id: optionalSlotId, status: 'empty', required: false }),
      ],
    })
    expect(runtime.getManagedResource(requiredSlotId)).toBeNull()
    runtime.dispose()
  })

  it('loads, replaces, removes and fails without leaking stale textures or media resources', async () => {
    const gl = createCinemaMockWebGL()
    const first = loaded()
    const second = loaded({ width: 1280, height: 720 })
    const loader: Cinema2MediaLoader = {
      load: vi.fn(async (candidate: Readonly<Cinema2MediaSource>) => {
        if (candidate.id === 'bad') throw new Error('decode failed')
        return candidate.id === 'first' ? first : second
      }),
    }
    const runtime = new Cinema2MediaSlotRuntime(gl, [
      { id: requiredSlotId, label: 'Required Media', accepts: ['image'], required: true },
    ], loader)

    expect(await runtime.replace(requiredSlotId, source('first'), {
      fit: 'cover',
      position: [0.25, 0.75],
      scale: [1.2, 0.8],
      rotation: 0.5,
      opacity: 0.65,
    })).toMatchObject({ status: 'ready', readyWidth: 1920, readyHeight: 1080 })
    expect(gl.__calls.createdTextures).toBe(1)
    expect(runtime.getManagedResource(requiredSlotId)).toMatchObject({
      width: 1920,
      height: 1080,
      presentation: { fit: 'cover', position: [0.25, 0.75], scale: [1.2, 0.8], rotation: 0.5, opacity: 0.65 },
    })

    expect(await runtime.replace(requiredSlotId, source('second'))).toMatchObject({ status: 'ready', readyWidth: 1280 })
    expect(first.dispose).toHaveBeenCalledTimes(1)
    expect(gl.__calls.createdTextures).toBe(2)
    expect(gl.__calls.deletedTextures).toBe(1)

    expect(await runtime.replace(requiredSlotId, source('bad'))).toMatchObject({ status: 'error', error: 'decode failed' })
    expect(second.dispose).toHaveBeenCalledTimes(1)
    expect(gl.__calls.deletedTextures).toBe(2)
    expect(runtime.getManagedResource(requiredSlotId)).toBeNull()

    expect(runtime.remove(requiredSlotId)).toMatchObject({ status: 'missing-required', source: null })
    runtime.dispose()
    expect(gl.__calls.createdTextures).toBe(gl.__calls.deletedTextures)
  })

  it('updates video textures, exposes playback metadata, and recreates the managed texture after context loss', async () => {
    const gl = createCinemaMockWebGL()
    let frameReady = true
    const video = loaded({
      dynamic: true,
      canUploadFrame: () => frameReady,
      getPlaybackSnapshot: () => ({ currentTimeSec: 2.5, durationSec: 8, paused: false, loop: true, muted: true }),
    })
    const loader: Cinema2MediaLoader = { load: vi.fn(async () => video) }
    const runtime = new Cinema2MediaSlotRuntime(gl, [
      { id: optionalSlotId, label: 'Video', accepts: ['video'] },
    ], loader)

    await runtime.replace(optionalSlotId, source('clip', 'video'))
    const uploadsAfterLoad = vi.mocked(gl.texImage2D).mock.calls.length
    runtime.updateVideoTextures()
    expect(vi.mocked(gl.texImage2D).mock.calls.length).toBe(uploadsAfterLoad + 1)
    expect(runtime.getManagedResource(optionalSlotId)?.playback).toEqual({
      currentTimeSec: 2.5,
      durationSec: 8,
      paused: false,
      loop: true,
      muted: true,
    })

    frameReady = false
    runtime.updateVideoTextures()
    expect(vi.mocked(gl.texImage2D).mock.calls.length).toBe(uploadsAfterLoad + 1)

    runtime.handleContextLost()
    expect(runtime.getSlotSnapshot(optionalSlotId)?.status).toBe('loading')
    expect(runtime.getManagedResource(optionalSlotId)).toBeNull()
    runtime.handleContextRestored()
    expect(runtime.getSlotSnapshot(optionalSlotId)?.status).toBe('ready')
    expect(gl.__calls.createdTextures).toBe(2)
    expect(gl.__calls.deletedTextures).toBe(1)

    runtime.dispose()
    expect(video.dispose).toHaveBeenCalledTimes(1)
    expect(gl.__calls.createdTextures).toBe(gl.__calls.deletedTextures)
  })

  it('hands a live managed slot facet to modules through the real preset/runtime activation path', async () => {
    const mediaSlotId = cinema2StableId<Cinema2MediaSlotId>('hero-media')
    const moduleId = cinema2StableId<Cinema2ModuleId>('media-consumer')
    const moduleTypeId = cinema2StableId<Cinema2ModuleTypeId>('media-consumer-type')
    const presetRegistry = new Cinema2PresetRegistry()
    const moduleRegistry = new Cinema2ModuleRegistry()
    let mediaFacet: Cinema2ModuleMediaFacet | null = null

    expect(moduleRegistry.register({
      typeId: moduleTypeId,
      version: 1,
      create: context => {
        mediaFacet = context.media
        return { lifecycle: { update: () => {}, dispose: () => {} } }
      },
    }).ok).toBe(true)

    const manifest: Cinema2NativePresetManifest = {
      schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
      schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
      id: cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.media-handoff'),
      revision: 1,
      metadata: { name: 'Media handoff' },
      mediaSlots: [{ id: mediaSlotId, label: 'Hero', accepts: ['image'], required: true }],
      modules: [{
        id: moduleId,
        typeId: moduleTypeId,
        version: 1,
        media: { hero: cinema2Ref(mediaSlotId) },
      }],
    }
    expect(presetRegistry.register(manifest).ok).toBe(true)
    const gl = createCinemaMockWebGL()
    const resource = loaded({ width: 640, height: 360 })
    const created = Cinema2Runtime.create(new FakeCanvas(gl) as unknown as HTMLCanvasElement, {
      presetId: manifest.id,
      presetRegistry,
      moduleRegistry,
      mediaLoader: { load: vi.fn(async () => resource) },
      requestAnimationFrame: vi.fn(() => 1),
      cancelAnimationFrame: vi.fn(),
    })
    if (!created.runtime) throw new Error(created.error)

    expect(mediaFacet).not.toBeNull()
    expect(mediaFacet!.get('hero')).toBeNull()
    expect(mediaFacet!.getSlot('hero')).toMatchObject({ status: 'missing-required', required: true })

    await created.runtime.getMediaSlotRuntime().replace(mediaSlotId, source('hero'))
    expect(mediaFacet!.get('hero')).toMatchObject({
      slotId: mediaSlotId,
      width: 640,
      height: 360,
      source: { id: 'hero' },
    })
    expect(mediaFacet!.getSlot('hero')).toMatchObject({ status: 'ready' })

    created.runtime.dispose()
    expect(resource.dispose).toHaveBeenCalledTimes(1)
    expect(gl.__calls.createdTextures).toBe(gl.__calls.deletedTextures)
  })
})

import { describe, expect, it, vi } from 'vitest'

import { createCinemaMockWebGL } from '../../cinema/__tests__/CinemaWebGLTestUtils'
import {
  Cinema2AssetTextureService,
  type Cinema2DecodedTextureImage,
} from '../assets/Cinema2AssetTextureService'
import {
  CINEMA2_WET_CONCRETE_TEXTURE_ASSET_ID,
  cinema2TextureAssetRegistry,
} from '../assets/Cinema2TextureAssetManifest'
import { CINEMA2_ASSET_RECORDS } from '../assets/Cinema2AssetManifest.generated'
import { Cinema2TextureAssetRegistry } from '../assets/Cinema2TextureAssetRegistry'
import { cinema2ThreeAssetRegistry } from '../modules/three/Cinema2ThreeAssetManifest'
import { CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS } from '../presets/Cinema2FirstPartyPresetCatalog'
import { cinema2NativeEffectRegistry } from '../effects/Cinema2EffectRegistry'
import { Cinema2EffectRuntime } from '../effects/Cinema2EffectRuntime'
import { cinema2ReflectiveFloorEffectDefinition } from '../effects/Cinema2ReflectiveFloorEffect'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { Cinema2FinalValueResolver } from '../parameters/Cinema2TargetRuntime'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { CINEMA2_THRESHOLD_FLOOR_EFFECT_ID, CINEMA2_THRESHOLD_PRESET_MANIFEST } from '../presets/Cinema2ThresholdPreset'
import { Cinema2HistoryService } from '../runtime/Cinema2HistoryService'
import { Cinema2ResourceManager } from '../runtime/Cinema2ResourceManager'

const CAPABILITIES = ['render.webgl2', 'render.depth', 'scene.3d', 'camera.world', 'lighting', 'music.beat', 'music.downbeat', 'music.phrase', 'visual-director.significance'] as const

function testRegistry() {
  const registry = new Cinema2TextureAssetRegistry()
  registry.register({
    id: 'tex',
    url: '/cinema2/textures/tex-1024.webp',
    layout: 'surface-normal-crack-roughness',
    width: 1024,
    height: 1024,
    variants: { low: { url: '/cinema2/textures/tex-512.webp', width: 512, height: 512 } },
    license: 'generated-in-house',
  })
  return registry
}

function image(width = 64, height = 64): Cinema2DecodedTextureImage & { close: ReturnType<typeof vi.fn> } {
  return { source: {} as TexImageSource, width, height, close: vi.fn() }
}

interface Deferred<T> { promise: Promise<T>; resolve(value: T): void; reject(error: unknown): void }
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

function createGl() {
  const gl = createCinemaMockWebGL()
  const extras = gl as unknown as Record<string, unknown>
  extras.generateMipmap = vi.fn()
  extras.texParameterf = vi.fn()
  return gl
}

/** Lets pending promise callbacks (loader -> upload) run. */
const flush = () => new Promise<void>(resolve => setTimeout(resolve, 0))

describe('Cinema 2.0 texture asset registry', () => {
  it('requires app-origin paths, a license, positive dimensions and unique ids', () => {
    const registry = new Cinema2TextureAssetRegistry()
    const base = { id: 'a', url: '/cinema2/textures/a.webp', layout: 'color' as const, width: 4, height: 4, license: 'CC0' }
    expect(() => registry.register({ ...base, url: 'https://example.com/a.webp' })).toThrow(/app-origin/)
    expect(() => registry.register({ ...base, url: '//example.com/a.webp' })).toThrow(/app-origin/)
    expect(() => registry.register({ ...base, variants: { low: { url: 'data:image/png;base64,AA', width: 2, height: 2 } } })).toThrow(/app-origin/)
    expect(() => registry.register({ ...base, license: ' ' })).toThrow(/license/)
    expect(() => registry.register({ ...base, width: 0 })).toThrow(/dimensions/)
    registry.register(base)
    expect(() => registry.register(base)).toThrow(/already registered/)
    expect(registry.has('a')).toBe(true)
  })

  it('resolves quality variants and falls back to the base file', () => {
    const registry = testRegistry()
    expect(registry.resolve('tex', 'high')).toMatchObject({ url: '/cinema2/textures/tex-1024.webp', width: 1024 })
    expect(registry.resolve('tex', 'low')).toMatchObject({ url: '/cinema2/textures/tex-512.webp', width: 512 })
    expect(registry.resolve('nope', 'high')).toBeNull()
  })

  it('ships the wet-concrete texture with a license record', () => {
    expect(cinema2TextureAssetRegistry.get(CINEMA2_WET_CONCRETE_TEXTURE_ASSET_ID)).toMatchObject({ layout: 'surface-normal-crack-roughness', license: 'generated-in-house' })
  })
})

describe('Cinema 2.0 asset texture service', () => {
  it('loads once per asset, shares the texture between owners and deletes it with the last handle', async () => {
    const gl = createGl()
    const loader = vi.fn(async () => image())
    const service = new Cinema2AssetTextureService(gl, testRegistry(), { loader })
    const first = service.acquire('tex', 'high')
    const second = service.acquire('tex', 'high')
    expect(first.status).toBe('loading')
    expect(first.texture).toBeNull()
    await flush()
    expect(loader).toHaveBeenCalledTimes(1)
    expect(first.status).toBe('ready')
    expect(first.texture).toBe(second.texture)
    expect(vi.mocked(gl.createTexture).mock.calls.length).toBe(1)
    first.release()
    first.release()
    expect(gl.deleteTexture).not.toHaveBeenCalled()
    expect(second.status).toBe('ready')
    second.release()
    expect(gl.deleteTexture).toHaveBeenCalledTimes(1)
    expect(service.getSnapshot()).toMatchObject({ textureCount: 0, estimatedGpuBytes: 0, entries: [] })
  })

  it('closes the decoded image after upload and keeps quality variants separate', async () => {
    const gl = createGl()
    const decoded: ReturnType<typeof image>[] = []
    const service = new Cinema2AssetTextureService(gl, testRegistry(), { loader: async url => { const item = image(url.includes('512') ? 512 : 1024, url.includes('512') ? 512 : 1024); decoded.push(item); return item } })
    const high = service.acquire('tex', 'high')
    const low = service.acquire('tex', 'low')
    await flush()
    expect(high.texture).not.toBe(low.texture)
    expect(high.width).toBe(1024)
    expect(low.width).toBe(512)
    expect(decoded.every(item => item.close.mock.calls.length === 1)).toBe(true)
    expect(service.getSnapshot().estimatedGpuBytes).toBe(Math.round(1024 * 1024 * 4 * 4 / 3) + Math.round(512 * 512 * 4 * 4 / 3))
    service.dispose()
  })

  it('fails with a diagnostic for unknown ids, loader errors and a busted budget, without creating textures', async () => {
    const gl = createGl()
    const service = new Cinema2AssetTextureService(gl, testRegistry(), {
      budgetBytes: 1024 * 1024,
      loader: async url => { if (url.includes('512')) throw new Error('HTTP 404'); return image(1024, 1024) },
    })
    const unknown = service.acquire('nope', 'high')
    expect(unknown.status).toBe('failed')
    const missing = service.acquire('tex', 'low')
    const tooBig = service.acquire('tex', 'high')
    await flush()
    expect(missing.status).toBe('failed')
    expect(tooBig.status).toBe('failed')
    const snapshot = service.getSnapshot()
    expect(snapshot.failedTextureCount).toBe(3)
    expect(snapshot.entries.map(entry => entry.error).join(' | ')).toMatch(/not registered.*HTTP 404.*budget|budget.*HTTP 404/s)
    expect(gl.createTexture).not.toHaveBeenCalled()
    service.dispose()
  })

  it('does not upload an image whose owner released it while it was loading', async () => {
    const gl = createGl()
    const pending = deferred<Cinema2DecodedTextureImage>()
    const service = new Cinema2AssetTextureService(gl, testRegistry(), { loader: () => pending.promise })
    service.acquire('tex', 'high').release()
    const late = image()
    pending.resolve(late)
    await flush()
    expect(gl.createTexture).not.toHaveBeenCalled()
    expect(late.close).toHaveBeenCalledTimes(1)
    service.dispose()
  })

  it('forgets GL objects on context loss and re-uploads for surviving owners after restore', async () => {
    const gl = createGl()
    const loader = vi.fn(async () => image())
    const service = new Cinema2AssetTextureService(gl, testRegistry(), { loader })
    const handle = service.acquire('tex', 'high')
    await flush()
    expect(handle.status).toBe('ready')
    service.handleContextLost()
    expect(handle.texture).toBeNull()
    expect(service.getSnapshot().estimatedGpuBytes).toBe(0)
    expect(gl.deleteTexture).not.toHaveBeenCalled()
    service.handleContextRestored()
    await flush()
    expect(loader).toHaveBeenCalledTimes(2)
    expect(handle.status).toBe('ready')
    expect(handle.texture).not.toBeNull()
    service.dispose()
  })

  it('ignores a load that finishes after a context loss, and disposes everything', async () => {
    const gl = createGl()
    const pending = deferred<Cinema2DecodedTextureImage>()
    const service = new Cinema2AssetTextureService(gl, testRegistry(), { loader: () => pending.promise })
    const handle = service.acquire('tex', 'high')
    service.handleContextLost()
    pending.resolve(image())
    await flush()
    expect(gl.createTexture).not.toHaveBeenCalled()
    expect(handle.status).toBe('loading')
    service.dispose()
    expect(service.getSnapshot()).toMatchObject({ disposed: true, entries: [] })
    expect(service.acquire('tex', 'high').status).toBe('failed')
  })
})

describe('Cinema 2.0 reflective floor surface texture', () => {
  const floor = CINEMA2_THRESHOLD_PRESET_MANIFEST.effects!.find(effect => effect.id === CINEMA2_THRESHOLD_FLOOR_EFFECT_ID)!

  it('validates the surfaceTexture reference and its controls', () => {
    const validate = cinema2ReflectiveFloorEffectDefinition.validate!
    expect(validate(floor)).toEqual([])
    const withParameters = (parameters: Record<string, unknown>) => ({ ...floor, parameters: { ...floor.parameters, ...parameters } }) as typeof floor
    expect(validate(withParameters({ surfaceTexture: 'not-a-texture' })).map(item => item.path)).toEqual(['$.parameters.surfaceTexture'])
    expect(validate(withParameters({ surfaceTexture: 7 })).map(item => item.path)).toEqual(['$.parameters.surfaceTexture'])
    expect(validate(withParameters({ surfaceTextureScale: 0, surfaceTextureStrength: 2 })).map(item => item.path)).toEqual(
      expect.arrayContaining(['$.parameters.surfaceTextureScale', '$.parameters.surfaceTextureStrength']),
    )
  })

  it('binds the texture only once it is ready, fades it in, follows the quality variant and releases it on dispose', async () => {
    const compiled = compileCinema2NativePreset(CINEMA2_THRESHOLD_PRESET_MANIFEST, {
      availableCapabilities: CAPABILITIES,
    })
    if (!compiled.ok) throw new Error(compiled.diagnostics.map(diagnostic => diagnostic.message).join('; '))
    const plan = compiled.plan
    const state = new Cinema2ParameterState(plan.parameters)
    const resolver = new Cinema2FinalValueResolver(plan.targets, {
      resolveBaseValue: target => target.parameterId == null ? target.authoredBaseValue : state.getValue(target.parameterId),
    })
    const gl = createGl()
    gl.getUniformLocation = vi.fn((_program: WebGLProgram, name: string) => ({ name } as unknown as WebGLUniformLocation))
    const history = new Cinema2HistoryService(gl, new Cinema2ResourceManager(gl), plan.presetId)
    const gate = deferred<Cinema2DecodedTextureImage>()
    const requested: string[] = []
    const service = new Cinema2AssetTextureService(gl, cinema2TextureAssetRegistry, { loader: url => { requested.push(url); return gate.promise } })
    const runtime = new Cinema2EffectRuntime(gl, plan, resolver, cinema2NativeEffectRegistry, 'high', history, service)
    const color = { id: 'color', attachment: 'color' as const, texture: {} as WebGLTexture, width: 640, height: 360 }
    const depth = { id: 'depth', attachment: 'depth' as const, texture: {} as WebGLTexture, width: 640, height: 360 }
    const run = (elapsedTimeSec: number) => runtime.execute(CINEMA2_THRESHOLD_FLOOR_EFFECT_ID, {
      frame: { frameId: 1, timestampMs: 16, deltaTimeSec: 1 / 60, elapsedTimeSec, viewport: { width: 640, height: 360, dpr: 1 }, contextGeneration: 0, audio: null, director: null },
      input: color,
      inputs: [color, depth],
      target: null,
      width: 640,
      height: 360,
      camera: { viewProjectionMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], near: 0.1, far: 60 } as never,
      lightingEnvironment: { quality: 'high', lights: [], omittedLightCount: 0 } as never,
    } as never)
    const surface = () => {
      const calls = (gl.uniform1f as ReturnType<typeof vi.fn>).mock.calls.filter((call: unknown[]) => (call[0] as { name?: string } | null)?.name === 'u_surface')
      return calls[calls.length - 1]?.[1] as number
    }

    expect(run(1)).toBe('applied')
    expect(surface()).toBe(0)
    expect(requested).toEqual(['/cinema2/textures/wet-concrete-1024.webp'])

    gate.resolve(image(1024, 1024))
    await flush()
    run(2)
    expect(surface()).toBe(0) // fade-in starts on the first frame the texture is ready
    run(2.3)
    expect(surface()).toBeGreaterThan(0.3)
    expect(surface()).toBeLessThan(0.7)
    run(3)
    expect(surface()).toBe(1)
    expect(service.getSnapshot().textureCount).toBe(1)

    runtime.setQuality('low')
    run(4)
    expect(requested).toContain('/cinema2/textures/wet-concrete-512.webp')
    expect(surface()).toBe(0) // the low-tier variant is still loading
    expect(service.getSnapshot().entries.map(entry => entry.url)).toEqual(['/cinema2/textures/wet-concrete-512.webp'])

    runtime.dispose()
    expect(service.getSnapshot().entries).toEqual([])
    service.dispose()
  })
})

describe('Cinema 2.0 shipped asset manifest', () => {
  it('fills both runtime registries from the generated manifest, with a license on every record', () => {
    for (const record of CINEMA2_ASSET_RECORDS) {
      expect(record.license).toBeTruthy()
      expect(record.kind === 'model' ? cinema2ThreeAssetRegistry.has(record.id) : cinema2TextureAssetRegistry.has(record.id)).toBe(true)
    }
    expect(cinema2ThreeAssetRegistry.list().length + cinema2TextureAssetRegistry.list().length).toBe(CINEMA2_ASSET_RECORDS.length)
  })

  it('keeps every first-party preset within the shipped-asset GPU budget of each quality tier', () => {
    // Same numbers as `assetGpuBytes` in scripts/cinema2-assets/assets-core.mjs: 20% of the 96 / 160 / 256 MB tier budgets.
    const budgets = { low: 20132659, medium: 33554432, high: 53687091 }
    const byId = new Map(CINEMA2_ASSET_RECORDS.map(record => [record.id as string, record]))
    for (const declaration of CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS) {
      const manifest = declaration.manifest
      const referenced = new Set<string>()
      for (const module of manifest.modules ?? []) {
        const instances = (module.config as { instances?: readonly { asset?: string }[] } | undefined)?.instances
        for (const instance of instances ?? []) if (instance.asset) referenced.add(instance.asset)
      }
      for (const effect of manifest.effects ?? []) {
        const texture = effect.parameters?.surfaceTexture
        if (typeof texture === 'string') referenced.add(texture)
      }
      for (const id of referenced) expect(byId.has(id), `${manifest.id} references unknown asset "${id}"`).toBe(true)
      for (const tier of ['low', 'medium', 'high'] as const) {
        const total = [...referenced].reduce((sum, id) => sum + (byId.get(id)?.gpuBytes[tier] ?? 0), 0)
        expect(total, `${manifest.id} uses ${total} bytes of shipped assets on ${tier}`).toBeLessThanOrEqual(budgets[tier])
      }
    }
  })
})

import { describe, expect, it, vi } from 'vitest'
import { createCinemaMockWebGL } from '../../../../test/support/CinemaWebGLTestUtils'
import {
  CINEMA2_RENDER_QUALITY_PROFILES,
  Cinema2DynamicResolution,
  resolveCinema2RenderFeatures,
  type Cinema2RenderCapabilities,
} from '../render/Cinema2RenderQualityProfiles'
import { Cinema2RenderTargetPool, getCinema2RenderTargetPool } from '../runtime/Cinema2RenderTargetPool'
import { Cinema2ThreeResourceLedger } from '../modules/three/Cinema2ThreeResourceLedger'

const CAPABILITIES: Cinema2RenderCapabilities = Object.freeze({
  floatColorTargets: true, floatLinearFiltering: true, gpuTimerQuery: true, parallelShaderCompile: true, maxTextureSize: 8192, maxAnisotropy: 16,
  compressedTextures: { astc: false, etc2: false, s3tc: true, bptc: true, pvrtc: false },
})

describe('Cinema 2.0 render quality profiles', () => {
  it('follows the documented tier table', () => {
    const { low, medium, high } = CINEMA2_RENDER_QUALITY_PROFILES
    expect([low.antiAliasing.auto, medium.antiAliasing.auto, high.antiAliasing.auto]).toEqual(['fxaa', 'smaa', 'smaa'])
    expect([low.ambientOcclusion.enabled, medium.ambientOcclusion.enabled, high.ambientOcclusion.enabled]).toEqual([false, true, true])
    expect(high.ambientOcclusion.samples).toBeGreaterThan(medium.ambientOcclusion.samples)
    expect(high.ambientOcclusion.resolutionScale).toBe(1)
    expect([low.shadows.mapSize, medium.shadows.mapSize, high.shadows.mapSize]).toEqual([512, 1024, 2048])
    expect(low.environment.maxSourceWidth).toBeLessThan(medium.environment.maxSourceWidth)
    expect(medium.environment.maxSourceWidth).toBeLessThan(high.environment.maxSourceWidth)
    expect([low.textureFiltering.anisotropy, medium.textureFiltering.anisotropy, high.textureFiltering.anisotropy]).toEqual([1, 4, 16])
    expect([low.modelDetail.preferredLevel, medium.modelDetail.preferredLevel, high.modelDetail.preferredLevel]).toEqual(['optimized', 'balanced', 'detailed'])
    expect(low.pbr.transmission).toBe(false)
    expect(high.pbr.iridescence).toBe(true)
  })

  it('steps a request down to what the GPU can do and explains why, without throwing', () => {
    const limited = { ...CAPABILITIES, maxAnisotropy: 4, floatColorTargets: false, maxTextureSize: 512 }
    const resolved = resolveCinema2RenderFeatures('high', limited, { antiAliasing: 'smaa' })
    expect(resolved.antiAliasing).toBe('fxaa')
    expect(resolved.textureAnisotropy).toBe(4)
    expect(resolved.ambientOcclusion.denoiseTaps).toBeLessThanOrEqual(2)
    expect(resolved.downgrades.map(entry => entry.feature).sort()).toEqual(['ambient-occlusion', 'anti-aliasing', 'texture-filtering'])
  })

  it('lets a scene force ambient occlusion off and leaves low-tier AO off', () => {
    expect(resolveCinema2RenderFeatures('high', CAPABILITIES, { ambientOcclusion: false }).ambientOcclusion.enabled).toBe(false)
    expect(resolveCinema2RenderFeatures('low', CAPABILITIES).ambientOcclusion.enabled).toBe(false)
    expect(resolveCinema2RenderFeatures('medium', CAPABILITIES).downgrades).toEqual([])
  })

  it('moves dynamic resolution in quantized steps with hysteresis', () => {
    const controller = new Cinema2DynamicResolution({ targetFrameMs: 16.7, step: 0.125, slowFrames: 4, fastFrames: 10 })
    expect(controller.getScale()).toBe(1)
    for (let i = 0; i < 30; i += 1) controller.sample(30)
    expect(controller.getScale()).toBeLessThan(1)
    expect(controller.getScale()).toBeGreaterThanOrEqual(0.5)
    expect((1 - controller.getScale()) / 0.125).toBeCloseTo(Math.round((1 - controller.getScale()) / 0.125), 6)
    const lowered = controller.getScale()
    for (let i = 0; i < 12; i += 1) controller.sample(16.7)
    expect(controller.getScale()).toBe(lowered)
    for (let i = 0; i < 200; i += 1) controller.sample(5)
    expect(controller.getScale()).toBe(1)
    expect(controller.sample(Number.NaN)).toBe(1)
  })
})

describe('Cinema2RenderTargetPool', () => {
  it('reuses a released target instead of allocating again', () => {
    const gl = createCinemaMockWebGL()
    const pool = new Cinema2RenderTargetPool(gl)
    const a = pool.acquire(640, 360, 'rgba16f')
    pool.release(a)
    const b = pool.acquire(640, 360, 'rgba16f')
    expect(b).toBe(a)
    expect(pool.getStats()).toMatchObject({ totalAllocations: 1, reuseCount: 1, liveCount: 1 })
    expect(gl.__calls.createdTextures).toBe(1)
  })

  it('keeps targets of different sizes and formats apart and counts bytes', () => {
    const gl = createCinemaMockWebGL()
    const pool = new Cinema2RenderTargetPool(gl)
    const a = pool.acquire(100, 100, 'rgba8')
    const b = pool.acquire(100, 100, 'r8')
    const c = pool.acquire(200, 100, 'rgba8')
    expect(new Set([a, b, c]).size).toBe(3)
    expect(pool.getStats().allocatedBytes).toBe(100 * 100 * 4 + 100 * 100 + 200 * 100 * 4)
  })

  it('deletes idle targets after the idle window and on flush, and leaves live ones alone', () => {
    const gl = createCinemaMockWebGL()
    let now = 0
    const pool = new Cinema2RenderTargetPool(gl, { idleMs: 1000, now: () => now })
    const kept = pool.acquire(64, 64, 'rgba8')
    const dropped = pool.acquire(32, 32, 'rgba8')
    pool.release(dropped)
    now = 1500
    pool.acquire(16, 16, 'rgba8')
    expect(gl.__calls.deletedTextures).toBe(1)
    expect(pool.getStats().liveCount).toBe(2)
    pool.release(kept)
    pool.flush()
    expect(gl.__calls.deletedTextures).toBe(2)
    expect(pool.getStats().idleCount).toBe(0)
  })

  it('falls back to 8-bit when float targets are unavailable', () => {
    const gl = createCinemaMockWebGL()
    gl.getExtension = vi.fn(() => null)
    const pool = new Cinema2RenderTargetPool(gl)
    const target = pool.acquire(10, 10, 'rgba16f')
    expect(target.format).toBe('rgba8')
    expect(target.requestedFormat).toBe('rgba16f')
  })

  it('forgets handles on context loss without touching GL, and disposes everything', () => {
    const gl = createCinemaMockWebGL()
    const pool = new Cinema2RenderTargetPool(gl)
    pool.acquire(8, 8, 'rgba8')
    pool.handleContextLost()
    expect(pool.getStats().allocatedBytes).toBe(0)
    expect(gl.__calls.deletedTextures).toBe(0)
    pool.acquire(8, 8, 'rgba8')
    pool.dispose()
    expect(gl.__calls.deletedTextures).toBe(1)
    expect(() => pool.acquire(8, 8, 'rgba8')).toThrow(/disposed/)
  })

  it('shares one pool per context', () => {
    const gl = createCinemaMockWebGL()
    expect(getCinema2RenderTargetPool(gl)).toBe(getCinema2RenderTargetPool(gl))
  })
})

describe('Cinema2ThreeResourceLedger', () => {
  it('disposes a shared resource only when its last holder releases it', () => {
    const ledger = new Cinema2ThreeResourceLedger()
    const dispose = vi.fn()
    const texture = { dispose }
    ledger.retain(texture)
    ledger.retain(texture)
    expect(ledger.release(texture)).toBe(false)
    expect(dispose).not.toHaveBeenCalled()
    expect(ledger.release(texture)).toBe(true)
    expect(dispose).toHaveBeenCalledTimes(1)
    expect(ledger.release(texture)).toBe(false)
    expect(ledger.getSnapshot()).toMatchObject({ liveCount: 0, disposedCount: 1 })
  })

  it('clear() disposes everything still held, tolerating a failing dispose', () => {
    const ledger = new Cinema2ThreeResourceLedger()
    const ok = { dispose: vi.fn() }
    ledger.retain({ dispose: () => { throw new Error('lost context') } })
    ledger.retain(ok)
    ledger.clear()
    expect(ok.dispose).toHaveBeenCalled()
    expect(ledger.getSnapshot().liveCount).toBe(0)
  })
})

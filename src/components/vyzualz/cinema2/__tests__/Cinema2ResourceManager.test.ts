import { describe, expect, it, vi } from 'vitest'
import { createCinemaMockWebGL } from '../../cinema/__tests__/CinemaWebGLTestUtils'
import {
  Cinema2ResourceManager,
  type Cinema2RenderTargetDescriptor,
} from '../runtime/Cinema2ResourceManager'

const VIEWPORT_TARGET: Cinema2RenderTargetDescriptor = {
  size: { kind: 'viewport' },
  colorFormat: 'rgba8',
}

describe('Cinema2ResourceManager', () => {
  it('allocates, pools, reuses only descriptor-compatible targets, and keeps depth optional', () => {
    const gl = createCinemaMockWebGL()
    const manager = new Cinema2ResourceManager(gl)
    manager.resize({ width: 320, height: 180, dpr: 1 })

    const first = manager.acquireRenderTarget('render.pass.foundation', VIEWPORT_TARGET, 'transient')
    expect(manager.getRenderTargetBinding(first)).toMatchObject({ width: 320, height: 180, surfaceIndex: 0 })
    expect(gl.__calls.createdTextures).toBe(1)
    expect(gl.__calls.createdRenderbuffers).toBe(0)
    manager.release(first)

    const reused = manager.acquireRenderTarget('render.pass.reused', VIEWPORT_TARGET, 'transient')
    expect(reused.leaseId).not.toBe(first.leaseId)
    expect(gl.__calls.createdTextures).toBe(1)
    expect(manager.getSnapshot()).toMatchObject({ reusedAllocationCount: 1, activeLeaseCount: 1, pooledAllocationCount: 0 })
    manager.release(reused)

    const depth = manager.acquireRenderTarget('render.pass.depth', {
      ...VIEWPORT_TARGET,
      depthFormat: 'depth24',
    }, 'persistent')
    expect(gl.__calls.createdTextures).toBe(2)
    expect(gl.__calls.createdRenderbuffers).toBe(1)
    expect(manager.getRenderTargetBinding(depth).depthRenderbuffer).not.toBeNull()
    expect(manager.getSnapshot()).toMatchObject({ activePersistentLeaseCount: 1, pooledAllocationCount: 1 })

    manager.release(depth)
    manager.dispose()
    expect(gl.__calls.deletedTextures).toBe(gl.__calls.createdTextures)
    expect(gl.__calls.deletedRenderbuffers).toBe(gl.__calls.createdRenderbuffers)
    expect(gl.__calls.deletedFramebuffers).toBe(gl.__calls.createdFramebuffers)
  })

  it('tracks transient and persistent ownership explicitly and can retire by lifetime or owner', () => {
    const manager = new Cinema2ResourceManager(createCinemaMockWebGL())
    const transientA = manager.acquireRenderTarget('owner.a', VIEWPORT_TARGET, 'transient')
    manager.acquireRenderTarget('owner.a', { ...VIEWPORT_TARGET, colorFormat: 'r8' }, 'persistent')
    manager.acquireRenderTarget('owner.b', VIEWPORT_TARGET, 'transient')

    expect(manager.getSnapshot()).toMatchObject({
      activeLeaseCount: 3,
      activeTransientLeaseCount: 2,
      activePersistentLeaseCount: 1,
      activeLeaseCountByOwner: { 'owner.a': 2, 'owner.b': 1 },
    })

    manager.releaseTransient('owner.a')
    expect(() => manager.getRenderTargetBinding(transientA)).toThrow(/not active/i)
    expect(manager.getSnapshot()).toMatchObject({
      activeLeaseCount: 2,
      activeTransientLeaseCount: 1,
      activePersistentLeaseCount: 1,
      activeLeaseCountByOwner: { 'owner.a': 1, 'owner.b': 1 },
    })

    manager.releaseOwner('owner.a')
    expect(manager.getSnapshot()).toMatchObject({ activeLeaseCount: 1, activeLeaseCountByOwner: { 'owner.b': 1 } })
    manager.releaseTransient()
    expect(manager.getSnapshot().activeLeaseCount).toBe(0)
    manager.dispose()
  })

  it('resizes viewport-relative targets atomically while leaving fixed-size targets unchanged', () => {
    const gl = createCinemaMockWebGL()
    const manager = new Cinema2ResourceManager(gl)
    manager.resize({ width: 100, height: 50, dpr: 1 })
    const viewportLease = manager.acquireRenderTarget('viewport-owner', VIEWPORT_TARGET, 'persistent')
    const fixedLease = manager.acquireRenderTarget('fixed-owner', {
      size: { kind: 'fixed', width: 32, height: 16 },
      colorFormat: 'rgba8',
    }, 'persistent')
    const originalViewportTexture = manager.getRenderTargetBinding(viewportLease).colorTexture
    const originalFixedTexture = manager.getRenderTargetBinding(fixedLease).colorTexture

    expect(manager.resize({ width: 200, height: 120, dpr: 2 })).toBe(true)
    expect(manager.getRenderTargetBinding(viewportLease)).toMatchObject({ width: 200, height: 120 })
    expect(manager.getRenderTargetBinding(viewportLease).colorTexture).not.toBe(originalViewportTexture)
    expect(manager.getRenderTargetBinding(fixedLease)).toMatchObject({ width: 32, height: 16 })
    expect(manager.getRenderTargetBinding(fixedLease).colorTexture).toBe(originalFixedTexture)
    expect(manager.getSnapshot().reconstructedAllocationCount).toBe(1)
    manager.dispose()
  })

  it('abandons lost-context handles and reconstructs active leases without orphaning pooled resources', () => {
    const gl = createCinemaMockWebGL()
    const manager = new Cinema2ResourceManager(gl)
    manager.resize({ width: 160, height: 90, dpr: 1 })
    const persistent = manager.acquireRenderTarget('history-seam', {
      ...VIEWPORT_TARGET,
      surfaceLayout: 'paired',
      depthFormat: 'depth16',
    }, 'persistent')
    const pooled = manager.acquireRenderTarget('temporary', VIEWPORT_TARGET, 'transient')
    manager.release(pooled)
    const createdBeforeLoss = { ...gl.__calls }

    expect(manager.getSurfaceCount(persistent)).toBe(2)
    manager.handleContextLost()
    expect(manager.getSnapshot()).toMatchObject({
      contextAvailable: false,
      activeLeaseCount: 1,
      pooledAllocationCount: 0,
      estimatedGpuMemoryBytes: 0,
    })
    expect(gl.__calls.deletedTextures).toBe(createdBeforeLoss.deletedTextures)
    expect(() => manager.getRenderTargetBinding(persistent)).toThrow(/context is unavailable/i)

    manager.handleContextRestored()
    expect(manager.getSnapshot()).toMatchObject({
      contextAvailable: true,
      activeLeaseCount: 1,
      activeSurfaceCount: 2,
      reconstructedAllocationCount: 1,
    })
    expect(manager.getRenderTargetBinding(persistent, 0).colorTexture).not.toBeNull()
    expect(manager.getRenderTargetBinding(persistent, 1).colorTexture).not.toBeNull()
    manager.dispose()
  })

  it('reports memory/accounting sanely and cleans partial allocation failures', () => {
    const gl = createCinemaMockWebGL()
    const manager = new Cinema2ResourceManager(gl)
    const lease = manager.acquireRenderTarget('memory-owner', {
      size: { kind: 'fixed', width: 100, height: 50 },
      colorFormat: 'rgba8',
      depthFormat: 'depth24',
      surfaceLayout: 'paired',
    }, 'persistent')
    expect(manager.getSnapshot()).toMatchObject({
      activeLeaseCount: 1,
      activeSurfaceCount: 2,
      estimatedGpuMemoryBytes: 80_000,
    })
    expect(manager.getSurfaceCount(lease)).toBe(2)

    const failingGl = createCinemaMockWebGL()
    failingGl.checkFramebufferStatus = vi.fn(() => 0) as typeof failingGl.checkFramebufferStatus
    const failingManager = new Cinema2ResourceManager(failingGl)
    expect(() => failingManager.acquireRenderTarget('bad-target', VIEWPORT_TARGET, 'transient')).toThrow(/incomplete/i)
    expect(failingManager.getSnapshot()).toMatchObject({ activeLeaseCount: 0, pooledAllocationCount: 0 })
    expect(failingGl.__calls.deletedTextures).toBe(failingGl.__calls.createdTextures)
    expect(failingGl.__calls.deletedFramebuffers).toBe(failingGl.__calls.createdFramebuffers)

    const noFloatGl = createCinemaMockWebGL()
    noFloatGl.getExtension = vi.fn(() => null) as typeof noFloatGl.getExtension
    const noFloatManager = new Cinema2ResourceManager(noFloatGl)
    expect(() => noFloatManager.acquireRenderTarget('float-target', {
      size: { kind: 'fixed', width: 16, height: 16 },
      colorFormat: 'rgba16f',
    }, 'transient')).toThrow(/EXT_color_buffer_float/)
    expect(noFloatManager.getSnapshot().activeLeaseCount).toBe(0)

    manager.dispose()
    expect(manager.getSnapshot()).toMatchObject({
      disposed: true,
      contextAvailable: false,
      activeLeaseCount: 0,
      pooledAllocationCount: 0,
      estimatedGpuMemoryBytes: 0,
    })
    failingManager.dispose()
    noFloatManager.dispose()
  })
})

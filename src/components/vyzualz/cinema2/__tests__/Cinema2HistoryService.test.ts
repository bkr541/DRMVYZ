import { describe, expect, it } from 'vitest'
import { createCinemaMockWebGL } from '../../cinema/__tests__/CinemaWebGLTestUtils'
import { cinema2NamespacedId, type Cinema2PresetId } from '../contracts/Cinema2NativePresetManifest'
import { Cinema2HistoryService } from '../runtime/Cinema2HistoryService'
import { Cinema2ResourceManager } from '../runtime/Cinema2ResourceManager'

const PRESET_A = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.history-test-a')
const PRESET_B = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.history-test-b')

describe('Cinema2HistoryService', () => {
  it('owns named ping-pong direction explicitly and accounts paired temporal memory through Resource Manager', () => {
    const gl = createCinemaMockWebGL()
    const resources = new Cinema2ResourceManager(gl)
    const history = new Cinema2HistoryService(gl, resources, PRESET_A)

    const first = history.beginFrame('trails', 100, 50)
    expect(first).not.toBeNull()
    if (!first) return
    expect(first.valid).toBe(false)
    expect(first.read.surfaceIndex).toBe(0)
    expect(first.write.surfaceIndex).toBe(1)
    expect(history.getSnapshot()).toMatchObject({
      activeBufferCount: 1,
      validBufferCount: 0,
      activeSurfaceCount: 2,
      estimatedGpuMemoryBytes: 40_000,
    })
    expect(resources.getSnapshot()).toMatchObject({
      activePersistentLeaseCount: 1,
      activeSurfaceCount: 2,
      estimatedGpuMemoryBytes: 40_000,
    })

    expect(history.commit('trails')).toBe(true)
    const second = history.beginFrame('trails', 100, 50)
    expect(second).not.toBeNull()
    expect(second?.valid).toBe(true)
    expect(second?.read.surfaceIndex).toBe(1)
    expect(second?.write.surfaceIndex).toBe(0)
    expect(second?.read.colorTexture).toBe(first.write.colorTexture)
    expect(history.getSnapshot().validBufferCount).toBe(1)

    history.dispose()
    resources.dispose()
    expect(gl.__calls.deletedTextures).toBe(gl.__calls.createdTextures)
    expect(gl.__calls.deletedFramebuffers).toBe(gl.__calls.createdFramebuffers)
  })

  it('resets, rebuilds after resize/context restoration, and never preserves a valid stale frame', () => {
    const gl = createCinemaMockWebGL()
    const resources = new Cinema2ResourceManager(gl)
    const history = new Cinema2HistoryService(gl, resources, PRESET_A)

    const initial = history.beginFrame('feedback', 64, 32)
    expect(initial).not.toBeNull()
    history.commit('feedback')
    expect(history.getSnapshot().validBufferCount).toBe(1)

    expect(history.resetBuffer('feedback', 'manual')).toBe(true)
    expect(history.getSnapshot()).toMatchObject({ validBufferCount: 0, lastResetReason: 'manual' })

    const textureBeforeResize = history.beginFrame('feedback', 64, 32)?.read.colorTexture
    history.handleResize()
    expect(history.getSnapshot()).toMatchObject({ activeBufferCount: 0, validBufferCount: 0, lastResetReason: 'resize' })
    expect(resources.getSnapshot().activePersistentLeaseCount).toBe(0)
    const afterResize = history.beginFrame('feedback', 128, 64)
    expect(afterResize?.valid).toBe(false)
    expect(afterResize?.read.colorTexture).not.toBe(textureBeforeResize)
    history.commit('feedback')

    history.handleContextLost()
    resources.handleContextLost()
    expect(history.getSnapshot()).toMatchObject({ contextAvailable: false, validBufferCount: 0, lastResetReason: 'context-lost' })
    resources.handleContextRestored()
    history.handleContextRestored()
    expect(history.getSnapshot()).toMatchObject({ contextAvailable: true, validBufferCount: 0, lastResetReason: 'context-restored' })
    expect(history.beginFrame('feedback', 128, 64)?.valid).toBe(false)

    history.dispose()
    resources.dispose()
  })

  it('enforces temporal budgets with safe allocation refusal', () => {
    const gl = createCinemaMockWebGL()
    const resources = new Cinema2ResourceManager(gl)
    const history = new Cinema2HistoryService(gl, resources, PRESET_A, {
      maximumBufferCount: 1,
      maximumEstimatedGpuMemoryBytes: 8 * 8 * 4 * 2,
    })

    expect(history.beginFrame('first', 8, 8)).not.toBeNull()
    expect(history.beginFrame('second', 8, 8)).toBeNull()
    expect(history.getSnapshot()).toMatchObject({
      activeBufferCount: 1,
      estimatedGpuMemoryBytes: 512,
    })
    expect(history.getSnapshot().lastDiagnostic).toContain('budget')
    expect(resources.getSnapshot().activePersistentLeaseCount).toBe(1)

    history.dispose()
    resources.dispose()
  })

  it('destroys prior-preset temporal surfaces so a new preset cannot observe stale history', () => {
    const gl = createCinemaMockWebGL()
    const resources = new Cinema2ResourceManager(gl)
    const firstPresetHistory = new Cinema2HistoryService(gl, resources, PRESET_A)
    const firstFrame = firstPresetHistory.beginFrame('shared-name', 32, 32)
    expect(firstFrame).not.toBeNull()
    firstPresetHistory.commit('shared-name')
    const staleTexture = firstPresetHistory.beginFrame('shared-name', 32, 32)?.read.colorTexture
    expect(firstPresetHistory.getSnapshot().validBufferCount).toBe(1)

    firstPresetHistory.dispose()
    expect(resources.getSnapshot()).toMatchObject({ activePersistentLeaseCount: 0, pooledAllocationCount: 0 })

    const secondPresetHistory = new Cinema2HistoryService(gl, resources, PRESET_B)
    const freshFrame = secondPresetHistory.beginFrame('shared-name', 32, 32)
    expect(freshFrame?.valid).toBe(false)
    expect(freshFrame?.read.colorTexture).not.toBe(staleTexture)

    secondPresetHistory.dispose()
    resources.dispose()
  })
})

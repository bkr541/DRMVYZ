import { expect, test } from '@playwright/test'

test('Cinema owns one real WebGL2 runtime and recovers its target pool', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))
  await page.goto(process.env.DRMVYZ_CINEMA_RUNTIME_PAGE ?? '/cinema-runtime.html')
  const status = page.locator('[data-cinema-runtime-status]')
  await expect(status).toHaveAttribute('data-result', 'ready', { timeout: 30_000 })
  const payload = JSON.parse(await status.textContent() ?? '{}') as {
    reusedTarget?: boolean
    phase?: string
    contextGeneration?: number
    frameCount?: number
    phases?: string[]
    poolBeforeDispose?: { activeLeaseCount?: number; pooledAllocationCount?: number }
    graph?: { activeNodeCount?: number; initializedNodeCount?: number; failedNodeCount?: number; outputRendered?: boolean; safeOutputActive?: boolean }
    telemetry?: { context?: { generation?: number; recoveryCount?: number; lastRecoveryStatus?: string }; frameTime?: { sampleCount?: number }; targets?: { estimatedAllocationMemoryMb?: number }; quality?: { selectedTier?: string; degradedNodeCount?: number } }
    singlePassPixel?: number[]
    reactorPixel?: number[]
    reactorLeaseCount?: number
    representativeCinematicPixel?: number[]
    representativeCinematicFailedNodeCount?: number
    reactiveConstellationPixel?: number[]
    reactiveConstellationFailedNodeCount?: number
    legacyPortalPixel?: number[]
    legacyPortalFailedNodeCount?: number
    electricStormPixel?: number[]
    electricStormFailedNodeCount?: number
    postRestorePixel?: number[]
    electricStormPostRestoreFailedNodeCount?: number
    webgl2GetContextCount?: number
    maximumPendingRuntimeFrames?: number
    pendingRuntimeFrameCountAfterDispose?: number
    disposedPhase?: string
    frameCountStableAfterDispose?: boolean
  }

  expect(payload.reusedTarget).toBe(true)
  expect(payload.phase).toBe('running')
  expect(payload.contextGeneration).toBe(2)
  expect(payload.telemetry?.context).toMatchObject({ generation: 2, recoveryCount: 1, lastRecoveryStatus: 'restored' })
  expect(payload.telemetry?.frameTime?.sampleCount).toBeGreaterThan(0)
  expect(payload.telemetry?.targets?.estimatedAllocationMemoryMb).toBeGreaterThanOrEqual(0)
  expect(['low', 'medium', 'high', 'ultra']).toContain(payload.telemetry?.quality?.selectedTier)
  expect(payload.frameCount).toBeGreaterThanOrEqual(3)
  expect(payload.phases).toEqual(expect.arrayContaining(['running', 'context-lost']))
  expect(payload.poolBeforeDispose?.activeLeaseCount).toBe(0)
  expect(payload.poolBeforeDispose?.pooledAllocationCount).toBeGreaterThanOrEqual(1)
  expect(payload.graph).toMatchObject({
    activeNodeCount: 2, initializedNodeCount: 2, failedNodeCount: 0, outputRendered: true, safeOutputActive: false,
  })
  expect(payload.singlePassPixel?.[3]).toBeGreaterThan(0)
  expect((payload.singlePassPixel?.[0] ?? 0) + (payload.singlePassPixel?.[1] ?? 0) + (payload.singlePassPixel?.[2] ?? 0)).toBeGreaterThan(0)
  expect(payload.reactorPixel?.[3]).toBeGreaterThan(0)
  expect((payload.reactorPixel?.[0] ?? 0) + (payload.reactorPixel?.[1] ?? 0) + (payload.reactorPixel?.[2] ?? 0)).toBeGreaterThan(0)
  expect(payload.reactorLeaseCount).toBe(1)
  expect(payload.representativeCinematicPixel?.[3]).toBeGreaterThan(0)
  expect((payload.representativeCinematicPixel?.[0] ?? 0) + (payload.representativeCinematicPixel?.[1] ?? 0) + (payload.representativeCinematicPixel?.[2] ?? 0)).toBeGreaterThan(0)
  expect(payload.representativeCinematicFailedNodeCount).toBe(0)
  expect(payload.reactiveConstellationPixel?.[3]).toBeGreaterThan(0)
  expect((payload.reactiveConstellationPixel?.[0] ?? 0) + (payload.reactiveConstellationPixel?.[1] ?? 0) + (payload.reactiveConstellationPixel?.[2] ?? 0)).toBeGreaterThan(0)
  expect(payload.reactiveConstellationFailedNodeCount).toBe(0)
  expect(payload.legacyPortalPixel?.[3]).toBeGreaterThan(0)
  expect(payload.legacyPortalFailedNodeCount).toBe(0)
  expect(payload.electricStormPixel?.[3]).toBeGreaterThan(0)
  expect((payload.electricStormPixel?.[0] ?? 0) + (payload.electricStormPixel?.[1] ?? 0) + (payload.electricStormPixel?.[2] ?? 0)).toBeGreaterThan(0)
  expect(payload.electricStormFailedNodeCount).toBe(0)
  expect(payload.postRestorePixel?.[3]).toBeGreaterThan(0)
  expect((payload.postRestorePixel?.[0] ?? 0) + (payload.postRestorePixel?.[1] ?? 0) + (payload.postRestorePixel?.[2] ?? 0)).toBeGreaterThan(0)
  expect(payload.electricStormPostRestoreFailedNodeCount).toBe(0)
  expect(payload.webgl2GetContextCount).toBe(1)
  expect(payload.maximumPendingRuntimeFrames).toBe(1)
  expect(payload.pendingRuntimeFrameCountAfterDispose).toBe(0)
  expect(payload.disposedPhase).toBe('disposed')
  expect(payload.frameCountStableAfterDispose).toBe(true)
  expect(pageErrors).toEqual([])
})

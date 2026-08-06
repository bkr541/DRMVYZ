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
    webgl2GetContextCount?: number
    maximumPendingRuntimeFrames?: number
    pendingRuntimeFrameCountAfterDispose?: number
    disposedPhase?: string
    frameCountStableAfterDispose?: boolean
  }

  expect(payload.reusedTarget).toBe(true)
  expect(payload.phase).toBe('running')
  expect(payload.contextGeneration).toBe(2)
  expect(payload.frameCount).toBeGreaterThanOrEqual(3)
  expect(payload.phases).toEqual(expect.arrayContaining(['running', 'context-lost']))
  expect(payload.poolBeforeDispose).toMatchObject({ activeLeaseCount: 0, pooledAllocationCount: 1 })
  expect(payload.webgl2GetContextCount).toBe(1)
  expect(payload.maximumPendingRuntimeFrames).toBe(1)
  expect(payload.pendingRuntimeFrameCountAfterDispose).toBe(0)
  expect(payload.disposedPhase).toBe('disposed')
  expect(payload.frameCountStableAfterDispose).toBe(true)
  expect(pageErrors).toEqual([])
})

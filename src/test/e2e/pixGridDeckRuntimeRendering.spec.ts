import { expect, test } from '@playwright/test'

test('real PixGridSurface renders Deck frames through WebGL and Canvas', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))
  await page.goto(process.env.DRMVYZ_PIX_GRID_DECK_RUNTIME_PAGE ?? '/pix-grid-deck-runtime.html')
  const status = page.locator('[data-pix-grid-deck-runtime-status]')
  await expect(status).toHaveAttribute('data-result', 'ready', { timeout: 45_000 })
  const payload = JSON.parse(await status.textContent() ?? '{}') as {
    parity?: boolean
    loopReconstructed?: boolean
    motionFrozen?: boolean
    motionResumed?: boolean
    playbackStoreMutationFree?: boolean
    seekChangedFrame?: boolean
    generatedGroupCount?: number
    presetSwitchSafe?: boolean
    deletedSafe?: boolean
    webgl?: { rendererPath?: string; deckRuntimeStatus?: string; pixelHash?: string }
    canvas?: { rendererPath?: string; deckRuntimeStatus?: string; pixelHash?: string }
    qualityPending?: { deckRuntimeStatus?: string }
    qualityReady?: { deckRuntimeStatus?: string; logicalWidth?: number; logicalHeight?: number }
    deleted?: { deckRuntimeStatus?: string; activeCellCount?: number }
    restored?: { deckRuntimeStatus?: string; logicalWidth?: number; logicalHeight?: number }
  }
  expect(payload.parity).toBe(true)
  expect(payload.loopReconstructed).toBe(true)
  expect(payload.motionFrozen).toBe(true)
  expect(payload.motionResumed).toBe(true)
  expect(payload.playbackStoreMutationFree).toBe(true)
  expect(payload.seekChangedFrame).toBe(true)
  expect(payload.generatedGroupCount).toBe(6)
  expect(payload.presetSwitchSafe).toBe(true)
  expect(payload.deletedSafe).toBe(true)
  expect(payload.webgl).toMatchObject({ rendererPath: 'webgl2', deckRuntimeStatus: 'ready' })
  expect(payload.canvas).toMatchObject({ rendererPath: 'canvas2d-fallback', deckRuntimeStatus: 'ready' })
  expect(payload.webgl?.pixelHash).toBe(payload.canvas?.pixelHash)
  expect(payload.qualityPending?.deckRuntimeStatus).not.toBe('ready')
  expect(payload.qualityReady).toMatchObject({ deckRuntimeStatus: 'ready', logicalWidth: 96, logicalHeight: 54 })
  expect(payload.deleted).toMatchObject({ deckRuntimeStatus: 'missing-deck', activeCellCount: 0 })
  expect(payload.restored).toMatchObject({ deckRuntimeStatus: 'ready', logicalWidth: 64, logicalHeight: 36 })
  expect(pageErrors).toEqual([])
})

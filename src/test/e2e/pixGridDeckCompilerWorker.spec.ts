import { expect, test } from '@playwright/test'

test('real coordinator compiles through the bundled PixGrid Deck worker', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))
  await page.goto(process.env.DRMVYZ_PIX_GRID_DECK_COMPILER_PAGE ?? '/pix-grid-deck-compiler.html')
  const status = page.locator('[data-pix-grid-deck-worker-status]')
  await expect(status).toHaveAttribute('data-result', 'ready', { timeout: 15_000 })
  await expect(status).toHaveAttribute('data-phase', 'ready')
  const payload = JSON.parse(await status.textContent() ?? '{}') as {
    frameCount?: number
    masks?: string[]
    diagnostics?: { runningJobCount?: number; cacheEntryCount?: number }
  }
  expect(payload.frameCount).toBe(2)
  expect(payload.masks).toEqual(['background', 'border', 'center', 'foreground', 'highlights', 'shadows'])
  expect(payload.diagnostics).toMatchObject({ runningJobCount: 0, cacheEntryCount: 2 })
  expect(pageErrors).toEqual([])
})

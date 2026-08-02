import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

function statusPayload(text: string | null) {
  return JSON.parse(text ?? '{}') as {
    deckCount?: number
    deck?: { name?: string; itemCount?: number; enabledItemCount?: number; presetCreated?: boolean; generatedPresetId?: string }
    generatedPreset?: { deckId?: string; deckRevision?: number } | null
    activeReactPresetId?: string
    pixGridOrigin?: string
    mediaCount?: number
    compile?: { ready?: boolean; progress?: number } | null
    transitions?: { ready?: boolean; progress?: number } | null
    audio?: { trackId?: string | null; trackName?: string | null; analysisStatus?: string; analyzedBpm?: number | null }
    portability?: {
      exportedSourceCount?: number
      importedMediaCount?: number
      missingMediaIds?: string[]
      errorCount?: number
      sourceIdsChanged?: boolean
    } | null
  }
}

test('release Show Manager creates, plays, exports, and imports a 12-image Deck with selected-track intelligence', async ({ page }) => {
  test.skip(process.env.DRMVYZ_PIX_GRID_DECK_SHOW_MANAGER_BROWSER !== '1', 'Run through the PixGrid Deck release browser harness script.')
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))

  await page.goto(process.env.DRMVYZ_PIX_GRID_DECK_SHOW_MANAGER_PAGE ?? '/pix-grid-deck-show-manager.html')
  const status = page.locator('[data-pix-grid-deck-show-manager-status]')
  await expect(status).toHaveAttribute('data-result', 'ready', { timeout: 30_000 })
  await expect(page.getByLabel('Show Manager workspace')).toBeVisible({ timeout: 30_000 })

  await page.locator('input[type="file"][accept="audio/*"]').setInputFiles(
    'src/test/fixtures/pixGridDeck/stage-8-selected-track.wav',
  )
  await expect(page.locator('.vz-dock-track-title')).toContainText('stage-8-selected-track', { timeout: 30_000 })
  await expect.poll(async () => statusPayload(await status.textContent()).audio?.trackName, { timeout: 30_000 }).toContain('stage-8-selected-track')

  const createDeck = page.getByRole('button', { name: 'Create Deck' })
  await expect(createDeck).toHaveCount(1)
  await createDeck.click()
  await expect(page.getByLabel('Show Manager Deck images')).toBeVisible()
  await expect(page.getByLabel('Show Manager Deck Builder inspector')).toBeVisible()
  await expect(page.locator('.vz-dock-track-title')).toContainText('stage-8-selected-track')

  await page.locator('.sm-deck-text-input').fill('Browser Release Deck')
  const opaque = readFileSync('src/test/fixtures/pixGridDeck/opaque.png')
  const transparent = readFileSync('src/test/fixtures/pixGridDeck/transparent.png')
  await page.locator('input[type="file"][accept="image/png,image/jpeg,image/svg+xml,image/webp"]').setInputFiles(
    Array.from({ length: 12 }, (_, index) => ({
      name: `release-deck-${String(index + 1).padStart(2, '0')}.png`,
      mimeType: 'image/png',
      buffer: index % 2 === 0 ? opaque : transparent,
    })),
  )

  await expect(page.locator('.sm-deck-image-card')).toHaveCount(12, { timeout: 45_000 })
  const createPreset = page.getByRole('button', { name: 'Create Preset' })
  await expect(createPreset).toBeEnabled({ timeout: 90_000 })

  const onButtons = page.locator('.sm-deck-image-actions button', { hasText: 'On' })
  await onButtons.first().click()
  await expect(createPreset).toBeEnabled()
  for (let index = 0; index < 10; index += 1) await onButtons.first().click()
  await expect(createPreset).toBeDisabled()
  await page.locator('.sm-deck-image-actions button', { hasText: 'Off' }).first().click()
  await expect(createPreset).toBeEnabled({ timeout: 90_000 })

  await page.getByLabel('Move image later').first().click()
  await createPreset.click()
  await expect(page.getByLabel('Show Manager workspace')).toBeVisible()
  await expect(page.getByLabel('Show Manager Deck Builder inspector')).toHaveCount(0)
  await expect(page.getByLabel('Show Manager PixGrid preset')).toContainText('Browser Release Deck')
  await expect(page.getByLabel('Browser Release Deck Deck summary')).toBeVisible()
  await expect(page.locator('.vz-dock-track-title')).toContainText('stage-8-selected-track')

  const afterCreate = statusPayload(await status.textContent())
  expect(afterCreate.deck).toMatchObject({
    name: 'Browser Release Deck',
    itemCount: 12,
    enabledItemCount: 2,
    presetCreated: true,
  })
  expect(afterCreate.generatedPreset).not.toBeNull()
  expect(afterCreate.compile?.ready).toBe(true)
  expect(afterCreate.transitions?.ready).toBe(true)

  await page.getByRole('button', { name: 'React' }).click()
  const generatedCard = page.locator(`button[data-preset-card][data-preset-card-id="${afterCreate.deck?.generatedPresetId}"]`).first()
  await expect(generatedCard).toBeVisible({ timeout: 30_000 })
  await expect(generatedCard).toBeEnabled()
  await generatedCard.click()
  await expect(generatedCard).toHaveAttribute('aria-pressed', 'true')

  const afterSelect = statusPayload(await status.textContent())
  expect(afterSelect.activeReactPresetId).toBe(afterCreate.deck?.generatedPresetId)
  expect(afterSelect.pixGridOrigin).toBe('custom')

  const portability = await page.evaluate(async () => {
    const api = (window as typeof window & {
      __DRMVYZ_PIX_GRID_DECK_RELEASE__?: { roundTripProject(): Promise<unknown> }
    }).__DRMVYZ_PIX_GRID_DECK_RELEASE__
    if (!api) throw new Error('PixGrid Deck release harness API is unavailable.')
    return api.roundTripProject()
  })
  expect(portability).toMatchObject({
    exportedSourceCount: 12,
    importedMediaCount: 12,
    missingMediaIds: [],
    errorCount: 0,
    sourceIdsChanged: true,
  })
  await expect.poll(async () => statusPayload(await status.textContent()).compile?.ready, { timeout: 90_000 }).toBe(true)
  await expect.poll(async () => statusPayload(await status.textContent()).transitions?.ready, { timeout: 90_000 }).toBe(true)
  const afterImport = statusPayload(await status.textContent())
  expect(afterImport.deck).toMatchObject({
    name: 'Browser Release Deck',
    itemCount: 12,
    enabledItemCount: 2,
    presetCreated: true,
  })
  expect(afterImport.generatedPreset).toMatchObject({ deckId: afterImport.deck?.generatedPresetId?.replace('pix-grid-deck:', '') })
  expect(afterImport.portability).toEqual(portability)
  expect(pageErrors.filter(error => !error.includes('ResizeObserver'))).toEqual([])
})

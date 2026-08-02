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
  }
}

test('real Show Manager builds a Deck, explicitly creates a Preset, and selects it in React', async ({ page }) => {
  test.skip(process.env.DRMVYZ_PIX_GRID_DECK_SHOW_MANAGER_BROWSER !== '1', 'Run through the Stage 8 browser harness script.')
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

  const createDeck = page.getByRole('button', { name: 'Create Deck' })
  await expect(createDeck).toHaveCount(1)
  await createDeck.click()
  await expect(page.getByLabel('Show Manager Deck images')).toBeVisible()
  await expect(page.getByLabel('Show Manager Deck Builder inspector')).toBeVisible()
  await expect(page.locator('.vz-dock-track-title')).toContainText('stage-8-selected-track')

  await page.locator('.sm-deck-text-input').fill('Browser Stage 8 Deck')
  await page.locator('input[type="file"][accept="image/png,image/jpeg,image/svg+xml,image/webp"]').setInputFiles([
    'src/test/fixtures/pixGridDeck/opaque.png',
    'src/test/fixtures/pixGridDeck/transparent.png',
  ])

  await expect(page.locator('.sm-deck-image-card')).toHaveCount(2, { timeout: 30_000 })
  const createPreset = page.getByRole('button', { name: 'Create Preset' })
  await expect(createPreset).toBeEnabled({ timeout: 45_000 })

  const onButtons = page.locator('.sm-deck-image-actions button', { hasText: 'On' })
  await onButtons.first().click()
  await expect(createPreset).toBeDisabled()
  await page.locator('.sm-deck-image-actions button', { hasText: 'Off' }).first().click()
  await expect(createPreset).toBeEnabled({ timeout: 45_000 })

  await page.getByLabel('Move image later').first().click()
  await createPreset.click()
  await expect(page.getByLabel('Show Manager workspace')).toBeVisible()
  await expect(page.getByLabel('Show Manager Deck Builder inspector')).toHaveCount(0)
  await expect(page.getByLabel('Show Manager PixGrid preset')).toContainText('Browser Stage 8 Deck')
  await expect(page.getByLabel('Browser Stage 8 Deck Deck summary')).toBeVisible()
  await expect(page.locator('.vz-dock-track-title')).toContainText('stage-8-selected-track')

  const afterCreate = statusPayload(await status.textContent())
  expect(afterCreate.deck).toMatchObject({
    name: 'Browser Stage 8 Deck',
    itemCount: 2,
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
  expect(pageErrors.filter(error => !error.includes('ResizeObserver'))).toEqual([])
})

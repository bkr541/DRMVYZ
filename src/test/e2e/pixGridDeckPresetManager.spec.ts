import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

type Status = {
  deckCount?: number
  deck?: { name?: string; itemCount?: number; enabledItemCount?: number; presetCreated?: boolean; generatedPresetId?: string; itemTimings?: (number | null)[]; arrivalAnchor?: string | null; anchorMode?: string | null }
  shippedCompile?: Record<string, { ready?: boolean; failed?: number }>
  shippedTransitions?: Record<string, { ready?: boolean; playable?: boolean; failed?: number }>
  compile?: { ready?: boolean } | null
  transitions?: { ready?: boolean } | null
  activeReactPresetId?: string
}
const statusPayload = (text: string | null) => JSON.parse(text ?? '{}') as Status
const fixture = (name: string) => readFileSync(`src/test/fixtures/pixGridDeck/${name}`)

test('Preset Manager builds, previews, edits and deletes a PixGrid Deck from five uploaded images', async ({ page }) => {
  test.setTimeout(300_000)
  test.skip(process.env.DRMVYZ_PIX_GRID_DECK_PRESET_MANAGER_BROWSER !== '1', 'Run through the PixGrid Deck Preset Manager browser script.')
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))

  await page.goto(process.env.DRMVYZ_PIX_GRID_DECK_PRESET_MANAGER_PAGE ?? '/pix-grid-deck-show-manager.html?view=presetManager')
  const status = page.locator('[data-pix-grid-deck-show-manager-status]')
  await expect(status).toHaveAttribute('data-result', 'ready', { timeout: 60_000 })
  await expect(page.getByLabel('Preset Manager', { exact: true })).toBeVisible({ timeout: 60_000 })

  // The builder opens from an icon-only key in the header control group.
  const headerKey = page.locator('.pmv-header').getByRole('button', { name: 'Create PixGrid Deck' })
  await expect(headerKey).toHaveText('')
  await headerKey.click()
  await expect(headerKey).toBeDisabled()
  await expect(page.locator('.sm-deck-library')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Back to Presets' })).toBeVisible()

  // Five images in four formats become pixel frames; the real compiler worker prepares frames and transitions.
  await page.locator('.sm-deck-text-input').fill('Preset Manager Deck')
  await page.locator('input[type="file"][accept="image/png,image/jpeg,image/svg+xml,image/webp"]').setInputFiles([
    { name: 'one.png', mimeType: 'image/png', buffer: fixture('opaque.png') },
    { name: 'two.png', mimeType: 'image/png', buffer: fixture('transparent.png') },
    { name: 'three.jpg', mimeType: 'image/jpeg', buffer: fixture('photo.jpg') },
    { name: 'four.webp', mimeType: 'image/webp', buffer: fixture('static.webp') },
    { name: 'five.svg', mimeType: 'image/svg+xml', buffer: fixture('safe.svg') },
  ])
  await expect(page.locator('.sm-deck-image-card')).toHaveCount(5, { timeout: 60_000 })
  const createPreset = page.locator('.sm-deck-create-preset')
  await expect(createPreset).toBeEnabled({ timeout: 120_000 })

  // Authoring controls: one image's own duration, and the arrival event once transitions arrive on a boundary.
  const firstDuration = page.getByLabel('one.png duration in beats')
  await expect(firstDuration).toHaveAttribute('placeholder', '4')
  await firstDuration.fill('8')
  await expect.poll(async () => statusPayload(await status.textContent()).deck?.itemTimings, { timeout: 15_000 }).toEqual([8, null, null, null, null])
  await firstDuration.fill('')
  await expect.poll(async () => statusPayload(await status.textContent()).deck?.itemTimings, { timeout: 15_000 }).toEqual([null, null, null, null, null])
  await expect(page.getByText('Arrival event')).toHaveCount(0)
  await page.getByRole('combobox', { name: 'Deck transition timing anchor' }).click()
  await page.getByRole('option', { name: 'Arrive on boundary' }).click()
  await expect(page.getByText('Arrival event')).toBeVisible()
  await page.getByRole('combobox', { name: 'Deck transition arrival event' }).click()
  await page.getByRole('option', { name: 'Phrase boundary' }).click()
  await expect.poll(async () => statusPayload(await status.textContent()).deck?.arrivalAnchor, { timeout: 15_000 }).toBe('phrase')
  await expect(createPreset).toBeEnabled({ timeout: 120_000 })

  // Generated in-between frame: the scrubber reports the transition position.
  await page.getByLabel('Scrub generated PixGrid transition').evaluate(element => {
    const input = element as HTMLInputElement
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '0.5')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await expect(page.getByText('50% generated intermediate frame')).toBeVisible()

  await createPreset.click()
  await expect(page.locator('.sm-deck-library')).toHaveCount(0)
  const created = statusPayload(await status.textContent())
  expect(created.deck).toMatchObject({ name: 'Preset Manager Deck', itemCount: 5, enabledItemCount: 5, presetCreated: true })
  expect(created.compile?.ready).toBe(true)
  expect(created.transitions?.ready).toBe(true)
  expect(created.activeReactPresetId).toBe(created.deck?.generatedPresetId)

  // The new preset is a custom library record.
  const deckCard = page.locator(`.pmv-card[data-preset-id="${created.deck?.generatedPresetId}"]`)
  await expect(deckCard).toBeVisible()
  await page.getByRole('tab', { name: 'Custom' }).click()
  await expect(deckCard).toBeVisible()

  // Edit Deck reopens the builder on the same Deck.
  await deckCard.locator('.pmv-card-main').click()
  await page.getByRole('button', { name: 'Edit Deck' }).click()
  await expect(page.locator('.sm-deck-image-card')).toHaveCount(5)
  await expect(page.locator('.sm-deck-text-input')).toHaveValue('Preset Manager Deck')
  await page.getByRole('button', { name: 'Back to Presets' }).click()
  await expect(page.locator('.sm-deck-library')).toHaveCount(0)

  // Delete asks first, then removes the Deck and its Preset.
  await deckCard.locator('.pmv-card-main').click()
  await page.getByRole('button', { name: 'Edit Deck' }).click()
  await page.getByRole('button', { name: 'Delete Deck' }).click()
  await page.getByRole('button', { name: 'Cancel' }).click()
  expect(statusPayload(await status.textContent()).deckCount).toBe(1)
  await page.getByRole('button', { name: 'Delete Deck' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
  await expect(deckCard).toHaveCount(0)
  expect(statusPayload(await status.textContent()).deckCount).toBe(0)
  expect(pageErrors.filter(error => !error.includes('ResizeObserver'))).toEqual([])
})

test('a shipped Deck is a built-in preset whose bundled images compile with every transition ready', async ({ page }) => {
  test.setTimeout(300_000)
  const slug = process.env.DRMVYZ_PIX_GRID_SHIPPED_SAMPLE_SLUG
  test.skip(process.env.DRMVYZ_PIX_GRID_DECK_PRESET_MANAGER_BROWSER !== '1' || !slug, 'Run through the PixGrid Deck Preset Manager browser script.')
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))

  await page.goto(process.env.DRMVYZ_PIX_GRID_DECK_PRESET_MANAGER_PAGE ?? '/pix-grid-deck-show-manager.html?view=presetManager')
  const status = page.locator('[data-pix-grid-deck-show-manager-status]')
  await expect(status).toHaveAttribute('data-result', 'ready', { timeout: 60_000 })
  await expect(page.getByLabel('Preset Manager', { exact: true })).toBeVisible({ timeout: 60_000 })

  // It is listed like any built-in PixGrid preset: not custom, no User Media, nothing to edit.
  const card = page.locator(`.pmv-card[data-preset-id="pix-grid-shipped-${slug}"]`)
  await expect(card).toBeVisible()
  await expect(card).toHaveAttribute('data-preset-engine', 'PixGrid')
  await expect(card.locator('[aria-label="User Media"]')).toHaveCount(0)
  await card.locator('.pmv-card-main').click()
  await expect(page.locator('.pmv-header').getByRole('button', { name: 'Create PixGrid Deck' })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Edit Deck' })).toHaveCount(0)
  await expect(page.getByText('Custom Workflow')).toHaveCount(0)

  // Its images come from bundled files, and the compiler prepares every frame and transition.
  const deckId = `pix-grid-sequence:shipped-${slug}`
  await expect.poll(async () => statusPayload(await status.textContent()).shippedCompile?.[deckId], { timeout: 120_000 }).toMatchObject({ ready: true, failed: 0 })
  await expect.poll(async () => statusPayload(await status.textContent()).shippedTransitions?.[deckId], { timeout: 120_000 }).toMatchObject({ ready: true, playable: true, failed: 0 })
  expect(statusPayload(await status.textContent()).activeReactPresetId).toBe(`pix-grid-shipped-${slug}`)
  expect(pageErrors.filter(error => !error.includes('ResizeObserver'))).toEqual([])
})

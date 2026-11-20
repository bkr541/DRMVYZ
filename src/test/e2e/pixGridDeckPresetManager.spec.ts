import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

type Status = {
  deckCount?: number
  deck?: { name?: string; itemCount?: number; enabledItemCount?: number; presetCreated?: boolean; generatedPresetId?: string }
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

  // Selecting a PixGrid preset offers the Custom Workflow; there is no header control for it.
  await page.locator('.pmv-card[data-preset-engine="PixGrid"] .pmv-card-main').first().click()
  await expect(page.getByText('Custom Workflow')).toBeVisible()
  await page.getByRole('button', { name: 'Create PixGrid Deck' }).click()
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

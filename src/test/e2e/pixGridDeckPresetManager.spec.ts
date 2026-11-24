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

test('Preset Manager\'s PixGrid Deck popover builds, previews, edits and deletes a Deck from five uploaded images', async ({ page }) => {
  test.setTimeout(300_000)
  test.skip(process.env.DRMVYZ_PIX_GRID_DECK_PRESET_MANAGER_BROWSER !== '1', 'Run through the PixGrid Deck Preset Manager browser script.')
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))

  await page.goto(process.env.DRMVYZ_PIX_GRID_DECK_PRESET_MANAGER_PAGE ?? '/pix-grid-deck-show-manager.html?view=presetManager')
  const status = page.locator('[data-pix-grid-deck-show-manager-status]')
  await expect(status).toHaveAttribute('data-result', 'ready', { timeout: 60_000 })
  await expect(page.getByLabel('Preset Manager', { exact: true })).toBeVisible({ timeout: 60_000 })

  // The builder opens as one popover from an icon-only key in the header control group; Preset Manager's own windows stay as they are.
  const headerKey = page.locator('.pmv-header').getByRole('button', { name: 'Create PixGrid Deck' })
  await expect(headerKey).toHaveText('')
  await headerKey.click()
  await expect(headerKey).toHaveAttribute('aria-pressed', 'true')
  const popover = page.getByRole('dialog', { name: 'CREATE PIXGRID DECK' })
  await expect(popover).toBeVisible()
  await expect(popover.getByText('Step 1 of 5')).toBeVisible()
  await expect(page.locator('.sm-deck-library')).toHaveCount(0)
  await expect(page.getByLabel('Preset Library', { exact: true })).toBeVisible()
  const step = (name: string) => popover.getByRole('tab', { name })
  await expect(popover.getByRole('button', { name: 'Next', exact: true })).toBeDisabled()

  // Five images in four formats become pixel frames; the real compiler worker prepares frames and transitions.
  await popover.getByLabel('New Deck name').fill('Preset Manager Deck')
  await popover.locator('input[type="file"][accept="image/png,image/jpeg,image/svg+xml,image/webp"]').setInputFiles([
    { name: 'one.png', mimeType: 'image/png', buffer: fixture('opaque.png') },
    { name: 'two.png', mimeType: 'image/png', buffer: fixture('transparent.png') },
    { name: 'three.jpg', mimeType: 'image/jpeg', buffer: fixture('photo.jpg') },
    { name: 'four.webp', mimeType: 'image/webp', buffer: fixture('static.webp') },
    { name: 'five.svg', mimeType: 'image/svg+xml', buffer: fixture('safe.svg') },
  ])
  await expect(popover.locator('.ll-deck-image')).toHaveCount(5, { timeout: 60_000 })
  await expect(popover.getByRole('button', { name: 'Next', exact: true })).toBeEnabled()
  // The live preview is the real PixGrid render for the Deck.
  await expect(popover.locator('.ll-deck-stage .rv-pix-grid-surface-host')).toBeVisible({ timeout: 60_000 })
  await expect(page.locator('.pmv-preview-group .rv-pix-grid-surface-host')).toHaveCount(0)

  // Authoring controls: one image's own duration, and the arrival event once transitions arrive on a boundary.
  const firstDuration = popover.getByLabel('one.png duration in beats')
  await expect(firstDuration).toHaveAttribute('placeholder', '4')
  await firstDuration.fill('8')
  await expect.poll(async () => statusPayload(await status.textContent()).deck?.itemTimings, { timeout: 15_000 }).toEqual([8, null, null, null, null])
  await firstDuration.fill('')
  await expect.poll(async () => statusPayload(await status.textContent()).deck?.itemTimings, { timeout: 15_000 }).toEqual([null, null, null, null, null])

  // Generated in-between frame: the scrubber reports the transition position.
  await popover.getByLabel('Scrub generated PixGrid transition').evaluate(element => {
    const input = element as HTMLInputElement
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '0.5')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await expect(popover.getByText('50% generated intermediate frame')).toBeVisible()

  await step('Transitions').click()
  await expect(popover.getByText('Arrival event')).toHaveCount(0)
  await popover.getByRole('combobox', { name: 'Deck transition timing anchor' }).click()
  await page.getByRole('option', { name: 'Arrive on boundary' }).click()
  await expect(popover.getByText('Arrival event')).toBeVisible()
  await popover.getByRole('combobox', { name: 'Deck transition arrival event' }).click()
  await page.getByRole('option', { name: 'Phrase boundary' }).click()
  await expect.poll(async () => statusPayload(await status.textContent()).deck?.arrivalAnchor, { timeout: 15_000 }).toBe('phrase')

  // Review: the compiler prepares everything, then Create Preset confirms and the popover closes on Done.
  await step('Review').click()
  const createPreset = popover.getByRole('button', { name: 'Create Preset' })
  await expect(createPreset).toBeEnabled({ timeout: 120_000 })
  await createPreset.click()
  await expect(popover.getByText('Preset created')).toBeVisible()
  await expect(page.locator('.rv-pix-grid-surface-host')).toHaveCount(0)
  const created = statusPayload(await status.textContent())
  expect(created.deck).toMatchObject({ name: 'Preset Manager Deck', itemCount: 5, enabledItemCount: 5, presetCreated: true })
  expect(created.compile?.ready).toBe(true)
  expect(created.transitions?.ready).toBe(true)
  expect(created.activeReactPresetId).toBe(created.deck?.generatedPresetId)
  await popover.getByRole('button', { name: 'Done' }).click()
  await expect(popover).toHaveCount(0)
  await expect(headerKey).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('.pmv-preview-group .rv-pix-grid-surface-host')).toBeVisible()

  // The new preset is a custom library record.
  const deckCard = page.locator(`.pmv-card[data-preset-id="${created.deck?.generatedPresetId}"]`)
  await expect(deckCard).toBeVisible()
  await page.getByRole('tab', { name: 'Custom' }).click()
  await expect(deckCard).toBeVisible()

  // Edit Deck reopens the popover on the same Deck.
  await deckCard.locator('.pmv-card-main').click()
  await page.getByRole('button', { name: 'Edit Deck' }).click()
  const editor = page.getByRole('dialog', { name: 'EDIT PIXGRID DECK' })
  await expect(editor.locator('.ll-deck-image')).toHaveCount(5)
  await expect(editor.getByLabel('Deck name', { exact: true })).toHaveValue('Preset Manager Deck')
  await editor.getByRole('button', { name: 'Close' }).click()
  await expect(editor).toHaveCount(0)

  // Delete asks first, then removes the Deck and its Preset.
  await deckCard.locator('.pmv-card-main').click()
  await page.getByRole('button', { name: 'Edit Deck' }).click()
  await editor.getByRole('tab', { name: 'Review' }).click()
  await editor.getByRole('button', { name: 'Delete Deck' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click()
  expect(statusPayload(await status.textContent()).deckCount).toBe(1)
  await expect(editor).toBeVisible()
  await editor.getByRole('button', { name: 'Delete Deck' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
  await expect(deckCard).toHaveCount(0)
  await expect(editor).toHaveCount(0)
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

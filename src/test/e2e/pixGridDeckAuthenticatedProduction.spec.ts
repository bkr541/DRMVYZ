import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

test('authenticated production app reaches Deck ingestion, compiler, generated Preset, and renderer', async ({ page }) => {
  test.skip(
    process.env.DRMVYZ_PIX_GRID_DECK_AUTHENTICATED_BROWSER !== '1',
    'Run through npm run test:e2e:pix-grid-deck-authenticated with approved auth storage state.',
  )

  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))

  await page.goto('/')
  await page.waitForLoadState('networkidle')
  if (await page.getByRole('heading', { name: 'Welcome Back' }).isVisible().catch(() => false)) {
    throw new Error('Authenticated Deck verification stopped at the login page. Refresh the approved Playwright storage state.')
  }
  await expect(page.getByRole('button', { name: 'Show Manager' })).toBeVisible({ timeout: 30_000 })

  // Reset only the project document. Supabase auth localStorage remains intact.
  await page.evaluate(() => localStorage.removeItem('drmvyz:react-store'))
  await page.reload()
  await expect(page.getByRole('button', { name: 'Show Manager' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('heading', { name: 'Welcome Back' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Show Manager' }).click()
  await expect(page.getByLabel('Show Manager workspace')).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Create Deck' }).click()
  await expect(page.getByLabel('Show Manager Deck images')).toBeVisible()

  const deckName = `Authenticated Deck ${Date.now()}`
  await page.getByLabel('New Deck name').fill(deckName)
  await page.locator('input[type="file"][accept="image/png,image/jpeg,image/svg+xml,image/webp"]').setInputFiles([
    {
      name: `authenticated-${Date.now()}-opaque.png`,
      mimeType: 'image/png',
      buffer: readFileSync('src/test/fixtures/pixGridDeck/opaque.png'),
    },
    {
      name: `authenticated-${Date.now()}-transparent.png`,
      mimeType: 'image/png',
      buffer: readFileSync('src/test/fixtures/pixGridDeck/transparent.png'),
    },
  ])

  await expect(page.locator('.sm-deck-image-card')).toHaveCount(2, { timeout: 90_000 })
  const createPreset = page.getByRole('button', { name: 'Create Preset' })
  await expect(createPreset).toBeEnabled({ timeout: 120_000 })
  await createPreset.click()

  await expect(page.getByLabel('Show Manager workspace')).toBeVisible()
  await expect(page.getByLabel('Show Manager PixGrid preset')).toContainText(deckName)
  const surface = page.getByRole('img', { name: `PixGrid visualization: ${deckName}` })
  await expect(surface).toBeVisible({ timeout: 30_000 })
  await expect(surface).toHaveAttribute('data-pix-grid-renderer', /^(webgl2|canvas2d-fallback)$/)
  await expect(surface).toHaveAttribute('data-pix-grid-context', /^(ready|unavailable|lost|restoring)$/)

  expect(pageErrors.filter(error => !error.includes('ResizeObserver'))).toEqual([])
})

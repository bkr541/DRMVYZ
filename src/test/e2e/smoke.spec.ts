/**
 * Public smoke tests for a clean, unauthenticated checkout.
 *
 * A checkout without Supabase environment variables intentionally renders setup
 * guidance. A configured checkout without a persisted session renders the login
 * gate. Authenticated studio scenarios belong in suites that provide an explicit
 * Playwright storage state or test account.
 *
 * Prerequisites:
 *   npm run build
 *   npm run playwright:install
 *
 * Run locally:
 *   npm run test:e2e:smoke
 */
import { test, expect } from '@playwright/test'

async function bootClean(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForLoadState('networkidle')
}

test.describe('Public application boot', () => {
  test('loads a known unauthenticated state without an uncaught error', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))

    await bootClean(page)

    const setupNotice = page.getByText('Supabase not configured')
    const loginHeading = page.getByRole('heading', { name: 'Welcome Back' })
    await expect(setupNotice.or(loginHeading)).toBeVisible()
    expect(errors.filter(error => !error.includes('ResizeObserver'))).toHaveLength(0)
  })

  test('renders actionable setup guidance or usable login controls', async ({ page }) => {
    await bootClean(page)

    const setupNotice = page.getByText('Supabase not configured')
    if (await setupNotice.isVisible()) {
      await expect(page.getByText('VITE_SUPABASE_URL')).toBeVisible()
      await expect(page.getByText('VITE_SUPABASE_ANON_KEY')).toBeVisible()
      return
    }

    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[autocomplete="current-password"]')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Log In' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create one' })).toBeVisible()
  })

  test('configured login gate can switch to account creation', async ({ page }) => {
    await bootClean(page)

    const createAccount = page.getByRole('button', { name: 'Create one' })
    test.skip(!(await createAccount.isVisible()), 'Supabase is intentionally unconfigured in this checkout')

    await createAccount.click()
    await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible()
  })
})

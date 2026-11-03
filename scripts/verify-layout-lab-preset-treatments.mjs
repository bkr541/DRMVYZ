/* global document, getComputedStyle, requestAnimationFrame */
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const baseUrl = process.env.DRMVYZ_ARTWORK_BASE_URL ?? 'http://127.0.0.1:5173'
const output = '/tmp/drmvyz-preset-review'
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 })
  await page.route('**/layout-lab-preset-review', route => route.fulfill({
    contentType: 'text/html', body: '<html data-theme="dark"><body style="margin:0"><div id="root" style="height:100vh"></div></body></html>',
  }))
  await page.goto(`${baseUrl}/layout-lab-preset-review`)
  await page.evaluate(async () => {
    const { default: refresh } = await import('/@react-refresh')
    refresh.injectIntoGlobalHook(globalThis)
    globalThis.$RefreshReg$ = () => {}
    globalThis.$RefreshSig$ = () => type => type
    globalThis.__vite_plugin_react_preamble_installed__ = true
    await Promise.all([
      import('/src/styles.css'), import('/src/styles/vyzualz.css'), import('/src/styles/reactView.css'),
      import('/src/styles/floatingWorkspace.css'), import('/src/styles/tabRows.css'), import('/src/styles/typography.css'),
    ])
    const { default: React } = await import('/node_modules/.vite/deps/react.js')
    const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js')
    const { LayoutLabDesignWorkbench } = await import('/src/components/vyzualz/react/layoutLab/LayoutLabDesignWorkbench.tsx')
    createRoot(document.getElementById('root')).render(React.createElement(LayoutLabDesignWorkbench))
  })
  const metrics = []
  for (const [letter, id] of [['G', 'design-07'], ['H', 'design-08'], ['I', 'design-09'], ['K', 'design-10']]) {
    await page.locator('[data-lab-design]:not([hidden])').getByRole('button', { name: `Design ${letter}`, exact: true }).click()
    const view = page.locator(`[data-lab-design="${id}"]`)
    const right = view.locator('.rw-frame--right')
    await right.getByRole('tab', { name: 'PRESETS', exact: true }).click()
    const card = right.locator('[data-preset-card]').first()
    await card.locator('img').evaluate(async img => { await img.decode() })
    await page.evaluate(() => document.fonts.ready)
    const metric = await card.evaluate(card => {
      const caption = card.querySelector('.rv-preset-spotlight-caption')
      const name = card.querySelector('.rv-preset-spotlight-name')
      const title = getComputedStyle(name), overlay = getComputedStyle(caption), blur = getComputedStyle(caption, '::before')
      const rect = card.getBoundingClientRect(), text = name.getBoundingClientRect()
      return {
        fontSize: title.fontSize, transform: title.textTransform, stroke: title.webkitTextStrokeWidth,
        background: title.backgroundColor, border: title.borderTopWidth, backdrop: title.backdropFilter,
        material: blur.backgroundImage, materialClip: blur.clipPath,
        captionBackground: overlay.backgroundImage, blur: blur.backdropFilter, blurMask: blur.maskImage,
        centerX: Math.abs(text.x + text.width / 2 - rect.x - rect.width / 2),
        centerY: Math.abs(text.y + text.height / 2 - rect.y - rect.height / 2),
      }
    })
    assert.equal(metric.fontSize, '12px', `${letter}: shared title size`)
    assert.equal(metric.transform, 'uppercase')
    assert.equal(metric.captionBackground, 'none', `${letter}: full-image scrim removed`)
    assert.ok(metric.centerX < 1 && metric.centerY < 1, `${letter}: name must stay centered`)
    if (letter === 'G') assert.equal(metric.stroke, '0.65px')
    if (letter === 'H') { assert.ok(metric.blur.includes('blur(10px)')); assert.ok(metric.materialClip.includes('polygon')); assert.ok(metric.material.includes('linear-gradient')) }
    if (letter === 'I') { assert.ok(metric.material.includes('repeating-linear-gradient')); assert.ok(metric.materialClip.includes('polygon')) }
    if (letter === 'K') { assert.ok(metric.blur.includes('blur(10px)')); assert.ok(metric.blurMask.includes('radial-gradient')) }
    const clipped = await right.locator('.rv-preset-spotlight-name').evaluateAll(names => names.filter(name => {
      const style = getComputedStyle(name)
      const twoLines = 2 * parseFloat(style.lineHeight) + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
      return name.clientHeight + 1 < Math.min(name.scrollHeight, twoLines)
    }).map(name => name.textContent))
    assert.deepEqual(clipped, [], `${letter}: wrapped labels must not clip`)
    if (letter === 'H' || letter === 'I') {
      const longWordFits = await right.locator('[data-cinema2-preset-id="drmvyz.cinema2.constellation"] .rv-preset-spotlight-name').evaluate(name => {
        const style = getComputedStyle(name)
        return name.clientHeight <= parseFloat(style.lineHeight) + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + 1
      })
      assert.ok(longWordFits, `${letter}: long preset words fit without an orphaned letter`)
    }
    await card.click()
    assert.equal(await card.getAttribute('aria-pressed'), 'true')
    const bounds = await right.boundingBox()
    assert.ok(bounds && bounds.width > 0 && bounds.height > 0, `${letter}: visible Inspector`)
    await page.screenshot({ path: `${output}/layout-lab-option-${letter.toLowerCase()}-refined.png`, clip: {
      x: Math.max(0, bounds.x), y: Math.max(0, bounds.y),
      width: Math.min(bounds.width, 1600 - Math.max(0, bounds.x)),
      height: Math.min(bounds.height, 1000 - Math.max(0, bounds.y)),
    } })
    await right.getByRole('textbox', { name: 'Search Cinema 2.0 presets' }).fill('afterhours')
    assert.equal(await right.locator('[data-preset-card]').count(), 1)
    await right.getByRole('textbox', { name: 'Search Cinema 2.0 presets' }).fill('')
    await right.getByRole('tab', { name: 'USER', exact: true }).click()
    await right.locator('[data-preset-scope="user"]').waitFor({ state: 'attached' })
    assert.equal(await right.locator('[data-preset-card]').count(), 0)
    await right.getByRole('tab', { name: 'SYSTEM', exact: true }).click()
    metrics.push({ option: letter, ...metric })
  }
  // Loading the lab stylesheet must not alter the production reusable card.
  const productionScrim = await page.evaluate(async () => {
    const { default: React } = await import('/node_modules/.vite/deps/react.js')
    const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js')
    const { ReactPresetCard } = await import('/src/components/vyzualz/react/ReactPresetCard.tsx')
    const host = document.createElement('div'); document.body.append(host)
    const root = createRoot(host)
    try {
      root.render(React.createElement(ReactPresetCard, { id: 'production-check', title: 'Production', description: '', activateLabel: 'Load Production', onActivate() {} }))
      await new Promise(resolve => requestAnimationFrame(resolve))
      return getComputedStyle(host.querySelector('.rv-preset-spotlight-caption')).backgroundImage
    } finally { root.unmount(); host.remove() }
  })
  assert.equal(productionScrim, 'none')
  console.log(`Verified G Etched Proof, H Refractive Glass, I Signal Chassis, and K Optical Focus in their actual Presets tabs; centered 12px titles, artwork, selection, search, scope switching, and production isolation. Screenshots: ${output}/layout-lab-option-{g,h,i,k}-refined.png`)
} finally { await browser.close() }

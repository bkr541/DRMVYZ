import { chromium, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
const output = path.resolve('artifacts/cinema2-text-library')
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } })
const errors = []
page.on('pageerror', error => errors.push(error.message))
const metrics = []
async function navigateScene(button, reducedMotion = false) {
  const animations = await button.evaluate(async element => {
    element.click()
    await new Promise(resolve => element.ownerDocument.defaultView.requestAnimationFrame(resolve))
    const screen = element.ownerDocument.querySelector('.rv-cinema2-text-screen')
    const running = screen.getAnimations({ subtree: true })
    const frames = running.map(animation => ({
      keyframes: animation.effect.getKeyframes(), duration: animation.effect.getTiming().duration,
    }))
    await Promise.all(running.map(animation => animation.finished))
    return frames
  })
  expect(animations).toHaveLength(reducedMotion ? 0 : 2)
  if (!reducedMotion) {
    expect(animations[0].keyframes[0].height).toBeTruthy()
    expect(animations.map(animation => animation.duration)).toEqual([320, 320])
    expect(animations[1].keyframes.map(frame => Number(frame.opacity))).toEqual([0, 1])
  }
}
try {
  await page.goto(`${process.env.CINEMA2_TEXT_REVIEW_URL ?? 'http://127.0.0.1:5176'}/src/test/browser/cinema2-text-library.html`)
  await page.getByRole('button', { name: 'Capture Current', exact: true }).waitFor()
  for (const [preset, field] of [['say-it', 'say-it-text'], ['marquee', 'marquee-front-text'], ['nightshift', 'nightshift-sign-text']]) {
    if (process.env.CINEMA2_TEXT_REVIEW_PRESETS && !process.env.CINEMA2_TEXT_REVIEW_PRESETS.split(',').includes(preset)) continue
    await page.getByLabel('Review preset').selectOption(`drmvyz.cinema2.${preset}`)
    const source = page.getByRole('region', { name: 'Source review' })
    const reference = page.getByRole('region', { name: 'Tracks reference', exact: true })
    const styleMetrics = element => {
      const style = element.ownerDocument.defaultView.getComputedStyle(element)
      return { padding: style.padding, background: style.backgroundColor, radius: style.borderRadius, border: style.borderWidth, font: style.font, height: element.getBoundingClientRect().height }
    }
    const libraryBody = source.locator('.drc-body.dv-library-body')
    const bodyStyle = await libraryBody.evaluate(styleMetrics)
    const referenceBodyStyle = await reference.locator('.lmv-track-library-body').evaluate(styleMetrics)
    expect(bodyStyle.padding).toBe('0px 0px 8px')
    expect(bodyStyle.background).toBe('rgba(0, 0, 0, 0)')
    expect(bodyStyle.radius).toBe('0px')
    expect(bodyStyle.padding).toBe(referenceBodyStyle.padding)
    const inputStyle = await source.getByLabel('Search text scenes').evaluate(styleMetrics)
    const referenceInputStyle = await reference.getByLabel('Search tracks by title or artist').evaluate(styleMetrics)
    expect(inputStyle).toEqual(referenceInputStyle)
    const searchRowStyle = await source.locator('.dv-library-search-row').evaluate(styleMetrics)
    expect(searchRowStyle.padding).toBe('0px')
    expect(searchRowStyle.border).toBe('0px')
    const bodyBox = await libraryBody.boundingBox()
    const inputBox = await source.getByLabel('Search text scenes').boundingBox()
    expect(inputBox.x).toBe(bodyBox.x)
    const toolbar = source.getByRole('toolbar', { name: 'Text scene actions', exact: true })
    await expect(toolbar).toBeVisible()
    const toggleBox = await source.getByRole('button', { name: 'List view', exact: true }).boundingBox()
    const captureBox = await toolbar.getByRole('button', { name: 'Capture Current', exact: true }).boundingBox()
    expect(captureBox.x).toBeGreaterThanOrEqual(toggleBox.x + toggleBox.width)
    expect(Math.abs((captureBox.y + captureBox.height / 2) - (toggleBox.y + toggleBox.height / 2))).toBeLessThan(1)
    const keyStyles = await toolbar.locator('button').evaluateAll(buttons => buttons.map(button => ({
      width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height,
      iconWidth: button.querySelector('svg').getBoundingClientRect().width,
      border: button.ownerDocument.defaultView.getComputedStyle(button).borderWidth,
    })))
    expect(keyStyles).toEqual([{ width: 28, height: 28, iconWidth: 12, border: '0px' }, { width: 28, height: 28, iconWidth: 12, border: '0px' }])
    await page.screenshot({ path: path.join(output, `${preset}-source.png`), fullPage: true })
    await navigateScene(source.getByRole('button', { name: 'Capture Current', exact: true }))
    await source.getByLabel('Name', { exact: true }).fill(`${preset} opening`)
    await page.locator(`#cinema2-text-draft-${field}`).fill('WELCOME')
    await expect(source.getByLabel('Search text scenes')).toHaveCount(0)
    const back = source.getByRole('button', { name: 'Back to Text Scenes', exact: true })
    await expect(back).toBeVisible()
    await expect(source.getByRole('button', { name: 'Capture Current', exact: true })).toHaveCount(0)
    await expect(source.getByRole('button', { name: 'Add Text Scene', exact: true })).toHaveCount(0)
    for (const action of [() => page.getByRole('button', { name: 'Pool', exact: true }).click(), () => back.click()]) {
      await action()
      const dialog = page.getByRole('alertdialog', { name: 'Unsaved changes', exact: true })
      await expect(dialog).toBeVisible()
      await expect(dialog.locator('h2')).toHaveCSS('text-transform', 'capitalize')
      await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused()
      await page.keyboard.press('Shift+Tab')
      await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeFocused()
      await page.keyboard.press('Tab')
      await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused()
      expect(await dialog.locator('.dv-confirm-actions button').allTextContents()).toEqual(['Cancel', 'Discard Changes', 'Save'])
      await page.screenshot({ path: path.join(output, `${preset}-unsaved.png`), fullPage: true })
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
      await expect(page.locator(`#cinema2-text-draft-${field}`)).toHaveValue('WELCOME')
    }
    if (preset !== 'nightshift') await expect(page.locator('#cinema2-parameter-' + field)).not.toHaveValue('WELCOME')
    else await expect(page.locator('#cinema2-parameter-' + field)).toHaveCount(0)
    if (preset === 'say-it') {
      await page.locator('#cinema2-text-draft-say-it-line-mode').click()
      await page.getByRole('option', { name: 'One Line', exact: true }).click()
      await expect(page.locator('#cinema2-text-draft-say-it-line-2-text')).toHaveCount(0)
      await page.locator('#cinema2-text-draft-say-it-line-mode').click()
      await page.screenshot({ path: path.join(output, 'say-it-dropdown.png'), fullPage: true })
      await page.getByRole('option', { name: 'Two Lines', exact: true }).click()
    }
    await page.screenshot({ path: path.join(output, `${preset}-editor.png`), fullPage: true })
    const duplicateIds = await page.locator('[id]').evaluateAll(elements => elements.map(el => el.id).filter((id, i, ids) => ids.indexOf(id) !== i))
    expect(duplicateIds).toEqual([])
    metrics.push({ preset, libraryBody: bodyStyle, search: inputStyle, referenceSearch: referenceInputStyle, controls: await source.locator('input').count(), inputTypography: await source.locator('input').first().evaluate(el => ({ font: el.ownerDocument.defaultView.getComputedStyle(el).font, placeholderFont: el.ownerDocument.defaultView.getComputedStyle(el, '::placeholder').font })) })
    await source.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(source.getByRole('button', { name: `${preset} opening actions`, exact: true })).toBeVisible()
    await source.locator('.rv-cinema2-text-screen').evaluate(async element => { await Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished)) })
    const gridCard = source.locator('.rv-cinema2-text-card')
    expect((await gridCard.locator('.rv-cinema2-text-preview').boundingBox()).height).toBeGreaterThan(0)
    const presetCard = page.getByRole('region', { name: 'Preset grid reference', exact: true }).locator('.rv-preset-card')
    const tileMetrics = element => {
      const style = element.ownerDocument.defaultView.getComputedStyle(element)
      return { height: style.height, radius: style.borderRadius, border: style.border, shadow: style.boxShadow }
    }
    expect(await gridCard.evaluate(tileMetrics)).toEqual(await presetCard.evaluate(tileMetrics))
    const titleMetrics = element => {
      const style = element.ownerDocument.defaultView.getComputedStyle(element)
      return { font: style.font, tracking: style.letterSpacing, transform: style.textTransform }
    }
    expect(await gridCard.locator('.rv-preset-spotlight-name').evaluate(titleMetrics)).toEqual(await presetCard.locator('.rv-preset-spotlight-name').evaluate(titleMetrics))
    await page.screenshot({ path: path.join(output, `${preset}-grid.png`), fullPage: true })
    await expect(source.locator('.dv-library-view-toggle button')).toHaveCount(1)
    await source.getByRole('button', { name: 'List view', exact: true }).click()
    await expect(source.getByRole('button', { name: 'List view', exact: true })).toHaveCount(0)
    await source.getByRole('button', { name: 'Grid view', exact: true }).focus()
    await page.keyboard.press('Enter')
    await expect(source.locator('.rv-cinema2-text-records.is-grid')).toBeVisible()
    await source.getByRole('button', { name: 'List view', exact: true }).click()
    await expect(source.locator('.rv-cinema2-text-records.is-list')).toBeVisible()
    await expect(source.locator('.rv-cinema2-text-preview')).toBeVisible()
    const listCard = source.locator('.rv-cinema2-text-card')
    const surfaceMetrics = element => {
      const style = element.ownerDocument.defaultView.getComputedStyle(element)
      return { radius: style.borderRadius, border: style.border, shadow: style.boxShadow, background: style.backgroundColor }
    }
    expect(await listCard.evaluate(surfaceMetrics)).toEqual(await presetCard.evaluate(surfaceMetrics))
    expect(await listCard.locator('.rv-preset-spotlight-name').evaluate(titleMetrics)).toEqual(await presetCard.locator('.rv-preset-spotlight-name').evaluate(titleMetrics))
    expect((await listCard.boundingBox()).height).toBe(64)
    await page.screenshot({ path: path.join(output, `${preset}-list.png`), fullPage: true })
    await source.getByLabel('Search text scenes').fill('WELCOME')
    await expect(source.getByRole('listitem')).toHaveCount(1)
    await source.getByRole('button', { name: `${preset} opening actions`, exact: true }).click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Make Active', exact: true }).click()
    await expect(listCard).toHaveCSS('border-color', 'rgb(74, 199, 219)')
    const activeListStyle = await listCard.evaluate(surfaceMetrics)
    expect(activeListStyle.shadow).not.toBe((await presetCard.evaluate(surfaceMetrics)).shadow)
    await source.getByRole('button', { name: 'Grid view', exact: true }).click()
    await expect(source.locator('.rv-cinema2-text-card')).toHaveCSS('border-color', 'rgb(74, 199, 219)')
    expect(await source.locator('.rv-cinema2-text-card').evaluate(surfaceMetrics)).toEqual(activeListStyle)
    await source.getByRole('button', { name: 'List view', exact: true }).click()
    // NIGHTSHIFT can intentionally save hidden signs, so their Design fields remain hidden.
    if (preset !== 'nightshift') await expect(page.locator('#cinema2-parameter-' + field)).toHaveValue('WELCOME')
    await page.getByRole('button', { name: 'Pool', exact: true }).click()
    await source.getByLabel('New pool name').fill('Opening set')
    await source.getByRole('button', { name: 'Create Pool', exact: true }).click()
    await page.getByRole('button', { name: 'Source', exact: true }).click()
    await source.getByRole('button', { name: `${preset} opening actions`, exact: true }).click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Add to Pool', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Opening set', exact: true }).click()
    await page.getByRole('button', { name: 'Pool', exact: true }).click()
    await expect(source.getByRole('button', { name: `${preset} opening actions`, exact: true })).toBeVisible()
    await page.screenshot({ path: path.join(output, `${preset}-pool.png`), fullPage: true })
    await page.getByRole('button', { name: 'Source', exact: true }).click()
    for (const action of ['Add Text Scene', 'Capture Current']) {
      await navigateScene(source.getByRole('button', { name: action, exact: true }))
      await navigateScene(source.getByRole('button', { name: 'Back to Text Scenes', exact: true }))
      await expect(page.getByRole('alertdialog')).toHaveCount(0)
      await expect(source.getByLabel('Search text scenes')).toBeVisible()
    }
    await source.getByRole('button', { name: 'Add Text Scene', exact: true }).click()
    await page.locator(`#cinema2-text-draft-${field}`).fill('CHANGED')
    await source.getByRole('button', { name: 'Back to Text Scenes', exact: true }).click()
    await expect(page.getByRole('alertdialog', { name: 'Unsaved changes', exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(source.getByRole('button', { name: 'Back to Text Scenes', exact: true })).toBeVisible()
    await source.getByRole('button', { name: 'Back to Text Scenes', exact: true }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Discard Changes', exact: true }).click()
    await expect(source.getByLabel('Search text scenes')).toBeVisible()
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await navigateScene(source.getByRole('button', { name: 'Add Text Scene', exact: true }), true)
    await navigateScene(source.getByRole('button', { name: 'Back to Text Scenes', exact: true }), true)
    await page.emulateMedia({ reducedMotion: 'no-preference' })
  }
  await page.getByRole('button', { name: 'Info Popover', exact: true }).click()
  const infoTitle = page.locator('.drm-info-popover__title')
  await expect(infoTitle).toHaveCSS('text-transform', 'capitalize')
  await page.screenshot({ path: path.join(output, 'info-popover-title.png'), fullPage: true })
  expect(errors).toEqual([])
  await writeFile(path.join(output, `${process.env.CINEMA2_TEXT_REVIEW_PRESETS ?? 'all'}-review.json`), JSON.stringify({ errors, metrics, checks: 'Editor/save/recall/search/list/pool flows passed for the listed presets; draft and Design IDs are unique.' }, null, 2))
  console.log(`Cinema 2.0 text scene library browser review passed: ${metrics.map(item => item.preset).join(', ')}.`)
} finally { await browser.close() }

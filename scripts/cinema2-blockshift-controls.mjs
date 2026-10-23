/* global window, HTMLInputElement, WebGL2RenderingContext */
import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

export async function runBlockshiftManualAcceptance(page, canvas, output, waitFrames) {
  await page.getByRole('tablist', { name: 'React right workspace panels' }).getByRole('tab', { name: 'DESIGN' }).evaluate(element => element.click())
  const control = suffix => page.locator(`[data-cinema2-control-id="blockshift-${suffix}"]`)
  await control('block-size').waitFor({ state: 'attached' })
  const groups = await page.locator('[data-cinema2-design-parent-groups]').getAttribute('data-cinema2-design-parent-groups')
  assert.equal(groups, 'master-controls design effects palette')
  assert.equal(await control('bloom').count(), 1)
  const numeric = async (suffix, value) => {
    const input = control(suffix).locator('input[type="range"]')
    await input.evaluate((element, next) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, String(next))
      element.dispatchEvent(new Event('input', { bubbles: true })); element.dispatchEvent(new Event('change', { bubbles: true }))
    }, value)
    assert.equal(await input.inputValue(), String(value))
    await waitFrames()
  }
  const color = async (suffix, value) => {
    await control(suffix).locator('[aria-haspopup="dialog"]').evaluate(element => element.click())
    const input = page.locator('.rv-ctrl-palette-hex-input')
    await input.evaluate((element, next) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, next)
      element.dispatchEvent(new Event('input', { bubbles: true })); element.dispatchEvent(new Event('change', { bubbles: true }))
    }, value)
    assert.equal(await input.inputValue(), value)
    await control(suffix).locator('[aria-haspopup="dialog"]').evaluate(element => element.click())
    await waitFrames()
  }
  const choose = async (suffix, label) => {
    await control(suffix).locator('[aria-haspopup="listbox"]').evaluate(element => element.click())
    await page.getByRole('option', { name: label, exact: true }).evaluate(element => element.click())
    await waitFrames()
    await page.waitForTimeout(650)
  }
  const toggle = async suffix => { await control(suffix).getByRole('switch').evaluate(element => element.click()); await waitFrames() }
  const capture = async name => {
    const png = await canvas.screenshot({ path: path.join(output, `${name}.png`) })
    return sharp(png).removeAlpha().raw().toBuffer()
  }
  const difference = (left, right) => {
    assert.equal(left.length, right.length)
    const mask = new Uint8Array(left.length / 3)
    let pixels = 0
    for (let i = 0; i < mask.length; i++) {
      const changed = [0, 1, 2].some(channel => Math.abs(left[i * 3 + channel] - right[i * 3 + channel]) > 2)
      if (changed) { mask[i] = 1; pixels++ }
    }
    return { pixels, mask }
  }
  const numericProof = []
  for (const [suffix, values, normal] of [
    ['block-size', [1.05, 1.35, 6], 1.35], ['spread', [0.5, 1, 3], 1],
    ['depth', [0, 0.45, 1], 0.45], ['rotation-range', [0, 16, 45], 16], ['master-intensity', [0, 1, 2], 1],
  ]) {
    const images = []
    for (const value of values) { await numeric(suffix, value); images.push(await capture(`control-${suffix}-${value}`)) }
    const pixels = difference(images[0], images[2]).pixels
    assert(pixels > 30, `${suffix}: min/max must change its native output`)
    numericProof.push({ suffix, values, minMaxChangedPixels: pixels, note: null })
    await numeric(suffix, normal)
  }
  const formations = []
  let previous
  for (const name of ['Stack', 'Orbit', 'Stagger', 'Split', 'Wave', 'Collapse']) {
    await choose('pattern', name)
    const pixels = await capture(`pattern-${name.toLowerCase()}`)
    if (previous) assert(difference(previous, pixels).pixels > 100, 'Manual formations must change real geometry')
    formations.push(name); previous = pixels
  }
  await choose('pattern', 'Stagger')
  assert.equal(await control('trigger').count(), 0)
  await toggle('pattern-change')
  await control('trigger').waitFor({ state: 'attached' })
  await control('trigger').locator('[aria-haspopup="listbox"]').evaluate(element => element.click())
  const triggerLabels = await page.getByRole('option').allTextContents()
  assert.deepEqual(triggerLabels, ['Beat', 'Kick', 'Snare', 'Downbeat', 'Every 2 Beats', 'Every 4 Beats', 'Bar', 'Every 4 Bars', 'Every 8 Bars', 'Phrase', 'Drop'])
  await page.getByRole('option', { name: 'Phrase', exact: true }).evaluate(element => element.click())
  await choose('pattern', 'Orbit')
  assert.equal(await control('pattern-change').getByRole('switch').getAttribute('aria-checked'), 'true')
  await toggle('pattern-change'); assert.equal(await control('trigger').count(), 0)
  await toggle('pattern-change')
  assert.match(await control('trigger').innerText(), /Phrase/)
  await toggle('pattern-change'); await choose('pattern', 'Stagger')
  const defaults = { 'primary-edge': '#55e6ff', 'secondary-edge': '#7866ff', 'impact-accent': '#fff1d6', 'block-body': '#151a24', background: '#050811' }
  const diagnostic = { 'primary-edge': '#ff0000', 'secondary-edge': '#00ff00', 'impact-accent': '#0080ff', 'block-body': '#8000ff', background: '#444444' }
  const baseline = await capture('palette-baseline')
  const paletteProof = [], masks = []
  for (const [suffix, value] of Object.entries(diagnostic)) {
    await color(suffix, value)
    const diff = difference(baseline, await capture(`palette-${suffix}`))
    assert(diff.pixels > 20, `${suffix}: requires an independent visible consumer`)
    masks.push(diff.mask); paletteProof.push({ suffix, value, changedPixels: diff.pixels })
    await color(suffix, defaults[suffix])
  }
  const paletteOverlap = []
  for (let a = 0; a < masks.length; a++) for (let b = a + 1; b < masks.length; b++) {
    let shared = 0
    for (let i = 0; i < masks[a].length; i++) if (masks[a][i] && masks[b][i]) shared++
    // Body also colors the LED housing, so edge/body masks deliberately intersect.
    // Independent roles must still address distinct output regions, not identical masks.
    assert(shared < 0.98 * Math.max(paletteProof[a].changedPixels, paletteProof[b].changedPixels), 'Palette roles alias the same output region')
    paletteOverlap.push({ roles: [paletteProof[a].suffix, paletteProof[b].suffix], sharedPixels: shared })
  }
  for (const [suffix, value] of Object.entries(diagnostic)) await color(suffix, value)
  await capture('palette-five-independent-colors')
  for (const [suffix, value] of Object.entries(defaults)) await color(suffix, value)
  await numeric('block-size', 1.65)
  await choose('pattern', 'Split')
  return { numericProof, formations, triggerLabels, paletteProof, paletteOverlap, persisted: { blockSize: 1.65, pattern: 'Split' } }
}

export async function verifyBlockshiftPersistence(page) {
  await page.getByRole('tablist', { name: 'React right workspace panels' }).getByRole('tab', { name: 'DESIGN' }).click()
  const size = page.locator('[data-cinema2-control-id="blockshift-block-size"] input[type="range"]')
  await size.waitFor()
  assert.equal(await size.inputValue(), '1.65', 'Block size did not restore on preset re-entry')
  assert.match(await page.locator('[data-cinema2-control-id="blockshift-pattern"]').innerText(), /Split/)
}

export async function runBlockshiftTimingAcceptance(browser, output) {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 })
  await page.addInitScript(() => {
    window.__blockshiftLastInstances = null
    const original = WebGL2RenderingContext.prototype.bufferSubData
    WebGL2RenderingContext.prototype.bufferSubData = function (...args) {
      if (args[2] instanceof Float32Array && args[2].length === 168) window.__blockshiftLastInstances = Array.from(args[2])
      return original.apply(this, args)
    }
  })
  await page.goto('http://127.0.0.1:47981/src/test/browser/cinema2-blockshift-production.html?timing-fixture=1')
  await page.waitForFunction(() => window.__blockshiftTiming?.ready())
  const canvas = page.locator('[data-cinema2-output-canvas="true"]')
  const runs = []
  for (const [bpm, localSync, hostSync] of [[60, true, false], [180, true, false], [180, false, false], [180, true, true], [180, false, true]]) {
    await page.evaluate(options => window.__blockshiftTiming.reset(options), { bpm, localSync, hostSync, motion: 1, rate: 1 })
    await page.waitForFunction(() => window.__blockshiftTiming.ready() && window.__blockshiftTiming.frames() >= 12)
    const payload = await page.evaluate(() => window.__blockshiftLastInstances)
    assert(payload && payload.every(Number.isFinite), 'Missing actual GPU instance updates')
    const first = await canvas.screenshot({ path: path.join(output, `timing-${bpm}-local-${localSync}-host-${hostSync}.png`) })
    await page.waitForFunction(() => window.__blockshiftTiming.frames() >= 20)
    const second = await canvas.screenshot()
    assert(!(await sharp(first).raw().toBuffer()).equals(await sharp(second).raw().toBuffer()), 'Playing timing consumer did not change pixels')
    runs.push({ bpm, localSync, hostSync, observedYawRadians: payload[9], changingPixels: true })
  }
  assert.notEqual(runs[0].observedYawRadians, runs[1].observedYawRadians, 'Different authored BPMs must yield different GPU poses')
  assert.notEqual(runs[1].observedYawRadians, runs[2].observedYawRadians, 'Local BPM Sync must govern a real GPU timing consumer')
  await page.evaluate(() => window.__blockshiftTiming.pause())
  await page.waitForFunction(() => window.__blockshiftTiming.frames() >= 25)
  const paused = await canvas.screenshot()
  await page.waitForFunction(() => window.__blockshiftTiming.frames() >= 30)
  assert((await sharp(paused).raw().toBuffer()).equals(await sharp(await canvas.screenshot()).raw().toBuffer()), 'Pause did not freeze physical pixels')
  await page.evaluate(() => window.__blockshiftTiming.reset({ bpm: 180, localSync: true, hostSync: false, motion: 0, rate: 1 }))
  await page.waitForFunction(() => window.__blockshiftTiming.ready() && window.__blockshiftTiming.frames() >= 8)
  const zero = await canvas.screenshot()
  await page.waitForFunction(() => window.__blockshiftTiming.frames() >= 15)
  assert((await sharp(zero).raw().toBuffer()).equals(await sharp(await canvas.screenshot()).raw().toBuffer()), 'Zero Motion Amount did not freeze physical pixels')
  await page.close()
  await writeFile(path.join(output, 'timing-acceptance.json'), JSON.stringify({ input: 'Controlled standard host transport, authored BPM fallback; no analyzed events', runs, pauseFrozen: true, motionZeroFrozen: true }, null, 2))
  return { runs, pauseFrozen: true, motionZeroFrozen: true }
}

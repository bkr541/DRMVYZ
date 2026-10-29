#!/usr/bin/env node
/* global window, document, getComputedStyle */
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import sharp from 'sharp'

const root = resolve(import.meta.dirname, '..'), output = resolve(process.argv[2] ?? 'artifacts/inertia-phase3')
const inspectorOnly = process.argv.includes('--inspector-only')
await mkdir(output, { recursive: true })
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0 }, clearScreen: false, logLevel: 'error' })
const errors = [], results = []
let browser
try {
  await server.listen()
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
  const page = await browser.newPage({ viewport: { width: 954, height: 954 } })
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error' && !message.text().includes('Failed to load resource')) errors.push(message.text()) })
  const url = `http://127.0.0.1:${server.httpServer.address().port}/src/test/browser/cinema2-inertia-production.html`
  const api = async (method, ...args) => {
    const s = await page.evaluate(([method, args]) => window.__inertiaProduction[method](...args), [method, args])
    assert.equal(s.snapshot.phase, 'running', JSON.stringify(s.modules)); assert.equal(s.modules.failedModuleCount, 0, JSON.stringify(s.modules))
    return s
  }
  const load = async (query = '') => { await page.goto(url + query); await page.waitForFunction(() => window.__inertiaProduction); return api('prepare') }
  const pixels = async (name, save = false) => {
    const png = await page.locator('canvas').screenshot()
    if (save) await writeFile(join(output, `${name}.png`), png)
    return sharp(png).removeAlpha().raw().toBuffer()
  }
  const difference = (a, b) => { assert.equal(a.length, b.length); let sum = 0; for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]); return sum / a.length }
  const changed = (name, a, b, minimum = 0.008) => {
    const value = difference(a, b); results.push({ name, meanPixelDifference: value })
    assert(value > minimum, `${name} visually inert: ${value}`)
  }
  let generation = 0
  const defaults = { intensity: 0.7, 'bpm-sync': false, 'motion-speed': 1, 'motion-amount': 0.65, 'cage-size': 1, 'core-size': 1,
    'lattice-density': 0.8, 'point-size': 1, 'anchor-size': 1, deformation: 0.45, damping: 0.65, pattern: 'slice-shear', 'pattern-change': false, 'proof-part': 'all' }
  const sample = async (values = {}, timing = {}) => {
    await api('set', { ...defaults, ...values })
    await api('setTransport', { present: true, paused: false, hostSync: true, bpm: 120, seek: 0, track: `motion-${generation++}`, ...timing })
    await api('advanceBy', 1.4)
    return pixels('sample')
  }
  if (!inspectorOnly) {
  await load()
  const idle = await pixels('idle-approved', true)
  await api('advanceBy', 1)
  assert.deepEqual(await pixels('idle-held'), idle, 'No track must remain static')
  const patternShots = []
  for (const pattern of ['reference-cycle', 'countertwist', 'breathing-cage', 'torsion-wave', 'slice-shear', 'collapse-release']) {
    const a = await sample({ pattern }); await pixels(`${pattern}-a`, true)
    for (const [previous, shot] of patternShots) changed(`${previous}/${pattern} distinct patterns`, shot, a)
    patternShots.push([pattern, a])
    await api('advanceBy', 0.7); const b = await pixels(`${pattern}-b`, true)
    changed(`${pattern} native motion`, a, b)
  }
  const ranges = [
    ['intensity', 0, 0.7, 1], ['motion-speed', 0.25, 1, 2], ['motion-amount', 0, 0.65, 1],
    ['cage-size', 0.65, 1, 1.1], ['core-size', 0.65, 1, 1.4], ['lattice-density', 0.35, 0.8, 1],
    ['point-size', 0.5, 1, 2], ['anchor-size', 0.4, 1, 1.6], ['deformation', 0, 0.45, 1], ['damping', 0, 0.65, 1],
  ]
  for (const [key, min, normal, max] of ranges) {
    const a = await sample({ [key]: min }), b = await sample({ [key]: normal }), c = await sample({ [key]: max })
    changed(`${key} min/default`, a, b, key === 'anchor-size' ? 0.0005 : 0.008)
    changed(`${key} default/max`, b, c, key === 'anchor-size' ? 0.0005 : 0.008)
  }
  for (const [key, gray] of [['background', 0], ['lattice', 176 / 255], ['core', 208 / 255], ['anchor', 1], ['rib', 192 / 255]]) {
    const a = await sample()
    await api('set', { [`${key}-color`]: [1, 0.02, 0.02, 1] })
    changed(`${key} independent palette`, a, await pixels(`${key}-red`, key === 'core'), key === 'anchor' ? 0.0005 : 0.008)
    await api('set', { [`${key}-color`]: [gray, gray, gray, 1] })
  }
  console.log('PASS six native motions, numeric control ranges, and independent palette consumers')
  const free90 = await sample({ pattern: 'reference-cycle' }, { bpm: 90 })
  const free150 = await sample({ pattern: 'reference-cycle' }, { bpm: 150 })
  assert.deepEqual(free90, free150, 'Sync OFF must be independent of BPM')
  const sync90 = await sample({ pattern: 'reference-cycle', 'bpm-sync': true }, { bpm: 90 })
  const sync150 = await sample({ pattern: 'reference-cycle', 'bpm-sync': true }, { bpm: 150 })
  changed('BPM Sync ON/OFF', free90, sync90); changed('shared BPM 90/150', sync90, sync150)
  const hostOff = await sample({ pattern: 'reference-cycle', 'bpm-sync': true }, { bpm: 90, hostSync: false })
  assert.deepEqual(hostOff, free90, 'Host Sync OFF must select seconds timing')
  console.log('PASS shared tempo and host/preset Sync behavior')
  const frozenCamera = (await api('status')).camera
  await api('setTransport', { paused: true })
  const paused = await pixels('paused')
  // Advance the render clock while holding the host transport time.
  const time = (await api('status')).transport.timeSec
  await api('setTransport', { seek: time })
  await api('prepare'); assert.deepEqual(await pixels('paused-held'), paused)
  await api('set', { pattern: 'countertwist', 'pattern-change': true })
  changed('paused manual Pattern edit', paused, await pixels('paused-manual', true))
  assert.deepEqual((await api('status')).camera, frozenCamera, 'Pattern changes must not move the camera')
  await api('set', { 'pattern-change': false, 'motion-amount': 0 })
  await api('setTransport', { paused: false })
  const stopped = await pixels('motion-zero'); await api('advanceBy', 0.4)
  assert.deepEqual(await pixels('motion-zero-held'), stopped)
  // Verify the combined extreme, not just individually safe controls.
  await sample({ 'cage-size': 1.1, 'point-size': 2, 'anchor-size': 1.6, deformation: 1, 'motion-amount': 1 })
  for (const [width, height] of [[1280, 720], [720, 1280]]) {
    await page.setViewportSize({ width, height }); await api('resize')
    const png = await page.locator('canvas').screenshot(); await writeFile(join(output, `bounds-${width}x${height}.png`), png)
    const { data } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (x >= width * 0.04 && x < width * 0.96 && y >= height * 0.04 && y < height * 0.96) continue
      const i = (y * width + x) * 3
      assert(Math.max(data[i], data[i + 1], data[i + 2]) < 16, 'Combined extreme must retain safe padding')
    }
  }
  await writeFile(join(output, 'motion-report.json'), JSON.stringify({ results, errors }, null, 2))
  }
  // Actual production Inspector, including its body-portaled dropdown.
  await page.setViewportSize({ width: 1440, height: 1050 }); await load('?inspector')
  await page.locator('[data-cinema2-inspector="design"]').waitFor()
  const control = key => page.locator(`[data-cinema2-control-id="inertia-${key}"]`)
  assert.equal(await control('trigger').count(), 0)
  await control('pattern-change').locator('button').click()
  await control('trigger').waitFor()
  await page.getByRole('combobox', { name: 'Pattern', exact: true }).click()
  assert.equal(await page.getByRole('option').count(), 6)
  const font = await page.getByRole('option').first().locator('.drm-dropdown__option-label').evaluate(node => {
    const css = getComputedStyle(node); return { size: css.fontSize, weight: css.fontWeight, family: css.fontFamily }
  })
  await page.screenshot({ path: join(output, 'inspector-pattern-menu.png'), animations: 'disabled' })
  await page.getByRole('option', { name: 'Countertwist', exact: true }).click()
  assert.equal((await api('status')).groups.find(g => g.id === 'design').groups.find(g => g.label === 'Pattern').controls.find(c => c.definition.label === 'Pattern Change').value, true)
  await page.getByRole('combobox', { name: 'Trigger', exact: true }).click()
  assert.equal(await page.getByRole('option').count(), 11)
  await page.keyboard.press('Escape')
  const typography = await page.evaluate(() => Array.from(document.querySelectorAll('[data-cinema2-inspector="design"] .drc-header')).map(node => {
    const css = getComputedStyle(node), depth = node.parentElement.getAttribute('data-drc-depth')
    return { label: node.textContent.trim(), depth, size: css.fontSize, weight: css.fontWeight, spacing: css.letterSpacing, icon: !!node.querySelector('.drc-header-icon') }
  }))
  for (const header of typography) {
    assert.equal(header.size, header.depth === '0' ? '12px' : '11px', JSON.stringify(header))
    if (header.depth === '0') { assert.equal(header.weight, '700'); assert(header.icon) }
  }
  assert.equal(font.size, '11px', 'Portaled Pattern options must use the shared field role')
  await page.screenshot({ path: join(output, 'inspector.png'), animations: 'disabled' })
  await page.getByRole('button', { name: 'Palette', exact: true }).scrollIntoViewIfNeeded()
  assert.equal(await page.locator('[data-palette-row-label]').count(), 5)
  await page.screenshot({ path: join(output, 'inspector-palette.png'), animations: 'disabled' })
  // Rendered density range must survive each quality budget.
  for (const quality of ['low', 'high']) {
    await page.setViewportSize({ width: 954, height: 954 }); await load(`?quality=${quality}`)
    const a = await sample({ 'lattice-density': 0.35 }), b = await sample({ 'lattice-density': 1 })
    changed(`${quality} density range`, a, b)
  }
  assert.deepEqual(errors, [])
  await writeFile(join(output, 'report.json'), JSON.stringify({ phase: 3, scope: inspectorOnly ? 'Inspector and quality ranges; native motion/controls passed in the preceding execution' : 'full', results, typography, portalFont: font, errors }, null, 2))
  console.log(`PASS Inertia Phase Three (${results.length} perceptual comparisons): ${output}`)
} finally { await browser?.close(); server.httpServer?.closeAllConnections(); await server.close() }

#!/usr/bin/env node
/* global window */
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import sharp from 'sharp'

const output = resolve('artifacts/cinema2-submerge')
await mkdir(output, { recursive: true })
const server = await createServer({ server: { host: '127.0.0.1', port: 0, hmr: false }, logLevel: 'error' })
let browser
const errors = [], checks = []
try {
  await server.listen()
  browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] })
  const page = await browser.newPage({ viewport: { width: 840, height: 525 }, deviceScaleFactor: 1 })
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error' && !/Failed to load resource|CONTEXT_LOST_WEBGL/.test(message.text())) errors.push(message.text()) })
  const api = async (method, ...args) => {
    const result = await page.evaluate(([method, args]) => window.__submerge[method](...args), [method, args])
    assert.equal(result.snapshot.phase, 'running', JSON.stringify(result.snapshot))
    assert.equal(result.modules.failedModuleCount, 0, JSON.stringify(result.modules))
    assert.equal(result.effects.failedEffectCount, 0, JSON.stringify(result.effects))
    return result
  }
  const pixels = async name => {
    const png = await page.screenshot()
    if (name) await writeFile(join(output, `${name}.png`), png)
    return sharp(png).removeAlpha().raw().toBuffer()
  }
  const difference = (a, b) => {
    assert.equal(a.length, b.length)
    let sum = 0
    for (let index = 0; index < a.length; index += 1) sum += Math.abs(a[index] - b[index])
    return sum / a.length
  }
  const changed = (name, a, b, min = 0.005) => {
    const delta = difference(a, b)
    assert(delta > min, `${name} did not visibly change (${delta})`)
    checks.push({ name, meanPixelChange: delta })
  }
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/src/test/browser/cinema2-submerge-production.html`)
  await page.waitForFunction(() => window.__submerge)
  await api('prepare')
  await api('setParameters', { 'camera-motion': 0, 'auto-performance': false, 'bpm-sync': false })
  const baseline = await pixels('baseline')
  assert(baseline.some(value => value > 80), 'The 3D scene must contain visible illuminated geometry')
  await api('setParameters', { text: 'DEEP', 'line-2-text': 'WATER', 'line-mode': 'two' })
  const twoLines = await pixels('two-lines')
  changed('two-line text edit', baseline, twoLines)
  const { width, height } = page.viewportSize()
  let litLowerGlyphPixels = 0
  for (let y = Math.floor(height * 0.66); y < Math.floor(height * 0.86); y += 1) {
    for (let x = Math.floor(width * 0.2); x < Math.floor(width * 0.8); x += 1) {
      if (twoLines[(y * width + x) * 3 + 1] > 45) litLowerGlyphPixels += 1
    }
  }
  assert(litLowerGlyphPixels > width * height * 0.01, 'Lower glyphs must remain readable under selective ocean lighting')
  for (const name of ['sun-color', 'foam-color']) {
    await api('setParameters', { [name]: [1,0.05,0.03,1] }); const warm = await pixels()
    await api('setParameters', { [name]: [0.57,0.85,0.94,1] }); changed(name,warm,await pixels())
  }
  await api('setMusic', { active: true, energy: 0, bass: 0, high: 0 })
  const signatures = []
  for (const pattern of ['suspension', 'pressure-wave', 'undertow', 'crosscurrent', 'vortex', 'upwelling']) {
    await api('setParameters', { pattern })
    await api('advanceBy', 0.45)
    const image = await pixels(pattern)
    for (const [name, previous] of signatures) changed(`patterns ${name}/${pattern}`, previous, image)
    signatures.push([pattern, image])
  }
  for (const [name, off, on] of [['waves', 0, 1.5], ['sunlight', 0, 2], ['architecture', 0, 1], ['caustics', 0, 1.5], ['bubbles', 0, 1], ['particles', 0, 1], ['haze', 0, 0.1], ['letter-depth', 0.4, 2]]) {
    await api('setParameters', { [name]: off }); const a = await pixels()
    await api('setParameters', { [name]: on }); changed(name, a, await pixels(), name === 'particles' ? 0.002 : 0.005)
  }
  await api('setParameters', { haze: 0.055, 'letter-depth': 1, 'material-style': 'ceramic' })
  const ceramic = await pixels('ceramic')
  for (const material of ['metal', 'glass']) {
    await api('setParameters', { 'material-style': material })
    changed(material, ceramic, await pixels(material))
  }
  await api('setParameters', { 'auto-performance': true, 'material-style': 'ceramic', pattern: 'pressure-wave' })
  const dry = (await api('status')).authored
  const dryPixels = await pixels()
  await api('setMusic', { energy: 1, bass: 1, high: 1 })
  const wet = await api('advanceBy', 0.35)
  assert.equal(wet.authored, dry, 'Audio must not overwrite authored parameters')
  changed('audio changes the rendered water and letters', dryPixels, await pixels('audio-pressure'))
  checks.push({ name: 'audio choreography applies without changing authored parameters', passed: true })
  await api('setMusic', { paused: true })
  const held = await pixels()
  await api('advanceBy', 0.25)
  assert(difference(held, await pixels()) < 0.02, 'Pause must freeze geometry and water motion')
  checks.push({ name: 'pause freezes the complete scene', passed: true })
  await api('setMusic', { paused: false })
  await api('advanceBy', 0.4)
  changed('resume', held, await pixels())
  for (const [width, height] of [[700, 700], [540, 900]]) {
    await page.setViewportSize({ width, height }); await api('resize', width, height)
    await pixels(`${width === height ? 'square' : 'portrait'}`)
  }
  await page.setViewportSize({ width: 840, height: 525 }); await api('resize', 840, 525)
  const restored = await api('restoreContext')
  assert(restored.modules.estimatedGpuBytes > 0)
  checks.push({ name: 'context restoration rebuilds GPU resources', passed: true })
  await pixels('restored')
  assert.deepEqual(errors, [])
  await writeFile(join(output, 'review.json'), JSON.stringify({ checks, errors, final: restored }, null, 2))
  console.log(`SUBMERGE browser checks passed (${checks.length}); captures: ${output}`)
} catch (error) {
  console.error(JSON.stringify(errors,null,2));throw error
} finally {
  await browser?.close()
  await server.close()
}

#!/usr/bin/env node
/* global window */
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import sharp from 'sharp'

const output = resolve('artifacts/cinema2-orbital')
await mkdir(output, { recursive: true })
const server = await createServer({ cacheDir: 'node_modules/.cache/orbital-review-vite', server: { watch: null, host: '127.0.0.1', port: 0, hmr: false }, logLevel: 'error' })
let browser
try {
  await server.listen()
  browser = await chromium.launch({ headless: true, args: ['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--use-angle=swiftshader'] })
  const page = await browser.newPage({ viewport: { width: 840, height: 525 }, deviceScaleFactor: 1 })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error' && !/Failed to load resource|CONTEXT_LOST_WEBGL/.test(message.text())) errors.push(message.text())
  })
  const api = async (method, ...args) => {
    const result = await page.evaluate(([method, args]) => window.__orbital[method](...args), [method, args])
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
  const diff = (a, b) => {
    assert.equal(a.length, b.length)
    let sum = 0
    for (let index = 0; index < a.length; index += 1) sum += Math.abs(a[index] - b[index])
    return sum / a.length
  }
  const changes = []
  const changed = (name, a, b, min = .02) => {
    const delta = diff(a, b)
    assert(delta > min, `${name} did not visibly change (${delta})`)
    changes.push({ name, meanPixelChange: delta })
  }
  const assetResponse = page.waitForResponse(response => response.url().endsWith('/orbital-metal-sphere.glb'))
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/src/test/browser/cinema2-submerge-production.html?preset=orbital`)
  await page.waitForFunction(() => window.__orbital)
  const ready = await api('prepare')
  assert((await assetResponse).ok(), 'The supplied metal sphere must load through the native asset registry')
  assert(ready.modules.estimatedGpuBytes > 0)
  await api('setParameters', { 'camera-motion': 0, 'auto-performance': false })
  const baseline = await pixels('orbital')
  await api('setParameters', { text: 'DEEP', 'line-2-text': 'SPACE', 'line-mode': 'two' })
  const brass = await pixels('two-lines')
  changed('two-line text edit', baseline, brass)
  await api('setParameters', { 'material-style': 'polished' })
  changed('source texture versus polished silver', brass, await pixels())
  await api('setParameters', { 'material-style': 'artifact', 'gyroscope-size': .55 })
  changed('sphere size', brass, await pixels())
  await api('setParameters', { 'gyroscope-size': 1 })
  await api('setMusic', { active: true, bass: 0, energy: 0, high: 0 })
  await api('advanceBy', .3)
  const signatures = []
  for (const pattern of ['gyroscopic-drift', 'apsis-pulse', 'counter-orbit', 'meridian-sweep', 'resonant-lock', 'eclipse-rise']) {
    await api('setParameters', { pattern })
    await api('advanceBy', .34)
    const rendered = await pixels()
    for (const [previous, image] of signatures) changed(`${previous} / ${pattern}`, image, rendered)
    signatures.push([pattern, rendered])
  }
  await api('setParameters', { pattern: 'apsis-pulse', 'auto-performance': true })
  const authored = (await api('status')).authored
  const quiet = await pixels()
  await api('setMusic', { bass: 1, high: 1, energy: 1 })
  const playing = await api('advanceBy', .4)
  changed('audio moves the letters and rig', quiet, await pixels('audio-pulse'))
  assert.equal(playing.authored, authored, 'Audio must preserve the authored settings')
  await api('setMusic', { paused: true })
  const held = await pixels()
  await api('advanceBy', .22)
  assert(diff(held, await pixels()) < .03, 'Pause must hold the geometry')
  await page.setViewportSize({ width: 420, height: 700 })
  await api('resize', 420, 700)
  await pixels('portrait')
  const restored = await api('restoreContext')
  assert(restored.snapshot.contextGeneration > ready.snapshot.contextGeneration)
  assert.deepEqual(errors, [])
  await writeFile(join(output, 'review.json'), JSON.stringify({ changes, gpuBytes: restored.modules.estimatedGpuBytes }, null, 2))
  console.log(`ORBITAL WebGL checks passed (${changes.length} rendered comparisons)`)
} finally {
  await browser?.close()
  await server.close()
}

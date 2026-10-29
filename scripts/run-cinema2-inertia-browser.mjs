#!/usr/bin/env node
/* global window */
/** Phase Two only: real runtime/registry/camera/canvas; no local mock drawing. */
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import sharp from 'sharp'

const root = resolve(import.meta.dirname, '..')
const output = resolve(process.argv[2] ?? '/tmp/inertia-phase2-acceptance')
await mkdir(output, { recursive: true })
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0 }, clearScreen: false, logLevel: 'error' })
const errors = [], results = []
let browser
try {
  await server.listen()
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
  const page = await browser.newPage({ viewport: { width: 954, height: 954 }, deviceScaleFactor: 1 })
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error' && !message.text().includes('Failed to load resource')) errors.push(message.text()) })
  const url = `http://127.0.0.1:${server.httpServer.address().port}/src/test/browser/cinema2-inertia-production.html`
  const api = async (method, ...args) => {
    const status = await page.evaluate(([name, values]) => window.__inertiaProduction[name](...values), [method, args])
    if (method !== 'dispose') {
      assert.equal(status.snapshot.phase, 'running', JSON.stringify(status))
      assert.equal(status.modules.failedModuleCount, 0, JSON.stringify(status.modules))
      assert.equal(status.effects.failedEffectCount, 0)
    }
    return status
  }
  const load = async () => {
    await page.goto(url)
    await page.waitForFunction(() => window.__inertiaProduction)
    return api('prepare')
  }
  const capture = async name => {
    const png = await page.locator('canvas').screenshot()
    await writeFile(join(output, `${name}.png`), png)
    const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    let lit = 0, minX = info.width, minY = info.height, maxX = 0, maxY = 0
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 3
      if (Math.max(data[i], data[i + 1], data[i + 2]) > 12) {
        lit++; minX = Math.min(x, minX); maxX = Math.max(x, maxX); minY = Math.min(y, minY); maxY = Math.max(y, maxY)
      }
    }
    const result = { name, lit, width: info.width, height: info.height, bounds: [minX, minY, maxX, maxY] }
    results.push(result)
    return { data, ...result }
  }
  const baselineStatus = await load()
  const baseline = await capture('baseline')
  assert(baseline.lit > 2500, 'Hero sculpture must contain readable geometry')
  const safe = shot => {
    const [x0, y0, x1, y1] = shot.bounds
    assert(x0 > shot.width * 0.04 && x1 < shot.width * 0.96 && y0 > shot.height * 0.04 && y1 < shot.height * 0.96, `${shot.name}: geometry clipped or padding lost`)
  }
  safe(baseline)
  await api('prepare')
  assert.deepEqual((await capture('static-held')).data, baseline.data, 'Static core must not advance with RAF time')
  for (const pose of ['rotated', 'folded']) {
    await api('set', { 'proof-pose': pose })
    const shot = await capture(pose); safe(shot)
    assert.notDeepEqual(shot.data, baseline.data, `${pose} must be a real geometric proof`)
  }
  await api('set', { 'proof-pose': 'coherent' })
  for (const part of ['lattice', 'core', 'anchors', 'ribs']) {
    await api('set', { 'proof-part': part })
    const shot = await capture(`isolated-${part}`)
    assert(shot.lit > (part === 'anchors' ? 40 : 150), `${part} is missing or invisible`)
    safe(shot)
    if (part === 'core') {
      const [x0, , x1] = shot.bounds
      assert(Math.abs((x1 - x0) / shot.width - 0.26) < 0.025, 'Core must occupy the authored 26% width')
      assert(Math.abs((x0 + x1) / 2 - shot.width / 2) < 2, 'Core must be centered')
    }
  }
  await api('set', { 'proof-part': 'all', intensity: 0 })
  assert.equal((await capture('intensity-off')).lit, 0, 'Black background cannot satisfy hero visibility')
  await api('set', { intensity: 0.7 })
  for (const [width, height] of [[1280, 720], [720, 1280]]) {
    await page.setViewportSize({ width, height }); await api('resize')
    const shot = await capture(`${width}x${height}`); safe(shot)
    const spanX = shot.bounds[2] - shot.bounds[0], spanY = shot.bounds[3] - shot.bounds[1]
    assert(Math.abs(spanX / spanY - (baseline.bounds[2] - baseline.bounds[0]) / (baseline.bounds[3] - baseline.bounds[1])) < 0.03, 'Resize must preserve sculpture proportions')
  }
  const disposed = await api('dispose')
  assert.equal(disposed.snapshot.phase, 'disposed')
  assert.equal(disposed.snapshot.resources.activeAnimationFrameCount, 0)
  await page.setViewportSize({ width: 954, height: 954 })
  await load()
  assert.deepEqual((await capture('recreated')).data, baseline.data, 'Fresh runtime must reproduce the same static sculpture')
  assert.deepEqual(errors, [], 'Production browser must not report errors')
  await writeFile(join(output, 'report.json'), JSON.stringify({ phase: 2, baselineStatus, results, errors }, null, 2))
  console.log(`PASS Inertia static production acceptance (${results.length} captures): ${output}`)
} finally {
  await browser?.close(); await server.close()
}

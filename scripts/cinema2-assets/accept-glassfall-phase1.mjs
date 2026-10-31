/* global window */
// Static composition only, using the real Cinema2Runtime and render graph.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import sharp from 'sharp'
const root = resolve(import.meta.dirname, '../..')
const out = resolve(root, 'artifacts/glassfall-phase1')
const server = await createServer({ root, clearScreen: false, server: { host: '127.0.0.1', port: 0 } })
let browser
const errors = [], report = []
try {
  await server.listen()
  const url = `http://127.0.0.1:${server.httpServer.address().port}/src/test/browser/cinema2-glassfall-phase1.html`
  if (process.argv.includes('--serve')) { console.log(`GLASSFALL static review: ${url}`); await new Promise(() => {}) }
  await mkdir(out, { recursive: true })
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
  const page = await browser.newPage({ viewport: { width: 712, height: 1006 }, deviceScaleFactor: 1 })
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto(url)
  const ready = () => page.waitForFunction(() => window.glassfallStudy?.status().modules.modules.some(m => m.activeResourceLeaseCount > 0))
  await ready().catch(async error => { throw new Error(`${error}\n${JSON.stringify({ errors, status: await page.evaluate(() => window.glassfallStudy?.status()) })}`) })
  const api = (name, ...args) => page.evaluate(({ name, args }) => window.glassfallStudy[name](...args), { name, args })
  const capture = async name => sharp(await page.locator('canvas').screenshot(name ? { path: resolve(out, `${name}.png`) } : {})).removeAlpha().raw().toBuffer()
  let portrait
  for (const [name, width, height] of [['portrait', 712, 1006], ['square', 768, 768], ['landscape', 1280, 720]]) {
    await page.setViewportSize({ width, height }); await api('resize')
    const states = {}
    for (const state of ['triangles']) {
      const pixels = await capture(`${name}-${state}`)
      let lit = 0, cyan = 0, violet = 0, white = 0
      for (let i = 0; i < pixels.length; i += 3) {
        const [r, g, b] = pixels.subarray(i, i + 3)
        if (Math.max(r, g, b) > 90) lit++
        if (g > 150 && b > 150 && r < 100) cyan++
        if (r > 70 && b > 150 && g < 90) violet++
        if (r > 150 && g > 150 && b > 150) white++
      }
      assert(lit > width * height * .02, `${name}/${state}: actual isolated hero geometry must be visible`)
      if (state === 'triangles') assert(cyan > 100 && violet > 100 && white > 100, `${name}: distinct triangle palette roles`)
      await api('tick', 80)
      assert(pixels.equals(await capture()), `${name}/${state}: static composition changed with time`)
      states[state] = { lit, cyan, violet, white }
      if (name === 'portrait' && state === 'triangles') portrait = pixels
    }
    const status = await api('status')
    assert.equal(status.modules.failedModuleCount, 0)
    assert.equal(status.modules.degradedModuleCount, 0)
    assert.equal(status.render.failedPassCount, 0)
    report.push({ name, width, height, states })
  }
  await page.setViewportSize({ width: 712, height: 1006 }); await api('resize')
  const normalDepth = await capture()
  await api('depth', false)
  const noDepth = await capture('portrait-depth-off')
  const difference = (a, b) => a.reduce((sum, value, i) => sum + Math.abs(value - b[i]), 0) / a.length
  const depthDifference = difference(normalDepth, noDepth)
  assert(depthDifference > 1, 'Raised panels, shadows and rear separation must change actual output')
  await api('depth', true); await api('oblique', true)
  const oblique = await capture('portrait-oblique')
  assert(difference(normalDepth, oblique) > 2, 'Real meshes must show perspective/parallax under an oblique review camera')
  await api('oblique', false)
  const retired = await api('reenter'); await ready(); await api('tick', 2)
  assert.equal(retired.activeLeaseCount, 0)
  assert.equal(retired.estimatedGpuMemoryBytes, 0)
  assert(portrait.equals(await capture('portrait-reentry')), 'Re-entry must reconstruct the same composition')
  const disposed = await api('dispose')
  assert.equal(disposed.activeLeaseCount, 0)
  assert.equal(disposed.estimatedGpuMemoryBytes, 0)
  assert.deepEqual(errors, [])
  await writeFile(resolve(out, 'report.json'), JSON.stringify({ report, depthDifference, retired, disposed, errors }, null, 2))
  console.log(`GLASSFALL phase 1 passed: isolated geometry, 3 aspects, static hold, raised/rear depth, oblique view, re-entry and disposal. Captures: ${out}`)
} finally { await browser?.close(); await server.close() }

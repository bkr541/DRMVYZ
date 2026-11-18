// Focused visual acceptance through the production Cinema 2.0 runtime.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'
import sharp from 'sharp'

const port = 5198
const externalServer = process.env.PLAYWRIGHT_BASE_URL
const baseUrl = externalServer ?? `http://127.0.0.1:${port}`
const server = externalServer ? null : spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: 'pipe' })
const output = 'artifacts/cinema2-open-decks'
let browser
try {
  await mkdir(output, { recursive: true })
  let ready = false
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try { ready = (await fetch(baseUrl)).ok } catch { /* Server is starting. */ }
    if (ready) break
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert(ready, 'Vite preview did not start')
  browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] })
  const reports = []
  for (const [quality, width, height] of [['high', 1280, 720], ['low', 1280, 720], ['high', 800, 720], ['high', 1000, 880]]) {
    const page = await browser.newPage({ viewport: { width, height } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
    await page.goto(`${baseUrl}/src/test/browser/cinema2-open-decks.html?quality=${quality}`)
    await page.waitForFunction(() => {
      const snapshot = globalThis.openDecksReview?.snapshot()
      return snapshot?.modules.estimatedGpuBytes > 0 && snapshot.runtime.frameCount >= 15
    }, {}, { timeout: 90000 })
    // The photograph is a large texture that decodes and uploads after the module reports active; give it a moment before judging the frame.
    await page.waitForTimeout(2500)
    const snapshot = await page.evaluate(() => globalThis.openDecksReview.snapshot())
    assert.equal(snapshot.modules.failedModuleCount, 0)
    assert.equal(snapshot.modules.degradedModuleCount, 0)
    assert.equal(snapshot.render.failedPassCount, 0)
    assert.equal(snapshot.effects.failedEffectCount, 0)
    assert.deepEqual(errors, [])
    // Texture upload and shader compilation can outlast the module's first resource report.
    let png
    let visible = false
    for (let attempt = 0; attempt < 40; attempt++) {
      png = await page.screenshot()
      const stats = await sharp(png).stats()
      visible = stats.channels.slice(0, 3).some(channel => channel.stdev > 12)
      if (visible) break
      await page.waitForTimeout(500)
    }
    assert(visible, 'Scene is blank or flat')
    await writeFile(`${output}/${quality}-${width}.png`, png)
    assert.equal((await page.evaluate(() => globalThis.openDecksReview.set('elevation', 8))).ok, true)
    const dipFrame = await page.evaluate(() => globalThis.openDecksReview.snapshot().runtime.frameCount)
    await page.waitForFunction(previous => globalThis.openDecksReview.snapshot().runtime.frameCount > previous + 2, dipFrame)
    await page.screenshot({ path: `${output}/club-${quality}-${width}.png` })
    assert.equal((await page.evaluate(() => globalThis.openDecksReview.set('elevation', 30))).ok, true)
    // Club geometry intentionally occupies the previously empty background strip.
    // Closed-backdrop topology is checked by open-decks-geometry.test.mjs.
    // Palette must affect baked/unlit textures too; it operates in the final color grade.
    if (quality === 'high' && width === 1280) {
      assert.equal((await page.evaluate(() => globalThis.openDecksReview.set('heading', 25))).ok, true)
      await page.waitForFunction(previous => globalThis.openDecksReview.snapshot().runtime.frameCount > previous + 2, snapshot.runtime.frameCount)
      const angled = await page.screenshot({ path: `${output}/illustrated-angle.png` })
      assert.notDeepEqual(angled, png, 'Orbit view must reveal depth in the illustrated geometry')
      assert.equal((await page.evaluate(() => globalThis.openDecksReview.set('elevation', -70))).ok, true)
      const elevationFrame = await page.evaluate(() => globalThis.openDecksReview.snapshot().runtime.frameCount)
      await page.waitForFunction(previous => globalThis.openDecksReview.snapshot().runtime.frameCount > previous + 2, elevationFrame)
      await page.screenshot({ path: `${output}/elevation-minus-70.png` })
      assert.equal((await page.evaluate(() => globalThis.openDecksReview.set('elevation', 30))).ok, true)
      const depthFrame = await page.evaluate(() => globalThis.openDecksReview.snapshot().runtime.frameCount)
      await page.waitForFunction(previous => globalThis.openDecksReview.snapshot().runtime.frameCount > previous + 2, depthFrame)
      await page.screenshot({ path: `${output}/raised-controls.png` })
      assert.equal((await page.evaluate(() => globalThis.openDecksReview.set('elevation', 30))).ok, true)
      assert.equal((await page.evaluate(() => globalThis.openDecksReview.set('heading', 0))).ok, true)
      assert.equal((await page.evaluate(() => globalThis.openDecksReview.set('temperature', .8))).ok, true)
      const frame = snapshot.runtime.frameCount
      await page.waitForFunction(previous => globalThis.openDecksReview.snapshot().runtime.frameCount > previous + 2, frame)
      const edited = await page.screenshot()
      assert.notDeepEqual(edited, png, 'Palette control has no visible effect')
    }
    const released = await page.evaluate(() => globalThis.openDecksReview.dispose())
    assert.equal(released.activeLeaseCount, 0)
    assert.equal(released.activeSurfaceCount, 0)
    reports.push({ quality, width, height, snapshot, released })
    await page.close()
  }
  await writeFile(`${output}/report.json`, JSON.stringify(reports, null, 2))
  console.log('Open Decks: high/low quality, desktop/narrow framing, palette edit, clean disposal and zero renderer errors passed.')
} finally {
  await browser?.close()
  server?.kill('SIGTERM')
}

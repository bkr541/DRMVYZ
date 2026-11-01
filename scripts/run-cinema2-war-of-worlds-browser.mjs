// Focused visual acceptance through the production Cinema 2.0 runtime.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'
import sharp from 'sharp'

const port = 5199
const externalServer = process.env.PLAYWRIGHT_BASE_URL
const baseUrl = externalServer ?? `http://127.0.0.1:${port}`
const server = externalServer ? null : spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: 'pipe' })
const output = 'artifacts/cinema2-war-of-worlds'
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
  for (const [quality, width, height] of [['high', 1280, 720], ['low', 1280, 720], ['high', 800, 720]]) {
    const page = await browser.newPage({ viewport: { width, height } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
    await page.goto(`${baseUrl}/src/test/browser/cinema2-war-of-worlds.html?quality=${quality}`)
    await page.waitForFunction(() => {
      const snapshot = globalThis.warOfWorldsReview?.snapshot()
      return snapshot?.modules.estimatedGpuBytes > 0 && snapshot.runtime.frameCount >= 15
    }, {}, { timeout: 90000 })
    const snapshot = await page.evaluate(() => globalThis.warOfWorldsReview.snapshot())
    assert.equal(snapshot.modules.failedModuleCount, 0)
    assert.equal(snapshot.modules.degradedModuleCount, 0)
    assert.equal(snapshot.render.failedPassCount, 0)
    assert.equal(snapshot.effects.failedEffectCount, 0)
    assert.deepEqual(errors, [])
    const png = await page.screenshot({ path: `${output}/${quality}-${width}.png` })
    const stats = await sharp(png).stats()
    assert(stats.channels.slice(0, 3).some(channel => channel.stdev > 12), 'Scene is blank or flat')
    // Palette must affect baked/unlit textures too; it operates in the final color grade.
    if (quality === 'high' && width === 1280) {
      assert.equal((await page.evaluate(() => globalThis.warOfWorldsReview.set('temperature', .8))).ok, true)
      const frame = snapshot.runtime.frameCount
      await page.waitForFunction(previous => globalThis.warOfWorldsReview.snapshot().runtime.frameCount > previous + 2, frame)
      const edited = await page.screenshot()
      assert.notDeepEqual(edited, png, 'Palette control has no visible effect')
    }
    const released = await page.evaluate(() => globalThis.warOfWorldsReview.dispose())
    assert.equal(released.activeLeaseCount, 0)
    assert.equal(released.activeSurfaceCount, 0)
    reports.push({ quality, width, height, snapshot, released })
    await page.close()
  }
  await writeFile(`${output}/report.json`, JSON.stringify(reports, null, 2))
  console.log('War Of Worlds: high/low quality, desktop/narrow framing, palette edit, clean disposal and zero renderer errors passed.')
} finally {
  await browser?.close()
  server?.kill('SIGTERM')
}

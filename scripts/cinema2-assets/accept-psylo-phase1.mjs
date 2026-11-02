// Focused Phase 1 acceptance against the real Cinema 2.0 render path.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import { chromium } from '@playwright/test'
import sharp from 'sharp'

const root = resolve(import.meta.dirname, '../..'), out = resolve(root, 'artifacts/cinema2-psylo-phase1')
await mkdir(out, { recursive: true })
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0 }, clearScreen: false })
let browser
try {
  await server.listen()
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
  const page = await browser.newPage({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 1 })
  const errors = [], samples = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  const url = `http://127.0.0.1:${server.httpServer.address().port}/src/test/browser/cinema2-psylo-production.html`
  async function ready() {
    await page.waitForFunction(() => { const s = globalThis.__psyloProduction?.status(); return s && (s.modules.estimatedGpuBytes > 0 || s.modules.failedModuleCount > 0 || s.modules.degradedModuleCount > 0) }, undefined, { timeout: 45000 }).catch(async error => { console.error(JSON.stringify({ errors, status: await page.evaluate(() => globalThis.__psyloProduction?.status()) })); throw error })
    await page.waitForTimeout(350)
  }
  async function capture(name) {
    const status = await page.evaluate(() => globalThis.__psyloProduction.status())
    assert.equal(status.runtime.phase, 'running'); assert.equal(status.modules.failedModuleCount, 0); assert.equal(status.modules.degradedModuleCount, 0)
    assert.equal(status.render.failedPassCount, 0)
    const png = await page.locator('canvas').screenshot({ path: resolve(out, name + '.png') })
    const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    function region(x0, y0, x1, y1) {
      let count = 0, visible = 0, sum = 0
      for (let y = Math.floor(info.height * y0); y < info.height * y1; y++) for (let x = Math.floor(info.width * x0); x < info.width * x1; x++) {
        const i = (y * info.width + x) * info.channels
        const peak = Math.max(data[i], data[i + 1], data[i + 2]); visible += peak > 50 ? 1 : 0; sum += peak; count++
      }
      return { visibleFraction: visible / count, meanPeak: sum / count }
    }
    const regions = { grove: region(.32, .15, .68, .68), ground: region(.08, .7, .92, .98), left: region(.04, .25, .3, .7), right: region(.7, .25, .96, .7) }
    assert.ok(regions.grove.visibleFraction > .12, `${name}: grove invisible ${JSON.stringify(regions)}`)
    assert.ok(regions.ground.visibleFraction > .15, `${name}: ground invisible ${JSON.stringify(regions)}`)
    samples.push({ name, status, regions }); return png
  }
  await page.goto(url, { waitUntil: 'domcontentloaded' }); await ready()
  const baseline = await capture('default')
  const before = await page.evaluate(() => globalThis.__psyloProduction.status().camera)
  await page.waitForTimeout(250)
  const held = await page.locator('canvas').screenshot()
  assert.deepEqual(await page.evaluate(() => globalThis.__psyloProduction.status().camera), before, 'Phase 1 camera moved automatically')
  assert.deepEqual(await sharp(baseline).raw().toBuffer(), await sharp(held).raw().toBuffer(), 'Phase 1 scene is animated')
  for (const [name, heading, elevation, distance] of [['left', -85, 10, 27], ['rear', 180, 10, 27], ['right', 85, 10, 27], ['overview', 25, 37, 40]]) {
    await page.evaluate(args => globalThis.__psyloProduction.view(...args), [heading, elevation, distance]); await capture(name)
  }
  await page.evaluate(() => globalThis.__psyloProduction.view(0))
  for (const [name, width, height] of [['square', 960, 960], ['portrait', 720, 1280]]) {
    await page.setViewportSize({ width, height }); await page.evaluate(() => globalThis.__psyloProduction.resize()); await capture(name)
  }
  const disposed = await page.evaluate(() => globalThis.__psyloProduction.dispose())
  assert.equal(disposed.modules.activeResourceLeaseCount, 0)
  await page.setViewportSize({ width: 1440, height: 810 }); await page.goto(url + '?quality=low'); await ready(); await capture('low')
  assert.deepEqual(errors, [])
  await writeFile(resolve(out, 'report.json'), JSON.stringify({ phase: 1, samples, disposed, errors }, null, 2) + '\n')
  console.log(JSON.stringify({ output: out, captures: samples.length, errors }))
} finally { await browser?.close(); await server.close() }

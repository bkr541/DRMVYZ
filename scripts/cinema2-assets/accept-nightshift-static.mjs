// Focused static composition check on the current production runtime.
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import sharp from 'sharp'

const root = resolve(import.meta.dirname, '../..')
const out = resolve(root, 'artifacts/cinema2-nightshift-static')
await mkdir(out, { recursive: true })
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0 }, clearScreen: false })
let browser
try {
  await server.listen()
  const address = server.httpServer.address()
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
  const page = await browser.newPage({ viewport: { width: 1672, height: 941 }, deviceScaleFactor: 1 })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`http://127.0.0.1:${address.port}/src/test/browser/cinema2-nightshift-production.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => Boolean(globalThis.__nightshiftProduction), undefined, { timeout: 30000 })
  const status = await page.evaluate(() => globalThis.__nightshiftProduction.prepare())
  if (status.snapshot.phase !== 'running' || status.modules.failedModuleCount || errors.length) throw new Error(JSON.stringify({ status, errors }))
  const image = await page.locator('canvas').screenshot({ path: resolve(out, 'nightshift-static-16x9.png') })
  const { data, info } = await sharp(image).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  function region(x0, y0, x1, y1) {
    let lit = 0, sum = 0, count = 0
    for (let y = Math.floor(y0 * info.height); y < y1 * info.height; y++) for (let x = Math.floor(x0 * info.width); x < x1 * info.width; x++) {
      const offset = (y * info.width + x) * info.channels
      const peak = Math.max(data[offset], data[offset + 1], data[offset + 2])
      if (peak > 90) lit++
      sum += peak; count++
    }
    return { litFraction: lit / count, meanPeak: sum / count }
  }
  // Sample the extended rear rail, rather than the old, narrower diagonal's
  // former footprint. Keep the ceiling measurement independent of the ball.
  const regions = { ball: region(.39, .03, .61, .40), floor: region(.05, .65, .95, .95), ceiling: region(.33, .19, .40, .22), gap: region(.3, .46, .7, .57) }
  if (regions.ball.litFraction < .08 || regions.floor.litFraction < .5 || regions.ceiling.litFraction < .15) throw new Error(`Hero geometry is not visible: ${JSON.stringify(regions)}`)
  if (regions.gap.meanPeak > 45) throw new Error(`The reference's dark separation is lost: ${JSON.stringify(regions.gap)}`)
  await page.setViewportSize({ width: 941, height: 941 })
  const resized = await page.evaluate(() => globalThis.__nightshiftProduction.resize())
  if (resized.snapshot.phase !== 'running' || resized.modules.failedModuleCount) throw new Error('NIGHTSHIFT failed on resize.')
  await page.locator('canvas').screenshot({ path: resolve(out, 'nightshift-static-square.png') })
  await writeFile(resolve(out, 'report.json'), JSON.stringify({ phase: 'Current static composition review', status, resized, regions, errors }, null, 2) + '\n')
  console.log(JSON.stringify({ output: out, regions, errors }))
} finally {
  await browser?.close()
  await server.close()
}

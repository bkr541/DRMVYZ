#!/usr/bin/env node
// Captures Mainframe through the real Cinema 2.0 runtime, semantic emissive shader, HDR bloom and filmic finish.
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'

const root = resolve(import.meta.dirname, '../..')
const artifactRoot = join(root, 'artifacts/cinema2-mainframe-stage3')
const chrome = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
if (!existsSync(chrome)) throw new Error('A Chromium executable is required. Set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH.')
const cases = Object.freeze([
  Object.freeze({ name: 'mainframe-16x9-high', width: 1920, height: 1080, quality: 'high' }),
  Object.freeze({ name: 'mainframe-embedded-stage-high', width: 1000, height: 1200, quality: 'high' }),
  Object.freeze({ name: 'mainframe-ultrawide-stage-high', width: 2048, height: 1041, quality: 'high' }),
  Object.freeze({ name: 'mainframe-outward-bus-near-high', width: 1280, height: 720, quality: 'high', timeSec: 0.25 }),
  Object.freeze({ name: 'mainframe-outward-bus-far-high', width: 1280, height: 720, quality: 'high', timeSec: 1.25 }),
  Object.freeze({
    name: 'mainframe-deep-zoom-embedded-high',
    width: 1000,
    height: 1200,
    quality: 'high',
    params: Object.freeze({ 'mainframe-scale': 0.45 }),
    requireVerticalCoverage: true,
  }),
  Object.freeze({
    name: 'mainframe-components-off-scale-high',
    width: 1280,
    height: 720,
    quality: 'high',
    params: Object.freeze({ 'mainframe-enable-radar': false, 'mainframe-enable-chip': false, 'mainframe-scale': 1.1 }),
  }),
])
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')

await mkdir(artifactRoot, { recursive: true })
const output = await mkdtemp(join(artifactRoot, 'run-'))
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0, strictPort: false }, clearScreen: false })
let browser
try {
  await server.listen()
  const address = server.httpServer?.address()
  if (!address || typeof address === 'string') throw new Error('Vite did not expose a local Mainframe capture port.')
  const baseUrl = `http://127.0.0.1:${address.port}/src/test/browser/cinema2-mainframe-production.html`
  browser = await chromium.launch({ headless: true, executablePath: chrome })
  const results = []
  for (const entry of cases) {
    const page = await browser.newPage({ viewport: { width: entry.width, height: entry.height }, deviceScaleFactor: 1 })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    try {
      const url = new URL(baseUrl)
      url.searchParams.set('quality', entry.quality)
      if ('timeSec' in entry) url.searchParams.set('timeSec', String(entry.timeSec))
      if ('params' in entry) url.searchParams.set('params', JSON.stringify(entry.params))
      await page.goto(url.href, { waitUntil: 'domcontentloaded' })
      await page.waitForFunction(() => Boolean(globalThis.__mainframeProduction), undefined, { timeout: 30_000 })
      const status = await page.evaluate(() => globalThis.__mainframeProduction?.prepare())
      if (errors.length) throw new Error(errors.join('\n'))
      const filename = `${entry.name}.png`
      const first = await page.locator('#mainframe-production').screenshot({ path: join(output, filename), timeout: 120_000 })
      const second = await page.locator('#mainframe-production').screenshot({ timeout: 120_000 })
      if (sha256(first) !== sha256(second)) throw new Error('Fixed-time duplicate captures were not deterministic.')
      const metrics = await page.evaluate(async png => {
        const bytes = Uint8Array.from(atob(png), character => character.charCodeAt(0))
        const bitmap = await globalThis.createImageBitmap(new Blob([bytes], { type: 'image/png' }))
        const canvas = globalThis.document.createElement('canvas')
        canvas.width = bitmap.width; canvas.height = bitmap.height
        const context = canvas.getContext('2d', { willReadFrequently: true })
        if (!context) throw new Error('Pixel analysis unavailable.')
        context.drawImage(bitmap, 0, 0)
        const data = context.getImageData(0, 0, bitmap.width, bitmap.height).data
        const values = []
        for (let index = 0; index < data.length; index += 16) values.push((0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2]) / 255)
        values.sort((a, b) => a - b)
        const at = fraction => values[Math.floor((values.length - 1) * fraction)] ?? 0
        const bandPercentile = (fromY, toY, fraction) => {
          const band = []
          for (let y = fromY; y < toY; y += 2) for (let x = 0; x < bitmap.width; x += 4) {
            const index = (y * bitmap.width + x) * 4
            band.push((0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2]) / 255)
          }
          band.sort((a, b) => a - b)
          return Number((band[Math.floor((band.length - 1) * fraction)] ?? 0).toFixed(4))
        }
        const edgeHeight = Math.max(1, Math.round(bitmap.height * 0.05))
        const result = {
          median: Number(at(0.5).toFixed(4)), p95: Number(at(0.95).toFixed(4)), p99: Number(at(0.99).toFixed(4)), maximum: Number((values.at(-1) ?? 0).toFixed(4)),
          topEdgeP95: bandPercentile(0, edgeHeight, 0.95),
          bottomEdgeP95: bandPercentile(bitmap.height - edgeHeight, bitmap.height, 0.95),
        }
        bitmap.close()
        return result
      }, first.toString('base64'))
      if (metrics.p99 < 0.05 || metrics.maximum < 0.25) throw new Error(`Production frame is not visibly lit (${JSON.stringify(metrics)}).`)
      if (entry.requireVerticalCoverage && (metrics.topEdgeP95 < 0.02 || metrics.bottomEdgeP95 < 0.02)) throw new Error(`Deep zoom exposed negative vertical space (${JSON.stringify(metrics)}).`)
      results.push({ ...entry, filename, sha256: sha256(first), metrics, status })
      console.log(`${entry.name}: ${sha256(first).slice(0, 12)} ${JSON.stringify(metrics)}`)
    } finally {
      await page.close()
    }
  }
  await writeFile(join(output, 'manifest.json'), `${JSON.stringify({ schemaVersion: 1, preset: 'drmvyz.cinema2.mainframe', results }, null, 2)}\n`)
console.log(`Mainframe production captures: ${relative(root, output)}`)
} finally {
  await browser?.close()
  await server.close()
}

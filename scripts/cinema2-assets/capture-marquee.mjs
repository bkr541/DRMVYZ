#!/usr/bin/env node
// Captures named MARQUEE production frames (real Cinema 2.0 runtime, real WebGL) for visual review.
//   node scripts/cinema2-assets/capture-marquee.mjs <set> [outDir]      sets: hero | views | modes | text | audio | all
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'

const root = resolve(import.meta.dirname, '../..')
const chrome = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
if (!existsSync(chrome)) throw new Error('A Chromium executable is required. Set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH.')

const base = { width: 1920, height: 1080, quality: 'high', timeSec: 1.25, pattern: 'opening-night', noAudio: false, params: {}, query: {} }
const motion = { 'marquee-camera-motion': 0 }
const sets = {
  one: [{ name: '01-hero-production', ...base }],
  floor: [0.5, 1.25, 2.6, 3.1, 4.4].map(t => ({ name: `floor-${t}`, ...base, timeSec: t })),
  refl: [{ name: 'refl-95', ...base, params: { 'marquee-reflection': 0.95 } }],
  hero: [
    { name: '01-hero-production', ...base },
    { name: '01b-hero-neutral-lighting-emission-off', ...base, query: { marqueeEmission: 'off', marqueeLighting: 'neutral' } },
    { name: '02-hero-emission-off', ...base, query: { marqueeEmission: 'off' } },
    { name: '03-hero-emission-on-bloom-off', ...base, params: { 'marquee-bloom': 0 } },
    { name: '04-hero-bloom-on', ...base, params: { 'marquee-bloom': 0.9 } },
  ],
  views: [
    { name: '05-left-three-quarter', ...base, query: { marqueeCamera: 'left' } },
    { name: '06-right-three-quarter', ...base, query: { marqueeCamera: 'right' } },
    { name: '07-low-canopy', ...base, query: { marqueeCamera: 'low' } },
  ],
  modes: [
    { name: '10-wireframe-bloom-off', ...base, params: { 'marquee-bloom': 0 }, query: { marqueeGeometry: 'wireframe' } },
    { name: '11-normals-bloom-off', ...base, params: { 'marquee-bloom': 0 }, query: { marqueeGeometry: 'normals' } },
    { name: '12-canopy-bloom-off-idle', ...base, noAudio: true, timeSec: 0, params: { 'marquee-bloom': 0, 'marquee-canopy-intensity': 1 }, query: { marqueeCamera: 'low' } },
  ],
  text: [
    { name: '08-three-different-strings', ...base, timeSec: 0.5, params: { 'marquee-front-text': 'FRONT 123!', 'marquee-left-text': 'LEFT ONLY?', 'marquee-right-text': 'RIGHT: 9 PM' } },
    { name: '08b-only-left-changed', ...base, timeSec: 0.5, params: { 'marquee-front-text': 'FRONT 123!', 'marquee-left-text': 'CHANGED', 'marquee-right-text': 'RIGHT: 9 PM' } },
    { name: '08c-long-front', ...base, timeSec: 0.5, params: { 'marquee-front-text': 'A VERY LONG SPECIAL PREMIERE PRESENTATION' } },
  ],
  audio: [
    { name: '09a-audio-canopy-cascade', ...base, timeSec: 1.25, pattern: 'canopy-cascade' },
    { name: '09b-audio-premiere-burst', ...base, timeSec: 3.1, pattern: 'premiere-burst' },
  ],
}
const requested = process.argv[2] ?? 'hero'
const selected = requested === 'all' ? Object.values(sets).flat() : sets[requested]
if (!selected) throw new Error(`Unknown capture set "${requested}".`)
const output = resolve(root, process.argv[3] ?? `artifacts/marquee-v2/${requested}`)
await mkdir(output, { recursive: true })

const server = await createServer({ root, server: { host: '127.0.0.1', port: 0, strictPort: false }, clearScreen: false })
let browser
try {
  await server.listen()
  const address = server.httpServer?.address()
  const baseUrl = `http://127.0.0.1:${address.port}/src/test/browser/cinema2-marquee-production.html`
  browser = await chromium.launch({ headless: true, executablePath: chrome })
  const results = []
  for (const entry of selected) {
    const page = await browser.newPage({ viewport: { width: entry.width, height: entry.height }, deviceScaleFactor: 1 })
    const pageErrors = []
    page.on('pageerror', error => pageErrors.push(error.message))
    page.on('response', response => { if (response.status() >= 400) pageErrors.push(`HTTP ${response.status()} ${response.url()}`) })
    page.on('console', message => { if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) pageErrors.push(message.text()) })
    try {
      const url = new URL(baseUrl)
      url.searchParams.set('quality', entry.quality)
      url.searchParams.set('timeSec', String(entry.timeSec))
      if (entry.noAudio) url.searchParams.set('marqueeNoAudio', '1')
      for (const [key, value] of Object.entries(entry.query)) url.searchParams.set(key, value)
      url.searchParams.set('params', JSON.stringify({ 'marquee-pattern': entry.pattern, 'marquee-auto-performance': false, ...motion, ...entry.params }))
      await page.goto(url.href, { waitUntil: 'domcontentloaded' })
      await page.waitForFunction(() => Boolean(globalThis.__marqueeProduction), undefined, { timeout: 30_000 })
      const status = await page.evaluate(() => globalThis.__marqueeProduction?.prepare())
      const diagnostics = status.modules.modules.flatMap(module => module.diagnostics.map(item => `${item.code}: ${item.message}`))
      await page.locator('#marquee-production').screenshot({ path: join(output, `${entry.name}.png`), timeout: 120_000 })
      results.push({ name: entry.name, diagnostics, pageErrors, perf: status.performance?.cpuFrameTimeAverageMs })
      console.log(entry.name, diagnostics.length ? JSON.stringify(diagnostics) : 'ok', pageErrors.length ? `PAGE ERRORS ${pageErrors.slice(0, 2).join(' | ')}` : '')
    } finally {
      await page.close()
    }
  }
  await writeFile(join(output, 'captures.json'), `${JSON.stringify(results, null, 2)}\n`)
  console.log(`captures: ${relative(root, output)}`)
} finally {
  await browser?.close()
  await server.close()
}

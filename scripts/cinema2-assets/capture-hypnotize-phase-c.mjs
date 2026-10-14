#!/usr/bin/env node
import { existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'

const root = resolve(import.meta.dirname, '../..')
const output = join(root, 'artifacts/cinema2-hypnotize-phase-c')
const chrome = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
if (!existsSync(chrome)) throw new Error('A Chromium executable is required. Set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH.')

const manual = Object.freeze({ 'hypnotize-auto-performance': false, 'hypnotize-pattern-change': false, 'hypnotize-motion-safety': 'full' })
const cases = Object.freeze([
  Object.freeze({ name: 'pattern-mesmeric-orbit', timeSec: 3.2, energy: 0.68, bass: 0.74, params: { ...manual, 'hypnotize-look': 'mesmericOrbit' } }),
  Object.freeze({ name: 'pattern-black-iris', timeSec: 3.2, energy: 0.68, bass: 0.74, params: { ...manual, 'hypnotize-look': 'blackIris' } }),
  Object.freeze({ name: 'pattern-turbine-bloom', timeSec: 3.2, energy: 0.68, bass: 0.74, params: { ...manual, 'hypnotize-look': 'turbineBloom' } }),
  Object.freeze({ name: 'pattern-chromatic-relay', timeSec: 3.2, energy: 0.68, bass: 0.74, params: { ...manual, 'hypnotize-look': 'chromaticRelay' } }),
  Object.freeze({ name: 'pattern-infinite-draw', timeSec: 3.2, energy: 0.68, bass: 0.74, params: { ...manual, 'hypnotize-look': 'infiniteDraw' } }),
  Object.freeze({ name: 'pattern-radiant-collapse', timeSec: 3.2, energy: 0.68, bass: 0.74, params: { ...manual, 'hypnotize-look': 'radiantCollapse', 'hypnotize-drop-strength': 1 } }),
  Object.freeze({ name: 'reactivity-quiet', timeSec: 2.4, energy: 0.04, bass: 0.05, params: { ...manual, 'hypnotize-look': 'mesmericOrbit' } }),
  Object.freeze({ name: 'reactivity-groove', timeSec: 2.4, energy: 0.92, bass: 0.98, params: { ...manual, 'hypnotize-look': 'mesmericOrbit' } }),
])

function assertHealthy(status, name) {
  if (status?.snapshot?.phase !== 'running' || status?.snapshot?.frameCount < 1) throw new Error(`${name}: runtime did not present a frame.`)
  if (status?.modules?.failedModuleCount !== 0 || status?.modules?.degradedModuleCount !== 0) throw new Error(`${name}: Hypnotize module reported a failure or diagnostic.`)
  if (status?.effects?.failedEffectCount !== 0) throw new Error(`${name}: a post effect failed.`)
}

await mkdir(output, { recursive: true })
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0, strictPort: false }, clearScreen: false })
let browser
try {
  await server.listen()
  const address = server.httpServer?.address()
  if (!address || typeof address === 'string') throw new Error('Vite did not expose a local Hypnotize capture port.')
  const baseUrl = `http://127.0.0.1:${address.port}/src/test/browser/cinema2-hypnotize-production.html`
  browser = await chromium.launch({ headless: true, executablePath: chrome })
  const captures = []
  for (const entry of cases) {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    try {
      const url = new URL(baseUrl)
      url.searchParams.set('quality', 'high')
      url.searchParams.set('timeSec', String(entry.timeSec))
      url.searchParams.set('energy', String(entry.energy))
      url.searchParams.set('bass', String(entry.bass))
      url.searchParams.set('params', JSON.stringify(entry.params))
      await page.goto(url.href, { waitUntil: 'domcontentloaded' })
      await page.waitForFunction(() => Boolean(globalThis.__hypnotizeProduction), undefined, { timeout: 30_000 })
      const status = await page.evaluate(() => globalThis.__hypnotizeProduction?.prepare())
      if (errors.length) throw new Error(errors.join('\n'))
      assertHealthy(status, entry.name)
      const bytes = await page.locator('#hypnotize-production').screenshot({ path: join(output, `${entry.name}.png`), timeout: 120_000 })
      captures.push({ name: entry.name, hash: createHash('sha256').update(bytes).digest('hex') })
      console.log(`${entry.name}: ${status.performance.resolvedQuality}, ${status.modules.estimatedGpuBytes} estimated GPU bytes`)
    } finally {
      await page.close()
    }
  }
  const patternCaptures = captures.filter(entry => entry.name.startsWith('pattern-'))
  if (new Set(patternCaptures.map(entry => entry.hash)).size !== 6) throw new Error('Hypnotize Phase C produced duplicate pattern frames.')
  const quiet = captures.find(entry => entry.name === 'reactivity-quiet')
  const groove = captures.find(entry => entry.name === 'reactivity-groove')
  if (!quiet || !groove || quiet.hash === groove.hash) throw new Error('Hypnotize quiet and groove fixtures did not produce distinct frames.')
  console.log(`Hypnotize Phase C captures: ${output}`)
} finally {
  await browser?.close()
  await server.close()
}

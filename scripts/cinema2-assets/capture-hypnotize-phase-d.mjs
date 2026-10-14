#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'

const root = resolve(import.meta.dirname, '../..')
const output = join(root, 'artifacts/cinema2-hypnotize-phase-d')
const chrome = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
if (!existsSync(chrome)) throw new Error('A Chromium executable is required. Set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH.')

const manual = Object.freeze({ 'hypnotize-auto-performance': false, 'hypnotize-pattern-change': false, 'hypnotize-motion-safety': 'full' })
const patternCase = (name, pattern) => Object.freeze({ name: `pattern-${name}`, scenario: 'steady', timeSec: 3.2, energy: 0.68, bass: 0.74, params: { ...manual, 'hypnotize-look': pattern } })
const cases = Object.freeze([
  Object.freeze({ name: 'state-idle', scenario: 'idle', timeSec: 0, energy: 0, bass: 0, params: { ...manual, 'hypnotize-motion-safety': 'lockoff', 'hypnotize-look': 'mesmericOrbit' } }),
  Object.freeze({ name: 'state-low-energy', scenario: 'steady', timeSec: 2.4, energy: 0.14, bass: 0.18, params: { ...manual, 'hypnotize-look': 'mesmericOrbit' } }),
  Object.freeze({ name: 'state-steady-beat', scenario: 'steady', timeSec: 2.4, energy: 0.58, bass: 0.66, params: { ...manual, 'hypnotize-look': 'mesmericOrbit' } }),
  Object.freeze({ name: 'state-high-energy', scenario: 'steady', timeSec: 2.4, energy: 0.94, bass: 0.98, params: { ...manual, 'hypnotize-look': 'turbineBloom' } }),
  Object.freeze({ name: 'state-vocal', scenario: 'vocal', timeSec: 2.4, energy: 0.56, bass: 0.48, params: { ...manual, 'hypnotize-look': 'blackIris' } }),
  Object.freeze({ name: 'state-build', scenario: 'build', timeSec: 4.2, energy: 0.8, bass: 0.76, params: { ...manual, 'hypnotize-look': 'infiniteDraw' } }),
  Object.freeze({ name: 'state-drop', scenario: 'drop', timeSec: 3.2, energy: 1, bass: 1, params: { ...manual, 'hypnotize-look': 'radiantCollapse', 'hypnotize-drop-strength': 1, 'hypnotize-flash-accents': 'full' } }),
  patternCase('mesmeric-orbit', 'mesmericOrbit'),
  patternCase('black-iris', 'blackIris'),
  patternCase('turbine-bloom', 'turbineBloom'),
  patternCase('chromatic-relay', 'chromaticRelay'),
  patternCase('infinite-draw', 'infiniteDraw'),
  patternCase('radiant-collapse', 'radiantCollapse'),
  Object.freeze({ name: 'camera-frontal', scenario: 'steady', timeSec: 2.8, energy: 0.62, bass: 0.68, params: { ...manual, 'hypnotize-motion-safety': 'lockoff', 'hypnotize-variation': 0.5 } }),
  Object.freeze({ name: 'camera-three-quarter', scenario: 'steady', timeSec: 2.8, energy: 0.62, bass: 0.68, params: { ...manual, 'hypnotize-motion-safety': 'lockoff', 'hypnotize-variation': 1 } }),
  Object.freeze({ name: 'palette-alternative', scenario: 'steady', timeSec: 2.8, energy: 0.7, bass: 0.66, params: { ...manual, 'hypnotize-secondary': [1, 0.05, 0.38, 1], 'hypnotize-accent': [0.08, 1, 0.46, 1], 'hypnotize-highlight': [1, 0.78, 0.18, 1], 'hypnotize-spectrum': [0.12, 0.42, 1, 1] } }),
  Object.freeze({ name: 'design-minimum', scenario: 'steady', timeSec: 2.8, energy: 0.64, bass: 0.64, params: { ...manual, 'hypnotize-node-density': 0.2, 'hypnotize-depth': 0.55, 'hypnotize-node-scale': 0.45, 'hypnotize-collapse': 0.55 } }),
  Object.freeze({ name: 'design-maximum', scenario: 'steady', timeSec: 2.8, energy: 0.64, bass: 0.64, params: { ...manual, 'hypnotize-node-density': 1, 'hypnotize-depth': 2.4, 'hypnotize-node-scale': 1.5, 'hypnotize-collapse': 1.45 } }),
  Object.freeze({ name: 'aspect-square', scenario: 'steady', timeSec: 2.8, energy: 0.66, bass: 0.7, width: 1080, height: 1080, params: { ...manual } }),
  Object.freeze({ name: 'aspect-portrait', scenario: 'steady', timeSec: 2.8, energy: 0.66, bass: 0.7, width: 900, height: 1200, params: { ...manual } }),
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
    const page = await browser.newPage({ viewport: { width: entry.width ?? 1920, height: entry.height ?? 1080 }, deviceScaleFactor: 1 })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    try {
      const url = new URL(baseUrl)
      url.searchParams.set('quality', 'high')
      url.searchParams.set('scenario', entry.scenario)
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
  if (new Set(patternCaptures.map(entry => entry.hash)).size !== 6) throw new Error('Hypnotize Phase D produced duplicate pattern frames.')
  const musicalStates = captures.filter(entry => entry.name.startsWith('state-'))
  if (new Set(musicalStates.map(entry => entry.hash)).size !== musicalStates.length) throw new Error('Hypnotize Phase D produced duplicate musical-state frames.')
  console.log(`Hypnotize Phase D captures: ${output}`)
} finally {
  await browser?.close()
  await server.close()
}

#!/usr/bin/env node
import { existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'

const root = resolve(import.meta.dirname, '../..')
const output = join(root, 'artifacts/cinema2-sixfold-phase-c')
const chrome = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
if (!existsSync(chrome)) throw new Error('A Chromium executable is required. Set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH.')

const performanceParams = Object.freeze({ 'sixfold-auto-performance': false, 'sixfold-pattern-change': false })
const cases = Object.freeze([
  Object.freeze({ name: 'frontal-hero', width: 1920, height: 1080, quality: 'high', timeSec: 1.65, params: { ...performanceParams, 'sixfold-look': 'facetRelay' } }),
  Object.freeze({ name: 'three-quarter-reveal', width: 1920, height: 1080, quality: 'high', timeSec: 2.35, params: { ...performanceParams, 'sixfold-look': 'hexBloom', 'sixfold-variation': 1 } }),
  Object.freeze({ name: 'recursive-depth', width: 1920, height: 1080, quality: 'high', timeSec: 3.15, params: { ...performanceParams, 'sixfold-look': 'spiralDescent', 'sixfold-variation': 0.76, 'sixfold-depth': 1.72 } }),
  Object.freeze({ name: 'owner-stage-default-lighting', width: 2048, height: 1041, quality: 'high', timeSec: 1.65, params: { ...performanceParams, 'sixfold-look': 'facetRelay' } }),
  Object.freeze({ name: 'pattern-phase-cascade', width: 1920, height: 1080, quality: 'high', timeSec: 1.65, params: { ...performanceParams, 'sixfold-look': 'facetRelay' } }),
  Object.freeze({ name: 'pattern-harmonic-expansion', width: 1920, height: 1080, quality: 'high', timeSec: 2.35, params: { ...performanceParams, 'sixfold-look': 'hexBloom' } }),
  Object.freeze({ name: 'pattern-recursive-descent', width: 1920, height: 1080, quality: 'high', timeSec: 3.15, params: { ...performanceParams, 'sixfold-look': 'spiralDescent' } }),
  Object.freeze({ name: 'pattern-mirror-fold', width: 1920, height: 1080, quality: 'high', timeSec: 2.75, params: { ...performanceParams, 'sixfold-look': 'splitPrism' } }),
  Object.freeze({ name: 'pattern-lockstep', width: 1920, height: 1080, quality: 'high', timeSec: 3.55, params: { ...performanceParams, 'sixfold-look': 'chamberPulse' } }),
  Object.freeze({ name: 'pattern-singularity', width: 1920, height: 1080, quality: 'high', timeSec: 2.05, params: { ...performanceParams, 'sixfold-look': 'coreImplosion' } }),
  Object.freeze({ name: 'medium-quality', width: 1920, height: 1080, quality: 'medium', timeSec: 1.65, params: { ...performanceParams, 'sixfold-look': 'facetRelay' } }),
  Object.freeze({ name: 'low-quality', width: 1920, height: 1080, quality: 'low', timeSec: 1.65, params: { ...performanceParams, 'sixfold-look': 'facetRelay' } }),
])
const requestedNames = new Set(process.argv.slice(2))
const selectedCases = requestedNames.size > 0 ? cases.filter(entry => requestedNames.has(entry.name)) : cases
if (selectedCases.length === 0) throw new Error(`No Sixfold capture case matched: ${[...requestedNames].join(', ')}`)

function assertHealthy(status, name) {
  if (status?.snapshot?.phase !== 'running' || status?.snapshot?.frameCount < 1) throw new Error(`${name}: runtime did not present a frame.`)
  if (status?.modules?.failedModuleCount !== 0 || status?.modules?.degradedModuleCount !== 0) throw new Error(`${name}: Sixfold module reported a failure or diagnostic.`)
  if (status?.effects?.failedEffectCount !== 0) throw new Error(`${name}: a post effect failed.`)
}

await mkdir(output, { recursive: true })
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0, strictPort: false }, clearScreen: false })
let browser
try {
  await server.listen()
  const address = server.httpServer?.address()
  if (!address || typeof address === 'string') throw new Error('Vite did not expose a local Sixfold capture port.')
  const baseUrl = `http://127.0.0.1:${address.port}/src/test/browser/cinema2-sixfold-production.html`
  browser = await chromium.launch({ headless: true, executablePath: chrome })
  const captures = []
  for (const entry of selectedCases) {
    const page = await browser.newPage({ viewport: { width: entry.width, height: entry.height }, deviceScaleFactor: 1 })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    try {
      const url = new URL(baseUrl)
      url.searchParams.set('quality', entry.quality)
      url.searchParams.set('timeSec', String(entry.timeSec))
      url.searchParams.set('params', JSON.stringify(entry.params))
      await page.goto(url.href, { waitUntil: 'domcontentloaded' })
      try {
        await page.waitForFunction(() => Boolean(globalThis.__sixfoldProduction), undefined, { timeout: 30_000 })
      } catch (error) {
        throw new Error(`${error instanceof Error ? error.message : String(error)}${errors.length ? `\n${errors.join('\n')}` : ''}`, { cause: error })
      }
      const status = await page.evaluate(() => globalThis.__sixfoldProduction?.prepare())
      if (errors.length) throw new Error(errors.join('\n'))
      assertHealthy(status, entry.name)
      const bytes = await page.locator('#sixfold-production').screenshot({ path: join(output, `${entry.name}.png`), timeout: 120_000 })
      const hash = createHash('sha256').update(bytes).digest('hex')
      captures.push({ name: entry.name, hash })
      console.log(`${entry.name}: ${status.performance.resolvedQuality}, ${status.modules.estimatedGpuBytes} estimated GPU bytes`)
    } finally {
      await page.close()
    }
  }
  const patternCaptures = captures.filter(entry => entry.name.startsWith('pattern-'))
  if (patternCaptures.length === 6 && new Set(patternCaptures.map(entry => entry.hash)).size !== 6) {
    throw new Error('Sixfold choreography acceptance produced duplicate pattern frames.')
  }
  console.log(`Sixfold Phase C captures: ${output}`)
} finally {
  await browser?.close()
  await server.close()
}

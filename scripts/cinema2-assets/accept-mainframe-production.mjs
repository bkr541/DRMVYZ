#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'

const root = resolve(import.meta.dirname, '../..')
const artifactRoot = join(root, 'artifacts/cinema2-mainframe-acceptance')
const chrome = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
if (!existsSync(chrome)) throw new Error('A Chromium executable is required. Set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH.')

const viewports = Object.freeze([
  Object.freeze({ id: '16x9', width: 1920, height: 1080 }),
  Object.freeze({ id: 'owner-stage', width: 2048, height: 1041 }),
])
const patterns = Object.freeze([
  Object.freeze({ id: 'outward-bus', timeSec: 1.25 }),
  Object.freeze({ id: 'inward-boot', timeSec: 1.25 }),
  Object.freeze({ id: 'bank-alternator', timeSec: 1 }),
  Object.freeze({ id: 'quadrant-relay', timeSec: 1.5 }),
  Object.freeze({ id: 'radar-sweep', timeSec: 1 }),
  Object.freeze({ id: 'system-surge', timeSec: 1.5 }),
])
const visualCases = Object.freeze(viewports.flatMap(viewport => [
  Object.freeze({ ...viewport, name: `${viewport.id}-rest`, quality: 'high', timeSec: 0, pattern: 'outward-bus' }),
  ...patterns.map(pattern => Object.freeze({
    ...viewport,
    name: `${viewport.id}-${pattern.id}`,
    quality: 'high',
    timeSec: pattern.timeSec,
    pattern: pattern.id,
  })),
]))
const tierCases = Object.freeze(['medium', 'low'].map(quality => Object.freeze({
  ...viewports[0], name: `16x9-outward-bus-${quality}`, quality, timeSec: 1.25, pattern: 'outward-bus',
})))
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')

function assertHealthy(status, label) {
  const snapshot = status?.snapshot
  const modules = status?.modules
  const effects = status?.effects
  if (snapshot?.phase !== 'running' || snapshot.frameCount < 1 || snapshot.statusMessage != null) throw new Error(`${label}: runtime did not complete cleanly (${JSON.stringify(snapshot)}).`)
  if (modules?.failedModuleCount !== 0 || modules?.degradedModuleCount !== 0) throw new Error(`${label}: Mainframe module reported a failure or diagnostic.`)
  if (effects?.failedEffectCount !== 0) throw new Error(`${label}: an effect failed.`)
}

await mkdir(artifactRoot, { recursive: true })
const output = await mkdtemp(join(artifactRoot, 'run-'))
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0, strictPort: false }, clearScreen: false })
let browser
try {
  await server.listen()
  const address = server.httpServer?.address()
  if (!address || typeof address === 'string') throw new Error('Vite did not expose a local Mainframe acceptance port.')
  const baseUrl = `http://127.0.0.1:${address.port}/src/test/browser/cinema2-mainframe-production.html`
  browser = await chromium.launch({ headless: true, executablePath: chrome })
  const captures = []

  for (const entry of [...visualCases, ...tierCases]) {
    const page = await browser.newPage({ viewport: { width: entry.width, height: entry.height }, deviceScaleFactor: 1 })
    const pageErrors = []
    page.on('pageerror', error => pageErrors.push(error.message))
    try {
      const url = new URL(baseUrl)
      url.searchParams.set('quality', entry.quality)
      url.searchParams.set('timeSec', String(entry.timeSec))
      url.searchParams.set('params', JSON.stringify({ 'mainframe-pattern': entry.pattern }))
      await page.goto(url.href, { waitUntil: 'domcontentloaded' })
      await page.waitForFunction(() => Boolean(globalThis.__mainframeProduction), undefined, { timeout: 30_000 })
      const status = await page.evaluate(() => globalThis.__mainframeProduction?.prepare())
      if (pageErrors.length) throw new Error(pageErrors.join('\n'))
      assertHealthy(status, entry.name)
      const filename = `${entry.name}.png`
      const bytes = await page.locator('#mainframe-production').screenshot({ path: join(output, filename), timeout: 120_000 })
      captures.push({ ...entry, filename, sha256: sha256(bytes), status })
      console.log(`${entry.name}: ${sha256(bytes).slice(0, 12)}`)
    } finally {
      await page.close()
    }
  }

  const validationPage = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
  await validationPage.goto(`${baseUrl}?quality=high&timeSec=1.25`, { waitUntil: 'domcontentloaded' })
  await validationPage.waitForFunction(() => Boolean(globalThis.__mainframeProduction), undefined, { timeout: 30_000 })
  const prepared = await validationPage.evaluate(() => globalThis.__mainframeProduction?.prepare())
  assertHealthy(prepared, '1080p warmup')
  const profile = await validationPage.evaluate(() => globalThis.__mainframeProduction?.profile(120))
  assertHealthy(profile.runtime, '1080p profile')
  const cpuAverage = profile.runtime.performance.cpuFrameTimeAverageMs
  if (typeof cpuAverage !== 'number' || cpuAverage > 16.7) throw new Error(`1080p high CPU frame time missed 16.7 ms (${String(cpuAverage)} ms).`)
  await validationPage.setViewportSize({ width: 2048, height: 1041 })
  const resized = await validationPage.evaluate(() => globalThis.__mainframeProduction?.resize(globalThis.innerWidth, globalThis.innerHeight))
  assertHealthy(resized, 'owner-stage resize')
  const recovered = await validationPage.evaluate(() => globalThis.__mainframeProduction?.recoverContext())
  assertHealthy(recovered, 'context recovery')
  if (recovered.snapshot.contextGeneration < 2) throw new Error('Context generation did not advance during recovery.')
  await validationPage.close()

  const failurePage = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
  await failurePage.route('**/cinema2/models/mainframe.glb', route => route.fulfill({ status: 404, contentType: 'application/octet-stream', body: '' }))
  await failurePage.goto(`${baseUrl}?quality=high`, { waitUntil: 'domcontentloaded' })
  await failurePage.waitForFunction(() => Boolean(globalThis.__mainframeProduction), undefined, { timeout: 30_000 })
  const failure = await failurePage.evaluate(async () => {
    let rejected = false
    try { await globalThis.__mainframeProduction?.prepare() } catch { rejected = true }
    return { rejected, status: globalThis.__mainframeProduction?.status() }
  })
  await failurePage.close()
  const failureCodes = failure.status.modules.modules.flatMap(module => module.diagnostics.map(diagnostic => diagnostic.code))
  if (!failure.rejected || !failureCodes.includes('CINEMA2_MAINFRAME_ASSET_LOAD_FAILED')) throw new Error('Missing model did not produce the Mainframe asset-failure diagnostic.')

  const manifest = {
    schemaVersion: 1,
    preset: 'drmvyz.cinema2.mainframe',
    acceptance: {
      visualCriteria: ['composition', 'depth', 'logo priority', 'black level', 'emission roll-off', 'metal readability', 'component density'],
      viewports,
      captures,
      profile,
      resize: resized,
      contextRecovery: recovered,
      assetFailure: { rejected: failure.rejected, diagnosticCodes: failureCodes },
    },
  }
  await writeFile(join(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`Mainframe production acceptance: ${relative(root, output)}`)
} finally {
  await browser?.close()
  await server.close()
}

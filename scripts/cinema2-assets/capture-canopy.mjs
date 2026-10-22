#!/usr/bin/env node
/**
 * Captures CANOPY frames from the real production path (Cinema2Runtime, registry, native module, effects, Audio Feature Bus) in headless Chrome.
 *
 *   node scripts/cinema2-assets/capture-canopy.mjs <out-dir> '<json cases>'
 *
 * A case is { name, width?, height?, quality?, timeSec?, scenario?, bpm?, params? } where params maps parameter ids to authored values.
 * Writes <name>.png and <name>.json (the solved rod state and runtime health) for each case.
 */
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'

const root = resolve(import.meta.dirname, '../..')
const [outDirArg, casesArg] = process.argv.slice(2)
if (!outDirArg || !casesArg) throw new Error('Usage: capture-canopy.mjs <out-dir> <json cases>')
const output = resolve(outDirArg)
const cases = JSON.parse(casesArg)
const chrome = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
if (!existsSync(chrome)) throw new Error('A Chromium executable is required. Set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH.')

await mkdir(output, { recursive: true })
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0, strictPort: false }, clearScreen: false, logLevel: 'error' })
let browser
try {
  await server.listen()
  const address = server.httpServer?.address()
  if (!address || typeof address === 'string') throw new Error('Vite did not expose a local port.')
  const baseUrl = `http://127.0.0.1:${address.port}/src/test/browser/cinema2-canopy-production.html`
  browser = await chromium.launch({ headless: true, executablePath: chrome })
  for (const entry of cases) {
    const page = await browser.newPage({ viewport: { width: entry.width ?? 1920, height: entry.height ?? 1080 }, deviceScaleFactor: 1 })
    page.setDefaultTimeout(90_000)
    const errors = []
    console.log(`${entry.name}: loading`)
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) errors.push(message.text()) })
    try {
      const url = new URL(baseUrl)
      url.searchParams.set('quality', entry.quality ?? 'high')
      url.searchParams.set('timeSec', String(entry.timeSec ?? 1))
      url.searchParams.set('scenario', entry.scenario ?? 'none')
      if (entry.bpm) url.searchParams.set('bpm', String(entry.bpm))
      if (entry.dropAt) url.searchParams.set('dropAt', String(entry.dropAt))
      if (entry.params) url.searchParams.set('params', JSON.stringify(entry.params))
      if (entry.cam) url.searchParams.set('cam', entry.cam.join(','))
      // The dev server may re-optimise dependencies on first use and reload the page; load again until the harness survives to be prepared.
      let status
      for (let attempt = 0; ; attempt += 1) {
        try {
          await page.goto(url.href, { waitUntil: 'domcontentloaded' })
          await page.waitForFunction(() => Boolean(globalThis.__canopyProduction), undefined, { timeout: 60_000 })
          console.log(`${entry.name}: harness ready, preparing`)
          status = await page.evaluate(() => globalThis.__canopyProduction?.prepare())
          break
        } catch (error) {
          if (attempt >= 4 || !/context was destroyed|navigation/i.test(String(error))) throw error
          errors.length = 0
        }
      }
      for (const step of entry.steps ?? []) {
        if (step.transport) await page.evaluate(patch => globalThis.__canopyProduction?.setTransport(patch), step.transport)
        if (step.params) await page.evaluate(values => globalThis.__canopyProduction?.setParameters(values), step.params)
        if (step.advanceTo != null) await page.evaluate(time => globalThis.__canopyProduction?.advanceTo(time), step.advanceTo)
        if (step.resize) await page.evaluate(([w, h]) => globalThis.__canopyProduction?.resize(w, h), step.resize)
      }
      const probe = await page.evaluate(() => globalThis.__canopyProduction?.probe())
      const final = await page.evaluate(() => globalThis.__canopyProduction?.status())
      await page.locator('#canopy-production').screenshot({ path: join(output, `${entry.name}.png`), timeout: 120_000 })
      await writeFile(join(output, `${entry.name}.json`), JSON.stringify({ entry, probe, status: { snapshot: final.snapshot, modules: final.modules, effects: final.effects, camera: final.camera, performance: final.performance }, errors }, null, 1))
      const healthy = final.snapshot.phase === 'running' && final.modules.failedModuleCount === 0 && final.effects.failedEffectCount === 0 && errors.length === 0
      console.log(`${entry.name}: ${healthy ? 'ok' : 'UNHEALTHY'} phase=${final.snapshot.phase} frames=${final.snapshot.frameCount} gpu=${final.modules.estimatedGpuBytes} errors=${errors.length}${errors.length ? ` ${errors[0]}` : ''}`)
      void status
    } finally {
      await page.close()
    }
  }
} finally {
  await browser?.close()
  await server.close()
}

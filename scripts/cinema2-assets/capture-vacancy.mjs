#!/usr/bin/env node
/**
 * Captures VACANCY frames from the real production path (Cinema2Runtime, registry, native module, effects) in headless Chrome.
 *
 *   node scripts/cinema2-assets/capture-vacancy.mjs <out-dir> '<json cases>'
 *
 * A case is { name, width?, height?, quality?, timeSec?, cam?, params?, steps? } where params maps parameter ids to authored values.
 * Writes <name>.png and <name>.json (runtime health) for each case.
 */
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'

const root = resolve(import.meta.dirname, '../..')
const [outDirArg, casesArg] = process.argv.slice(2)
if (!outDirArg || !casesArg) throw new Error('Usage: capture-vacancy.mjs <out-dir> <json cases>')
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
  const baseUrl = `http://127.0.0.1:${address.port}/src/test/browser/cinema2-vacancy-production.html`
  browser = await chromium.launch({ headless: true, executablePath: chrome })
  for (const entry of cases) {
    const page = await browser.newPage({ viewport: { width: entry.width ?? 1920, height: entry.height ?? 1080 }, deviceScaleFactor: 1 })
    page.setDefaultTimeout(120_000)
    const errors = []
    console.log(`${entry.name}: loading`)
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) errors.push(message.text()) })
    try {
      const url = new URL(baseUrl)
      url.searchParams.set('quality', entry.quality ?? 'high')
      url.searchParams.set('timeSec', String(entry.timeSec ?? 1))
      if (entry.params) url.searchParams.set('params', JSON.stringify(entry.params))
      if (entry.cam) url.searchParams.set('cam', entry.cam.join(','))
      // The dev server may re-optimise dependencies on first use and reload the page; load again until the harness survives to be prepared.
      for (let attempt = 0; ; attempt += 1) {
        try {
          await page.goto(url.href, { waitUntil: 'domcontentloaded' })
          await page.waitForFunction(() => Boolean(globalThis.__vacancyProduction), undefined, { timeout: 90_000 })
          console.log(`${entry.name}: harness ready, preparing`)
          await page.evaluate(() => globalThis.__vacancyProduction?.prepare())
          break
        } catch (error) {
          if (attempt >= 4 || !/context was destroyed|navigation/i.test(String(error))) throw error
          errors.length = 0
        }
      }
      for (const step of entry.steps ?? []) {
        if (step.params) await page.evaluate(values => globalThis.__vacancyProduction?.setParameters(values), step.params)
        if (step.advanceBy != null) await page.evaluate(seconds => globalThis.__vacancyProduction?.advanceBy(seconds), step.advanceBy)
        if (step.resize) await page.evaluate(([w, h]) => globalThis.__vacancyProduction?.resize(w, h), step.resize)
      }
      const final = await page.evaluate(() => globalThis.__vacancyProduction?.status())
      await page.locator('#vacancy-production').screenshot({ path: join(output, `${entry.name}.png`), timeout: 120_000 })
      await writeFile(join(output, `${entry.name}.json`), JSON.stringify({ entry, status: { snapshot: final.snapshot, modules: final.modules, effects: final.effects, camera: final.camera }, errors }, null, 2))
      const healthy = final.snapshot.phase === 'running' && final.modules.failedModuleCount === 0 && final.effects.failedEffectCount === 0 && errors.length === 0
      console.log(`${entry.name}: ${healthy ? 'ok' : 'UNHEALTHY'} phase=${final.snapshot.phase} frames=${final.snapshot.frameCount} gpu=${final.modules.estimatedGpuBytes} errors=${errors.length}${errors.length ? ` ${errors[0]}` : ''}`)
    } finally {
      await page.close()
    }
  }
} finally {
  await browser?.close()
  await server.close()
}

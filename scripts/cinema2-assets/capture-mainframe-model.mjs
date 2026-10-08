#!/usr/bin/env node
// Captures the Stage 2 generated GLB under neutral lights from the required front and shallow three-quarter review views.
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { createServer } from 'vite'
import { chromium } from '@playwright/test'

const root = resolve(import.meta.dirname, '../..')
const artifactRoot = join(root, 'artifacts/cinema2-mainframe-model')
const chrome = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  ?? ('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
if (!existsSync(chrome)) throw new Error('A Chromium executable is required. Set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH.')

await mkdir(artifactRoot, { recursive: true })
const output = await mkdtemp(join(artifactRoot, 'run-'))
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0, strictPort: false }, clearScreen: false })
let browser
try {
  await server.listen()
  const address = server.httpServer?.address()
  if (!address || typeof address === 'string') throw new Error('Vite did not expose a local port.')
  const baseUrl = `http://127.0.0.1:${address.port}/src/test/browser/cinema2-mainframe-model-review.html`
  browser = await chromium.launch({ headless: true, executablePath: chrome })
  const page = await browser.newPage({ viewport: { width: 1672, height: 941 }, deviceScaleFactor: 1 })
  const results = []
  for (const view of ['front', 'three-quarter']) {
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    const url = new URL(baseUrl)
    url.searchParams.set('view', view)
    await page.goto(url.href, { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => globalThis.__mainframeModelReview?.status().ready === true, undefined, { timeout: 120_000 })
    await page.waitForTimeout(250)
    const status = await page.evaluate(() => globalThis.__mainframeModelReview?.status())
    if (!status || status.error || errors.length) throw new Error(`${view}: ${status?.error ?? errors.join('; ') ?? 'capture failed'}`)
    const filename = `${view}.png`
    await page.locator('#mainframe-model-review').screenshot({ path: join(output, filename) })
    results.push({ view, filename, status })
  }
  await writeFile(join(output, 'manifest.json'), `${JSON.stringify({ schemaVersion: 1, viewport: { width: 1672, height: 941 }, lighting: 'neutral-stage-2-review', results }, null, 2)}\n`)
  console.log(`Mainframe Stage 2 review captures: ${relative(root, output)}`)
} finally {
  await browser?.close()
  await server.close()
}

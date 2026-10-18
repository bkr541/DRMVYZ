#!/usr/bin/env node
// Samples MARQUEE's CPU and GPU frame times in the production path. Usage: node scripts/cinema2-assets/profile-marquee.mjs [quality] [paramsJson]
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'

const root = resolve(import.meta.dirname, '../..')
const chrome = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
if (!existsSync(chrome)) throw new Error('A Chromium executable is required. Set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH.')
const quality = process.argv[2] ?? 'high'
const params = JSON.parse(process.argv[3] ?? '{}')
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0, strictPort: false }, clearScreen: false })
let browser
try {
  await server.listen()
  const port = server.httpServer.address().port
  browser = await chromium.launch({ headless: true, executablePath: chrome })
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
  const url = new URL(`http://127.0.0.1:${port}/src/test/browser/cinema2-marquee-production.html`)
  url.searchParams.set('quality', quality)
  url.searchParams.set('timeSec', '1.25')
  url.searchParams.set('params', JSON.stringify({ 'marquee-camera-motion': 0, ...params }))
  await page.goto(url.href, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => Boolean(globalThis.__marqueeProduction), undefined, { timeout: 30_000 })
  await page.evaluate(() => globalThis.__marqueeProduction.prepare())
  const samples = []
  for (let i = 0; i < 12; i += 1) {
    const result = await page.evaluate(() => globalThis.__marqueeProduction.profile(30))
    samples.push({ cpu: result.runtime.performance.cpuFrameTimeAverageMs, gpu: result.runtime.performance.gpuFrameTimeMs, wall: result.wallFrameTimeAverageMs })
  }
  const mean = key => samples.reduce((sum, s) => sum + (s[key] ?? 0), 0) / samples.length
  console.log(JSON.stringify({ quality, params, cpuMs: +mean('cpu').toFixed(2), gpuMs: +mean('gpu').toFixed(2), wallMs: +mean('wall').toFixed(2) }))
} finally {
  await browser?.close()
  await server.close()
}

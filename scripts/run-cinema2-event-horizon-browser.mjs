/* global window */
// Renders EVENT HORIZON in headless Chromium (software GL) and saves review frames: the galaxy at rest, then each musical moment.
// Usage: node scripts/run-cinema2-event-horizon-browser.mjs [--out <dir>]
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from '@playwright/test'
import sharp from 'sharp'

const outArg = process.argv.indexOf('--out')
const output = path.resolve(outArg > 0 ? process.argv[outArg + 1] : 'artifacts/cinema2-event-horizon')
const port = 48000 + process.pid % 1000
const url = `http://127.0.0.1:${port}/src/test/browser/cinema2-event-horizon.html`
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] })
let serverLog = '', browser
server.stdout.on('data', value => { serverLog += value })
server.stderr.on('data', value => { serverLog += value })
const errors = []

async function stats(page) {
  const { data, info } = await sharp(await page.screenshot()).raw().toBuffer({ resolveWithObject: true })
  let lit = 0, sum = 0
  for (let i = 0; i < data.length; i += info.channels) { const v = Math.max(data[i], data[i + 1], data[i + 2]); sum += v; if (v > 40) lit++ }
  return { litFraction: lit / (info.width * info.height), mean: sum / (data.length / info.channels) }
}

try {
  await mkdir(output, { recursive: true })
  let ready = false
  for (let i = 0; i < 100 && !ready; i++) { try { ready = (await fetch(url)).ok } catch { await new Promise(resolve => setTimeout(resolve, 200)) } }
  assert(ready, serverLog || 'Event Horizon review server did not start')
  browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl'] })
  const page = await browser.newPage({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 })
  page.on('pageerror', error => errors.push(String(error)))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto(url)
  await page.waitForFunction(() => !!window.__eventHorizon).catch(error => { throw new Error(`${error.message}\n${errors.join('\n')}`) })
  const api = (method, ...args) => page.evaluate(({ method, args }) => window.__eventHorizon[method](...args), { method, args })
  const shot = async name => { await page.screenshot({ path: path.join(output, `${name}.png`) }); return stats(page) }

  await api('advance', 1.5)
  const loadedStatus = await api('status')
  assert.equal(loadedStatus.modules.failedModuleCount, 0, JSON.stringify(loadedStatus.modules))
  assert.equal(loadedStatus.render.failedPassCount, 0)
  const rest = await shot('01-rest')
  const results = { rest }
  await api('music', { timeSec: 0, energy: 0.25, bass: 0.2, high: 0.1 })
  await api('advance', 1)
  results.quiet = await shot('02-quiet-music')
  await api('set', { 'auto-performance': true })
  await api('music', { timeSec: 8, energy: 0.8, bass: 0.8, high: 0.5, kick: true })
  await api('advance', 0.25)
  results.kick = await shot('03-kick')
  // The three camera modes: where the camera is, and a frame from each.
  results.cameras = {}
  await api('setStep', 250)
  await api('music', { timeSec: 0 }, false)
  for (const mode of ['orbit', 'flyThrough', 'deepSpace']) {
    await api('set', { 'camera-mode': mode })
    const snapshots = []
    for (let i = 0; i < 3; i++) {
      await api('advance', 8)
      snapshots.push(JSON.stringify((await api('status')).camera))
      await shot(`04-camera-${mode}-${i}`)
    }
    results.cameras[mode] = { snapshots }
  }
  console.log(JSON.stringify({ output, results, modules: (await api('status')).modules, errors }, null, 2))
} finally {
  await browser?.close()
  server.kill()
}
assert.deepEqual(errors, [])

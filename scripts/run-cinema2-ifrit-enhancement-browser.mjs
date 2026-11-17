/* global window */
// Captures and measures the Ifrit Radial Mechanics and Shatter & Reconstruction states in the real production canvas.
//   node scripts/run-cinema2-ifrit-enhancement-browser.mjs                      captures every state at 16:9, 1:1 and 9:16
//   node scripts/run-cinema2-ifrit-enhancement-browser.mjs --original --out DIR  (on a tree without the enhancement) captures the original baselines
//   node scripts/run-cinema2-ifrit-enhancement-browser.mjs --compare DIR         also compares the both-off baselines with those original captures
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from '@playwright/test'
import sharp from 'sharp'

const arg = name => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : null }
const original = process.argv.includes('--original')
const output = path.resolve(arg('--out') ?? 'artifacts/cinema2-ifrit/enhancement')
const compareDir = arg('--compare') ? path.resolve(arg('--compare')) : null
const port = 49000 + process.pid % 1000
const url = `http://127.0.0.1:${port}/src/test/browser/cinema2-ifrit-production.html`
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] })
let serverLog = '', browser
server.stdout.on('data', value => { serverLog += value })
server.stderr.on('data', value => { serverLog += value })
const errors = [], report = { viewports: {}, errors }
const VIEWPORTS = [{ name: '16x9', width: 1280, height: 720 }, { name: '1x1', width: 800, height: 800 }, { name: '9x16', width: 540, height: 960 }]

function measure(data, width, height, channels) {
  let orange = 0, red = 0, centerLit = 0, centerPixels = 0
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * channels
    const r = data[i], g = data[i + 1], b = data[i + 2]
    if (r > 90 && g > 20 && r > g * 1.5 && b < 30) orange++
    if (r > 12 && r > g * 4 && g < 20 && b < 15) red++
    if (Math.hypot(x - width / 2, y - height / 2) < Math.min(width, height) * 0.055) { centerPixels++; if (Math.max(r, g, b) > 10) centerLit++ }
  }
  return { orange: orange / (width * height), red: red / (width * height), centerLit: centerLit / centerPixels }
}
const diff = (a, b) => { assert.equal(a.length, b.length); let sum = 0; for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]); return sum / a.length }

try {
  await mkdir(output, { recursive: true })
  let ready = false
  for (let attempt = 0; attempt < 200; attempt++) {
    if (server.exitCode != null) throw new Error(serverLog)
    try { if ((await fetch(url)).ok) { ready = true; break } } catch { /* startup */ }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert(ready, serverLog || 'Ifrit review server did not start')
  browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl'] })
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
  page.on('pageerror', error => errors.push(String(error)))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto(url)
  await page.waitForFunction(() => !!window.__ifritProduction).catch(error => { throw new Error(`${error.message}\nBrowser errors: ${errors.join('\n')}`) })
  const api = (method, ...args) => page.evaluate(({ method, args }) => window.__ifritProduction[method](...args), { method, args })

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    const shots = {}, metrics = {}
    const capture = async name => {
      const png = await page.screenshot()
      await writeFile(path.join(output, `${original ? 'original-' : ''}${viewport.name}-${name}.png`), png)
      const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true })
      shots[name] = data
      metrics[name] = measure(data, info.width, info.height, info.channels)
    }
    const state = async (values, music = { timeSec: 0, energy: 0.65, bass: 0.6, high: 0.3 }) => {
      await api('reset')
      await api('set', { travel: 0.6, rotation: 0.15, reactivity: 0.65, ...values })
      await api('music', music)
      await api('advance', 0.5, { paused: true })
    }
    const off = original ? {} : { 'mechanics-enabled': false, 'shatter-enabled': false }
    await state(off); await capture('baseline-both-off')
    if (!original) {
      await state({}); await capture('default')
      await state({ 'shatter-enabled': false }); await capture('mechanics-only')
      await state({ 'mechanics-enabled': false, 'shatter-trigger': 'manual', 'shatter-hold': 1, 'shatter-strength': 1 }); await capture('shatter-max')
      await state({ 'mechanics-enabled': false, 'shatter-trigger': 'manual', 'shatter-hold': 0.45 }); await capture('mid-shatter')
      await state({ 'mechanics-enabled': false, 'shatter-trigger': 'manual', 'shatter-hold': 0 }); await capture('reconstruction')
      await state({ 'shatter-trigger': 'manual', 'shatter-hold': 1, 'shatter-strength': 1 }); await capture('both-shatter-max')
      // A real drop through shared Choreography: burst, scatter, rebuild.
      // The same drop twice with the passage held still (travel and rotation 0): once with shatter on, once off, so the only difference is the shatter.
      const channels = {}
      for (const [prefix, shatter] of [['drop-off', false], ['drop', true]]) {
        await state({ 'mechanics-enabled': false, 'shatter-enabled': shatter, 'shatter-trigger': 'drop', 'shatter-strength': 1, travel: 0, rotation: 0 })
        await api('music', { timeSec: 0.5, energy: 0.9, bass: 0.8, high: 0.4, event: 'drop', eventId: 9001 })
        for (const [index, seconds] of [[0, 0.05], [1, 0.25], [2, 0.5], [3, 1.6]]) {
          const status = await api('advance', seconds)
          if (shatter) channels[`drop-${index}`] = { burst: status.channels.shatterBurst, recall: status.channels.shatterRecall }
          await capture(`${prefix}-${index}`)
        }
      }
      report.viewports[viewport.name] = { drop: channels }
    }
    report.viewports[viewport.name] = { ...(report.viewports[viewport.name] ?? {}), metrics }

    if (original) continue
    const base = shots['baseline-both-off']
    const changes = Object.fromEntries(Object.keys(shots).map(name => [name, diff(base, shots[name])]))
    report.viewports[viewport.name].changeFromBaseline = changes
    // Verification of what is visible.
    assert(changes.default > 0.4, `${viewport.name}: default must clearly show the new geometry (change ${changes.default})`)
    assert(changes['mechanics-only'] > 0.4, `${viewport.name}: mechanics must be visible (change ${changes['mechanics-only']})`)
    assert(changes['shatter-max'] > 0.2, `${viewport.name}: shatter must be visible (change ${changes['shatter-max']})`)
    assert(changes['mid-shatter'] > 0.05 && diff(shots['mid-shatter'], shots['shatter-max']) > 0.1, `${viewport.name}: mid-shatter must be a distinct intermediate state`)
    assert(changes.reconstruction < 0.02, `${viewport.name}: reconstruction must return exactly to the baseline (change ${changes.reconstruction})`)
    const drop = index => diff(shots[`drop-off-${index}`], shots[`drop-${index}`])
    report.viewports[viewport.name].dropChange = Object.fromEntries([0, 1, 2, 3].map(i => [`drop-${i}`, drop(i)]))
    assert(Math.max(drop(0), drop(1), drop(2)) > 0.1, `${viewport.name}: a real drop must visibly scatter the edges (${JSON.stringify(report.viewports[viewport.name].dropChange)})`)
    assert(drop(3) < 0.1, `${viewport.name}: a real drop must rebuild the edges (${drop(3)})`)
    for (const name of Object.keys(metrics)) {
      assert(metrics[name].centerLit < 0.05, `${viewport.name}/${name}: the dark central opening must stay open (${metrics[name].centerLit})`)
      assert(metrics[name].orange > 0.003 && metrics[name].orange < 0.35, `${viewport.name}/${name}: orange geometry out of range (${metrics[name].orange})`)
    }
    if (compareDir) {
      const head = await sharp(await readFile(path.join(compareDir, `original-${viewport.name}-baseline-both-off.png`))).raw().toBuffer()
      const original_ = diff(head, base)
      report.viewports[viewport.name].baselineVsOriginal = original_
      assert(original_ < 0.05, `${viewport.name}: both toggles off must reproduce the original render (mean difference ${original_})`)
    }
  }
  assert.deepEqual(errors, [])
  await api('dispose')
  await writeFile(path.join(output, original ? 'original-report.json' : 'report.json'), JSON.stringify(report, null, 2))
  console.log(`Ifrit enhancement captures ${original ? '(original baselines) ' : ''}written to ${output}`)
  console.log(JSON.stringify(report.viewports, null, 1).slice(0, 4000))
} finally {
  await browser?.close()
  server.kill()
}

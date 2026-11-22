/* global window */
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'
import sharp from 'sharp'

// Production-path check for Inertia's extra elements, animated core and camera (real runtime, software WebGL): each element control changes the rendered canvas
// and can be taken to zero, the core animates, the camera moves in Sway and Orbit and holds still in Locked, and nothing fails in the render graph. Needs a Vite
// server for the project root (PLAYWRIGHT_BASE_URL, default http://127.0.0.1:5174). Time only moves when a check advances it, so comparisons are deterministic.
const output = process.env.INERTIA_ELEMENTS_OUTPUT ?? 'artifacts/cinema2-inertia-elements'
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] })
const report = { measurements: [], errors: [], passed: [] }
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  page.on('pageerror', e => report.errors.push(e.message))
  await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5174'}/src/test/browser/cinema2-inertia-production.html?quality=high&elements`)
  await page.waitForFunction(() => window.__inertiaProduction, {}, { timeout: 60000 })
  const api = async (method, ...args) => {
    const s = await page.evaluate(([m, a]) => window.__inertiaProduction[m](...a), [method, args])
    assert.equal(s.snapshot.phase, 'running'); assert.equal(s.modules.failedModuleCount, 0, JSON.stringify(s.modules)); assert.equal(s.effects.failedEffectCount, 0)
    return s
  }
  const pixels = async name => { await page.waitForTimeout(350); const png = await page.locator('canvas').screenshot(); if (name) await writeFile(`${output}/${name}.png`, png); return sharp(png).removeAlpha().raw().toBuffer() }
  const difference = (a, b) => { let sum = 0; for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]); return sum / a.length }
  const lit = buffer => { let on = 0; for (let i = 0; i < buffer.length; i += 3) if (buffer[i] + buffer[i + 1] + buffer[i + 2] > 60) on++; return on / (buffer.length / 3) }
  const status = await api('prepare')
  const authored = status.authored.persistentValues ?? status.authored
  assert.equal(status.camera.rig, 'path', 'the default camera sways')
  await pixels('default')

  // Each element control, at its default and at zero, changes the picture (time is standing still while it is set), and zero gives the original sculpture back.
  const defaults = { 'core-motion': .7, 'inner-shell': .7, 'orbit-rings': .8, 'outer-dial': .6, dust: .6 }
  for (const [name, value] of Object.entries(defaults)) {
    await api('set', { [name]: value }); const on = await pixels()
    await api('set', { [name]: 0 }); const off = await pixels(`off-${name}`)
    const d = difference(on, off); report.measurements.push({ control: name, difference: d })
    assert(d > .004, `${name} visibly changes the render (${d})`)
    await api('set', { [name]: value })
  }
  await api('set', Object.fromEntries(Object.keys(defaults).map(name => [name, 0])))
  const bare = await pixels('bare'), withAll = await (async () => { await api('set', defaults); return pixels('all') })()
  assert(lit(withAll) > lit(bare) * 1.05, `the extra elements add visible points (${lit(bare)} -> ${lit(withAll)})`)
  report.measurements.push({ lit: { bare: lit(bare), all: lit(withAll) } })
  report.passed.push('every element control changes the render and can be taken to zero; together they add visible points')

  // The core animates with the clock: with only Core Motion on and the pattern still, the picture changes over time but not with the core stilled.
  await api('set', { 'orbit-rings': 0, 'outer-dial': 0, dust: 0, 'inner-shell': 0, 'motion-amount': 0, 'camera-mode': 'locked', 'core-motion': .7 })
  const before = await pixels(); await api('advanceBy', 1.5); const after = await pixels('core-later')
  assert(difference(before, after) > .002, `the core animates over time (${difference(before, after)})`)
  await api('set', { 'core-motion': 0 }); const still = await pixels(); await api('advanceBy', 1.5); const stillLater = await pixels()
  assert(difference(still, stillLater) < difference(before, after) / 3, 'with Core Motion 0 the core holds still')
  report.passed.push('the core animates over time and holds still at Core Motion 0')

  // The camera: Sway and Orbit move it, Locked holds the original front view.
  await api('set', { 'core-motion': 0, 'camera-mode': 'sway' })
  const swayA = (await api('status')).camera.position; await api('advanceBy', 4); const swayB = (await api('status')).camera.position
  assert(Math.hypot(...swayA.map((v, i) => v - swayB[i])) > .3, `Sway moves the camera (${swayA} -> ${swayB})`)
  await api('set', { 'camera-mode': 'orbit' }); const orbitA = (await api('status')).camera.position; await api('advanceBy', 4); const orbitB = (await api('status')).camera.position
  assert(Math.hypot(...orbitA.map((v, i) => v - orbitB[i])) > .3, 'Orbit moves the camera')
  await api('set', { 'camera-mode': 'locked' }); await api('advanceBy', 1); const lockedA = (await api('status')).camera.position; await api('advanceBy', 4); const lockedB = (await api('status')).camera.position
  assert(Math.hypot(...lockedA.map((v, i) => v - lockedB[i])) < 1e-6, 'Locked holds the camera still')
  assert(Math.abs(lockedB[0]) < 1e-6 && Math.abs(lockedB[1]) < 1e-6 && Math.abs(lockedB[2] - 4) < 1e-6, `Locked is the original front view (${lockedB})`)
  report.passed.push('Sway and Orbit move the camera; Locked holds the original front view')

  // Everything on, playing, through the sway path: nothing fails.
  await api('set', { ...defaults, 'camera-mode': 'sway', 'motion-amount': authored['inertia-motion-amount'] ?? .65 }); await api('setTransport', { present: true, bpm: 120 })
  for (let i = 0; i < 5; i++) await api('advanceBy', 5)
  await pixels('playing')
  report.passed.push('the sculpture plays through the sway path with no failed pass or module')
  assert.deepEqual(report.errors, [], 'no page errors')
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 1)); await browser.close()
  console.log(JSON.stringify(report, null, 1))
}

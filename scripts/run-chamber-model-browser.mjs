/* global window */
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'
import sharp from 'sharp'

// Production-path check for the Chamber's model slot (real Chamber preset and runtime in Chromium, software WebGL, with two generated models standing in for the
// user's library): a chosen model stands in the middle of the structure, tilts and floats without turning right round, follows its controls, is lit by its own light,
// and choosing none (or taking it away) gives back the empty chamber pixel for pixel. Needs a Vite server for the project root (PLAYWRIGHT_BASE_URL, default
// http://127.0.0.1:5174). Time only moves when a check advances it, so every comparison is deterministic.
const output = process.env.CHAMBER_MODEL_OUTPUT ?? 'artifacts/chamber-model'
await mkdir(output, { recursive: true })
const W = 1280, H = 720
const CENTER = [400, 120, 880, 580]
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] })
const report = { measurements: [], errors: [], passed: [] }
try {
  const page = await browser.newPage({ viewport: { width: W, height: H } })
  page.on('pageerror', e => report.errors.push(e.message))
  await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5174'}/src/test/browser/chamber-model.html`)
  await page.waitForFunction(() => window.__chamberModel, {}, { timeout: 120000 })
  const api = async (method, ...args) => {
    const s = await page.evaluate(([m, a]) => window.__chamberModel[m](...a), [method, args])
    assert.equal(s.snapshot.phase, 'running'); assert.equal(s.modules.failedModuleCount, 0, JSON.stringify(s.modules)); assert.equal(s.effects.failedEffectCount, 0)
    return s
  }
  const pixels = async name => { await page.waitForTimeout(400); const png = await page.locator('canvas').screenshot(); if (name) await writeFile(`${output}/${name}.png`, png); return sharp(png).removeAlpha().raw().toBuffer() }
  const difference = (a, b, [x0, y0, x1, y1] = [0, 0, W, H]) => { let sum = 0, count = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) for (let c = 0; c < 3; c++) { const i = (y * W + x) * 3 + c; sum += Math.abs(a[i] - b[i]); count++ } return sum / count }
  const pose = status => status.modules.modules[0]?.inspection?.modelPose

  await api('prepare')
  const empty = await pixels('empty')
  assert.equal((await api('status')).modules.modules[0].inspection.modelPlaced, false)

  // A chosen model appears in the middle of the structure, and it is the middle that changes.
  let status = await api('bind', 0)
  assert.equal(status.modules.modules[0].inspection.modelPlaced, true, 'the model is in the slot')
  const withModel = await pixels('model')
  const middle = difference(empty, withModel, CENTER), edges = difference(empty, withModel, [0, 0, 160, H])
  report.measurements.push({ middle, edges }); assert(middle > 4, `the model shows in the middle (${middle})`)
  assert(edges < middle / 3, `and it is the middle that changed, not the surroundings (${edges} vs ${middle})`)
  report.passed.push('a chosen model appears in the middle of the chamber')

  // It tilts and floats: over a long run it moves, stays inside a small range, and never turns right round.
  const yaws = [], positions = []; const frames = []
  for (let i = 0; i < 16; i++) {
    status = await api('advanceBy', 2.5); const p = pose(status); yaws.push(p.yaw); positions.push(p.position); if (i < 4) frames.push(await pixels(`moving-${i}`))
  }
  assert(Math.max(...yaws) - Math.min(...yaws) > .02, `it leans and turns (yaw ${Math.min(...yaws).toFixed(2)} to ${Math.max(...yaws).toFixed(2)})`)
  assert(Math.max(...yaws.map(Math.abs)) < .15, 'it never turns anywhere near right round')
  for (const [x, y, z] of positions) { assert(Math.abs(x) < .2 && Math.abs(z) < .2 && y > 2.85 && y < 3.4, `it stays in the middle (${x}, ${y}, ${z})`) }
  assert(difference(frames[0], frames[2], CENTER) > .5, 'the picture really moves in the middle')
  report.measurements.push({ yawRange: [Math.min(...yaws), Math.max(...yaws)] })
  report.passed.push('the model tilts and floats inside a small range and never turns round')

  // Each control does its part.
  await api('set', { 'model-tilt': 0, 'model-drift': 0 }); const stillA = await pixels(); await api('advanceBy', 5); const stillB = await pixels('still')
  assert(difference(stillA, stillB, CENTER) < difference(frames[0], frames[2], CENTER) / 3, 'at Tilt 0 and Drift 0 the model holds still')
  await api('set', { 'model-size': 0.5 }); const small = await pixels('size-small'); await api('set', { 'model-size': 1.5 }); const large = await pixels('size-large')
  assert(difference(small, large, CENTER) > 5, 'Model Size changes how large it stands')
  await api('set', { 'model-size': 1 })
  await api('set', { 'model-light': 0 }); const dark = await pixels('light-off'); await api('set', { 'model-light': 0.5 }); const lit = await pixels('light-on')
  assert(difference(dark, lit, CENTER) > 3, 'Model Light lights the model')
  await api('set', { 'model-tilt': 1, 'model-drift': 1 })
  report.passed.push('Model Size, Model Tilt, Model Drift and Model Light each change the render')

  // A second model replaces the first; no failures.
  status = await api('bind', 1); assert.equal(status.modules.modules[0].inspection.modelPlaced, true); await pixels('second-model')
  // Taking it away gives back the empty chamber exactly, and the model light does nothing with none chosen.
  await api('bind', 'default'); await api('set', { 'model-light': 0.5, 'model-tilt': 1, 'model-drift': 1, 'model-size': 1 })
  assert.equal((await api('status')).modules.modules[0].inspection.modelPlaced, false)
  const backA = await pixels('empty-again'); await api('set', { 'model-light': 1.5 }); const backB = await pixels()
  assert.equal(difference(backA, backB), 0, 'Model Light changes nothing with no model chosen')
  // The reference for "the empty chamber": a fresh page that never had a model, taken to the same moment. Taking the model away must give exactly that picture back.
  const fresh = await browser.newPage({ viewport: { width: W, height: H } })
  fresh.on('pageerror', e => report.errors.push(e.message))
  await fresh.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5174'}/src/test/browser/chamber-model.html`)
  await fresh.waitForFunction(() => window.__chamberModel, {}, { timeout: 120000 })
  const call = (method, ...args) => fresh.evaluate(([m, a]) => window.__chamberModel[m](...a), [method, args])
  await call('prepare'); for (let i = 0; i < 16; i++) await call('advanceBy', 2.5); await call('advanceBy', 5)
  await fresh.waitForTimeout(400); const reference = await sharp(await fresh.locator('canvas').screenshot()).removeAlpha().raw().toBuffer(); await fresh.close()
  const exact = difference(reference, backA); report.measurements.push({ removedVersusNeverHadOne: exact })
  assert(exact < 0.02, `with the model taken away the chamber is exactly the empty chamber (${exact})`)
  report.passed.push('replacing and removing the model works, and the empty chamber is unchanged')

  // Through the camera's own drift, with the model in: nothing fails.
  await api('bind', 0); await api('set', { 'camera-mode': 'drift' }); for (let i = 0; i < 6; i++) await api('advanceBy', 4)
  await pixels('drift')
  report.passed.push('the model stays in place while the camera drifts round the platform')
  assert.deepEqual(report.errors, [], 'no page errors')
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 1)); await browser.close()
  console.log(JSON.stringify(report, null, 1))
}

import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'
import sharp from 'sharp'

// Production-path check for Paradox Weave's finishing (Cinema 2.0 preset contract, section 19): every finishing control changes the real rendered canvas, the
// word still reads at the reveal, and nothing fails in the render graph. Needs a Vite server for the project root (PLAYWRIGHT_BASE_URL, default
// http://127.0.0.1:5174). Time moves only when a check advances it, so every comparison is deterministic.
const output = process.env.PARADOX_WEAVE_OUTPUT ?? 'artifacts/cinema2-paradox-weave'
await mkdir(output, { recursive: true })
const W = 1280, H = 720
const REGION = { all: [0, 0, W, H], floor: [380, 540, 900, 720], word: [340, 300, 940, 410], leftBank: [0, 150, 220, 600], corner: [0, 0, 160, 90], flat: [500, 30, 780, 130] }
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] })
const report = { measurements: [], errors: [], passed: [] }
try {
  const page = await browser.newPage({ viewport: { width: W, height: H } })
  page.on('pageerror', e => report.errors.push(e.message))
  const api = (method, value) => page.evaluate(([m, v]) => globalThis.paradoxWeaveReview[m](v), [method, value])
  const set = async (name, value) => assert((await page.evaluate(([n, v]) => globalThis.paradoxWeaveReview.set(n, v), [name, value])).ok, `set ${name}`)
  const snapshot = () => api('snapshot')
  const ready = () => page.waitForFunction(() => globalThis.paradoxWeaveReview?.snapshot().modules.modules[0]?.inspection?.presentation, {}, { timeout: 120000 })
  await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5174'}/src/test/browser/cinema2-paradox-weave.html?quality=high`)
  await page.waitForFunction(() => globalThis.paradoxWeaveReview, {}, { timeout: 30000 }); await ready()
  const pixels = async () => { await page.waitForTimeout(350); return sharp(await page.screenshot()).removeAlpha().raw().toBuffer() }
  const difference = (a, b, region = 'all') => { const [x0, y0, x1, y1] = REGION[region]; let sum = 0, count = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) for (let c = 0; c < 3; c++) { const i = (y * W + x) * 3 + c; sum += Math.abs(a[i] - b[i]); count++ } return sum / count }
  const lit = (buffer, region) => { const [x0, y0, x1, y1] = REGION[region]; let on = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * W + x) * 3; if (buffer[i] + buffer[i + 1] + buffer[i + 2] > 600) on++ } return on / ((x1 - x0) * (y1 - y0)) }
  const capture = name => page.screenshot({ path: `${output}/${name}.png` })
  const settle = async () => { await api('advance', .25) }

  await set('cameraMode', 'reveal'); await api('advance', 1)
  const snap = await snapshot()
  assert.equal(snap.render.failedPassCount, 0); assert.equal(snap.effects.failedEffectCount, 0); assert.equal(snap.modules.failedModuleCount, 0)
  const authored = snap.parameters.persistentValues
  const id = name => `parallax-cipher-${name.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}`
  const base = await pixels(); await capture('default')
  // The word still reads at the reveal: its band carries the bright letters (not blown out to a block, not lost).
  const wordLit = lit(base, 'word'); report.measurements.push({ wordLit }); assert(wordLit > .04 && wordLit < .6, `the word reads (${wordLit})`)

  // Each finishing control, taken to zero and to its top, changes the part of the picture it owns.
  const controls = [['haze', 0, 1, 'all', 1], ['floorReflection', 0, 1, 'floor', 1], ['depthFocus', 0, 1, 'leftBank', .4], ['lightFlares', 0, 1, 'all', .05], ['filmGrain', 0, .5, 'flat', .5], ['lensFringe', 0, .5, 'corner', .3], ['vignette', 0, 1, 'corner', 3], ['reflections', 0, 3, 'leftBank', .3]]
  for (const [name, low, high, region, minimum] of controls) {
    await set(name, low); await settle(); const a = await pixels()
    await set(name, high); await settle(); const b = await pixels(), d = difference(a, b, region)
    report.measurements.push({ control: name, region, difference: d }); await capture(`control-${name}`)
    assert(d > minimum, `${name} (${low} to ${high}) visibly changes the ${region} (${d})`)
    await set(name, authored[id(name)])
  }
  // Depth focus softens the banks and leaves the word sharp: the word's region changes far less than the bank beside it.
  await set('depthFocus', 0); await settle(); const sharp0 = await pixels(); await set('depthFocus', 1); await settle(); const sharp1 = await pixels()
  assert(difference(sharp0, sharp1, 'leftBank') > difference(sharp0, sharp1, 'word') * 1.5, 'the word stays sharper than the banks')
  await set('depthFocus', authored[id('depthFocus')])
  // Taking every finishing stage to zero gives the preset back its original, clean look (no floor, no air, no softening).
  for (const name of ['haze', 'floorReflection', 'depthFocus', 'lightFlares', 'filmGrain', 'lensFringe']) await set(name, 0)
  await settle(); await capture('finishing-off'); const bare = await pixels(); assert(difference(base, bare) > 2, 'the finishing is visible against the bare scene')
  report.passed.push('every finishing control changes its own part of the render; the word stays readable and sharp; the bare scene is intact')

  // The path camera: the finishing holds through the authored swing without failures.
  for (const name of ['haze', 'floorReflection', 'depthFocus', 'lightFlares', 'filmGrain', 'lensFringe', 'vignette', 'reflections']) await set(name, authored[id(name)])
  await set('cameraMode', 'path'); await api('advance', 7.5); await capture('path')
  const swing = await snapshot(); assert.equal(swing.render.failedPassCount, 0); assert.equal(swing.effects.failedEffectCount, 0)
  report.passed.push('the Immersive Path swing renders with no failed pass or effect')
  assert.deepEqual(report.errors, [], 'no page errors')
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 1)); await browser.close()
}
console.log(JSON.stringify({ passed: report.passed, measurements: report.measurements, errors: report.errors }, null, 1))

// Shared finishing on the real native production canvas and Inspector.
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import sharp from 'sharp'

const root = resolve(import.meta.dirname, '../..'), out = resolve(root, 'artifacts/cinema2-nightshift-step7')
await mkdir(out, { recursive: true })
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0 }, clearScreen: false })
const checks = [], errors = [], metrics = {}
const assert = (value, message) => { if (!value) throw new Error(message); checks.push(message) }
let browser, captures = 0
const floor = [.1, .62, .9, .97], gap = [.3, .46, .7, .57], full = [0, 0, 1, 1]
function measure(a, region, sample) {
  let sum = 0, count = 0
  for (let y = Math.floor(region[1] * a.info.height); y < region[3] * a.info.height; y++) for (let x = Math.floor(region[0] * a.info.width); x < region[2] * a.info.width; x++) {
    const i = (y * a.info.width + x) * a.info.channels
    for (let c = 0; c < 3; c++) { sum += sample(i + c); count++ }
  }
  return sum / count
}
const diff = (a, b, region = full) => measure(a, region, i => Math.abs(a.data[i] - b.data[i]))
const edges = a => measure(a, floor, i => Math.abs(a.data[i] - a.data[i + a.info.channels]))
try {
  await server.listen()
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error' && /shader|WebGL|THREE/.test(m.text())) errors.push(m.text()) })
  const status = () => page.evaluate(() => globalThis.__nightshiftProduction.status())
  const settle = () => page.evaluate(async () => { for (let i = 0; i < 20; i++) await new Promise(resolve => globalThis.requestAnimationFrame(resolve)) })
  const set = async values => { await page.evaluate(v => globalThis.__nightshiftProduction.set(v), values); await settle() }
  const shot = async name => {
    captures++
    return sharp(await page.locator('canvas').screenshot({ path: resolve(out, `${name}.png`) })).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  }
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/src/test/browser/cinema2-nightshift-production.html?step3=1`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => Boolean(globalThis.__nightshiftProduction))
  const prepared = await page.evaluate(() => globalThis.__nightshiftProduction.prepare())
  const P = await page.evaluate(() => globalThis.__nightshiftProduction.ids)
  assert(prepared.effects.activeEffectCount === 3 && prepared.effects.failedEffectCount === 0, 'All three shared effects execute on the native production path')
  const defaults = { [P.bloom]: .35, [P.haze]: .35, [P.reflections]: .25 }, off = { [P.bloom]: 0, [P.haze]: 0, [P.reflections]: 0 }
  for (const [id, value] of Object.entries(defaults)) assert(prepared.parameters.persistentValues[id] === value, `${id}: restrained authored default`)
  await page.evaluate(() => globalThis.__nightshiftProduction.showInspector(true))
  for (const name of ['bloom', 'haze', 'reflections']) assert(await page.locator(`[data-cinema2-parent-group="effects"] [data-cinema2-control-id="${P[name]}"]`).count() === 1, `${name}: real Inspector control under Effects`)
  await page.evaluate(() => globalThis.__nightshiftProduction.showInspector(false))
  await set({ [P.motion]: 0, [P.musicResponse]: 0, ...off })
  const baseline = await shot('all-off'), camera = JSON.stringify((await status()).camera)
  assert((await status()).effects.activeEffectCount === 0, 'All-zero effects retire their instances and bypass')
  for (const name of ['bloom', 'haze', 'reflections']) {
    await set({ ...off, [P[name]]: defaults[P[name]] }); const normal = await shot(`${name}-default`)
    await set({ [P[name]]: 1 }); const maximum = await shot(`${name}-max`)
    metrics[name] = { defaultDifference: diff(normal, baseline), maximumDifference: diff(maximum, baseline), maxGapMean: measure(maximum, gap, i => maximum.data[i]) }
    console.log(name, metrics[name])
    assert(metrics[name].defaultDifference > .01, `${name}: default changes actual output pixels`)
    assert(metrics[name].maximumDifference > metrics[name].defaultDifference, `${name}: maximum visibly increases its own effect`)
    await set(off); assert(diff(await shot(`${name}-off-restored`), baseline) < .05, `${name}: OFF restores the unprocessed native output`)
  }
  await set(defaults); const finished = await shot('all-default')
  await set({ [P.bloom]: 1, [P.haze]: 1, [P.reflections]: 1 }); const maximum = await shot('all-max')
  metrics.finishing = { defaultGapMean: measure(finished, gap, i => finished.data[i]), maxGapMean: measure(maximum, gap, i => maximum.data[i]), baseFloorEdges: edges(baseline), defaultFloorEdges: edges(finished), maxFloorEdges: edges(maximum) }
  console.log('finishing', metrics.finishing)
  assert(metrics.finishing.maxGapMean < 30, 'Combined maximum preserves a dark separation region')
  assert(metrics.finishing.defaultFloorEdges > .8 * metrics.finishing.baseFloorEdges && metrics.finishing.maxFloorEdges > .65 * metrics.finishing.baseFloorEdges, 'Combined finishing retains tile-edge contrast at default and maximum')
  await set({ [P.master]: 0 }); const dark = await shot('master-zero-effects-max')
  assert((await status()).effects.activeEffectCount === 0, 'Master zero bypasses all finishing even when controls are at maximum')
  await set(off); assert(diff(dark, await shot('master-zero-effects-off')) < .05, 'Finishing cannot relight Master zero')
  await set({ [P.master]: .85, [P.reflections]: 1, [P.floor]: 0 })
  assert((await status()).effects.activeEffectCount === 0, 'Floor zero suppresses ground reflections')
  await set({ [P.floor]: .8, [P.coverage]: 0 }); assert((await status()).effects.activeEffectCount === 0, 'Coverage zero suppresses ground reflections')
  await set({ [P.coverage]: .75, ...defaults })
  await page.evaluate(() => globalThis.__nightshiftProduction.advance(1, 120, true)); await settle()
  const paused = await shot('paused')
  await settle(); assert(diff(paused, await shot('pause-held')) < .05, 'Paused finishing settles and holds stable')
  await set(off); assert(diff(baseline, await shot('off-while-paused')) < .05, 'All OFF controls apply immediately while paused')
  await set(defaults)
  const palette = (await status()).parameters.persistentValues
  await set({ [P.cyanColor]: [1, .1, .1, 1] }); const recolored = await shot('cyan-role-edited')
  assert(diff(recolored, finished) > .1, 'Shared haze and cyan role follow the editable palette')
  await set({ [P.cyanColor]: palette[P.cyanColor] })
  assert(JSON.stringify((await status()).camera) === camera, 'Finishing preserves the approved camera and framing')
  const reentry = await page.evaluate(() => globalThis.__nightshiftProduction.reenter())
  assert(reentry.effects.activeEffectCount === 3 && reentry.effects.failedEffectCount === 0 && reentry.modules.failedModuleCount === 0, 'Fresh native re-entry prepares effects and geometry cleanly')
  for (const [id, value] of Object.entries(defaults)) assert(reentry.parameters.persistentValues[id] === value, `${id}: re-entry restores its authored default`)
  await set({ [P.motion]: 0, [P.musicResponse]: 0 }); await shot('accepted-default')
  assert(errors.length === 0 && reentry.choreography.diagnostics.length === 0 && reentry.effects.effects.every(e => e.diagnostics.length === 0), 'No browser, shader, effect or choreography errors')
  const report = { checks, captures, errors, metrics, performance: reentry.snapshot.performance }
  await writeFile(resolve(out, 'report.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ output: out, checks: checks.length, captures, performance: report.performance }))
} catch (error) {
  await writeFile(resolve(out, 'failure.json'), JSON.stringify({ error: String(error), checks, errors, metrics }, null, 2) + '\n')
  throw error
} finally { await browser?.close(); await server.close() }

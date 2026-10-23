import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import sharp from 'sharp'

const root = resolve(import.meta.dirname, '../..'), out = resolve(root, 'artifacts/cinema2-nightshift-fog')
await mkdir(out, { recursive: true })
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0 }, clearScreen: false })
const checks = [], errors = [], metrics = {}
const assert = (ok, message) => { if (!ok) throw new Error(message); checks.push(message) }
const regions = { floor: [.1, .63, .9, .93], aboveFloor: [.15, .4, .85, .62], ceiling: [.1, 0, .9, .2] }
function difference(a, b, region) {
  let sum = 0, n = 0
  for (let y = Math.floor(region[1] * a.info.height); y < region[3] * a.info.height; y++) for (let x = Math.floor(region[0] * a.info.width); x < region[2] * a.info.width; x++) {
    const i = (y * a.info.width + x) * a.info.channels
    for (let c = 0; c < 3; c++) { sum += Math.abs(a.data[i + c] - b.data[i + c]); n++ }
  }
  return sum / n
}
let browser
try {
  await server.listen()
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
  const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 })
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error' && /shader|WebGL|THREE/.test(m.text())) errors.push(m.text()) })
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/src/test/browser/cinema2-nightshift-production.html?step3=1`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => Boolean(globalThis.__nightshiftProduction))
  await page.evaluate(() => globalThis.__nightshiftProduction.prepare())
  const P = await page.evaluate(() => globalThis.__nightshiftProduction.ids)
  const settle = () => page.evaluate(async () => { for (let i = 0; i < 20; i++) await new Promise(resolve => globalThis.requestAnimationFrame(resolve)) })
  const set = async values => { await page.evaluate(v => globalThis.__nightshiftProduction.set(v), values); await settle() }
  const advance = async (seconds, paused = false) => { await page.evaluate(v => globalThis.__nightshiftProduction.advance(...v), [seconds, 120, paused]); await settle() }
  const shot = async name => sharp(await page.locator('canvas').screenshot({ path: resolve(out, `${name}.png`) })).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  await set({ [P.motion]: 0, [P.rotation]: false, [P.camera]: 0, [P.musicResponse]: 0, [P.bloom]: 0, [P.reflections]: 0, [P.haze]: 1 })
  await advance(3) // Allow the shipped smoke volume to load and fade in.
  await set({ [P.haze]: 0 }); const off = await shot('off')
  await set({ [P.haze]: .35 }); const normal = await shot('default')
  await set({ [P.haze]: .7 }); const raised = await shot('raised')
  await set({ [P.haze]: 1 }); const dense = await shot('dense')
  for (const [name, region] of Object.entries(regions)) metrics[name] = {
    default: difference(normal, off, region), raised: difference(raised, off, region), dense: difference(dense, off, region),
  }
  for (const name of ['floor', 'aboveFloor']) {
    assert(metrics[name].default > 2, `Default fog is clearly visible ${name}`)
    assert(metrics[name].dense > metrics[name].raised && metrics[name].raised > metrics[name].default, `Slider progressively increases fog ${name}`)
  }
  assert(metrics.aboveFloor.dense > metrics.ceiling.dense * 2, 'Dense fog stays concentrated around the dance floor')
  await advance(3); const moving = await shot('drifted')
  metrics.drift = difference(dense, moving, regions.aboveFloor)
  assert(metrics.drift > .5, 'Billows visibly drift above the floor')
  await advance(0, true); const paused = await shot('paused')
  await advance(1, true); const held = await shot('paused-held')
  assert(difference(paused, held, regions.aboveFloor) < .1, 'Paused fog holds still')
  await set({ [P.haze]: 0 }); const restored = await shot('off-restored')
  assert(difference(off, restored, regions.aboveFloor) < .05 && difference(off, restored, regions.floor) < .05, 'Zero clears fog even while paused')
  await set({ [P.master]: 0, [P.haze]: 1 })
  const state = await page.evaluate(() => globalThis.__nightshiftProduction.status())
  assert(state.effects.activeEffectCount === 0, 'Master zero suppresses fog')
  assert(state.modules.failedModuleCount === 0 && state.effects.failedEffectCount === 0 && state.render.failedPassCount === 0 && state.frameFaults.length === 0 && errors.length === 0, 'No browser, shader or render failures')
  await writeFile(resolve(out, 'report.json'), JSON.stringify({ checks, errors, metrics }, null, 2))
  console.log(JSON.stringify({ checks, metrics }, null, 2))
} catch (error) {
  await writeFile(resolve(out, 'failure.json'), JSON.stringify({ message: String(error), checks, errors, metrics }, null, 2))
  throw error
} finally { await browser?.close(); await server.close() }

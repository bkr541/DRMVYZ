import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import sharp from 'sharp'

const root = resolve(import.meta.dirname, '../..'), out = resolve(root, 'artifacts/cinema2-nightshift-signs')
await mkdir(out, { recursive: true })
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0 }, clearScreen: false })
const checks = [], errors = [], metrics = {}
const assert = (ok, message) => { if (!ok) throw new Error(message); checks.push(message) }
function diff(a, b, region = [.2, .34, .8, .55]) {
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
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
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
  await set({ [P.camera]: 0, [P.motion]: 0, [P.rotation]: false, [P.haze]: 0, [P.bloom]: 0, [P.reflections]: 0 })
  const off = await shot('sign-off')
  await page.evaluate(() => globalThis.__nightshiftProduction.showInspector(true))
  const control = name => page.locator(`[data-cinema2-control-id="${P[name]}"]`)
  assert(await control('signText').count() === 0, 'Sign Text is hidden while signs are OFF')
  await control('signs').getByRole('switch').click(); await settle()
  const input = control('signText').getByRole('textbox')
  assert(await input.inputValue() === 'NIGHTSHIFT' && await input.isEnabled(), 'Enabling signs reveals an editable NIGHTSHIFT text input below the toggle')
  assert(await page.locator(`[data-cinema2-parent-group="palette"] [data-cinema2-control-id="${P.signColor}"]`).count() === 1, 'Sign Color appears in the Palette UI')
  const sizeSlider = control('signSize').getByRole('slider')
  assert(await sizeSlider.count() === 1, 'Sign Size slider appears below Sign Text')
  await sizeSlider.press('End'); await settle()
  assert((await page.evaluate(() => globalThis.__nightshiftProduction.status())).parameters.persistentValues[P.signSize] === 2, 'Sign Size slider updates the actual parameter')
  await set({ [P.signSize]: 1 })
  await page.evaluate(() => globalThis.__nightshiftProduction.showInspector(false)); await settle()
  const on = await shot('sign-white')
  metrics.enabledDifference = diff(off, on)
  assert(metrics.enabledDifference > 2, 'Freestanding 3D neon sign visibly appears')
  await set({ [P.signSize]: .5 }); const small = await shot('sign-small')
  await set({ [P.signSize]: 1.5 }); const large = await shot('sign-large')
  metrics.sizeDifference = diff(small, large)
  assert(metrics.sizeDifference > 1, 'Sign Size visibly grows and shrinks the 3D lettering')
  await set({ [P.signSize]: 1 })
  await set({ [P.signColor]: [1, .08, .2, 1] }); const red = await shot('sign-red')
  await set({ [P.signColor]: [.08, .3, 1, 1] }); const blue = await shot('sign-blue')
  metrics.paletteDifference = diff(red, blue)
  assert(metrics.paletteDifference > 1, 'Palette changes the actual neon tube pixels')
  assert(diff(off, on, [.25, .49, .75, .55]) < .05, 'Enabling the sign adds no wall or backdrop')
  await set({ [P.pattern]: 'diagonal-relay', [P.motion]: .35 })
  await advance(1); const moving = await shot('choreography-a')
  await advance(.5); const moved = await shot('choreography-b')
  metrics.choreography = diff(moving, moved)
  assert(metrics.choreography > .3, 'Selected spatial choreography travels across the neon geometry')
  await set({ [P.motion]: 0 })
  const neutral = await shot('audio-neutral')
  const time = (await page.evaluate(() => globalThis.__nightshiftProduction.status())).transport.timeSec
  await page.evaluate(t => globalThis.__nightshiftProduction.music({ timeSec: t + .01, event: 'snare', eventId: 9000 }), time); await settle()
  metrics.audioAccent = diff(neutral, await shot('audio-snare'))
  assert(metrics.audioAccent > .1, 'Shared audio intelligence accents the sign without moving physical tubes')
  await set({ [P.signs]: false })
  assert(diff(off, await shot('sign-off-restored'), [.2, .37, .8, .55]) < .05, 'OFF removes the freestanding sign')
  await set({ [P.signs]: true, [P.signSize]: 1.2, [P.signColor]: [1, .08, .4, 1], [P.haze]: .35, [P.bloom]: .35, [P.reflections]: .25 })
  await advance(1); await shot('sign-with-club-finish')
  await page.evaluate(() => globalThis.__nightshiftProduction.reenter({ preserve: true })); await settle()
  const state = await page.evaluate(() => globalThis.__nightshiftProduction.status())
  assert(state.parameters.persistentValues[P.signs] === true && Math.abs(state.parameters.persistentValues[P.signSize] - 1.2) < 1e-6, 'Enable Signs and Sign Size survive native preset re-entry')
  assert(state.modules.failedModuleCount === 0 && state.effects.failedEffectCount === 0 && state.render.failedPassCount === 0 && state.frameFaults.length === 0 && errors.length === 0, 'No browser, shader or render failures')
  await writeFile(resolve(out, 'report.json'), JSON.stringify({ checks, errors, metrics }, null, 2))
  console.log(JSON.stringify({ checks, metrics }, null, 2))
} catch (error) {
  await writeFile(resolve(out, 'failure.json'), JSON.stringify({ message: String(error), checks, errors, metrics }, null, 2))
  throw error
} finally { await browser?.close(); await server.close() }

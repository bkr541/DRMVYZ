// Focused regression for sustained floor/ceiling choreography and brighter output.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import sharp from 'sharp'

const root = resolve(import.meta.dirname, '../..'), out = resolve(root, 'artifacts/cinema2-nightshift-reactivity-fix')
await mkdir(out, { recursive: true })
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0 }, clearScreen: false })
const checks = [], errors = [], metrics = {}
const resumeAudio = process.argv.includes('--from=audio')
if (resumeAudio) {
  const checkpoint = JSON.parse(await readFile(resolve(out, 'failure.json'), 'utf8'))
  if (checkpoint.errors.length || !checkpoint.checks.includes('Pause holds floor and ceiling choreography')) throw new Error('No valid sustained-motion checkpoint')
  checks.push(...checkpoint.checks); Object.assign(metrics, checkpoint.metrics)
}
const assert = (value, message) => { if (!value) throw new Error(message); checks.push(message) }
const regions = { floor: [.1, .62, .9, .94], ceiling: [.15, 0, .85, .3] }
function measure(a, region, sample) {
  let sum = 0, n = 0
  for (let y = Math.floor(region[1] * a.info.height); y < region[3] * a.info.height; y++) for (let x = Math.floor(region[0] * a.info.width); x < region[2] * a.info.width; x++) {
    sum += sample((y * a.info.width + x) * a.info.channels); n++
  }
  return sum / n
}
const diff = (a, b, region) => measure(a, region, i => (Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2])) / 3)
let browser
try {
  await server.listen()
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
  const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 })
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error' && /shader|WebGL|THREE/.test(message.text())) errors.push(message.text()) })
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/src/test/browser/cinema2-nightshift-production.html?step3=1`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => Boolean(globalThis.__nightshiftProduction))
  await page.evaluate(() => globalThis.__nightshiftProduction.prepare())
  const P = await page.evaluate(() => globalThis.__nightshiftProduction.ids)
  const set = values => page.evaluate(v => globalThis.__nightshiftProduction.set(v), values)
  const advance = (seconds, paused = false) => page.evaluate(v => globalThis.__nightshiftProduction.advance(v.seconds, 120, v.paused), { seconds, paused })
  const music = options => page.evaluate(v => globalThis.__nightshiftProduction.music(v), options)
  const shot = async name => {
    const bytes = await page.locator('canvas').screenshot({ path: resolve(out, `${name}.png`) })
    return sharp(bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  }
  if (!resumeAudio) {
    const startCamera = (await advance(0)).camera.position
    const camera = (await advance(5)).camera.position
    metrics.cameraTravel = Math.hypot(...camera.map((v, i) => v - startCamera[i]))
    assert(metrics.cameraTravel > .001, 'Default camera visibly travels without enabling a control')
    await set({ [P.camera]: 0, [P.pattern]: 'runway', [P.bloom]: 0, [P.haze]: 0, [P.reflections]: 0 })
    // The fixture deliberately holds the beat grid: this previously slowed/stalled motion.
    await music({ energy: .7, bass: .6, high: .7 })
    await advance(60)
    const late = await shot('late-60s')
    await advance(.5)
    const later = await shot('late-60.5s')
    for (const [name, region] of Object.entries(regions)) {
      metrics[`${name}LateMotion`] = diff(late, later, region)
      assert(metrics[`${name}LateMotion`] > .3, `${name} choreography still moves after 60 seconds with held beat-grid data`)
    }
    await advance(.5, true)
    const paused = await shot('paused')
    await advance(2, true)
    const held = await shot('paused-held')
    assert(diff(paused, held, regions.floor) < .05 && diff(paused, held, regions.ceiling) < .05, 'Pause holds floor and ceiling choreography')
  }
  await advance(0)
  await set({ [P.camera]: 0, [P.motion]: 0, [P.pattern]: 'runway', [P.bloom]: 0, [P.haze]: 0, [P.reflections]: 0 })
  await music({ energy: .7 })
  const neutral = await shot('audio-neutral')
  const time = (await page.evaluate(() => globalThis.__nightshiftProduction.status())).transport.timeSec
  await music({ timeSec: time + .01, energy: .7, event: 'snare', eventId: 999 })
  const accented = await shot('audio-accent')
  metrics.ceilingAudioAccent = diff(neutral, accented, regions.ceiling)
  assert(metrics.ceilingAudioAccent > .1, 'Fresh audio accent changes the ceiling LEDs')
  await set({ [P.motion]: 0, [P.musicResponse]: 0, [P.pattern]: 'full-house', [P.floor]: .8 / 3 })
  const oldGain = await shot('floor-previous-gain')
  await set({ [P.floor]: .8 })
  const brighter = await shot('floor-3x-gain')
  const brightness = image => measure(image, regions.floor, i => .2126 * image.data[i] + .7152 * image.data[i + 1] + .0722 * image.data[i + 2])
  metrics.floorBrightnessRatio = brightness(brighter) / brightness(oldGain)
  assert(metrics.floorBrightnessRatio > 1.3, 'Tripled linear floor gain visibly raises rendered brightness')
  const state = await page.evaluate(() => globalThis.__nightshiftProduction.status())
  assert(state.modules.failedModuleCount === 0 && state.effects.failedEffectCount === 0 && state.render.failedPassCount === 0 && state.frameFaults.length === 0, 'Production module, effects and render graph remain healthy')
  assert(errors.length === 0, 'No browser or shader errors')
  await writeFile(resolve(out, 'report.json'), JSON.stringify({ checks, errors, metrics }, null, 2))
  console.log(JSON.stringify({ checks, metrics }, null, 2))
} catch (error) {
  await writeFile(resolve(out, 'failure.json'), JSON.stringify({ message: String(error), checks, errors, metrics }, null, 2))
  throw error
} finally { await browser?.close(); await server.close() }

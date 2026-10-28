// Render Threshold LED brightness, HDR bloom and gentle forward flight.
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import sharp from 'sharp'
const root = resolve(import.meta.dirname, '../..'), out = resolve(root, 'artifacts/cinema2-threshold-loop')
await mkdir(out, { recursive: true })
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0 }, clearScreen: false,
  plugins: [{ name: 'threshold-loop-harness', configureServer(server) {
    server.middlewares.use('/__threshold-loop', (_req, res) => {
      res.setHeader('Content-Type', 'text/html')
      res.end('<html><body style="margin:0;background:black"><canvas id="stage" width="640" height="360"></canvas></body></html>')
    })
  } }],
})
const errors = [], samples = [], metrics = {}
let browser
try {
  await server.listen()
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } })
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error' && /shader|WebGL/.test(m.text())) errors.push(m.text()) })
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__threshold-loop`)
  await page.evaluate(async () => {
    const { Cinema2Runtime } = await import('/src/components/vyzualz/cinema2/runtime/Cinema2Runtime.ts')
    const { CINEMA2_THRESHOLD_PRESET_ID, CINEMA2_THRESHOLD_PANEL_BRIGHTNESS_ID, CINEMA2_THRESHOLD_BLOOM_ID, CINEMA2_THRESHOLD_INTENSITY_ID } = await import('/src/components/vyzualz/cinema2/presets/Cinema2ThresholdPreset.ts')
    let pending, time = 0
    const created = Cinema2Runtime.create(globalThis.document.querySelector('canvas'), {
      presetId: CINEMA2_THRESHOLD_PRESET_ID, renderQuality: 'high', diagnosticsEnabled: true,
      requestAnimationFrame: cb => { pending = cb; return 1 }, cancelAnimationFrame: () => {},
      transportSource: { getState: () => ({ sourcePresent: true, playing: true, analysisActive: true, paused: false, animationActive: true, trackId: 'seam-check', timeSec: time / 1000, bpm: 120, bpmSync: true }) },
    })
    if (!created.runtime) throw new Error(created.error)
    const runtime = created.runtime
    runtime.resize({ width: 640, height: 360, dpr: 1 }); runtime.start(); pending(0)
    globalThis.__thresholdLoop = {
      advanceTo(seconds) {
        while (time < Math.round(seconds * 1000)) { time += 100; pending(time) }
        return { camera: runtime.getCameraRuntimeSnapshot().camera, render: runtime.getRenderGraphExecutorSnapshot(), modules: runtime.getModuleRuntimeSnapshot(), effects: runtime.getEffectRuntimeSnapshot() }
      }, set(name, value) {
        const ids = { brightness: CINEMA2_THRESHOLD_PANEL_BRIGHTNESS_ID, bloom: CINEMA2_THRESHOLD_BLOOM_ID, master: CINEMA2_THRESHOLD_INTENSITY_ID }
        runtime.getParameterState().setPersistentValue(ids[name], value); pending(time)
      }, dispose: () => runtime.dispose(),
    }
  })
  const shot = async name => {
    await page.evaluate(() => globalThis.__thresholdLoop.advanceTo(0))
    return sharp(await page.locator('canvas').screenshot({ path: resolve(out, `${name}.png`) })).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  }
  const brightness = image => {
    let sum = 0
    for (let i = 0; i < image.data.length; i += 3) sum += .2126 * image.data[i] + .7152 * image.data[i + 1] + .0722 * image.data[i + 2]
    return sum / (image.info.width * image.info.height)
  }
  await page.evaluate(() => globalThis.__thresholdLoop.advanceTo(0))
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => globalThis.__thresholdLoop.set('brightness', .7 / 2.3))
  const lower = await shot('lower-led-output')
  await page.evaluate(() => globalThis.__thresholdLoop.set('brightness', .7))
  const bright = await shot('default-led-output')
  metrics.brightnessRatio = brightness(bright) / brightness(lower)
  if (metrics.brightnessRatio < 1.15) throw new Error(`Insufficient visible brightness increase: ${metrics.brightnessRatio}`)
  await page.evaluate(() => globalThis.__thresholdLoop.set('bloom', 0))
  const noBloom = await shot('bloom-off')
  metrics.bloomDifference = bright.data.reduce((sum, v, i) => sum + Math.abs(v - noBloom.data[i]), 0) / bright.data.length
  if (metrics.bloomDifference < .05) throw new Error(`HDR bloom is not visible: ${metrics.bloomDifference}`)
  await page.evaluate(() => globalThis.__thresholdLoop.set('bloom', .38))
  for (const seconds of [2, 4, 8]) {
    const state = await page.evaluate(t => globalThis.__thresholdLoop.advanceTo(t), seconds)
    await shot(`flight-${seconds}`)
    if (state.render.failedPassCount || state.modules.failedModuleCount || state.effects.failedEffectCount) throw new Error(`Render failure at ${seconds}s`)
    samples.push({ seconds, position: state.camera.position, fov: state.camera.fovDegrees, roll: state.camera.rollDegrees })
  }
  if (errors.length) throw new Error(errors.join('\n'))
  await page.evaluate(() => globalThis.__thresholdLoop.dispose())
  await writeFile(resolve(out, 'report.json'), JSON.stringify({ samples, metrics, errors }, null, 2))
  console.log(JSON.stringify({ samples, metrics, errors }, null, 2))
} finally { await browser?.close(); await server.close() }

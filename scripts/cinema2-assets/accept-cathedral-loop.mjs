// Render the real Cathedral camera/module/effects through two loop boundaries.
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import sharp from 'sharp'
const root = resolve(import.meta.dirname, '../..'), out = resolve(root, 'artifacts/cinema2-cathedral-loop')
await mkdir(out, { recursive: true })
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0 }, clearScreen: false,
  plugins: [{ name: 'cathedral-loop-harness', configureServer(server) {
    server.middlewares.use('/__cathedral-loop', (_req, res) => {
      res.setHeader('Content-Type', 'text/html')
      res.end('<html><body style="margin:0;background:black"><canvas id="stage" width="640" height="360"></canvas></body></html>')
    })
  } }],
})
const errors = [], samples = []
let browser
try {
  await server.listen()
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } })
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error' && /shader|WebGL/.test(m.text())) errors.push(m.text()) })
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__cathedral-loop`)
  await page.evaluate(async () => {
    const { Cinema2Runtime } = await import('/src/components/vyzualz/cinema2/runtime/Cinema2Runtime.ts')
    const { CINEMA2_CATHEDRAL_PRESET_ID } = await import('/src/components/vyzualz/cinema2/presets/Cinema2CathedralPreset.ts')
    let pending, time = 0
    const created = Cinema2Runtime.create(globalThis.document.querySelector('canvas'), {
      presetId: CINEMA2_CATHEDRAL_PRESET_ID, renderQuality: 'high', diagnosticsEnabled: true,
      requestAnimationFrame: cb => { pending = cb; return 1 }, cancelAnimationFrame: () => {},
      transportSource: { getState: () => ({ sourcePresent: true, playing: true, analysisActive: true, paused: false, animationActive: true, trackId: 'seam-check', timeSec: time / 1000, bpm: 120, bpmSync: true }) },
    })
    if (!created.runtime) throw new Error(created.error)
    const runtime = created.runtime
    runtime.resize({ width: 640, height: 360, dpr: 1 }); runtime.start(); pending(0)
    globalThis.__cathedralLoop = {
      advanceTo(seconds) {
        while (time < Math.round(seconds * 1000)) { time += 100; pending(time) }
        return { camera: runtime.getCameraRuntimeSnapshot().camera, render: runtime.getRenderGraphExecutorSnapshot(), modules: runtime.getModuleRuntimeSnapshot(), effects: runtime.getEffectRuntimeSnapshot() }
      }, dispose: () => runtime.dispose(),
    }
  })
  for (const seconds of [40, 46, 50, 51.9, 52.2, 54, 98, 103.9, 104.2]) {
    const state = await page.evaluate(t => globalThis.__cathedralLoop.advanceTo(t), seconds)
    const image = await page.locator('canvas').screenshot({ path: resolve(out, `flight-${seconds}.png`) })
    const { data, info } = await sharp(image).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    let lit = 0
    for (let i = 0; i < data.length; i += info.channels) if (Math.max(data[i], data[i + 1], data[i + 2]) > 40) lit++
    const litFraction = lit / (info.width * info.height)
    if (litFraction < .005) throw new Error(`Dark gap at ${seconds}s: ${litFraction}`)
    if (state.render.failedPassCount || state.modules.failedModuleCount || state.effects.failedEffectCount) throw new Error(`Render failure at ${seconds}s`)
    samples.push({ seconds, cameraZ: state.camera.position[2], litFraction })
  }
  if (errors.length) throw new Error(errors.join('\n'))
  await page.evaluate(() => globalThis.__cathedralLoop.dispose())
  await writeFile(resolve(out, 'report.json'), JSON.stringify({ samples, errors }, null, 2))
  console.log(JSON.stringify({ samples, errors }, null, 2))
} finally { await browser?.close(); await server.close() }

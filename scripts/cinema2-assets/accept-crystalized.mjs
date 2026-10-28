import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'
const root = resolve(import.meta.dirname, '../..'), out = resolve(root, 'artifacts/cinema2-crystalized')
await mkdir(out, { recursive: true })
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0 }, clearScreen: false,
  plugins: [{ name: 'crystalized-review', configureServer(server) {
    server.middlewares.use('/__crystalized', (_req, res) => {
      res.setHeader('Content-Type', 'text/html')
      res.end('<html><body style="margin:0;background:black"><canvas width="960" height="540"></canvas></body></html>')
    })
  } }],
})
let browser
const errors = [], samples = []
try {
  await server.listen()
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } })
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error' && /WebGL|shader|THREE/.test(message.text())) errors.push(message.text()) })
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__crystalized`)
  await page.evaluate(async () => {
    const { Cinema2Runtime } = await import('/src/components/vyzualz/cinema2/runtime/Cinema2Runtime.ts')
    const { CINEMA2_ATMOSPHERE_REFERENCE_PRESET_ID } = await import('/src/components/vyzualz/cinema2/presets/Cinema2AtmosphereReferencePreset.ts')
    let runtime
    globalThis.__crystalized = {
      enter(quality) {
        runtime?.dispose()
        const created = Cinema2Runtime.create(globalThis.document.querySelector('canvas'), { presetId: CINEMA2_ATMOSPHERE_REFERENCE_PRESET_ID, renderQuality: quality, diagnosticsEnabled: true })
        if (!created.runtime) throw new Error(created.error)
        runtime = created.runtime; runtime.resize({ width: 960, height: 540, dpr: 1 }); runtime.start()
      },
      status: () => ({ snapshot: runtime.getSnapshot(), modules: runtime.getModuleRuntimeSnapshot(), render: runtime.getRenderGraphExecutorSnapshot(), effects: runtime.getEffectRuntimeSnapshot() }),
      dispose: () => runtime.dispose(),
    }
  })
  for (const quality of ['high', 'low']) {
    await page.evaluate(quality => globalThis.__crystalized.enter(quality), quality)
    await page.waitForFunction(() => {
      const s = globalThis.__crystalized.status()
      if (s.modules.failedModuleCount || s.render.failedPassCount || s.effects.failedEffectCount) throw new Error(JSON.stringify(s))
      return s.modules.estimatedGpuBytes > 0 && s.snapshot.frameCount > 90
    }, null, { timeout: 45000 })
    await page.locator('canvas').screenshot({ path: resolve(out, `${quality}.png`) })
    samples.push({ quality, state: await page.evaluate(() => globalThis.__crystalized.status()) })
  }
  if (errors.length) throw new Error(errors.join('\n'))
  await page.evaluate(() => globalThis.__crystalized.dispose())
  await writeFile(resolve(out, 'report.json'), JSON.stringify({ samples, errors }, null, 2))
  console.log(JSON.stringify({ quality: samples.map(s => s.quality), errors }))
} finally { await browser?.close(); await server.close() }

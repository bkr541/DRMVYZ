import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import sharp from 'sharp'
const root = resolve(import.meta.dirname, '../..'), out = resolve(root, 'artifacts/cinema2-crystalized-performance')
await mkdir(out, { recursive: true })
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0 }, clearScreen: false,
  plugins: [{ name: 'crystalized-performance-check', configureServer(server) {
    server.middlewares.use('/__crystalized-performance', (_req, res) => {
      res.setHeader('Content-Type', 'text/html')
      res.end('<html><body style="margin:0;background:#080c12"><canvas width="960" height="540"></canvas><aside id="inspector" style="position:fixed;right:0;top:0;bottom:0;overflow:auto;width:360px;background:#10181f;color:white;padding:12px;display:none"></aside></body></html>')
    })
  } }],
})
let browser
const errors = [], checks = [], metrics = {}
const uiOnly = process.argv.includes('--ui-only')
const assert = (ok, message) => { if (!ok) throw new Error(message); checks.push(message) }
try {
  await server.listen()
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error' && /shader|WebGL|THREE/.test(m.text())) errors.push(m.text()) })
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__crystalized-performance`)
  await page.evaluate(async () => {
    const Refresh = (await import('/@react-refresh')).default
    Refresh.injectIntoGlobalHook(globalThis); globalThis.$RefreshReg$ = () => {}; globalThis.$RefreshSig$ = () => type => type; globalThis.__vite_plugin_react_preamble_installed__ = true
    await import('/src/styles.css'); await import('/src/styles/appearance.css'); await import('/src/styles/groupSpacing.css'); await import('/src/styles/reactView.css'); await import('/src/styles/typography.css')
    const ReactModule = await import('/node_modules/.vite/deps/react.js'), React = ReactModule.default ?? ReactModule
    const ClientModule = await import('/node_modules/.vite/deps/react-dom_client.js'), Client = ClientModule.default ?? ClientModule
    const { Cinema2InspectorPanel } = await import('/src/components/vyzualz/react/Cinema2InspectorPanel.tsx')
    const { Cinema2Runtime } = await import('/src/components/vyzualz/cinema2/runtime/Cinema2Runtime.ts')
    const preset = await import('/src/components/vyzualz/cinema2/presets/Cinema2AtmosphereReferencePreset.ts')
    const { AudioFeatureBus } = await import('/src/features/musicIntelligence/AudioFeatureBus.ts')
    const { nightshiftMusicFixture } = await import('/src/test/support/NightshiftMusicFixture.ts')
    const { Cinema2PresetRegistry } = await import('/src/components/vyzualz/cinema2/presets/Cinema2PresetRegistry.ts')
    // Hold the base dolly for pixel comparisons; production camera timing is unchanged.
    const registry = new Cinema2PresetRegistry()
    const registered = registry.register({ ...preset.CINEMA2_ATMOSPHERE_REFERENCE_PRESET_MANIFEST, cameras: preset.CINEMA2_ATMOSPHERE_REFERENCE_PRESET_MANIFEST.cameras.map(camera => ({ ...camera, rig: { ...camera.rig, durationSeconds: 1e9 } })) })
    if (!registered.ok) throw new Error(JSON.stringify(registered.diagnostics))
    const ids = { density: preset.CINEMA2_ATMOSPHERE_REFERENCE_DENSITY_ID, mist: preset.CINEMA2_ATMOSPHERE_REFERENCE_MIST_ID, ...preset.CINEMA2_CRYSTALIZED_PARAMETER_IDS, response: preset.CINEMA2_ATMOSPHERE_REFERENCE_REACTIVITY_ID, camera: preset.CINEMA2_ATMOSPHERE_REFERENCE_MOTION_ID, finish: preset.CINEMA2_ATMOSPHERE_REFERENCE_FINISH_ID }
    let time = 0, target = 0, paused = false, enabled = false, sequence = 0, dirty = false, fixture = {}, runtime
    const faults = []
    const created = Cinema2Runtime.create(globalThis.document.querySelector('canvas'), {
      presetId: preset.CINEMA2_ATMOSPHERE_REFERENCE_PRESET_ID, presetRegistry: registry, renderQuality: 'high', diagnosticsEnabled: true,
      requestAnimationFrame: callback => globalThis.requestAnimationFrame(() => {
        const previousTime = time
        if (!paused) time = Math.min(target, time + 50)
        if (enabled && (time !== previousTime || dirty)) { AudioFeatureBus.setFrame(nightshiftMusicFixture({ ...fixture, timeSec: time / 1000, frameId: ++sequence })); dirty = false }
        callback(time)
        if (runtime?.getRenderGraphExecutorSnapshot().failedPassCount) faults.push(runtime.getRenderGraphExecutorSnapshot())
      }),
      cancelAnimationFrame: id => globalThis.cancelAnimationFrame(id),
      transportSource: { getState: () => ({ sourcePresent: enabled, playing: !paused, paused, analysisActive: true, animationActive: !paused, trackId: enabled ? 'nightshift-audio-fixture' : null, timeSec: time / 1000, bpm: 120, bpmSync: false }) },
    })
    if (!created.runtime) throw new Error(created.error)
    runtime = created.runtime; runtime.resize({ width: 960, height: 540, dpr: 1 }); runtime.start()
    const inspector = Client.createRoot(globalThis.document.querySelector('#inspector'))
    const refresh = () => inspector.render(React.createElement(Cinema2InspectorPanel, { runtime, surface: 'design', sharedAudioAnalysis: false }))
    const settle = async () => { for (let i = 0; i < 8; i++) await new Promise(globalThis.requestAnimationFrame) }
    refresh()
    globalThis.__crystalizedPerformance = {
      ids,
      async set(values) { for (const [key, value] of Object.entries(values)) runtime.getParameterState().setPersistentValue(ids[key], value); refresh(); await settle() },
      async music(options = {}) { enabled = true; fixture = options; dirty = true; await settle() },
      async advance(seconds, hold = false) { paused = hold; target = time + (hold ? 0 : seconds * 1000); while (time < target) await new Promise(globalThis.requestAnimationFrame); await settle() },
      showInspector(show) { globalThis.document.querySelector('#inspector').style.display = show ? 'block' : 'none'; refresh() },
      status: () => ({ snapshot: runtime.getSnapshot(), modules: runtime.getModuleRuntimeSnapshot(), render: runtime.getRenderGraphExecutorSnapshot(), effects: runtime.getEffectRuntimeSnapshot(), faults, parameters: runtime.getParameterState().getSnapshot() }),
      dispose() { inspector.unmount(); runtime.dispose(); return { snapshot: runtime.getSnapshot(), resources: runtime.getResourceManagerSnapshot() } },
    }
  })
  await page.waitForFunction(() => { const s = globalThis.__crystalizedPerformance?.status(); return s && s.modules.estimatedGpuBytes > 0 && s.snapshot.frameCount > 90 }, null, { timeout: 45000 })
  const P = await page.evaluate(() => globalThis.__crystalizedPerformance.ids)
  const set = values => page.evaluate(v => globalThis.__crystalizedPerformance.set(v), values)
  const music = options => page.evaluate(v => globalThis.__crystalizedPerformance.music(v), options)
  const advance = (seconds, hold = false) => page.evaluate(v => globalThis.__crystalizedPerformance.advance(v.seconds, v.hold), { seconds, hold })
  const shot = async name => sharp(await page.locator('canvas').screenshot({ path: resolve(out, `${name}.png`) })).removeAlpha().raw().toBuffer()
  const diff = (a, b) => a.reduce((sum, v, i) => sum + Math.abs(v - b[i]), 0) / a.length
  await set({ camera: 0, finish: 0, motion: 0 })
  await page.evaluate(() => globalThis.__crystalizedPerformance.showInspector(true))
  assert(await page.locator('[data-cinema2-parent-group]').count() === 4, 'Design exposes the four canonical parent groups')
  assert(await page.locator(`[data-cinema2-control-id="${P.trigger}"]`).count() === 0, 'Trigger is hidden until Pattern Change is enabled')
  await page.locator(`[data-cinema2-control-id="${P.patternChange}"]`).getByRole('switch').click()
  const trigger = page.locator(`[data-cinema2-control-id="${P.trigger}"]`).getByRole('combobox')
  await trigger.click()
  assert(await page.getByRole('option').count() === 11, 'Portaled Trigger dropdown exposes all eleven standard choices')
  metrics.dropdownTypography = await page.getByRole('option').first().evaluate(option => { const style = globalThis.getComputedStyle(option.querySelector('.drm-dropdown__option-label') ?? option); return { size: style.fontSize, family: style.fontFamily } })
  await page.screenshot({ path: resolve(out, 'trigger-dropdown.png') })
  await page.keyboard.press('Escape')
  await page.screenshot({ path: resolve(out, 'design-groups.png') })
  metrics.typography = await page.locator('[data-cinema2-parent-group]').evaluateAll(groups => groups.map(group => {
    const heading = group.closest('.drc-group')?.querySelector(':scope > .drc-header')
    const style = heading ? globalThis.getComputedStyle(heading) : null
    return { group: group.getAttribute('data-cinema2-parent-group'), fontSize: style?.fontSize, fontWeight: style?.fontWeight }
  }))
  assert(metrics.typography.every(group => group.fontSize === '12px' && group.fontWeight === '700'), 'Parent headers use the shared window-title typography')
  metrics.nestedTypography = await page.locator('.drc-group[data-drc-depth="1"] > .drc-header').evaluateAll(headers => headers.map(header => globalThis.getComputedStyle(header).fontSize))
  assert(metrics.nestedTypography.every(size => size === '11px'), 'Nested headers retain the shared 11px typography')
  await page.evaluate(() => globalThis.__crystalizedPerformance.showInspector(false))
  await set({ patternChange: false })
  if (!uiOnly) {
  await shot('authored')
  await set({ crystalScale: .65 }); const small = await shot('crystal-small')
  await set({ crystalScale: 1.3 }); const large = await shot('crystal-large')
  assert(diff(small, large) > 2, 'Crystal Scale visibly changes the imported model')
  await set({ crystalScale: 1, monolithHeight: .65 }); const short = await shot('monolith-short')
  await set({ monolithHeight: 1.35 }); const tall = await shot('monolith-tall')
  assert(diff(short, tall) > 1, 'Monolith Height visibly changes the surrounding geometry')
  await set({ monolithHeight: 1, motion: .35, density: 0, mist: 0 })
  const grounded = await shot('crystal-grounded')
  await advance(2); const groundedHeld = await shot('crystal-grounded-held')
  // Measure the hero, excluding independently animated floor light/reflections.
  const crystalRegion = pixels => sharp(pixels, { raw: { width: 960, height: 540, channels: 3 } }).extract({ left: 390, top: 15, width: 195, height: 300 }).raw().toBuffer()
  metrics.stationaryCrystalDifference = diff(await crystalRegion(grounded), await crystalRegion(groundedHeld))
  assert(metrics.stationaryCrystalDifference < .3, 'The floor-anchored crystal stays still without music')
  await set({ motion: 0, density: 0, mist: 0 })
  await music({ energy: 0, bass: 0, high: 0 }); await advance(.8); const quiet = await shot('quiet')
  await music({ energy: 1, bass: 1, high: 1 }); await advance(.8); const energetic = await shot('energetic')
  assert(diff(quiet, energetic) > .2, 'Shared Audio Intelligence visibly changes the lighting')
  await set({ response: 0 }); await music({ energy: 0 }); await advance(.8); const off = await shot('response-off')
  await music({ energy: 1, bass: 1, high: 1, event: 'drop', eventId: 99 }); await advance(.3)
  metrics.responseOffDifference = diff(off, await shot('response-off-drop'))
  assert(metrics.responseOffDifference < .3, 'Music Response zero suppresses music-driven changes')
  for (const pattern of ['prism', 'orbit', 'pulse', 'cascade']) { await set({ pattern }); await advance(.7); await shot(`pattern-${pattern}`) }
  await set({ motion: .35, response: .8 }); await advance(.4)
  await advance(0, true); const paused = await shot('paused')
  await advance(1, true); assert(diff(paused, await shot('paused-held')) < .1, 'Pause holds camera, geometry and lighting')
  await set({ master: 0 }); const dark = await shot('master-zero')
  assert(dark.reduce((sum, v) => sum + v, 0) / dark.length < 8, 'Master zero extinguishes geometry, lights and effects')
  }
  const state = await page.evaluate(() => globalThis.__crystalizedPerformance.status())
  assert(!state.modules.failedModuleCount && !state.effects.failedEffectCount && !state.render.failedPassCount && !state.faults.length && !errors.length, 'No browser, shader or render failures')
  const disposed = await page.evaluate(() => globalThis.__crystalizedPerformance.dispose())
  assert(disposed.snapshot.phase === 'disposed' && disposed.resources.activeLeaseCount === 0, 'Disposal releases the native bridge and owned resources')
  await writeFile(resolve(out, uiOnly ? 'ui-report.json' : 'report.json'), JSON.stringify({ checks, metrics, errors }, null, 2))
  console.log(JSON.stringify({ checks, metrics, errors }, null, 2))
} finally { await browser?.close(); await server.close() }

/* global window, WebGL2RenderingContext, requestAnimationFrame */
import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

export async function runBlockshiftPolishAcceptance(browser, output, { withAtmosphere = false } = {}) {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 }, recordVideo: { dir: output, size: { width: 960, height: 540 } } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    const records = [], contexts = new WeakMap(), kinds = ['Buffer', 'VertexArray', 'Program', 'Shader', 'Texture', 'Framebuffer', 'Renderbuffer', 'Query']
    const record = gl => {
      if (!contexts.has(gl)) {
        const debug = gl.getExtension('WEBGL_debug_renderer_info')
        const entry = { canvas: gl.canvas, renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), counts: {}, sizes: new Map(), bound: {}, instances: {}, draws: [], errors: [], shaderFailures: 0, gpuSamples: [], gpuResultCount: 0 }
        contexts.set(gl, entry); records.push(entry)
        gl.canvas.addEventListener('webglcontextlost', () => { entry.sizes.clear() })
      }
      return contexts.get(gl)
    }
    for (const kind of kinds) for (const operation of ['create', 'delete']) {
      const method = operation + kind, original = WebGL2RenderingContext.prototype[method]
      WebGL2RenderingContext.prototype[method] = function (...args) {
        const entry = record(this), value = original.apply(this, args)
        if (operation === 'create' ? value != null : args[0] != null) entry.counts[method] = (entry.counts[method] ?? 0) + 1
        if (operation === 'delete') entry.sizes.delete(args[0])
        return value
      }
    }
    for (const method of ['bindTexture', 'bindBuffer', 'bindRenderbuffer', 'texImage2D', 'bufferData', 'bufferSubData', 'renderbufferStorage', 'drawElementsInstanced', 'getError', 'getShaderParameter', 'getQueryParameter']) {
      const original = WebGL2RenderingContext.prototype[method]
      WebGL2RenderingContext.prototype[method] = function (...args) {
        const entry = record(this), value = original.apply(this, args)
        if (method.startsWith('bind')) entry.bound[args[0]] = args[1]
        const bound = entry.bound[args[0]]
        if (method === 'bufferData' && bound) entry.sizes.set(bound, typeof args[1] === 'number' ? args[1] : args[1]?.byteLength ?? 0)
        if (method === 'texImage2D' && bound && args.length === 9) entry.sizes.set(bound, args[3] * args[4] * (args[2] === this.RGBA16F ? 8 : args[2] === this.RGBA32F ? 16 : 4))
        if (method === 'renderbufferStorage' && bound) entry.sizes.set(bound, args[2] * args[3] * 4)
        const data = args[method === 'bufferData' ? 1 : 2]
        if (['bufferData', 'bufferSubData'].includes(method) && data instanceof Float32Array && [12, 168].includes(data.length)) entry.instances[data.length] = Array.from(data)
        if (method === 'drawElementsInstanced') { entry.draws.push([args[1], args[4]]); if (entry.draws.length > 4) entry.draws.shift() }
        if (method === 'getError' && value !== 0 && value !== 0x9242) entry.errors.push(value)
        if (method === 'getQueryParameter' && args[1] === this.QUERY_RESULT && Number.isFinite(value)) { entry.gpuSamples.push({ id: ++entry.gpuResultCount, ms: value / 1e6 }); if (entry.gpuSamples.length > 256) entry.gpuSamples.shift() }
        if (method === 'getShaderParameter' && args[1] === this.COMPILE_STATUS && !value) entry.shaderFailures++
        return value
      }
    }
    window.__blockshiftPolishGpu = () => records.map(entry => ({ connected: entry.canvas.isConnected, renderer: entry.renderer, counts: { ...entry.counts }, live: Object.fromEntries(kinds.map(kind => [kind, (entry.counts['create' + kind] ?? 0) - (entry.counts['delete' + kind] ?? 0)])), estimatedAllocatedBytes: [...entry.sizes.values()].reduce((sum, bytes) => sum + bytes, 0), instances: entry.instances, draws: entry.draws, errors: entry.errors, shaderFailures: entry.shaderFailures, gpuSamples: entry.gpuSamples, gpuResultCount: entry.gpuResultCount }))
  })
  await page.goto('http://127.0.0.1:47981/src/test/browser/cinema2-blockshift-production.html?audio-fixture=1')
  const status = () => page.evaluate(() => window.__blockshiftAudio.status())
  const diagnostics = () => page.evaluate(() => window.__blockshiftAudio.diagnostics())
  const gpu = async () => (await page.evaluate(() => window.__blockshiftPolishGpu())).findLast(record => record.connected)
  const frames = async (count = 3) => { const next = (await status()).frames + count; await page.waitForFunction(next => { const s = window.__blockshiftAudio.status(); return s.frames >= next && s.time === s.targetTime }, next) }
  const set = async (suffix, value) => { await page.evaluate(([suffix, value]) => window.__blockshiftAudio.set(suffix, value), [suffix, value]); await frames() }
  const step = async (profile, seconds) => { await page.evaluate(([profile, seconds]) => window.__blockshiftAudio.step(profile, seconds), [profile, seconds]); await frames() }
  const ready = async () => { await page.waitForFunction(() => { const d = window.__blockshiftAudio?.diagnostics(); return d?.runtime.phase === 'running' && d.engine.modules.estimatedGpuBytes > 0 }); await frames() }
  const capture = async name => sharp(await page.locator('canvas').screenshot({ path: path.join(output, `${name}.png`) })).removeAlpha().raw().toBuffer()
  await ready()
  await set('bpm-sync', false); await set('audio-reactivity', 0); await set('motion-amount', 0)
  const aspects = [], bloom = []
  for (const [aspect, width, height] of [['16x9', 960, 540], ['1x1', 720, 720], ['9x16', 540, 960]]) {
    await page.setViewportSize({ width, height })
    await page.evaluate(([w, h]) => window.__blockshiftAudio.resize(w, h), [width, height]); await frames()
    for (const pattern of ['stack', 'orbit', 'stagger', 'split', 'wave', 'collapse']) {
      await set('pattern', pattern); await set('bloom', 0)
      const zero = await capture(`${aspect}-${pattern}-bloom-0`), before = await gpu()
      assert.equal(Object.values(before.instances).reduce((sum, data) => sum + data.length / 12, 0), 15)
      assert.deepEqual(before.draws, [[36, 14], [132, 14], [5226, 1], [16758, 1]])
      const heroPixels = Array.from({ length: width * height }, (_, i) => Math.max(...zero.subarray(i * 3, i * 3 + 3)) > 70 ? 1 : 0).reduce((a, b) => a + b, 0)
      assert(heroPixels > 200, `${aspect}/${pattern}: no visible hero geometry`)
      await set('bloom', 0.3)
      const on = await capture(`${aspect}-${pattern}-bloom-default`)
      assert.deepEqual((await gpu()).instances, before.instances, 'Bloom altered native geometry or hues')
      assert(!on.equals(zero), `${aspect}/${pattern}: Bloom has no visible consumer`)
      aspects.push({ aspect, pattern, heroPixels, bloomVisible: true, nativeGeometryPreserved: true })
      if (aspect === '16x9' && pattern === 'stagger') {
        await set('bloom', 1); const maximum = await capture('bloom-maximum')
        assert(!maximum.equals(on))
        await set('bloom', 0); assert(zero.equals(await capture('bloom-zero-restored')), 'Bloom zero retains glow history')
        bloom.push({ minDefaultMaxDistinct: true, zeroRestoresExactPixels: true })
      }
    }
  }
  await page.setViewportSize({ width: 960, height: 540 })
  await page.evaluate(() => window.__blockshiftAudio.resize(960, 540)); await frames()
  await set('pattern', 'stagger'); await set('motion-amount', 1); await set('camera-motion', true); await set('camera-float-amount', 1); await set('camera-float-speed', 2); await set('orbit-camera', true); await set('orbit-intensity', 1)
  const cameras = []
  for (const fov of [60, 85, 100]) {
    await set('camera-fov', fov)
    for (let i = 0; i < 6; i++) await step('silence', 0.25)
    const camera = (await status()).camera.camera
    assert(camera.position.every(Number.isFinite) && Math.hypot(...camera.position) < 1)
    await capture(`camera-fov-${fov}-float-orbit`); cameras.push(camera)
  }
  await set('camera-motion', false)
  assert.deepEqual((await status()).camera.camera.position, [0, 0, 0])
  await set('camera-fov', 85); await set('bloom', 0.3); await set('audio-reactivity', 1)
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.evaluate(() => window.__blockshiftAudio.resize(1920, 1080)); await frames()
  if (withAtmosphere) {
    await set('atmosphere', true); await set('rotate-cubes', true); await set('camera-motion', true)
    await step('silence', 0.5); await frames(20) // Warm shared smoke texture and effect targets before profiling.
  }
  const profiles = []
  for (const mode of ['quality', 'balanced', 'performance']) {
    await set('quality-mode', mode); await frames(8)
    const before = await gpu()
    const samples = await page.evaluate(() => new Promise(resolve => {
      const samples = []; let last = performance.now()
      function sample(now) {
        const d = window.__blockshiftAudio.diagnostics()
        samples.push({ intervalMs: now - last, cpuMs: d.engine.performance.cpuFrameTimeMs, gpuMs: d.engine.performance.gpuFrameTimeMs })
        last = now; window.__blockshiftAudio.step('bass', 1 / 60)
        if (samples.length < 60) requestAnimationFrame(sample); else resolve(samples.slice(10))
      }
      requestAnimationFrame(sample)
    }))
    const after = await gpu(), d = await diagnostics()
    for (const kind of ['Buffer', 'VertexArray', 'Program', 'Shader', 'Texture', 'Framebuffer', 'Renderbuffer']) assert.equal(after.counts['create' + kind], before.counts['create' + kind], `${kind} allocated every frame`)
    assert.equal(d.engine.modules.failedModuleCount, 0); assert.equal(d.effects.failedEffectCount, 0); assert.equal(d.engine.render.failedPassCount, 0)
    assert.equal(after.shaderFailures, 0); assert.deepEqual(after.errors, [])
    const stats = key => { const values = samples.map(s => s[key]).filter(Number.isFinite).sort((a, b) => a - b); return values.length ? { median: values[Math.floor(values.length / 2)], p95: values[Math.floor(values.length * 0.95)] } : null }
    const freshGpuSamples = after.gpuSamples.filter(sample => sample.id > before.gpuResultCount).map(sample => sample.ms).sort((a, b) => a - b)
    const freshGpuStats = freshGpuSamples.length ? { median: freshGpuSamples[Math.floor(freshGpuSamples.length / 2)], p95: freshGpuSamples[Math.floor(freshGpuSamples.length * 0.95)] } : null
    profiles.push({ mode, atmosphere: withAtmosphere, rotatingCubes: withAtmosphere, viewport: { width: 1920, height: 1080, dpr: 1 }, renderer: after.renderer, performance: d.engine.performance, engineTargets: d.engine.resources, allocatedGpuBytesIncludingBloom: after.estimatedAllocatedBytes, nativeGpuBytes: d.engine.modules.estimatedGpuBytes, live: after.live, intervalMs: stats('intervalMs'), cpuMs: stats('cpuMs'), gpuMs: freshGpuStats, freshGpuSampleCount: freshGpuSamples.length, gpuTelemetryNote: freshGpuSamples.length ? 'Only completed queries during this mode are included.' : 'No completed GPU query during this mode; the diagnostic last-known value is excluded from GPU statistics.', shaderFailures: after.shaderFailures, steadyStateAllocations: 0 })
    await capture(`quality-${mode}`)
  }
  // Recreate the production runtime three times; all GPU object classes must remain bounded.
  const recreations = []
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.__blockshiftAudio.reset()); await ready(); await frames(5)
    const g = await gpu(); assert(g.live.Query <= 2); const { Query: pendingQueries, ...stable } = g.live; recreations.push({ ...stable, pendingQueriesBounded: pendingQueries <= 2 })
  }
  assert.deepEqual(recreations[1], recreations[0]); assert.deepEqual(recreations[2], recreations[0])
  await set('motion-amount', 0); await set('audio-reactivity', 0); await set('bloom', 0.3)
  await page.evaluate(() => window.__blockshiftAudio.seek(0, 'p7-recovery')); await frames()
  const beforeLoss = await diagnostics(), authored = (await status()).authored
  const prior = await capture('before-context-loss')
  const recoveryCycles = []
  for (let cycle = 0; cycle < 3; cycle++) {
    await page.evaluate(() => { const gl = window.document.querySelector('canvas').getContext('webgl2'); window.__blockshiftLoseContext = gl.getExtension('WEBGL_lose_context'); if (!window.__blockshiftLoseContext) throw new Error('Context-loss extension unavailable'); window.__blockshiftLoseContext.loseContext() })
    await page.waitForFunction(() => window.__blockshiftAudio.diagnostics().runtime.phase === 'context-lost')
    await page.evaluate(() => window.__blockshiftLoseContext.restoreContext()); await ready(); await frames(5)
    const recovered = await diagnostics(), recoveredPixels = await capture(`after-context-restore-${cycle + 1}`)
    recoveryCycles.push({ cycle: cycle + 1, recovered, gpu: await gpu() })
    await writeFile(path.join(output, 'context-recovery-diagnostics.json'), JSON.stringify({ beforeLoss, recoveryCycles, profiles }, null, 2) + '\n')
    assert.equal(recovered.runtime.contextGeneration, beforeLoss.runtime.contextGeneration + cycle + 1)
    assert.deepEqual((await status()).authored, authored)
    assert(prior.equals(recoveredPixels), 'Context recovery changed the stopped authored field')
    assert.equal(recovered.effects.failedEffectCount, 0); assert.equal(recovered.engine.modules.failedModuleCount, 0); assert.equal(recovered.engine.render.failedPassCount, 0)
  }
  await set('master-intensity', 0); await set('bloom', 1)
  assert(Math.max(...new Set(await capture('master-zero-bloom-max'))) <= 25, 'Bloom bypassed Master Intensity zero')
  assert.deepEqual(errors, [])
  const finalGpu = await gpu(); assert.deepEqual(finalGpu.errors, []); assert.equal(finalGpu.shaderFailures, 0)
  const video = page.video(); await page.close(); await video.saveAs(path.join(output, 'phase7-polish.webm'))
  const retired = (await page.isClosed()) // Full disposal is also checked by the normal-app preset-switch probe.
  const report = { result: 'PASS', aspects, bloom, cameraFovExtremesAndBoundedFloatOrbit: cameras, cameraOffHonored: true, profiles, recreations, contextRecovery: { exactPixels: true, authoredValuesPreserved: true, generations: [beforeLoss.runtime.contextGeneration, ...recoveryCycles.map(cycle => cycle.recovered.runtime.contextGeneration)], cycles: recoveryCycles.length }, masterZeroHonored: true, retired, errors, environment: 'Production catalog/runtime, shared camera and HDR bloom, supplied GLBs; synthetic upstream audio, controlled clock; timing is local browser telemetry, not a universal FPS guarantee' }
  await writeFile(path.join(output, 'polish-acceptance.json'), JSON.stringify(report, null, 2) + '\n')
  return report
}

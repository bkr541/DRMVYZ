/* global window, document, WebGL2RenderingContext */
import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const patterns = ['stack', 'orbit', 'stagger', 'split', 'wave', 'collapse']

/** Isolates repeated context interruption when a larger acceptance run detects a failure. */
export async function runBlockshiftContextAcceptance(browser, output) {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } })
  await page.addInitScript(() => {
    window.__blockshiftContextFailures = []
    let count = 0
    function observe() {
      const d = window.__blockshiftAudio?.diagnostics()
      if (d && d.engine.render.failedPassCount > count) { count = d.engine.render.failedPassCount; window.__blockshiftContextFailures.push(d) }
      window.requestAnimationFrame(observe)
    }
    window.requestAnimationFrame(observe)
  })
  await page.goto('http://127.0.0.1:47981/src/test/browser/cinema2-blockshift-production.html?audio-fixture=1')
  await page.waitForFunction(() => window.__blockshiftAudio?.diagnostics().engine.modules.estimatedGpuBytes > 0)
  await page.evaluate(() => { for (const suffix of ['atmosphere', 'rotate-cubes', 'camera-motion', 'orbit-camera']) window.__blockshiftAudio.set(suffix, true); window.__blockshiftAudio.step('bass', 1) })
  await page.waitForFunction(() => { const s = window.__blockshiftAudio.status(); return s.time === s.targetTime })
  const cycles = []
  for (let cycle = 0; cycle < 3; cycle++) {
    await page.evaluate(() => { window.__blockshiftP8Context = document.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context'); window.__blockshiftP8Context.loseContext() })
    await page.waitForFunction(() => window.__blockshiftAudio.diagnostics().runtime.phase === 'context-lost')
    await page.evaluate(() => window.__blockshiftP8Context.restoreContext())
    await page.waitForFunction(() => window.__blockshiftAudio.diagnostics().runtime.phase === 'running')
    await page.evaluate(() => window.__blockshiftAudio.step('bass', 0.4))
    await page.waitForFunction(() => { const s = window.__blockshiftAudio.status(); return s.time === s.targetTime })
    const diagnostics = await page.evaluate(() => window.__blockshiftAudio.diagnostics())
    cycles.push({ cycle: cycle + 1, diagnostics, failures: await page.evaluate(() => window.__blockshiftContextFailures) })
    await writeFile(path.join(output, 'wet-context-diagnostics.json'), JSON.stringify(cycles, null, 2) + '\n')
    assert.equal(diagnostics.engine.render.failedPassCount, 0, JSON.stringify(cycles[cycle].failures.map(d => d.engine.render)))
    assert.equal(diagnostics.effects.failedEffectCount, 0); assert.equal(diagnostics.engine.modules.failedModuleCount, 0)
  }
  await page.close()
  return { cycles: cycles.length, result: 'PASS' }
}

/** Actual chooser/canvas regression smoke; unit regressions separately cover neighboring behavior. */
export async function runBlockshiftNeighborAcceptance(page, output) {
  await page.getByRole('tablist', { name: 'React right workspace panels' }).getByRole('tab', { name: 'PRESETS' }).click()
  const results = []
  for (const name of ['depth', 'backstreet', 'afterhours']) {
    await page.locator(`[data-cinema2-preset-id="drmvyz.cinema2.${name}"]`).click()
    await page.waitForFunction(() => document.querySelector('[data-cinema2-stage="runtime"]')?.getAttribute('data-runtime-phase') === 'running')
    await page.waitForTimeout(700) // Allow each preset's lazy assets and first output to settle.
    const png = await page.locator('[data-cinema2-output-canvas="true"]').screenshot({ path: path.join(output, `neighbor-${name}.png`) })
    const { channels } = await sharp(png).removeAlpha().stats()
    assert(channels.some(channel => channel.max - channel.min > 20), `${name}: production output is blank`)
    assert.equal(await page.locator('[data-cinema2-stage="runtime"]').getAttribute('data-runtime-phase'), 'running')
    results.push({ preset: name, chooserActivation: true, nonblankCanvas: true })
  }
  await page.locator('[data-cinema2-preset-id="drmvyz.cinema2.blockshift"]').click()
  await page.waitForFunction(() => window.__blockshiftGpuProbe().some(record => record.connected && record.productionCanvas && record.draws.some(draw => draw[0] === 16758 && draw[1] === 1)))
  return results
}

/** Additional P8 coverage: four normalized phases, duplicate publications, transport and wet recovery. */
export async function runBlockshiftFinalAcceptance(browser, output) {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 }, recordVideo: { dir: output, size: { width: 960, height: 540 } } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    window.__blockshiftAcceptanceGpu = { instances: {}, errors: [] }
    for (const method of ['bufferData', 'bufferSubData', 'getError']) {
      const original = WebGL2RenderingContext.prototype[method]
      WebGL2RenderingContext.prototype[method] = function (...args) {
        const result = original.apply(this, args), data = args[method === 'bufferData' ? 1 : 2]
        if (data instanceof Float32Array && [12, 168].includes(data.length)) window.__blockshiftAcceptanceGpu.instances[data.length] = Array.from(data)
        if (method === 'getError' && result !== 0 && result !== 0x9242) window.__blockshiftAcceptanceGpu.errors.push(result)
        return result
      }
    }
  })
  await page.goto('http://127.0.0.1:47981/src/test/browser/cinema2-blockshift-production.html?audio-fixture=1')
  const status = () => page.evaluate(() => window.__blockshiftAudio.status())
  const frames = async (count = 3) => {
    const target = (await status()).frames + count
    await page.waitForFunction(target => { const s = window.__blockshiftAudio.status(); return s.frames >= target && s.time === s.targetTime }, target)
  }
  const ready = async () => { await page.waitForFunction(() => window.__blockshiftAudio?.diagnostics().engine.modules.estimatedGpuBytes > 0); await frames(5) }
  const set = async (suffix, value) => { await page.evaluate(([suffix, value]) => window.__blockshiftAudio.set(suffix, value), [suffix, value]); await frames() }
  const step = async (profile, seconds = 0.2) => { await page.evaluate(([profile, seconds]) => window.__blockshiftAudio.step(profile, seconds), [profile, seconds]); await frames() }
  const advance = async seconds => { for (let i = 0; i < Math.round(seconds / 0.2); i++) await step('silence') }
  const reset = async () => { await page.evaluate(() => window.__blockshiftAudio.reset()); await ready(); await set('bpm-sync', false); await set('audio-reactivity', 0) }
  const gpu = () => page.evaluate(() => window.__blockshiftAcceptanceGpu.instances)
  const capture = async name => {
    const png = await page.locator('canvas').screenshot({ path: name ? path.join(output, `${name}.png`) : undefined })
    return { png, pixels: await sharp(png).removeAlpha().raw().toBuffer() }
  }
  await ready()
  const filmstrips = [], tiles = []
  for (const pattern of patterns) {
    await reset(); await set('motion-amount', 0); await set('pattern', pattern); await set('motion-rate', 2); await set('motion-amount', 1)
    const phases = []
    let previous
    for (const phase of [0, 0.25, 0.5, 0.75]) {
      if (phase) await advance(2) // 120 BPM × Motion Rate 2 / 32 beats: one cycle is eight seconds.
      const name = `filmstrip-${pattern}-${Math.round(phase * 100)}`
      const image = await capture(name), instances = await gpu()
      assert(Object.values(instances).every(data => data.every(Number.isFinite)))
      if (previous) { assert.notDeepEqual(instances, previous.instances); assert(!image.pixels.equals(previous.pixels)) }
      phases.push({ normalizedPhase: phase, file: `${name}.png`, geometryAndPixelsVerified: true })
      tiles.push(await sharp(image.png).resize(320, 180).toBuffer())
      previous = { ...image, instances }
    }
    filmstrips.push({ pattern, phases })
  }
  const title = Buffer.from(`<svg width="1280" height="38"><rect width="100%" height="100%" fill="#101722"/><text x="16" y="25" font-family="sans-serif" font-size="18" fill="white">BLOCKSHIFT — phases 0 / .25 / .5 / .75; rows: Stack, Orbit, Stagger, Split, Wave, Collapse</text></svg>`)
  await sharp({ create: { width: 1280, height: 1118, channels: 3, background: '#050811' } }).composite([{ input: title, left: 0, top: 0 }, ...tiles.map((input, i) => ({ input, left: i % 4 * 320, top: 38 + Math.floor(i / 4) * 180 }))]).png().toFile(path.join(output, 'six-pattern-filmstrips.png'))

  // Static geometry/brightness ranges are exercised through the Inspector. Exercise each
  // temporal numeric at the same elapsed time so phase drift cannot masquerade as a consumer.
  const temporalControls = []
  for (const [suffix, values] of [
    ['motion-amount', [0, 0.55, 1]], ['audio-reactivity', [0, 0.8, 1]], ['motion-rate', [0.25, 1, 2]],
    ['camera-float-amount', [0, 0.6, 1]], ['camera-float-speed', [0.25, 0.7, 2]], ['orbit-intensity', [0, 0.35, 1]],
  ]) {
    const outputs = []
    for (const value of values) {
      await reset(); await set('rotate-cubes', true); await set('camera-motion', true); await set('orbit-camera', true)
      await set(suffix, value); await step('bass', 0.2); await step('bass', 0.2)
      outputs.push((await capture(`temporal-${suffix}-${value}`)).pixels)
    }
    assert(!outputs[0].equals(outputs[2]), `${suffix}: min/max have no visible effect at equal transport time`)
    temporalControls.push({ suffix, values, equalTimeMinMaxPixelDifference: true })
  }
  const durations = []
  for (const duration of ['0.5', '1', '2', '4']) {
    await reset(); await set('motion-amount', 0); await set('pattern', 'stack'); await set('motion-amount', 1)
    await set('transition-length', duration); await set('pattern', 'orbit'); await step('silence', 0.2)
    durations.push({ duration, instances: await gpu() })
    await capture(`transition-duration-${duration}`)
  }
  for (let i = 1; i < durations.length; i++) assert.notDeepEqual(durations[i].instances, durations[i - 1].instances, 'Transition Length has no timing consumer')

  const duplicateEvents = []
  for (const trigger of ['beat', 'kick', 'snare', 'downbeat', 'beat2', 'beat4', 'bar', 'bar4', 'bar8', 'phrase', 'drop']) {
    const profile = ['beat2', 'beat4'].includes(trigger) ? 'beat' : ['bar4', 'bar8'].includes(trigger) ? 'bar' : trigger
    const runs = []
    for (const replay of [false, true]) {
      await reset(); await set('trigger', trigger); await set('pattern-change', true)
      await step(profile, 0.05)
      if (replay) { await page.evaluate(() => window.__blockshiftAudio.replay()); await frames() }
      await step('silence', 0.6)
      runs.push(await gpu())
    }
    assert.deepEqual(runs[1], runs[0], `${trigger}: duplicate publication advanced the pattern twice`)
    duplicateEvents.push({ trigger, repeatedPublicationDoesNotDoubleAdvance: true })
  }

  // Manual selection remains authoritative while Pattern Change stays enabled and an event is held.
  await reset(); await set('trigger', 'kick'); await set('pattern-change', true); await step('kick', 0.05)
  await set('pattern', 'orbit'); await page.evaluate(() => window.__blockshiftAudio.replay()); await frames()
  await step('silence', 0.6)
  const manual = await gpu(), heldAuthoring = (await status()).authored
  await step('kick', 0.05); await step('silence', 0.6)
  assert.notDeepEqual(await gpu(), manual)
  assert.deepEqual((await status()).authored, heldAuthoring)

  await reset(); await set('rotate-cubes', true); await set('camera-motion', true); await set('orbit-camera', true); await set('atmosphere', true); await set('auto-performance', true)
  await step('build'); await step('drop'); await advance(1)
  const authored = (await status()).authored
  await page.evaluate(() => window.__blockshiftAudio.pause(true)); await frames()
  const stopped = await gpu(), stoppedCamera = (await status()).camera.camera
  await frames(8)
  assert.deepEqual(await gpu(), stopped); assert.deepEqual((await status()).camera.camera, stoppedCamera)
  await capture('transport-paused-atmosphere')
  await page.evaluate(() => window.__blockshiftAudio.pause(false)); await advance(0.4)
  assert.notDeepEqual(await gpu(), stopped)
  const transport = []
  for (const [kind, seconds, source] of [['seek-forward', 18, null], ['seek-backward', 3, null], ['loop-boundary', 0, null], ['track-swap', 0, 'p8-second-track']]) {
    await page.evaluate(([seconds, source]) => window.__blockshiftAudio.seek(seconds, source ?? undefined), [seconds, source]); await frames(5)
    assert.deepEqual((await status()).authored, authored)
    await advance(0.4)
    const diagnostics = await page.evaluate(() => window.__blockshiftAudio.diagnostics())
    assert.equal(diagnostics.engine.modules.failedModuleCount, 0); assert.equal(diagnostics.effects.failedEffectCount, 0); assert.equal(diagnostics.engine.render.failedPassCount, 0)
    assert(Object.values(await gpu()).every(data => data.every(Number.isFinite)))
    await capture(`transport-${kind}`)
    transport.push({ kind, authoredControlsPreserved: true, nativeAndEffectsHealthy: true })
  }

  // Restore a running atmosphere chain as well as the dry exact-pixel recovery tested in P7.
  await page.evaluate(() => { const gl = document.querySelector('canvas').getContext('webgl2'); window.__blockshiftP8Context = gl.getExtension('WEBGL_lose_context'); if (!window.__blockshiftP8Context) throw new Error('Context-loss extension unavailable'); window.__blockshiftP8Context.loseContext() })
  await page.waitForFunction(() => window.__blockshiftAudio.diagnostics().runtime.phase === 'context-lost')
  await page.evaluate(() => window.__blockshiftP8Context.restoreContext()); await ready(); await advance(0.4)
  assert.deepEqual((await status()).authored, authored)
  const recovered = await page.evaluate(() => window.__blockshiftAudio.diagnostics())
  await writeFile(path.join(output, 'atmosphere-context-diagnostics.json'), JSON.stringify(recovered, null, 2) + '\n')
  assert.equal(recovered.engine.modules.failedModuleCount, 0); assert.equal(recovered.effects.failedEffectCount, 0); assert.equal(recovered.engine.render.failedPassCount, 0)
  await capture('atmosphere-context-restored')
  for (const [aspect, width, height] of [['square', 720, 720], ['portrait', 540, 960], ['landscape', 960, 540]]) {
    await page.setViewportSize({ width, height }); await page.evaluate(([w, h]) => window.__blockshiftAudio.resize(w, h), [width, height]); await frames()
    assert.deepEqual(await page.locator('canvas').evaluate(el => [el.width, el.height]), [width, height])
    await capture(`atmosphere-live-resize-${aspect}`)
  }
  assert.deepEqual(errors, []); assert.deepEqual(await page.evaluate(() => window.__blockshiftAcceptanceGpu.errors), [])
  const video = page.video(); await page.close(); await video.saveAs(path.join(output, 'phase8-pattern-transport.webm'))
  const report = { result: 'PASS', filmstrips, temporalControls, transitionDurations: durations.map(d => d.duration), duplicateEvents, manualSelectionAndNextFreshEvent: true, transport, pausedGeometryAndCameraHold: true, resumeMoves: true, atmosphereContextRecovery: true, liveResize: ['square', 'portrait', 'landscape'], humanReview: 'PENDING', errors, fixture: 'Production catalog/runtime/GLBs and shared AudioFeatureBus. Explicit synthetic upstream publications and controlled host transport; loop is a backward transport jump, not an audio-player integration claim.' }
  await writeFile(path.join(output, 'phase8-acceptance.json'), JSON.stringify(report, null, 2) + '\n')
  return report
}

/* global window, WebGL2RenderingContext */
import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

export async function runBlockshiftLedAcceptance(browser, output) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: output, size: { width: 1280, height: 720 } } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    const locations = new WeakMap(), proto = WebGL2RenderingContext.prototype
    const originalLocation = proto.getUniformLocation, originalUniform = proto.uniform4fv
    const originalBuffer = proto.bufferSubData
    window.__blockshiftLeds = { values: [], instances: {}, gpuErrors: [], shaderFailures: 0 }
    proto.getUniformLocation = function (...args) { const result = originalLocation.apply(this, args); if (result) locations.set(result, args[1]); return result }
    proto.uniform4fv = function (...args) { if (locations.get(args[0]) === 'u_led[0]') window.__blockshiftLeds.values = Array.from(args[1]); return originalUniform.apply(this, args) }
    proto.bufferSubData = function (...args) { if (args[2] instanceof Float32Array && [12, 168].includes(args[2].length)) window.__blockshiftLeds.instances[args[2].length] = Array.from(args[2]); return originalBuffer.apply(this, args) }
    for (const method of ['getError', 'getShaderParameter']) {
      const original = proto[method]
      proto[method] = function (...args) { const value = original.apply(this, args); if (method === 'getError' && value !== 0 && value !== 0x9242) window.__blockshiftLeds.gpuErrors.push(value); if (method === 'getShaderParameter' && args[1] === this.COMPILE_STATUS && !value) window.__blockshiftLeds.shaderFailures++; return value }
    }
  })
  await page.goto('http://127.0.0.1:47981/src/test/browser/cinema2-blockshift-production.html?audio-fixture=1')
  const status = () => page.evaluate(() => window.__blockshiftAudio.status())
  const frames = async (count = 3) => { const target = (await status()).frames + count; await page.waitForFunction(target => { const s = window.__blockshiftAudio.status(); return s.frames >= target && s.time === s.targetTime }, target) }
  const set = async (suffix, value) => { await page.evaluate(([suffix, value]) => window.__blockshiftAudio.set(suffix, value), [suffix, value]); await frames() }
  const step = async (profile, seconds = 0.1) => { await page.evaluate(([profile, seconds]) => window.__blockshiftAudio.step(profile, seconds), [profile, seconds]); await frames() }
  const ready = async () => { await page.waitForFunction(() => window.__blockshiftAudio?.diagnostics().engine.modules.estimatedGpuBytes > 0); await frames(5) }
  const reset = async () => { await page.evaluate(() => window.__blockshiftAudio.reset()); await ready(); await page.evaluate(() => window.__blockshiftAudio.resize(1280, 720)); await frames(); await set('bpm-sync', false); await step('silence') }
  const capture = async name => ({ pixels: await sharp(await page.locator('canvas').screenshot({ path: path.join(output, `${name}.png`) })).removeAlpha().raw().toBuffer(), gpu: await page.evaluate(() => window.__blockshiftLeds), status: await status() })
  await ready(); await reset(); await set('motion-amount', 0); await set('audio-reactivity', 0); await set('bloom', 0)
  await capture('led-idle-bloom-off')
  await set('bloom', 0.3); await capture('led-idle-default')
  const profiles = []
  let kick, snare
  for (const profile of ['bass', 'mids', 'highs', 'vocals', 'build', 'kick', 'snare', 'downbeat', 'bar', 'phrase', 'section', 'drop']) {
    await reset(); await set('auto-performance', true)
    const authored = (await status()).authored
    await step(profile); await step(profile === 'build' ? 'build' : 'silence', 0.12)
    const on = await capture(`led-${profile}`)
    assert.equal(on.gpu.values.length, 720)
    assert(on.gpu.values.every(value => Number.isFinite(value) && value >= 0 && value <= 1))
    await set('audio-reactivity', 0)
    const off = await capture(`led-${profile}-audio-zero`)
    assert.notDeepEqual(on.gpu.values, off.gpu.values, `${profile}: shared signal has no LED consumer`)
    assert(!on.pixels.equals(off.pixels), `${profile}: no actual canvas change`)
    for (let i = 0; i < 180; i++) {
      assert(Math.abs(off.gpu.values[i * 4] - 0.36) < 1e-6)
      assert.deepEqual(off.gpu.values.slice(i * 4 + 1, i * 4 + 4), [0, 1, 0])
    }
    assert.equal(on.status.modules.failedModuleCount, 0); assert.deepEqual(on.status.choreography.diagnostics, [])
    // The only persistent difference was our explicit manual Audio Reactivity edit.
    await set('audio-reactivity', 1); assert.deepEqual((await status()).authored, authored)
    if (profile === 'kick') kick = on.gpu.values
    if (profile === 'snare') snare = on.gpu.values
    profiles.push({ profile, actualLedUniformsAndPixels: true, audioZeroSteady: true, authoredControlsPreserved: true })
  }
  assert.notDeepEqual(kick, snare)
  await reset(); await step('bass'); await step('bass', 0.25); await set('motion-amount', 0)
  const patterns = []
  for (const pattern of ['stack', 'orbit', 'stagger', 'split', 'wave', 'collapse']) {
    await set('pattern', pattern)
    const result = await capture(`led-pattern-${pattern}`)
    patterns.push({ pattern, circuits: result.gpu.values })
  }
  assert.equal(new Set(patterns.map(p => JSON.stringify(p.circuits))).size, 6)
  await set('motion-amount', 1); await step('build'); await step('build', 0.2)
  await page.evaluate(() => window.__blockshiftAudio.pause(true)); await frames()
  const paused = await capture('led-paused'); await frames(5)
  assert(paused.pixels.equals((await capture('led-paused-held')).pixels))
  await page.evaluate(() => window.__blockshiftAudio.pause(false)); await set('motion-amount', 0)
  const frozen = await capture('led-master-motion-zero'); await step('drop')
  assert(frozen.pixels.equals((await capture('led-master-motion-zero-held')).pixels))
  await set('audio-reactivity', 0); const zero = await capture('led-audio-zero-steady'); await step('highs')
  assert.deepEqual((await capture('led-audio-zero-held')).gpu.values, zero.gpu.values)
  await set('master-intensity', 0); await set('bloom', 1)
  assert(Math.max(...new Set((await capture('led-intensity-zero')).pixels)) <= 25)
  await page.evaluate(() => window.__blockshiftAudio.seek(0, 'led-new-source')); await frames()
  const d = await page.evaluate(() => window.__blockshiftAudio.diagnostics())
  assert.equal(d.engine.modules.failedModuleCount, 0); assert.equal(d.effects.failedEffectCount, 0)
  const probe = await page.evaluate(() => window.__blockshiftLeds)
  assert.deepEqual(probe.gpuErrors, []); assert.equal(probe.shaderFailures, 0); assert.deepEqual(errors, [])
  const video = page.video(); await page.close(); await video.saveAs(path.join(output, 'led-bars.webm'))
  const report = { result: 'PASS', bars: '180 stable axis/sign circuits on the supplied GLB frame triangles; 24 diffuser cells per normalized bar length', profiles, sixDistinctNativeLedPrograms: true, kickSnareDistinct: true, pauseAndMasterZeroFrozen: true, audioZeroSteady: true, intensityZeroHonored: true, sourceResetHealthy: true, errors, diagnostics: d, fixture: 'Production runtime, real GLBs, shared bridge/Director/choreography and shared pattern clock; explicit synthetic upstream audio profiles, no private musical detector' }
  await writeFile(path.join(output, 'led-acceptance.json'), JSON.stringify(report, null, 2) + '\n')
  return report
}

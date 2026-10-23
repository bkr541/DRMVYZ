/* global window, WebGL2RenderingContext */
import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

export async function runBlockshiftRefinementAcceptance(browser, output) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: output, size: { width: 1280, height: 720 } } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    window.__blockshiftRefineGpu = { instances: {}, errors: [] }
    for (const method of ['bufferData', 'bufferSubData', 'getError']) {
      const original = WebGL2RenderingContext.prototype[method]
      WebGL2RenderingContext.prototype[method] = function (...args) {
        const result = original.apply(this, args), data = args[method === 'bufferData' ? 1 : 2]
        if (data instanceof Float32Array && [12, 168].includes(data.length)) window.__blockshiftRefineGpu.instances[data.length] = Array.from(data)
        if (method === 'getError' && result !== 0 && result !== 0x9242) window.__blockshiftRefineGpu.errors.push(result)
        return result
      }
    }
  })
  await page.goto('http://127.0.0.1:47981/src/test/browser/cinema2-blockshift-production.html?audio-fixture=1')
  const status = () => page.evaluate(() => window.__blockshiftAudio.status())
  const frames = async (count = 4) => { const target = (await status()).frames + count; await page.waitForFunction(target => { const s = window.__blockshiftAudio.status(); return s.frames >= target && s.time === s.targetTime }, target) }
  const set = async (suffix, value) => { await page.evaluate(([suffix, value]) => window.__blockshiftAudio.set(suffix, value), [suffix, value]); await frames() }
  const step = async (profile, seconds = 0.2) => { await page.evaluate(([profile, seconds]) => window.__blockshiftAudio.step(profile, seconds), [profile, seconds]); await frames() }
  const poses = async () => Object.values(await page.evaluate(() => window.__blockshiftRefineGpu.instances)).flatMap(data => Array.from({ length: data.length / 12 }, (_, i) => ({ id: data[i * 12 + 11], position: data.slice(i * 12, i * 12 + 3), size: data[i * 12 + 3], rotation: data.slice(i * 12 + 8, i * 12 + 11) }))).sort((a, b) => a.id - b.id)
  const capture = async name => sharp(await page.locator('canvas').screenshot({ path: path.join(output, `${name}.png`) })).removeAlpha().raw().toBuffer()
  await page.waitForFunction(() => window.__blockshiftAudio?.diagnostics().engine.modules.estimatedGpuBytes > 0)
  await frames(5); await page.evaluate(() => window.__blockshiftAudio.resize(1280, 720)); await frames()
  await set('bpm-sync', false); await set('motion-amount', 0); await set('audio-reactivity', 0)
  const sizes = []
  for (const size of [1.35, 3, 6]) {
    await set('block-size', size); await capture(`size-${size}-dry`)
    const pose = await poses(), near = pose.find(b => b.id === 0)
    assert.equal(pose.length, 15); assert(Math.abs(near.size - size * 6) < 1e-5)
    sizes.push({ size, worldSize: near.size, nearPosition: near.position, apparentRatio: near.size / Math.hypot(...near.position) })
  }
  assert(sizes[2].apparentRatio > sizes[1].apparentRatio * 1.25, 'Larger size was canceled by scene-wide camera distance')
  await set('block-size', 2.2)
  const dry = await capture('bright-leds-atmosphere-off'), dryPoses = await poses()
  await set('atmosphere', true); await step('silence', 1); await frames(12)
  const wet = await capture('bright-leds-atmosphere-on')
  assert.deepEqual(await poses(), dryPoses, 'Atmosphere moved the cubes')
  let changedBackground = 0, changedColoredBackground = 0
  for (let i = 0; i < dry.length; i += 3) if (Math.max(dry[i], dry[i + 1], dry[i + 2]) < 35 && Math.max(...[0, 1, 2].map(c => Math.abs(wet[i + c] - dry[i + c]))) > 5) {
    changedBackground++
    if (Math.max(wet[i], wet[i + 1], wet[i + 2]) - Math.min(wet[i], wet[i + 1], wet[i + 2]) > 8) changedColoredBackground++
  }
  assert(changedBackground > 500 && changedColoredBackground > 100, 'No LED-colored atmospheric illumination outside geometry')
  await set('master-intensity', 0); await set('bloom', 1)
  assert(Math.max(...new Set(await capture('master-zero-atmosphere-on'))) <= 25)
  await set('master-intensity', 1); await set('bloom', 0.3)
  await set('atmosphere', false); await frames(5)
  assert(dry.equals(await capture('atmosphere-disabled-restored')), 'Atmosphere OFF did not restore the dry scene')
  await set('block-size', 1.8); await set('rotation-range', 0); await set('motion-amount', 1)
  await step('silence', 0.2)
  assert((await poses()).every(b => b.rotation.every(n => n === 0)))
  await set('rotate-cubes', true); await step('silence', 0.5)
  const first = await poses(); await capture('rotate-start')
  for (let i = 0; i < 10; i++) await step('silence', 0.25)
  const rotated = await poses(); await capture('rotate-varied-axes')
  assert(rotated.every((b, i) => b.rotation.some((n, a) => n !== first[i].rotation[a])))
  assert.equal(new Set(rotated.map(b => JSON.stringify(b.rotation))).size, 15)
  assert(rotated.some(b => b.rotation[0] > 0) && rotated.some(b => b.rotation[0] < 0))
  await set('rotate-cubes', false); const stopped = (await poses()).map(b => b.rotation)
  await step('silence', 0.5); assert.deepEqual((await poses()).map(b => b.rotation), stopped)
  await set('rotate-cubes', true); await page.evaluate(() => window.__blockshiftAudio.pause(true)); await frames()
  const paused = await poses(); await frames(8); assert.deepEqual(await poses(), paused)
  await page.evaluate(() => window.__blockshiftAudio.pause(false)); await set('motion-amount', 0)
  const frozen = await poses(); await step('drop'); assert.deepEqual(await poses(), frozen)
  await page.evaluate(() => window.__blockshiftAudio.seek(0, 'refinement-new-source')); await frames()
  assert((await poses()).every(b => b.rotation.every(n => n === 0)))
  // Maximum-size rotating view with fog active: the production native module must remain healthy.
  await set('block-size', 6); await set('atmosphere', true); await set('motion-amount', 1)
  for (let i = 0; i < 8; i++) await step('bass', 0.25)
  await capture('maximum-size-rotation-atmosphere')
  const diagnostics = await page.evaluate(() => window.__blockshiftAudio.diagnostics())
  assert.equal(diagnostics.engine.modules.failedModuleCount, 0); assert.equal(diagnostics.effects.failedEffectCount, 0); assert.equal(diagnostics.engine.render.failedPassCount, 0)
  assert.deepEqual(await page.evaluate(() => window.__blockshiftRefineGpu.errors), []); assert.deepEqual(errors, [])
  const video = page.video(); await page.close(); await video.saveAs(path.join(output, 'size-atmosphere-rotation.webm'))
  const report = { result: 'PASS', sizes, atmosphere: { changedBackground, changedColoredBackground, depthAware: true, masterZeroHonored: true, disabledRestoresExactPixels: true }, rotation: { all15Move: true, variedAxesAndDirections: true, offHoldsOrientation: true, pausedAndMasterZeroHeld: true, sourceReset: true }, diagnostics, errors, fixture: 'Real production module/GLBs, shared Threshold volumetric effect, synthetic upstream AudioFeatureBus profiles and existing beat clock; no private renderer or timer' }
  await writeFile(path.join(output, 'refinement-acceptance.json'), JSON.stringify(report, null, 2) + '\n')
  return report
}

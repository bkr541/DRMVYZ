/* global window, WebGL2RenderingContext */
import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

export async function runBlockshiftPerformanceAcceptance(browser, output) {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 }, recordVideo: { dir: output, size: { width: 960, height: 540 } } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    window.__blockshiftPerformanceInstances = {}
    for (const method of ['bufferData', 'bufferSubData']) {
      const original = WebGL2RenderingContext.prototype[method]
      WebGL2RenderingContext.prototype[method] = function (...args) {
        const data = args[method === 'bufferData' ? 1 : 2]
        if (data instanceof Float32Array && [12, 168].includes(data.length)) window.__blockshiftPerformanceInstances[data.length] = Array.from(data)
        return original.apply(this, args)
      }
    }
  })
  await page.goto('http://127.0.0.1:47981/src/test/browser/cinema2-blockshift-production.html?audio-fixture=1')
  await page.waitForFunction(() => window.__blockshiftAudio?.status().phase === 'running')
  const status = () => page.evaluate(() => window.__blockshiftAudio.status())
  const frames = async (count = 3) => { const target = (await status()).frames + count; await page.waitForFunction(target => { const s = window.__blockshiftAudio.status(); return s.frames >= target && s.time === s.targetTime }, target) }
  const set = async (suffix, value) => { await page.evaluate(([suffix, value]) => window.__blockshiftAudio.set(suffix, value), [suffix, value]); await frames() }
  const step = async (profile, seconds = 0.1) => { await page.evaluate(([profile, seconds]) => window.__blockshiftAudio.step(profile, seconds), [profile, seconds]); await frames() }
  const reset = async enabled => {
    await page.evaluate(() => window.__blockshiftAudio.reset()); await frames(5)
    await page.waitForFunction(() => window.__blockshiftPerformanceInstances[168] && window.__blockshiftPerformanceInstances[12])
    await set('bpm-sync', false); await set('auto-performance', enabled); await set('bloom', 0)
    await step('silence')
  }
  const capture = async name => ({ instances: await page.evaluate(() => window.__blockshiftPerformanceInstances), status: await status(), pixels: await sharp(await page.locator('canvas').screenshot({ path: name ? path.join(output, `${name}.png`) : undefined })).removeAlpha().raw().toBuffer() })
  const rgb = record => Object.values(record).flatMap(data => Array.from({ length: data.length / 12 }, (_, i) => data.slice(i * 12 + 4, i * 12 + 7)).flat())
  const scenarios = []
  for (const profile of ['build', 'drop']) {
    const runs = []
    for (const enabled of [false, true]) {
      await reset(enabled)
      const before = (await status()).authored
      await step(profile); await step(profile === 'drop' ? 'silence' : 'build', 0.2)
      const peak = await capture(`${profile}-auto-${enabled}-peak`)
      for (let i = 0; i < 24; i++) await step('silence')
      const settled = await capture(`${profile}-auto-${enabled}-settled`)
      assert.deepEqual(settled.status.authored, before, 'Automation mutated persistent controls')
      assert.deepEqual(settled.status.camera.camera.position, [0, 0, 0], 'Auto re-enabled camera movement')
      assert.equal(settled.status.modules.failedModuleCount, 0)
      assert.deepEqual(settled.status.choreography.diagnostics, [])
      runs.push({ peak, settled })
    }
    assert.notDeepEqual(runs[0].peak.instances, runs[1].peak.instances, `${profile}: Auto has no native transform effect`)
    assert(!runs[0].peak.pixels.equals(runs[1].peak.pixels), `${profile}: Auto has no visible effect`)
    assert.deepEqual(rgb(runs[0].peak.instances), rgb(runs[1].peak.instances), 'Auto rewrote authored hues')
    assert.deepEqual(runs[0].settled.instances, runs[1].settled.instances, 'Overlay did not restore the current moving base')
    scenarios.push({ profile, actualGpuAndPixelDifference: true, currentBaseRestored: true, persistedControlsAndHuesPreserved: true })
  }
  const takeovers = []
  for (const enabled of [false, true]) {
    await reset(enabled); await step('build'); await step('build')
    await set('pattern', 'wave'); await step('drop') // A fresh drop during the manual takeover cooldown must be consumed.
    await capture(`manual-wave-auto-${enabled}`)
    await step('build') // Fresh build during manual cooldown must be consumed, not queued.
    for (let i = 0; i < 12; i++) await step('build')
    const held = await capture(`manual-cooldown-auto-${enabled}`)
    assert.equal(held.status.authoredPattern, 'wave')
    await step('drop'); await step('silence', 0.2)
    takeovers.push({ held, fresh: await capture(`fresh-drop-after-manual-auto-${enabled}`) })
  }
  assert.deepEqual(takeovers[0].held.instances, takeovers[1].held.instances, 'A held build took back control after a manual edit/cooldown')
  assert.notDeepEqual(takeovers[0].fresh.instances, takeovers[1].fresh.instances, 'A genuinely new drop could not perform after cooldown')
  await reset(true); await step('build'); await step('build', 0.2)
  await page.evaluate(() => window.__blockshiftAudio.pause(true)); await frames()
  const paused = await capture('auto-paused'); await frames(4)
  assert(paused.pixels.equals((await capture('auto-paused-held')).pixels))
  await page.evaluate(() => window.__blockshiftAudio.pause(false)); await set('motion-amount', 0)
  const zero = await capture('auto-master-zero'); await step('drop')
  assert(zero.pixels.equals((await capture('auto-master-zero-held')).pixels), 'Master zero did not freeze physical automation')
  await set('audio-reactivity', 0)
  const audioZero = await capture('auto-audio-zero')
  assert.notDeepEqual(audioZero.instances, zero.instances, 'Audio zero did not remove the active audio/Auto overlay')
  await set('master-intensity', 0)
  const dark = await capture('auto-intensity-zero')
  assert(Math.max(...new Set(dark.pixels)) <= 25, 'Auto bypassed Master Intensity zero')
  await page.evaluate(() => window.__blockshiftAudio.seek(0, 'performance-new-source')); await frames()
  assert.equal((await status()).modules.failedModuleCount, 0)
  assert.deepEqual(errors, [])
  const video = page.video(); await page.close(); await video.saveAs(path.join(output, 'phase6-performance.webm'))
  const report = { result: 'PASS', scenarios, manualTakeoverAndCooldown: true, laterIndependentDropAccepted: true, pauseFrozen: true, masterZeroFrozen: true, audioZeroRemovesOverlay: true, masterIntensityZeroHonored: true, cameraOffHonored: true, bloomNotAuthored: true, errors, fixture: 'Production runtime/GLB rendering; synthetic upstream AudioFeatureBus build/drop profiles; shared Director and choreography, no private musical event injection' }
  await writeFile(path.join(output, 'performance-acceptance.json'), JSON.stringify(report, null, 2) + '\n')
  return report
}

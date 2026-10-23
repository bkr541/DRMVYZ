/* global window, WebGL2RenderingContext */
import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

export async function runBlockshiftAudioAcceptance(browser, output) {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 }, recordVideo: { dir: output, size: { width: 960, height: 540 } } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    window.__blockshiftAudioInstances = {}
    const proto = WebGL2RenderingContext.prototype
    for (const method of ['bufferData', 'bufferSubData']) {
      const original = proto[method]
      proto[method] = function (...args) {
        const data = args[method === 'bufferData' ? 1 : 2]
        if (data instanceof Float32Array && [12, 168].includes(data.length)) window.__blockshiftAudioInstances[data.length] = Array.from(data)
        return original.apply(this, args)
      }
    }
  })
  await page.goto('http://127.0.0.1:47981/src/test/browser/cinema2-blockshift-production.html?audio-fixture=1')
  const canvas = page.locator('canvas')
  const frames = async (count = 3) => {
    const target = await page.evaluate(count => window.__blockshiftAudio.status().frames + count, count)
    await page.waitForFunction(target => window.__blockshiftAudio.status().frames >= target && window.__blockshiftAudio.status().time === window.__blockshiftAudio.status().targetTime, target)
  }
  const set = (suffix, value) => page.evaluate(([suffix, value]) => window.__blockshiftAudio.set(suffix, value), [suffix, value])
  const step = async (profile, seconds = 0.05) => { await page.evaluate(([profile, seconds]) => window.__blockshiftAudio.step(profile, seconds), [profile, seconds]); await frames() }
  const reset = async () => {
    await page.evaluate(() => window.__blockshiftAudio.reset()); await frames(5)
    await page.waitForFunction(() => window.__blockshiftAudioInstances[168] && window.__blockshiftAudioInstances[12])
    await step('silence')
  }
  const capture = async name => {
    const png = await canvas.screenshot({ path: name ? path.join(output, `${name}.png`) : undefined })
    return { pixels: await sharp(png).removeAlpha().raw().toBuffer(), instances: await page.evaluate(() => window.__blockshiftAudioInstances), status: await page.evaluate(() => window.__blockshiftAudio.status()) }
  }
  await page.waitForFunction(() => window.__blockshiftAudio?.status().phase === 'running')
  const results = []
  let kick, snare
  for (const profile of ['silence', 'verse', 'bass', 'mids', 'highs', 'vocals', 'build', 'kick', 'snare', 'downbeat', 'bar', 'phrase', 'section', 'drop']) {
    await reset(); await step(profile)
    const reactive = await capture(`audio-${profile}`)
    await set('audio-reactivity', 0); await frames()
    const disabled = await capture(`audio-${profile}-off`)
    let changedPixels = 0
    for (let i = 0; i < reactive.pixels.length; i += 3) if ([0, 1, 2].some(c => Math.abs(reactive.pixels[i + c] - disabled.pixels[i + c]) > 2)) changedPixels++
    const transforms = payload => Object.values(payload).flatMap(data => Array.from({ length: data.length / 12 }, (_, i) => [...data.slice(i * 12, i * 12 + 4), ...data.slice(i * 12 + 8, i * 12 + 11)]))
    const physical = JSON.stringify(transforms(reactive.instances)) !== JSON.stringify(transforms(disabled.instances))
    if (profile !== 'silence') assert(changedPixels > 5, `${profile}: no audio-to-pixel response`)
    if (['bass', 'mids', 'build', 'kick', 'snare', 'downbeat', 'bar', 'phrase', 'section', 'drop'].includes(profile)) assert(physical, `${profile}: no physical audio response`)
    if (profile === 'kick') kick = transforms(reactive.instances)
    if (profile === 'snare') snare = transforms(reactive.instances)
    assert.deepEqual(reactive.status.choreography.diagnostics, [])
    assert.equal(reactive.status.modules.failedModuleCount, 0)
    results.push({ profile, changedPixels, physical })
  }
  assert.notDeepEqual(kick, snare, 'Kick and snare must have distinct spatial signatures')
  const triggers = []
  for (const trigger of ['beat', 'kick', 'snare', 'downbeat', 'beat2', 'beat4', 'bar', 'bar4', 'bar8', 'phrase', 'drop']) {
    const profile = ['beat2', 'beat4'].includes(trigger) ? 'beat' : ['bar4', 'bar8'].includes(trigger) ? 'bar' : trigger
    const runs = []
    for (const enabled of [false, true]) {
      await reset(); await set('audio-reactivity', 0); await set('trigger', trigger); await set('pattern-change', enabled); await frames()
      await step(profile); await step('silence', 0.6)
      const result = await capture(enabled ? `trigger-${trigger}` : undefined)
      assert.equal(result.status.authoredPattern, 'stagger', 'Music mutated the authored Pattern')
      runs.push(result)
    }
    assert.notDeepEqual(runs[0].instances, runs[1].instances, `${trigger}: switching ON has no actual GPU effect`)
    assert(!runs[0].pixels.equals(runs[1].pixels), `${trigger}: switching ON has no actual pixel effect`)
    triggers.push({ trigger, actualGpuAndPixelChange: true, authoredPatternPreserved: true })
  }
  await reset(); await step('kick')
  const before = await capture('kick-peak'); await step('silence', 0.25)
  const after = await capture('kick-decay')
  assert.notDeepEqual(before.instances, after.instances)
  await page.evaluate(() => window.__blockshiftAudio.pause(true)); await frames()
  const paused = await capture('audio-paused'); await frames(5)
  assert(paused.pixels.equals((await capture('audio-paused-held')).pixels))
  await page.evaluate(() => window.__blockshiftAudio.pause(false)); await set('motion-amount', 0); await frames()
  const zero = await capture('audio-motion-zero'); await step('bass')
  assert(zero.pixels.equals((await capture('audio-motion-zero-held')).pixels), 'Master zero must freeze music movement')
  await page.evaluate(() => window.__blockshiftAudio.seek(0, 'new-source')); await frames()
  const status = await page.evaluate(() => window.__blockshiftAudio.status())
  assert.equal(status.modules.failedModuleCount, 0)
  assert.deepEqual(errors, [])
  const renderer = await page.evaluate(() => { const gl = window.document.querySelector('canvas').getContext('webgl2'), debug = gl.getExtension('WEBGL_debug_renderer_info'); return debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) })
  const video = page.video(); await page.close(); await video.saveAs(path.join(output, 'phase5-audio.webm'))
  const report = { result: 'PASS', input: 'Explicit synthetic MusicIntelligenceFrame profiles published through AudioFeatureBus → shared audio bridge/choreography → native module → real GLB renderer; no audio file analysis claim', results, triggers, kickSnareDistinct: true, decayObserved: true, pauseFrozen: true, motionZeroFrozen: true, sourceResetHealthy: true, errors, rendering: renderer }
  await writeFile(path.join(output, 'audio-acceptance.json'), JSON.stringify(report, null, 2) + '\n')
  return report
}

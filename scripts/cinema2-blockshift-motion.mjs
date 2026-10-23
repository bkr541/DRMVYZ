/* global window, HTMLInputElement, WebGL2RenderingContext */
import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

export async function blockshiftCameraInspector(page, canvas, output, waitFrames) {
  await page.getByRole('tablist', { name: 'React right workspace panels' }).getByRole('tab', { name: 'DESIGN' }).evaluate(el => el.click())
  const control = suffix => page.locator(`[data-cinema2-control-id="blockshift-${suffix}"]`)
  await control('camera-motion').waitFor({ state: 'attached' })
  assert.equal(await control('orbit-camera').count(), 1)
  assert.equal(await control('orbit-intensity').count(), 0)
  await control('orbit-camera').getByRole('switch').evaluate(el => el.click())
  await waitFrames()
  assert.equal(await control('orbit-intensity').count(), 1)
  assert.match(await control('transition-length').innerText(), /1 beats/)
  assert.equal(await control('bloom').count(), 1)
  const numeric = async (suffix, value) => {
    await control(suffix).locator('input[type="range"]').evaluate((el, value) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(value))
      el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
    }, value)
    await waitFrames()
  }
  await numeric('orbit-intensity', 0.7)
  await control('camera-motion').getByRole('switch').evaluate(el => el.click())
  await waitFrames()
  assert.equal(await control('orbit-camera').count(), 0)
  assert.equal(await control('orbit-intensity').count(), 0)
  for (const suffix of ['camera-float-amount', 'camera-float-speed']) assert.equal(await control(suffix).count(), 0)
  const images = []
  for (const value of [60, 100]) {
    await numeric('camera-fov', value)
    images.push(await sharp(await canvas.screenshot({ path: path.join(output, `fov-${value}.png`) })).removeAlpha().raw().toBuffer())
  }
  let changed = 0
  for (let i = 0; i < images[0].length; i += 3) if ([0, 1, 2].some(c => Math.abs(images[0][i + c] - images[1][i + c]) > 2)) changed++
  assert(changed > 1000, 'FOV must visibly affect the idle production canvas')
  await numeric('camera-fov', 85)
  await control('camera-motion').getByRole('switch').evaluate(el => el.click())
  assert.equal(await control('orbit-camera').getByRole('switch').getAttribute('aria-checked'), 'true')
  assert.equal(await control('orbit-intensity').locator('input[type="range"]').inputValue(), '0.7')
  await numeric('camera-float-amount', 0.8); await numeric('camera-float-speed', 1.2)
  return { fovMinMaxChangedPixels: changed, conditionalControls: true, saved: { amount: 0.8, speed: 1.2, fov: 85 } }
}

export async function verifyBlockshiftCameraPersistence(page) {
  await page.getByRole('tablist', { name: 'React right workspace panels' }).getByRole('tab', { name: 'DESIGN' }).click()
  assert.equal(await page.locator('[data-cinema2-control-id="blockshift-orbit-camera"]').getByRole('switch').getAttribute('aria-checked'), 'true')
  for (const [suffix, value] of [['camera-float-amount', '0.8'], ['camera-float-speed', '1.2'], ['camera-fov', '85'], ['orbit-intensity', '0.7']]) {
    assert.equal(await page.locator(`[data-cinema2-control-id="blockshift-${suffix}"] input[type="range"]`).inputValue(), value)
  }
}

export async function runBlockshiftMotionAcceptance(browser, output) {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1, recordVideo: { dir: output, size: { width: 960, height: 540 } } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    window.__blockshiftLastInstances = null
    const original = WebGL2RenderingContext.prototype.bufferSubData
    WebGL2RenderingContext.prototype.bufferSubData = function (...args) {
      if (args[2] instanceof Float32Array && args[2].length === 168) window.__blockshiftLastInstances = Array.from(args[2])
      return original.apply(this, args)
    }
  })
  await page.goto('http://127.0.0.1:47981/src/test/browser/cinema2-blockshift-production.html?timing-fixture=1')
  await page.waitForFunction(() => window.__blockshiftTiming?.ready())
  const canvas = page.locator('[data-cinema2-output-canvas="true"]')
  const set = (suffix, value) => page.evaluate(([suffix, value]) => window.__blockshiftTiming.set(suffix, value), [suffix, value])
  const frames = async count => {
    const next = await page.evaluate(count => window.__blockshiftTiming.frames() + count, count)
    await page.waitForFunction(next => window.__blockshiftTiming.frames() >= next, next)
  }
  const capture = async name => sharp(await canvas.screenshot({ path: path.join(output, `${name}.png`) })).removeAlpha().raw().toBuffer()
  const poses = () => page.evaluate(() => window.__blockshiftLastInstances)
  const camera = () => page.evaluate(() => window.__blockshiftTiming.camera().camera)
  const patterns = []
  for (const name of ['stack', 'orbit', 'stagger', 'split', 'wave', 'collapse']) {
    await page.evaluate(() => window.__blockshiftTiming.reset({ bpm: 180, localSync: true, hostSync: false, motion: 1, rate: 2 }))
    await page.waitForFunction(() => window.__blockshiftTiming.ready() && window.__blockshiftTiming.frames() >= 4)
    await set('camera-motion', false); await set('pattern', name)
    await frames(16) // 1-beat selection blend has settled at this fixture's limited frame rate.
    const before = await poses(), a = await capture(`motion-${name}-a`), eye = await camera()
    await frames(8)
    const after = await poses(), b = await capture(`motion-${name}-b`)
    assert(before?.every(Number.isFinite) && after?.every(Number.isFinite))
    assert.notDeepEqual(before, after, `${name}: no actual GPU pose change`)
    assert(!a.equals(b), `${name}: no visible pixel movement`)
    assert.deepEqual((await camera()).viewProjectionMatrix, eye.viewProjectionMatrix, 'Disabled camera must stay stationary')
    patterns.push({ name, gpuMotion: true, pixelMotion: true, fixedCamera: true })
  }
  const transitions = []
  for (const [from, to] of [['stack', 'orbit'], ['split', 'collapse']]) {
    // Paused manual edit selects the starting pose immediately; resume uses normal shared timing.
    await page.evaluate(() => window.__blockshiftTiming.pause()); await frames(2)
    await set('pattern', from); await set('transition-length', '4'); await frames(2)
    await capture(`transition-${from}-${to}-start`)
    await page.evaluate(() => window.__blockshiftTiming.resume()); await frames(2)
    await set('pattern', to); await frames(3)
    const middle = await poses(); await capture(`transition-${from}-${to}-middle`)
    await frames(24)
    assert.notDeepEqual(await poses(), middle)
    await capture(`transition-${from}-${to}-end`)
    transitions.push({ from, to, durationBeats: 4, actualGpuAndPixelCaptures: true })
  }
  await set('camera-motion', true); await set('camera-float-amount', 1); await set('camera-float-speed', 2)
  await frames(3)
  const beforeCamera = await camera()
  await frames(12)
  const afterCamera = await camera()
  assert.notDeepEqual(afterCamera.position, beforeCamera.position)
  assert(Math.hypot(...afterCamera.position) < 1)
  await capture('floating-camera')
  await page.evaluate(() => window.__blockshiftTiming.pause()); await frames(3)
  const paused = await capture('paused'); await frames(5)
  assert(paused.equals(await sharp(await canvas.screenshot()).removeAlpha().raw().toBuffer()), 'Pause must freeze physical pixels including the camera')
  await set('camera-fov', 60); await frames(2)
  assert.equal((await camera()).fovDegrees, 60)
  await set('camera-motion', false); await frames(2)
  assert.deepEqual((await camera()).position, [0, 0, 0])
  await page.evaluate(() => window.__blockshiftTiming.resume()); await set('camera-fov', 85); await set('camera-motion', true); await set('motion-amount', 0)
  await frames(3)
  const zero = await capture('motion-zero'); await frames(5)
  assert(zero.equals(await sharp(await canvas.screenshot()).removeAlpha().raw().toBuffer()), 'Master zero must freeze actual pixels')
  assert.deepEqual((await camera()).position, [0, 0, 0])
  assert.deepEqual(errors, [])
  const video = page.video(); await page.close()
  await video.saveAs(path.join(output, 'phase4-motion.webm'))
  const report = { patterns, transitions, sharedCameraMoves: true, pausedFovWorks: true, cameraOffRestoresBase: true, pauseFrozen: true, masterZeroFrozen: true, errors, fixture: 'Production Cinema2Stage, standard host transport at 180 BPM; no analyzed audio or fabricated rhythm events', video: 'phase4-motion.webm' }
  await writeFile(path.join(output, 'motion-acceptance.json'), JSON.stringify(report, null, 2) + '\n')
  return report
}

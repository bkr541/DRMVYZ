/* global window */
import assert from 'node:assert/strict'
import path from 'node:path'
import { writeFile } from 'node:fs/promises'
import sharp from 'sharp'

export async function runBlockshiftOrbitAcceptance(browser, output) {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 }, recordVideo: { dir: output, size: { width: 960, height: 540 } } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('http://127.0.0.1:47981/src/test/browser/cinema2-blockshift-production.html?audio-fixture=1')
  await page.waitForFunction(() => window.__blockshiftAudio?.status().phase === 'running')
  const status = () => page.evaluate(() => window.__blockshiftAudio.status())
  const frames = async () => { const next = (await status()).frames + 3; await page.waitForFunction(next => { const s = window.__blockshiftAudio.status(); return s.frames >= next && s.time === s.targetTime }, next) }
  const set = async (suffix, value) => { await page.evaluate(([suffix, value]) => window.__blockshiftAudio.set(suffix, value), [suffix, value]); await frames() }
  const advance = async seconds => { for (let i = 0; i < Math.round(seconds / 0.2); i++) { await page.evaluate(() => window.__blockshiftAudio.step('silence', 0.2)); await frames() } }
  const capture = async name => {
    const camera = (await status()).camera.camera
    assert(Math.hypot(...camera.position) < 1, 'Orbit left the observer safe volume')
    assert(camera.viewProjectionMatrix.every(Number.isFinite))
    const png = await page.locator('canvas').screenshot({ path: path.join(output, `${name}.png`) })
    return { camera, pixels: await sharp(png).removeAlpha().raw().toBuffer() }
  }
  await frames(); await set('camera-motion', true); await set('orbit-camera', true); await set('orbit-intensity', 1)
  const start = await capture('orbit-front')
  const views = []
  for (const elapsed of [2, 4, 6, 8, 10, 12, 14, 16]) {
    await advance(2)
    const view = await capture(`orbit-${elapsed}s`)
    assert(!view.pixels.equals(start.pixels), 'Orbit did not visibly change the production output')
    views.push({ elapsed, position: view.camera.position, target: view.camera.target })
  }
  assert(views.some(view => view.target[2] > 0), 'Orbit did not reveal the rear field')
  await set('orbit-intensity', 0)
  const zero = await capture('orbit-speed-zero')
  await advance(2)
  const held = await capture('orbit-speed-zero-float-continues')
  const heading = camera => Math.atan2(camera.target[0] - camera.position[0], camera.target[2] - camera.position[2])
  const difference = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b))
  assert(Math.abs(difference(heading(held.camera), heading(zero.camera))) < 0.1, 'Zero orbit speed kept turning')
  assert.notDeepEqual(held.camera.position, zero.camera.position, 'Orbit replaced or stopped the existing float')
  await set('orbit-camera', false); await set('orbit-intensity', 1)
  const off = await capture('orbit-off'); await advance(2)
  assert(Math.abs(difference(heading((await status()).camera.camera), heading(off.camera))) < 0.1)
  await set('orbit-camera', true)
  await page.evaluate(() => window.__blockshiftAudio.pause(true)); await frames()
  const paused = await capture('orbit-paused'); await frames()
  assert(paused.pixels.equals((await capture('orbit-paused-held')).pixels))
  await set('camera-motion', false)
  assert.deepEqual((await status()).camera.camera.position, [0, 0, 0])
  assert.deepEqual((await status()).camera.camera.target, [0, 0, -10])
  assert.deepEqual(errors, [])
  const video = page.video(); await page.close(); await video.saveAs(path.join(output, 'orbit-camera.webm'))
  const report = { result: 'PASS', views, rearFieldVisible: true, intensityControlsAngularSpeed: true, zeroHoldsHeadingWithFloatContinuing: true, orbitOffHoldsHeading: true, pauseFrozen: true, parentOffRestoresBase: true, errors, fixture: 'Production catalog/runtime/GLB renderer with controlled host time, camera inside the field; synthetic silence bus fixture' }
  await writeFile(path.join(output, 'orbit-acceptance.json'), JSON.stringify(report, null, 2) + '\n')
  return report
}

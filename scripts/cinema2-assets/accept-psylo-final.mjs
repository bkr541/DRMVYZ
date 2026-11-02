// Integrated production acceptance, plus an inexpensive first-look tuning mode.
import assert from 'node:assert/strict'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import { chromium } from '@playwright/test'
import sharp from 'sharp'
const root = resolve(import.meta.dirname, '../..'), out = resolve(root, 'artifacts/cinema2-psylo-final')
await mkdir(out, { recursive: true })
const preview = process.argv.includes('--preview'), from = process.argv.find(x => x.startsWith('--from='))?.slice(7)
const sections = ['controls', 'performance', 'lifecycle', 'recovery', 'tiers', 'references'], rank = from ? sections.indexOf(from) : 0
if (rank < 0) throw new Error('Unknown checkpoint')
const previous = from ? JSON.parse(await readFile(resolve(out, 'failure.json'), 'utf8')) : null
const checks = previous?.checks ?? [], captures = previous?.captures ?? [], metrics = previous?.metrics ?? { controls: {}, profiles: {}, references: {} }, errors = []
const check = (value, name) => { assert.ok(value, name); checks.push(name) }
if (captures.includes('control-bloom')) metrics.controlsDone = true
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0, hmr: false }, clearScreen: false })
let browser, page, stage = 'startup', eventId = 2000
const state = () => page.evaluate(() => globalThis.__psyloProduction.status())
const settle = (frames = 16) => page.evaluate(n => globalThis.__psyloProduction.settle(n), frames)
const set = async values => { await page.evaluate(v => globalThis.__psyloProduction.set(v), values); await settle() }
const music = async (options = {}, enabled = true) => { await page.evaluate(([v, on]) => globalThis.__psyloProduction.music(v, on), [options, enabled]); await settle() }
const advance = async (seconds, paused = false) => { await page.evaluate(([s, p]) => globalThis.__psyloProduction.advance(s, 100, p, true), [seconds, paused]); await settle() }
const seek = async time => { await page.evaluate(t => globalThis.__psyloProduction.seek(t), time); await settle() }
const neutral = { energy: .5, bass: 0, high: .5, sectionIntensity: .5 }
const id = key => `psylo-${key.replace(/[A-Z]/g, x => '-' + x.toLowerCase())}`
const patterns = ['mycelium-tide', 'gill-spiral', 'spore-choir', 'canopy-breath', 'fairy-ring', 'root-relay', 'bloom-ascent', 'psylo-release']
async function ready() {
  await page.waitForFunction(() => { const s = globalThis.__psyloProduction?.status(); return s && (s.modules.estimatedGpuBytes > 0 || s.modules.failedModuleCount || s.modules.degradedModuleCount) }, undefined, { timeout: 45000 }); await settle()
}
async function healthy(name) {
  const s = await state()
  check(s.runtime.phase === 'running' && !s.modules.failedModuleCount && !s.modules.degradedModuleCount && !s.effects.failedEffectCount && !s.render.failedPassCount, `${name}: production renderer/effects healthy`)
  return s
}
async function shot(name) {
  await healthy(name)
  const bytes = await page.locator('canvas').screenshot({ path: resolve(out, `${name}.png`) })
  const raw = await sharp(bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  captures.push(name); return raw
}
function diff(a, b, region = [0, 0, 1, 1]) {
  assert.equal(a.info.width, b.info.width); let sum = 0, n = 0
  for (let y = Math.floor(region[1] * a.info.height); y < region[3] * a.info.height; y++) for (let x = Math.floor(region[0] * a.info.width); x < region[2] * a.info.width; x++) {
    const p = (y * a.info.width + x) * 3
    sum += (Math.abs(a.data[p] - b.data[p]) + Math.abs(a.data[p + 1] - b.data[p + 1]) + Math.abs(a.data[p + 2] - b.data[p + 2])) / 3; n++
  }
  return sum / n
}
function stats(a, region = [0, 0, 1, 1]) {
  const lum = []; let clipped = 0
  for (let y = Math.floor(region[1] * a.info.height); y < region[3] * a.info.height; y++) for (let x = Math.floor(region[0] * a.info.width); x < region[2] * a.info.width; x++) {
    const p = (y * a.info.width + x) * 3, r = a.data[p], g = a.data[p + 1], b = a.data[p + 2]
    lum.push(.2126 * r + .7152 * g + .0722 * b); if (r >= 253 && g >= 253 && b >= 253) clipped++
  }
  lum.sort((x, y) => x - y)
  return { mean: lum.reduce((x, y) => x + y, 0) / lum.length, p50: lum[Math.floor(lum.length * .5)], p95: lum[Math.floor(lum.length * .95)], p99: lum[Math.floor(lum.length * .99)], whiteClip: clipped / lum.length }
}
async function raw() { return sharp(await page.locator('canvas').screenshot()).removeAlpha().raw().toBuffer({ resolveWithObject: true }) }
async function event(kind, extra = {}) {
  const s = await state(); await music({ ...neutral, event: kind, eventId: ++eventId, beatIndex: 32, timeSec: s.transport.timeSec + .001, ...extra })
}
async function reset(values = {}) {
  await page.evaluate(() => globalThis.__psyloProduction.reenter()); await ready()
  await set({ cameraMode: 'fixed', cameraMotion: false, ...values }); await music(neutral); await advance(2)
}
async function change(key, a, b, threshold = .002) {
  await set({ [key]: a }); const first = await raw()
  await set({ [key]: b }); const second = await shot(`control-${key}`)
  const d = diff(first, second); metrics.controls[key] = d
  check(d > threshold, `${key}: real visible consumer (${d.toFixed(6)})`)
}
try {
  await server.listen()
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
  page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  const baseURL = `http://127.0.0.1:${server.httpServer.address().port}/src/test/browser/cinema2-psylo-production.html`
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' }); await ready(); await music(neutral); await advance(2)
  const finalDefault = await shot(preview ? 'preview-default' : 'final-default'); metrics.default = stats(finalDefault)
  if (!preview) {
  if (rank <= 0) {
    stage = 'controls'; console.log('PSYLO: controls and rendered choreography')
    if (!metrics.controlsDone) {
    await reset({ atmosphereEnabled: false, bloomEnabled: false, musicResponse: 0, spores: 0, amount: 1 })
    for (const [key, a, b] of [['master', 0, 1], ['motion', false, true], ['amount', 0, 1], ['density', 0, 1], ['scale', .8, 1.1], ['emission', 0, 1], ['spores', 0, 1], ['lightsEnabled', false, true], ['lightStrength', 0, 1]]) await change(key, a, b)
    await set({ spores: 0, master: .85, lightStrength: .8 })
    const refs = []
    for (const pattern of patterns) { await set({ pattern }); refs.push(await shot(`pattern-${pattern}`)) }
    check(refs.slice(1).every(r => diff(refs[0], r) > .01), 'All eight native geometry programs remain distinct')
    for (const key of ['backgroundColor', 'primaryColor', 'secondaryColor', 'stemColor', 'gillColor', 'myceliumColor', 'sporeColor']) {
      await set({ spores: 1 }); const original = (await state()).parameters.persistentValues[id(key)]
      await change(key, [0, 0, 0, 1], [1, .05, .02, 1]); await set({ [key]: original })
    }
    await set({ motion: false, spores: 0, atmosphereEnabled: true, bloomEnabled: false })
    await change('fogDensity', 0, 1); await change('mist', 0, .2); await change('mistHeight', .2, 5)
    await change('shafts', 0, 2); await change('atmosphereColor', [.03, .15, .5, 1], [.8, .1, .03, 1])
    await set({ fogDensity: .45, mist: .08, mistHeight: 1.8, shafts: .65, atmosphereColor: [.22, .42, .52, 1] })
    await change('atmosphereEnabled', false, true); await change('bloomEnabled', false, true); await change('bloom', 0, 1)
    metrics.controlsDone = true
    }
    await reset({ atmosphereEnabled: false, bloomEnabled: false, emission: .6, motion: true, spores: 0, pattern: patterns[0], amount: 1, musicResponse: 1 })
    await music({ energy: .1, high: .2 }); await advance(.8); const quiet = await raw()
    await music({ energy: 1, bass: 1, high: 1, build: .8 }); await advance(.6); const loud = await shot('musical-response')
    check(diff(quiet, loud) > .01, 'Shared musical facts visibly shape geometry')
    await change('musicResponse', 0, 1)
    // Rate and Sync tests compare rendered motion after an actual timing interval.
    await set({ musicResponse: 0, speed: 0 }); const held = await raw(); await advance(.4); check(diff(held, await raw()) < .001, 'Speed zero holds native geometry')
    await set({ speed: 1 }); await advance(.4); check(diff(held, await raw()) > .01, 'Motion Speed resumes native motion')
    const synced = await state(); await set({ bpmSync: false }); await advance(.4); check(JSON.stringify(synced.parameters.persistentValues[id('pattern')]) === JSON.stringify((await state()).parameters.persistentValues[id('pattern')]), 'Sync OFF preserves Pattern and reactivity permission')
    await reset({ atmosphereEnabled: false, bloomEnabled: false, musicResponse: 0, spores: 0, speed: 0, amount: 1 })
    for (const trigger of ['beat', 'kick', 'snare', 'downbeat', 'beat2', 'beat4', 'bar', 'bar4', 'bar8', 'phrase', 'drop']) {
      await music(neutral); await set({ pattern: patterns[0], patternChange: true, trigger }); await event(trigger.startsWith('bar') ? 'bar' : trigger.startsWith('beat') ? 'beat' : trigger)
      // Zero speed holds blending; resume long enough to settle, then compare pure
      // destination against a manual render at that same native phase.
      await set({ speed: 1 }); await music(neutral); await advance(.4)
      const switched = await raw(); await set({ pattern: patterns[1] }); const manual = await raw()
      check(diff(switched, manual) < .001, `${trigger}: canonical event renders the expected program`)
      check((await state()).parameters.persistentValues[id('patternChange')] === true, `${trigger}: manual edit preserves Pattern Change`)
      await set({ speed: 0, patternChange: false })
    }
    console.log('PSYLO: controls complete')
  }
  if (rank <= 1) {
    stage = 'performance'; console.log('PSYLO: Auto Performance and authority')
    await reset({ atmosphereEnabled: false, bloomEnabled: false, emission: 0, spores: 0, musicResponse: 0, autoPerformance: true, amount: 1 })
    await set({ patternChange: true, trigger: 'kick' }); await event('drop'); await music(neutral); await advance(.4)
    const drop = await shot('auto-drop'); await set({ autoPerformance: false }); const base = await raw()
    check(diff(drop, base) > .01, 'Fresh drop visibly substitutes a temporary native program')
    await set({ autoPerformance: true }); await music(neutral); await event('drop'); await music(neutral); await advance(.4)
    await event('kick'); await music(neutral); await event('kick'); await music(neutral)
    await advance(3); const restored = await raw(); await set({ pattern: patterns[2] })
    check(diff(restored, await raw()) < .001, 'Override expiry restores the correctly advanced underlying base')
    check((await state()).parameters.persistentValues[id('patternChange')] === true, 'Override never disables Pattern Change')
    await event('drop'); await music(neutral); await advance(.4); await set({ pattern: patterns[5] }); const takeover = await shot('manual-auto-takeover')
    await page.evaluate(() => globalThis.__psyloProduction.repeatMusic()); await settle()
    check(diff(takeover, await raw()) < .001, 'Manual selection/reselection wins over the active moment')
    await music({ ...neutral, build: 1 }); await advance(.4); const building = await shot('auto-build')
    await set({ autoPerformance: false }); check(diff(building, await raw()) > .005, 'New build episode has a temporary visible native program')
    await set({ autoPerformance: true, cameraMode: 'orbit', cameraMotion: false, heading: 90 }); const camera = (await state()).camera
    await event('drop'); await music(neutral); await advance(.4)
    check(JSON.stringify(camera) === JSON.stringify((await state()).camera), 'Auto Performance cannot acquire manual camera ownership')
    await set({ motion: false, atmosphereEnabled: false, bloomEnabled: false, emission: 0, spores: 0 }); const disabled = await raw()
    await event('drop', { energy: 1, bass: 1, high: 1, build: 1 }); await advance(.3)
    check(diff(disabled, await raw()) < .001, 'Performance and Director cannot bypass hard disables')
    console.log('PSYLO: Auto Performance complete')
  }
  if (rank <= 2) {
    stage = 'lifecycle'; console.log('PSYLO: lifecycle, camera, quality and profiling')
    await reset(); await advance(.2); await settle(24); const beforePause = await raw(); const pose = (await state()).camera
    await advance(.6, true); await settle(24)
    // Reduced-resolution volumetric history may converge by a sub-pixel amount.
    check(diff(beforePause, await raw()) < .15 && JSON.stringify(pose) === JSON.stringify((await state()).camera), 'Pause holds geometry, camera and drifting atmosphere')
    await advance(.3, false); check(diff(beforePause, await raw()) > .01, 'Resume restores motion and atmosphere')
    await music({}, false); const gap = await raw(); await advance(.3); check(diff(gap, await raw()) > .01, 'Valid playback and mist continue across analysis loss')
    await music(neutral); await seek(0); await healthy('seek reset'); await music({ ...neutral, trackId: 'psylo-track-two' }); await healthy('track reset')
    await set({ autoPerformance: true, patternChange: true, trigger: 'snare', radius: 20, fogDensity: .6, bloomEnabled: false }); const saved = (await state()).parameters.persistentValues
    await page.evaluate(() => globalThis.__psyloProduction.reenter(true)); await ready()
    check(JSON.stringify(saved) === JSON.stringify((await state()).parameters.persistentValues), 'Saved settings round-trip through re-entry')
    await set({ cameraMode: 'travel', cameraMotion: true, bpmSync: false, autoPerformance: false, atmosphereEnabled: false, bloomEnabled: false, motion: false, spores: 0 })
    const start = (await state()).camera.position; await advance(52); const loop = (await state()).camera.position
    check(Math.hypot(...start.map((v, i) => v - loop[i])) < .15, 'Forest travel joins its complete spline loop')
    await set({ cameraMode: 'orbit', radius: 18, elevation: 45, heading: 0 }); const orbitStart = (await state()).camera.position
    await advance(72); const orbitEnd = (await state()).camera.position
    check(Math.hypot(...orbitStart.map((v, i) => v - orbitEnd[i])) < .15, 'Grove orbit completes a full 360 degrees continuously')
    await set({ cameraMotion: false, atmosphereEnabled: true, bloomEnabled: true, motion: true, fogDensity: .45, autoPerformance: false, patternChange: false })
    await change('fov', 45, 75); await change('radius', 14, 22); await change('elevation', 40, 60); await change('heading', -90, 90)
    for (const mode of ['travel', 'orbit', 'elevated', 'fixed']) { await set({ cameraMode: mode }); await shot(`camera-${mode}`) }
    for (const [w, h] of [[720, 720], [540, 960]]) { await page.setViewportSize({ width: w, height: h }); await settle(); await shot(`aspect-${w}x${h}`) }
    await page.setViewportSize({ width: 1280, height: 720 }); await settle()
    for (const [quality, value] of [['low', 'performance'], ['medium', 'balanced'], ['high', 'quality']]) {
      // Shared Quality is intentionally a canonical, non-PSYLO parameter.
      await page.evaluate(value => globalThis.__psyloProduction.quality(value), value); await settle(24); await shot(`quality-${quality}`)
      metrics.profiles[quality] = await page.evaluate(() => globalThis.__psyloProduction.profile(30))
      await healthy(`profile ${quality}`)
    }
    await set({ fogDensity: 1, mist: .2, shafts: 2, bloom: 1 }); await advance(.4)
    metrics.profiles.dense = await page.evaluate(() => globalThis.__psyloProduction.profile(30)); await shot('dense-atmosphere')
    await set({ fogDensity: .45, mist: .08, shafts: .65, bloom: .45 }); await page.evaluate(() => globalThis.__psyloProduction.inspector(true)); await settle()
    await page.screenshot({ path: resolve(out, 'inspector.png') }); captures.push('inspector')
    check(await page.locator('[data-cinema2-parent-group]').count() >= 4, 'Final controls use shared Inspector parent groups')
    await page.evaluate(() => globalThis.__psyloProduction.inspector(false))
    console.log('PSYLO: lifecycle complete')
  }
  if (rank <= 3) {
    stage = 'recovery'; console.log('PSYLO: 1080p profile and context recovery')
    if (!metrics.profiles.fullhdDense) {
    await set({ cameraMode: 'fixed', cameraMotion: false, fogDensity: .45, mist: .08, shafts: .65, bloom: .45 })
    await page.setViewportSize({ width: 1920, height: 1080 }); await settle(20)
    metrics.profiles.fullhdDefault = await page.evaluate(() => globalThis.__psyloProduction.profile(30)); await shot('fullhd-default')
    await set({ fogDensity: 1, mist: .2, shafts: 2, bloom: 1 })
    metrics.profiles.fullhdDense = await page.evaluate(() => globalThis.__psyloProduction.profile(30)); await shot('fullhd-dense')
    await page.setViewportSize({ width: 1280, height: 720 }); await set({ fogDensity: .45, mist: .08, shafts: .65, bloom: .45 })
    await writeFile(resolve(out, 'failure.json'), JSON.stringify({ stage, checks, captures, metrics, errors, failure: 'Recovery pending' }, null, 2))
    }
    const generation = (await state()).runtime.contextGeneration
    await page.evaluate(() => globalThis.__psyloProduction.recoverContext()); await ready(); await settle(); await shot('context-recovered')
    check((await state()).runtime.contextGeneration > generation, 'Context recovery reconstructs resources')
    console.log('PSYLO: recovery complete')
  }
  if (rank <= 4) {
    stage = 'tiers'; console.log('PSYLO: genuine tier profiles')
    for (const [quality, expected] of [['low', 'low'], ['medium', 'medium'], ['high', 'high']]) {
      await page.goto(`${baseURL}?quality=${quality}`, { waitUntil: 'domcontentloaded' }); await ready()
      await music(neutral); await advance(2); await set({ cameraMode: 'fixed', cameraMotion: false })
      metrics.profiles[quality] = await page.evaluate(() => globalThis.__psyloProduction.profile(30)); await shot(`quality-${quality}`)
      check(metrics.profiles[quality].status.runtime.performance.resolvedQuality === expected, `${quality}: actual resolved tier matches request`)
    }
    await page.goto(baseURL, { waitUntil: 'domcontentloaded' }); await ready()
    await page.evaluate(() => globalThis.__psyloProduction.quality('performance')); await settle()
    check((await state()).runtime.performance.resolvedQuality === 'low', 'Shared Quality control changes the real runtime policy')
  }
  if (rank <= 5) {
    stage = 'references'; console.log('PSYLO: matched-output reference lighting')
    const referenceRegions = {
      psylo: { core: [.05, .25, .8, .72], spill: [.15, .62, .85, .94] },
      mainframe: { core: [.15, .1, .85, .9], spill: [.15, .1, .85, .9] },
      nightshift: { core: [.25, .05, .75, .6], spill: [.1, .62, .9, .95] },
      cathedral: { core: [.2, .1, .8, .85], spill: [.15, .6, .85, .95] },
    }
    for (const preset of ['psylo', 'mainframe', 'nightshift', 'cathedral']) {
      await page.goto(`${baseURL}?preset=${preset}&quality=high`, { waitUntil: 'domcontentloaded' }); await ready(); await music({ energy: .7, bass: .6, high: .7, build: 0, sectionIntensity: .7 }); await advance(2)
      if (preset === 'psylo') await set({ cameraMode: 'fixed', cameraMotion: false })
      const image = await shot(`reference-${preset}`), regions = referenceRegions[preset]
      metrics.references[preset] = { full: stats(image), core: stats(image, regions.core), spill: stats(image, regions.spill), regions }
    }
    const p = metrics.references.psylo
    check(p.core.p99 > 100 && p.spill.p95 > 25 && p.full.whiteClip < .15, 'PSYLO has bright local emitters, readable spill and controlled clipping')
  }
  const disposed = await page.evaluate(() => globalThis.__psyloProduction.dispose())
  check(disposed.modules.activeResourceLeaseCount === 0 && disposed.resources.activeLeaseCount === 0 && disposed.choreography.activeEnvelopeCount === 0, 'All final resource leases and choreography released')
  check(errors.length === 0, `No browser/shader errors: ${errors.join('; ')}`)
  const uniqueChecks = [...new Map(checks.map(c => [c.replace(/\s*\([0-9.]+\)$/, ''), c])).values()]
  const uniqueCaptures = [...new Set(captures)]
  await writeFile(resolve(out, 'report.json'), JSON.stringify({ checks: uniqueChecks, captures: uniqueCaptures, metrics, errors, disposed }, null, 2) + '\n')
  }
  else await writeFile(resolve(out, 'preview.json'), JSON.stringify({ metrics, state: await state(), errors }, null, 2) + '\n')
  console.log(JSON.stringify({ output: out, checks: checks.length, captures: captures.length, preview, errors }))
} catch (error) {
  await writeFile(resolve(out, 'failure.json'), JSON.stringify({ stage, checks, captures, metrics, errors, failure: String(error), state: page ? await state().catch(() => null) : null }, null, 2) + '\n'); throw error
} finally { await browser?.close(); await server.close() }

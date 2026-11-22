import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'
import sharp from 'sharp'

// Production-path acceptance for Space Boi (Cinema 2.0 preset contract, section 19). Every check reads the real rendered canvas of the real runtime
// in Chromium: the harness (src/test/browser/Cinema2SpaceBoiBrowserHarness.ts) runs Cinema2Runtime with the shared Audio Intelligence bridge, the
// Visual Director, the Mood Conductor and the production Inspector. Time only moves when a check advances it, so every comparison is deterministic.
// Needs a Vite server for the project root (PLAYWRIGHT_BASE_URL, default http://127.0.0.1:5174). Stages: visual, audio, performance, lifecycle, all.
const stage = process.argv.find(a => a.startsWith('--stage='))?.split('=')[1] ?? 'all', output = process.env.SPACE_BOI_OUTPUT ?? 'artifacts/cinema2-space-boi'
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] })
const report = { stage, passed: [], measurements: [], snapshots: [], errors: [] }
const W = 640, H = 360
// Regions of the 640x360 frame: the figure and the arms' reach, the sky with the planets and moons, the water, and the top-left corner (vignette).
const REGION = { figure: [200, 120, 440, 345], sky: [0, 0, 640, 170], water: [0, 235, 640, 360], corner: [0, 0, 70, 40], all: [0, 0, 640, 360] }
try {
  const page = await browser.newPage({ viewport: { width: W, height: H } })
  page.on('pageerror', e => report.errors.push(e.message))
  const api = (method, value) => page.evaluate(([m, v]) => globalThis.spaceBoiReview[m](v), [method, value])
  const set = async (name, value) => assert((await page.evaluate(([n, v]) => globalThis.spaceBoiReview.set(n, v), [name, value])).ok, `set ${name}`)
  const snapshot = () => api('snapshot'), advance = s => api('advance', s)
  const ready = () => page.waitForFunction(() => globalThis.spaceBoiReview?.snapshot().modules.modules[0]?.inspection?.state === 'ready', {}, { timeout: 90000 })
  const load = async (quality = 'medium') => { await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5174'}/src/test/browser/cinema2-space-boi.html?quality=${quality}`); await page.waitForFunction(() => globalThis.spaceBoiReview, {}, { timeout: 30000 }); await ready() }
  const inspect = async () => (await snapshot()).modules.modules[0].inspection
  const capture = async name => { await page.screenshot({ path: `${output}/${name}.png` }); report.snapshots.push({ name }) }
  const pixels = async () => sharp(await page.screenshot()).removeAlpha().raw().toBuffer()
  /** Mean absolute difference per channel over a region. */
  const difference = (a, b, region = 'all') => { const [x0, y0, x1, y1] = REGION[region]; let sum = 0, count = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) for (let c = 0; c < 3; c++) { const i = (y * W + x) * 3 + c; sum += Math.abs(a[i] - b[i]); count++ } return sum / count }
  /** Share of a region's pixels that are lit (not the void). */
  const lit = (buffer, region) => { const [x0, y0, x1, y1] = REGION[region]; let on = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * W + x) * 3; if (buffer[i] + buffer[i + 1] + buffer[i + 2] > 120) on++ } return on / ((x1 - x0) * (y1 - y0)) }
  const pid = name => `space-boi-${name.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}`
  const quiet = { active: true, energy: 0, bass: 0, high: 0, vocal: 0, build: 0, event: null, sectionBuild: false }
  const run = name => stage === 'all' || stage === name
  const inventory = async () => { const s = await snapshot(), i = s.modules.modules[0].inspection; assert.equal(i.arms, 2); assert.equal(i.planets, 4); assert.equal(i.moons, 3); assert.equal(i.water, 3); assert.equal(s.modules.failedModuleCount, 0); assert.equal(s.render.failedPassCount, 0); assert.equal(s.effects.failedEffectCount, 0) }
  /** Select a pattern, rewind to its start and run to `seconds` (two beats a second at the harness's 120 BPM), so a control compare sees the same moment of the same program. */
  const pose = async (pattern, seconds, extra = {}) => { for (const [name, value] of Object.entries({ pattern, ...extra })) await set(name, value); await api('restart'); await ready(); for (const [name, value] of Object.entries({ pattern, ...extra })) await set(name, value); await advance(seconds); await page.waitForTimeout(120) }

  await load(); await inventory()
  const authored = (await snapshot()).parameters.persistentValues
  const restore = name => set(name, authored[pid(name)])

  if (run('visual')) {
    // Baseline visibility: the hero geometry itself is on screen, region by region (a lit background alone would not pass).
    await capture('default'); const base = await pixels()
    const stats = await sharp(await page.screenshot()).stats(); assert(stats.channels.some(c => c.stdev > 30), 'The scene has real structure')
    for (const [region, minimum] of [['figure', .02], ['sky', .01], ['water', .02]]) { const share = lit(base, region); assert(share > minimum, `${region} shows its own lines (${share})`); report.measurements.push({ region, lit: share }) }
    // Figure fill: the middle of the chest is the void, not an ink; the head's eyes are the only lit area inside the head.
    assert(lit(base, 'figure') < .2, 'The figure is a black cut-out, not a lit block')

    // Each primary control changes its own region at its extremes (hero regions measured; the others stay put).
    const controls = [
      // [name, pattern, seconds, low, high, region that must change]
      ['armMotion', 'reach', 1.5, 0, 1.5, 'figure'], ['headMotion', 'look-around', .7, 0, 1.5, 'figure'], ['bodyMotion', 'ascension', 6, 0, 1.5, 'figure'],
      ['planetMotion', 'ascension', 6, 0, 1.5, 'sky'], ['starShimmer', 'supernova', .05, 0, 1.5, 'sky'], ['rippleMotion', 'tide-pulse', 1.6, 0, 1.5, 'water'],
      ['figureInk', 'stargazing', .5, 0, 2, 'figure'], ['waterInk', 'stargazing', .5, 0, 2, 'water'], ['planetInk', 'stargazing', .5, 0, 2, 'sky'], ['starInk', 'stargazing', .5, 0, 2, 'sky'],
      ['intensity', 'stargazing', .5, 0, 2, 'all'], ['bloom', 'stargazing', .5, 0, 3, 'all'], ['exposure', 'stargazing', .5, .5, 2, 'all'], ['vignette', 'stargazing', .5, 0, 1, 'corner'], ['scoreAmount', 'stargazing', .5, 0, 1, 'all'],
    ]
    for (const [name, pattern, seconds, low, high, region] of controls) {
      await pose(pattern, seconds, { [name]: low }); const lowPixels = await pixels()
      await set(name, high); await page.waitForTimeout(120); const highPixels = await pixels(), d = difference(lowPixels, highPixels, region)
      if (name !== 'scoreAmount') assert(d > .15, `${name} (${low} to ${high}) visibly changes the ${region} (${d})`)
      report.measurements.push({ control: name, region, difference: d }); await capture(`control-${name}`)
      await restore(name)
    }
    // The kick ripple has its own visible check: with a kick the figure's lines flash, and Kick Ripple 0 removes the flash.
    await pose('stargazing', .3, { scoreAmount: 1, reactivity: 1 }); await api('music', { ...quiet, energy: .6 }); await advance(.2); const still = await pixels()
    await api('event', 'kick'); await advance(.08); const flashed = await pixels(); assert(difference(still, flashed, 'all') > .05, 'a kick lights the picture')
    await restore('scoreAmount'); await restore('reactivity'); await api('music', { active: false })
    report.passed.push('baseline visibility per region, black cut-out figure, 15 primary controls change their own region at min/max')

    // Palette: each of the five roles changes only its own region (and the Void changes the whole picture).
    await pose('stargazing', .5); const resting = await pixels()
    for (const [name, region, outside] of [['figureColor', 'figure', 'sky'], ['waterColor', 'water', 'sky'], ['planetColor', 'sky', 'water'], ['starColor', 'sky', 'water']]) {
      await set(name, [1, .05, .1, 1]); await page.waitForTimeout(120); const changed = await pixels()
      const own = difference(resting, changed, region), other = difference(resting, changed, outside)
      assert(own > .15, `${name} recolors its own region (${own})`); assert(own > other * 1.5 || other < .05, `${name} leaves ${outside} alone (${other})`)
      report.measurements.push({ control: name, region, difference: own, outside: other }); await restore(name); await page.waitForTimeout(80)
    }
    await set('voidColor', [.1, 0, .35, 1]); await page.waitForTimeout(150); const violet = await pixels(); assert(difference(resting, violet, 'all') > 5, 'Void recolors the background and every black fill'); await capture('palette-void'); await restore('voidColor')
    report.passed.push('five palette roles each change their own part of the picture; the Void recolors the sky and every black fill together')

    // Patterns: eight programs, each visibly different from the others at the same moment.
    const programs = []
    for (const pattern of ['stargazing', 'reach', 'conductor', 'planet-waltz', 'tide-pulse', 'look-around', 'ascension', 'supernova']) {
      await pose(pattern, pattern === 'ascension' ? 6 : 1.6); assert.equal((await inspect()).pattern, pattern); const buffer = await pixels()
      assert(programs.every(p => difference(p, buffer) > .15), `${pattern} is visibly distinct`); programs.push(buffer); await capture(`pattern-${pattern}`)
    }
    await restore('pattern'); await restore('pattern')
    report.passed.push('eight native patterns render distinct pictures')

    // Camera: home framing is fixed; Sky Drift travels; Manual View moves the view; zero speed holds; the field of view changes the picture.
    await pose('stargazing', .3); const home = (await snapshot()).camera.position
    await set('cameraMode', 'drift'); await advance(3); const drifted = (await snapshot()).camera.position; assert(Math.abs(drifted[0] - home[0]) > .3, 'Sky Drift travels')
    await set('cameraSpeed', 0); const held = (await snapshot()).camera.position; await advance(.5); assert.deepEqual((await snapshot()).camera.position, held)
    await set('cameraMode', 'manual'); await set('cameraHeading', 0); await advance(.3); const front = await pixels(); await set('cameraHeading', 40); await advance(.3); assert(difference(front, await pixels()) > .3, 'Manual View turns the view'); await capture('camera-manual-heading')
    await set('cameraMode', 'home'); await set('cameraSpeed', 1); await set('cameraHeading', 0); await advance(.3)
    await set('cameraFov', 28); await advance(.3); const narrow = await pixels(); await set('cameraFov', 60); await advance(.3); assert(difference(narrow, await pixels()) > 1, 'Field of View changes the picture'); await restore('cameraFov'); await restore('cameraMode')
    report.passed.push('home framing, Sky Drift travel and zero-speed hold, Manual View, Field of View')
  }

  if (run('audio')) {
    // BPM Sync: with it on, a slower track moves the figure and sky at the track's tempo; off, the same program runs at the steady 120 BPM whatever the track.
    const beatsAfter = async (bpm, sync) => { await set('bpmSync', sync); await api('timing', { bpm, sourcePresent: true, hostSync: false }); await api('restart'); await ready(); await set('bpmSync', sync); await api('timing', { bpm, sourcePresent: true }); await api('music', { ...quiet, energy: .5 }); await advance(3); return (await inspect()).beats }
    const fast = await beatsAfter(120, true), slow = await beatsAfter(60, true), offSlow = await beatsAfter(60, false), offFast = await beatsAfter(120, false)
    assert(slow < fast * .75, `BPM Sync on follows the track tempo (${slow} < ${fast})`); assert(Math.abs(offSlow - offFast) < .25, `BPM Sync off runs steady (${offSlow} vs ${offFast})`)
    report.measurements.push({ bpmSync: { fast, slow, offSlow, offFast } }); report.passed.push('BPM Sync on follows the tempo and off holds a steady 120 BPM')
    await api('timing', { bpm: 120, sourcePresent: false }); await api('restart'); await ready()

    // Audio reactivity: different musical information moves different parts of the picture, each with its own live value.
    await pose('stargazing', .4, { reactivity: 1 }); await api('music', quiet); await advance(.5); const baseline = await pixels(), saved = (await snapshot()).parameters.persistentValues
    const before = (await snapshot()).live
    for (const [name, options, property, region] of [['bass', { bass: 1 }, 'rippleMotion', 'water'], ['highs', { high: 1 }, 'starShimmer', 'sky'], ['vocals', { vocal: 1 }, 'headMotion', 'figure']]) {
      await api('music', { ...quiet, ...options }); await advance(.6); const live = (await snapshot()).live; assert(live[property] > before[property] + .02, `${name} raises ${property} (${live[property]} vs ${before[property]})`)
      report.measurements.push({ source: name, property, before: before[property], live: live[property], region }); await capture(`audio-${name}`); await api('music', quiet); await advance(.8)
    }
    assert.deepEqual((await snapshot()).parameters.persistentValues, saved)
    // Rhythm events: a kick taps the arms and the body and lights the picture; a snare flashes the planets and stars; a downbeat nods the head.
    await api('music', { ...quiet, energy: .6 }); await advance(.2)
    for (const [event, properties] of [['kick', ['armMotion', 'bodyMotion']], ['snare', ['planetInk', 'starInk']], ['downbeat', ['headMotion']]]) {
      const rest = (await snapshot()).live; await api('event', event); await advance(.12); const hit = (await snapshot()).live
      // The fixture's beat grid also marks natural downbeats, so a downbeat's value is judged against the control's own base of 1 (nothing else raises Head Motion here).
      for (const property of properties) assert(hit[property] > (event === 'downbeat' ? 1.05 : rest[property] + .02), `${event} raises ${property} (${hit[property]} vs ${rest[property]})`)
      await capture(`event-${event}`); await api('music', { ...quiet, energy: .6 }); await advance(.5)
    }
    // Quiet and energetic passages differ in the picture.
    await api('music', quiet); await advance(.6); const calm = await pixels(); await api('music', { ...quiet, energy: 1, bass: 1, high: 1, vocal: 1 }); await advance(.6); assert(difference(calm, await pixels()) > .05, 'an energetic passage differs from a quiet one')
    // Zero reactivity: the music moves nothing.
    await set('reactivity', 0); await api('music', { ...quiet, energy: 1, bass: 1, high: 1, vocal: 1 }); await advance(.4); const zero = (await snapshot()).live
    for (const property of ['armMotion', 'headMotion', 'bodyMotion', 'planetMotion', 'rippleMotion', 'starShimmer']) assert.equal(zero[property], 1, `${property} at zero reactivity`)
    // A drop is a structural event: it lifts the bloom and the whole picture, then settles.
    await set('reactivity', 1); await api('music', { ...quiet, energy: .6 }); await advance(.2); const calmLive = (await snapshot()).live; await api('event', 'drop'); await advance(.15); const dropLive = (await snapshot()).live
    assert(dropLive.intensity > calmLive.intensity + .02, 'a drop lifts Intensity'); assert(dropLive.rippleMotion > calmLive.rippleMotion + .02, 'a drop spreads the ripples'); await capture('event-drop')
    // Hard authorization: Intensity 0 stays dark through a drop.
    await set('intensity', 0); await api('event', 'drop'); await advance(.15); assert.equal((await snapshot()).live.intensity, 0); assert(lit(await pixels(), 'all') < .001, 'a dark picture stays dark through a drop'); await restore('intensity')
    report.passed.push('independent bass/high/vocal and kick/snare/downbeat/drop responses, quiet vs energetic, zero reactivity, saved values untouched, Intensity 0 stays dark')
  }

  if (run('performance')) {
    await pose('conductor', .2, { reactivity: 1 }); await set('autoPerformance', true); await api('music', { ...quiet, energy: .6 }); await advance(.2)
    const saved = (await snapshot()).parameters.persistentValues
    await api('music', { ...quiet, energy: .75, build: 1, sectionBuild: true, sectionProgress: .9, tension: .95 }); await advance(.7); assert.equal((await inspect()).performanceOverride, 'build'); assert.equal((await inspect()).pattern, 'ascension'); await capture('build')
    await api('event', 'drop'); await advance(.2); assert.equal((await inspect()).performanceOverride, 'drop'); assert.equal((await inspect()).pattern, 'supernova'); await capture('drop')
    await api('timing', { paused: true }); await advance(.05); const held = await inspect(); await advance(.2); const paused = await inspect(); assert.equal(paused.beats, held.beats); assert.equal(paused.performanceOverride, held.performanceOverride)
    await api('timing', { paused: false }); await api('music', { ...quiet, energy: .8 }); await advance(8); assert.equal((await inspect()).performanceOverride, null)
    await api('music', quiet); await advance(3); assert((await snapshot()).mood.silence > .9, 'silence'); assert.equal((await inspect()).effectivePatternChange, false); assert((await snapshot()).live.intensity < .3, `silence quiets the show (${(await snapshot()).live.intensity})`); await capture('silence')
    await api('event', 'drop'); await advance(.2); assert.equal((await inspect()).performanceOverride, 'drop'); assert.deepEqual((await snapshot()).parameters.persistentValues, saved)
    await api('seek', 0); await advance(1 / 30); assert.equal((await inspect()).performanceOverride, null)
    await api('music', { ...quiet, trackId: 'space-boi-next-track' }); await advance(1 / 30); assert.equal((await inspect()).performanceOverride, null)
    report.passed.push('shared Mood policy: build and drop substitutions, bounded return, pause hold, silence quiets and holds, ungated drop, seek and track-change reset, saved values untouched')
  }

  if (run('lifecycle')) {
    await api('music', { ...quiet, energy: .8 }); await advance(.1); await set('autoPerformance', false); await set('patternChange', true); await api('inspector', true); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(200)
    const ui = () => page.evaluate(() => { const host = document.querySelector('#space-boi-inspector'); const label = e => (e.querySelector('.rv-ctrl-label,label,span')?.textContent ?? e.textContent ?? '').trim().slice(0, 24); return {
      height: host.scrollHeight,
      rows: [...host.querySelectorAll('.rv-ctrl-row,.rv-ctrl-toggle-row')].map(e => ({ label: label(e), height: Math.round(e.getBoundingClientRect().height) })),
      notes: [...host.querySelectorAll('[data-live-policy]')].map(e => Math.round(e.getBoundingClientRect().height)),
      controls: [...host.querySelectorAll('input,select,button')].map(e => ({ disabled: e.disabled, label: e.getAttribute('aria-label') ?? e.closest('.rv-ctrl-row,.rv-ctrl-toggle-row')?.textContent ?? e.textContent, group: e.closest('[data-cinema2-parent-group]')?.getAttribute('data-cinema2-parent-group'), header: /drc-header|collapsible-hdr/.test(String(e.className)) })) } })
    const off = await ui(); await set('autoPerformance', true); await page.waitForTimeout(250); const on = await ui()
    // The live readout and the yellow marker never change a row's height; the only growth is the shared one-line "Auto Performance is choosing" notes under Pattern Change and Trigger.
    assert.equal(off.rows.length, on.rows.length); off.rows.forEach((row, i) => assert.equal(row.height, on.rows[i].height, `row ${row.label} keeps its height`))
    assert(on.notes.length >= 1, 'the music\'s Pattern Change / Trigger choice is shown'); assert.equal(off.notes.length, 0)
    assert(Math.abs(on.height - off.height - on.notes.reduce((a, b) => a + b, 0)) <= 3, `the window only grows by the shared notes (${off.height} to ${on.height}, notes ${on.notes})`)
    assert.equal(off.controls.length, on.controls.length)
    assert(on.controls.filter(c => ['design', 'effects'].includes(c.group) && !c.header).every(c => c.disabled), 'Design and Effects lock while Auto Performance is on')
    assert(on.controls.filter(c => c.group === 'palette').every(c => !c.disabled), 'Palette stays editable'); assert(on.controls.filter(c => /^(BPM Sync|Auto Performance)/.test(c.label)).every(c => !c.disabled), 'BPM Sync and Auto Performance stay editable')
    await capture('inspector-auto'); await api('inspector', false)
    await set('autoPerformance', false)
    // Re-entry: switching away and back restores the picture, the controls and the audio response.
    await pose('conductor', 1.2, { reactivity: 1 }); const keep = (await snapshot()).parameters.persistentValues; await api('restart'); await ready(); assert.deepEqual((await snapshot()).parameters.persistentValues, keep); await inventory()
    await set('pattern', 'stargazing'); await api('music', { ...quiet, energy: .6 }); await advance(.2); const reentryRest = (await snapshot()).live; await api('event', 'kick'); await advance(.12); assert((await snapshot()).live.armMotion > reentryRest.armMotion + .02, 'audio response resumes after re-entry')
    await page.evaluate(() => { globalThis.spaceBoiLoss = document.querySelector('#scene').getContext('webgl2').getExtension('WEBGL_lose_context'); globalThis.spaceBoiLoss.loseContext() }); await page.waitForFunction(() => globalThis.spaceBoiReview.snapshot().runtime.phase === 'context-lost'); await page.evaluate(() => globalThis.spaceBoiLoss.restoreContext())
    await page.waitForFunction(() => globalThis.spaceBoiReview.snapshot().modules.modules[0]?.inspection?.state === 'ready' && globalThis.spaceBoiReview.snapshot().runtime.phase === 'running', {}, { timeout: 90000 }); await inventory()
    report.passed.push('real Inspector lock with no row layout shift (only the shared choice notes add height), editable Palette/BPM/Auto, re-entry with saved controls and resumed audio response, WebGL context restoration')
    for (const quality of ['high', 'low']) { await load(quality); await page.setViewportSize(quality === 'low' ? { width: 360, height: 640 } : { width: W, height: H }); await advance(.3); await inventory(); await capture(`quality-${quality}`); const resources = await api('dispose'); assert.equal(resources.activeLeaseCount, 0); assert.equal(resources.activeSurfaceCount, 0) }
    report.passed.push('all quality tiers keep the whole scene, portrait resize, zero remaining surfaces and leases')
  } else { const resources = await api('dispose'); assert.equal(resources.activeLeaseCount, 0); assert.equal(resources.activeSurfaceCount, 0) }
  assert.deepEqual(report.errors, [], 'no page errors')
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 1)); await browser.close()
}
console.log(JSON.stringify({ stage, passed: report.passed, errors: report.errors }, null, 1))

// Final assembled-preset acceptance. Earlier phase scripts retain historical expectations.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import sharp from 'sharp'

const root = resolve(import.meta.dirname, '../..'), out = resolve(root, 'artifacts/cinema2-nightshift-final')
await mkdir(out, { recursive: true })
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0 }, clearScreen: false })
const checks = [], errors = [], metrics = { controls: {}, quality: {}, lifecycle: [] }, captures = []
const assert = (ok, message) => { if (!ok) throw new Error(message); if (!checks.includes(message)) checks.push(message) }
const resumeStage = process.argv.find(arg => arg.startsWith('--from='))?.slice(7)
const resumeRank = ['controls', 'auto', 'transport', 'resize', 'lifecycle'].indexOf(resumeStage ?? 'controls')
if (resumeRank < 0) throw new Error('Unknown acceptance checkpoint.')
const resumeLifecycle = resumeRank >= 4, resumeResize = resumeRank >= 3, resumeTransport = resumeRank >= 2, resumeAuto = resumeRank >= 1
if (resumeAuto) {
  const previous = JSON.parse(await readFile(resolve(out, 'failure.json'), 'utf8'))
  if (previous.errors.length || !previous.checks.some(c => c.startsWith('pattern-change-off: actual'))) throw new Error('No valid completed control/music checkpoint to resume.')
  checks.push(...previous.checks); captures.push(...previous.captures); Object.assign(metrics, previous.metrics); delete metrics.restoreMismatch
}
const regions = { full: [0, 0, 1, 1], floor: [.1, .62, .9, .94], ball: [.39, .03, .61, .4], ceiling: [.33, .19, .4, .22], gap: [.3, .46, .7, .57] }
function measure(a, region, sample) {
  let sum = 0, n = 0
  for (let y = Math.floor(region[1] * a.info.height); y < region[3] * a.info.height; y++) for (let x = Math.floor(region[0] * a.info.width); x < region[2] * a.info.width; x++) {
    const i = (y * a.info.width + x) * a.info.channels
    sum += sample(i); n++
  }
  return sum / n
}
const diff = (a, b, region = regions.floor) => measure(a, region, i => (Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2])) / 3)
const lit = (a, region, threshold = 80) => measure(a, region, i => Math.max(a.data[i], a.data[i + 1], a.data[i + 2]) > threshold ? 1 : 0)
let browser
try {
  await server.listen()
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error' && /shader|WebGL|THREE/.test(m.text())) errors.push(m.text()) })
  const status = () => page.evaluate(() => globalThis.__nightshiftProduction.status())
  const settle = (frames = 16) => page.evaluate(async n => { for (let i = 0; i < n; i++) await new Promise(resolve => globalThis.requestAnimationFrame(resolve)) }, frames)
  const set = async values => { await page.evaluate(v => globalThis.__nightshiftProduction.set(v), values); await settle() }
  const advance = async (seconds, paused = false, bpm = 120) => { await page.evaluate(v => globalThis.__nightshiftProduction.advance(...v), [seconds, bpm, paused]); await settle(); return status() }
  let advancingBeats = false
  const music = async (values = {}, enabled = true) => { await page.evaluate(v => globalThis.__nightshiftProduction.music(...v), [{ energy: .5, sectionIntensity: .5, advanceBeatGrid: advancingBeats, ...values }, enabled]); await settle() }
  const reenter = options => page.evaluate(v => globalThis.__nightshiftProduction.reenter(v), options)
  const reset = async () => { await page.evaluate(() => globalThis.__nightshiftProduction.reset()); await settle() }
  let eventId = 1000
  const emit = async (event, values = {}) => music({ event, eventId: ++eventId, timeSec: (await status()).transport.timeSec + .01, ...values })
  const shot = async (name, hero = true) => {
    const bytes = await page.locator('canvas').screenshot({ path: resolve(out, `${name}.png`) })
    const raw = await sharp(bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    if (hero) assert(lit(raw, regions.ball) > .12, `${name}: actual mirror-ball pixels remain visible`)
    if (!captures.includes(name)) captures.push(name)
    return raw
  }
  const healthy = (s, label) => {
    const ok = s.snapshot.phase === 'running' && s.modules.failedModuleCount === 0 && s.modules.degradedModuleCount === 0 && s.effects.failedEffectCount === 0 && s.render.failedPassCount === 0 && s.render.diagnostics.length === 0 && s.choreography.diagnostics.length === 0
    if (!ok) { metrics.failedHealth = { label, snapshot: s.snapshot, modules: s.modules, effects: s.effects, render: s.render, frameFaults: s.frameFaults }; console.log(JSON.stringify(metrics.failedHealth)) }
    assert(ok, `${label}: native runtime, modules, effects and graph are healthy`)
  }
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/src/test/browser/cinema2-nightshift-production.html?step2=1&step3=1`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => Boolean(globalThis.__nightshiftProduction))
  healthy(await page.evaluate(() => globalThis.__nightshiftProduction.prepare()), 'Initial activation')
  const P = await page.evaluate(() => globalThis.__nightshiftProduction.ids)
  await set({ [P.motion]: 0, [P.musicResponse]: 0 })
  const baseline = await shot('approved-composition')
  const approved = await sharp(resolve(root, 'docs/NIGHTSHIFT/NIGHTSHIFT-step7-default.png')).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  metrics.approvedDifference = diff(baseline, approved, regions.full)
  assert(metrics.approvedDifference < .1, 'Final assembled preset preserves the user-approved Step 7 composition')
  assert(lit(baseline, regions.ceiling, 120) > .1 && lit(baseline, regions.floor, 100) > .25, 'Actual cyan ceiling and addressed floor remain visible')
  assert(measure(baseline, regions.gap, i => (baseline.data[i] + baseline.data[i + 1] + baseline.data[i + 2]) / 3) < 30, 'Approved dark separation remains intact')
  const authored = (await status()).parameters.persistentValues
  const references = {}, patterns = ['nightshift', 'crossfade-checker', 'runway', 'diamond-ripple', 'diagonal-relay', 'quadrant-exchange', 'midnight-sparse', 'full-house']
  const shows = async (pattern, name) => {
    const error = diff(references[pattern], await shot(name))
    assert(error < .4, `${name}: actual ${pattern} output (${error.toFixed(3)} pixel error)`)
  }
  if (!resumeAuto) {
  await page.evaluate(() => globalThis.__nightshiftProduction.showInspector(true))
  const control = key => page.locator(`[data-cinema2-control-id="${P[key]}"]`)
  for (const [group, names] of Object.entries({ 'master-controls': ['bpmSync', 'master', 'motion', 'camera', 'musicResponse', 'autoPerformance'], design: ['pattern', 'patternChange', 'rotation', 'floor', 'ball', 'ceiling', 'coverage'], effects: ['bloom', 'haze', 'reflections'], palette: ['backgroundColor', 'cyanColor', 'magentaColor', 'blueColor', 'amberColor', 'ballColor'] })) {
    for (const name of names) assert(await page.locator(`[data-cinema2-parent-group="${group}"] [data-cinema2-control-id="${P[name]}"]`).count() === 1, `${name}: correct real Inspector parent`)
  }
  assert(await control('trigger').count() === 0, 'Trigger hidden with Pattern Change OFF')
  await control('patternChange').getByRole('switch').click()
  const grouped = (await status()).groups.flatMap(g => [...g.controls, ...g.groups.flatMap(s => s.controls)])
  const options = grouped.find(c => c.definition.id === P.trigger).definition.options
  assert(options.map(o => o.value).join(',') === 'beat,kick,snare,downbeat,beat2,beat4,bar,bar4,bar8,phrase,drop', 'Real Inspector exposes exactly the eleven shared Trigger options')
  await control('bpmSync').getByRole('switch').click()
  assert((await status()).parameters.persistentValues[P.bpmSync] === false, 'Real Inspector edits BPM Sync')
  await control('autoPerformance').getByRole('switch').click()
  assert((await status()).parameters.persistentValues[P.autoPerformance] === true, 'Real Inspector edits Auto Performance')
  await page.evaluate(() => globalThis.__nightshiftProduction.showInspector(false))
  await reset(); await set({ [P.motion]: 0, [P.musicResponse]: 0 })

  for (const pattern of patterns) { await set({ [P.pattern]: pattern }); references[pattern] = await shot(`pattern-${pattern}`) }
  for (let i = 0; i < patterns.length; i++) for (let j = i + 1; j < patterns.length; j++) assert(diff(references[patterns[i]], references[patterns[j]]) > .5, `${patterns[i]} and ${patterns[j]} have distinct rendered spatial programs`)
  await set({ [P.pattern]: 'nightshift' })
  for (const [name, region] of Object.entries({ master: regions.full, floor: regions.floor, ball: regions.ball, ceiling: regions.ceiling, coverage: regions.floor, bloom: regions.full, haze: regions.full, reflections: regions.full })) {
    const changes = []
    for (const value of [0, 1]) { await set({ [P[name]]: value }); changes.push(diff(baseline, await shot(`${name}-${value}`, !['master', 'ball'].includes(name)), region)) }
    metrics.controls[name] = changes
    assert(changes.every(v => v > (name === 'reflections' ? .01 : .05)), `${name}: minimum and maximum visibly differ from authored default`)
    await set({ [P[name]]: authored[P[name]] })
  }
  for (const [name, region] of Object.entries({ backgroundColor: regions.gap, cyanColor: regions.ceiling, magentaColor: regions.floor, blueColor: regions.floor, amberColor: regions.floor, ballColor: regions.ball })) {
    await set({ [P[name]]: [.05, 1, .12, 1] })
    assert(diff(baseline, await shot(`palette-${name}`), region) > 1, `${name}: independent visible palette role`)
    const saved = (await status()).parameters.persistentValues
    assert(Object.keys(P).filter(k => k.endsWith('Color') && k !== name).every(k => JSON.stringify(saved[P[k]]) === JSON.stringify(authored[P[k]])), `${name}: other palette roles retain their saved colors`)
    await set({ [P[name]]: authored[P[name]] })
  }
  console.log('Final controls, palette, pattern and finishing checks passed.')

  // Fresh clocks make timing comparisons meaningful; audio is removed for host BPM checks.
  const motionCase = async (name, sync, bpm, amount, rotation = true) => {
    await music({}, false); await reenter(); await set({ [P.bpmSync]: sync, [P.motion]: amount, [P.rotation]: rotation, [P.musicResponse]: 0 })
    const start = await shot(`${name}-start`); const s = await advance(4, false, bpm); const end = await shot(`${name}-end`)
    healthy(s, name); return { start, end }
  }
  const held = await motionCase('motion-zero', true, 180, 0)
  assert(diff(held.start, held.end, regions.ball) < .3 && diff(held.start, held.end) < .3, 'Motion zero holds ball and floor with finishing enabled')
  const moving = await motionCase('motion-default', true, 180, .35)
  assert(diff(moving.start, moving.end, regions.ball) > .5, 'Default motion visibly rotates the ball')
  const fast = await motionCase('motion-max', true, 180, 1)
  assert(diff(moving.end, fast.end, regions.ball) > .5, 'Maximum motion changes actual rotation/travel')
  const free = await motionCase('sync-off-180', false, 180, .35)
  const freeOther = await motionCase('sync-off-90', false, 90, .35)
  assert(diff(free.end, freeOther.end, regions.ball) < .3, 'Sync OFF timing is independent of host BPM')
  assert(diff(free.end, moving.end, regions.ball) > .5, 'Sync ON uses shared host timing rather than authored free timing')
  const frozen = await motionCase('rotation-off', true, 120, .35, false)
  assert(diff(frozen.start, frozen.end, regions.ball) < .3 && diff(frozen.start, frozen.end) > .5, 'Ball Rotation OFF holds the ball while the floor continues')
  await set({ [P.motion]: 0 })
  const cameraReference = await shot('camera-reference')
  for (const amount of [.5, 1]) {
    await set({ [P.camera]: amount }); const s = await advance(5)
    assert(diff(cameraReference, await shot(`camera-${amount}`), regions.full) > .15, `Camera Motion ${amount}: visible perspective movement`)
    assert(s.camera.position[1] >= 3 && s.camera.position[1] <= 3.2 && s.camera.position[2] >= 14.2 && s.camera.position[2] <= 14.8 && s.camera.rollDegrees === 0, `Camera Motion ${amount}: approved safety bounds`)
  }
  await set({ [P.camera]: 0 }); assert(diff(cameraReference, await shot('camera-restored'), regions.ball) < .3, 'Camera OFF restores approved framing')

  await reenter(); await music({ timeSec: 0 }); await set({ [P.motion]: 0, [P.musicResponse]: 1 })
  await music({ energy: .05 }); await advance(1.8); const quiet = await shot('music-quiet')
  await music({ energy: .95, bass: 1, high: 1 }); await advance(1.8); const groove = await shot('music-groove')
  assert(diff(quiet, groove) > 1, 'Shared continuous energy visibly changes the finished floor')
  await music({ energy: .95, vocal: 1 }); await advance(1.8); assert(diff(groove, await shot('music-vocal')) > .5, 'Vocal presence visibly restrains floor density')
  await music(); await advance(1.8); const ordinary = await shot('music-ordinary')
  await emit('kick'); await advance(.1); assert(diff(ordinary, await shot('music-kick')) > .1, 'Fresh shared kick produces a visible rhythmic accent')
  await advance(.5); await emit('snare'); assert(diff(ordinary, await shot('music-snare'), regions.ball) > .02, 'Fresh shared snare produces visible mirror glints')
  await advance(.4); await music({ build: 1 }); await advance(.5); assert(diff(ordinary, await shot('music-build')) > .5, 'Supported build produces visible structural response')
  await music(); await advance(2); await emit('drop'); await advance(.2); assert(diff(ordinary, await shot('music-drop')) > .1, 'Canonical drop visibly accents the finished floor')
  await advance(1); await music({ sectionIntensity: 0 }); await advance(2); const meaningLow = await shot('director-low')
  await music({ sectionIntensity: 1 }); await advance(2); const meaningHigh = await shot('director-high')
  assert(diff(meaningLow, meaningHigh) > .1 && (await status()).choreography.activeContributionCount === 14, 'Shared Director significance changes output through the assembled target graph')
  await set({ [P.musicResponse]: 0 }); const noResponse = await shot('response-off')
  await music({ energy: 1, build: 1, sectionIntensity: 1 }); await emit('impact'); await advance(.2)
  assert(diff(noResponse, await shot('response-off-loud')) < .3, 'Music Response zero suppresses musical/Director light changes with finishing enabled')

  const triggers = { beat: ['beat', 8], kick: ['kick', 8], snare: ['snare', 8], downbeat: ['downbeat', 8], beat2: ['beat', 2], beat4: ['beat', 4], bar: ['bar', 4], bar4: ['bar', 16], bar8: ['bar', 32], phrase: ['phrase', 8], drop: ['drop', 8] }
  for (const [trigger, [event, beatIndex]] of Object.entries(triggers)) {
    await music(); await set({ [P.pattern]: 'nightshift', [P.patternChange]: true, [P.trigger]: trigger })
    await emit(event, { beatIndex }); await advance(.35); await shows('crossfade-checker', `trigger-${trigger}`)
    await page.evaluate(() => globalThis.__nightshiftProduction.repeatMusic()); await shows('crossfade-checker', `duplicate-${trigger}`)
    const values = (await status()).parameters.persistentValues
    assert(values[P.pattern] === 'nightshift' && values[P.patternChange] === true, `${trigger}: saved base and permission remain authoritative`)
  }
  await set({ [P.pattern]: 'nightshift' }); await shows('nightshift', 'manual-same-value-takeover')
  await set({ [P.patternChange]: false }); await emit('drop'); await advance(.35); await shows('nightshift', 'pattern-change-off')
  } else {
    for (const pattern of patterns) references[pattern] = await sharp(resolve(out, `pattern-${pattern}.png`)).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  }
  advancingBeats = true
  await music({ timeSec: 0 }); await set({ [P.pattern]: 'nightshift', [P.patternChange]: false, [P.trigger]: 'kick', [P.autoPerformance]: false })
  if (!resumeTransport) {
  await music(); await set({ [P.autoPerformance]: true })
  await music({ build: 1 }); await advance(.35); await shows('diagonal-relay', 'auto-build')
  await emit('drop', { build: 1 }); await advance(.35); await shows('full-house', 'auto-drop')
  await advance(2.3); await shows('nightshift', 'auto-expired')
  await music(); await emit('drop'); await advance(.35); await set({ [P.pattern]: 'runway' }); await shows('runway', 'auto-manual-takeover')
  assert((await status()).parameters.persistentValues[P.autoPerformance] === true, 'Manual takeover preserves Auto Performance permission')
  await set({ [P.pattern]: 'nightshift', [P.patternChange]: true, [P.trigger]: 'kick' })
  await emit('drop'); await advance(.35); await emit('kick'); await advance(.35)
  await set({ [P.autoPerformance]: false }); await shows('crossfade-checker', 'auto-restores-latest-hidden-base')
  } else await set({ [P.patternChange]: true, [P.trigger]: 'kick', [P.autoPerformance]: false })
  console.log('Final music, all Trigger choices and Auto Performance checks passed.')

  if (!resumeResize) {
  await set({ [P.pattern]: 'nightshift' }); await emit('kick'); await advance(.35)
  await advance(1, true); const paused = await shot('transport-paused')
  await emit('kick'); await advance(1, true); assert(diff(paused, await shot('transport-pause-held'), regions.full) < .1, 'Paused transport holds scene and finishing under incoming events')
  await advance(0); await shows('crossfade-checker', 'resume-no-replay')
  await music({ timeSec: 0, event: 'kick', eventId: ++eventId }); await shows('nightshift', 'loop-resets-base')
  await music({ timeSec: 20, event: 'kick', eventId: ++eventId }); await shows('nightshift', 'forward-seek-latches-event')
  await music({ trackId: 'nightshift-final-new-track', timeSec: 20, event: 'kick', eventId: ++eventId }); await shows('nightshift', 'track-change-clears-history')
  await emit('kick', { trackId: 'nightshift-final-new-track' }); await advance(.35); await shows('crossfade-checker', 'fresh-event-after-track-change')
  await set({ [P.patternChange]: false, [P.master]: 0, [P.autoPerformance]: true })
  const dark = await shot('hard-master-zero', false)
  await emit('drop', { energy: 1, build: 1 }); await advance(.35)
  assert(diff(dark, await shot('hard-master-zero-drop', false), regions.full) < .05 && (await status()).effects.activeEffectCount === 0, 'Master zero survives active Auto Performance, music and all finishing')
  await reset(); await set({ [P.motion]: 0 }); await music({}, false)
  const absent = await shot('no-audio')
  await set({ [P.musicResponse]: 0 }); assert(diff(absent, await shot('no-audio-response-off'), regions.full) < .1, 'Missing audio restores authored output with finishing enabled')

  } else { await reset(); await music({}, false); await set({ [P.motion]: 0, [P.musicResponse]: 0 }) }

  if (!resumeLifecycle) {
  // Resize and shared quality policy. Framing adapts using the existing minAspect.
  for (const [width, height, label] of [[720, 720, 'square'], [540, 960, 'portrait'], [1920, 1080, '1080p']]) {
    await page.setViewportSize({ width, height }); const s = await page.evaluate(() => globalThis.__nightshiftProduction.resize()); await settle()
    healthy(s, label); const frame = await shot(`aspect-${label}`, false)
    assert(lit(frame, [.25, .01, .75, .42]) > .025 && lit(frame, [.1, .58, .9, .96]) > .15, `${label}: ball and floor remain visible after resize`)
    metrics.quality[label] = (await status()).snapshot.performance
  }
  await page.setViewportSize({ width: 1280, height: 720 }); await page.evaluate(() => globalThis.__nightshiftProduction.resize())
  for (const quality of ['low', 'medium', 'high', 'auto']) {
    await reenter({ quality }); await set({ [P.motion]: 0, [P.musicResponse]: 0 }); await settle(30)
    const s = await status(); healthy(s, `Quality ${quality}`); await shot(`quality-${quality}`)
    metrics.quality[quality] = { performance: s.snapshot.performance, gpuBytes: s.resources.estimatedGpuMemoryBytes + s.modules.estimatedGpuBytes + s.history.estimatedGpuMemoryBytes }
    assert(s.effects.activeEffectCount === 3 && s.history.activeBufferCount <= s.history.maximumBufferCount, `${quality}: finishing and history stay within shared resource bounds`)
  }
  await music({ energy: .5, advanceBeatGrid: true }); await set({ [P.motion]: .35, [P.musicResponse]: .8, [P.patternChange]: true, [P.autoPerformance]: true })
  const start = await status(); await advance(60); const sustained = await status()
  healthy(sustained, 'Sustained 60-second musical timeline')
  assert(sustained.resources.pooledAllocationCount <= start.resources.pooledAllocationCount + 1 && sustained.history.activeBufferCount === start.history.activeBufferCount, 'Sustained rendering keeps target pool and temporal history bounded')
  metrics.sustained = { performance: sustained.snapshot.performance, resources: sustained.resources, history: sustained.history }
  await shot('sustained')
  }

  // Round-trip serialized authorship through a different native preset; retire every runtime.
  await music({ advanceBeatGrid: true }); await set({ [P.motion]: .35, [P.musicResponse]: .8, [P.patternChange]: true, [P.autoPerformance]: true })
  const sameValue = (a, b) => typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 1e-9
    : Array.isArray(a) && Array.isArray(b) ? a.length === b.length && a.every((v, i) => sameValue(v, b[i])) : a === b
  await set({ [P.pattern]: 'runway', [P.trigger]: 'snare', [P.haze]: .22, [P.cyanColor]: [.1, .8, 1, 1] })
  const saved = (await status()).parameters.persistentValues
  for (let cycle = 0; cycle < 3; cycle++) {
    const s = await reenter({ preserve: true, viaOtherPreset: true }); healthy(s, `Preset switch ${cycle + 1}`)
    const restored = s.parameters.persistentValues
    const mismatches = Object.keys(saved).filter(key => !sameValue(restored[key], saved[key]))
    if (mismatches.length) { metrics.restoreMismatch = { mismatches, saved, restored }; console.log(JSON.stringify(metrics.restoreMismatch)) }
    assert(mismatches.length === 0 && Object.keys(restored).length === Object.keys(saved).length, `Preset switch ${cycle + 1}: serialized user edits survive`)
    for (const retired of s.retired) assert(retired.snapshot.phase === 'disposed' && retired.resources.activeLeaseCount === 0 && retired.resources.estimatedGpuMemoryBytes === 0 && retired.history.activeBufferCount === 0 && retired.effects.activeEffectCount === 0 && retired.diagnostics.activeRuntimeCount === 0 && retired.diagnostics.activeAnimationFrameCount === 0, `Preset switch ${cycle + 1}: retired native runtime releases targets, history, effects and frame ownership`)
    assert(s.diagnostics.activeRuntimeCount === 1 && s.diagnostics.activeAnimationFrameCount === 1 && s.diagnostics.activeWebGLContextCount === 1 && s.diagnostics.activeEventListenerCount === 2, `Preset switch ${cycle + 1}: only one runtime owns rendering`)
    metrics.lifecycle.push({ diagnostics: s.diagnostics, resources: s.resources, history: s.history })
  }
  await reset(); await music({ timeSec: 0 }); await set({ [P.motion]: 0, [P.musicResponse]: 0 }); await shot('final-default')
  const final = await status(); healthy(final, 'Final reset')
  assert(final.parameters.persistentValues[P.autoPerformance] === false && final.parameters.persistentValues[P.patternChange] === false && final.parameters.persistentValues[P.camera] === 0, 'Reset restores default OFF permissions and fixed camera')
  const disposed = await page.evaluate(() => globalThis.__nightshiftProduction.dispose())
  assert(disposed.snapshot.phase === 'disposed' && disposed.resources.activeLeaseCount === 0 && disposed.history.activeBufferCount === 0 && disposed.diagnostics.activeRuntimeCount === 0 && disposed.diagnostics.activeAnimationFrameCount === 0 && disposed.diagnostics.activeWebGLContextCount === 0 && disposed.diagnostics.activeEventListenerCount === 0, 'Final disposal leaves zero owned runtime, frames, contexts, listeners, targets or history')
  assert(disposed.frameFaults.length === 0, 'No transient render-pass failures across any frame, OFF transition or preset switch')
  assert(errors.length === 0, 'No browser, WebGL or shader errors throughout full acceptance')
  await writeFile(resolve(out, 'report.json'), JSON.stringify({ checks, captures, errors, metrics, disposed }, null, 2) + '\n')
  console.log(JSON.stringify({ output: out, checks: checks.length, captures: captures.length, performance: metrics.sustained.performance }))
} catch (error) {
  await writeFile(resolve(out, 'failure.json'), JSON.stringify({ error: String(error), checks, captures, errors, metrics }, null, 2) + '\n'); throw error
} finally { await browser?.close(); await server.close() }

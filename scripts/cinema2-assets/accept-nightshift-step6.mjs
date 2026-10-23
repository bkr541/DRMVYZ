// Scoped temporary performance on the real native canvas, including hidden base progression.
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import sharp from 'sharp'

const root = resolve(import.meta.dirname, '../..'), out = resolve(root, 'artifacts/cinema2-nightshift-step6')
await mkdir(out, { recursive: true })
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0 }, clearScreen: false })
const checks = [], errors = [], references = {}
const assert = (value, message) => { if (!value) throw new Error(message); checks.push(message) }
let browser, captures = 0
try {
  await server.listen()
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error' && /shader|WebGL|THREE/.test(m.text())) errors.push(m.text()) })
  const status = () => page.evaluate(() => globalThis.__nightshiftProduction.status())
  const set = values => page.evaluate(v => globalThis.__nightshiftProduction.set(v), values)
  const music = (options = {}, enabled = true) => page.evaluate(v => globalThis.__nightshiftProduction.music(...v), [{ energy: .5, sectionIntensity: .5, advanceBeatGrid: true, ...options }, enabled])
  const advance = (sec, paused = false) => page.evaluate(v => globalThis.__nightshiftProduction.advance(v[0], 120, v[1]), [sec, paused])
  let eventSequence = 100
  const emit = async (event, options = {}) => music({ event, eventId: ++eventSequence, timeSec: (await status()).transport.timeSec + .01, ...options })
  const floor = [.1, .62, .9, .97], ball = [.39, .03, .61, .4]
  const diff = (a, b, region = floor) => {
    let sum = 0, count = 0
    for (let y = Math.floor(region[1] * a.info.height); y < region[3] * a.info.height; y++) for (let x = Math.floor(region[0] * a.info.width); x < region[2] * a.info.width; x++) {
      const i = (y * a.info.width + x) * a.info.channels
      for (let c = 0; c < 3; c++) { sum += Math.abs(a.data[i + c] - b.data[i + c]); count++ }
    }
    return sum / count
  }
  const shot = async name => {
    captures++
    return sharp(await page.locator('canvas').screenshot({ path: resolve(out, `${name}.png`) })).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  }
  const shows = async (pattern, name) => {
    const actual = await shot(name), error = diff(actual, references[pattern])
    assert(error < .05, `${name}: rendered ${pattern} (${error.toFixed(4)} pixel error)`)
    return actual
  }
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/src/test/browser/cinema2-nightshift-production.html?step3=1`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => Boolean(globalThis.__nightshiftProduction))
  const prepared = await page.evaluate(() => globalThis.__nightshiftProduction.prepare())
  const P = await page.evaluate(() => globalThis.__nightshiftProduction.ids)
  assert(prepared.parameters.persistentValues[P.autoPerformance] === false, 'Auto Performance defaults OFF')
  await page.evaluate(() => globalThis.__nightshiftProduction.showInspector(true))
  const control = page.locator(`[data-cinema2-parent-group="master-controls"] [data-cinema2-control-id="${P.autoPerformance}"]`).getByRole('switch')
  assert(await control.count() === 1 && await control.getAttribute('aria-checked') === 'false', 'Real Inspector exposes Auto Performance under Master Controls, OFF')
  await control.click()
  assert((await status()).parameters.persistentValues[P.autoPerformance] === true, 'Inspector click enables the native performance control')
  await control.click(); await page.evaluate(() => globalThis.__nightshiftProduction.showInspector(false))
  await set({ [P.motion]: 0, [P.musicResponse]: 0 })
  for (const pattern of ['nightshift', 'crossfade-checker', 'runway', 'diagonal-relay', 'full-house']) {
    await set({ [P.pattern]: pattern }); references[pattern] = await shot(`reference-${pattern}`)
  }
  const camera = JSON.stringify((await status()).camera), authored = (await status()).parameters.persistentValues
  const fresh = async (sync = true) => {
    await advance(0)
    await set({ [P.autoPerformance]: false, [P.patternChange]: false, [P.pattern]: 'nightshift', [P.bpmSync]: sync })
    await music({ timeSec: 0 }); await set({ [P.autoPerformance]: true })
  }
  await fresh(); await set({ [P.autoPerformance]: false }); await emit('drop'); await advance(.35)
  await shows('nightshift', 'default-off-drop')
  await music({ build: 1 }); await set({ [P.autoPerformance]: true }); await advance(.35)
  await shows('nightshift', 'enable-latches-current-build')
  await music(); await music({ build: 1 }); await advance(.35)
  const building = await shows('diagonal-relay', 'fresh-build')
  assert(diff(building, references.nightshift) > 1, 'Build override is visibly distinct')
  await advance(4); await shows('nightshift', 'eight-beat-build-limit')
  await advance(.5); await shows('nightshift', 'build-not-rearmed')
  await music(); await music({ build: 1 }); await advance(.35)
  await shows('diagonal-relay', 'separate-build-allowed')
  await music(); await advance(.35); await shows('nightshift', 'build-end-restores-base')

  await fresh(); await emit('drop', { eventId: 777 }); await advance(.35)
  const dropping = await shows('full-house', 'fresh-drop')
  assert(diff(dropping, references.nightshift, ball) < .05, 'Overrides leave the zero-motion disco ball unchanged')
  await advance(1.3); await shows('full-house', 'drop-before-four-beats')
  await advance(.8); await shows('nightshift', 'drop-budget-restoration')
  await emit('drop', { eventId: 777 }); await advance(.35); await shows('nightshift', 'duplicate-drop-suppressed')
  await fresh(false); await emit('drop'); await advance(2.1); await shows('full-house', 'sync-off-authored-budget')
  await advance(.7); await shows('nightshift', 'sync-off-budget-restoration')

  await fresh(); await music({ build: 1 }); await advance(.35)
  await emit('drop', { build: 1 }); await advance(.35); await shows('full-house', 'drop-preempts-build')
  await advance(2.2); await shows('nightshift', 'drop-restores-base-not-consumed-build')

  // Each Trigger advances the base behind the drop. Repeated publication must
  // not add a second advancement; OFF exposes the current hidden base now.
  const triggers = { beat: ['beat', 8], kick: ['kick', 8], snare: ['snare', 8], downbeat: ['downbeat', 8], beat2: ['beat', 2], beat4: ['beat', 4], bar: ['bar', 4], bar4: ['bar', 16], bar8: ['bar', 32], phrase: ['phrase', 8], drop: ['drop', 8] }
  for (const [trigger, [event, beatIndex]] of Object.entries(triggers)) {
    await fresh(); await set({ [P.patternChange]: true, [P.trigger]: trigger })
    await emit('drop'); await advance(.35)
    await emit(event, { beatIndex })
    await page.evaluate(() => globalThis.__nightshiftProduction.repeatMusic())
    await advance(.35); await shows('full-house', `${trigger}-base-hidden`)
    await set({ [P.autoPerformance]: false })
    await shows(trigger === 'drop' ? 'runway' : 'crossfade-checker', `${trigger}-latest-base-restored`)
    const values = (await status()).parameters.persistentValues
    assert(values[P.pattern] === 'nightshift' && values[P.patternChange] === true && values[P.trigger] === trigger, `${trigger}: override and progression preserve saved controls`)
  }

  await fresh(); await set({ [P.patternChange]: true, [P.trigger]: 'kick' }); await music({ build: 1 }); await advance(.35)
  await set({ [P.pattern]: 'nightshift' }); await shows('nightshift', 'same-value-manual-build-takeover')
  await advance(.5); await shows('nightshift', 'active-build-cannot-cancel-manual')
  await emit('kick', { build: 1 }); await advance(.35); await shows('crossfade-checker', 'fresh-trigger-after-manual')
  await emit('drop', { build: 1 }); await advance(.35); await shows('full-house', 'fresh-auto-event-after-manual')
  await set({ [P.pattern]: 'nightshift' }); await shows('nightshift', 'same-value-manual-drop-takeover')
  await advance(.5); await shows('nightshift', 'current-drop-cannot-cancel-manual')
  const takeover = (await status()).parameters.persistentValues
  assert(takeover[P.autoPerformance] === true && takeover[P.patternChange] === true, 'Manual takeover preserves both enabled permissions')

  await fresh(); await emit('drop'); await advance(.35); await advance(3, true)
  await shows('full-house', 'paused-override-holds')
  await set({ [P.autoPerformance]: false }); await shows('nightshift', 'off-immediate-during-pause')
  await set({ [P.autoPerformance]: true }); await advance(0); await shows('nightshift', 'resume-does-not-replay')
  await emit('drop'); await advance(.35); await shows('full-house', 'fresh-drop-after-resume')
  await music({ timeSec: 0, event: 'drop', eventId: ++eventSequence }); await shows('nightshift', 'seek-latches-current-event')
  await music({ trackId: 'nightshift-performance-new', build: 1 }); await shows('nightshift', 'track-activation-latches-build')
  await music(); await emit('drop'); await advance(.35)
  await music({}, false); await shows('nightshift', 'missing-audio-clears-override')

  await fresh(); await set({ [P.coverage]: 0 }); const noCoverage = await shot('coverage-zero')
  await emit('drop'); await advance(.35); assert(diff(noCoverage, await shot('coverage-zero-auto')) < .05, 'Auto Performance obeys zero coverage')
  await set({ [P.coverage]: .75, [P.master]: 0 }); const dark = await shot('master-zero')
  await music({ build: 1 }); await advance(.35); assert(diff(dark, await shot('master-zero-auto'), [0, 0, 1, 1]) < .05, 'Auto Performance obeys Master zero')
  await set({ [P.master]: .85 }); await music(); await set({ [P.autoPerformance]: false })
  const final = await status(), values = final.parameters.persistentValues
  for (const key of ['backgroundColor', 'cyanColor', 'magentaColor', 'blueColor', 'amberColor', 'ballColor']) assert(JSON.stringify(values[P[key]]) === JSON.stringify(authored[P[key]]), `Auto Performance preserves ${key}`)
  assert(JSON.stringify(final.camera) === camera, 'Auto Performance preserves the approved camera')
  const reentry = await page.evaluate(() => globalThis.__nightshiftProduction.reenter())
  assert(reentry.parameters.persistentValues[P.autoPerformance] === false && reentry.modules.failedModuleCount === 0, 'Fresh native re-entry defaults Auto Performance OFF with no retained override')
  assert(errors.length === 0 && reentry.choreography.diagnostics.length === 0, 'No browser, shader or choreography errors')
  const report = { checks, captures, errors, performance: reentry.snapshot.performance }
  await writeFile(resolve(out, 'report.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ output: out, checks: checks.length, captures, performance: report.performance }))
} finally { await browser?.close(); await server.close() }

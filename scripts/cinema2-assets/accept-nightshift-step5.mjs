// Upstream facts -> real shared Director -> shared choreography -> native pixels.
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import sharp from 'sharp'

const root = resolve(import.meta.dirname, '../..'), out = resolve(root, 'artifacts/cinema2-nightshift-step5')
await mkdir(out, { recursive: true })
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0 }, clearScreen: false })
const checks = [], measurements = {}, errors = []
const assert = (value, message) => { if (!value) throw new Error(message); checks.push(message) }
let browser, visibleCaptures = 0
try {
  await server.listen()
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error' && /shader|WebGL|THREE/.test(m.text())) errors.push(m.text()) })
  const status = () => page.evaluate(() => globalThis.__nightshiftProduction.status())
  const set = v => page.evaluate(v => globalThis.__nightshiftProduction.set(v), v)
  const music = (o = {}, enabled = true) => page.evaluate(v => globalThis.__nightshiftProduction.music(...v), [o, enabled])
  const advance = (sec, paused = false) => page.evaluate(v => globalThis.__nightshiftProduction.advance(v[0], 120, v[1]), [sec, paused])
  let eventSequence = 100
  const impact = async (id = ++eventSequence) => music({ energy: .5, sectionIntensity: .5, event: 'impact', eventId: id, timeSec: (await status()).transport.timeSec + .01 })
  const floor = [.1, .62, .9, .97], ceiling = [.33, .19, .4, .22], ball = [.39, .03, .61, .4]
  const diff = (a, b, region = floor) => {
    let sum = 0, count = 0
    for (let y = Math.floor(region[1] * a.info.height); y < region[3] * a.info.height; y++) for (let x = Math.floor(region[0] * a.info.width); x < region[2] * a.info.width; x++) {
      const i = (y * a.info.width + x) * a.info.channels
      for (let c = 0; c < 3; c++) { sum += Math.abs(a.data[i + c] - b.data[i + c]); count++ }
    }
    return sum / count
  }
  const shot = async (name, visible = true) => {
    const raw = await sharp(await page.locator('canvas').screenshot({ path: resolve(out, `${name}.png`) })).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    if (visible) {
      let lit = 0, count = 0
      for (let y = Math.floor(ball[1] * raw.info.height); y < ball[3] * raw.info.height; y++) for (let x = Math.floor(ball[0] * raw.info.width); x < ball[2] * raw.info.width; x++) {
        const i = (y * raw.info.width + x) * raw.info.channels
        if (Math.max(raw.data[i], raw.data[i + 1], raw.data[i + 2]) > 80) lit++
        count++
      }
      if (lit / count < .15) throw new Error(`${name}: missing ball pixels`)
      visibleCaptures++
    }
    return raw
  }
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/src/test/browser/cinema2-nightshift-production.html?step3=1`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => Boolean(globalThis.__nightshiftProduction))
  await page.evaluate(() => globalThis.__nightshiftProduction.prepare())
  const P = await page.evaluate(() => globalThis.__nightshiftProduction.ids)
  await set({ [P.motion]: 0, [P.musicResponse]: 1 })
  const camera = JSON.stringify((await status()).camera)
  const authored = (await status()).parameters.persistentValues
  await music({ energy: .5, sectionIntensity: 0 }); const lowState = await advance(1.8)
  const low = await shot('structural-intensity-low')
  await music({ energy: .5, sectionIntensity: 1 }); const highState = await advance(1.8)
  const high = await shot('structural-intensity-high')
  assert(Math.abs(lowState.channels.audioEnergy - highState.channels.audioEnergy) < .00001, 'Structural comparison holds raw energy constant')
  assert(highState.channels.directorIntensity > lowState.channels.directorIntensity, 'Real shared Director interprets structural intensity')
  assert(highState.choreography.activeContributionCount === 9, 'Five audio and four Director routes publish shared target contributions')
  measurements.intensityFloor = diff(low, high); measurements.intensityCeiling = diff(low, high, ceiling)
  assert(measurements.intensityFloor > .1 && measurements.intensityCeiling > .1, 'Director intensity visibly shapes floor and ceiling within user gains')

  await music({ energy: .5, sectionIntensity: .5 }); await advance(1.8); const baseline = await shot('macro-baseline')
  await music({ energy: .5, sectionIntensity: .5, sectionBuild: true, sectionProgress: 1 }); const buildState = await advance(1.8)
  const build = await shot('director-build')
  assert(buildState.channels.buildPressure === 0 && buildState.channels.directorBuild > .1, 'Section build context supplies Director meaning independently of raw build progress')
  assert(diff(baseline, build) > .1, 'Director build meaning visibly concentrates the selected floor program')
  await music({ energy: .5, sectionIntensity: .5 }); await advance(2.5)
  assert(diff(baseline, await shot('director-build-restored')) < .1, 'Director build and momentum release to the current base')

  await impact(777); const hit = await shot('major-impact')
  const impactFacts = await status()
  assert(impactFacts.audio.structure.semanticMoments.value[0].type === 'major_impact' && !impactFacts.audio.rhythm.kick, 'Macro impact receives a shared semantic major impact without a kick/drop cue')
  measurements.impactFloor = diff(baseline, hit)
  assert(measurements.impactFloor > .5, 'Qualified Director impact visibly opens a brief floor accent')
  await advance(.2); const held = await shot('impact-release')
  await advance(.6, true); assert(diff(held, await shot('impact-paused'), [0, 0, 1, 1]) < .05, 'Pause holds the complete macro response')
  await advance(.6); assert(diff(baseline, await shot('impact-restored')) < .1, 'The 700 ms macro impact restores the current base')
  await impact(777); assert(diff(baseline, await shot('impact-duplicate')) < .1, 'Repeated semantic identity cannot restart a completed macro impact')

  await set({ [P.musicResponse]: 0 }); const off = await shot('response-off')
  await music({ energy: 1, sectionIntensity: 1, spectralFlux: 1, tension: 1, sectionBuild: true, sectionProgress: 1 }); await advance(1)
  await impact(); assert(diff(off, await shot('response-off-impact'), [0, 0, 1, 1]) < .05, 'Music Response zero blocks all Director domains and impact impulses')
  await set({ [P.musicResponse]: 1 }); await music({ energy: .5, sectionIntensity: .5 }); await advance(2.5)
  await impact(); await advance(.1); await advance(0, true); await set({ [P.musicResponse]: 0 })
  assert(diff(off, await shot('off-during-pause'), [0, 0, 1, 1]) < .05, 'Music Response OFF applies immediately during a paused macro impact')
  await set({ [P.musicResponse]: 1 }); await advance(.8)

  // Real momentum facts, same clock/energy and fixed camera, with actual pixels.
  await set({ [P.motion]: .35, [P.rotation]: false, [P.pattern]: 'runway', [P.bpmSync]: false })
  await music({ energy: .5, sectionIntensity: .5, timeSec: 0 }); await advance(4)
  const stillMomentum = await shot('momentum-low')
  await music({ energy: .5, sectionIntensity: .5, spectralFlux: 1, tension: 1, timeSec: 0 }); const movingState = await advance(4)
  const moving = await shot('momentum-high')
  assert(movingState.channels.directorMomentum > .4, 'Shared Director derives sustained momentum from flux and tension')
  measurements.momentumFloor = diff(stillMomentum, moving)
  assert(measurements.momentumFloor > .5, 'Director momentum changes floor travel even with BPM Sync OFF')
  assert(diff(stillMomentum, moving, ball) < .05, 'Ball Rotation OFF stays authoritative under Director momentum')
  await set({ [P.motion]: 0 }); const noMotion = await shot('motion-zero')
  await advance(1); assert(diff(noMotion, await shot('motion-zero-held')) < .05, 'Motion Amount zero holds continuous choreography under momentum')
  await set({ [P.pattern]: 'nightshift', [P.bpmSync]: true, [P.rotation]: true })
  await music({ energy: .5, sectionIntensity: .5, timeSec: 0 }); await advance(2)

  for (const key of ['floor', 'coverage']) {
    await set({ [P[key]]: 0 }); const before = await shot(`${key}-zero`)
    await impact(); assert(diff(before, await shot(`${key}-zero-impact`)) < .05, `${key} zero cannot be reopened by macro impact`)
    await advance(.8); await set({ [P[key]]: authored[P[key]] })
  }
  await set({ [P.ceiling]: 0 }); const noCeiling = await shot('ceiling-zero')
  await impact(); assert(diff(noCeiling, await shot('ceiling-zero-impact'), ceiling) < .05, 'Ceiling zero cannot be reopened by macro impact')
  await advance(.8); await set({ [P.ceiling]: authored[P.ceiling], [P.master]: 0 }); const dark = await shot('master-zero', false)
  await impact(); assert(diff(dark, await shot('master-zero-impact', false), [0, 0, 1, 1]) < .05, 'Master zero cannot be reopened by macro impact')
  await set({ [P.master]: authored[P.master] })
  await music({ energy: .5, sectionIntensity: .5, event: 'impact', eventId: 900, timeSec: 0 }); const reset = await shot('seek-reset')
  await advance(.8); assert(diff(reset, await shot('seek-held')) < .1, 'Seek latches the current impact and clears its previous envelope')
  await music({ energy: .5, sectionIntensity: .5, trackId: 'nightshift-director-other', event: 'impact', eventId: 901 }); const track = await shot('track-reset')
  await advance(.8); assert(diff(track, await shot('track-held')) < .1, 'Track changes clear Director impact history')
  const values = (await status()).parameters.persistentValues
  for (const key of ['backgroundColor', 'cyanColor', 'magentaColor', 'blueColor', 'amberColor', 'ballColor', 'pattern', 'patternChange', 'trigger']) assert(JSON.stringify(values[P[key]]) === JSON.stringify(authored[P[key]]), `Director preserves authored ${key}`)
  assert(JSON.stringify((await status()).camera) === camera, 'Director preserves approved camera framing')
  await music({}, false); const absent = await shot('no-audio')
  await set({ [P.musicResponse]: 0 }); assert(diff(absent, await shot('no-audio-off'), [0, 0, 1, 1]) < .05, 'Missing audio/Director restores the authored view')
  await music({ energy: .5, sectionIntensity: .5 }); const reentry = await page.evaluate(() => globalThis.__nightshiftProduction.reenter())
  await shot('reentry')
  assert(reentry.modules.failedModuleCount === 0 && reentry.choreography.activeContributionCount === 9, 'Native preset re-entry reconnects all nine shared routes')
  assert(errors.length === 0 && reentry.choreography.diagnostics.length === 0, 'No browser, shader or choreography errors')
  assert(visibleCaptures >= 30, `Ball visibility is retained in ${visibleCaptures} enabled captures`)
  const report = { checks, measurements, visibleCaptures, errors, performance: reentry.snapshot.performance }
  await writeFile(resolve(out, 'report.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ output: out, checks: checks.length, measurements, performance: report.performance }))
} finally { await browser?.close(); await server.close() }

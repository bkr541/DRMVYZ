// Shared AudioFeatureBus -> production bridge -> native target composition -> pixels.
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import sharp from 'sharp'

const root = resolve(import.meta.dirname, '../..'), out = resolve(root, 'artifacts/cinema2-nightshift-step3')
await mkdir(out, { recursive: true })
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0 }, clearScreen: false })
const checks = [], measurements = {}, errors = []
const assert = (value, message) => { if (!value) throw new Error(message); checks.push(message) }
let browser
try {
  await server.listen()
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error' && /shader|WebGL|THREE/.test(m.text())) errors.push(m.text()) })
  const url = `http://127.0.0.1:${server.httpServer.address().port}/src/test/browser/cinema2-nightshift-production.html?step3=1`
  const status = () => page.evaluate(() => globalThis.__nightshiftProduction.status())
  const set = v => page.evaluate(v => globalThis.__nightshiftProduction.set(v), v)
  const music = (o = {}, enabled = true) => page.evaluate(v => globalThis.__nightshiftProduction.music(...v), [o, enabled])
  const advance = (sec, paused = false) => page.evaluate(v => globalThis.__nightshiftProduction.advance(v[0], 120, v[1]), [sec, paused])
  const emit = async o => music({ ...o, timeSec: (await status()).transport.timeSec + .01 })
  let heroChecks = 0
  const shot = async name => {
    const raw = await sharp(await page.locator('canvas').screenshot({ path: resolve(out, `${name}.png`) })).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    if (!name.startsWith('master-zero')) {
      const litFraction = (region, threshold) => {
        let lit = 0, total = 0
        for (let y = Math.floor(region[1] * raw.info.height); y < region[3] * raw.info.height; y++) for (let x = Math.floor(region[0] * raw.info.width); x < region[2] * raw.info.width; x++) {
          const i = (y * raw.info.width + x) * raw.info.channels
          if (Math.max(raw.data[i], raw.data[i + 1], raw.data[i + 2]) > threshold) lit++
          total++
        }
        return lit / total
      }
      if (litFraction([.39, .03, .61, .4], 80) < .15 || litFraction([.33, .19, .4, .22], 120) < .1) throw new Error(`${name}: ball or ceiling is missing from the rendered pixels`)
      heroChecks++
    }
    return raw
  }
  const diff = (a, b, region = [0, 0, 1, 1]) => {
    let sum = 0, count = 0
    for (let y = Math.floor(region[1] * a.info.height); y < region[3] * a.info.height; y++) for (let x = Math.floor(region[0] * a.info.width); x < region[2] * a.info.width; x++) {
      const i = (y * a.info.width + x) * a.info.channels
      for (let c = 0; c < 3; c++) { sum += Math.abs(a.data[i + c] - b.data[i + c]); count++ }
    }
    return sum / count
  }
  const floor = [.1, .62, .9, .97], ball = [.39, .03, .61, .4]
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => Boolean(globalThis.__nightshiftProduction))
  const prepared = await page.evaluate(() => globalThis.__nightshiftProduction.prepare())
  const P = await page.evaluate(() => globalThis.__nightshiftProduction.ids)
  assert(prepared.modules.failedModuleCount === 0, 'Native runtime prepares with the shared audio fixture')
  await set({ [P.musicResponse]: 1, [P.motion]: 0 })
  await music({ energy: .05 }); const quiet = await shot('quiet')
  await music({ energy: .95, bass: 1, high: 1 }); const groove = await shot('groove')
  measurements.energy = diff(quiet, groove, floor)
  assert(measurements.energy > 1, 'Quiet and energetic passages visibly change floor coverage and level')
  await music({ energy: .95, vocal: 1 }); const vocal = await shot('vocal')
  assert(diff(vocal, groove, floor) > .5, 'Supported vocals visibly restrain floor density')
  await music({ energy: .95, build: .9 }); const build = await shot('build')
  assert(diff(build, groove, floor) > .5, 'Shared build pressure visibly concentrates the selected floor program')
  await music({ energy: .5 }); const ordinary = await shot('ordinary')
  await emit({ energy: .5, event: 'kick' }); await advance(.12)
  const kick = await shot('kick')
  measurements.kick = diff(ordinary, kick, floor)
  assert(diff(kick, ordinary, ball) < .05, 'Kick preserves the ball and ceiling geometry')
  assert(measurements.kick > .05, `Fresh shared kick creates a spatial row accent (${measurements.kick})`)
  await page.evaluate(() => globalThis.__nightshiftProduction.repeatMusic())
  assert(diff(kick, await shot('kick-repeated')) < .05, 'Duplicate kick publication does not restart or alter the held impulse')
  await advance(.4); assert(diff(ordinary, await shot('kick-decayed'), floor) < .05, 'Kick envelope releases to the selected program')
  await emit({ energy: .5, event: 'snare' }); const snare = await shot('snare')
  measurements.snare = diff(ordinary, snare, ball)
  assert(measurements.snare > .02, 'Fresh shared snare visibly changes mirror glints')
  await advance(.2); assert(diff(ordinary, await shot('snare-decayed'), ball) < .05, 'Snare glints release')
  await emit({ energy: .5, event: 'drop' }); await advance(.2)
  const drop = await shot('drop')
  assert(diff(ordinary, drop, floor) > .1, 'Shared semantic drop creates an outward floor accent')
  await advance(.5); assert(diff(ordinary, await shot('drop-decayed'), floor) < .05, 'Drop envelope releases')
  const authored = (await status()).parameters.persistentValues
  assert(authored[P.pattern] === 'nightshift' && authored[P.patternChange] === false, 'Music responses preserve authored Pattern and default Pattern Change OFF')

  await set({ [P.musicResponse]: 0 }); await music({ energy: .01 }); const off = await shot('response-off-quiet')
  await emit({ energy: 1, vocal: 1, build: 1, event: 'kick' })
  assert(diff(off, await shot('response-off-loud')) < .05, 'Music Response zero restores authored lighting and suppresses all musical accents')
  await set({ [P.bpmSync]: false, [P.musicResponse]: 1 }); await music({ energy: .05 }); const freeQuiet = await shot('free-quiet')
  await music({ energy: .95 }); assert(diff(freeQuiet, await shot('free-loud'), floor) > 1, 'BPM Sync OFF preserves unrelated energy response')

  // Compare real rendered base programs; saved Pattern must never be overwritten.
  await set({ [P.musicResponse]: 0, [P.pattern]: 'nightshift' }); const base = await shot('pattern-base')
  await set({ [P.pattern]: 'crossfade-checker' }); const next = await shot('pattern-next')
  const triggers = { beat: ['beat', 8], kick: ['kick', 8], snare: ['snare', 8], downbeat: ['downbeat', 8], beat2: ['beat', 2], beat4: ['beat', 4], bar: ['bar', 4], bar4: ['bar', 16], bar8: ['bar', 32], phrase: ['phrase', 8], drop: ['drop', 8] }
  for (const [trigger, [event, beatIndex]] of Object.entries(triggers)) {
    await music({ energy: .5 }); await set({ [P.pattern]: 'nightshift', [P.patternChange]: true, [P.trigger]: trigger })
    await emit({ energy: .5, event, beatIndex, eventId: checks.length + 100 })
    const changed = await shot(`trigger-${trigger}`)
    assert(diff(changed, next, floor) < .05 && diff(changed, base, floor) > 1, `${trigger} advances to a visibly different native program`)
    await page.evaluate(() => globalThis.__nightshiftProduction.repeatMusic())
    assert(diff(changed, await shot(`trigger-${trigger}-repeat`), floor) < .05, `${trigger} repeated event identity advances only once`)
    const values = (await status()).parameters.persistentValues
    assert(values[P.pattern] === 'nightshift' && values[P.patternChange] === true, `${trigger} preserves saved Pattern and enabled toggle`)
  }
  await set({ [P.pattern]: 'nightshift' })
  assert(diff(base, await shot('manual-reclaim'), floor) < .05, 'Same-value manual Pattern selection immediately reclaims the authored base')
  await set({ [P.patternChange]: false, [P.trigger]: 'kick' }); await emit({ event: 'kick' })
  assert(diff(base, await shot('pattern-change-off'), floor) < .05, 'Pattern Change OFF blocks cycling under a fresh event')

  await music({ energy: .5 }); await set({ [P.patternChange]: true, [P.trigger]: 'kick' })
  await advance(.1, true); await emit({ event: 'kick' }); const paused = await shot('paused-event')
  await advance(.1, true); assert(diff(paused, await shot('paused-held')) < .05, 'Paused transport holds output under incoming music')
  await advance(0, false); assert(diff(base, await shot('resumed'), floor) < .05, 'Resume does not replay a kick received while paused')
  await emit({ event: 'kick' }); assert(diff(next, await shot('fresh-after-resume'), floor) < .05, 'A fresh event works after resume')
  await music({ timeSec: 0, event: 'kick' }); assert(diff(base, await shot('loop-reset'), floor) < .05, 'Backward seek/loop restores base and latches the current event')
  await music({ timeSec: 9, event: 'kick' }); assert(diff(base, await shot('seek-reset'), floor) < .05, 'Forward seek restores base without replay')
  await music({ timeSec: 9, trackId: 'nightshift-other-track', event: 'kick' }); assert(diff(base, await shot('track-reset'), floor) < .05, 'Track change clears pattern/impulse history')

  await set({ [P.patternChange]: false, [P.musicResponse]: 1, [P.coverage]: 0 }); await music({ energy: .1 }); const darkFloor = await shot('coverage-zero')
  await emit({ energy: 1, build: 1, event: 'drop' }); assert(diff(darkFloor, await shot('coverage-zero-drop'), floor) < .05, 'Coverage zero remains authoritative during a drop')
  await set({ [P.master]: 0 }); const dark = await shot('master-zero')
  await emit({ energy: 1, event: 'snare' }); assert(diff(dark, await shot('master-zero-snare')) < .05, 'Master zero remains authoritative during a snare')
  const current = (await status()).parameters.persistentValues
  for (const key of ['backgroundColor', 'cyanColor', 'magentaColor', 'blueColor', 'amberColor', 'ballColor']) assert(JSON.stringify(current[P[key]]) === JSON.stringify(authored[P[key]]), `Audio never writes ${key}`)

  await music({}, false); await set({ [P.master]: .8, [P.coverage]: .75, [P.musicResponse]: 1 }); const absent = await shot('no-audio')
  await set({ [P.musicResponse]: 0 }); assert(diff(absent, await shot('no-audio-response-off')) < .05, 'Unavailable audio falls back to authored lighting')
  await music({ energy: .5 }); const reentered = await page.evaluate(() => globalThis.__nightshiftProduction.reenter())
  assert(reentered.modules.failedModuleCount === 0 && reentered.parameters.persistentValues[P.patternChange] === false, 'Fresh native preset re-entry starts clean with default authority')
  await shot('reentered')
  assert(heroChecks > 50, `Ball and ceiling remain visible in all ${heroChecks} enabled captures`)
  assert(errors.length === 0, 'No browser, WebGL or shader errors')
  await writeFile(resolve(out, 'report.json'), JSON.stringify({ checks, measurements, heroChecks, errors, performance: reentered.snapshot.performance }, null, 2) + '\n')
  console.log(JSON.stringify({ output: out, checks: checks.length, measurements, performance: reentered.snapshot.performance }))
} finally { await browser?.close(); await server.close() }

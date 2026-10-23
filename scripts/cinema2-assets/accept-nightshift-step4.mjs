import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import sharp from 'sharp'

const root = resolve(import.meta.dirname, '../..'), out = resolve(root, 'artifacts/cinema2-nightshift-step4')
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
  let eventSequence = 0
  const emit = async event => music({ energy: .5, event, eventId: ++eventSequence, timeSec: (await status()).transport.timeSec + .01 })
  const floor = [.1, .62, .9, .97]
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
      for (const [region, threshold, minimum] of [[[.39, .03, .61, .4], 80, .15], [[.33, .19, .4, .22], 120, .1]]) {
        let lit = 0, count = 0
        for (let y = Math.floor(region[1] * raw.info.height); y < region[3] * raw.info.height; y++) for (let x = Math.floor(region[0] * raw.info.width); x < region[2] * raw.info.width; x++) {
          const i = (y * raw.info.width + x) * raw.info.channels
          if (Math.max(raw.data[i], raw.data[i + 1], raw.data[i + 2]) > threshold) lit++
          count++
        }
        if (lit / count < minimum) throw new Error(`${name}: ball/ceiling visibility failed`)
      }
      visibleCaptures++
    }
    return raw
  }
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/src/test/browser/cinema2-nightshift-production.html?step3=1`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => Boolean(globalThis.__nightshiftProduction))
  await page.evaluate(() => globalThis.__nightshiftProduction.prepare())
  const P = await page.evaluate(() => globalThis.__nightshiftProduction.ids)
  await set({ [P.motion]: 0, [P.musicResponse]: 1 })
  await music({ energy: 0 }); await advance(1.5)
  const quiet = await shot('quiet')
  await music({ energy: 1 }); const onset = await shot('energy-onset')
  assert(diff(quiet, onset) < .05, 'A continuous energy step does not snap while visual time is held')
  const midpoint = await advance(.1); const rising = await shot('energy-rising')
  assert(midpoint.channels.audioEnergy > .3 && midpoint.channels.audioEnergy < .6, 'Shared choreography smooths the energy attack over elapsed frames')
  assert(diff(quiet, rising) > 1, 'Smoothed attack produces visible floor change')
  await advance(0, true); await music({ energy: 0 }); await advance(.5, true)
  assert(diff(rising, await shot('energy-paused')) < .05, 'Pause holds the smoothed response despite new source values')
  await music({ energy: 1 }); await advance(1.5)
  const loud = await shot('energy-settled')
  const settled = await status()
  assert(settled.channels.audioEnergy > .999, 'Sustained energy settles to its bounded destination')
  assert(settled.choreography.activeContributionCount === 5 && settled.choreography.diagnostics.length === 0, 'Five real shared choreography contributions reach canonical targets without diagnostics')
  await music({ energy: 0 }); assert(diff(loud, await shot('release-onset')) < .05, 'Continuous release starts from the current value')
  const falling = await advance(.1)
  assert(falling.channels.audioEnergy > .4 && falling.channels.audioEnergy < .7, 'Shared choreography releases smoothly')
  await advance(1.5); assert(diff(quiet, await shot('release-settled')) < .1, 'Release restores the quiet program without residual modulation')
  await music({ energy: .5 }); await advance(1.5); const steady = await shot('steady')
  await music({ energy: .5, build: 1 }); const buildState = await advance(.3)
  assert(buildState.channels.buildPressure > .5 && buildState.channels.buildPressure < .8, 'Shared build pressure has a bounded smoothed attack')
  assert(diff(steady, await shot('build-midpoint')) > .5, 'Smoothed build pressure visibly concentrates the floor program')
  await music({ energy: .5 }); await advance(1.5)
  assert(diff(steady, await shot('build-restored')) < .1, 'Ending the supported build restores the selected program')
  await music({ energy: .5, vocal: 1 }); await advance(.3)
  assert(diff(steady, await shot('vocal-restraint')) > 1, 'Supported vocals produce visible smoothed density restraint')
  await music({ energy: .5 }); await advance(2)
  assert(diff(steady, await shot('vocal-restored')) < .1, 'Vocal restraint releases back to the selected program')

  // Automatic selection crossfades; manual edits always take ownership now.
  await set({ [P.musicResponse]: 0, [P.pattern]: 'nightshift' }); const base = await shot('transition-base')
  await set({ [P.pattern]: 'crossfade-checker' }); const next = await shot('transition-next')
  await music({ energy: .5 }); await set({ [P.pattern]: 'nightshift', [P.patternChange]: true, [P.trigger]: 'kick' })
  await emit('kick'); assert(diff(base, await shot('transition-start')) < .05, 'Automatic transition begins at the outgoing program')
  await advance(.15); const half = await shot('transition-midpoint')
  assert(diff(base, half) > 1 && diff(next, half) > 1, 'Automatic transition has a visibly intermediate 150 ms frame')
  await advance(.5, true); assert(diff(half, await shot('transition-paused')) < .05, 'Pause holds an in-progress pattern crossfade')
  await advance(.16); assert(diff(next, await shot('transition-complete')) < .05, 'The 300 ms transition restores full incoming-program weight')
  await emit('kick'); await advance(.1); await set({ [P.pattern]: 'nightshift' })
  assert(diff(base, await shot('manual-takeover')) < .05, 'Same-value manual selection cancels an active automatic crossfade immediately')
  assert((await status()).parameters.persistentValues[P.patternChange] === true, 'Manual takeover keeps Pattern Change enabled')
  await emit('kick'); await advance(.1); await set({ [P.patternChange]: false })
  assert(diff(base, await shot('pattern-change-off')) < .05, 'Pattern Change OFF immediately restores the authored base during a fade')

  await set({ [P.musicResponse]: 1 }); await music({ energy: .5 }); await advance(1.5)
  const patterns = ['nightshift', 'crossfade-checker', 'runway', 'diamond-ripple', 'diagonal-relay', 'quadrant-exchange', 'midnight-sparse', 'full-house']
  const accentSignatures = new Set()
  for (const pattern of patterns) {
    await set({ [P.pattern]: pattern }); const before = await shot(`${pattern}-base`)
    await emit('kick'); await advance(.12); const kick = await shot(`${pattern}-kick`)
    measurements[`${pattern}-kick`] = diff(before, kick)
    assert(measurements[`${pattern}-kick`] > .015, `${pattern}: kick visibly affects its spatial program`)
    const difference = Buffer.alloc(kick.data.length)
    for (let i = 0; i < difference.length; i++) difference[i] = Math.abs(kick.data[i] - before.data[i])
    accentSignatures.add(createHash('sha256').update(difference).digest('hex'))
    await advance(.4); assert(diff(before, await shot(`${pattern}-kick-restored`)) < .05, `${pattern}: kick envelope restores the current base`)
    await emit('drop'); await advance(.25)
    measurements[`${pattern}-drop`] = diff(before, await shot(`${pattern}-drop`))
    assert(measurements[`${pattern}-drop`] > .015, `${pattern}: drop visibly affects its spatial program`)
    await advance(.5); assert(diff(before, await shot(`${pattern}-drop-restored`)) < .05, `${pattern}: drop envelope restores the current base`)
  }
  assert(accentSignatures.size === 8, 'All eight rendered kick responses have distinct spatial signatures')

  await set({ [P.musicResponse]: 0 }); const authored = await shot('response-off')
  await music({ energy: 1, bass: 1, high: 1, vocal: 1, build: 1 }); await advance(.5); await emit('drop')
  assert(diff(authored, await shot('response-off-active'), [0, 0, 1, 1]) < .05, 'Music Response zero remains authoritative over smoothed routes and impulses')
  await set({ [P.musicResponse]: 1, [P.coverage]: 0 }); const noCoverage = await shot('coverage-off')
  await emit('kick'); await advance(.12); assert(diff(noCoverage, await shot('coverage-off-kick')) < .05, 'Coverage zero cannot be reopened by choreography')
  await set({ [P.master]: 0 }); const dark = await shot('master-off', false)
  await emit('snare'); assert(diff(dark, await shot('master-off-snare', false), [0, 0, 1, 1]) < .05, 'Master zero cannot be reopened by choreography')
  await set({ [P.master]: .85, [P.coverage]: .75, [P.pattern]: 'nightshift' })
  const values = (await status()).parameters.persistentValues
  await music({ energy: .5, event: 'drop', timeSec: 0 })
  const reset = await status()
  assert(reset.choreography.resetCount > 0 && reset.channels.audioEnergy === .5, 'Seek/loop clears shared smoothing history and reconstructs current facts')
  await shot('seek-restored')
  await music({}, false); const absent = await shot('no-audio')
  await set({ [P.musicResponse]: 0 }); assert(diff(absent, await shot('no-audio-off'), [0, 0, 1, 1]) < .05, 'Unavailable audio restores authored output')
  await music({ energy: .5 }); const reentry = await page.evaluate(() => globalThis.__nightshiftProduction.reenter())
  await shot('reentry')
  assert(reentry.modules.failedModuleCount === 0 && reentry.choreography.activeContributionCount === 5, 'Fresh native re-entry reconnects shared choreography cleanly')
  assert(values[P.pattern] === 'nightshift' && values[P.patternChange] === false && !Object.keys(values).some(k => k.includes('audioEnergy')), 'Choreography does not persist runtime routes or take over saved Pattern')
  assert(visibleCaptures > 50, `Ball and ceiling remain visible in ${visibleCaptures} enabled captures`)
  assert(errors.length === 0 && reentry.choreography.diagnostics.length === 0, 'No browser, shader or choreography errors')
  const report = { checks, measurements, visibleCaptures, errors, performance: reentry.snapshot.performance }
  await writeFile(resolve(out, 'report.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ output: out, checks: checks.length, performance: report.performance }))
} finally { await browser?.close(); await server.close() }

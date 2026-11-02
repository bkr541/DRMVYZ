// Paired production runtimes: identical audio/camera/native phase; only Phase 5
// target routes are omitted from the baseline test registry. No mocked Director.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import { chromium } from '@playwright/test'
import sharp from 'sharp'
const root = resolve(import.meta.dirname, '../..'), out = resolve(root, 'artifacts/cinema2-psylo-phase5')
await mkdir(out, { recursive: true })
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0 }, clearScreen: false })
let browser, on, off, eventId = 700
const checks = [], captures = [], errors = []
const check = (ok, name) => { assert.ok(ok, name); checks.push(name) }
const state = p => p.evaluate(() => globalThis.__psyloProduction.status())
const both = async (method, ...args) => {
  for (const p of [on, off]) await p.evaluate(([m, a]) => globalThis.__psyloProduction[m](...a), [method, args])
}
const set = values => both('set', values)
const music = (options, enabled = true) => both('music', options, enabled)
const advance = (seconds, paused = false) => both('advance', seconds, 120, paused, true)
const quiet = { energy: .2, bass: .5, high: .5, vocal: 0, build: 0, sectionIntensity: .2 }
const energetic = { energy: .9, bass: .8, high: .8, vocal: 0, build: 0, sectionIntensity: 1, spectralFlux: .9, tension: .8 }
async function png(p, name) {
  const s = await state(p)
  check(s.runtime.phase === 'running' && !s.modules.failedModuleCount && !s.modules.degradedModuleCount && !s.render.failedPassCount, `${name}: production health`)
  const image = await p.locator('canvas').screenshot({ path: resolve(out, `${name}.png`) })
  captures.push({ name, director: s.director, choreography: s.choreography, parameters: s.parameters.persistentValues }); return image
}
async function diff(a, b) {
  const x = await sharp(a).removeAlpha().raw().toBuffer(), y = await sharp(b).removeAlpha().raw().toBuffer()
  assert.equal(x.length, y.length); let sum = 0
  for (let i = 0; i < x.length; i++) sum += Math.abs(x[i] - y[i])
  return sum / x.length
}
async function pair(name, different = true) {
  const a = await state(on), b = await state(off)
  check(Math.abs(a.transport.timeSec - b.transport.timeSec) < .00001 && JSON.stringify(a.camera) === JSON.stringify(b.camera), `${name}: matched transport and final camera`)
  const delta = await diff(await png(on, `${name}-director`), await png(off, `${name}-baseline`))
  check(different ? delta > .003 : delta < .001, `${name}: ${different ? 'Director has a visible bounded consumer' : 'Director restores the same authored output'} (difference ${delta.toFixed(6)})`)
}
async function event(kind, context = energetic) {
  const s = await state(on)
  await music({ ...context, timeSec: s.transport.timeSec + .001, eventTime: s.transport.timeSec + .001, event: kind, eventId: ++eventId, beatIndex: 32 })
}
try {
  await server.listen()
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
  for (const enabled of [true, false]) {
    const p = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
    p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
    await p.goto(`http://127.0.0.1:${server.httpServer.address().port}/src/test/browser/cinema2-psylo-production.html${enabled ? '' : '?director=off'}`, { waitUntil: 'domcontentloaded' })
    await p.waitForFunction(() => globalThis.__psyloProduction?.status().modules.estimatedGpuBytes > 0, undefined, { timeout: 45000 })
    if (enabled) on = p; else off = p
  }
  check((await state(on)).directorEnabled && !(await state(off)).directorEnabled, 'Only the baseline registry omits Phase 5 routes')
  await set({ cameraMode: 'fixed', cameraMotion: false, amount: 1, emission: 0, spores: 0, musicResponse: 1 })
  await music(quiet); await advance(2); await pair('quiet')
  await music(energetic); await advance(.5); await pair('energetic')
  await music({ ...energetic, vocal: 1 }); await advance(.6); await pair('vocal-restraint')
  const build = { ...quiet, sectionBuild: true, sectionProgress: .95, sectionIntensity: 1, spectralFlux: .7, tension: .8 }
  await music(build); await advance(.9); await pair('build-context')
  check((await state(on)).audio.features.buildProgress.value === 0 && (await state(on)).director.context.build.value > 0, 'Director build meaning uses supported section context while raw progress remains zero')
  await event('drop', build); await advance(.1); await pair('impact-release')
  const beforePause = await on.locator('canvas').screenshot()
  await advance(1, true)
  check(await diff(beforePause, await on.locator('canvas').screenshot()) < .001, 'Host pause gate holds the composed Director result exactly')
  await advance(.02, false); await music(build); await advance(1)
  await music(quiet); await advance(.12); await pair('section-transition')
  const saved = (await state(on)).parameters.persistentValues
  check(saved['psylo-pattern'] === 'mycelium-tide' && saved['psylo-pattern-change'] === false, 'Director leaves authored Pattern and permission untouched')
  check(JSON.stringify(saved) === JSON.stringify((await state(off)).parameters.persistentValues), 'Both arms retain identical saved manual settings')
  await set({ musicResponse: 0 }); await pair('response-zero', false)
  await set({ musicResponse: 1, motion: false, emission: 1 }); await music(quiet); await advance(.8); await pair('light-context')
  for (const controls of [{ motion: false, emission: 0, spores: 0 }, { motion: true, amount: 0, emission: 0, spores: 0 }, { motion: true, amount: 1, speed: 0, emission: 0, spores: 0 }, { motion: false, master: 0, emission: 1, spores: 1 }]) {
    await set({ motion: true, amount: 1, speed: 1, master: .85, ...controls }); await music(energetic); await advance(1)
    const held = await on.locator('canvas').screenshot(); await event('drop', { ...energetic, build: 1 }); await advance(.1)
    check(await diff(held, await on.locator('canvas').screenshot()) < .001, `Strong Director context cannot bypass hard limits: ${JSON.stringify(controls)}`)
  }
  await set({ motion: true, amount: 1, speed: 1, master: .85, emission: 0, spores: 0 }); await music(energetic); await advance(.3)
  await music({}, false); await pair('missing-context', false)
  await music({ ...quiet, event: 'drop', eventId: ++eventId }); await advance(.02)
  check((await state(on)).parameters.persistentValues['psylo-pattern'] === 'mycelium-tide', 'Context return cannot replace the manual Pattern')
  await both('seek', 0); await set({ musicResponse: 0 }); await pair('seek-base', false)
  const disposed = []
  for (const p of [on, off]) disposed.push(await p.evaluate(() => globalThis.__psyloProduction.dispose()))
  check(disposed.every(s => s.modules.activeResourceLeaseCount === 0 && s.choreography.activeEnvelopeCount === 0 && s.choreography.activeContributionCount === 0), 'Both runtimes dispose resources and choreography cleanly')
  check(errors.length === 0, `No browser/shader errors: ${errors.join('; ')}`)
  await writeFile(resolve(out, 'report.json'), JSON.stringify({ checks, captures, errors, disposed }, null, 2) + '\n')
  console.log(JSON.stringify({ output: out, checks: checks.length, captures: captures.length, errors }))
} catch (error) {
  await writeFile(resolve(out, 'failed-report.json'), JSON.stringify({ checks, captures, errors, failure: String(error), on: on ? await state(on).catch(() => null) : null, off: off ? await state(off).catch(() => null) : null }, null, 2) + '\n'); throw error
} finally { await browser?.close(); await server.close() }

// Focused Phase 4 gate: actual production geometry/emission, shared targets and lifecycle.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import { chromium } from '@playwright/test'
import sharp from 'sharp'
const root = resolve(import.meta.dirname, '../..'), out = resolve(root, 'artifacts/cinema2-psylo-phase4')
await mkdir(out, { recursive: true })
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0 }, clearScreen: false })
let browser, page, eventId = 400
const checks = [], captures = [], errors = []
const check = (ok, name) => { assert.ok(ok, name); checks.push(name) }
const state = () => page.evaluate(() => globalThis.__psyloProduction.status())
const set = v => page.evaluate(x => globalThis.__psyloProduction.set(x), v)
const music = (v = {}, enabled = true) => page.evaluate(([x, on]) => globalThis.__psyloProduction.music(x, on), [v, enabled])
const neutral = { energy: 1, bass: 0, high: 1, vocal: 0, build: 0 }
const advance = (seconds, paused = false) => page.evaluate(([s, p]) => globalThis.__psyloProduction.advance(s, 120, p, true), [seconds, paused])
async function png(name) {
  const s = await state()
  check(s.runtime.phase === 'running' && !s.modules.failedModuleCount && !s.modules.degradedModuleCount && !s.render.failedPassCount, `${name}: production health`)
  const buffer = await page.locator('canvas').screenshot({ path: resolve(out, `${name}.png`) })
  captures.push({ name, choreography: s.choreography, parameters: s.parameters.persistentValues }); return buffer
}
async function diff(a, b) {
  const x = await sharp(a).removeAlpha().raw().toBuffer(), y = await sharp(b).removeAlpha().raw().toBuffer()
  let sum = 0; assert.equal(x.length, y.length)
  for (let i = 0; i < x.length; i++) sum += Math.abs(x[i] - y[i])
  return sum / x.length
}
async function event(kind) {
  const s = await state()
  await music({ ...neutral, event: kind, eventId: ++eventId, beatIndex: 32, timeSec: s.transport.timeSec + .001 })
}
const patterns = ['mycelium-tide', 'gill-spiral', 'spore-choir', 'canopy-breath', 'fairy-ring', 'root-relay', 'bloom-ascent', 'psylo-release']
try {
  await server.listen()
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
  page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/src/test/browser/cinema2-psylo-production.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => globalThis.__psyloProduction?.status().modules.estimatedGpuBytes > 0, undefined, { timeout: 45000 })
  await set({ cameraMode: 'fixed', cameraMotion: false, amount: 1, emission: 0, spores: 0, musicResponse: 1 })
  await music(neutral); await advance(2)
  // The response-zero reference shares EXACT native phase/camera with each accent.
  // Energy=high=1 means there is no unrelated range/brightness attenuation.
  for (const pattern of patterns) {
    await set({ pattern, musicResponse: 1 }); await music(neutral); await advance(1)
    await event('kick'); await advance(.02)
    const accent = await png(`${pattern}-kick`)
    await set({ musicResponse: 0 }); const base = await png(`${pattern}-base`)
    check(await diff(accent, base) > .005, `${pattern}: shared kick visibly changes geometry at the identical phase`)
  }
  await set({ pattern: 'psylo-release', musicResponse: 1 }); await music(neutral); await advance(1)
  for (const kind of ['snare', 'drop']) {
    await event(kind); await advance(.02)
    const accent = await png(`${kind}-accent`)
    await page.evaluate(() => globalThis.__psyloProduction.repeatMusic())
    check(await diff(accent, await page.locator('canvas').screenshot()) < .001, `${kind}: held publication does not retrigger the envelope`)
    await advance(1); await music(neutral)
    const released = await png(`${kind}-released`)
    check((await state()).choreography.activeEnvelopeCount === 0, `${kind}: shared envelope fully clears`)
    await set({ musicResponse: 0 })
    check(await diff(released, await page.locator('canvas').screenshot()) < .001, `${kind}: released geometry exactly matches authored base at the same phase`)
    await set({ musicResponse: 1 })
  }
  await music({ ...neutral, build: 1 }); await advance(1)
  const build = await png('build-convergence'); await set({ musicResponse: 0 })
  check(await diff(build, await page.locator('canvas').screenshot()) > .005, 'Supported build has a bounded visible convergence consumer')
  // Automatic transition at zero delta keeps its source, then visibly interpolates.
  await set({ pattern: patterns[0], patternChange: true, trigger: 'beat', musicResponse: 0 }); await music(neutral)
  const start = await page.locator('canvas').screenshot(); await event('beat')
  check(await diff(start, await page.locator('canvas').screenshot()) < .001, 'Automatic change starts at the existing geometry without a cut')
  check((await state()).parameters.persistentValues['psylo-pattern'] === patterns[0], 'Automatic transition does not write the authored Pattern')
  await music(neutral); await advance(.15); const middle = await png('transition-middle')
  await advance(1, true)
  check(await diff(middle, await page.locator('canvas').screenshot()) < .001, 'Pause holds an unfinished pattern blend exactly')
  // Compare the held mixture with both manual endpoints at its exact native phase.
  await set({ pattern: patterns[1] }); const destination = await page.locator('canvas').screenshot()
  await set({ pattern: patterns[0] }); const source = await page.locator('canvas').screenshot()
  check(await diff(middle, source) > .005 && await diff(middle, destination) > .005, 'Automatic middle is visibly distinct from both pure native endpoints')
  await set({ pattern: patterns[5] }); const manual = await png('manual-takeover')
  await page.evaluate(() => globalThis.__psyloProduction.repeatMusic())
  check(await diff(manual, await page.locator('canvas').screenshot()) < .001, 'Manual edit takes immediate authority while Pattern Change remains ON')
  check((await state()).parameters.persistentValues['psylo-pattern-change'] === true, 'Manual edit preserves Pattern Change permission')
  await advance(.01, false); await event('beat'); await music(neutral); await advance(.4)
  const completed = await png('transition-completed'); await set({ pattern: patterns[6] })
  check(await diff(completed, await page.locator('canvas').screenshot()) < .001, 'Automatic transition settles exactly onto the next native program')
  // Geometry OFF isolates the separate spatial emission choreography.
  await set({ patternChange: false, motion: false, emission: 1, musicResponse: 1 }); await music(neutral); await advance(1)
  await event('kick'); await advance(.02); const lit = await png('spatial-light-accent')
  await set({ musicResponse: 0 })
  check(await diff(lit, await page.locator('canvas').screenshot()) > .003, 'Spatial emission pulse remains visible independently of geometry motion')
  for (const values of [{ motion: false, emission: 0, spores: 0 }, { amount: 0, emission: 0, spores: 0 }, { speed: 0, emission: 0, spores: 0 }, { motion: false, master: 0, emission: 1, spores: 1 }]) {
    await set({ motion: true, amount: 1, speed: 1, master: .85, ...values, musicResponse: 1 }); await music(neutral); await advance(1)
    const before = await page.locator('canvas').screenshot(); await event('drop'); await advance(.02)
    check(await diff(before, await page.locator('canvas').screenshot()) < .001, `Hard user limits hold under drop: ${JSON.stringify(values)}`)
  }
  await set({ motion: true, amount: 1, speed: 1, master: .85, emission: 0, spores: 0, musicResponse: 1 }); await music(neutral)
  await event('drop'); await advance(.02); await music({}, false)
  const gap = await png('analysis-gap-reset'); await set({ musicResponse: 0 })
  check(await diff(gap, await page.locator('canvas').screenshot()) < .001, 'Analysis gap clears response to the authored base')
  await set({ musicResponse: 1 }); await music(neutral); await event('drop'); await advance(.02)
  await page.evaluate(() => globalThis.__psyloProduction.seek(0)); const sought = await png('seek-reset')
  await set({ musicResponse: 0 })
  check(await diff(sought, await page.locator('canvas').screenshot()) < .001, 'Seek clears stale drop response')
  const disposed = await page.evaluate(() => globalThis.__psyloProduction.dispose())
  check(disposed.modules.activeResourceLeaseCount === 0, 'All module resources released')
  check(disposed.choreography.activeEnvelopeCount === 0 && disposed.choreography.activeContributionCount === 0, 'Shared choreography disposed cleanly')
  check(errors.length === 0, `No browser/shader errors: ${errors.join('; ')}`)
  await writeFile(resolve(out, 'report.json'), JSON.stringify({ checks, captures, errors, disposed }, null, 2) + '\n')
  console.log(JSON.stringify({ output: out, checks: checks.length, captures: captures.length, errors }))
} catch (error) {
  await writeFile(resolve(out, 'failed-report.json'), JSON.stringify({ checks, captures, errors, failure: String(error), state: page ? await state().catch(() => null) : null }, null, 2) + '\n'); throw error
} finally { await browser?.close(); await server.close() }

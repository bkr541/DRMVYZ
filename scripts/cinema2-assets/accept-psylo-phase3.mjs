// Shared Audio Intelligence publications through the actual Cinema 2.0 production path.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import { chromium } from '@playwright/test'
import sharp from 'sharp'
const root = resolve(import.meta.dirname, '../..'), out = resolve(root, 'artifacts/cinema2-psylo-phase3')
await mkdir(out, { recursive: true })
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0 }, clearScreen: false })
let browser, page
const checks = [], captures = [], errors = []
const check = (ok, name) => { assert.ok(ok, name); checks.push(name) }
const state = () => page.evaluate(() => globalThis.__psyloProduction.status())
const set = v => page.evaluate(x => globalThis.__psyloProduction.set(x), v)
const music = (v = {}, enabled = true) => page.evaluate(([x, on]) => globalThis.__psyloProduction.music(x, on), [v, enabled])
const advance = (seconds, paused = false) => page.evaluate(([s, p]) => globalThis.__psyloProduction.advance(s, 120, p, true), [seconds, paused])
const id = key => `psylo-${key.replace(/[A-Z]/g, x => '-' + x.toLowerCase())}`
async function ready() {
  await page.waitForFunction(() => { const s = globalThis.__psyloProduction?.status(); return s && (s.modules.estimatedGpuBytes > 0 || s.modules.failedModuleCount > 0 || s.modules.degradedModuleCount > 0) }, undefined, { timeout: 45000 })
  await page.waitForTimeout(100)
}
async function reset(values = {}) {
  await page.evaluate(() => globalThis.__psyloProduction.reenter()); await ready()
  await set({ cameraMode: 'fixed', cameraMotion: false, spores: 0, amount: 1, ...values })
  await music({ energy: .5, bass: 0, high: 0 }); await advance(2)
}
async function png(name) {
  const s = await state()
  check(s.runtime.phase === 'running' && s.modules.failedModuleCount === 0 && s.modules.degradedModuleCount === 0 && s.render.failedPassCount === 0, `${name}: production health`)
  const image = await page.locator('canvas').screenshot({ path: resolve(out, `${name}.png`) })
  captures.push({ name, audio: s.audio?.upstream, parameters: s.parameters.persistentValues }); return image
}
async function difference(a, b) {
  const x = await sharp(a).removeAlpha().raw().toBuffer(), y = await sharp(b).removeAlpha().raw().toBuffer()
  assert.equal(x.length, y.length); let sum = 0
  for (let i = 0; i < x.length; i++) sum += Math.abs(x[i] - y[i])
  return sum / x.length
}
let eventId = 200
async function event(kind, extra = {}) {
  const s = await state()
  return music({ energy: .5, bass: 0, high: 0, event: kind, eventId: ++eventId, beatIndex: 32, timeSec: s.transport.timeSec + .01, ...extra })
}
try {
  await server.listen()
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
  page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/src/test/browser/cinema2-psylo-production.html`, { waitUntil: 'domcontentloaded' }); await ready()
  if (!process.argv.includes('--lifecycle')) {
  // Shared continuous facts change geometry even with camera/phase held.
  await reset(); await set({ speed: 0 })
  // Speed zero is a user hold: validate continuously shaped motion at an active,
  // held timestamp instead, without advancing phase between publications.
  await set({ speed: 1 }); await music({ energy: .02, bass: 0, high: 0 }); const quiet = await png('quiet')
  await music({ energy: 1, bass: 1, high: 1 }); const loud = await png('energetic')
  check(await difference(quiet, loud) > .03, 'Quiet and energetic shared facts produce distinct geometry')
  await music({ energy: 1, bass: 1, high: 1, vocal: 1 }); const vocal = await png('vocal')
  check(await difference(loud, vocal) > .02, 'Supported vocals visibly restrain the forest')
  await music({ energy: .5, bass: 0, high: 0, build: 0 }); await png('neutral')
  for (const kind of ['kick', 'snare', 'downbeat', 'drop']) {
    await music({ energy: .5 }); const a = await page.locator('canvas').screenshot()
    await event(kind); const b = await png(kind)
    check(await difference(a, b) > .02, `${kind}: fresh shared event changes actual geometry`)
    await advance(1); await music({ energy: .5 })
  }
  await music({ energy: .5, build: 0 }); const beforeBuild = await png('pre-build')
  await music({ energy: .5, build: .95 }); const build = await png('build')
  check(await difference(beforeBuild, build) > .02, 'Build progress changes forest structure')
  await set({ musicResponse: 0 }); const zero = await png('response-zero')
  await event('kick', { energy: 1, bass: 1, high: 1, vocal: 1, build: 1 }); check(await difference(zero, await page.locator('canvas').screenshot()) < .001, 'Response zero immediately restores authored geometry and suppresses event modulation')
  // Runtime pattern changes are compared with manual renders at the exact held phase.
  const patterns = ['mycelium-tide', 'gill-spiral', 'spore-choir', 'canopy-breath', 'fairy-ring', 'root-relay', 'bloom-ascent', 'psylo-release']
  await reset({ musicResponse: 0 }); await set({ speed: 0 }); await page.evaluate(() => globalThis.__psyloProduction.seek(0))
  const zeroReferences = []
  for (const pattern of patterns) { await set({ pattern }); zeroReferences.push(await page.locator('canvas').screenshot()) }
  await reset({ musicResponse: 0 }); await set({ speed: 0 })
  const references = []
  for (const pattern of patterns) { await set({ pattern }); references.push(await png(`manual-${pattern}`)) }
  for (let i = 1; i < references.length; i++) check(await difference(references[0], references[i]) > .03, `${patterns[i]} remains a native geometry program`)
  const matchesZero = async (index, message) => check(await difference(await page.locator('canvas').screenshot(), zeroReferences[index]) < .001, message)
  const matches = async (index, message) => check(await difference(await page.locator('canvas').screenshot(), references[index]) < .001, message)
  const triggers = ['beat', 'kick', 'snare', 'downbeat', 'beat2', 'beat4', 'bar', 'bar4', 'bar8', 'phrase', 'drop']
  for (const trigger of triggers) {
    await music({ energy: .5 }); await set({ pattern: patterns[0], patternChange: true, trigger })
    const kind = trigger.startsWith('bar') ? 'bar' : trigger === 'phrase' || trigger === 'drop' || trigger === 'kick' || trigger === 'snare' || trigger === 'downbeat' ? trigger : 'beat'
    await event(kind); await matches(1, `${trigger}: fresh canonical event selects the next rendered pattern`)
    await png(`trigger-${trigger}`)
    const saved = (await state()).parameters.persistentValues
    check(saved[id('pattern')] === patterns[0] && saved[id('patternChange')] === true && saved[id('trigger')] === trigger, `${trigger}: saved authored controls remain unchanged`)
    await page.evaluate(() => globalThis.__psyloProduction.repeatMusic()); await matches(1, `${trigger}: duplicate publication cannot double-switch`)
    await set({ patternChange: false }); await event(kind); await matches(0, `${trigger}: permission OFF holds authored pattern`)
  }
  await music({ energy: .5 }); await set({ pattern: patterns[0], patternChange: true, trigger: 'beat' }); await event('beat')
  await set({ pattern: patterns[5] }); await matches(5, 'Manual Pattern edit takes visible effect during an active event')
  check((await state()).parameters.persistentValues[id('patternChange')] === true, 'Manual Pattern edit leaves Pattern Change ON')
  await page.evaluate(() => globalThis.__psyloProduction.repeatMusic()); await matches(5, 'Already-active event cannot cancel manual edit')
  await event('beat'); await matches(6, 'Next fresh event resumes advancement from the chosen base')
  await set({ pattern: patterns[5] }); await matches(5, 'Reselecting the same authored Pattern reclaims the base')
  // Pause/analysis revision/gap/seek/loop/source transitions keep authority deterministic.
  await advance(.1, true); await event('beat'); await matches(5, 'Paused events are latched without switching')
  await advance(.1, false); await matches(5, 'Resume does not replay a paused beat')
  await event('beat'); await matches(6, 'Fresh beat after resume still switches')
  await music({ event: 'beat', beatIndex: 32, eventId: ++eventId, analysisRevision: 'psylo-refresh', timelineRevision: 'psylo-refresh' }); await matches(6, 'Analysis refresh preserves runtime base and latches active events')
  await music({}, false); const gapPose = await page.locator('canvas').screenshot(); await advance(.2)
  await matches(6, 'Analysis gap does not replace the current pattern')
  await music({ energy: .5 }); await matches(6, 'Analysis return preserves runtime base')
  check(await difference(gapPose, await page.locator('canvas').screenshot()) < .001, 'Response-zero fallback remains stable across analysis gaps')
  await page.evaluate(() => globalThis.__psyloProduction.seek(.1)); await matchesZero(5, 'Backward seek reconstructs authored base')
  await event('beat'); await matchesZero(6, 'Fresh event works after seek')
  await page.evaluate(() => globalThis.__psyloProduction.seek(0)); await matchesZero(5, 'Loop restart reconstructs authored base')
  await music({ trackId: 'psylo-next-track', energy: .5, event: 'beat', eventId: ++eventId }); await matchesZero(5, 'Track change latches activation event and restores authored base')
  }
  // Real playback advances native geometry even if analysis is unavailable.
  await reset(); await music({}, false); const idle = await page.locator('canvas').screenshot(); await advance(1.1)
  check(await difference(idle, await png('analysis-gap-motion')) > .03, 'Analysis loss does not freeze valid playback motion')
  await music({ energy: .8, bass: .7, high: .8 }); await advance(.2)
  const pausedImage = await png('before-pause'); const cameraBeforePause = (await state()).camera; await advance(1, true)
  const pausedOutput = await png('paused'); const pauseDiff = await difference(pausedImage, pausedOutput)
  check(JSON.stringify(cameraBeforePause) === JSON.stringify((await state()).camera), 'Pause keeps the final camera pose')
  check(pauseDiff < .001, 'Pause holds audio-reactive geometry and envelopes')
  await advance(.3, false); check(await difference(pausedImage, await png('resumed')) > .03, 'Resume restores reactive motion')
  await set({ motion: false, emission: 0, spores: 0 }); const disabled = await page.locator('canvas').screenshot()
  await event('drop', { energy: 1, bass: 1, high: 1, build: 1 }); check(await difference(disabled, await page.locator('canvas').screenshot()) < .001, 'Music cannot re-enable disabled geometry, emission or spores')
  // Independent same-phase control/structure comparisons exclude ordinary motion.
  await reset({ musicResponse: 1 }); await music({ energy: .5, build: 0 }); const plain = await png('build-baseline')
  await music({ energy: .5, build: .95 }); check(await difference(plain, await png('build-proof')) > .02, 'Build changes structure with camera and native phase held')
  await music({ energy: 1, bass: 1, high: 1, build: .95 })
  const responses = []
  for (const amount of [0, .8, 1]) { await set({ musicResponse: amount }); responses.push(await png(`response-${amount}`)) }
  check(await difference(responses[0], responses[2]) > .03, 'Music Response minimum/default/maximum have real visible consumers')
  await set({ amount: 0, emission: 0, spores: 1 }); await music({ energy: .5, high: 0 }); const lowHigh = await png('highs-low')
  await music({ energy: .5, high: 1 }); check(await difference(lowHigh, await png('highs-high')) > .003, 'High-frequency energy independently changes spore activity under user limits')
  await reset({ bpmSync: false, musicResponse: 1 }); await music({ energy: .5 }); const unsynced = await png('unsynced-neutral')
  await event('kick'); check(await difference(unsynced, await png('unsynced-kick')) > .02, 'BPM Sync OFF keeps rhythmic audio response active')
  await set({ motion: false, emission: 0, spores: 0 })
  await page.evaluate(() => globalThis.__psyloProduction.inspector(true))
  check(await page.locator(`[data-cinema2-parent-group="master-controls"] [data-cinema2-control-id="${id('musicResponse')}"]`).count() === 1, 'Music Response is a real Master Control')
  await page.evaluate(() => globalThis.__psyloProduction.inspector(false))
  await page.evaluate(() => globalThis.__psyloProduction.reenter(true)); await ready()
  check((await state()).parameters.persistentValues[id('motion')] === false, 'Re-entry preserves hard disables')
  const disposed = await page.evaluate(() => globalThis.__psyloProduction.dispose())
  check(disposed.modules.activeResourceLeaseCount === 0, 'All module resource leases released')
  check(errors.length === 0, `No browser/shader errors: ${errors.join('; ')}`)
  await writeFile(resolve(out, process.argv.includes('--lifecycle') ? 'lifecycle-report.json' : 'report.json'), JSON.stringify({ checks, captures, errors, disposed }, null, 2) + '\n')
  console.log(JSON.stringify({ output: out, checks: checks.length, captures: captures.length, errors }))
} catch (error) {
  await writeFile(resolve(out, 'failed-report.json'), JSON.stringify({ checks, captures, errors, failure: String(error), state: page ? await state().catch(() => null) : null }, null, 2) + '\n'); throw error
} finally { await browser?.close(); await server.close() }

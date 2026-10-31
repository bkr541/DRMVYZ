/* global window */
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import sharp from 'sharp'
const root = resolve(import.meta.dirname, '../..'), out = resolve(root, 'artifacts/glassfall-phase5')
const server = await createServer({ root, clearScreen: false, server: { host: '127.0.0.1', port: 0 } })
let browser
const errors = [], report = []
try {
  await server.listen()
  const url = `http://127.0.0.1:${server.httpServer.address().port}/src/test/browser/cinema2-glassfall-phase5.html`
  if (process.argv.includes('--serve')) { console.log(`GLASSFALL phase 5: ${url}?live=1`); await new Promise(() => {}) }
  await mkdir(out, { recursive: true })
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
  const page = await browser.newPage({ viewport: { width: 960, height: 720 }, deviceScaleFactor: 1 })
  page.on('pageerror', error => errors.push(error.message)); page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto(url, { waitUntil: 'commit', timeout: 15000 })
  const ready = () => page.waitForFunction(() => window.glassfallDirector?.status().modules.modules.some(m => m.activeResourceLeaseCount > 0), undefined, { timeout: 15000 })
  await ready().catch(error => { throw new Error(`${error}: ${errors.join('\n')}`) })
  const api = (name, ...args) => page.evaluate(({ name, args }) => window.glassfallDirector[name](...args), { name, args })
  const pixels = async name => sharp(await page.locator('canvas').screenshot(name ? { path: resolve(out, `${name}.png`) } : {})).removeAlpha().raw().toBuffer()
  const diff = (a, b) => a.reduce((sum, v, i) => sum + Math.abs(v - b[i]), 0) / a.length
  const clean = async (values = {}) => {
    await api('music', { timeSec: 0, energy: 0, event: null })
    await api('reenter', false); await ready(); await api('set', { speed: 0, sequenceSpeed: 0, response: 1, ...values })
  }
  await clean({ pattern: 'prismTrace' })
  await api('music', { timeSec: .1, energy: .6, bass: .5, high: .8, spectralFlux: .8, tension: .8, build: .5, sectionIntensity: .8 })
  await api('advance', .8)
  const inputs = (await api('status')).directorChannels
  assert(inputs.intensity > .2 && inputs.momentum > .2 && inputs.build > .2, 'Shared Director publishes real significant-moment context')
  const levels = []
  for (const directorInfluence of [0, .35, 1]) { await api('set', { directorInfluence }); levels.push(await pixels(`influence-${directorInfluence}`)) }
  const differences = [diff(levels[0], levels[1]), diff(levels[1], levels[2])]
  assert(differences.every(value => value > .01), `Director min/default/max must visibly differ: ${differences}`)
  await api('set', { directorInfluence: 0 }); assert(diff(levels[0], await pixels()) < .001, 'Zero restores exact phase-four choreography')
  report.push({ directorInputs: inputs, differences })
  // Macro section significance changes Director meaning while basic audio stays fixed.
  await clean({ directorInfluence: 1 })
  await api('music', { timeSec: .1, energy: .5, bass: .5, sectionIntensity: .05 }); await api('advance', .8)
  const restrained = await pixels(), low = (await api('status')).directorChannels.intensity
  await api('music', { timeSec: .9, energy: .5, bass: .5, sectionIntensity: 1 }); await api('advance', .8)
  const significant = await pixels(), high = (await api('status')).directorChannels.intensity
  assert(high > low && diff(restrained, significant) > .01, 'Macro significance enhances an otherwise identical authored response')
  report.push({ sectionSignificance: { low, high, difference: diff(restrained, significant) } })
  // Impact enhances the existing shared envelope without owning its duration or selection.
  await clean({ directorInfluence: 0 }); await api('music', { timeSec: .1, event: 'drop', eventId: 55 }); await api('advance', .14)
  const impactBase = await pixels(); assert((await api('status')).directorChannels.impact > 0)
  await api('set', { directorInfluence: 1 }); assert(diff(impactBase, await pixels('impact-enhanced')) > .01)
  await api('transport', { paused: true }); const paused = await pixels(); await api('advance', .5)
  assert(diff(paused, await pixels()) < .001, 'Paused Director presentation holds its meaning and pose')
  await api('set', { directorInfluence: 0 }); assert(diff(impactBase, await pixels()) < .001, 'Paused manual influence edit remains immediate')
  await api('transport', { paused: false }); await api('advance', 1)
  assert((await api('status')).channels.drop < .00001, 'Director never extends/owns the drop envelope')
  await clean({ directorInfluence: 1, pattern: 'prismTrace' })
  await api('music', { timeSec: .1, energy: .6, high: .7, build: .7, spectralFlux: .8 }); await api('advance', .6)
  await api('set', { response: 0 }); const authored = await pixels()
  await api('set', { directorInfluence: 0 }); assert(diff(authored, await pixels()) < .001, 'Music Reactivity zero takes precedence')
  await api('set', { response: 1, choreography: false, directorInfluence: 1 }); assert(diff(authored, await pixels()) < .001, 'Choreography OFF takes precedence')
  await clean({ directorInfluence: 1, patternChange: true, trigger: 'kick', response: 0 })
  await api('music', { timeSec: .1, event: 'kick', eventId: 60 })
  await api('set', { pattern: 'prismTrace', intensity: .45, scale: .9, spacing: 1.1, relief: .8, cyan: [.9, .04, .08, 1] })
  const chosen = await pixels(); await api('repeatMusic'); assert(diff(chosen, await pixels()) < .001, 'Director cannot cancel a manual Pattern edit')
  const saved = (await api('status')).parameters.persistentValues
  assert.equal(saved['glassfall-pattern-change'], true); assert.equal(saved['glassfall-pattern'], 'prismTrace')
  await api('advance', .3)
  const after = (await api('status')).parameters.persistentValues
  for (const name of ['glassfall-intensity','glassfall-scale','glassfall-spacing','glassfall-relief','glassfall-cyan']) assert.deepEqual(after[name], saved[name], `${name} remains user-owned`)
  await api('music', { timeSec: 0, trackId: 'replacement', revision: 'replacement-analysis', featuresAvailable: false })
  assert(Object.values((await api('status')).directorChannels).every(value => Math.abs(value) < .00001), 'Source/analysis reset clears stale Director meaning')
  const retired = await api('reenter', true); await ready(); assert.equal(retired.activeLeaseCount, 0)
  const status = await api('status'); assert.equal(status.modules.failedModuleCount, 0); assert.equal(status.render.failedPassCount, 0); assert.equal(status.choreography.diagnostics.length, 0)
  await api('showInspector', true); await page.screenshot({ path: resolve(out, 'inspector-director.png') })
  const disposed = await api('dispose'); assert.equal(disposed.activeLeaseCount, 0); assert.equal(disposed.estimatedGpuMemoryBytes, 0)
  assert.deepEqual(errors, [])
  await writeFile(resolve(out, 'report.json'), JSON.stringify({ report, retired, disposed, errors }, null, 2))
  console.log(`GLASSFALL phase 5 passed: bounded Director significance, manual authority, pause/reset, re-entry and disposal. ${out}`)
} finally { await browser?.close(); await server.close() }

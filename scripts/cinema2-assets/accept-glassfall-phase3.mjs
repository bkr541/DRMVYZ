/* global window */
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import sharp from 'sharp'
const root = resolve(import.meta.dirname, '../..'), out = resolve(root, 'artifacts/glassfall-phase3')
const server = await createServer({ root, clearScreen: false, server: { host: '127.0.0.1', port: 0 } })
let browser
const errors = [], report = []
try {
  await server.listen()
  const url = `http://127.0.0.1:${server.httpServer.address().port}/src/test/browser/cinema2-glassfall-phase3.html`
  if (process.argv.includes('--serve')) { console.log(`GLASSFALL phase 3: ${url}?live=1`); await new Promise(() => {}) }
  await mkdir(out, { recursive: true })
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
  const page = await browser.newPage({ viewport: { width: 960, height: 720 }, deviceScaleFactor: 1 })
  page.on('pageerror', error => errors.push(error.message)); page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto(url, { waitUntil: 'commit', timeout: 15000 })
  const ready = () => page.waitForFunction(() => window.glassfallAudio?.status().modules.modules.some(m => m.activeResourceLeaseCount > 0), undefined, { timeout: 15000 })
  await ready().catch(error => { throw new Error(`${error}: ${errors.join('\n')}`) })
  const api = (name, ...args) => page.evaluate(({ name, args }) => window.glassfallAudio[name](...args), { name, args })
  const pixels = async name => sharp(await page.locator('canvas').screenshot(name ? { path: resolve(out, `${name}.png`) } : {})).removeAlpha().raw().toBuffer()
  const diff = (a, b) => a.reduce((sum, v, i) => sum + Math.abs(v - b[i]), 0) / a.length
  const clean = async (values = {}) => {
    await api('music', { timeSec: 0, energy: 0, event: null })
    await api('reenter', false); await ready(); await api('set', { speed: 0, sequenceSpeed: 0, ...values })
  }
  const triggers = ['beat', 'kick', 'snare', 'downbeat', 'beat2', 'beat4', 'bar', 'bar4', 'bar8', 'phrase', 'drop']
  for (const trigger of triggers) {
    await clean({ response: 0, patternChange: true, trigger })
    const before = await pixels()
    const event = trigger.startsWith('beat') ? 'beat' : trigger.startsWith('bar') ? 'bar' : trigger
    await api('music', { timeSec: .1, event, eventId: 64, beatIndex: 64 })
    const after = await pixels()
    assert(diff(before, after) > .1, `${trigger}: must advance visible pattern`)
    await api('set', { pattern: 'cascade', patternChange: false }); assert(diff(after, await pixels()) < .001, `${trigger}: expected native pattern`)
    await api('set', { patternChange: true, pattern: 'prismTrace' }); const manual = await pixels()
    await api('repeatMusic'); assert(diff(manual, await pixels()) < .001, `${trigger}: stale event cannot undo manual choice`)
    assert.equal((await api('status')).parameters.persistentValues['glassfall-pattern-change'], true)
    await api('music', { timeSec: .2, event, eventId: 128, beatIndex: 128 })
    const fresh = await pixels()
    await api('set', { pattern: 'darkWindows', patternChange: false }); assert(diff(fresh, await pixels()) < .001, `${trigger}: next fresh event resumes progression`)
    report.push({ trigger, difference: diff(before, after) })
  }
  await clean({ response: 0, patternChange: false, trigger: 'kick' }); const held = await pixels()
  await api('music', { timeSec: .1, event: 'kick' }); assert(diff(held, await pixels()) < .001, 'OFF holds pattern')
  for (const [name, options] of [['energy', { energy: 1 }], ['bass', { bass: 1 }], ['high', { high: 1 }], ['vocal', { vocal: 1 }], ['build', { build: 1 }], ['kick', { event: 'kick' }], ['snare', { event: 'snare' }], ['drop', { event: 'drop' }]]) {
    await clean({ response: 1 }); const quiet = await pixels()
    await api('music', { timeSec: .1, ...options })
    const active = await pixels(`audio-${name}`), change = diff(quiet, active)
    // Highs shift the contour phase, so inspect their native Prism Trace domain.
    if (name !== 'high') assert(change > .03, `${name}: visible response`)
    else { await api('set', { pattern: 'prismTrace' }); const high = await pixels(); await api('music', { timeSec: .1, high: 0 }); assert(diff(high, await pixels()) > .03, 'Highs change contour phase') }
    await api('set', { response: 0 }); const disabled = await pixels()
    await api('music', { timeSec: .1, energy: 0 }); assert(diff(disabled, await pixels()) < .001, 'Reactivity zero restores manual output')
    report.push({ signal: name, change })
  }
  // Reactivity has distinct min/default/max output and stays active with Sync OFF.
  const levels = []
  for (const response of [0, .7, 1]) {
    await clean({ response, sync: false }); await api('music', { timeSec: .1, energy: 1, bass: 1, vocal: .2 })
    levels.push(await pixels())
  }
  assert(diff(levels[0], levels[1]) > .03 && diff(levels[1], levels[2]) > .03, 'Reactivity range is visible independently of BPM Sync')
  // A loop resets event watermarks and returns to the authored base.
  await clean({ response: 0, patternChange: true, trigger: 'beat' })
  const loopBase = await pixels(); await api('music', { timeSec: .1, event: 'beat', eventId: 1 })
  const loopAdvanced = await pixels(); assert(diff(loopBase, loopAdvanced) > .1)
  await api('music', { timeSec: 0, event: null }); assert(diff(loopBase, await pixels()) < .001)
  await api('music', { timeSec: .1, event: 'beat', eventId: 1 }); assert(diff(loopAdvanced, await pixels()) < .001)
  // Pause holds sampled facts, while source/analysis discontinuities clear them.
  await clean({ response: 1 }); const resetBase = await pixels(); await api('music', { timeSec: .1, bass: 1, energy: 1 }); await api('transport', { paused: true })
  const paused = await pixels(); await api('advance', .5); assert(diff(paused, await pixels()) < .001)
  await api('set', { response: 0 }); const manualPaused = await pixels(); await api('advance', .5); assert(diff(manualPaused, await pixels()) < .001)
  await api('set', { response: 1 })
  await api('music', { timeSec: 0, revision: 'replacement', trackId: 'other-track', featuresAvailable: false })
  assert(diff(resetBase, await pixels()) < .001, 'Track/analysis changes clear obsolete reactions')
  const retired = await api('reenter', true); await ready(); assert.equal(retired.activeLeaseCount, 0)
  const status = await api('status'); assert.equal(status.modules.failedModuleCount, 0); assert.equal(status.render.failedPassCount, 0)
  await api('showInspector', true)
  await api('set', { patternChange: true })
  const trigger = page.locator('[data-cinema2-control-id="glassfall-trigger"]').getByRole('combobox')
  assert(await trigger.isEnabled()); await trigger.click(); await page.getByRole('option').first().waitFor()
  assert.deepEqual(await page.getByRole('option').allTextContents(), ['Beat', 'Kick', 'Snare', 'Downbeat', 'Every 2 Beats', 'Every 4 Beats', 'Bar', 'Every 4 Bars', 'Every 8 Bars', 'Phrase', 'Drop'])
  await page.screenshot({ path: resolve(out, 'inspector-triggers.png') })
  const disposed = await api('dispose'); assert.equal(disposed.activeLeaseCount, 0); assert.equal(disposed.estimatedGpuMemoryBytes, 0)
  assert.deepEqual(errors, [])
  await writeFile(resolve(out, 'report.json'), JSON.stringify({ report, retired, disposed, errors }, null, 2))
  console.log(`GLASSFALL phase 3 passed: 11 triggers, authority, shared audio, pause, re-entry and disposal. ${out}`)
} finally { await browser?.close(); await server.close() }

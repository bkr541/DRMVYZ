/* global window */
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import sharp from 'sharp'
const root = resolve(import.meta.dirname, '../..'), out = resolve(root, 'artifacts/glassfall-phase4')
const server = await createServer({ root, clearScreen: false, server: { host: '127.0.0.1', port: 0 } })
let browser
const errors = [], report = []
try {
  await server.listen()
  const url = `http://127.0.0.1:${server.httpServer.address().port}/src/test/browser/cinema2-glassfall-phase4.html`
  if (process.argv.includes('--serve')) { console.log(`GLASSFALL phase 4: ${url}?live=1`); await new Promise(() => {}) }
  await mkdir(out, { recursive: true })
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
  const page = await browser.newPage({ viewport: { width: 960, height: 720 }, deviceScaleFactor: 1 })
  page.on('pageerror', error => errors.push(error.message)); page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto(url, { waitUntil: 'commit', timeout: 15000 })
  const ready = () => page.waitForFunction(() => window.glassfallChoreography?.status().modules.modules.some(m => m.activeResourceLeaseCount > 0), undefined, { timeout: 15000 })
  await ready().catch(error => { throw new Error(`${error}: ${errors.join('\n')}`) })
  const api = (name, ...args) => page.evaluate(({ name, args }) => window.glassfallChoreography[name](...args), { name, args })
  const pixels = async name => sharp(await page.locator('canvas').screenshot(name ? { path: resolve(out, `${name}.png`) } : {})).removeAlpha().raw().toBuffer()
  const diff = (a, b) => a.reduce((sum, v, i) => sum + Math.abs(v - b[i]), 0) / a.length
  const channels = async () => (await api('status')).channels
  const clean = async (values = {}) => {
    await api('music', { timeSec: 0, energy: 0, event: null })
    await api('reenter', false); await ready(); await api('set', { speed: 0, sequenceSpeed: 0, response: 1, ...values })
  }
  for (const event of ['kick', 'snare', 'drop']) {
    await clean(); const base = await pixels()
    await api('music', { timeSec: .1, event, eventId: 33 })
    const onset = (await channels())[event]
    await api('advance', .04)
    const peak = (await channels())[event], active = await pixels(`${event}-peak`)
    assert(peak > .35, `${event}: resolved shared envelope reaches a visible peak`)
    assert(diff(base, active) > .03, `${event}: actual triangle pixels change`)
    await api('advance', .10)
    const tail = (await channels())[event]
    assert(tail > 0 && tail <= 1, `${event}: authored tail outlives the upstream event frame`)
    await api('advance', 1)
    assert((await channels())[event] < .00001, `${event}: envelope returns to zero`)
    assert(diff(base, await pixels(`${event}-restored`)) < .001, `${event}: returns to manual visual base`)
    report.push({ event, onset, peak, tail })
  }
  for (const [name, signal] of [['energy', 'energy'], ['bass', 'bass'], ['high', 'high'], ['vocal', 'vocal'], ['build', 'build']]) {
    await clean({ pattern: name === 'high' ? 'prismTrace' : 'glassfall' }); const base = await pixels()
    await api('music', { timeSec: .1, [signal]: 1 }); await api('advance', .5)
    const active = await channels(); assert(active[name] > .5 && active[name] <= 1, `${name}: smoothed bounded target`)
    assert(diff(base, await pixels(`continuous-${name}`)) > .03, `${name}: resolved route has a visual consumer`)
    await api('music', { timeSec: .6, energy: 0 }); await api('advance', 2)
    assert((await channels())[name] < .005, `${name}: smoothing releases toward authored base`)
    report.push({ continuous: name, peak: active[name] })
  }
  await clean(); const base = await pixels()
  await api('music', { timeSec: .1, event: 'drop', eventId: 50 }); await api('advance', .04)
  const peak = await pixels(); await api('transport', { paused: true }); await api('advance', .5)
  assert(diff(peak, await pixels()) < .001, 'Pause freezes the shared envelope')
  await api('set', { choreography: false }); assert(diff(base, await pixels()) < .001, 'OFF restores authored base even while paused')
  assert(Object.values(await channels()).every(value => value === 0), 'OFF removes shared contributions')
  await api('set', { choreography: true }); await api('repeatMusic')
  assert(diff(base, await pixels()) < .001, 'Re-enable cannot replay a held drop')
  await api('transport', { paused: false }); await api('advance', 1)
  await clean(); await api('music', { timeSec: .1, event: 'drop', eventId: 61 }); await api('advance', .04)
  await api('set', { intensity: .45, response: 0 }); const manual = await pixels()
  await api('advance', .3); assert(diff(manual, await pixels()) < .001, 'Reactivity zero immediately restores manual behavior')
  assert.equal((await api('status')).parameters.persistentValues['glassfall-intensity'], .45)
  await api('set', { response: 1 }); await api('music', { timeSec: 0, event: null })
  assert(Object.values(await channels()).every(value => Math.abs(value) < .00001), 'Seek/loop clears stale event envelopes')
  await api('music', { timeSec: .1, event: 'kick', eventId: 62 }); await api('advance', .04)
  await api('music', { timeSec: 0, trackId: 'replacement', revision: 'new-analysis', featuresAvailable: false })
  assert(Object.values(await channels()).every(value => Math.abs(value) < .00001), 'Track/analysis replacement clears all routes')
  await clean({ choreography: false, patternChange: true, trigger: 'kick', response: 0 })
  const beforePattern = await pixels(); await api('music', { timeSec: .1, event: 'kick', eventId: 70 })
  assert(diff(beforePattern, await pixels()) > .1, 'Pattern Change remains an independent permission')
  await api('set', { choreography: true, pattern: 'prismTrace' }); const chosen = await pixels()
  await api('repeatMusic'); assert(diff(chosen, await pixels()) < .001, 'Held cue cannot cancel a manual Pattern edit')
  const retired = await api('reenter', true); await ready(); assert.equal(retired.activeLeaseCount, 0)
  const status = await api('status'); assert.equal(status.modules.failedModuleCount, 0); assert.equal(status.render.failedPassCount, 0)
  assert.equal(status.choreography.diagnostics.length, 0)
  await api('showInspector', true); await page.screenshot({ path: resolve(out, 'inspector-choreography.png') })
  const disposed = await api('dispose'); assert.equal(disposed.activeLeaseCount, 0); assert.equal(disposed.estimatedGpuMemoryBytes, 0)
  assert.deepEqual(errors, [])
  await writeFile(resolve(out, 'report.json'), JSON.stringify({ report, retired, disposed, errors }, null, 2))
  console.log(`GLASSFALL phase 4 passed: resolved routes, envelopes, authority, pause/reset, re-entry and disposal. ${out}`)
} finally { await browser?.close(); await server.close() }

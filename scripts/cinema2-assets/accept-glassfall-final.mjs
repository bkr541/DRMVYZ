/* global window, getComputedStyle */
import assert from 'node:assert/strict'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import sharp from 'sharp'
const root = resolve(import.meta.dirname, '../..'), out = resolve(root, 'artifacts/glassfall-final')
const server = await createServer({ root, clearScreen: false, server: { host: '127.0.0.1', port: 0 } })
let browser
const errors = [], report = []
let retired
try {
  await server.listen()
  const url = `http://127.0.0.1:${server.httpServer.address().port}/src/test/browser/cinema2-glassfall-production.html`
  if (process.argv.includes('--serve')) { console.log(`GLASSFALL final review: ${url}?live=1`); await new Promise(() => {}) }
  await mkdir(out, { recursive: true })
  browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'], executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
  const page = await browser.newPage({ viewport: { width: 960, height: 720 }, deviceScaleFactor: 1 })
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto(url, { waitUntil: 'commit', timeout: 15000 })
  const ready = () => page.waitForFunction(() => window.glassfallFinal?.status().modules.modules.some(m => m.activeResourceLeaseCount > 0), undefined, { timeout: 15000 })
  await ready().catch(async error => { throw new Error(`${error}\n${JSON.stringify({ errors, status: await page.evaluate(() => window.glassfallFinal?.status()) })}`) })
  const api = (name, ...args) => page.evaluate(({ name, args }) => window.glassfallFinal[name](...args), { name, args })
  const capture = async name => sharp(await page.locator('canvas').screenshot(name ? { path: resolve(out, `${name}.png`) } : {})).removeAlpha().raw().toBuffer()
  const difference = (a, b) => a.reduce((sum, value, i) => sum + Math.abs(value - b[i]), 0) / a.length
  const clean = async (values = {}) => {
    await api('music', { timeSec: 0, event: null, energy: 0 })
    await api('transport', { time: 0, paused: true, bpm: 60 })
    await api('reenter', false); await ready(); await api('set', values)
  }
  if (!process.argv.includes('--late-only')) {
  // Every advertised manual program must change actual lighting on the reference layout.
  const images = []
  for (const pattern of ['glassfall', 'cascade', 'splitCurrent', 'prismTrace', 'darkWindows', 'prismRelay']) {
    await clean({ pattern }); await api('transport', { paused: false }); await api('advance', 1.3); await api('transport', { paused: true })
    images.push(await capture(`pattern-${pattern}`))
  }
  for (let i = 0; i < images.length; i++) for (let j = 0; j < i; j++) assert(difference(images[i], images[j]) > .4, `Programs ${i}/${j} need distinct rendered output`)
  for (const [name, low, middle, high] of [['intensity', 0, 1, .5], ['scale', .75, 1, 1.25], ['spacing', .9, 1, 1.25], ['relief', .5, 1, 1.5], ['bloom', 0, .18, .45], ['reflectionStrength', 0, .35, 1]]) {
    await clean()
    const states = []
    for (const value of [low, middle, high]) { await api('set', { [name]: value }); states.push(await capture()) }
    const changes = [difference(states[0], states[1]), difference(states[1], states[2])]
    assert(changes.every(change => change > .08), `${name}: min/default/max must visibly affect its intended property: ${changes}`)
    report.push({ control: name, changes })
  }
  for (const name of ['background', 'cyan', 'violet', 'highlight', 'panel']) {
    await clean(); const before = await capture()
    await api('set', { [name]: [.9, .04, .08, 1] })
    const change = difference(before, await capture())
    assert(change > .08, `${name}: independent color needs visible output`)
    report.push({ palette: name, change })
  }
  for (const name of ['speed', 'sequenceSpeed']) {
    const samples = []
    for (const value of [0, name === 'speed' ? .35 : .65, name === 'speed' ? 1.5 : 2]) {
      await clean({ speed: 0, sequenceSpeed: 0, [name]: value })
      const before = await capture(); await api('transport', { paused: false }); await api('advance', 2)
      samples.push(await capture())
      const change = difference(before, samples.at(-1))
      assert(value === 0 ? change < .001 : change > .1, `${name}=${value} must ${value ? 'move' : 'hold'} its domain`)
    }
    assert(difference(samples[1], samples[2]) > .1, `${name}: default/max rates differ`)
  }
  // Sync and free-running cases use the same host time/BPM and no music fixtures.
  const sync = []
  for (const enabled of [true, false]) {
    await clean({ sync: enabled }); await api('transport', { paused: false }); await api('advance', 2)
    sync.push(await capture(enabled ? 'sync-on' : 'sync-off'))
  }
  assert(difference(sync[0], sync[1]) > 1, 'BPM Sync must govern visible timing')
  await api('transport', { paused: true }); const paused = await capture(); await api('advance', 1)
  assert(paused.equals(await capture()), 'Loaded pause holds the pose')
  await api('set', { sync: true, speed: 0, sequenceSpeed: 0 }); assert(difference(paused, await capture()) < .001, 'Timing edits preserve current pose')
  await api('advance', 1); assert(paused.equals(await capture()), 'Zero holds after timing edit')
  await clean(); await api('transport', { paused: false }); await api('advance', 2); const played = await capture()
  await api('transport', { time: .2 }); await api('transport', { time: 2 }); assert(difference(played, await capture()) < .001, 'Seek reconstructs the canonical pose')
  retired = await api('reenter', true); await ready()
  assert(difference(played, await capture()) < .001, 'Re-entry reconstructs the canonical pose')
  assert.equal(retired.activeLeaseCount, 0)
  for (const [name, width, height] of [['portrait', 712, 1006], ['square', 768, 768], ['landscape', 1280, 720]]) {
    await page.setViewportSize({ width, height }); await api('resize'); await clean(); await capture(`${name}-default`)
    const status = await api('status'); assert.equal(status.modules.failedModuleCount, 0); assert.equal(status.render.failedPassCount, 0)
  }
  // Canonical switching, duplicate suppression and manual authority on the final render graph.
  const triggers = ['beat','kick','snare','downbeat','beat2','beat4','bar','bar4','bar8','phrase','drop']
  for (const trigger of triggers) {
    await clean({ speed: 0, sequenceSpeed: 0, response: 0, autoPerformance: false, patternChange: true, trigger })
    await api('music', { timeSec: 0, energy: 0 }); const base = await capture()
    const event = trigger.startsWith('beat') ? 'beat' : trigger.startsWith('bar') ? 'bar' : trigger
    await api('music', { timeSec: .1, event, eventId: 64, beatIndex: 64 }); const changed = await capture()
    assert(difference(base, changed) > .1, `${trigger}: native final pattern advances`)
    await api('set', { pattern: 'prismTrace' }); const chosen = await capture()
    await api('repeatMusic'); assert(difference(chosen, await capture()) < .001, `${trigger}: duplicate cannot undo manual choice`)
    assert.equal((await api('status')).parameters.persistentValues['glassfall-pattern-change'], true)
  }
  // Auto Performance keeps the underlying progression and only temporarily substitutes.
  await clean({ speed: 0, sequenceSpeed: 0, response: 0, autoPerformance: true, patternChange: true, trigger: 'beat' })
  await api('music', { timeSec: 0, energy: 0 }); const authored = await capture()
  await api('music', { timeSec: .1, sectionBuild: true, sectionStart: .1 }); const building = await capture('auto-build')
  assert(difference(authored, building) > .1, 'Fresh build permits an actual temporary pattern')
  await api('music', { timeSec: .2, sectionBuild: true, sectionStart: .1, event: 'beat', eventId: 1, beatIndex: 1 })
  await api('music', { timeSec: .3, sectionBuild: true, sectionStart: .1, event: 'beat', eventId: 2, beatIndex: 2 })
  assert(difference(building, await capture()) < .001, 'Underlying progression continues without disturbing the override')
  await api('music', { timeSec: .4 }); const restored = await capture()
  await api('set', { pattern: 'splitCurrent', patternChange: false }); assert(difference(restored, await capture()) < .001, 'Correct progressed base resumes')
  await api('music', { timeSec: .5, event: 'drop', eventId: 41 }); const dropped = await capture('auto-drop')
  assert(difference(restored, dropped) > .1)
  await api('advance', 1.3); assert(difference(restored, await capture()) < .001, 'Drop override is bounded')
  await api('music', { timeSec: 2, sectionBuild: true, sectionStart: 2 })
  await api('set', { pattern: 'prismTrace', patternChange: true }); const manual = await capture()
  await api('repeatMusic'); assert(difference(manual, await capture()) < .001, 'Manual edit wins over the already active build')
  await api('music', { timeSec: 2.1, event: 'drop', eventId: 42 }); assert(difference(manual, await capture()) > .1, 'A separately fresh moment may perform again')
  await api('transport', { paused: true }); await api('set', { autoPerformance: false }); assert(difference(manual, await capture()) < .001, 'Paused Auto OFF restores base immediately')
  const saved = (await api('status')).parameters.persistentValues
  assert.equal(saved['glassfall-pattern'], 'prismTrace'); assert.equal(saved['glassfall-pattern-change'], true)
  }
  // Actual authored audio: offline analysis + live analyser pump, never fixture values.
  await clean({ autoPerformance: false, patternChange: false }); await api('transport', { paused: false })
  const encoded = (await readFile(resolve(out, 'reference.wav'))).toString('base64')
  await api('playAudio', encoded)
  await page.waitForFunction(() => window.glassfallFinal.audioEvidence().frames > 15, undefined, { timeout: 15000 })
  const audioFirst = await capture('real-audio-early')
  const start = (await api('status')).transport.timeSec
  await page.waitForFunction(t => window.glassfallFinal.status().transport.timeSec > t + .7, start, { timeout: 10000 })
  const audioLater = await capture('real-audio-later'), evidence = await api('audioEvidence')
  assert(evidence.peaks.energy > .01 && evidence.peaks.bass > .001 && evidence.eventCount > 0, `Real audio must supply available shared facts/events: ${JSON.stringify(evidence)}`)
  assert(difference(audioFirst, audioLater) > .1, 'Real playback changes actual pixels')
  report.push({ realAudio: evidence }); await api('stopAudio')
  // No-track ambient behavior and quality tiers retain the hero.
  await api('set', { autoPerformance: false, patternChange: false }); await api('transport', { paused: false })
  const idle = await capture(); await api('advance', 1); assert(difference(idle, await capture()) > .05, 'No-track ambient descent remains deliberate')
  for (const quality of ['low','medium','high']) {
    const retiredTier = await api('reenter', true, quality); await ready()
    assert.equal(retiredTier.activeLeaseCount, 0); retired ??= retiredTier
    const status = await api('status'); assert.equal(status.modules.failedModuleCount, 0); assert.equal(status.render.failedPassCount, 0); assert.equal(status.effects.failedEffectCount, 0)
    await capture(`quality-${quality}`)
  }
  await api('source', true); await clean()
  // Shared Inspector hierarchy, conditional/disabled event previews, real portal.
  await page.setViewportSize({ width: 1280, height: 900 }); await api('resize'); await api('showInspector', true)
  const pattern = page.locator('[data-cinema2-control-id="glassfall-pattern"]')
  await pattern.getByRole('combobox').click(); await page.getByRole('option').first().waitFor()
  assert.equal(await page.getByRole('option').count(), 6)
  const typography = await page.getByRole('option').first().evaluate(element => ({ size: getComputedStyle(element).fontSize, family: getComputedStyle(element).fontFamily }))
  await page.screenshot({ path: resolve(out, 'inspector-pattern-portal.png') })
  await page.getByRole('option', { name: 'Prism Trace', exact: true }).click()
  assert.equal(await page.locator('[data-cinema2-control-id="glassfall-trigger"]').count(), 0)
  await api('set', { patternChange: true })
  const trigger = page.locator('[data-cinema2-control-id="glassfall-trigger"]')
  await trigger.waitFor(); assert(await trigger.getByRole('combobox').isEnabled(), 'Final shared-event Trigger must be active')
  await page.screenshot({ path: resolve(out, 'inspector-controls.png') })
  await trigger.getByRole('combobox').click(); await page.getByRole('option').first().waitFor()
  assert.equal(await page.getByRole('option').count(), 11)
  await page.screenshot({ path: resolve(out, 'inspector-trigger-portal.png') })
  report.push({ typography })
  const disposed = await api('dispose'); assert.equal(disposed.activeLeaseCount, 0); assert.equal(disposed.estimatedGpuMemoryBytes, 0)
  assert.deepEqual(errors, [])
  await writeFile(resolve(out, process.argv.includes('--late-only') ? 'report-late.json' : 'report.json'), JSON.stringify({ report, retired, disposed, errors }, null, 2))
  console.log(`GLASSFALL final passed. Captures: ${out}`)
} finally { await browser?.close(); await server.close() }

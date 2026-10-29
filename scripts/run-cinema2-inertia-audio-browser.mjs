#!/usr/bin/env node
/* global window */
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import sharp from 'sharp'

const root = resolve(import.meta.dirname, '..'), output = resolve(process.argv[2] ?? 'artifacts/inertia-phase4')
const eventsOnly = process.argv.includes('--events-only')
const responsesOnly = process.argv.includes('--responses-only')
await mkdir(output, { recursive: true })
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0 }, clearScreen: false, logLevel: 'error' })
const errors = [], results = [], channels = []
let browser
try {
  await server.listen()
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
  const page = await browser.newPage({ viewport: { width: 954, height: 954 } })
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text()) })
  const api = async (method, ...args) => {
    const s = await page.evaluate(([method, args]) => window.__inertiaAudio[method](...args), [method, args])
    const current = s.current ?? s
    assert.equal(current.snapshot.phase, 'running', JSON.stringify(current.modules))
    assert.equal(current.modules.failedModuleCount, 0, JSON.stringify(current.modules))
    return s
  }
  const pixels = async (name, save = false) => {
    const png = await page.locator('canvas').screenshot()
    if (save) await writeFile(join(output, `${name}.png`), png)
    return sharp(png).removeAlpha().raw().toBuffer()
  }
  const diff = (a, b) => { assert.equal(a.length, b.length); let sum = 0; for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]); return sum / a.length }
  const changed = (name, a, b, min = 0.005) => {
    const delta = diff(a, b); results.push({ name, meanPixelDifference: delta }); assert(delta > min, `${name}: ${delta}`)
  }
  const same = (name, a, b) => { const delta = diff(a, b); results.push({ name, meanPixelDifference: delta }); assert(delta < 0.0001, `${name}: ${delta}`) }
  const defaults = { pattern: 'countertwist', 'pattern-change': false, 'audio-response': 1, 'bpm-sync': false,
    'motion-amount': 1, deformation: 1, intensity: 0.7, 'proof-part': 'all' }
  let generation = 0
  const sample = async (music = {}, values = {}, time = 1.2) => {
    await api('set', { ...defaults, ...values })
    await api('music', { energy: 1, bass: 0, high: 0, vocal: 0, build: 0, timeSec: 0, track: `inertia-sample-${generation++}`, ...music })
    const s = await api('advance', time); channels.push({ music, values, channels: s.channels, audio: { source: s.audio.upstream.sourceId, track: s.audio.upstream.trackId, frameId: s.audio.upstream.frameId } })
    return pixels('sample')
  }
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/src/test/browser/cinema2-inertia-audio.html`)
  await page.waitForFunction(() => window.__inertiaAudio)
  await api('prepare')
  if (!eventsOnly) {
  const quiet = await sample({ energy: 0.05 }); await pixels('quiet', true)
  const loud = await sample({ energy: 1, bass: 1, high: 1 }); await pixels('energetic', true)
  changed('quiet/energetic geometry and detail', quiet, loud)
  const native = await sample()
  for (const [name, music] of [
    ['bass-pressure', { bass: 1 }], ['vocal-restraint', { vocal: 1 }], ['build-tension', { build: 1 }], ['high-sparkle', { high: 1 }],
    ['kick', { event: 'kick', eventTime: 1.1 }], ['snare', { event: 'snare', eventTime: 1.1 }],
    ['transient', { transient: true, eventTime: 1.1 }], ['drop-release', { event: 'drop', eventTime: 1.1 }],
  ]) {
    const shot = await sample(music); await pixels(name === 'kick' || name === 'snare' ? `pulse-${name}` : name, true); changed(name, native, shot, name === 'high-sparkle' ? 0.0003 : 0.005)
  }
  const response0 = await sample({ bass: 1, high: 1 }, { 'audio-response': 0 })
  const responseNormal = await sample({ bass: 1, high: 1 }, { 'audio-response': 0.65 })
  const response1 = await sample({ bass: 1, high: 1 }, { 'audio-response': 1 })
  changed('Audio Response zero/default', response0, responseNormal)
  changed('Audio Response default/max', responseNormal, response1)
  same('Response OFF preserves native artwork regardless of music', response0, await sample({ bass: 0, high: 0, vocal: 1, build: 1 }, { 'audio-response': 0 }))
  same('Missing analysis cannot drive visuals', response0, await sample({ featuresAvailable: false }, { 'audio-response': 1 }))
  const snareOnly = await sample({ event: 'snare', eventTime: 1.1 })
  same('Same-hit snare/transient does not double force', snareOnly, await sample({ event: 'snare', transient: true, eventTime: 1.1 }))
  const noMotion = await sample({ bass: 1, build: 1, event: 'kick', eventTime: 1.1 }, { 'motion-amount': 0 })
  same('Motion zero blocks musical geometry', noMotion, await sample({}, { 'motion-amount': 0 }))
  console.log('PASS shared continuous/rhythm/structure response and manual zero/ceiling controls')
  await writeFile(join(output, 'response-report.json'), JSON.stringify({ results, channels, errors }, null, 2))
  assert.deepEqual(errors, [])
  }

  if (!responsesOnly) {
  // Isolate pattern selection from all motion and modulation to compare actual output families.
  const patternNames = ['reference-cycle', 'countertwist', 'breathing-cage', 'torsion-wave', 'slice-shear', 'collapse-release']
  const expected = new Map()
  for (const pattern of patternNames) expected.set(pattern, await sample({}, { 'audio-response': 0, 'motion-amount': 0, deformation: 0.45, pattern }))
  const cases = [['beat','beat',1], ['kick','kick',1], ['snare','snare',1], ['downbeat','downbeat',4], ['beat2','beat',2], ['beat4','beat',4],
    ['bar','bar',4], ['bar4','bar',16], ['bar8','bar',32], ['phrase','phrase',16], ['drop','drop',16]]
  for (const [trigger, event, beatIndex] of cases) {
    await sample({}, { 'audio-response': 0, 'motion-amount': 0, deformation: 0.45, pattern: 'reference-cycle', 'pattern-change': true, trigger }, 0.2)
    const before = await pixels('base')
    await api('music', { energy: 1, event, beatIndex, eventId: 1, holdEvent: true })
    let s = await api('advance', 0.4)
    same(`${trigger}: qualifying event selects native next pattern`, await pixels(`trigger-${trigger}`, true), expected.get('countertwist'))
    changed(`${trigger}: switch visible`, before, await pixels('switched'))
    const saved = s.authored
    await api('repeat'); await api('advance', 0.2)
    same(`${trigger}: duplicate held event suppressed`, await pixels('duplicate'), expected.get('countertwist'))
    assert.equal((await api('status')).authored, saved, 'Runtime progression must not overwrite saved parameters')
    await api('set', { pattern: 'reference-cycle' }); await api('advance', 0.3)
    same(`${trigger}: manual same-value reselection holds`, await pixels('manual'), expected.get('reference-cycle'))
    s = await api('status')
    assert.equal(s.authored, saved, 'Manual same-value selection must preserve Pattern Change and saved Trigger')
    // New source event resumes progression after the edit fence.
    const interval = trigger === 'bar8' ? 32 : trigger === 'bar4' ? 16 : trigger === 'bar' || trigger === 'beat4' || trigger === 'downbeat' ? 4 : trigger === 'beat2' ? 2 : 1
    await api('music', { energy: 1, event, beatIndex: beatIndex + interval, eventId: 2, holdEvent: true }); await api('advance', 0.4)
    same(`${trigger}: fresh event after manual edit`, await pixels('fresh'), expected.get('countertwist'))
  }
  console.log('PASS all 11 canonical musical triggers, duplicate suppression, and manual reselection')

  await api('pause', true); const paused = await pixels('paused')
  await api('advance', 0.4); same('Pause holds runtime pattern', paused, await pixels('pause-held'))
  await api('pause', false); await api('advance', 0.3)
  same('Resume does not replay held event', await pixels('resume'), expected.get('countertwist'))
  for (const [name, music] of [['seek', { timeSec: 0 }], ['loop-wrap', { timeSec: 0 }], ['analysis-update', { revision: 'updated-analysis' }], ['track-change', { track: 'new-track' }]]) {
    await api('music', { energy: 1, ...music }); await api('advance', 0.3)
    same(`${name}: restore authored base`, await pixels(name), expected.get('reference-cycle'))
  }
  const reentered = await api('reenter')
  assert.equal(reentered.retired.phase, 'disposed'); assert.equal(reentered.retired.resources.activeAnimationFrameCount, 0)
  await api('advance', 0.3)
  same('Preset re-entry restores authored pattern', await pixels('reentry', true), expected.get('reference-cycle'))
  // Auto Performance is absent; authored colors and intensity remain the authority.
  await api('set', { 'pattern-change': false, 'audio-response': 1, 'motion-amount': 1, intensity: 0 })
  await api('music', { energy: 1, bass: 1, high: 1, build: 1, event: 'drop' }); await api('advance', 0.3)
  assert((await pixels('hard-black')).every(value => value === 0), 'Intensity zero must extinguish actual hero geometry')
  await api('set', { intensity: 0.7 })

  // Read actual soundtrack PCM through Web Audio -> shared frame pump -> AudioFeatureBus -> native runtime.
  const audioPath = process.env.INERTIA_REFERENCE_AUDIO_PATH ?? join(output, 'reference-audio.m4a')
  const encoded = (await readFile(audioPath)).toString('base64')
  await api('set', { 'motion-amount': 0.65, deformation: 0.45, 'audio-response': 1 })
  await api('playAudio', encoded, 5)
  const live = []
  for (let i = 0; i < 8; i++) { await page.waitForTimeout(500); live.push(await api('status')) }
  assert(live.some(s => Number(s.channels.energyMotion) > 0.01), 'Real soundtrack must reach shared resolved energy')
  assert(live.some(s => Number(s.channels.bassPressure) > 0.001), 'Real soundtrack must reach shared resolved bass')
  assert(live.at(-1).pump.sampleCount > 20, 'Canonical analyzer frame pump must sample real PCM')
  await pixels('real-soundtrack', true)
  await writeFile(join(output, 'real-audio-report.json'), JSON.stringify(live.map(s => ({ audio: s.audio.upstream, channels: s.channels, pump: s.pump })), null, 2))
  await api('stopAudio')
  console.log('PASS reference soundtrack through the shared live analyzer and native renderer')
  await page.setViewportSize({ width: 1440, height: 1050 }); await api('inspector')
  const responseControl = page.locator('[data-cinema2-control-id="inertia-audio-response"]')
  await responseControl.waitFor()
  assert.equal(await page.locator('[data-cinema2-parent-group="master-controls"] [data-cinema2-control-id="inertia-audio-response"]').count(), 1)
  await page.screenshot({ path: join(output, 'audio-response-inspector.png'), animations: 'disabled' })
  assert.deepEqual(errors, [])
  await writeFile(join(output, 'report.json'), JSON.stringify({ phase: 4, scope: eventsOnly ? 'Canonical events, lifecycle, real playback, and Inspector; response segment passed in prior execution' : 'full', results, channels, errors, realAudioFrames: live.length }, null, 2))
  console.log(`PASS Inertia Phase Four (${results.length} perceptual checks): ${output}`)
  }
} finally { await browser?.close(); await server.close() }

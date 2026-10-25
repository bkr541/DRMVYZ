#!/usr/bin/env node
/* global window, document, MediaRecorder */
/** Focused production-path VACANCY acceptance: controls, native programs, media, music, authority and lifecycle. */
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import sharp from 'sharp'

const root = resolve(import.meta.dirname, '..'), output = resolve(process.argv[2] ?? '/tmp/vacancy-acceptance')
await mkdir(output, { recursive: true })
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0 }, clearScreen: false, logLevel: 'error' })
let browser
const results = [], errors = []
try {
  await server.listen()
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 })
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()) })
  const url = `http://127.0.0.1:${server.httpServer.address().port}/src/test/browser/cinema2-vacancy-production.html`
  const api = async (method, ...args) => {
    const status = await page.evaluate(([method, args]) => window.__vacancyProduction[method](...args), [method, args])
    assert.equal(status.snapshot.phase, 'running', `${method}: ${status.snapshot.statusMessage}`)
    assert.equal(status.modules.failedModuleCount, 0, JSON.stringify(status.modules))
    assert.equal(status.effects.failedEffectCount, 0, JSON.stringify(status.effects))
    return status
  }
  const set = values => api('setParameters', Object.fromEntries(Object.entries(values).map(([name, value]) => [`vacancy-${name}`, value])))
  const pixels = async (name, save = false) => {
    const png = await page.locator('canvas').screenshot()
    if (save) await writeFile(join(output, `${name}.png`), png)
    return sharp(png).removeAlpha().raw().toBuffer()
  }
  const difference = (a, b) => {
    assert.equal(a.length, b.length)
    let sum = 0
    for (let i = 0; i < a.length; i += 1) sum += Math.abs(a[i] - b[i])
    return sum / a.length
  }
  const changed = (name, a, b, min = .025) => {
    const delta = difference(a, b); results.push({ name, meanPixelChange: delta })
    assert(delta > min, `${name} was visually inert (${delta})`)
    console.log(`PASS ${name}: ${delta.toFixed(3)}`)
  }
  const load = async () => {
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => window.__vacancyProduction, { timeout: 30000 })
    await api('prepare')
  }
  await load()
  await set({ 'camera-motion': 0 })
  const baseline = await pixels('baseline', true)
  if (!['--remaining', '--after-media', '--audio', '--extended'].includes(process.argv[3])) {
  for (const [name, normal] of [['master-intensity', .85], ['room-visibility', .65], ['screens-lit', 1], ['static', 1], ['scanlines', 1], ['bloom', .8], ['reflections', .62], ['haze', 0]]) {
    await set({ [name]: 0 }); const off = await pixels(name)
    await set({ [name]: normal }); const usual = await pixels(name)
    await set({ [name]: 1 }); const max = await pixels(name)
    changed(`${name} off/max`, off, max)
    if (normal > 0 && normal < 1) { changed(`${name} off/default`, off, usual); changed(`${name} default/max`, usual, max, .005) }
    await set({ [name]: normal })
  }
  for (const name of ['background', 'screen', 'glow']) {
    await set({ [`${name}-color`]: [1, .03, .03, 1] }); changed(`${name} palette`, baseline, await pixels(name))
    await set({ [`${name}-color`]: name === 'background' ? [.012, .016, .024, 1] : [.86, .9, .94, 1] })
  }
  await set({ haze: 1 }); const haze = await pixels('haze')
  await set({ 'haze-color': [1, 0, 0, 1] }); changed('haze palette', haze, await pixels('haze-red'))
  await set({ haze: 0, 'haze-color': [.52, .62, .72, 1] })
  await set({ 'tower-size': 'compact' }); const small = await pixels('small')
  await set({ 'tower-size': 'tall' }); changed('Tower Size', small, await pixels('tall'))
  await set({ 'tower-size': 'standard' })
  const signatures = []
  for (const pattern of ['dead-air', 'channel-hop', 'ascent', 'collapse', 'signal-sweep', 'checker', 'vacancy', 'interference']) {
    await set({ pattern }); const shot = await pixels(pattern, true)
    for (const [previous, other] of signatures) changed(`pattern ${previous}/${pattern}`, other, shot, .015)
    signatures.push([pattern, shot])
  }
  await set({ pattern: 'channel-hop' }); const before = await pixels('motion')
  await api('advanceBy', .7); changed('native frame-to-frame motion', before, await pixels('motion-after'))
  await set({ pattern: 'dead-air', 'camera-orbit': -25 }); const left = await pixels('orbit-left', true)
  await set({ 'camera-orbit': 25 }); changed('Orbit Angle', left, await pixels('orbit-right', true))
  }
  if (!['--after-media', '--audio', '--extended'].includes(process.argv[3])) {
  await api('setMusic', { active: true }); await set({ 'music-response': 0 })
  await set({ 'camera-orbit': 0, 'camera-motion': 1 }); const cameraBefore = (await api('status')).camera
  await api('advanceBy', 4); const cameraAfter = (await api('status')).camera
  assert.notDeepEqual(cameraBefore.position, cameraAfter.position); results.push({ name: 'camera drift', passed: true })
  await set({ 'camera-motion': 0 }); const locked = (await api('status')).camera
  await api('advanceBy', .3); assert.deepEqual((await api('status')).camera.position, locked.position)
  await api('setMusic', { active: false }); await set({ 'music-response': .7 })

  const image = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 160; c.height = 90
    const ctx = c.getContext('2d'); ctx.fillStyle = '#ff2020'; ctx.fillRect(0, 0, 80, 45)
    ctx.fillStyle = '#20ff20'; ctx.fillRect(80, 0, 80, 45); ctx.fillStyle = '#2020ff'; ctx.fillRect(0, 45, 80, 45)
    ctx.fillStyle = '#ffff20'; ctx.fillRect(80, 45, 80, 45); return c.toDataURL()
  })
  await api('setMedia', { id: 'image-test', label: 'Test image', kind: 'image', url: image })
  const mediaOff = await pixels('media-off')
  await set({ 'media-on-screens': true, 'static-over-media': 0 }); const media = await pixels('image-media', true)
  changed('media on screens', mediaOff, media, 3)
  await set({ 'media-layout': 'stack-wall' }); changed('media layouts', media, await pixels('stack-wall', true))
  await set({ 'static-over-media': 1 }); changed('static over media', media, await pixels('media-static'))
  await set({ 'static-over-media': 0, 'media-layout': 'every-screen' })
  const svg = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"><rect width="160" height="90" fill="#e000ff"/><circle cx="80" cy="45" r="30" fill="#00ffff"/></svg>')
  await api('setMedia', { id: 'svg-test', label: 'Test SVG', kind: 'svg', url: svg }); changed('SVG media', media, await pixels('svg', true))
  }
  if (!['--audio', '--extended'].includes(process.argv[3])) {
  await set({ 'media-on-screens': true, 'static-over-media': 0 })
  const video = await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 160; c.height = 90
    const ctx = c.getContext('2d'), chunks = [], stream = c.captureStream(20)
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' })
    recorder.ondataavailable = event => chunks.push(event.data)
    const stopped = new Promise(resolve => { recorder.onstop = resolve })
    recorder.start()
    for (let i = 0; i < 12; i += 1) { ctx.fillStyle = `hsl(${i * 30}, 100%, 50%)`; ctx.fillRect(0, 0, 160, 90); await new Promise(resolve => setTimeout(resolve, 50)) }
    recorder.stop(); await stopped; stream.getTracks().forEach(track => track.stop())
    return URL.createObjectURL(new Blob(chunks, { type: 'video/webm' }))
  })
  await api('setMedia', { id: 'video-test', label: 'Test video', kind: 'video', url: video })
  const videoA = await pixels('video'); await page.waitForTimeout(140); const videoB = await pixels('video-frame', true)
  changed('video playback', videoA, videoB)
  await api('setMusic', { active: false, paused: true }); const pausedVideo = await pixels('video-paused')
  await page.waitForTimeout(160); assert(difference(pausedVideo, await pixels('video-paused-held')) < .02, 'paused video must hold its frame')
  await api('setMusic', { active: false, paused: false }); await page.waitForTimeout(160)
  changed('video resume', pausedVideo, await pixels('video-resumed'))
  await api('setMedia', null); await set({ 'media-on-screens': false })
  }

  if (process.argv[3] !== '--extended') {
  await api('setMusic', { active: true, energy: .1, bass: 0, high: 0 })
  await api('advanceBy', .4); const quiet = await pixels('quiet'); const quietState = await api('status')
  await api('setMusic', { active: true, energy: 1, bass: 1, high: 1 })
  await api('advanceBy', .4); const loud = await pixels('loud', true); await writeFile(join(output, 'audio-delivery.json'), JSON.stringify({ quiet: quietState, loud: await api('status') }, null, 2)); changed('continuous music response', quiet, loud)
  await set({ 'music-response': 0 }); changed('Music Response hard off', loud, await pixels('response-off')); await set({ 'music-response': 1 })
  await set({ 'bass-rattle': 0 }); const still = await pixels('rattle-off'); await set({ 'bass-rattle': 1 }); changed('Bass Rattle', still, await pixels('rattle-on'), .005); await set({ 'bass-rattle': .12 })
  await set({ 'bpm-sync': false, pattern: 'signal-sweep' }); await api('setMusic', { active: true, seek: 0, bpm: 180 }); await api('advanceBy', .7); const free = await pixels('sync-off')
  await set({ 'bpm-sync': true }); await api('setMusic', { active: true, seek: 0, bpm: 180 }); await api('advanceBy', .7)
  changed('BPM Sync timing', free, await pixels('sync-on'))
  await set({ pattern: 'dead-air', 'music-response': 1 })
  await api('setMusic', { active: true, event: 'drop', eventId: 20 }); await api('advanceBy', .06)
  const white = await pixels('highlight')
  await set({ 'highlight-color': [1, 0, 0, 1] }); changed('highlight palette', white, await pixels('highlight-red'))
  await set({ 'highlight-color': [1, 1, 1, 1] })
  await api('advanceBy', .8)
  await set({ 'pattern-change': true, trigger: 'beat', pattern: 'dead-air' })
  await api('setMusic', { active: true }); await api('advanceBy', .05)
  const held = await pixels('trigger-base')
  await api('setMusic', { active: true, event: 'beat', eventId: 41 })
  changed('fresh trigger changes rendered pattern', held, await pixels('triggered', true))
  await set({ pattern: 'checker' }); const manual = await pixels('manual')
  const state = JSON.parse((await api('status')).authored).values
  assert.equal(state['vacancy-pattern-change'], true); assert.equal(state['vacancy-pattern'], 'checker')
  await api('setMusic', { active: true }); changed('manual pattern immediately reclaims base', manual, held)
  assert(difference(manual, await pixels('manual-held')) < .02, 'a stale event must not overwrite the manual pattern')
  await set({ 'pattern-change': false, 'auto-performance': true, pattern: 'checker' })
  await api('setMusic', { active: true }); await api('advanceBy', .1)
  const base = await pixels('auto-base')
  await api('setMusic', { active: true, build: 1 }); await api('advanceBy', .2)
  changed('temporary build program', base, await pixels('build', true))
  await set({ pattern: 'ascent' }); const chosen = await pixels('takeover')
  assert.equal(JSON.parse((await api('status')).authored).values['vacancy-pattern'], 'ascent')
  await set({ 'auto-performance': false }); assert(difference(chosen, await pixels('takeover-same')) < .02, 'manual pattern must already have reclaimed the base')
  results.push({ name: 'manual takeover during build', passed: true })
  await api('setMusic', { active: true, build: 0, paused: true }); const pausedA = await pixels('pause')
  await api('advanceBy', .3); assert(difference(pausedA, await pixels('paused')) < .01, 'pause must freeze the output')
  await api('setMusic', { active: true, seek: 0, trackId: 'seek-track' }); await api('advanceBy', .1)
  assert.equal((await api('status')).snapshot.phase, 'running')
  await set({ 'master-intensity': 0, haze: 0 }); const dark = await pixels('master-off', true)
  assert(dark.reduce((sum, value) => sum + value, 0) / dark.length < 10, 'master OFF must black out the scene')
  }
  if (!['--remaining', '--after-media', '--audio'].includes(process.argv[3])) {
    await set({ 'music-response': 0, 'camera-motion': 0, 'bass-rattle': 0, 'auto-performance': false })
    const triggers = [
      ['beat', 'beat', 1], ['kick', 'kick', 1], ['snare', 'snare', 1], ['downbeat', 'downbeat', 4],
      ['beat2', 'beat', 2], ['beat4', 'beat', 4], ['bar', 'bar', 4], ['bar4', 'bar', 16], ['bar8', 'bar', 32],
      ['phrase', 'phrase', 16], ['drop', 'drop', 16],
    ]
    for (const [i, [trigger, event, beatIndex]] of triggers.entries()) {
      await set({ pattern: 'dead-air', 'pattern-change': false, trigger })
      await api('setMusic', { active: true, seek: 0 }); await set({ 'pattern-change': true })
      const original = await pixels('trigger')
      await api('setMusic', { active: true, event, beatIndex, eventId: 100 + i }); await api('advanceBy', .06)
      const switched = await pixels('switched')
      changed(`canonical ${trigger} trigger`, original, switched, 1)
      await api('setParameters', {}); assert(difference(switched, await pixels('duplicate')) < .01, 'a held publication must not double-switch')
    }
    await set({ 'pattern-change': false, pattern: 'dead-air', 'music-response': .7 })
    await api('setMusic', { active: false })
    const svg = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"><rect width="160" height="90" fill="#20ccff"/></svg>')
    await api('setMedia', { id: 'restore-media', label: 'Restored media', kind: 'svg', url: svg })
    await set({ 'media-on-screens': true, 'static-over-media': 0 })
    const beforeRestore = await pixels('pre-restore', true)
    await page.evaluate(() => {
      const gl = document.querySelector('canvas').getContext('webgl2'), extension = gl.getExtension('WEBGL_lose_context')
      if (!extension) throw new Error('Context-loss extension unavailable')
      extension.loseContext(); setTimeout(() => extension.restoreContext(), 80)
    })
    await page.waitForFunction(() => {
      const state = window.__vacancyProduction.status()
      return state.snapshot.contextGeneration > 1 && state.snapshot.phase === 'running'
        && state.modules.estimatedGpuBytes > 0 && state.media.readyResourceCount === 1
    })
    await api('advanceBy', 1)
    const restored = await pixels('context-restored', true)
    assert(restored.reduce((sum, value) => sum + value, 0) / restored.length > 10, 'restoration must render visible pixels')
    assert(difference(beforeRestore, restored) < 3, 'restoration must recover the scene and resident media')
    results.push({ name: 'context restoration with resident media', passed: true })
    await api('setMedia', null); await set({ 'media-on-screens': false })
  }
  await page.setViewportSize({ width: 600, height: 1000 }); await api('resize', 600, 1000)
  await set({ 'master-intensity': .85, 'auto-performance': false, pattern: 'dead-air' }); await pixels('portrait', true)
  await load(); const status = await api('status')
  assert.equal(status.snapshot.phase, 'running'); assert.equal(status.modules.failedModuleCount, 0); assert.equal(status.effects.failedEffectCount, 0)
  assert.equal(errors.length, 0, errors.join('\n'))
  results.push({ name: 're-entry, resize and runtime health', passed: true })
  await writeFile(join(output, 'report.json'), JSON.stringify({ results, errors, status }, null, 2))
  console.log(`VACANCY acceptance passed: ${results.length} checks. Captures: ${output}`)
} catch (error) { await writeFile(join(output, 'failure.json'), JSON.stringify({ results, errors, failure: String(error) }, null, 2)); throw error } finally { await browser?.close(); await server.close() }

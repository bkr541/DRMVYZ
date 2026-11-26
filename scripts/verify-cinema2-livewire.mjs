#!/usr/bin/env node
/* global window */
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import sharp from 'sharp'

const output = resolve('artifacts/cinema2-livewire')
await mkdir(output, { recursive: true })
const server = await createServer({ server: { host: '127.0.0.1', port: 0, hmr: false }, logLevel: 'error' })
const checks = []
let browser
try {
  await server.listen()
  browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] })
  const page = await browser.newPage({ viewport: { width: 960, height: 600 }, deviceScaleFactor: 1 })
  const errors = []
  page.on('pageerror', error => { errors.push(error.message); console.error(error.message) })
  page.on('console', message => {
    if (message.type() === 'error' && !/Failed to load resource|CONTEXT_LOST_WEBGL/.test(message.text())) errors.push(message.text())
  })
  const api = async (method, ...args) => {
    const status = await page.evaluate(([method, args]) => window.__livewire[method](...args), [method, args])
    assert.equal(status.modules.failedModuleCount, 0, JSON.stringify(status.modules))
    assert.equal(status.effects.failedEffectCount, 0, JSON.stringify(status.effects))
    return status
  }
  const open = async setting => {
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/src/test/browser/cinema2-submerge-production.html?preset=livewire&auto=${setting}`)
    await page.waitForFunction(() => window.__livewire, null, { timeout: 10000 })
    const status = await api('prepare')
    const values = JSON.parse(status.authored).values
    assert.equal(values['livewire-auto-performance'], setting === 'on')
    assert.equal(values['livewire-text'], 'LIVEWIRE')
    return values
  }
  const pixels = async name => {
    const png = await page.screenshot()
    if (name) await writeFile(join(output, `${name}.png`), png)
    return sharp(png).removeAlpha().raw().toBuffer()
  }
  const delta = (a, b) => {
    assert.equal(a.length, b.length)
    let distance = 0
    for (let i = 0; i < a.length; i++) distance += Math.abs(a[i] - b[i])
    return distance / a.length
  }
  const changes = (name, before, after, minimum = 0.02) => {
    const distance = delta(before, after)
    assert(distance > minimum, `${name} should visibly change (${distance})`)
    checks.push({ name, distance })
  }
  await open('on')
  const defaults = await open('off')
  const authored = name => defaults[`livewire-${name}`]
  checks.push({ name: 'system default followed on fresh activation in both states' })
  const baseline = await pixels('livewire')
  assert(baseline.some(value => value > 160), 'The LED cores must be visible')
  await api('setParameters', { 'floor-reflection': 0 })
  changes('floor reflections', baseline, await pixels('floor-off'))
  await api('setParameters', { 'floor-reflection': authored('floor-reflection'), text: 'DVYDRM' })
  const comparison = await pixels('dvydrm')
  changes('editable original glyphs', baseline, comparison)
  await api('setParameters', { intensity: 0, bloom: 0 })
  const unlit = await pixels('metal-without-leds')
  assert(unlit.some(value => value > 34), 'The metal bevels must remain visible with LED and bloom off')
  changes('the recessed bars and their spill are distinct from the metal', comparison, unlit)
  await api('setParameters', { intensity: authored('intensity'), bloom: authored('bloom') })
  await api('setParameters', { text: 'LIVEWIRE', 'line-mode': 'two', 'line-2-text': 'ON AIR' })
  changes('two-line layout', baseline, await pixels('two-line'))
  await api('setParameters', { 'line-mode': 'one' })

  const patterns = []
  for (const pattern of ['trace', 'relay', 'split', 'crown', 'groundline', 'crossfire']) {
    await api('setParameters', { pattern })
    const picture = await pixels(pattern)
    for (const [previous, image] of patterns) changes(`${previous} vs ${pattern}`, image, picture)
    patterns.push([pattern, picture])
  }

  for (const [field, off, on] of [
    ['coverage', 0.08, 1], ['intensity', 0, 1.6], ['floor-roughness', 0, 1], ['roughness', 0.04, 0.95],
    ['bloom', 0, 1.5], ['finish', 0, 1],
    ['background', authored('background'), [0.12, 0.02, 0.08, 1]],
    ['chrome', authored('chrome'), [0.65, 0.24, 0.1, 1]],
    ['outline-color', authored('outline-color'), [1, 0.24, 0.05, 1]],
    ['floor-tint', authored('floor-tint'), [0.18, 0.05, 0.1, 1]],
  ]) {
    await api('setParameters', { [field]: off })
    const before = await pixels()
    await api('setParameters', { [field]: on })
    changes(field, before, await pixels())
  }
  const restore = ['background', 'chrome', 'outline-color', 'floor-tint', 'floor-roughness', 'roughness',
    'coverage', 'intensity', 'bloom', 'finish', 'pattern']
  await api('setParameters', Object.fromEntries(restore.map(name => [name, authored(name)])))
  await api('setMusic', { active: true, energy: 0.6, bass: 0.45, high: 0.35 })
  await api('advanceBy', 0.65)
  const motion = await pixels()
  changes('active LED motion', baseline, motion)
  const activePattern = status => status.modules.modules[0].inspection.activePattern
  await api('setParameters', { 'pattern-change': true, trigger: 'kick', motion: 0 })
  const beforeKick = await pixels()
  const kick = { event: 'kick', eventId: 41, frameId: 41001 }
  const triggered = await api('setMusic', kick)
  assert.notEqual(activePattern(triggered), 'solid')
  changes('fresh kick advances the pattern on canvas', beforeKick, await pixels())
  assert.equal(activePattern(await api('setMusic', kick)), activePattern(triggered))
  const manual = await api('setParameters', { pattern: 'crown' })
  assert.equal(activePattern(manual), 'alternate')
  assert.equal(JSON.parse(manual.authored).values['livewire-pattern-change'], true)
  assert.equal(activePattern(await api('setMusic', kick)), 'alternate')
  await api('setMusic', { event: null })
  await api('advanceBy', 0.3)
  assert.notEqual(activePattern(await api('setMusic', { event: 'kick', eventId: 43, frameId: 43001 })), 'alternate')
  checks.push({ name: 'duplicate kicks are ignored and manual selection preserves Pattern Change' })
  await api('setMusic', { event: null, bpm: 72 })
  await api('setParameters', { 'pattern-change': false, motion: 1, 'cycle-seconds': 2 })
  const tempoPose = async sync => {
    await api('setParameters', { pattern: 'crown', 'bpm-sync': sync })
    await api('setParameters', { pattern: 'relay' })
    await api('advanceBy', 0.85)
    return pixels()
  }
  changes('BPM Sync follows 72 BPM versus the fixed reference', await tempoPose(true), await tempoPose(false))
  await api('setMusic', { bpm: 120 })
  await api('setParameters', { pattern: 'trace', 'bpm-sync': true, 'cycle-seconds': 4, motion: 0.8 })
  await api('setParameters', { 'auto-performance': true })
  await api('setMusic', { build: 0.95, sectionBuild: true, energy: 0.85 })
  const build = await api('advanceBy', 0.55)
  assert.equal(build.modules.modules[0].inspection.patternControlsAutomatic, true)
  assert.equal(JSON.parse(build.authored).values['livewire-pattern-change'], false)
  changes('build opens more bars', motion, await pixels('build'))
  await api('setMusic', { event: 'drop', eventId: 42, build: 0, sectionBuild: false }, 0.04)
  const dropped = await api('advanceBy', 0.17)
  assert.equal(dropped.authored, build.authored, 'Audio never changes authored values')
  changes('drop lights up the outer banks', motion, await pixels('drop'))
  await api('setMusic', { paused: true, event: null })
  const paused = await pixels()
  await api('advanceBy', 0.4)
  assert(delta(paused, await pixels()) < 0.03, 'Pause must hold the visible LED state')
  checks.push({ name: 'pause freezes the visible scene' })
  await page.setViewportSize({ width: 540, height: 900 })
  await api('resize', 540, 900)
  await pixels('portrait')
  await api('restoreContext')
  const restored = await pixels('restored')
  assert(restored.some(value => value > 160), 'Context recovery must restore LED geometry')
  checks.push({ name: 'portrait and context restoration retain the rendered glyphs' })
  // Isolate camera travel from the LED sweep, then verify actual production pixels
  // as well as the authoritative camera matrices (the floor reads the same camera).
  await page.setViewportSize({ width: 960, height: 600 })
  await open('off')
  await api('setParameters', { motion: 0, 'camera-motion': true, 'camera-amount': 1 })
  await api('setMusic', { active: true, sectionType: 'verse', energy: 0.6 })
  const cameraStart = await api('advanceBy', 0.2)
  const cameraStartPixels = await pixels('camera-manual-start')
  const cameraMoved = await api('advanceBy', 1.2)
  assert.notDeepEqual(cameraStart.camera.viewProjectionMatrix, cameraMoved.camera.viewProjectionMatrix)
  changes('manual camera motion with LED sweep disabled', cameraStartPixels, await pixels('camera-manual-travel'))
  const lock = await api('setParameters', { 'camera-motion': false })
  const lockPixels = await pixels('camera-off')
  const held = await api('advanceBy', 1.2)
  assert.deepEqual(lock.camera.viewProjectionMatrix, held.camera.viewProjectionMatrix)
  assert(delta(lockPixels, await pixels()) < 0.03, 'Camera off and static LEDs must hold the canvas')
  await api('setParameters', { 'camera-motion': true, 'camera-amount': 1, 'auto-performance': true })
  await api('setMusic', { sectionType: 'intro' })
  const intro = await api('advanceBy', 1.5)
  const introPixels = await pixels('camera-intro')
  await api('setMusic', { sectionType: 'build', sectionBuild: true, build: 0.95 })
  const approach = await api('advanceBy', 1.5)
  assert(approach.camera.position[2] < intro.camera.position[2] - 0.15)
  const buildPixels = await pixels('camera-build')
  changes('intro to build camera shot', introPixels, buildPixels)
  await api('setMusic', { sectionType: 'drop', sectionBuild: false, build: 0, event: 'drop', eventId: 99, eventTime: undefined }, 0.05)
  const push = await api('advanceBy', 0.6)
  assert(push.camera.position[2] < intro.camera.position[2] - 0.15)
  changes('build to drop camera shot', buildPixels, await pixels('camera-drop'))
  await api('setMusic', { sectionType: 'breakdown', event: null })
  const release = await api('advanceBy', 3)
  assert(release.camera.position[2] > push.camera.position[2] + 0.5)
  changes('release camera shot', buildPixels, await pixels('camera-release'))
  assert.equal(release.authored, push.authored, 'Camera choreography never overwrites saved settings')
  await api('setMusic', { paused: true })
  const pause = await api('advanceBy', 0.1)
  const pausePixels = await pixels()
  assert.deepEqual((await api('advanceBy', 0.5)).camera.viewProjectionMatrix, pause.camera.viewProjectionMatrix)
  assert(delta(pausePixels, await pixels()) < 0.03, 'Camera pause holds the production canvas')
  await api('setParameters', { 'auto-performance': false, 'motion-safety': 'lockoff' })
  assert.deepEqual((await api('advanceBy', 0.5)).camera.position, [0, 0.19, 6.9])
  await api('setParameters', { 'auto-performance': false, 'motion-safety': 'full', 'line-mode': 'two', text: 'WWWWWWWWWWWW', 'line-2-text': 'WWWWWWWW', 'glyph-scale': 1.5 })
  await page.setViewportSize({ width: 540, height: 900 })
  await api('resize', 540, 900)
  await pixels('camera-maximum-text-portrait')
  assert.deepEqual(errors, [])
  await writeFile(join(output, 'review.json'), JSON.stringify({ checks, errors }, null, 2))
  console.log(`LIVEWIRE production canvas passed ${checks.length} checks. Captures in ${output}`)
} finally {
  await browser?.close()
  await server.close()
}

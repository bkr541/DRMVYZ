#!/usr/bin/env node
/* global window, document, getComputedStyle */
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import sharp from 'sharp'

const root = resolve(import.meta.dirname, '..'), output = resolve(process.argv[2] ?? 'artifacts/inertia-final')
const reviewOnly = process.argv.includes('--review-only')
await mkdir(output, { recursive: true })
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0 }, clearScreen: false, logLevel: 'error' })
const errors = [], results = [], diagnostics = []
let browser
try {
  await server.listen()
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
  const context = await browser.newContext({ viewport: { width: 954, height: 954 } })
  const page = await context.newPage()
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text()) })
  const url = `http://127.0.0.1:${server.httpServer.address().port}/src/test/browser/cinema2-inertia-audio.html`
  const api = async (method, ...args) => {
    const result = await page.evaluate(([method, args]) => window.__inertiaAudio[method](...args), [method, args])
    const s = result.current ?? result
    assert.equal(s.snapshot.phase, 'running', JSON.stringify(s.modules))
    assert.equal(s.modules.failedModuleCount, 0, JSON.stringify(s.modules))
    assert.equal(s.effects.failedEffectCount, 0, JSON.stringify(s.effects))
    return result
  }
  const load = async query => { await page.goto(url + (query ?? '')); await page.waitForFunction(() => window.__inertiaAudio); return api('prepare') }
  const capture = async (name, save = true) => {
    const png = await page.locator('canvas').screenshot()
    if (save) await writeFile(join(output, `${name}.png`), png)
    const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    let minX = info.width, minY = info.height, maxX = 0, maxY = 0, lit = 0
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 3
      if (Math.max(data[i], data[i + 1], data[i + 2]) > 20) {
        lit++; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y)
      }
    }
    return { data, width: info.width, height: info.height, lit, bounds: [minX, minY, maxX, maxY] }
  }
  const difference = (a, b) => { assert.equal(a.data.length, b.data.length); let sum = 0; for (let i = 0; i < a.data.length; i++) sum += Math.abs(a.data[i] - b.data[i]); return sum / a.data.length }
  const same = (name, a, b) => { const v = difference(a, b); results.push({ name, delta: v }); assert(v < 0.0001, `${name}: ${v}`) }
  const changed = (name, a, b, min = 0.005) => { const v = difference(a, b); results.push({ name, delta: v }); assert(v > min, `${name}: ${v}`) }
  const bounds = (name, shot) => {
    const [x0, y0, x1, y1] = shot.bounds
    assert(shot.lit > 1500, `${name}: hero missing`)
    assert(x0 > shot.width * 0.04 && y0 > shot.height * 0.04 && x1 < shot.width * 0.96 && y1 < shot.height * 0.96, `${name}: safe padding`)
    results.push({ name, lit: shot.lit, bounds: shot.bounds })
  }
  const defaults = { pattern: 'reference-cycle', 'pattern-change': false, 'auto-performance': false, 'audio-response': 1,
    'motion-amount': 0, deformation: 0.45, intensity: 0.7, 'bloom-enabled': false, 'trails-enabled': false }
  let generation = 0
  const reset = async (values = {}, music = {}) => {
    await api('set', { ...defaults, ...values })
    await api('music', { energy: 1, timeSec: 0, track: `final-${generation++}`, ...music })
    await api('advance', 0.3)
    return api('status')
  }
  await load()
  if (reviewOnly) {
    // Capture real native output for an exportable review clip; no alternate drawing path.
    await reset({ 'motion-amount': 0.65, deformation: 0.45, 'auto-performance': true })
    await page.setViewportSize({ width: 720, height: 720 }); await api('resize')
    await mkdir(join(output, 'preview-frames'), { recursive: true })
    for (let i = 0; i < 90; i++) {
      if (i === 15) await api('music', { energy: 0.65, bass: 0.4, build: 0.65 })
      if (i === 40) await api('music', { energy: 1, bass: 0.8, high: 0.6, event: 'drop' })
      if (i === 70) await api('music', { energy: 0.4, bass: 0.2 })
      await api('advance', 1 / 15)
      await page.locator('canvas').screenshot({ path: join(output, 'preview-frames', `${String(i).padStart(3, '0')}.png`) })
    }
    await page.setViewportSize({ width: 1120, height: 700 }); await api('resize')
    bounds('Supported 16:10 output', await capture('aspect-1120x700'))
    await writeFile(join(output, 'review-report.json'), JSON.stringify({ results, syntheticSharedFixture: true, frames: 90, fps: 15 }, null, 2))
    console.log(`PASS 16:10 framing; saved 90 real-canvas review frames: ${output}`)
  } else {
  const manual = new Map()
  for (const pattern of ['reference-cycle', 'countertwist', 'breathing-cage', 'torsion-wave', 'slice-shear', 'collapse-release']) {
    await reset({ pattern }); manual.set(pattern, await capture(`manual-${pattern}`))
  }
  await reset({ 'auto-performance': true, 'pattern-change': true, trigger: 'beat' })
  const saved = (await api('status')).authored
  await api('music', { energy: 1, build: 1 }); await api('advance', 0.4)
  same('Fresh build temporarily performs Countertwist', await capture('auto-build'), manual.get('countertwist'))
  await api('music', { energy: 1, build: 1, event: 'drop', eventTime: 0.8 }); await api('advance', 0.4)
  same('Fresh drop supersedes build temporarily', await capture('auto-drop'), manual.get('collapse-release'))
  await api('music', { energy: 1, event: 'beat', beatIndex: 1 }); await api('advance', 0.4)
  same('Trigger advances base underneath visible drop', await capture('drop-underlying-advanced'), manual.get('collapse-release'))
  assert.equal((await api('status')).authored, saved)
  await api('music', { energy: 1 }); await api('advance', 1.6)
  same('Override restores the trigger-advanced base', await capture('auto-restored'), manual.get('countertwist'))
  await api('music', { energy: 1, event: 'drop' }); await api('advance', 0.4)
  await api('set', { pattern: 'slice-shear' }); await api('advance', 0.3)
  same('Manual Pattern cancels active drop', await capture('manual-during-drop'), manual.get('slice-shear'))
  await api('advance', 0.4)
  same('Already-active drop cannot undo manual edit', await capture('manual-held'), manual.get('slice-shear'))
  const editedSaved = (await api('status')).authored
  await api('music', { energy: 1, event: 'beat', beatIndex: 2 }); await api('advance', 0.4)
  same('Pattern Change remains ON after manual edit', await capture('manual-next-trigger'), manual.get('collapse-release'))
  assert.equal((await api('status')).authored, editedSaved)
  await api('music', { energy: 1, event: 'drop' }); await api('advance', 0.3)
  await api('set', { 'auto-performance': false }); await api('advance', 0.3)
  same('Auto Performance OFF restores current base', await capture('auto-off'), manual.get('collapse-release'))
  await reset({ 'auto-performance': true }, { build: 1 })
  same('Enabling during held build does not steal Pattern', await capture('auto-enable-held'), manual.get('reference-cycle'))
  await api('advance', 5.2)
  same('Held build cannot repeatedly restart expired authority', await capture('held-build-timeout'), manual.get('reference-cycle'))
  await reset({ 'auto-performance': true })
  await api('music', { energy: 1, build: 1 }); await api('advance', 0.4)
  await api('set', { 'audio-response': 0 }); await api('advance', 0.3)
  same('Audio Response zero suppresses automatic substitution', await capture('auto-response-zero'), manual.get('reference-cycle'))
  console.log('PASS Auto Performance temporary authority, manual edits and underlying progression')

  // Same shared audio, with only Director target routes removed in the diagnostic case.
  const directorShot = async query => {
    await load(query)
    await reset({ 'motion-amount': 0.65, deformation: 0.45 }, { energy: 0.4, bass: 0.6, build: 0.4 })
    await api('advance', 0.8)
    diagnostics.push({ director: query || 'enabled', state: await api('status') })
    return capture(query ? 'director-without-routes' : 'director-enhanced')
  }
  const directed = await directorShot(''), withoutDirector = await directorShot('?no-director')
  changed('Shared Director shapes existing geometry perceptibly', withoutDirector, directed)
  await load()
  // Optional finishing OFF/normal/max, retaining the readable core and lattice.
  await reset({ 'motion-amount': 0.65 })
  const clean = await capture('effects-off')
  await api('set', { 'bloom-enabled': true, 'bloom-amount': 0.08 })
  const bloom = await capture('bloom-normal')
  await api('set', { 'bloom-amount': 0.35 })
  const bloomMax = await capture('bloom-max')
  changed('Bloom OFF/normal', clean, bloom, 0.0001); changed('Bloom normal/max', bloom, bloomMax, 0.0001)
  await api('set', { 'bloom-enabled': false })
  same('Bloom hard disable restores clean output', await capture('bloom-disabled'), clean)
  const trailSample = async amount => {
    await reset({ 'motion-amount': 0.65, 'trails-enabled': amount > 0, 'trails-amount': amount })
    await api('advance', 1)
    return capture(`trails-${amount}`)
  }
  const noTrails = await trailSample(0), trail = await trailSample(0.06), trailMax = await trailSample(0.2)
  changed('Trails OFF/normal', noTrails, trail, 0.0001); changed('Trails normal/max', trail, trailMax, 0.0001)
  await api('set', { 'trails-enabled': false })
  same('Trails hard disable restores current clean artwork', await capture('trails-disabled'), noTrails)
  const offHistory = (await api('status')).history
  assert(!offHistory.buffers.some(b => b.valid), 'Disabled trail history must be released')
  await api('set', { 'trails-enabled': true }); await api('pause', true)
  assert(!(await api('status')).history.buffers.some(b => b.valid), 'Pause must not preserve stale trails')
  await api('set', { 'trails-enabled': false })
  console.log('PASS bounded optional finishing and hard-disable history behavior')

  const aspects = [[954,954],[1280,720],[1120,700],[720,1280],[960,720],[720,960],[1200,800],[800,1200],[720,900],[1400,600]]
  await reset({ 'motion-amount': 1, deformation: 1, 'cage-size': 1.1, 'point-size': 2, 'anchor-size': 1.6 }, { bass: 1, high: 1, build: 1 })
  await api('advance', 0.8)
  for (const [width, height] of aspects) {
    await page.setViewportSize({ width, height }); await api('resize')
    bounds(`Aspect ${width}x${height}`, await capture(`aspect-${width}x${height}`))
  }
  await page.setViewportSize({ width: 954, height: 954 }); await api('resize')
  const returned = await api('reenter')
  assert.equal(returned.retired.resources.activeAnimationFrameCount, 0)
  assert.equal(returned.retired.resources.activeWebGLContextCount, 0)
  assert.equal(returned.current.modules.activeResourceLeaseCount, 1)
  const beforeLoss = await api('status')
  const supported = await page.evaluate(() => {
    const gl = document.querySelector('canvas').getContext('webgl2'), extension = gl.getExtension('WEBGL_lose_context')
    if (!extension) return false
    window.__inertiaLoseContext = extension; extension.loseContext(); return true
  })
  if (supported) {
    await page.waitForFunction(() => window.__inertiaAudio.status().snapshot.phase === 'context-lost')
    await page.evaluate(() => window.__inertiaLoseContext.restoreContext())
    await page.waitForFunction(() => window.__inertiaAudio.status().snapshot.phase === 'running')
    const restored = await api('prepare')
    assert(restored.snapshot.contextGeneration > beforeLoss.snapshot.contextGeneration)
    assert.equal(restored.modules.activeResourceLeaseCount, 1)
    bounds('Context restoration hero visibility', await capture('context-restored'))
  }
  diagnostics.push({ contextLossSupported: supported, final: await api('status') })
  console.log('PASS resizing, preset retirement/re-entry, and context restoration')

  // Actual shared Inspector: defaults/authority, effect conditions, portals, hierarchy.
  await page.setViewportSize({ width: 1440, height: 1050 }); await load(); await api('inspector')
  const control = key => page.locator(`[data-cinema2-control-id="inertia-${key}"]`)
  await control('auto-performance').waitFor()
  assert.equal(await control('trigger').count(), 0)
  assert.equal(await control('bloom-amount').count(), 0); assert.equal(await control('trails-amount').count(), 0)
  await control('auto-performance').locator('button').click()
  await control('pattern-change').locator('button').click()
  await page.getByRole('combobox', { name: 'Pattern', exact: true }).click()
  assert.equal(await page.getByRole('option').count(), 6)
  await page.screenshot({ path: join(output, 'inspector-pattern-menu.png'), animations: 'disabled' })
  await page.getByRole('option', { name: 'Breathing Cage', exact: true }).click()
  await page.getByRole('combobox', { name: 'Trigger', exact: true }).click()
  assert.equal(await page.getByRole('option').count(), 11)
  const portalFont = await page.getByRole('option').first().locator('.drm-dropdown__option-label').evaluate(e => getComputedStyle(e).fontSize)
  assert.equal(portalFont, '11px'); await page.keyboard.press('Escape')
  await control('bloom-enabled').locator('button').click(); await control('bloom-amount').waitFor()
  await control('trails-enabled').locator('button').click(); await control('trails-amount').waitFor()
  await control('trails-amount').scrollIntoViewIfNeeded()
  await page.screenshot({ path: join(output, 'inspector-effects-palette.png'), animations: 'disabled' })
  const typography = await page.locator('.drc-header').evaluateAll(elements => elements.map(e => {
    const s = getComputedStyle(e); return { label: e.textContent.trim(), depth: e.parentElement.dataset.drcDepth, size: s.fontSize, weight: s.fontWeight }
  }))
  for (const t of typography) { assert.equal(t.size, t.depth === '0' ? '12px' : '11px'); if (t.depth === '0') assert.equal(t.weight, '700') }
  // High-DPR and quality-tier rendering retain real geometric consumers.
  for (const quality of ['low', 'medium', 'high']) {
    const dprContext = await browser.newContext({ viewport: { width: 800, height: 800 }, deviceScaleFactor: 2 })
    const p = await dprContext.newPage(); p.on('pageerror', e => errors.push(e.message))
    await p.goto(`${url}?quality=${quality}`); await p.waitForFunction(() => window.__inertiaAudio)
    const s = await p.evaluate(() => window.__inertiaAudio.prepare())
    assert.equal(s.modules.failedModuleCount, 0); assert.equal(s.snapshot.viewport.dpr, 2)
    const png = await p.locator('canvas').screenshot(); await writeFile(join(output, `dpr2-${quality}.png`), png)
    const info = await sharp(png).metadata(); assert.equal(info.width, 1600)
    diagnostics.push({ quality, dpr: 2, state: s }); await dprContext.close()
  }
  assert.deepEqual(errors, [])
  await writeFile(join(output, 'report.json'), JSON.stringify({ results, diagnostics, typography, errors, contextLossSupported: supported }, null, 2))
  console.log(`PASS Inertia final production acceptance (${results.length} comparisons/checkpoints): ${output}`)
  }
} finally { await browser?.close(); await server.close() }

// Phase 2 production-path camera, manual design, native motion and Inspector gate.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import sharp from 'sharp'
const root = resolve(import.meta.dirname, '../..'), out = resolve(root, 'artifacts/cinema2-psylo-phase2')
await mkdir(out, { recursive: true })
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0 }, clearScreen: false })
let browser, page
const checks = [], captures = [], errors = []
const check = (condition, name) => { assert.ok(condition, name); checks.push(name) }
const id = key => `psylo-${key.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase())}`
const selector = key => `[data-cinema2-control-id="${id(key)}"]`
async function pixels(png) { return (await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true })) }
async function difference(a, b) {
  const x = await pixels(a), y = await pixels(b); assert.equal(x.data.length, y.data.length)
  let sum = 0; for (let i = 0; i < x.data.length; i++) sum += Math.abs(x.data[i] - y.data[i])
  return sum / x.data.length
}
const status = () => page.evaluate(() => globalThis.__psyloProduction.status())
const set = values => page.evaluate(v => globalThis.__psyloProduction.set(v), values)
const advance = (seconds, bpm = 100, paused = false, source = false) => page.evaluate(v => globalThis.__psyloProduction.advance(...v), [seconds, bpm, paused, source])
async function ready() {
  await page.waitForFunction(() => { const s = globalThis.__psyloProduction?.status(); return s && (s.modules.estimatedGpuBytes > 0 || s.modules.degradedModuleCount > 0 || s.modules.failedModuleCount > 0) }, undefined, { timeout: 45000 })
  await page.waitForTimeout(100)
}
async function reset() { await page.evaluate(() => globalThis.__psyloProduction.reenter()); await ready() }
async function shot(name) {
  const s = await status()
  check(s.runtime.phase === 'running' && s.modules.failedModuleCount === 0 && s.modules.degradedModuleCount === 0 && s.render.failedPassCount === 0, `${name}: render health`)
  const png = await page.locator('canvas').screenshot({ path: resolve(out, `${name}.png`) })
  const { data } = await pixels(png)
  let lit = 0; for (let i = 0; i < data.length; i += 3) if (Math.max(data[i], data[i + 1], data[i + 2]) > 55) lit++
  check(lit / (data.length / 3) > .05, `${name}: visible geometry`)
  captures.push({ name, camera: s.camera, parameters: s.parameters.persistentValues })
  return png
}
try {
  await server.listen()
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
  page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/src/test/browser/cinema2-psylo-production.html`, { waitUntil: 'domcontentloaded' }); await ready()
  if (process.argv.includes('--inspector-only')) {
    await page.evaluate(() => globalThis.__psyloProduction.inspector(true))
    check(await page.locator('[data-cinema2-parent-group="palette"] [data-cinema2-control-type="color"]').count() === 7, 'Styled Inspector retains seven Palette roles')
    await page.locator(selector('pattern')).getByRole('combobox').click()
    await page.screenshot({ path: resolve(out, 'inspector-pattern-dropdown.png') })
    const fonts = await page.locator(`${selector('pattern')} .rv-ctrl-label`).evaluateAll(nodes => nodes.map(n => ({ font: globalThis.getComputedStyle(n).fontFamily, size: globalThis.getComputedStyle(n).fontSize, weight: globalThis.getComputedStyle(n).fontWeight })))
    check(fonts.length > 0 && fonts.every(f => f.size === '11px'), 'Shared control label typography renders at 11px')
    await page.keyboard.press('Escape')
    const disposed = await page.evaluate(() => globalThis.__psyloProduction.dispose())
    check(disposed.modules.activeResourceLeaseCount === 0 && errors.length === 0, 'Styled Inspector render and disposal remain clean')
    await writeFile(resolve(out, 'inspector-report.json'), JSON.stringify({ checks, fonts, errors }, null, 2) + '\n')
    console.log(JSON.stringify({ output: out, checks: checks.length, errors }))
  } else if (!process.argv.includes('--camera-coverage')) {
  // Camera is proven first, with geometry and spores held.
  await set({ motion: false, spores: 0 }); await shot('travel-start')
  for (const mode of ['travel', 'orbit', 'elevated', 'fixed']) {
    await reset(); await set({ cameraMode: mode, motion: false, spores: 0 })
    const a = await shot(`camera-${mode}-start`), pose = (await status()).camera.position
    await advance(4); const b = await shot(`camera-${mode}-moved`), moved = (await status()).camera.position
    check((Math.hypot(...pose.map((v, i) => v - moved[i])) > .05) === (mode !== 'fixed'), `${mode}: correct camera movement`)
    check((await difference(a, b) > .1) === (mode !== 'fixed'), `${mode}: rendered camera movement`)
    await set({ cameraMotion: false }); const held = (await status()).camera.position
    await advance(2); check(JSON.stringify((await status()).camera.position) === JSON.stringify(held), `${mode}: hard movement OFF`)
  }
  await set({ cameraMode: 'orbit', cameraMotion: true, cameraSpeed: 0 })
  const speedHeld = (await status()).camera.position; await advance(2)
  check(JSON.stringify((await status()).camera.position) === JSON.stringify(speedHeld), 'Camera Speed zero holds')
  for (const values of [{ radius: 14, elevation: 40, heading: -180, fov: 45 }, { radius: 22, elevation: 60, heading: 180, fov: 75 }]) {
    await set(values); await shot(`orbit-controls-${values.radius}`)
  }
  // Native patterns: one fixed camera, the same phase and eight different programs.
  const patterns = ['mycelium-tide', 'gill-spiral', 'spore-choir', 'canopy-breath', 'fairy-ring', 'root-relay', 'bloom-ascent', 'psylo-release']
  await reset(); await set({ cameraMode: 'fixed', cameraMotion: false, spores: 0, amount: 1 }); await advance(4)
  const patternImages = []
  for (const pattern of patterns) { await set({ pattern }); patternImages.push(await shot(`pattern-${pattern}`)) }
  for (let i = 0; i < patterns.length; i++) for (let j = i + 1; j < patterns.length; j++) check(await difference(patternImages[i], patternImages[j]) > .03, `${patterns[i]} vs ${patterns[j]}: distinct geometry`)
  for (let i = 0; i < patterns.length; i++) {
    await set({ pattern: patterns[i] }); const a = await page.locator('canvas').screenshot()
    await advance(1.4); const b = await shot(`motion-${patterns[i]}`)
    check(await difference(a, b) > .03, `${patterns[i]}: frame-to-frame native motion`)
  }
  // Zero/default/max controls, independent palette roles and hard motion gates.
  for (const [key, min, middle, max] of [['amount', 0, .5, 1], ['density', 0, .5, 1], ['scale', .8, 1, 1.1], ['emission', 0, .6, 1], ['master', 0, .85, 1], ['spores', 0, .6, 1]]) {
    const images = []
    for (const [name, value] of [['min', min], ['default', middle], ['max', max]]) { await set({ [key]: value }); images.push(await shot(`${key}-${name}`)) }
    check(await difference(images[0], images[2]) > .01, `${key}: visible minimum/maximum`)
    await set({ [key]: middle })
  }
  await set({ speed: 0 }); const speed = await page.locator('canvas').screenshot(); await advance(2)
  check(await difference(speed, await page.locator('canvas').screenshot()) < .001, 'Motion Speed zero holds native geometry and spores')
  await set({ speed: 1, motion: false }); const off = await page.locator('canvas').screenshot(); await advance(2)
  check(await difference(off, await page.locator('canvas').screenshot()) < .001, 'Geometry Motion OFF stays off')
  for (const key of ['backgroundColor', 'primaryColor', 'secondaryColor', 'stemColor', 'gillColor', 'myceliumColor', 'sporeColor']) {
    await reset(); await set({ cameraMode: 'fixed', cameraMotion: false, motion: false, spores: 1, emission: 1 })
    const a = await page.locator('canvas').screenshot(); await set({ [key]: [1, .02, .02, 1] }); const b = await shot(`palette-${key}`)
    check(await difference(a, b) > .003, `${key}: independent visible consumer`)
  }
  await reset(); await set({ cameraMode: 'fixed', cameraMotion: false, spores: 0 }); await advance(2)
  const beforePause = await page.locator('canvas').screenshot(); await advance(2, 100, true)
  check(await difference(beforePause, await page.locator('canvas').screenshot()) < .001, 'Pause holds native geometry')
  await advance(1, 100, false); check(await difference(beforePause, await page.locator('canvas').screenshot()) > .03, 'Resume restores native movement')
  await reset(); await set({ cameraMode: 'fixed', cameraMotion: false, spores: 0, bpmSync: true }); await advance(6, 180, false, true)
  const sync = await shot('sync-on')
  await reset(); await set({ cameraMode: 'fixed', cameraMotion: false, spores: 0, bpmSync: false }); await advance(6, 180, false, true)
  check(await difference(sync, await shot('sync-off')) > .05, 'BPM Sync ON/OFF changes native timing')
  const beforeToggle = await page.locator('canvas').screenshot(); await set({ bpmSync: true })
  check(await difference(beforeToggle, await page.locator('canvas').screenshot()) < .001, 'Sync toggle preserves current phase')
  // Actual schema-driven Inspector, including the portaled Pattern dropdown.
  await page.evaluate(() => globalThis.__psyloProduction.inspector(true))
  check(await page.locator(`[data-cinema2-parent-group="master-controls"] ${selector('bpmSync')}`).count() === 1, 'BPM Sync under Master Controls')
  check(await page.locator('[data-cinema2-parent-group="palette"] [data-cinema2-control-type="color"]').count() === 7, 'Seven independent Palette controls in Inspector')
  check(await page.locator(selector('trigger')).count() === 0, 'Trigger hidden when Pattern Change OFF')
  await page.locator(selector('patternChange')).getByRole('switch').click()
  check(await page.locator(`[data-cinema2-parent-group="design"] ${selector('trigger')}`).count() === 1, 'Trigger shown under Design when ON')
  const control = (await status()).groups.flatMap(g => [...g.controls, ...g.groups.flatMap(s => s.controls)]).find(c => c.definition.id === id('trigger'))
  check(control.definition.options.map(o => o.value).join(',') === 'beat,kick,snare,downbeat,beat2,beat4,bar,bar4,bar8,phrase,drop', 'Eleven canonical Trigger options')
  await page.locator(selector('bpmSync')).getByRole('switch').click()
  check((await status()).parameters.persistentValues[id('bpmSync')] === false, 'BPM Sync editable through Inspector')
  await page.locator(selector('pattern')).getByRole('combobox').click()
  await page.screenshot({ path: resolve(out, 'inspector-pattern-dropdown.png') })
  await page.keyboard.press('Escape')
  await page.evaluate(() => globalThis.__psyloProduction.inspector(false))
  // Aspect/resize and a persisted reset/re-entry checkpoint.
  await set({ pattern: 'fairy-ring', primaryColor: [.1, .5, 1, 1] })
  await page.evaluate(() => globalThis.__psyloProduction.reenter(true)); await ready()
  check((await status()).parameters.persistentValues[id('pattern')] === 'fairy-ring', 'Re-entry preserves manual Pattern')
  for (const [name, width, height] of [['square', 900, 900], ['portrait', 720, 1280]]) {
    await page.setViewportSize({ width, height }); await page.evaluate(() => globalThis.__psyloProduction.resize()); await shot(name)
  }
  const disposed = await page.evaluate(() => globalThis.__psyloProduction.dispose())
  check(disposed.modules.activeResourceLeaseCount === 0, 'Disposal releases module resource leases')
  check(errors.length === 0, `No browser/shader errors: ${errors.join('; ')}`)
  await writeFile(resolve(out, 'report.json'), JSON.stringify({ checks, captures, errors, disposed }, null, 2) + '\n')
  console.log(JSON.stringify({ output: out, checks: checks.length, captures: captures.length, errors }))
  } else {
    await set({ cameraMode: 'orbit', motion: false, spores: 0 })
    const orbitStart = (await status()).camera.position
    for (let quarter = 1; quarter <= 4; quarter++) { await advance(18); await shot(`orbit-quarter-${quarter}`) }
    const orbitEnd = (await status()).camera.position
    check(Math.hypot(...orbitStart.map((x, i) => x - orbitEnd[i])) < .03, 'Full 360-degree orbit returns continuously to its authored pose')
    for (const [mode, lap] of [['travel', 52], ['elevated', 72]]) {
      await reset(); await set({ cameraMode: mode, motion: false, spores: 0 }); await advance(lap - .1)
      await shot(`${mode}-before-loop`); const a = (await status()).camera.position
      await advance(.2); await shot(`${mode}-after-loop`); const b = (await status()).camera.position
      check(Math.hypot(...a.map((x, i) => x - b[i])) < .8, `${mode}: rendered loop join has no camera teleport`)
    }
    await reset(); await set({ cameraMode: 'orbit', cameraSpeed: 2, motion: false, spores: 0 }); await advance(2)
    const fast = (await status()).camera
    const angle = Math.atan2(fast.position[0] - fast.target[0], fast.position[2] - fast.target[2]) * 180 / Math.PI
    check(Math.abs(angle - 20) < .1, 'Camera Speed maximum has a real 2x orbit timing consumer'); await shot('camera-speed-max')
    const speedImages = []
    for (const speed of [.5, 2]) { await reset(); await set({ cameraMode: 'fixed', cameraMotion: false, spores: 0, speed }); await advance(4); speedImages.push(await shot(`native-speed-${speed}`)) }
    check(await difference(speedImages[0], speedImages[1]) > .03, 'Motion Speed changes actual geometry timing')
    const disposed = await page.evaluate(() => globalThis.__psyloProduction.dispose())
    check(disposed.modules.activeResourceLeaseCount === 0, 'Coverage runtime disposal releases leases')
    check(errors.length === 0, `Coverage has no browser/shader errors: ${errors.join('; ')}`)
    await writeFile(resolve(out, 'camera-coverage-report.json'), JSON.stringify({ checks, captures, errors, disposed }, null, 2) + '\n')
    console.log(JSON.stringify({ output: out, checks: checks.length, captures: captures.length, errors }))
  }
} catch (error) {
  await writeFile(resolve(out, 'failed-report.json'), JSON.stringify({ checks, captures, errors, message: String(error), status: page ? await status().catch(() => null) : null }, null, 2) + '\n')
  throw error
} finally { await browser?.close(); await server.close() }

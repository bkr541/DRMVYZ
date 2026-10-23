/* global WebGL2RenderingContext, window, document, requestAnimationFrame, HTMLInputElement */
import { mkdir, writeFile, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { build, preview } from 'vite'
import sharp from 'sharp'
import { runBlockshiftManualAcceptance, verifyBlockshiftPersistence, runBlockshiftTimingAcceptance } from './cinema2-blockshift-controls.mjs'

import { runBlockshiftFinalAcceptance, runBlockshiftNeighborAcceptance, runBlockshiftContextAcceptance } from './cinema2-blockshift-acceptance.mjs'
import { runBlockshiftRefinementAcceptance } from './cinema2-blockshift-refinement.mjs'
import { runBlockshiftLedAcceptance } from './cinema2-blockshift-leds.mjs'
import { runBlockshiftPolishAcceptance } from './cinema2-blockshift-polish.mjs'
import { runBlockshiftPerformanceAcceptance } from './cinema2-blockshift-performance.mjs'
import { runBlockshiftOrbitAcceptance } from './cinema2-blockshift-orbit.mjs'
import { runBlockshiftAudioAcceptance } from './cinema2-blockshift-audio.mjs'
import { blockshiftCameraInspector, verifyBlockshiftCameraPersistence, runBlockshiftMotionAcceptance } from './cinema2-blockshift-motion.mjs'

// Build the real workspace entry and use the same catalog/preset chooser as the normal app.
const root = process.cwd()
const acceptanceMode = process.argv.includes('--p8')
const refinementMode = acceptanceMode || process.argv.includes('--refine')
const ledMode = acceptanceMode || process.argv.includes('--leds')
const polishMode = acceptanceMode || process.argv.includes('--p7')
const hardwareMode = (refinementMode || ledMode || polishMode) && !process.argv.includes('--software')
const performanceMode = acceptanceMode || process.argv.includes('--p6')
const orbitMode = acceptanceMode || process.argv.includes('--orbit')
const expandedMode = process.argv.includes('--expanded')
const audioMode = acceptanceMode || process.argv.includes('--p5')
const motionMode = acceptanceMode || process.argv.includes('--p4')
const controlsMode = acceptanceMode || process.argv.includes('--controls')
const immersiveMode = process.argv.includes('--immersive')
const spreadMode = process.argv.includes('--spread') || immersiveMode
const sizingMode = process.argv.includes('--sizing')
const modelsMode = process.argv.includes('--models')
const output = path.join(root, acceptanceMode ? 'artifacts/blockshift/p8-acceptance' : refinementMode ? 'artifacts/blockshift/size-atmosphere-rotation' : ledMode ? 'artifacts/blockshift/led-bars' : polishMode ? 'artifacts/blockshift/p7-polish' : performanceMode ? 'artifacts/blockshift/p6-performance' : orbitMode ? 'artifacts/blockshift/orbit-camera' : expandedMode ? 'artifacts/blockshift/fifteen-cubes' : audioMode ? 'artifacts/blockshift/p5-audio' : motionMode ? 'artifacts/blockshift/p4-motion' : immersiveMode ? 'artifacts/blockshift/immersive-field' : spreadMode ? 'artifacts/blockshift/spread-fix' : sizingMode ? 'artifacts/blockshift/size-correction' : modelsMode ? 'artifacts/blockshift/glb-models' : controlsMode ? 'artifacts/blockshift/p3-controls' : 'artifacts/blockshift/p2-static')
await mkdir(output, { recursive: true })
if (!process.argv.includes('--reuse-build')) await build({ build: { outDir: path.join(output, 'bundle'), emptyOutDir: true, rollupOptions: { input: path.join(root, 'src/test/browser/cinema2-blockshift-production.html') } } })
const server = await preview({ preview: { host: '127.0.0.1', port: 47981, strictPort: true }, build: { outDir: path.join(output, 'bundle') } })
let browser
try {
  browser = await chromium.launch({ headless: true, args: hardwareMode ? ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=metal'] : ['--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] })
  const only = process.argv.find(argument => argument.startsWith('--only='))?.slice(7)
  if (only) {
    assert(acceptanceMode, '--only is available for P8 diagnostics')
    const selected = { context: runBlockshiftContextAcceptance, refinement: runBlockshiftRefinementAcceptance, leds: runBlockshiftLedAcceptance, polish: runBlockshiftPolishAcceptance, performance: runBlockshiftPerformanceAcceptance, orbit: runBlockshiftOrbitAcceptance, audio: runBlockshiftAudioAcceptance, motion: runBlockshiftMotionAcceptance, timing: runBlockshiftTimingAcceptance, final: runBlockshiftFinalAcceptance }[only]
    assert(selected, `Unknown P8 matrix ${only}`)
    await selected(browser, output, { withAtmosphere: true })
    console.log(`BLOCKSHIFT P8 ${only} matrix PASS`)
  } else {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 })
  const errors = []
  const modelResponses = []
  page.on('response', response => { if (/blockshift-(hallow|impossible)-cube\.glb/.test(response.url())) modelResponses.push({ url: response.url(), status: response.status() }) })
  page.on('pageerror', error => { errors.push(error.message); console.error('Production page error:', error.message) })
  page.on('console', message => {
    if (/BLOCKSHIFT|shader|WebGL|GL_INVALID/i.test(message.text()) && message.type() === 'error') errors.push(message.text())
  })
  await page.addInitScript(() => {
    localStorage.clear(); sessionStorage.clear()
    const records = [], contexts = new WeakMap()
    const proto = WebGL2RenderingContext.prototype
    for (const method of ['createBuffer', 'deleteBuffer', 'createVertexArray', 'deleteVertexArray', 'createProgram', 'deleteProgram', 'createShader', 'deleteShader', 'createTexture', 'deleteTexture', 'createFramebuffer', 'deleteFramebuffer', 'createRenderbuffer', 'deleteRenderbuffer', 'drawElementsInstanced', 'getError', 'bufferData', 'bufferSubData', 'uniformMatrix4fv']) {
      const original = proto[method]
      proto[method] = function (...args) {
        let record = contexts.get(this)
        if (!record) { record = { canvas: this.canvas, methods: {}, draws: [], errors: [], instances: {}, matrix: null }; contexts.set(this, record); records.push(record) }
        const value = original.apply(this, args)
        record.methods[method] = (record.methods[method] ?? 0) + 1
        if (method === 'drawElementsInstanced') { record.draws.push([args[1], args[4]]); if (record.draws.length > 16) record.draws.shift() }
        const payload = method === 'bufferData' ? args[1] : method === 'bufferSubData' ? args[2] : null
        if (payload instanceof Float32Array && [12, 168].includes(payload.length)) record.instances[payload.length] = Array.from(payload)
        if (method === 'uniformMatrix4fv') record.matrix = Array.from(args[2])
        if (method === 'getError' && value !== 0) record.errors.push(value)
        return value
      }
    }
    window.__blockshiftGpuProbe = () => records.map(record => ({ connected: record.canvas.isConnected, productionCanvas: record.canvas.dataset.cinema2OutputCanvas === 'true', methods: record.methods, draws: record.draws, errors: record.errors, instances: record.instances, matrix: record.matrix }))
  })
  await page.goto('http://127.0.0.1:47981/src/test/browser/cinema2-blockshift-production.html')
  const preset = page.locator('[data-cinema2-preset-id="drmvyz.cinema2.blockshift"]')
  await preset.click()
  const stage = page.locator('[data-cinema2-stage="runtime"]')
  await stage.waitFor({ state: 'visible' })
  await page.waitForFunction(() => document.querySelector('[data-cinema2-stage="runtime"]')?.getAttribute('data-runtime-phase') === 'running').catch(async error => {
    console.error('BLOCKSHIFT activation state:', await stage.getAttribute('data-runtime-phase'), await stage.innerText())
    await page.screenshot({ path: path.join(output, 'activation-failure.png') })
    throw error
  })
  const waitForModels = () => page.waitForFunction(() => window.__blockshiftGpuProbe().some(record => record.connected && record.productionCanvas && record.draws.some(draw => draw[0] === 16758 && draw[1] === 1)))
  await waitForModels()
  await page.screenshot({ path: path.join(output, 'production-workspace.png') })
  // Static structural captures explicitly keep bloom at zero as finishing becomes available.
  await page.getByRole('tablist', { name: 'React right workspace panels' }).getByRole('tab', { name: 'DESIGN' }).click()
  await page.locator('[data-cinema2-control-id="blockshift-bloom"] input[type="range"]').evaluate(el => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '0')
    el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await page.locator('[data-cinema2-control-id="blockshift-atmosphere"]').getByRole('switch').evaluate(el => { if (el.getAttribute('aria-checked') === 'true') el.click() })
  const style = await page.addStyleTag({ content: '[data-cinema2-stage="runtime"] { position:fixed!important; inset:0!important; width:100vw!important; height:100vh!important; max-width:none!important; z-index:99999!important; } [data-cinema2-output-canvas="true"] { width:100%!important; height:100%!important; }' })
  const canvas = page.locator('[data-cinema2-output-canvas="true"]')
  const captures = []
  const waitFrames = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))))
  for (const [label, width, height] of [['16x9', 1920, 1080], ['1x1', 1080, 1080], ['9x16', 1080, 1920]]) {
    await page.setViewportSize({ width, height })
    await waitFrames()
    await page.waitForFunction(([w, h]) => { const c = document.querySelector('[data-cinema2-output-canvas="true"]'); return c?.width === w && c?.height === h }, [width, height])
    const filename = `idle-bloom-off-${label}.png`
    const screenshot = await canvas.screenshot({ path: path.join(output, filename) })
    const { data, info } = await sharp(screenshot).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    const mask = new Uint8Array(info.width * info.height)
    for (let i = 0; i < mask.length; i++) mask[i] = Math.max(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]) > 90 ? 1 : 0
    const blocks = []
    for (let start = 0; start < mask.length; start++) {
      if (!mask[start]) continue
      const queue = [start]; mask[start] = 0
      let xMin = info.width, yMin = info.height, xMax = 0, yMax = 0
      for (let head = 0; head < queue.length; head++) {
        const index = queue[head], x = index % info.width, y = Math.floor(index / info.width)
        xMin = Math.min(xMin, x); yMin = Math.min(yMin, y); xMax = Math.max(xMax, x); yMax = Math.max(yMax, y)
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy, next = ny * info.width + nx
          if (nx < 0 || nx >= info.width || ny < 0 || ny >= info.height || !mask[next]) continue
          mask[next] = 0; queue.push(next)
        }
      }
      if (queue.length > 15 && xMax - xMin > 5 && yMax - yMin > 5) blocks.push({ xMin, yMin, xMax, yMax, edgePixels: queue.length })
    }
    const before = await page.evaluate(() => window.__blockshiftGpuProbe())
    const geometry = before.findLast(record => record.connected && record.productionCanvas)
    assert(geometry?.matrix && geometry.instances[168] && geometry.instances[12], 'Missing both actual model instance groups')
    const objects = []
    // The observer is inside the field: rear objects and peripheral cropping are part of the authored composition.
    // Check all fifteen uploaded objects, visible forward pixels and actual surrounding positions instead of fitting a distant display.
    for (const payload of [geometry.instances[168], geometry.instances[12]]) for (let offset = 0; offset < payload.length; offset += 12) {
      const position = payload.slice(offset, offset + 3)
      const centerW = position.reduce((sum, value, column) => sum + value * geometry.matrix[column * 4 + 3], geometry.matrix[15])
      if (centerW <= 0) { objects.push({ position, behind: true, visiblePixels: 0 }); continue }
      const projected = []
      for (const x of [-0.6, 0.6]) for (const y of [-0.6, 0.6]) for (const z of [-0.6, 0.6]) {
        const point = [payload[offset] + x * payload[offset + 3], payload[offset + 1] + y * payload[offset + 3], payload[offset + 2] + z * payload[offset + 3], 1]
        const clip = [0, 1, 3].map(row => point.reduce((sum, value, column) => sum + value * geometry.matrix[column * 4 + row], 0))
        if (clip[2] > 0.2) projected.push([(clip[0] / clip[2] * 0.5 + 0.5) * width, (0.5 - clip[1] / clip[2] * 0.5) * height])
      }
      const bounds = { xMin: Math.floor(Math.min(...projected.map(p => p[0]))), xMax: Math.ceil(Math.max(...projected.map(p => p[0]))), yMin: Math.floor(Math.min(...projected.map(p => p[1]))), yMax: Math.ceil(Math.max(...projected.map(p => p[1]))) }
      const cropped = bounds.xMin < 0 || bounds.yMin < 0 || bounds.xMax >= width || bounds.yMax >= height
      let visiblePixels = 0
      for (let y = Math.max(0, bounds.yMin); y <= Math.min(height - 1, bounds.yMax); y++) for (let x = Math.max(0, bounds.xMin); x <= Math.min(width - 1, bounds.xMax); x++) {
        const pixel = (y * width + x) * 3
        if (Math.max(data[pixel], data[pixel + 1], data[pixel + 2]) > 60) visiblePixels++
      }
      objects.push({ ...bounds, position, behind: false, cropped, visiblePixels })
    }
    assert.equal(objects.length, 15)
    assert(objects.filter(object => object.behind).length >= 3, 'Missing the rear half of the field')
    assert(objects.filter(object => object.visiblePixels > 20).length >= 3, `${label}: missing visible forward cubes`)
    for (const axis of [0, 1, 2]) assert(objects.some(object => object.position[axis] < 0) && objects.some(object => object.position[axis] > 0), 'Camera is not surrounded on all axes')
    await waitFrames()
    const still = await canvas.screenshot()
    const stillPixels = await sharp(still).removeAlpha().raw().toBuffer()
    if (!data.equals(stillPixels)) {
      await writeFile(path.join(output, `static-comparison-${label}.png`), still)
      let changedChannels = 0, maxDifference = 0
      for (let i = 0; i < data.length; i++) { const difference = Math.abs(data[i] - stillPixels[i]); if (difference) changedChannels++; maxDifference = Math.max(maxDifference, difference) }
      throw new Error(`${label}: static pixels changed: ${changedChannels} channels, max difference ${maxDifference}`)
    }
    const after = await page.evaluate(() => window.__blockshiftGpuProbe())
    const current = after.findLast(record => record.connected && record.productionCanvas)
    const prior = before.findLast(record => record.connected && record.productionCanvas)
    assert(current && prior, 'Missing production GL context')
    assert.deepEqual(current.errors, [], 'WebGL errors')
    assert.deepEqual(current.draws.slice(-4), [[36, 14], [132, 14], [5226, 1], [16758, 1]])
    assert.equal(current.methods.createBuffer, prior.methods.createBuffer, 'Per-frame buffer allocation')
    captures.push({ label, width, height, filename, objects, edgeComponents: blocks, staticPixelsIdentical: true, gpu: current })
  }
  if (controlsMode) { await page.setViewportSize({ width: 960, height: 540 }); await waitFrames() }
  const controls = controlsMode ? await runBlockshiftManualAcceptance(page, canvas, output, waitFrames) : null
  let sizing = null
  if (sizingMode || spreadMode) {
    await page.setViewportSize({ width: 1200, height: 1000 })
    await page.getByRole('tablist', { name: 'React right workspace panels' }).getByRole('tab', { name: 'DESIGN' }).evaluate(element => element.click())
    const setNumber = async (name, value) => {
      await page.locator(`[data-cinema2-control-id="blockshift-${name}"] input[type="range"]`).evaluate((element, next) => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, String(next))
        element.dispatchEvent(new Event('input', { bubbles: true })); element.dispatchEvent(new Event('change', { bubbles: true }))
      }, value)
      await waitFrames()
    }
    await setNumber('spread', 1.65); await setNumber('depth', 0.47)
    const sizes = []
    for (const value of spreadMode ? [1.8] : [1.05, 1.35, 1.8]) {
      await setNumber('block-size', value)
      await canvas.screenshot({ path: path.join(output, `size-${value}.png`) })
      const actual = await page.evaluate(() => window.__blockshiftGpuProbe().findLast(record => record.connected && record.productionCanvas))
      for (const payload of Object.values(actual.instances)) for (let i = 3; i < payload.length; i += 12) assert(Math.abs(payload[i] - value * 6) < 1e-5)
      sizes.push({ inspector: value, physicalModelSize: value * 6 })
    }
    const spreadProof = []
    if (spreadMode) {
      let previousExtent = 0, previousPixels = null
      for (const spread of [0.5, 1, 1.8, 3]) {
        await setNumber('spread', spread)
        const png = await canvas.screenshot({ path: path.join(output, `spread-${spread}.png`) })
        const pixels = await sharp(png).removeAlpha().raw().toBuffer()
        const actual = await page.evaluate(() => window.__blockshiftGpuProbe().findLast(record => record.connected && record.productionCanvas))
        const radii = []
        for (const payload of Object.values(actual.instances)) for (let i = 0; i < payload.length; i += 12) {
          assert(Math.abs(payload[i + 3] - 10.8) < 1e-5, 'Spread changed block size')
          radii.push(Math.hypot(...payload.slice(i, i + 3)))
        }
        const extent = Math.max(...radii)
        assert(extent > previousExtent, 'Spread did not increase the actual GPU formation spacing')
        let changedPixels = 0
        if (previousPixels) {
          for (let i = 0; i < pixels.length; i += 3) if ([0, 1, 2].some(c => Math.abs(pixels[i + c] - previousPixels[i + c]) > 2)) changedPixels++
          assert(changedPixels > 100, 'Spread has no visible canvas effect')
        }
        spreadProof.push({ spread, extent, changedPixels })
        previousExtent = extent; previousPixels = pixels
      }
      if (immersiveMode) {
        await setNumber('block-size', 3)
        await canvas.screenshot({ path: path.join(output, 'maximum-size-and-spread.png') })
        await setNumber('block-size', 1.8)
      }
      await setNumber('spread', 1.65)
    }
    sizing = { spreadProof, sizes, spread: 1.65, depth: 0.47, savedSizePreserved: true }
  }
  if (performanceMode) {
    await page.getByRole('tablist', { name: 'React right workspace panels' }).getByRole('tab', { name: 'DESIGN' }).evaluate(el => el.click())
    assert.equal(await page.locator('[data-cinema2-control-id="blockshift-auto-performance"]').getByRole('switch').getAttribute('aria-checked'), 'false')
  }
  const cameraControls = refinementMode || ledMode || polishMode || performanceMode || orbitMode || motionMode || audioMode ? await blockshiftCameraInspector(page, canvas, output, waitFrames) : null
  if (orbitMode) await page.locator('[data-cinema2-control-id="blockshift-orbit-camera"]').scrollIntoViewIfNeeded()
  if (refinementMode) {
    const rotate = page.locator('[data-cinema2-control-id="blockshift-rotate-cubes"]').getByRole('switch')
    assert.equal(await rotate.getAttribute('aria-checked'), 'false')
    await rotate.evaluate(el => el.click())
    assert.equal(await page.locator('[data-cinema2-control-id="blockshift-block-size"] input[type="range"]').getAttribute('max'), '6')
  }
  const beforeExit = await page.evaluate(() => window.__blockshiftGpuProbe())
  const liveGpu = records => Object.fromEntries(['Buffer', 'VertexArray', 'Program', 'Shader', 'Texture', 'Framebuffer', 'Renderbuffer'].map(kind => [kind, records.reduce((sum, record) => sum + (record.methods[`create${kind}`] ?? 0) - (record.methods[`delete${kind}`] ?? 0), 0)]))
  await style.evaluate(element => element.remove())
  await page.setViewportSize({ width: 1600, height: 1000 })
  if (refinementMode) await page.locator('[data-cinema2-control-id="blockshift-rotate-cubes"]').scrollIntoViewIfNeeded()
  if (refinementMode || ledMode || polishMode || performanceMode || orbitMode || audioMode || motionMode || controlsMode || sizingMode || spreadMode) await page.screenshot({ path: path.join(output, 'production-inspector.png') })
  let lifecycle, reenteredGpu
  for (let switchIndex = 0; switchIndex < (polishMode ? 3 : 1); switchIndex++) {
    await page.getByRole('tablist', { name: 'React right workspace panels' }).getByRole('tab', { name: 'PRESETS' }).click()
    await page.locator('[data-cinema2-preset-id="drmvyz.cinema2.reactor"]').click()
    await preset.click()
    await page.waitForFunction(() => document.querySelector('[data-cinema2-stage="runtime"]')?.getAttribute('data-runtime-phase') === 'running')
    await waitFrames()
    await waitForModels()
    lifecycle = await page.evaluate(() => window.__blockshiftGpuProbe())
    for (const retired of lifecycle.filter(record => !record.connected && record.draws.some(draw => draw[0] === 16758 && draw[1] === 1))) {
      for (const kind of ['Buffer', 'VertexArray', 'Program', 'Shader', 'Texture', 'Framebuffer', 'Renderbuffer']) assert.equal(retired.methods[`create${kind}`], retired.methods[`delete${kind}`], `Leaked ${kind} after preset exit`)
    }
    const currentGpu = liveGpu(lifecycle), priorGpu = liveGpu(beforeExit)
    for (const kind of Object.keys(priorGpu)) assert(currentGpu[kind] <= priorGpu[kind], `Outstanding ${kind} grew after preset re-entry`)
    // A warm bloom chain can retire while zero remains authored. Subsequent identical re-entries must stabilize.
    if (reenteredGpu) assert.deepEqual(currentGpu, reenteredGpu, 'GPU objects accumulated across repeated preset switches')
    reenteredGpu = currentGpu
  }
  if (controlsMode) await verifyBlockshiftPersistence(page)
  if (refinementMode || ledMode || polishMode || performanceMode || orbitMode || motionMode || audioMode) await verifyBlockshiftCameraPersistence(page)
  if (refinementMode) assert.equal(await page.locator('[data-cinema2-control-id="blockshift-rotate-cubes"]').getByRole('switch').getAttribute('aria-checked'), 'true')
  if (sizingMode || spreadMode) {
    await page.getByRole('tablist', { name: 'React right workspace panels' }).getByRole('tab', { name: 'DESIGN' }).click()
    assert.equal(await page.locator('[data-cinema2-control-id="blockshift-block-size"] input[type="range"]').inputValue(), '1.8')
    if (spreadMode) assert.equal(await page.locator('[data-cinema2-control-id="blockshift-spread"] input[type="range"]').inputValue(), '1.65')
  }
  const neighbors = acceptanceMode ? await runBlockshiftNeighborAcceptance(page, output) : null
  if (refinementMode || ledMode || polishMode) await page.close() // Isolate the profiling canvas from another workspace RAF.
  console.log('Workspace controls, persistence and lifecycle checks passed; running focused canvas matrices')
  const matrix = async (file, source, run) => {
    if (acceptanceMode && process.argv.includes('--resume-p8')) {
      const [reportTime, sourceTime, buildTime] = await Promise.all([stat(path.join(output, file)).catch(() => null), stat(path.join(root, 'scripts', source)), stat(path.join(output, 'bundle/src/test/browser/cinema2-blockshift-production.html'))])
      if (reportTime && reportTime.mtimeMs >= Math.max(sourceTime.mtimeMs, buildTime.mtimeMs)) {
        console.log(`Reusing passed matrix from this build: ${file}`)
        return JSON.parse(await readFile(path.join(output, file), 'utf8'))
      }
    }
    const result = await run(); console.log(`P8 matrix passed: ${file}`); return result
  }
  const refinement = refinementMode ? await matrix('refinement-acceptance.json', 'cinema2-blockshift-refinement.mjs', () => runBlockshiftRefinementAcceptance(browser, output)) : null
  const leds = ledMode ? await matrix('led-acceptance.json', 'cinema2-blockshift-leds.mjs', () => runBlockshiftLedAcceptance(browser, output)) : null
  const polish = polishMode ? await matrix('polish-acceptance.json', 'cinema2-blockshift-polish.mjs', () => runBlockshiftPolishAcceptance(browser, output, { withAtmosphere: acceptanceMode })) : null
  const performance = performanceMode ? await matrix('performance-acceptance.json', 'cinema2-blockshift-performance.mjs', () => runBlockshiftPerformanceAcceptance(browser, output)) : null
  const orbit = orbitMode ? await matrix('orbit-acceptance.json', 'cinema2-blockshift-orbit.mjs', () => runBlockshiftOrbitAcceptance(browser, output)) : null
  const audio = audioMode ? await matrix('audio-acceptance.json', 'cinema2-blockshift-audio.mjs', () => runBlockshiftAudioAcceptance(browser, output)) : null
  const motion = motionMode ? await matrix('motion-acceptance.json', 'cinema2-blockshift-motion.mjs', () => runBlockshiftMotionAcceptance(browser, output)) : null
  const timing = controlsMode || immersiveMode ? await matrix('timing-acceptance.json', 'cinema2-blockshift-controls.mjs', () => runBlockshiftTimingAcceptance(browser, output)) : null
  const acceptance = acceptanceMode ? await matrix('phase8-acceptance.json', 'cinema2-blockshift-acceptance.mjs', () => runBlockshiftFinalAcceptance(browser, output)) : null
  assert.deepEqual(errors, [], 'Production page errors')
  assert(modelResponses.some(response => response.url.includes('hallow') && response.status === 200), 'Hallow Cube was not fetched successfully')
  assert(modelResponses.some(response => response.url.includes('impossible') && response.status === 200), 'Impossible Cube was not fetched successfully')
  const report = { modelResponses, models: { outer: 'Hallow Cube ×14', center: 'Impossible Cube ×1', batches: 4 }, sizing, phase: acceptanceMode ? 'P8 production browser and regression acceptance; human review pending' : refinementMode ? 'Larger cubes, Threshold-style atmosphere and varied cube rotation' : ledMode ? 'User-directed LED bar surfaces and shared geometry/audio choreography' : polishMode ? 'P7 bloom, camera framing and performance/lifecycle hardening' : performanceMode ? 'P6 Director gain and transient Auto Performance' : orbitMode ? 'Additive orbit camera' : expandedMode ? 'Fifteen-object surrounding field' : audioMode ? 'P5 shared audio reactions and canonical trigger behavior' : motionMode ? 'P4 patterns, transitions and basic floating camera' : immersiveMode ? 'Viewer-centered immersive cube field' : spreadMode ? 'Spread surface-gap correction' : sizingMode ? 'Threefold object scale and compact spacing' : modelsMode ? 'GLB geometry replacement' : controlsMode ? 'P3 manual controls and clock foundation' : 'P2 static only', catalog: 'normal first-party catalog, reference preview', controls, cameraControls, neighbors, acceptance, refinement, leds, polish, performance, orbit, motion, timing, presetId: 'drmvyz.cinema2.blockshift', app: 'VyzualzView / AudioEngineProvider / real preset chooser', qualityMode: 'quality workspace default; per-mode profiling is recorded separately', effects: ['volumetric-atmosphere', 'hdr-bloom'], audio: audio ?? 'no source', motionCapture: acceptanceMode ? 'phase8-pattern-transport.webm' : motionMode ? 'phase4-motion.webm' : 'static', browser: await browser.version(), platform: process.platform, architecture: process.arch, rendering: hardwareMode ? 'headless Chromium ANGLE Metal; renderer verified in focused capture' : 'headless Chromium ANGLE SwiftShader; no hardware performance claim', captures, lifecycle, errors, result: 'PASS' }
  await writeFile(path.join(output, 'acceptance.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(`BLOCKSHIFT production acceptance PASS: ${output}`)
  }
} finally {
  await browser?.close()
  await new Promise(resolve => server.httpServer.close(resolve))
}

// Manual controls, camera and motion on the real production path. No audio-energy choreography.
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import sharp from 'sharp'

const root = resolve(import.meta.dirname, '../..'), out = resolve(root, 'artifacts/cinema2-nightshift-step2')
await mkdir(out, { recursive: true })
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0 }, clearScreen: false })
let browser
const checks = [], captures = []
const assert = (value, message) => { if (!value) throw new Error(message); checks.push(message) }
try {
  await server.listen()
  const address = server.httpServer.address()
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', msg => { if (msg.type() === 'error' && /shader|WebGL|THREE/.test(msg.text())) errors.push(msg.text()) })
  const url = `http://127.0.0.1:${address.port}/src/test/browser/cinema2-nightshift-production.html?step2=1`
  const set = values => page.evaluate(v => globalThis.__nightshiftProduction.set(v), values)
  const reset = () => page.evaluate(() => globalThis.__nightshiftProduction.reset())
  const advance = (seconds, bpm = 120, paused = false) => page.evaluate(v => globalThis.__nightshiftProduction.advance(...v), [seconds, bpm, paused])
  const shot = async name => {
    const bytes = await page.locator('canvas').screenshot({ path: resolve(out, `${name}.png`) })
    const raw = await sharp(bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    captures.push({ name, sha256: createHash('sha256').update(bytes).digest('hex') })
    return raw
  }
  const diff = (a, b, region = [0, 0, 1, 1]) => {
    let sum = 0, count = 0
    const [x0, y0, x1, y1] = region
    for (let y = Math.floor(y0 * a.info.height); y < y1 * a.info.height; y++) for (let x = Math.floor(x0 * a.info.width); x < x1 * a.info.width; x++) {
      const index = (y * a.info.width + x) * a.info.channels
      for (let c = 0; c < 3; c++) { sum += Math.abs(a.data[index + c] - b.data[index + c]); count++ }
    }
    return sum / count
  }
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => Boolean(globalThis.__nightshiftProduction), undefined, { timeout: 30000 })
  const prepared = await page.evaluate(() => globalThis.__nightshiftProduction.prepare())
  assert(prepared.snapshot.phase === 'running' && prepared.modules.failedModuleCount === 0 && prepared.modules.degradedModuleCount === 0, 'Native runtime and scene prepare without diagnostics')
  const P = await page.evaluate(() => globalThis.__nightshiftProduction.ids)

  // Camera first: default, midpoint and maximum, bounded by the authored safety.
  await set({ [P.motion]: 0 })
  const reference = await shot('camera-off')
  for (const amount of [.5, 1]) {
    await set({ [P.camera]: amount }); const state = await advance(5)
    const moved = await shot(`camera-${amount}`)
    assert(diff(reference, moved) > .15, `Camera Motion ${amount} visibly changes perspective`)
    assert(state.camera.position[1] >= 3 && state.camera.position[1] <= 3.2 && state.camera.rollDegrees === 0, `Camera Motion ${amount} respects safe bounds and zero roll`)
  }
  await set({ [P.camera]: 0 }); await advance(1)
  const restored = await shot('camera-restored')
  assert(diff(reference, restored) < .05, 'Camera Motion OFF restores reference framing')
  console.log('NIGHTSHIFT camera checks passed.')

  // Real Inspector hierarchy and click path for BPM Sync and Pattern Change.
  await page.evaluate(() => globalThis.__nightshiftProduction.showInspector(true))
  // Collapsibles default open; assert actual DOM ownership, not manifest labels alone.
  const selector = key => `[data-cinema2-control-id="${P[key]}"]`
  assert(await page.locator(`[data-cinema2-parent-group="master-controls"] ${selector('bpmSync')}`).count() === 1, 'BPM Sync appears under Master Controls')
  assert(await page.locator('[data-cinema2-parent-group="palette"] [data-cinema2-control-type="color"]').count() === 6, 'Six independent Palette controls appear in the production Inspector')
  assert(await page.locator(selector('trigger')).count() === 0, 'Trigger is hidden while Pattern Change is OFF')
  await page.locator(selector('patternChange')).getByRole('switch').click()
  assert(await page.locator(`[data-cinema2-parent-group="design"] ${selector('trigger')}`).count() === 1, 'Pattern Change click reveals Trigger under Design')
  await page.locator(selector('bpmSync')).getByRole('switch').click()
  assert((await page.evaluate(() => globalThis.__nightshiftProduction.status())).parameters.persistentValues[P.bpmSync] === false, 'BPM Sync is editable through the real Inspector')
  const status = await page.evaluate(() => globalThis.__nightshiftProduction.status())
  const trigger = status.groups.flatMap(g => [...g.controls, ...g.groups.flatMap(s => s.controls)]).find(c => c.definition.id === P.trigger)
  assert(trigger.definition.options.length === 11 && trigger.definition.options.map(o => o.value).join(',') === 'beat,kick,snare,downbeat,beat2,beat4,bar,bar4,bar8,phrase,drop', 'Trigger uses exactly the eleven canonical options')
  await page.evaluate(() => globalThis.__nightshiftProduction.showInspector(false))
  await reset(); await set({ [P.motion]: 0 })

  // Every authored pattern has a real, distinct rendered program at rest.
  const patterns = ['nightshift', 'crossfade-checker', 'runway', 'diamond-ripple', 'diagonal-relay', 'quadrant-exchange', 'midnight-sparse', 'full-house']
  const patternFrames = []
  for (const pattern of patterns) {
    await set({ [P.pattern]: pattern })
    patternFrames.push(await shot(`pattern-${pattern}`))
  }
  for (let i = 0; i < patterns.length; i++) for (let j = i + 1; j < patterns.length; j++) assert(diff(patternFrames[i], patternFrames[j], [.1, .62, .9, .97]) > .5, `${patterns[i]} differs visibly from ${patterns[j]}`)
  await reset(); await set({ [P.motion]: 0 })
  const baseline = await shot('manual-default')
  const roles = { backgroundColor: [.1, .45, .9, .56], cyanColor: [.2, 0, .38, .2], magentaColor: [.1, .62, .9, .97], blueColor: [.1, .62, .9, .97], amberColor: [.1, .62, .9, .97], ballColor: [.39, .03, .61, .4] }
  for (const [key, region] of Object.entries(roles)) {
    await set({ [P[key]]: [0.05, 1, .12, 1] })
    const colored = await shot(`palette-${key}`)
    assert(diff(baseline, colored, region) > 1, `${key} independently changes its documented region`)
    const values = (await page.evaluate(() => globalThis.__nightshiftProduction.status())).parameters.persistentValues
    for (const other of Object.keys(roles).filter(k => k !== key)) assert(JSON.stringify(values[P[other]]) === JSON.stringify(status.parameters.persistentValues[P[other]]), `${key} preserves authored ${other}`)
    await reset(); await set({ [P.motion]: 0 })
  }
  for (const key of ['master', 'floor', 'ball', 'ceiling', 'coverage']) {
    for (const value of [0, 1]) {
      await set({ [P[key]]: value })
      const frame = await shot(`${key}-${value}`)
      assert(diff(baseline, frame) > .1, `${key} at ${value} visibly differs from default`)
    }
    await reset(); await set({ [P.motion]: 0 })
  }
  console.log('NIGHTSHIFT manual control checks passed.')

  // Motion and host tempo: fresh runtime per case, no local beat/analysis fixture.
  const motionCase = async (name, sync, hostBpm, amount, rotation = true, paused = false) => {
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => Boolean(globalThis.__nightshiftProduction))
    await page.evaluate(() => globalThis.__nightshiftProduction.prepare())
    await set({ [P.bpmSync]: sync, [P.motion]: amount, [P.rotation]: rotation })
    const a = await shot(`${name}-start`)
    const state = await advance(4, hostBpm, paused)
    const b = await shot(`${name}-end`)
    return { state, frame: b, movement: diff(a, b), ballMovement: diff(a, b, [.39, .03, .61, .4]) }
  }
  const held = await motionCase('motion-zero', true, 180, 0)
  assert(held.movement < .05, 'Motion Amount zero holds the rendered installation')
  const normal = await motionCase('motion-default-sync', true, 180, .35)
  assert(normal.ballMovement > .5, 'Default ball rotation changes the rendered hero')
  const max = await motionCase('motion-max', true, 180, 1)
  assert(diff(normal.frame, max.frame) > .5, 'Maximum Motion Amount produces visibly different travel')
  const unsynced = await motionCase('motion-unsynced-180', false, 180, .35)
  assert(diff(normal.frame, unsynced.frame) > .5, 'BPM Sync ON and OFF produce visibly different timing')
  const unsyncedOther = await motionCase('motion-unsynced-90', false, 90, .35)
  assert(diff(unsynced.frame, unsyncedOther.frame) < .05, 'Sync OFF ignores host BPM and uses its authored rate')
  const frozen = await motionCase('rotation-disabled', true, 180, .35, false)
  assert(frozen.ballMovement < .05, 'Ball Rotation OFF holds the hero while floor programs continue')
  const pause = await motionCase('motion-paused', true, 180, .35, true, true)
  assert(pause.movement < .05, 'Paused transport freezes procedural motion')

  await reset(); await set({ [P.motion]: 0 })
  await page.setViewportSize({ width: 720, height: 720 })
  const resized = await page.evaluate(() => globalThis.__nightshiftProduction.resize())
  await shot('square')
  assert(resized.snapshot.phase === 'running' && resized.modules.failedModuleCount === 0, 'Square resize preserves a working native runtime')
  assert(errors.length === 0, 'No browser, WebGL or shader errors')
  await writeFile(resolve(out, 'report.json'), JSON.stringify({ phase: 'Step 2', checks, captures, prepared, motionPerformance: normal.state.snapshot.performance, resized, errors }, null, 2) + '\n')
  console.log(JSON.stringify({ output: out, checks: checks.length, performance: normal.state.snapshot.performance }))
} finally {
  await browser?.close()
  await server.close()
}

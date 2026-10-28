import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import sharp from 'sharp'
const root = resolve(import.meta.dirname, '../..'), out = resolve(root, 'artifacts/cinema2-nightshift-pan-room')
await mkdir(out, { recursive: true })
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0 }, clearScreen: false })
const checks = [], errors = [], cameras = []
const assert = (ok, message) => { if (!ok) throw new Error(message); checks.push(message) }
let browser
try {
  await server.listen()
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } })
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error' && /shader|WebGL|THREE/.test(m.text())) errors.push(m.text()) })
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/src/test/browser/cinema2-nightshift-production.html?step3=1`)
  await page.waitForFunction(() => Boolean(globalThis.__nightshiftProduction))
  await page.evaluate(() => globalThis.__nightshiftProduction.prepare())
  const P = await page.evaluate(() => globalThis.__nightshiftProduction.ids)
  const set = v => page.evaluate(v => globalThis.__nightshiftProduction.set(v), v)
  const advance = (s, paused = false) => page.evaluate(v => globalThis.__nightshiftProduction.advance(v.s, 120, v.paused), { s, paused })
  const status = () => page.evaluate(() => globalThis.__nightshiftProduction.status())
  const shot = async name => {
    const bytes = await page.locator('canvas').screenshot({ path: resolve(out, `${name}.png`) })
    return (await sharp(bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true })).data
  }
  const difference = (a, b) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0) / a.length
  await set({ [P.signs]: true, [P.camera]: 0, [P.motion]: 0, [P.rotation]: false, [P.musicResponse]: 0 })
  await page.evaluate(() => globalThis.__nightshiftProduction.showInspector(true))
  for (const [key, text] of Object.entries({ signText: 'BACK ROOM', signTextLeft: 'LEFT ROOM', signTextFront: 'FRONT ROOM', signTextRight: 'RIGHT ROOM' })) {
    const input = page.locator(`[data-cinema2-control-id="${P[key]}"]`).getByRole('textbox')
    assert(await input.isEnabled(), `${key} is editable in Signs`)
    await input.fill(text); await input.blur()
  }
  await page.locator(`[data-cinema2-control-id="${P.panRoom}"]`).getByRole('switch').click()
  await page.evaluate(() => globalThis.__nightshiftProduction.showInspector(false))
  for (const [i, name] of ['back', 'left', 'front', 'right'].entries()) {
    if (i) await advance(8)
    const state = await status(); cameras.push(state.camera)
    const on = await shot(name)
    await set({ [P.signs]: false }); const off = await shot(`${name}-off`)
    assert(difference(on, off) > .1, `${name} wall text is visibly present`)
    await set({ [P.signs]: true })
  }
  const before = (await status()).camera
  await advance(2, true)
  assert(JSON.stringify((await status()).camera.position) === JSON.stringify(before.position), 'Pause holds room pan')
  await set({ [P.panRoom]: false })
  assert((await status()).camera.position[2] === 14.5, 'Pan OFF restores the reference shot')
  const saved = (await status()).parameters.persistentValues
  await page.evaluate(() => globalThis.__nightshiftProduction.reenter({ preserve: true }))
  const restored = (await status()).parameters.persistentValues
  assert(['signText', 'signTextLeft', 'signTextFront', 'signTextRight', 'panRoom'].every(k => saved[P[k]] === restored[P[k]]), 'All wall messages and pan setting survive preset re-entry')
  const state = await status()
  assert(!state.modules.failedModuleCount && !state.effects.failedEffectCount && !state.render.failedPassCount && !state.frameFaults.length && !errors.length, 'No browser, shader or render failures')
  await writeFile(resolve(out, 'report.json'), JSON.stringify({ checks, cameras, errors }, null, 2))
  console.log(JSON.stringify({ checks, errors }, null, 2))
} finally { await browser?.close(); await server.close() }

#!/usr/bin/env node
/**
 * CANOPY production acceptance: drives the real Cinema2Runtime (registry, native module, effects, Audio Feature Bus) in headless Chrome and checks
 * what the plan's case matrix (docs/DRMVYZ_Cinema2_CANOPY_Implementation_Plan/07) asks for, from the solved rod state and from the pixels.
 *
 *   node scripts/cinema2-assets/accept-canopy-production.mjs [--only=<section>[,<section>]]
 *
 * Writes captures, contact sheets and manifest.json under artifacts/cinema2-canopy-acceptance/run-*. Exits non-zero if any check fails.
 * Human review of the contact sheets is still required: nothing here judges taste.
 */
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { chromium } from '@playwright/test'
import sharp from 'sharp'
import { createServer } from 'vite'

const root = resolve(import.meta.dirname, '../..')
const chrome = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
if (!existsSync(chrome)) throw new Error('A Chromium executable is required. Set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH.')
const only = (process.argv.find(arg => arg.startsWith('--only='))?.slice(7) ?? '').split(',').filter(Boolean)
const wanted = name => only.length === 0 || only.includes(name)

const P = name => `canopy-${name}`
const PATTERNS = ['waterfall', 'crosswave', 'crown', 'splitWings', 'checkerLift', 'downpour']
const results = []
const failures = []

function check(section, name, ok, detail = '') {
  results.push({ section, name, ok: Boolean(ok), detail })
  if (!ok) failures.push(`${section}: ${name}${detail ? ` (${detail})` : ''}`)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${section} · ${name}${detail ? `  ${detail}` : ''}`)
}

// ---- pixels ---------------------------------------------------------------------------------------------------------------------------
async function decode(png) {
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height, channels: info.channels }
}
const luma = (d, i) => 0.2126 * d.data[i] + 0.7152 * d.data[i + 1] + 0.0722 * d.data[i + 2]
function diffFraction(a, b, threshold = 10) {
  let changed = 0
  const n = a.width * a.height
  for (let p = 0; p < n; p += 1) {
    const i = p * a.channels
    if (Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]) > threshold) changed += 1
  }
  return changed / n
}
function totalLuma(d) { let sum = 0; for (let p = 0; p < d.width * d.height; p += 1) sum += luma(d, p * d.channels); return sum / (d.width * d.height) }
function count(d, predicate) { let c = 0; for (let p = 0; p < d.width * d.height; p += 1) { const i = p * d.channels; if (predicate(d.data[i], d.data[i + 1], d.data[i + 2])) c += 1 } return c }
function litBounds(d, floor = 28) {
  let minX = d.width, minY = d.height, maxX = -1, maxY = -1
  for (let y = 0; y < d.height; y += 1) for (let x = 0; x < d.width; x += 1) {
    if (luma(d, (y * d.width + x) * d.channels) > floor) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y }
  }
  return { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 }
}
const pixel = (d, x, y) => { const i = (y * d.width + x) * d.channels; return [d.data[i], d.data[i + 1], d.data[i + 2]] }
// Colour classes by chromaticity, so they hold at any brightness (a resting rod and a hit one are different brightnesses of the same colour).
const isCyan = (r, g, b) => g > 40 && b > 40 && r < 0.55 * g && Math.abs(g - b) < 0.35 * Math.max(g, b)
const isViolet = (r, g, b) => b > 50 && r > 0.35 * b && r < 0.8 * b && g < 0.6 * b
const isRed = (r, g, b) => r > 40 && g < 0.35 * r && b < 0.35 * r
const isGreen = (r, g, b) => g > 40 && r < 0.4 * g && b < 0.4 * g
const isYellow = (r, g, b) => r > 60 && g > 50 && Math.abs(r - g) < 0.35 * Math.max(r, g) && b < 0.5 * Math.min(r, g)
const isMagentaDark = (r, g, b) => r > 20 && b > 20 && g < 0.45 * Math.min(r, b)
const mean = xs => xs.reduce((s, v) => s + v, 0) / Math.max(1, xs.length)
const spread = xs => Math.max(...xs) - Math.min(...xs)
const maxAbsDiff = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])))
const meanAbsDiff = (a, b) => mean(a.map((v, i) => Math.abs(v - b[i])))

// ---- sessions ----------------------------------------------------------------------------------------------------------------------------
let browser
let baseUrl
let output
async function session(entry = {}) {
  const page = await browser.newPage({ viewport: { width: entry.width ?? 1920, height: entry.height ?? 1080 }, deviceScaleFactor: 1 })
  const errors = []
  page.setDefaultTimeout(120_000)
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) errors.push(message.text()) })
  const url = new URL(baseUrl)
  url.searchParams.set('quality', entry.quality ?? 'high')
  url.searchParams.set('timeSec', String(entry.timeSec ?? 0.2))
  url.searchParams.set('scenario', entry.scenario ?? 'none')
  if (entry.bpm) url.searchParams.set('bpm', String(entry.bpm))
  if (entry.dropAt) url.searchParams.set('dropAt', String(entry.dropAt))
  if (entry.params) url.searchParams.set('params', JSON.stringify(entry.params))
  for (let attempt = 0; ; attempt += 1) {
    try {
      await page.goto(url.href, { waitUntil: 'domcontentloaded' })
      await page.waitForFunction(() => Boolean(globalThis.__canopyProduction), undefined, { timeout: 60_000 })
      await page.evaluate(() => globalThis.__canopyProduction.prepare())
      break
    } catch (error) {
      if (attempt >= 4 || !/context was destroyed|navigation/i.test(String(error))) throw error
      errors.length = 0
    }
  }
  const api = {
    errors,
    page,
    async advance(timeSec) { await page.evaluate(t => globalThis.__canopyProduction.advanceTo(t), timeSec) },
    async params(values) { await page.evaluate(v => globalThis.__canopyProduction.setParameters(v), values) },
    async transport(patch) { await page.evaluate(p => globalThis.__canopyProduction.setTransport(p), patch) },
    async frames(count) { await page.evaluate(n => globalThis.__canopyProduction.advanceBy(n / 60), count) },
    probe: () => page.evaluate(() => globalThis.__canopyProduction.probe()),
    status: () => page.evaluate(() => globalThis.__canopyProduction.status()),
    async shot(name) {
      const png = await page.locator('#canopy-production').screenshot({ timeout: 120_000 })
      const file = `${name}.png`
      await writeFile(join(output, file), png)
      return { name, file, png, probe: await api.probe(), pixels: await decode(png) }
    },
    async close() { await page.close() },
  }
  return api
}
async function capture(name, entry = {}, steps) {
  const s = await session(entry)
  try {
    if (steps) await steps(s)
    const shot = await s.shot(name)
    const status = await s.status()
    healthy(name, status, s.errors)
    return { ...shot, status }
  } finally { await s.close() }
}
function healthy(label, status, errors = []) {
  const ok = status.snapshot.phase === 'running' && status.modules.failedModuleCount === 0 && status.effects.failedEffectCount === 0 && errors.length === 0
  if (!ok) { results.push({ section: 'health', name: label, ok: false, detail: JSON.stringify({ phase: status.snapshot.phase, errors }) }); failures.push(`health: ${label} ${errors[0] ?? status.snapshot.phase}`) }
  return ok
}
async function sheet(name, tiles, columns = 4, width = 480) {
  const height = Math.round(width * 9 / 16)
  const rows = Math.ceil(tiles.length / columns)
  const composites = []
  for (let i = 0; i < tiles.length; i += 1) {
    const tile = await sharp(tiles[i].png).resize(width, height).toBuffer()
    const label = Buffer.from(`<svg width="${width}" height="26"><rect width="${width}" height="26" fill="#000" fill-opacity="0.65"/><text x="8" y="18" font-family="Helvetica,Arial,sans-serif" font-size="14" fill="#cfe">${tiles[i].label.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`)
    const left = (i % columns) * width, top = Math.floor(i / columns) * height
    composites.push({ input: tile, left, top }, { input: label, left, top })
  }
  await sharp({ create: { width: width * columns, height: height * rows, channels: 3, background: '#020305' } }).composite(composites).png().toFile(join(output, `sheet-${name}.png`))
}

// ---- sections ----------------------------------------------------------------------------------------------------------------------------
async function heroAndAspects() {
  const shots = []
  for (const [name, width, height] of [['hero-16x9', 1920, 1080], ['hero-1x1', 1080, 1080], ['hero-9x16', 720, 1280], ['hero-4x3', 1280, 960]]) {
    const shot = await capture(name, { width, height })
    shots.push({ ...shot, label: `${name} ${width}x${height}` })
    const b = litBounds(shot.pixels)
    check('B01/B02', `${name}: the whole canopy is inside the frame with a margin`, b.minX >= 6 && b.minY >= 6 && b.maxX <= width - 7 && b.maxY <= height - 7, `lit box ${b.minX},${b.minY}–${b.maxX},${b.maxY} of ${width}x${height}`)
    check('B01', `${name}: the array is 64 rods and no light is a false hit`, shot.probe.hang.length === 64 && shot.probe.musicActive === false && shot.probe.emission.every(e => e < 0.4))
  }
  await sheet('hero', shots, 4, 480)
}

async function patterns() {
  const rest = []
  const moving = []
  for (const pattern of PATTERNS) {
    rest.push({ ...(await capture(`pattern-${pattern}-rest`, { params: { [P('pattern')]: pattern } })), label: `${pattern} · rest` })
    const s = await session({ scenario: 'steady', timeSec: 3.0, params: { [P('pattern')]: pattern, [P('motion-amount')]: 1 } })
    try {
      const frames = []
      for (const [index, t] of [3.0, 3.6, 4.2, 4.8].entries()) {
        await s.advance(t)
        frames.push(await s.shot(`pattern-${pattern}-motion-${index + 1}`))
      }
      moving.push({ ...frames[1], label: `${pattern} · t=3.6 (music)` })
      const hang = frames.map(f => f.probe.hang)
      check('M01', `${pattern}: rod positions change from frame to frame while playing`, [1, 2, 3].every(i => maxAbsDiff(hang[i], hang[i - 1]) > 0.02), `max steps ${[1, 2, 3].map(i => maxAbsDiff(hang[i], hang[i - 1]).toFixed(3)).join(', ')}`)
      check('M01', `${pattern}: the rendered pixels change with them`, [1, 2, 3].every(i => diffFraction(frames[i].pixels, frames[i - 1].pixels) > 0.004), [1, 2, 3].map(i => (diffFraction(frames[i].pixels, frames[i - 1].pixels) * 100).toFixed(2)).join('%, ') + '%')
      healthy(`pattern-${pattern}`, await s.status(), s.errors)
    } finally { await s.close() }
  }
  for (let a = 0; a < PATTERNS.length; a += 1) for (let b = a + 1; b < PATTERNS.length; b += 1) {
    const pixels = diffFraction(rest[a].pixels, rest[b].pixels)
    const rods = meanAbsDiff(rest[a].probe.hang, rest[b].probe.hang)
    check('C04', `${PATTERNS[a]} vs ${PATTERNS[b]} at rest: different pixels and different rod heights`, pixels > 0.02 && rods > 0.08, `${(pixels * 100).toFixed(1)}% of pixels, mean cap difference ${rods.toFixed(2)}`)
  }
  check('C04', 'the six moving frames are six different images', new Set(moving.map(m => m.png.toString('base64').length + ':' + m.png.subarray(2000, 2064).toString('hex'))).size === 6)
  await sheet('patterns-rest', rest, 3, 560)
  await sheet('patterns-music', moving, 3, 560)
}

async function controls() {
  const base = await capture('ctl-default', {})
  const cases = []
  const tile = (shot, label) => cases.push({ ...shot, label })
  const run = async (name, params, extra = {}) => { const shot = await capture(`ctl-${name}`, { params, ...extra }); tile(shot, name); return shot }

  const rows4 = await run('rows-4', { [P('rows')]: 4 }); const rows12 = await run('rows-12', { [P('rows')]: 12 })
  check('C01', 'Rows 4 / 12 give 32 and 96 rods and a different picture', rows4.probe.hang.length === 32 && rows12.probe.hang.length === 96 && diffFraction(rows4.pixels, rows12.pixels) > 0.03)
  const cols4 = await run('columns-4', { [P('columns')]: 4 }); const cols12 = await run('columns-12', { [P('columns')]: 12 })
  check('C01', 'Columns 4 / 12 give 32 and 96 rods and a clearly different width', cols4.probe.hang.length === 32 && cols12.probe.hang.length === 96 && litBounds(cols12.pixels).width > litBounds(cols4.pixels).width * 1.2, `${litBounds(cols4.pixels).width}px → ${litBounds(cols12.pixels).width}px`)
  const big = await run('grid-12x12-spacing-1.4', { [P('rows')]: 12, [P('columns')]: 12, [P('row-spacing')]: 1.4, [P('column-spacing')]: 1.4, [P('rod-length')]: 2.1 })
  const bb = litBounds(big.pixels)
  check('A', 'the largest array (144 rods, widest spacing, longest rods) stays inside the frame', big.probe.hang.length === 144 && bb.minX >= 4 && bb.minY >= 4 && bb.maxX <= 1915 && bb.maxY <= 1075, `box ${bb.minX},${bb.minY}–${bb.maxX},${bb.maxY}`)
  const rs1 = await run('row-spacing-0.75', { [P('row-spacing')]: 0.75 }); const rs2 = await run('row-spacing-1.4', { [P('row-spacing')]: 1.4 })
  check('C01', 'Row Spacing changes the depth of the canopy', diffFraction(rs1.pixels, rs2.pixels) > 0.03)
  const cs1 = await run('column-spacing-0.75', { [P('column-spacing')]: 0.75 }); const cs2 = await run('column-spacing-1.4', { [P('column-spacing')]: 1.4 })
  check('C01', 'Column Spacing changes the width of the canopy', litBounds(cs2.pixels).width > litBounds(cs1.pixels).width * 1.2)
  const rl1 = await run('rod-length-0.6', { [P('rod-length')]: 0.6, [P('length-variation')]: 0 }); const rl2 = await run('rod-length-2.1', { [P('rod-length')]: 2.1, [P('length-variation')]: 0 })
  const rodPixels = d => count(d, isCyan) + count(d, isViolet)
  check('C01', 'Rod Length changes the physical length of the rods (about 3.5 times the lit rod area, and a taller canopy)', rodPixels(rl2.pixels) > rodPixels(rl1.pixels) * 2.2 && litBounds(rl2.pixels).height > litBounds(rl1.pixels).height * 1.15, `rod pixels ${rodPixels(rl1.pixels)} → ${rodPixels(rl2.pixels)} · ${litBounds(rl1.pixels).height}px → ${litBounds(rl2.pixels).height}px tall`)
  const lv0 = await run('length-variation-0', { [P('length-variation')]: 0 }); const lv1 = await run('length-variation-0.65', { [P('length-variation')]: 0.65 })
  check('C01', 'Length Variation 0 gives equal rods and 0.65 gives different ones', diffFraction(lv0.pixels, lv1.pixels) > 0.02 && litBounds(lv1.pixels).height !== litBounds(lv0.pixels).height, `${(diffFraction(lv0.pixels, lv1.pixels) * 100).toFixed(1)}% of pixels differ`)
  const hr0 = await run('height-range-0', { [P('height-range')]: 0 }); const hr8 = await run('height-range-0.8', { [P('height-range')]: 0.8 })
  check('C01', 'Height Range 0 holds every cap at one height; 0.8 spreads them (travel, not brightness)', spread(hr0.probe.hang) < 1e-6 && spread(hr8.probe.hang) > 0.6 && meanAbsDiff(hr0.probe.emission, hr8.probe.emission) < 0.1, `spread ${spread(hr0.probe.hang).toFixed(3)} → ${spread(hr8.probe.hang).toFixed(3)}`)
  const sy1 = await run('symmetry-on', { [P('symmetry')]: true }); const sy0 = await run('symmetry-off', { [P('symmetry')]: false })
  check('C01', 'Symmetry off leans the formation', diffFraction(sy1.pixels, sy0.pixels) > 0.015)
  const ig0 = await run('idle-glow-0', { [P('idle-glow')]: 0 }); const ig6 = await run('idle-glow-0.6', { [P('idle-glow')]: 0.6 })
  check('C01', 'Idle Glow raises the light every rod keeps', totalLuma(ig6.pixels) > totalLuma(ig0.pixels) * 1.6, `${totalLuma(ig0.pixels).toFixed(2)} → ${totalLuma(ig6.pixels).toFixed(2)}`)
  const mi0 = await run('master-intensity-0', { [P('master-intensity')]: 0 }); const mi1 = await run('master-intensity-1', { [P('master-intensity')]: 1 })
  check('C01', 'Master Intensity 0 emits nothing (only the dark rods, caps and grid remain); 1 is brighter than the default', mi0.probe.emission.every(e => e === 0) && count(mi0.pixels, isCyan) + count(mi0.pixels, isViolet) < 150 && count(base.pixels, isCyan) + count(base.pixels, isViolet) > 5000 && totalLuma(mi1.pixels) > totalLuma(base.pixels) * 1.1, `rod-coloured pixels ${count(mi0.pixels, isCyan) + count(mi0.pixels, isViolet)} / ${count(base.pixels, isCyan) + count(base.pixels, isViolet)} · luma ${totalLuma(mi0.pixels).toFixed(2)} / ${totalLuma(base.pixels).toFixed(2)} / ${totalLuma(mi1.pixels).toFixed(2)}`)
  const m0 = (await capture('ctl-motion-0-a', { scenario: 'steady', timeSec: 3.1, params: { [P('motion-amount')]: 0 } }))
  const m0b = (await capture('ctl-motion-0-b', { scenario: 'steady', timeSec: 4.1, params: { [P('motion-amount')]: 0 } }))
  const m1 = (await capture('ctl-motion-1-a', { scenario: 'steady', timeSec: 3.1, params: { [P('motion-amount')]: 1 } }))
  const m1b = (await capture('ctl-motion-1-b', { scenario: 'steady', timeSec: 4.1, params: { [P('motion-amount')]: 1 } }))
  tile(m0, 'motion 0 · t=3.1'); tile(m0b, 'motion 0 · t=4.1'); tile(m1, 'motion 1 · t=3.1'); tile(m1b, 'motion 1 · t=4.1')
  check('C01', 'Motion Amount 0 stops every rod movement with music playing; 1 moves them', maxAbsDiff(m0.probe.hang, m0b.probe.hang) < 0.25 && maxAbsDiff(m1.probe.hang, m1b.probe.hang) > 0.15, `0: ${maxAbsDiff(m0.probe.hang, m0b.probe.hang).toFixed(3)} (hits only) · 1: ${maxAbsDiff(m1.probe.hang, m1b.probe.hang).toFixed(3)}`)
  const ms1 = await capture('ctl-speed-0.3', { scenario: 'steady', timeSec: 4, params: { [P('motion-speed')]: 0.3 } })
  const ms2 = await capture('ctl-speed-2', { scenario: 'steady', timeSec: 4, params: { [P('motion-speed')]: 2 } })
  check('C01', 'Motion Speed 2 runs the formation about 6.7 times as far as 0.3 over the same time', ms2.probe.phase / ms1.probe.phase > 5.5 && ms2.probe.phase / ms1.probe.phase < 8, `${ms1.probe.phase.toFixed(1)} → ${ms2.probe.phase.toFixed(1)} beats`)
  const bl0 = await capture('ctl-bloom-0', { scenario: 'steady', timeSec: 3.1, params: { [P('bloom')]: 0 } })
  const bl6 = await capture('ctl-bloom-0.6', { scenario: 'steady', timeSec: 3.1, params: { [P('bloom')]: 0.6 } })
  tile(bl0, 'bloom 0'); tile(bl6, 'bloom 0.6')
  check('F01', 'Bloom 0.6 adds a glow around the rods that 0 does not; the rods stay legible at 0', totalLuma(bl6.pixels) > totalLuma(bl0.pixels) * 1.03 && litBounds(bl0.pixels).width > 800, `${totalLuma(bl0.pixels).toFixed(2)} → ${totalLuma(bl6.pixels).toFixed(2)}`)
  const ac0 = await capture('ctl-accent-0', { scenario: 'steady', timeSec: 3.05, params: { [P('accent-strength')]: 0 } })
  const ac1 = await capture('ctl-accent-1', { scenario: 'steady', timeSec: 3.05, params: { [P('accent-strength')]: 1 } })
  tile(ac0, 'accent strength 0 · kick'); tile(ac1, 'accent strength 1 · kick')
  check('C01', 'Accent Strength 0 leaves a kick no accent colour and no lift; 1 gives both', ac0.probe.accent.every(a => a === 0) && ac1.probe.accent.some(a => a > 0.5) && meanAbsDiff(ac0.probe.hang, ac1.probe.hang) > 0.01)
  const cam = async (amount, t) => (await capture(`ctl-camera-${amount}-${t}`, { scenario: 'steady', timeSec: t, params: { [P('camera-motion')]: amount } })).status.camera.position
  const c0a = await cam(0, 2), c0b = await cam(0, 7), c1a = await cam(1, 2), c1b = await cam(1, 7)
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
  check('C01', 'Camera Motion 0 never moves the camera; 1 does', dist(c0a, c0b) < 1e-6 && dist(c1a, c1b) > 0.02, `locked ${dist(c0a, c0b).toExponential(1)} · moving ${dist(c1a, c1b).toFixed(3)}`)

  // Palette roles: each one changes only what it should.
  const cyanBase = count(base.pixels, isCyan), violetBase = count(base.pixels, isViolet)
  const red = await run('palette-primary-red', { [P('primary-rods')]: [1, 0, 0, 1] })
  check('C02', 'Primary Rods red recolours the primary bank and leaves the secondary bank alone', count(red.pixels, isRed) > 400 && count(red.pixels, isCyan) < cyanBase * 0.1 && Math.abs(count(red.pixels, isViolet) - violetBase) < violetBase * 0.12, `red ${count(red.pixels, isRed)} · cyan ${cyanBase}→${count(red.pixels, isCyan)} · violet ${violetBase}→${count(red.pixels, isViolet)}`)
  const green = await run('palette-secondary-green', { [P('secondary-rods')]: [0, 1, 0, 1] })
  check('C02', 'Secondary Rods green recolours the secondary bank and leaves the primary bank alone', count(green.pixels, isGreen) > 400 && count(green.pixels, isViolet) < violetBase * 0.1 && Math.abs(count(green.pixels, isCyan) - cyanBase) < cyanBase * 0.12)
  const yellowHit = await capture('ctl-palette-accent-yellow', { scenario: 'steady', timeSec: 3.05, params: { [P('accent-hits')]: [1, 1, 0, 1] } })
  const yellowRest = await run('palette-accent-yellow-rest', { [P('accent-hits')]: [1, 1, 0, 1] })
  tile(yellowHit, 'accent yellow · kick')
  check('C02', 'Accent Hits yellow shows on the rods a kick hits, and nowhere at rest', count(yellowHit.pixels, isYellow) > 300 && count(yellowRest.pixels, isYellow) < 20, `hit ${count(yellowHit.pixels, isYellow)} · rest ${count(yellowRest.pixels, isYellow)}`)
  const magenta = await run('palette-structure-magenta', { [P('mounting-structure')]: [0.8, 0, 0.8, 1] })
  check('C02', 'Mounting Structure recolours the grid, stems and caps and not the rods\' light', count(magenta.pixels, isMagentaDark) > count(base.pixels, isMagentaDark) + 3000 && Math.abs(count(magenta.pixels, isCyan) - cyanBase) < cyanBase * 0.15, `magenta ${count(base.pixels, isMagentaDark)}→${count(magenta.pixels, isMagentaDark)}`)
  const blue = await run('palette-background-blue', { [P('background')]: [0, 0.05, 0.4, 1] })
  const corner = pixel(blue.pixels, 6, 6), cornerBase = pixel(base.pixels, 6, 6)
  check('C02', 'Background recolours the space and not the rods', corner[2] > cornerBase[2] + 40 && Math.abs(count(blue.pixels, isCyan) - cyanBase) < cyanBase * 0.12, `corner ${cornerBase}→${corner}`)
  await sheet('controls', cases.filter(c => c.label), 6, 400)
}

async function audio() {
  const idle = await capture('audio-idle', { scenario: 'steady', timeSec: 2.8, params: { [P('motion-amount')]: 1 } })
  const kick = await capture('audio-kick', { scenario: 'steady', timeSec: 3.05, params: { [P('motion-amount')]: 1 } })
  const snare = await capture('audio-snare', { scenario: 'steady', timeSec: 3.55, params: { [P('motion-amount')]: 1 } })
  const set = a => new Set(a.flatMap((v, i) => (v > 0.05 ? [i] : [])))
  const kickSet = set(kick.probe.accent), snareSet = set(snare.probe.accent)
  check('A02', 'a kick and a snare light different rods, and neither lights them all', kickSet.size > 8 && snareSet.size > 8 && ![...kickSet].some(i => snareSet.has(i)) && kickSet.size + snareSet.size <= 64, `kick ${kickSet.size} rods · snare ${snareSet.size} rods`)
  check('A02', 'a kick moves rods, not only their light', maxAbsDiff(idle.probe.hang, kick.probe.hang) > 0.05)
  const bass = await capture('audio-bass', { scenario: 'bass', timeSec: 3.3, params: { [P('motion-amount')]: 1 } })
  const steady = await capture('audio-steady-same-time', { scenario: 'steady', timeSec: 3.3, params: { [P('motion-amount')]: 1 } })
  check('A01', 'bass-heavy music moves the rods differently from ordinary music, and lights them more', meanAbsDiff(bass.probe.hang, steady.probe.hang) > 0.01 && mean(bass.probe.emission) > mean(steady.probe.emission))
  const vocal = await capture('audio-vocal', { scenario: 'vocal', timeSec: 3.3, params: { [P('motion-amount')]: 1 } })
  const noVocal = steady
  const bank1 = a => mean(a.emission.filter((_, i) => i % 8 % 2 === 1)); const bank0 = a => mean(a.emission.filter((_, i) => i % 8 % 2 === 0))
  check('A04', 'vocals calm the secondary bank and leave the primary bank alone, while the authored idle glow holds', bank1(vocal.probe) < bank1(noVocal.probe) * 0.92 && Math.abs(bank0(vocal.probe) - bank0(noVocal.probe)) < 0.05 && Math.min(...vocal.probe.emission) >= 0.27)
  const preBuild = await capture('audio-build-early', { scenario: 'build', timeSec: 1.5, params: { [P('motion-amount')]: 1 } })
  const lateBuild = await capture('audio-build-late', { scenario: 'build', timeSec: 9.4, params: { [P('motion-amount')]: 1 } })
  const autoBuild = await capture('audio-build-late-auto', { scenario: 'build', timeSec: 9.4, params: { [P('motion-amount')]: 1, [P('auto-performance')]: true } })
  check('A03', 'a buildup narrows the height range, and more so with Auto Performance on', spread(lateBuild.probe.hang) < spread(preBuild.probe.hang) && spread(autoBuild.probe.hang) <= spread(lateBuild.probe.hang), `${spread(preBuild.probe.hang).toFixed(2)} → ${spread(lateBuild.probe.hang).toFixed(2)} → auto ${spread(autoBuild.probe.hang).toFixed(2)}`)
  const before = await capture('audio-drop-before', { scenario: 'drop', timeSec: 11.9, dropAt: 12, params: { [P('motion-amount')]: 1 } })
  const after = await capture('audio-drop-after', { scenario: 'drop', timeSec: 12.25, dropAt: 12, params: { [P('motion-amount')]: 1 } })
  const afterAuto = await capture('audio-drop-after-auto', { scenario: 'drop', timeSec: 12.25, dropAt: 12, params: { [P('motion-amount')]: 1, [P('auto-performance')]: true } })
  check('A03', 'a drop releases the whole array downward by a visible distance', mean(after.probe.hang) - mean(before.probe.hang) > 0.2 && after.probe.hang.filter((h, i) => h > before.probe.hang[i] + 0.05).length > 40, `mean cap hang ${mean(before.probe.hang).toFixed(2)} → ${mean(after.probe.hang).toFixed(2)}`)
  check('O', 'Auto Performance lets a drop release further than without it, within the bound', mean(afterAuto.probe.hang) > mean(after.probe.hang) && mean(afterAuto.probe.hang) < mean(after.probe.hang) + 0.5)
  const zeroMotion = await capture('audio-drop-after-motion-0-auto', { scenario: 'drop', timeSec: 12.25, dropAt: 12, params: { [P('motion-amount')]: 0, [P('auto-performance')]: true } })
  const zeroDark = await capture('audio-drop-after-master-0-auto', { scenario: 'drop', timeSec: 12.25, dropAt: 12, params: { [P('master-intensity')]: 0, [P('auto-performance')]: true } })
  const zeroBloom = await capture('audio-drop-after-bloom-0-auto', { scenario: 'drop', timeSec: 12.25, dropAt: 12, params: { [P('bloom')]: 0, [P('auto-performance')]: true } })
  check('O03', 'with Auto Performance on, Motion Amount 0 keeps the rods still, Master Intensity 0 keeps them dark, Bloom 0 keeps the glow off', spread(zeroMotion.probe.hang) < 0.6 && maxAbsDiff(zeroMotion.probe.hang, before.probe.hang) < 1 && zeroDark.probe.emission.every(e => e === 0) && totalLuma(zeroDark.pixels) < totalLuma(after.pixels) * 0.3 && totalLuma(zeroBloom.pixels) < totalLuma(after.pixels))
  await sheet('audio', [
    { ...idle, label: 'steady · no hit' }, { ...kick, label: 'kick' }, { ...snare, label: 'snare' }, { ...bass, label: 'bass-heavy' },
    { ...vocal, label: 'vocals' }, { ...lateBuild, label: 'late build' }, { ...before, label: 'just before the drop' }, { ...after, label: 'just after the drop' },
  ], 4, 480)
}

async function timingAndTransport() {
  const sync = async (bpmSync, t) => capture(`timing-sync-${bpmSync}-${t}`, { scenario: 'steady', bpm: 148, timeSec: t, params: { [P('bpm-sync')]: bpmSync, [P('pattern')]: 'crosswave' } })
  const on = await sync(true, 6), off = await sync(false, 6)
  check('C03', 'BPM Sync on follows 148 BPM and off free-runs at 120 BPM (about 14.8 vs 12 beats after 6 s)', Math.abs(on.probe.phase - 14.8) < 1 && Math.abs(off.probe.phase - 12) < 1, `on ${on.probe.phase.toFixed(2)} · off ${off.probe.phase.toFixed(2)}`)
  const hit = await capture('timing-sync-off-kick', { scenario: 'steady', bpm: 148, timeSec: 3.0, params: { [P('bpm-sync')]: false, [P('motion-amount')]: 1 } })
  check('C03', 'with BPM Sync off the music still moves and lights rods', hit.probe.musicActive === true && Math.max(...hit.probe.emission) > 0.45)

  // Pause, resume, seek, track change.
  const s = await session({ scenario: 'steady', timeSec: 4, params: { [P('pattern')]: 'crosswave' } })
  try {
    const playing = await s.probe()
    await s.transport({ paused: true }); await s.frames(40)
    const paused = await s.probe()
    check('L01', 'pausing freezes the formation phase and adds no hit', Math.abs(paused.phase - playing.phase) < 0.4 && maxAbsDiff(paused.hang, playing.hang) < 0.35)
    const held = await s.probe(); await s.frames(40)
    check('L01', 'the paused frame stays still', maxAbsDiff((await s.probe()).hang, held.hang) < 1e-6)
    await s.transport({ paused: false }); await s.frames(30)
    const resumed = await s.probe()
    check('L01', 'resuming continues from the held phase with no catch-up jump', resumed.phase > paused.phase && resumed.phase - paused.phase < 1.5, `${paused.phase.toFixed(2)} → ${resumed.phase.toFixed(2)}`)
    await s.transport({ timeOffsetSec: -3 }); await s.frames(8)
    const seeked = await s.probe()
    check('L02', 'a seek back re-bases the formation and leaves no stale hit', seeked.phase < resumed.phase && seeked.accent.every(a => a < 0.2), `${resumed.phase.toFixed(2)} → ${seeked.phase.toFixed(2)}`)
    healthy('transport', await s.status(), s.errors)
  } finally { await s.close() }

  const p = await session({ scenario: 'steady', timeSec: 1, params: { [P('pattern')]: 'waterfall', [P('pattern-change')]: true, [P('trigger')]: 'beat4' } })
  try {
    const seen = new Set()
    for (let t = 2; t <= 14; t += 0.5) { await p.advance(t); seen.add((await p.probe()).pattern) }
    check('T01', 'Pattern Change on with Trigger Every 4 Beats moves through several formations on the real audio path', seen.size >= 3, [...seen].join(', '))
    await p.params({ [P('pattern')]: 'crown' })
    const manual = await p.probe()
    check('T03', 'choosing a Pattern with Pattern Change on shows it at once', manual.pattern === 'crown')
    await p.params({ [P('pattern-change')]: false }); await p.advance(30)
    check('T03', 'with Pattern Change off the chosen formation stays', (await p.probe()).pattern === 'crown')
    healthy('pattern-change', await p.status(), p.errors)
  } finally { await p.close() }
  const q = await session({ scenario: 'steady', timeSec: 14, params: { [P('pattern')]: 'waterfall', [P('pattern-change')]: false, [P('trigger')]: 'kick' } })
  try {
    const seen = new Set()
    for (let t = 15; t <= 25; t += 0.5) { await q.advance(t); seen.add((await q.probe()).pattern) }
    check('C05', 'with Pattern Change off no trigger ever changes the formation, however many kicks arrive', seen.size === 1 && seen.has('waterfall'))
  } finally { await q.close() }
}

async function lifecycleAndPerformance() {
  const s = await session({ scenario: 'steady', timeSec: 2 })
  try {
    for (const [w, h] of [[1280, 720], [640, 1136], [2048, 1041]]) {
      await page_resize(s, w, h)
      const status = await s.status()
      check('B02', `resizing to ${w}x${h} keeps rendering`, healthy(`resize-${w}x${h}`, status, s.errors) && status.snapshot.phase === 'running')
    }
    const recovered = await s.page.evaluate(() => globalThis.__canopyProduction.recoverContext())
    check('L04', 'a lost and restored WebGL context rebuilds the array and keeps rendering', recovered.snapshot.contextGeneration >= 2 && recovered.snapshot.phase === 'running' && recovered.modules.failedModuleCount === 0 && recovered.modules.estimatedGpuBytes > 0, `generation ${recovered.snapshot.contextGeneration}`)
    const shot = await s.shot('lifecycle-after-recovery')
    check('L04', 'the picture after recovery is not black', totalLuma(shot.pixels) > 2)
  } finally { await s.close() }
  for (const [label, entry] of [['default 8x8 · 1080p · high', { params: {} }], ['12x12 max · 1080p · high', { params: { [P('rows')]: 12, [P('columns')]: 12 } }], ['8x8 · 1080p · low', { quality: 'low', params: {} }]]) {
    const s2 = await session({ scenario: 'steady', timeSec: 2, ...entry })
    try {
      const profile = await s2.page.evaluate(() => globalThis.__canopyProduction.profile(180))
      const perf = profile.runtime.performance
      check('P01', `${label}: runs without a spike or a failed module`, healthy(`perf-${label}`, profile.runtime, s2.errors) && profile.wallFrameTimeAverageMs < 25, `wall ${profile.wallFrameTimeAverageMs.toFixed(2)} ms/frame · cpu ${perf.cpuFrameTimeAverageMs?.toFixed?.(2)} ms · gpu ${perf.gpuFrameTimeMs?.toFixed?.(2) ?? 'n/a'} ms · module gpu ${profile.runtime.modules.estimatedGpuBytes} B`)
      results.push({ section: 'P01', name: `${label}: numbers`, ok: true, detail: JSON.stringify({ wallMs: profile.wallFrameTimeAverageMs, cpuMs: perf.cpuFrameTimeAverageMs, gpuMs: perf.gpuFrameTimeMs, moduleGpuBytes: profile.runtime.modules.estimatedGpuBytes, resolvedQuality: perf.resolvedQuality }) })
    } finally { await s2.close() }
  }
}
async function page_resize(s, w, h) {
  await s.page.setViewportSize({ width: w, height: h })
  await s.page.evaluate(([width, height]) => globalThis.__canopyProduction.resize(width, height), [w, h])
}

// ---- main --------------------------------------------------------------------------------------------------------------------------------
const artifactRoot = join(root, 'artifacts/cinema2-canopy-acceptance')
await mkdir(artifactRoot, { recursive: true })
output = await mkdtemp(join(artifactRoot, 'run-'))
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0, strictPort: false }, clearScreen: false, logLevel: 'error' })
const started = Date.now()
try {
  await server.listen()
  const address = server.httpServer?.address()
  if (!address || typeof address === 'string') throw new Error('Vite did not expose a local port.')
  baseUrl = `http://127.0.0.1:${address.port}/src/test/browser/cinema2-canopy-production.html`
  browser = await chromium.launch({ headless: true, executablePath: chrome })
  const sections = { hero: heroAndAspects, patterns, controls, audio, timing: timingAndTransport, lifecycle: lifecycleAndPerformance }
  for (const [name, run] of Object.entries(sections)) if (wanted(name)) { console.log(`\n== ${name}`); await run() }
} finally {
  // A page that lost its WebGL context can make Chrome slow to close; never let shutdown hold the verdict hostage.
  const within = (promise, ms) => Promise.race([promise, new Promise(resolve => setTimeout(resolve, ms))])
  await within(browser?.close(), 8000)
  await within(server.close(), 4000)
  await writeFile(join(output, 'manifest.json'), `${JSON.stringify({ schemaVersion: 1, preset: 'drmvyz.cinema2.canopy', seconds: Math.round((Date.now() - started) / 1000), passed: results.filter(r => r.ok).length, failed: failures.length, checks: results }, null, 2)}\n`)
}
console.log(`\nCANOPY production acceptance: ${results.filter(r => r.ok).length} passed, ${failures.length} failed → ${relative(root, output)}`)
if (failures.length) { console.log(failures.map(f => `  - ${f}`).join('\n')); process.exitCode = 1 }
// Vite's watcher and a headless Chrome can keep the loop alive after the work is done.
process.exit(process.exitCode ?? 0)

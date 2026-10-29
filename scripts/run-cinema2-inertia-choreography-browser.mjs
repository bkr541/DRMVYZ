#!/usr/bin/env node
/* global window */
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import sharp from 'sharp'

const root = resolve(import.meta.dirname, '..'), output = resolve(process.argv[2] ?? 'artifacts/inertia-phase5')
const resume = process.argv.includes('--resume')
await mkdir(output, { recursive: true })
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0 }, clearScreen: false, logLevel: 'error' })
const errors = [], results = [], traces = []
let browser
try {
  await server.listen()
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
  const page = await browser.newPage({ viewport: { width: 954, height: 954 } })
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text()) })
  const api = async (method, ...args) => {
    const s = await page.evaluate(([method, args]) => window.__inertiaAudio[method](...args), [method, args])
    assert.equal(s.snapshot.phase, 'running', JSON.stringify(s.modules))
    assert.equal(s.modules.failedModuleCount, 0, JSON.stringify(s.modules))
    return s
  }
  const capture = async (name, part, cached = false) => {
    const png = cached ? await readFile(join(output, `${name}.png`)) : await page.locator('canvas').screenshot()
    if (!cached) await writeFile(join(output, `${name}.png`), png)
    const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    const width = info.width, height = info.height
    let minX = width, minY = height, maxX = 0, maxY = 0
    const mask = new Uint8Array(width * height)
    for (let i = 0; i < mask.length; i++) {
      if (Math.max(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]) < 30) continue
      mask[i] = 1; const x = i % width, y = Math.floor(i / width)
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y)
    }
    const points = []
    if (part === 'anchors') for (let start = 0; start < mask.length; start++) {
      if (!mask[start]) continue
      const queue = [start]; mask[start] = 0
      let weight = 0, xSum = 0, ySum = 0
      for (let n = 0; n < queue.length; n++) {
        const i = queue[n], x = i % width, y = Math.floor(i / width), light = data[i * 3]
        weight += light; xSum += x * light; ySum += y * light
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
          const next = ny * width + nx
          if (mask[next]) { mask[next] = 0; queue.push(next) }
        }
      }
      if (queue.length >= 2) points.push({ x: xSum / weight, y: ySum / weight })
    }
    if (part === 'anchors') assert.equal(points.length, 8, `${name}: all eight anchors must remain readable`)
    const radius = points.length ? points.reduce((sum, p) => sum + Math.hypot(p.x - width / 2, p.y - height / 2), 0) / points.length : ((maxX - minX) + (maxY - minY)) / 4
    return { data, points, radius, bounds: [minX, minY, maxX, maxY] }
  }
  const delta = (a, b) => { let sum = 0; for (let i = 0; i < a.data.length; i++) sum += Math.abs(a.data[i] - b.data[i]); return sum / a.data.length }
  const check = (name, value, condition) => { results.push({ name, value }); assert(condition, `${name}: ${value}`) }
  const vectors = (moved, base) => {
    const unused = [...moved.points]
    return base.points.map(p => {
      let index = 0
      for (let i = 1; i < unused.length; i++) if (Math.hypot(unused[i].x - p.x, unused[i].y - p.y) < Math.hypot(unused[index].x - p.x, unused[index].y - p.y)) index = i
      const q = unused.splice(index, 1)[0]
      return { x: p.x, y: p.y, dx: q.x - p.x, dy: q.y - p.y }
    })
  }
  let generation = 0
  const times = [1.12, 1.13, 1.14, 1.30, 1.315, 1.50, 1.62, 2.0]
  const defaults = { pattern: 'countertwist', 'pattern-change': false, 'audio-response': 1, 'motion-amount': 1, deformation: 1,
    damping: 0.65, 'motion-speed': 0.25, 'bpm-sync': false, 'cage-size': 0.9, 'proof-part': 'anchors' }
  const trajectory = async (name, music = {}, sampleTimes = times, values = {}) => {
    const valuesUsed = { ...defaults, ...values }, part = valuesUsed['proof-part']
    if (resume && ['neutral', 'kick', 'snare', 'drop'].includes(name)) {
      const shots = new Map(), trace = { name, parameters: valuesUsed, music, reusedUnchangedImplementationCaptures: true, frames: [] }
      for (const time of sampleTimes) {
        const shot = await capture(`${name}-${Math.round((time - 1.1) * 1000)}ms`, part, true)
        shots.set(time, shot); trace.frames.push({ time, radius: shot.radius, bounds: shot.bounds })
      }
      traces.push(trace); return shots
    }
    await api('set', valuesUsed)
    await api('music', { energy: 1, bass: 0, high: 0, build: 0, vocal: 0, track: `inertia-choreography-${generation++}`, timeSec: 0, eventTime: 1.1, ...music })
    await api('precision', 100); await api('advance', 1); await api('precision', 5)
    let current = 1
    const shots = new Map(), trace = { name, parameters: valuesUsed, music, frames: [] }
    const saved = (await api('status')).authored
    for (const time of sampleTimes) {
      const s = await api('advance', time - current); current = time
      const shot = await capture(`${name}-${Math.round((time - 1.1) * 1000)}ms`, part)
      shots.set(time, shot)
      trace.frames.push({ time, radius: shot.radius, bounds: shot.bounds, channels: s.channels, activeEnvelopes: s.choreography.activeEnvelopeCount })
      assert.equal(s.authored, saved, `${name}: choreography mutated authored parameters`)
    }
    traces.push(trace)
    return shots
  }
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/src/test/browser/cinema2-inertia-audio.html?fine`)
  await page.waitForFunction(() => window.__inertiaAudio)
  await api('prepare')
  const base = await trajectory('neutral')
  const kick = await trajectory('kick', { event: 'kick' }, [1.13, 1.30, 1.50])
  const force = kick.get(1.13).radius - base.get(1.13).radius
  const recoil = kick.get(1.30).radius - base.get(1.30).radius
  check('Kick expands then recoils inward', [force, recoil], force > 1 && recoil < -0.3)
  check('Kick returns exactly to native geometry', delta(kick.get(1.50), base.get(1.50)), delta(kick.get(1.50), base.get(1.50)) < 0.0001)
  const snare = await trajectory('snare', { event: 'snare' }, [1.12, 1.315, 1.50])
  const front = vectors(snare.get(1.12), base.get(1.12)), tail = vectors(snare.get(1.315), base.get(1.315))
  const dot = front.reduce((sum, p) => {
    const q = tail.reduce((nearest, q) => Math.hypot(q.x - p.x, q.y - p.y) < Math.hypot(nearest.x - p.x, nearest.y - p.y) ? q : nearest)
    return sum + p.dx * q.dx + p.dy * q.dy
  }, 0) / front.length
  check('Snare follow-through opposes initial movement', dot, dot < -0.05)
  check('Snare returns exactly to native geometry', delta(snare.get(1.50), base.get(1.50)), delta(snare.get(1.50), base.get(1.50)) < 0.0001)
  const drop = await trajectory('drop', { event: 'drop' }, [1.14, 1.62, 2.0])
  const dropForce = drop.get(1.14).radius - base.get(1.14).radius
  const dropRecoil = drop.get(1.62).radius - base.get(1.62).radius
  check('Drop releases outward then settles inward', [dropForce, dropRecoil], dropForce > 1 && dropRecoil < -0.3)
  check('Drop returns exactly to native geometry', delta(drop.get(2.0), base.get(2.0)), delta(drop.get(2.0), base.get(2.0)) < 0.0001)
  const coreBase = await trajectory('core-neutral', {}, [1.12, 1.315], { 'proof-part': 'core' })
  const core = await trajectory('core-kick', { event: 'kick' }, [1.12, 1.315], { 'proof-part': 'core' })
  check('Core pulse has its own shorter recovery', [core.get(1.12).radius - coreBase.get(1.12).radius, delta(core.get(1.315), coreBase.get(1.315))],
    core.get(1.12).radius - coreBase.get(1.12).radius > 2 && delta(core.get(1.315), coreBase.get(1.315)) < 0.0001)
  const loaded = await trajectory('build-loaded', { build: 1 }, [1.14, 1.62, 2.0])
  const released = await trajectory('build-drop', { build: 1, event: 'drop' }, [1.14, 1.62, 2.0])
  check('Drop releases the loaded build rather than fighting it', released.get(1.14).radius - base.get(1.14).radius, released.get(1.14).radius > base.get(1.14).radius + 1)
  check('Current build facts resume after recovery', delta(released.get(2.0), loaded.get(2.0)), delta(released.get(2.0), loaded.get(2.0)) < 0.0001)
  const lowBase = await trajectory('damping-low-neutral', {}, [1.30], { damping: 0 })
  const low = await trajectory('damping-low-kick', { event: 'kick' }, [1.30], { damping: 0 })
  const highBase = await trajectory('damping-high-neutral', {}, [1.30], { damping: 1 })
  const high = await trajectory('damping-high-kick', { event: 'kick' }, [1.30], { damping: 1 })
  const lowDelta = low.get(1.30).radius - lowBase.get(1.30).radius, highDelta = high.get(1.30).radius - highBase.get(1.30).radius
  check('Higher Damping visibly reduces recoil', [lowDelta, highDelta], lowDelta < highDelta - 0.3 && highDelta < 0)
  await api('set', { 'audio-response': 0 })
  const disabled = await capture('disabled-during-recoil', 'anchors')
  check('Audio Response zero cancels every cue stage immediately', delta(disabled, highBase.get(1.30)), delta(disabled, highBase.get(1.30)) < 0.0001)
  await api('set', { 'audio-response': 1 })
  const reenabled = await capture('reenabled-no-stale-recoil', 'anchors')
  check('Re-enable cannot replay the old recovery stage', delta(reenabled, highBase.get(1.30)), delta(reenabled, highBase.get(1.30)) < 0.0001)
  const zeroMBase = await trajectory('motion-zero-neutral', {}, [1.30], { 'motion-amount': 0 })
  const zeroMCue = await trajectory('motion-zero-kick', { event: 'kick' }, [1.30], { 'motion-amount': 0 })
  check('Motion Amount zero blocks recoil', delta(zeroMBase.get(1.30), zeroMCue.get(1.30)), delta(zeroMBase.get(1.30), zeroMCue.get(1.30)) < 0.0001)
  await trajectory('hero-kick', { event: 'kick' }, [1.13, 1.30, 1.50], { 'proof-part': 'all', 'cage-size': 1, 'motion-speed': 1, 'motion-amount': 0.65, deformation: 0.45, 'audio-response': 0.65 })
  assert.deepEqual(errors, [])
  await writeFile(join(output, 'report.json'), JSON.stringify({ phase: 5, results, traces, errors }, null, 2))
  console.log(`PASS Inertia choreography: ${results.length} rendered force/recovery assertions; ${traces.length} deterministic trajectories: ${output}`)
} finally { await browser?.close(); await server.close() }

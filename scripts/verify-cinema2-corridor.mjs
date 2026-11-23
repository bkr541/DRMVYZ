#!/usr/bin/env node
/* global window */
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { chromium, expect } from '@playwright/test'
import { createServer } from 'vite'
import sharp from 'sharp'

const output = resolve('artifacts/cinema2-corridor')
await mkdir(output, { recursive: true })
const server = await createServer({ server: { host: '127.0.0.1', port: 0, hmr: false }, logLevel: 'error' })
let browser
const checks = []
const errors = []
try {
  await server.listen()
  browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] })
  const page = await browser.newPage({ viewport: { width: 900, height: 560 }, deviceScaleFactor: 1 })
  page.on('pageerror', error => { errors.push(error.message); console.error(error.message) })
  page.on('console', message => {
    if (message.type() === 'error' && !/Failed to load resource|CONTEXT_LOST_WEBGL/.test(message.text())) errors.push(message.text())
  })
  const api = async (method, ...args) => {
    const status = await page.evaluate(([name, values]) => window.__corridor[name](...values), [method, args])
    assert.equal(status.snapshot.phase, 'running', JSON.stringify(status.snapshot))
    assert.equal(status.modules.failedModuleCount, 0, JSON.stringify(status.modules))
    assert.equal(status.effects.failedEffectCount, 0, JSON.stringify(status.effects))
    return status
  }
  const values = status => JSON.parse(status.authored).values
  const performance = status => status.modules.modules[0].inspection
  const url = `http://127.0.0.1:${server.httpServer.address().port}/src/test/browser/cinema2-submerge-production.html?preset=corridor`
  const open = async (auto, inspector = false) => {
    await page.goto(`${url}&auto=${auto ? 'on' : 'off'}${inspector ? '&inspector' : ''}`)
    await page.waitForFunction(() => window.__corridor, null, { timeout: 12000 })
    const status = await api('prepare')
    assert.equal(values(status)['corridor-auto-performance'], auto)
    return status
  }
  const capture = async name => {
    const buffer = await page.screenshot()
    if (name) await writeFile(join(output, `${name}.png`), buffer)
    return sharp(buffer).removeAlpha().raw().toBuffer()
  }
  const difference = (a,b) => {
    assert.equal(a.length,b.length)
    let sum = 0
    for (let i=0;i<a.length;i++) sum += Math.abs(a[i]-b[i])
    return sum / a.length
  }
  const changed = (name,a,b,min=.025) => {
    const delta = difference(a,b)
    assert(delta > min, `${name} stayed the same (${delta})`)
    checks.push({ name, meanPixelDifference: delta })
  }
  await open(true)
  const initial = await open(false)
  const defaults = values(initial)
  checks.push({ name: 'both System Settings defaults initialize correctly' })
  const baseline = await capture('night-transit')
  assert(baseline.some(value => value > 180), 'The default look needs visible luminous panels.')
  const center = (280 * 900 + 450) * 3
  assert(Math.max(...baseline.subarray(center,center+3)) < 50, 'The vanishing point must stay dark.')
  const change = patch => api('setParameters', patch)
  const patterns = [['night-transit',baseline]]
  for (const pattern of ['relay','counterflow','shaft','signal-fault','gate']) {
    await change({ pattern })
    const next = await capture(pattern)
    for (const [previous,frame] of patterns) changed(`${previous} / ${pattern}`,frame,next)
    patterns.push([pattern,next])
  }
  await change({ pattern:'night-transit' })
  for (const [name,first,second] of [
    ['width',1.8,3.3], ['roll',0,1], ['density',0.05,0.85], ['intensity',0,1.45], ['haze',0,1], ['bloom',0,1.2],
    ['void',[0,.20,.1,1],[.13,.01,.01,1]], ['wall',[.12,.18,.35,1],[.33,.08,.02,1]],
    ['amber',[.15,.45,1,1],[1,.2,.06,1]], ['hot',[.16,1,.4,1],[1,.18,.18,1]],
    ['markings',[.9,.1,0,1],[.10,1,.35,1]],
  ]) {
    await change({ [name]: first })
    const low = await capture()
    await change({ [name]: second })
    changed(name,low,await capture())
    await change({ [name]: defaults[`corridor-${name}`] })
  }

  await api('setMusic',{active:true,energy:.7,bass:.5,high:.2,bpm:72})
  const speed = async (sync, transit) => {
    await change({ 'bpm-sync':sync, transit })
    await api('seek',0)
    return performance(await api('advanceBy',0.8)).travel
  }
  const synced = await speed(true,1)
  const free = await speed(false,1)
  assert(Math.abs(synced-free)>.15, 'BPM Sync should visibly change the rate at 72 BPM.')
  assert(await speed(false,1.7) > await speed(false,.25) + .35, 'Transit Rate must change travelled distance.')
  checks.push({ name:'BPM Sync and Transit Rate change actual motion' })
  await change({transit:1,'bpm-sync':true})
  changed('playing transit moves the rendered cassettes',baseline,await capture('travelling'))
  assert.equal(performance(await api('setMusic',{event:'kick',eventId:80,frameId:80001})).activePattern,'night-transit')
  await api('setMusic',{event:null})
  checks.push({name:'Pattern Change OFF holds the authored pattern through a fresh kick'})
  await change({ 'pattern-change':true, trigger:'kick', motion:0 })
  const locked = await capture()
  await api('advanceBy',0.19)
  assert(difference(locked,await capture())<.02, 'Zero Motion Amount must hold the frame.')
  const kick = {event:'kick',eventId:81,frameId:81001}
  const triggered = performance(await api('setMusic',kick))
  assert.notEqual(triggered.activePattern,'night-transit')
  changed('new kick advances the rendered pattern',locked,await capture())
  assert.equal(performance(await api('setMusic',kick)).activePattern,triggered.activePattern)
  const edited = await change({pattern:'shaft'})
  assert.equal(performance(edited).activePattern,'shaft')
  assert.equal(values(edited)['corridor-pattern-change'],true)
  assert.equal(performance(await api('setMusic',kick)).activePattern,'shaft')
  await api('setMusic',{event:null})
  await api('advanceBy',.12)
  assert.notEqual(performance(await api('setMusic',{event:'kick',eventId:82,frameId:82001})).activePattern,'shaft')
  checks.push({name:'manual edits hold through duplicates and the next fresh event advances'})

  await change({pattern:'night-transit','pattern-change':false,'auto-performance':true,motion:.75})
  await api('setMusic',{event:null,energy:.83,bpm:120,build:.95,sectionBuild:true})
  const build = await api('advanceBy',.65)
  assert.equal(performance(build).patternControlsAutomatic,true)
  const charged = await capture('build')
  changed('build recruits additional panels',baseline,charged)
  await api('setMusic',{event:'drop',eventId:83,build:0,sectionBuild:false},.05)
  const drop = await api('advanceBy',.19)
  assert(performance(drop).drop > .5,'The shared structural drop should drive the visible gate.')
  assert.equal(drop.authored,build.authored)
  const gate = await capture('drop')
  changed('drop changes the live gate',charged,gate)
  await api('setMusic',{paused:true,event:null})
  const held = await capture()
  await api('advanceBy',.36)
  assert(difference(held,await capture())<.03,'Pause should hold the active scene.')
  checks.push({name:'pause holds the camera and active lighting'})
  const seek = await api('seek',6)
  assert.equal(performance(seek).drop,0)
  assert.equal(performance(seek).activePattern,'night-transit')
  checks.push({name:'seek resets transient cues without editing the authored pattern'})
  await api('setMusic',{paused:false,energy:0,bass:0,high:0})
  const stopped = await api('advanceBy',1.2)
  assert(performance(stopped).density < performance(build).density)
  assert.equal(performance(stopped).effectivePatternChange, false)
  checks.push({name:'silence withdraws the active panel density'})
  for (const [width,height,name] of [[600,600,'square'],[450,800,'portrait']]) {
    await page.setViewportSize({width,height})
    await api('resize',width,height)
    const image=await capture(name)
    assert(image.some(value=>value>85),`${name} retains illuminated geometry.`)
  }
  await api('restoreContext')
  await capture('restored')
  checks.push({name:'square, portrait and context recovery render successfully'})

  await page.setViewportSize({width:1000,height:660})
  await open(false,true)
  const inspector = page.locator('#corridor-inspector')
  await expect(inspector.locator('[data-cinema2-control-id="corridor-pattern"] select, [data-cinema2-control-id="corridor-pattern"] [role="combobox"]')).toBeEnabled()
  await expect(inspector.locator('[data-cinema2-control-id="corridor-trigger"]')).toHaveCount(0)
  await change({'pattern-change':true,'auto-performance':true})
  await api('setMusic',{active:true,energy:.8,bass:.5,high:.31,build:.6,sectionBuild:true})
  await api('advanceBy',.75)
  await expect(inspector.locator('[data-cinema2-control-id="corridor-pattern"] select, [data-cinema2-control-id="corridor-pattern"] [role="combobox"]')).toBeDisabled()
  await expect(inspector.locator('[data-cinema2-control-id="corridor-bpm-sync"]').getByRole('switch')).toBeEnabled()
  await expect(inspector.locator('[data-live-policy="true"]').first()).toBeVisible()
  await inspector.screenshot({path:join(output,'inspector.png')})
  checks.push({name:'real Inspector shows the shared lock, trigger and live policy'})
  assert.deepEqual(errors,[])
  await writeFile(join(output,'review.json'),JSON.stringify({checks,errors},null,2))
  console.log(`Corridor production canvas passed ${checks.length} checks. Captures in ${output}`)
} finally {
  await browser?.close()
  await server.close()
}

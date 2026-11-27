#!/usr/bin/env node
/* global window, document */
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { chromium, expect } from '@playwright/test'
import { createServer } from 'vite'
import sharp from 'sharp'

const output = resolve('artifacts/cinema2-everywhere')
await mkdir(output, { recursive: true })
const server = await createServer({ server: { host: '127.0.0.1', port: 0, hmr: false }, logLevel: 'error' })
let browser
try {
  await server.listen()
  browser = await chromium.launch({ headless: true, args: ['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--use-angle=swiftshader'] })
  const page = await browser.newPage({ viewport: { width: 1024, height: 576 }, deviceScaleFactor: 1 })
  const errors = []
  page.on('pageerror', error => { errors.push(error.message); console.error(error.message) })
  page.on('console', message => {
    if (message.type() === 'error' && !/Failed to load resource|CONTEXT_LOST_WEBGL/.test(message.text())) errors.push(message.text())
  })
  const api = async (method, ...args) => {
    const status = await page.evaluate(([name, values]) => window.__everywhere[name](...values), [method, args])
    assert.equal(status.snapshot.phase, 'running', JSON.stringify(status.snapshot))
    assert.equal(status.modules.failedModuleCount, 0, JSON.stringify(status.modules))
    assert.equal(status.effects.failedEffectCount, 0, JSON.stringify(status.effects))
    return status
  }
  const inspection = status => status.modules.modules[0].inspection
  const url = `http://127.0.0.1:${server.httpServer.address().port}/src/test/browser/cinema2-submerge-production.html?preset=everywhere`
  const open = async (auto, panel = '') => {
    await page.goto(`${url}&auto=${auto ? 'on' : 'off'}${panel ? '&'+panel : ''}`)
    await page.waitForFunction(() => window.__everywhere, null, { timeout: 12000 })
    await api('prepare')
    await expect.poll(async () => {
      const state = inspection(await api('advanceBy', .05))
      return state.renderReady && state.eyeReady && state.screens === 46
    }).toBe(true)
    assert.equal(JSON.parse((await api('status')).authored).values['everywhere-auto-performance'], auto)
  }
  const capture = async name => {
    const buffer = await page.screenshot()
    if (name) await writeFile(join(output, `${name}.png`), buffer)
    return sharp(buffer).removeAlpha().raw().toBuffer()
  }
  const delta = (a, b) => {
    let total = 0
    for (let i=0; i<a.length; i++) total += Math.abs(a[i]-b[i])
    return total/a.length
  }
  const changed = (a, b, label, minimum = .025) => {
    const difference = delta(a, b)
    assert(difference > minimum, `${label} changed the frame by ${difference}`)
  }
  const change = patch => api('setParameters', patch)
  await open(true)
  await open(false)
  const baseline = await capture('everywhere')
  assert(baseline.some(value => value > 180), 'The picture should contain luminous CRTs.')
  // The new installation has deliberate dark gaps between individual CRTs.
  // Use an alternate environment color to distinguish those gaps from the
  // television geometry, and detect an excessively empty composition.
  await change({motion:0})
  for (const [width,height] of [[1024,576],[768,768],[450,800],[1536,432]]) {
    await page.setViewportSize({width,height})
    await api('resize',width,height)
    const normal=await capture(`coverage-${width}x${height}`)
    await change({background:[1,0,1,1]})
    const sentinel=await capture()
    let exposed=0
    for (let i=0;i<normal.length;i+=3) {
      if (Math.max(Math.abs(normal[i]-sentinel[i]),Math.abs(normal[i+1]-sentinel[i+1]),Math.abs(normal[i+2]-sentinel[i+2]))>30) exposed++
    }
    assert(exposed/(normal.length/3)<.60, `Excessive background at ${width}x${height}: ${exposed} pixels`)
    if(width===1024) assert(exposed/(normal.length/3)>.02, 'The wide wall should retain intentional negative space.')
    await change({background:[.012,.018,.023,1]})
  }
  await page.setViewportSize({width:1024,height:576})
  await api('resize',1024,576)
  await change({motion:.72})
  // Production-path checks for the reconstruction: actual cabinet angle and
  // camera motion must visibly change the scene; lowering screen power must
  // reduce its illumination. Captures are also inputs for human visual review.
  await change({motion:0,angle:.84,'camera-motion':false})
  const staged=await capture('installation-default')
  await change({angle:0})
  changed(staged,await capture('installation-front-facing'),'Cabinet orientations',.5)
  await change({angle:.84,'camera-distance':[1,0,1]})
  changed(staged,await capture('installation-parallax'),'Camera parallax',.5)
  await change({'camera-distance':[0,0,0],brightness:0})
  const dark=await capture('installation-screen-off')
  assert(dark.reduce((a,b)=>a+b,0)<staged.reduce((a,b)=>a+b,0),'Screen-off must darken the installation')
  await change({brightness:1.06,motion:.72,'camera-motion':true})
  const frames = [['all-eyes', baseline]]
  for (const pattern of ['signal-sweep','outward-pulse','cross-cut','channel-hold','ghost-feed','static-switch','retro-broadcast','tape-tracking','channel-mosaic','signal-relay','midnight-replay']) {
    await change({ pattern })
    const frame = await capture()
    for (const [other, previous] of frames) changed(frame, previous, `${pattern} / ${other}`)
    frames.push([pattern, frame])
  }

  await change({pattern:'all-eyes','pattern-change':true,trigger:'kick',motion:0})
  const kick = {active:true, event:'kick', eventId:81, frameId:81001}
  const triggered = inspection(await api('setMusic', kick)).activePattern
  assert.notEqual(triggered,'all-eyes')
  assert.equal(inspection(await api('setMusic', kick)).activePattern, triggered)
  assert.equal(inspection(await change({pattern:'cross-cut'})).activePattern,'cross-cut')
  assert.equal(inspection(await api('setMusic', kick)).activePattern,'cross-cut')

  await change({pattern:'all-eyes','pattern-change':false,'auto-performance':true,motion:.8})
  await api('setMusic',{ event:null, energy:.83,bass:.5,high:.25,build:.95,sectionBuild:true })
  const build = await api('advanceBy',.65)
  const charged = await capture('build')
  changed(baseline, charged, 'Music build')
  await api('setMusic',{ event:'drop',eventId:82,build:0,sectionBuild:false },.05)
  const drop = await api('advanceBy',.20)
  assert(inspection(drop).drop > .5, 'The drop envelope should reach the scene.')
  assert.equal(drop.authored,build.authored)
  changed(charged, await capture('drop'), 'Music drop')
  await api('setMusic',{ paused:true,event:null })
  const held = await capture()
  await api('advanceBy',.35)
  assert(delta(held, await capture()) < .03, 'Pause should hold the active picture.')
  assert.equal(inspection(await api('seek',8)).drop,0)
  await page.setViewportSize({ width:450,height:800 })
  await api('resize',450,800)
  assert((await capture('portrait')).some(value => value > 125), 'Portrait should retain bright picture content.')
  await api('restoreContext')
  await expect.poll(async () => inspection(await api('advanceBy', .05)).eyeReady).toBe(true)

  await page.setViewportSize({ width:1024,height:576 })
  await open(false, 'inspector')
  const inspector = page.locator('#everywhere-inspector')
  const control = id => inspector.locator(`[data-cinema2-control-id="everywhere-${id}"]`)
  await expect(control('pattern').locator('select, [role="combobox"]')).toBeEnabled()
  await expect(control('trigger')).toHaveCount(0)
  await expect(control('pool-trigger')).toHaveCount(0)
  const subgroup = label => inspector.getByRole('button', {name:label,exact:true})
  await expect(subgroup('Camera')).toHaveAttribute('aria-expanded','false')
  await expect(subgroup('CRT Finish')).toHaveAttribute('aria-expanded','false')
  await subgroup('Camera').focus()
  await subgroup('Camera').press('Enter')
  await expect(subgroup('Camera')).toBeFocused()
  await expect(control('camera-motion').getByRole('switch')).toBeChecked()
  await subgroup('CRT Finish').click()
  await expect(control('scan')).toBeVisible()
  const distance = control('camera-distance').locator('input[type=range]')
  await change({'camera-distance':[.5,-.3,1]})
  await expect(distance).toHaveValue('15')
  await distance.focus()
  await distance.press('ArrowRight')
  await expect.poll(async () => {
    const [x,y,z] = JSON.parse((await api('status')).authored).values['everywhere-camera-distance']
    return x === .5 && y === -.3 && Math.abs(z-1.1)<1e-6
  }).toBe(true)
  for (const group of ['Master Controls','Design','Effects','Palette']) {
    await expect(inspector.getByText(group,{exact:true})).toBeVisible()
  }
  await change({'pattern-change':true,'auto-performance':true})
  await api('setMusic',{active:true,energy:.8,bass:.5,high:.31,build:.6,sectionBuild:true})
  await api('advanceBy',.75)
  await expect(control('pattern').locator('select, [role="combobox"]')).toBeDisabled()
  await expect(control('trigger')).toHaveCount(1)
  await expect(control('bpm-sync').getByRole('switch')).toBeEnabled()
  await expect(distance).toBeDisabled()
  await expect(control('scan').locator('input')).toBeDisabled()
  await expect(subgroup('Camera')).toHaveAttribute('aria-expanded','true')
  await expect(subgroup('CRT Finish')).toHaveAttribute('aria-expanded','true')
  await inspector.screenshot({path:join(output,'inspector.png')})

  await open(false, 'source&inspector')
  const verifySourceInspector = async mode => {
    await inspector.evaluate(element => { element.style.display = 'flex' })
    await expect(subgroup('Screen Media')).toHaveAttribute('aria-expanded','true')
    await expect(control('brightness')).toBeVisible()
    await expect(control('screen-media')).toHaveCount(0)
    for (const id of ['media-layout','media-fit','content-motion','scale-variation','screen-power','hero-readability']) {
      await expect(control(id)).toHaveCount(mode==='eyes' ? 0 : 1)
    }
    await expect(control('pool-trigger')).toHaveCount(mode==='pool' ? 1 : 0)
    for (const width of [365,250]) {
      await inspector.evaluate((element,value) => { element.style.width = `${value}px` },width)
      const scroll = inspector.locator('.rv-inspector-scroll')
      await expect(scroll).toBeVisible()
      await scroll.evaluate(element => { element.scrollTop = element.scrollHeight })
      assert(await scroll.evaluate(element => element.scrollTop > 0), 'Inspector must scroll in its own rail')
      await scroll.evaluate(element => { element.scrollTop = 0 })
      await inspector.screenshot({path:join(output,`inspector-${mode}-${width}.png`)})
    }
    await inspector.evaluate(element => { element.style.width = '365px'; element.style.display = 'none' })
  }
  await verifySourceInspector('eyes')
  const library = page.locator('#everywhere-source')
  await expect(library.getByText('Media Library',{exact:true})).toBeVisible()
  const sourceCard = library.locator('[data-cinema2-active-source]')
  await expect(sourceCard.getByText('Default Eyes',{exact:true})).toBeVisible()
  await library.getByText('CRT test image',{exact:true}).first().click()
  await page.getByRole('menuitem',{name:'Make Active'}).click()
  await expect.poll(async () => (await api('status')).media.slots[0].source?.id).toBe('crt-test-image')
  await expect.poll(async () => inspection(await api('advanceBy',.05)).userMedia).toBe(true)
  await verifySourceInspector('single')
  await library.screenshot({path:join(output,'source.png')})
  await library.evaluate(element => { element.style.display = 'none' })
  const choreographed = await capture('media-choreographed')
  await change({'media-layout':'repeat'})
  const repeated = await capture('media-repeat')
  changed(choreographed,repeated,'Choreographed / Repeat layouts')
  changed(baseline,repeated,'Shared Source feed',1)
  await change({'media-layout':'wall'})
  changed(repeated,await capture('media-wall'),'Repeat / Wall media layouts',1)
  await library.evaluate(element => { element.style.display = '' })
  await library.getByRole('button',{name:'Source actions'}).click()
  await page.getByRole('menuitem',{name:'Restore Default Eyes'}).click()
  await expect(sourceCard.getByText('Default Eyes',{exact:true})).toBeVisible()
  assert.equal(inspection(await api('advanceBy',.05)).sourceMode,'eyes')
  await library.getByText('CRT pool image',{exact:true}).first().click()
  await page.getByRole('menuitem',{name:'Make Active'}).click()
  await expect.poll(async () => inspection(await api('advanceBy',.05)).userMedia).toBe(true)
  await expect(sourceCard.getByText('CRT pool image',{exact:true})).toBeVisible()
  await library.getByRole('button',{name:'Pools',exact:true}).click()
  await library.getByRole('textbox',{name:'New pool name'}).fill('CRT Review Pool')
  await library.getByRole('button',{name:'Create pool',exact:true}).click()
  await library.getByRole('button',{name:'All',exact:true}).click()
  for (const name of ['CRT test image','CRT pool image']) {
    await library.locator('.rv-canvas-library-shell').getByText(name,{exact:true}).first().click()
    await page.getByRole('menuitem',{name:'Add to Pool'}).click()
    await page.locator('.vz-add-to-picker__option').filter({hasText:'CRT Review Pool'}).click()
  }
  await library.getByRole('button',{name:'Pools',exact:true}).click()
  await library.getByRole('button',{name:'Activate pool CRT Review Pool'}).click()
  assert.equal((await api('status')).media.slots[0].source,null)
  assert.equal(inspection(await api('advanceBy',.05)).sourceMode,'pool')
  await verifySourceInspector('pool')
  await change({pattern:'static-switch','media-layout':'repeat','pool-trigger':'kick',motion:.8})
  await api('setMusic',{active:true,event:null})
  await expect.poll(async () => inspection(await api('advanceBy',.05)).poolReadyChannels).toBe(2)
  await library.evaluate(element => { element.style.display = 'none' })
  const poolBefore = await capture('pool-static-switch')
  await api('setMusic',{active:true,event:'kick',eventId:93,frameId:93001})
  await expect.poll(async () => inspection(await api('advanceBy',.05)).poolStep).toBe(1)
  changed(poolBefore,await capture('pool-channel-change'),'Pool channel change')
  await library.evaluate(element => { element.style.display = '' })
  await library.getByRole('button',{name:'Source actions'}).click()
  await page.getByRole('menuitem',{name:'Restore Default Eyes'}).click()
  await expect.poll(async () => inspection(await api('advanceBy',.05)).poolReadyChannels).toBe(0)
  assert.equal((await api('status')).media.slots[0].source,null)
  assert.equal(inspection(await api('advanceBy',.05)).sourceMode,'eyes')
  await library.getByRole('button',{name:'All',exact:true}).click()
  await library.getByText('CRT test image',{exact:true}).first().click()
  await page.getByRole('menuitem',{name:'Make Active'}).click()
  await expect.poll(async()=>inspection(await api('advanceBy',.05)).sourceMode).toBe('single')
  const authoredBeforeReset = (await api('status')).authored
  await library.getByRole('button',{name:'Source actions'}).click()
  await page.getByRole('menuitem',{name:'Restore Default Eyes'}).click()
  await expect(library.locator('[data-cinema2-active-source]').getByText('Default Eyes',{exact:true})).toBeVisible()
  assert.equal((await api('status')).authored,authoredBeforeReset)
  await verifySourceInspector('eyes')
  assert.equal((await api('status')).media.slots[0].source,null)
  assert.equal(inspection(await api('advanceBy',.05)).sourceMode,'eyes')
  assert.deepEqual(errors,[])
  console.log(`EVERYWHERE production WebGL, twelve patterns, audio, Inspector, Source and shared pools passed. Captures in ${output}`)
} finally {
  await browser?.close()
  await server.close()
}

/* global window */
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, writeFile, readFile, readdir, unlink } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from '@playwright/test'
import sharp from 'sharp'

const output = path.resolve('artifacts/cinema2-ifrit/acceptance')
const port = 48000 + process.pid % 1000
const url = `http://127.0.0.1:${port}/src/test/browser/cinema2-ifrit-production.html`
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] })
let serverLog = '', browser
server.stdout.on('data', value => { serverLog += value })
server.stderr.on('data', value => { serverLog += value })
const report = [], errors = []

function measure(data, width, height, channels) {
  let orange = 0, red = 0, centerLit = 0, centerPixels = 0
  const quadrants = [0, 0, 0, 0]
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * channels
    const r = data[i], g = data[i + 1], b = data[i + 2]
    const hero = r > 90 && g > 20 && r > g * 1.5 && b < 30
    if (hero) {
      orange++
      quadrants[(y >= height / 2 ? 2 : 0) + (x >= width / 2 ? 1 : 0)]++
    }
    if (r > 12 && r > g * 4 && g < 20 && b < 15) red++
    if (Math.hypot(x - width / 2, y - height / 2) < Math.min(width, height) * 0.055) {
      centerPixels++
      if (Math.max(r, g, b) > 10) centerLit++
    }
  }
  assert(orange > width * height * 0.008, 'Actual orange portal geometry must be legible')
  assert(orange < width * height * 0.2, 'Negative space must dominate without bloom')
  assert(red > width * height * .12 && red < width * height * .65, 'Layered red structure must retain reference-scale visual coverage and negative space')
  assert(quadrants.every(count => count > orange * 0.1), 'Portal geometry must surround the centered opening')
  assert(centerLit / centerPixels < 0.01, 'Central aperture must remain dark and open')
  const cx = Math.floor(width / 2), cy = Math.floor(height / 2)
  const portal = (x, y) => {
    const i = (y * width + x) * channels
    return data[i] > 45 && data[i + 1] > 20 && data[i] > data[i + 1] * 1.5 && data[i + 2] < 30
  }
  const ray = (dx, dy) => {
    for (let d = 1; d < Math.min(width, height) / 2; d++) {
      if (portal(cx + dx * d, cy + dy * d)) return d
    }
    assert.fail('The aperture must be enclosed by actual portal contours in all four directions')
  }
  const aperture = { left: ray(-1, 0), right: ray(1, 0), top: ray(0, -1), bottom: ray(0, 1) }
  assert(Math.abs(aperture.left - aperture.right) <= 2, 'Aperture must remain horizontally centered')
  assert(Math.abs(aperture.top - aperture.bottom) <= 2, 'Aperture must remain vertically centered')
  const short = Math.min(width, height)
  const apertureX = (aperture.left + aperture.right) / (2 * short)
  const apertureY = (aperture.top + aperture.bottom) / (2 * short)
  assert(apertureX > 0.15 && apertureX < 0.23, 'Distant opening must retain its approved short-axis scale')
  assert(apertureY / apertureX > 1.08 && apertureY / apertureX < 1.22, 'Hexagonal aperture must not stretch on resize')
  const borderCount = (vertical, edge) => {
    let count = 0
    for (let n = 0; n < (vertical ? height : width); n++) {
      if (portal(vertical ? edge : n, vertical ? n : edge)) count++
    }
    return count
  }
  const foregroundEdges = width < height
    ? [borderCount(true, 0), borderCount(true, width - 1)]
    : [borderCount(false, 0), borderCount(false, height - 1)]
  assert(foregroundEdges.every(count => count >= 2), 'Foreground frames must retain intentional short-axis clipping')
  return { orange, red, quadrants, centerLit, centerPixels, aperture, apertureX, apertureY, foregroundEdges }
}

try {
  await mkdir(output, { recursive: true })
  let ready = false
  for (let attempt = 0; attempt < 150; attempt++) {
    if (server.exitCode != null) throw new Error(serverLog)
    try { if ((await fetch(url)).ok) { ready = true; break } } catch { /* startup */ }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert(ready, serverLog || 'Ifrit review server did not start')
  browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl'] })
  const page = await browser.newPage({ viewport: { width: 712, height: 1006 }, deviceScaleFactor: 1 })
  page.on('pageerror', error => errors.push(String(error)))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto(url)
  await page.waitForFunction(() => !!window.__ifritProduction).catch(error => {
    throw new Error(`${error.message}\nBrowser errors: ${errors.join('\n')}`)
  })
  const api = (method,...args) => page.evaluate(({method,args}) => window.__ifritProduction[method](...args), {method,args})
  const raw = async () => sharp(await page.screenshot()).raw().toBuffer()
  const change = (a,b) => { assert.equal(a.length,b.length);let sum=0;for(let i=0;i<a.length;i++)sum+=Math.abs(a[i]-b[i]);return sum/a.length }
  const regionChange = (a,b,predicate) => {
    let sum=0,count=0
    for(let y=0;y<720;y++) for(let x=0;x<720;x++) if(predicate(x,y)) {
      const i=(y*720+x)*3
      sum+=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]);count+=3
    }
    return sum/Math.max(1,count)
  }
  const parameter = (state,key) => state.parameters.persistentValues[`ifrit-${key}`]
  const clean = async (extra={}) => { await api('reset');await api('set',{travel:0,rotation:0,twist:0,bloom:0,reactivity:0,...extra}) }
  if(process.argv.includes('--real-audio')) {
    const audio=await readFile(path.resolve('artifacts/cinema2-ifrit/reference-audio.wav'))
    await page.setViewportSize({width:360,height:508})
    await api('reset')
    await api('playAudio',audio.toString('base64'))
    const samples=[]
    for(let i=0;i<16;i++) {
      await new Promise(resolve=>setTimeout(resolve,1000))
      const state=await api('status')
      assert.equal(state.modules.failedModuleCount,0);assert.equal(state.render.failedPassCount,0)
      samples.push({time:state.transport.timeSec,phase:state.snapshot.phase,channels:state.channels,audio:state.audio,director:state.director})
      await page.screenshot({path:path.join(output,`real-audio-${String(i).padStart(2,'0')}.png`)})
      const evidence=await api('audioEvidence')
      if(state.transport.timeSec>=evidence.duration-.1) break
    }
    const evidence=await api('audioEvidence')
    await writeFile(path.join(output,'real-audio-report.json'),JSON.stringify({samples,evidence,errors},null,2))
    assert(samples.every(s=>s.phase==='running'),`Real audio renderer must stay running: ${samples.map(s=>s.phase)}`)
    assert(evidence.peaks.energy>.01,'Real reference audio must reach resolved continuous channels')
    assert(evidence.peaks.bass>.01,'Real reference bass must reach the preset')
    if(evidence.events.some(e=>e.kind==='kick')) assert(evidence.peaks.kickMiddle>.01 && evidence.peaks.kickFar>.01,'Actual ungridded kicks must execute the delayed depth wave')
    if(evidence.events.some(e=>e.kind==='snare')) assert(evidence.peaks.snareRight>.01,'Actual ungridded snare must execute the delayed second bank')
    await api('stopAudio');await api('dispose')
    assert.deepEqual(errors,[])
    await writeFile(path.join(output,'real-audio-report.json'),JSON.stringify({samples,evidence,errors},null,2))
    console.log(`Ifrit real reference soundtrack analysis/playback passed: ${output}`)
  } else if(process.argv.includes('--preview-only')) {
    const frames=path.join(output,'preview-frames')
    await mkdir(frames,{recursive:true})
    for(const file of await readdir(frames)) if(/^\d{3}\.png$/.test(file)) await unlink(path.join(frames,file))
    await page.setViewportSize({width:600,height:848})
    await api('reset')
    await api('music',{timeSec:0,energy:.65,bass:.6,high:.3})
    const performancePreview=process.argv.includes('--performance-preview')
    if(performancePreview) await api('set',{'auto-performance':true})
    for(let i=0;i<(performancePreview?60:36);i++) {
      if(performancePreview) {
        const time=i/12,build=time<2?time/2:0
        const event=i===24?'drop':[3,9,15,33,45,54].includes(i)?'kick':[6,18,30,42].includes(i)?'snare':null
        await api('music',{timeSec:time,energy:time<2?.35+time*.2:.85,bass:.6,high:.4,build,sectionBuild:time<2,sectionStart:0,event,eventId:i+100})
      }
      await api('advance',1/12)
      await page.screenshot({path:path.join(frames,`${String(i).padStart(3,'0')}.png`)})
    }
    console.log(`Ifrit deterministic musical preview captured: ${frames}`)
  } else {
  await clean()
  if(!process.argv.includes('--score-only')) {
  let referencePixels
  for (const [name, width, height] of [
    ['reference', 712, 1006], ['landscape', 1280, 720], ['square', 800, 800],
    ['portrait-9x16', 720, 1280], ['ultrawide-21x9', 1680, 720], ['reference-restored', 712, 1006],
  ]) {
    await page.setViewportSize({ width, height })
    const state = await api('prepare')
    assert.equal(state.modules.failedModuleCount, 0)
    assert.equal(state.modules.activeModuleCount, 1)
    assert.equal(state.render.failedPassCount, 0)
    const camera = state.camera.camera
    assert.deepEqual(camera.position, [0, 0, 0])
    assert.deepEqual(camera.target, [0, 0, -10])
    assert.equal(camera.rig, 'static')
    assert.equal(camera.rollDegrees, 0)
    assert.equal(camera.near, 0.1)
    assert.equal(camera.far, 30)
    assert(Math.abs(camera.aspect - width / height) < 1e-8)
    assert(Math.abs(camera.fovDegrees - (width >= height ? 70 : 2 * Math.atan(Math.tan(35 * Math.PI / 180) * height / width) * 180 / Math.PI)) < 1e-6,
      'Shared camera must preserve short-axis framing in portrait')
    const capture = await page.screenshot({ path: path.join(output, `${name}.png`) })
    const { data, info } = await sharp(capture).raw().toBuffer({ resolveWithObject: true })
    const metrics = measure(data, width, height, info.channels)
    if (report.length) {
      assert(Math.abs(metrics.apertureX - report[0].apertureX) < 0.004, 'Aperture width must retain scale across aspects')
      assert(Math.abs(metrics.apertureY - report[0].apertureY) < 0.004, 'Aperture height must retain scale across aspects')
    }
    if (name === 'reference') referencePixels = data
    if (name === 'reference-restored') assert(data.equals(referencePixels), 'Resize round trip must restore approved framing exactly')
    report.push({ name, width, height, ...metrics, state })
    await api('prepare')
    const later = await page.screenshot()
    const laterPixels = await sharp(later).raw().toBuffer()
    assert(data.equals(laterPixels), 'Static baseline must not acquire time-dependent motion')
  }
  // Complete manual, musical and authority checks use the production Inspector/runtime.
  await page.setViewportSize({width:720,height:720})
  await api('music',{timeSec:0,energy:0})
  const patterns=['infernalPassage','twistedDescent','counterfire','compressionChamber','emberRelay','riftLock']
  const patternLabels=['Infernal Passage','Twisted Descent','Counterfire','Compression Chamber','Ember Relay','Rift Lock']
  const gallery=[]
  for(const pattern of patterns) {
    await clean({pattern,twist:0.65})
    const image=await raw()
    for(const other of gallery) assert(change(image,other)>0.04,`${pattern} must have distinct native output`)
    gallery.push(image)
    await page.screenshot({path:path.join(output,`pattern-${pattern}.png`)})
  }
  const controls={intensity:[0,1,1],count:[3,5,12],aperture:[0.8,1,1.2],spacing:[0.75,1,1.4],thickness:[0.5,1,2],twist:[0,0.45,1],detail:[0,1,1],bloom:[0,0.28,0.65]}
  for(const [control,values] of Object.entries(controls)) {
    await clean()
    const images=[]
    for(const [index,value] of values.entries()) {
      await api('set',{[control]:value})
      images.push(await raw())
      await page.screenshot({path:path.join(output,`control-${control}-${['min','default','max'][index]}.png`)})
    }
    const delta=change(images[0],images[2])
    assert(delta>0.025,`${control} must visibly affect its intended output`)
    report.push({control,delta})
  }
  // Independent Palette roles: editing one color cannot rewrite the others.
  for(const color of ['background','portal','wall','corner']) {
    await clean()
    const before=await raw(), state=await api('set',{[color]:[0.05,0.4,1,1]})
    assert(change(before,await raw())>0.015,`${color} must have a visible, independent consumer`)
    for(const other of ['background','portal','wall','corner'].filter(v=>v!==color)) assert.deepEqual(parameter(state,other),({background:[.001,0,0,1],portal:[1,.46,.004,1],wall:[.65,.006,.002,1],corner:[1,.57,.015,1]})[other])
  }
  for(const control of ['travel','rotation']) {
    for(const value of control==='travel'?[0,.6,2]:[-1,.15,1]) {
      await api('music',{timeSec:0,energy:0})
      await api('reenter',false)
      await clean({[control]:value})
      const before=await raw();await api('advance',.45)
      const delta=change(before,await raw())
      if(value===0) assert(delta<.001,`${control} zero must hold phase`)
      else assert(delta>.03,`${control} must visibly move the tunnel`)
      report.push({motion:control,value,delta})
    }
  }
  const timing=[]
  for(const sync of [true,false]) {
    await api('music',{timeSec:0,energy:0,featuresAvailable:false,bpm:70})
    await api('reenter',false)
    await clean({travel:1,'bpm-sync':sync})
    await api('advance',.7,{bpm:70})
    timing.push(await raw())
  }
  assert(change(timing[0],timing[1])>.05,'BPM Sync must govern real motion even when host Sync is OFF')
  // Real shared typography/conditional Inspector, including portaled dropdowns.
  await page.setViewportSize({width:1280,height:1000})
  await api('showInspector',true)
  await api('set',{'pattern-change':false})
  assert.equal(await page.locator('[data-cinema2-control-id="ifrit-trigger"]').count(),0)
  await page.screenshot({path:path.join(output,'inspector.png')})
  await api('set',{'pattern-change':true})
  await page.locator('[data-cinema2-control-id="ifrit-trigger"]').getByRole('combobox').click()
  await page.getByRole('option').first().waitFor({state:'visible'})
  assert.deepEqual(await page.getByRole('option').allTextContents(),['Beat','Kick','Snare','Downbeat','Every 2 Beats','Every 4 Beats','Bar','Every 4 Bars','Every 8 Bars','Phrase','Drop'])
  await page.screenshot({path:path.join(output,'trigger-menu.png')})
  await page.getByRole('option',{name:'Kick',exact:true}).click()
  await page.locator('[data-cinema2-control-id="ifrit-pattern"]').getByRole('combobox').click()
  await page.getByRole('option').first().waitFor({state:'visible'})
  assert.deepEqual(await page.getByRole('option').allTextContents(),patternLabels)
  await page.getByRole('option',{name:'Counterfire',exact:true}).click()
  assert.equal(parameter(await api('status'),'pattern-change'),true)
  await api('showInspector',false)
  await page.setViewportSize({width:720,height:720})
  for(const trigger of ['beat','kick','snare','downbeat','beat2','beat4','bar','bar4','bar8','phrase','drop']) {
    await clean({'pattern-change':true,trigger,twist:.65})
    await api('music',{timeSec:0,event:null,energy:0})
    const before=await raw()
    const event=['beat2','beat4'].includes(trigger)?'beat':['bar4','bar8'].includes(trigger)?'bar':trigger
    await api('music',{timeSec:.1,event,eventId:64,beatIndex:64,energy:0})
    await api('advance',.22)
    const after=await raw()
    assert(change(before,after)>.03,`${trigger} must advance visible native patterns`)
    await api('set',{pattern:'twistedDescent','pattern-change':false})
    assert(change(after,await raw())<.001,`${trigger} advances to the correct next native pattern`)
    await api('set',{'pattern-change':true,pattern:'counterfire'})
    const manual=await raw()
    assert.equal(parameter(await api('status'),'pattern-change'),true)
    await api('repeatMusic')
    assert(change(manual,await raw())<.001,`${trigger} duplicate cannot undo a manual edit`)
    await api('music',{timeSec:.6,event,eventId:128,beatIndex:128,energy:0})
    await api('advance',.22)
    const advanced=await raw()
    await api('set',{pattern:'compressionChamber','pattern-change':false})
    assert(change(advanced,await raw())<.001,`${trigger} resumes on the next fresh event`)
  }
  await clean({twist:.65,'pattern-change':false,trigger:'kick'})
  await api('music',{timeSec:0,energy:0,event:null})
  const held=await raw()
  await api('music',{timeSec:.1,energy:0,event:'kick',eventId:901})
  assert(change(held,await raw())<.001,'Pattern Change OFF must ignore a fresh selected Trigger')
  }
  await page.setViewportSize({width:720,height:720})
  // Rendered morphing, not merely a changed enum or an unused transition value.
  await clean({twist:.7,'pattern-change':true,trigger:'beat'})
  await api('music',{timeSec:0,energy:0,event:null})
  const transitionBefore=await raw()
  await api('music',{timeSec:.1,energy:0,event:'beat',eventId:22,beatIndex:22})
  await api('advance',.09)
  const transitionDuring=await raw()
  await api('advance',.13)
  const transitionAfter=await raw()
  assert(change(transitionDuring,transitionBefore)>.02 && change(transitionDuring,transitionAfter)>.02,'Intermediate pattern geometry must be rendered')
  // Spatial score evidence: a delayed kick wave must reach depth groups in order.
  await clean({reactivity:1,twist:0})
  await api('music',{timeSec:0,energy:0,sectionIntensity:0,event:null})
  await api('advance',.6)
  const spatialBase=await raw()
  await api('music',{timeSec:.7,energy:0,sectionIntensity:0,event:'kick',eventId:922,beatIndex:8})
  const early=await api('advance',.04)
  const earlyPixels=await raw()
  assert(early.channels.kickNear>.2 && early.channels.kickFar<.01,'Kick must start at the near group')
  let late=early
  for(let i=0;i<8&&late.channels.kickFar<=.2;i++) late=await api('advance',.05)
  const latePixels=await raw()
  assert(late.channels.kickFar>.2,`Shared delayed score must reach far rings: ${JSON.stringify(late.channels)}`)
  const farRegion=(x,y)=>Math.hypot(x-360,y-360)<720*.28
  assert(regionChange(spatialBase,latePixels,farRegion)>regionChange(spatialBase,earlyPixels,farRegion)+.01,'Delayed kick must alter actual far-ring pixels')
  report.push({spatialKick:{early:early.channels,late:late.channels}})
  // Side banks must react independently, with actual left/right pixel evidence.
  await api('music',{timeSec:0,energy:0,sectionIntensity:0,event:null});await api('advance',.7)
  const bankBase=await raw()
  await api('music',{timeSec:.8,energy:0,sectionIntensity:0,event:'snare',eventId:933,beatIndex:8})
  const bank=await api('advance',.04)
  const bankPixels=await raw()
  assert((bank.channels.snareLeft>.2)!==(bank.channels.snareRight>.2),'A gridded snare must authorize exactly one wall bank')
  const left=regionChange(bankBase,bankPixels,(x)=>x<180),right=regionChange(bankBase,bankPixels,(x)=>x>540)
  assert(bank.channels.snareLeft>.2?left>right*1.2:right>left*1.2,'Shared half-bar bank must accent the corresponding wall rather than brighten the whole canvas')
  report.push({spatialSnare:{left,right}})
  const response=[]
  for(const reactivity of [0,.65,1]) {
    await api('music',{timeSec:0,energy:0,bass:0,build:0})
    await api('reenter',false)
    await clean({reactivity})
    await api('music',{timeSec:.1,energy:1,bass:1,high:1,build:.7})
    await api('advance',.6)
    response.push(await raw())
  }
  assert(change(response[0],response[1])>.03 && change(response[1],response[2])>.01,'Music Reactivity min/default/max must have perceptible output differences')
  // Shared Audio Intelligence -> resolved choreography -> separate visual regions.
  await clean({reactivity:1,twist:.5})
  await api('music',{timeSec:0,energy:0,bass:0,high:0,vocal:0,build:0})
  await api('advance',.5)
  const quiet=await raw()
  await api('music',{timeSec:.6,energy:1,bass:1,high:1})
  const energetic=await api('advance',.5)
  assert(energetic.channels.energy>.5 && energetic.channels.bass>.5)
  assert(change(quiet,await raw())>.03,'Continuous music must change visible geometry and light')
  const full=await raw()
  await api('music',{timeSec:1.2,energy:1,bass:1,high:1,vocal:1})
  const vocal=await api('advance',.6)
  assert(vocal.channels.vocal>.5)
  assert(change(full,await raw())>.01,'Vocal restraint must visibly reduce wall activity')
  for(const event of ['kick','snare','drop']) {
    await api('music',{timeSec:2,energy:0,event:null});await api('advance',.6)
    const before=await raw()
    await api('music',{timeSec:2.65,energy:0,event,eventId:100})
    const state=await api('advance',.035)
    assert(state.channels[event]>.05,`${event} shared envelope resolves`)
    assert(change(before,await raw())>.01,`${event} has a perceptible native response`)
    await api('advance',.8)
    assert((await api('status')).channels[event]<.01,`${event} returns to authored base`)
  }
  await api('music',{timeSec:0,energy:0,build:0});await api('advance',.6)
  const beforeBuild=await raw()
  await api('music',{timeSec:.7,energy:0,build:1,sectionBuild:true})
  const build=await api('advance',.6)
  assert(build.channels.build>.3 && build.channels.directorBuild>0)
  assert(change(beforeBuild,await raw())>.03,'Build tension must compress the actual corridor')
  await clean({reactivity:0,twist:.65,'auto-performance':true,'pattern-change':true,trigger:'beat'})
  await api('music',{timeSec:0,energy:0})
  const base=await raw()
  await api('music',{timeSec:.1,sectionBuild:true,sectionStart:.1,energy:0})
  await api('advance',.22)
  const overridden=await raw()
  assert(change(base,overridden)>.03,'Fresh build authorizes a temporary performance pattern')
  await api('music',{timeSec:.4,sectionBuild:true,sectionStart:.1,event:'beat',eventId:1,beatIndex:1,energy:0})
  await api('music',{timeSec:.5,sectionBuild:true,sectionStart:.1,event:'beat',eventId:2,beatIndex:2,energy:0})
  assert(change(overridden,await raw())<.001,'Underlying progression cannot disturb the temporary override')
  await api('music',{timeSec:.6,sectionBuild:false,energy:0})
  await api('advance',.22)
  const restored=await raw()
  await api('set',{pattern:'counterfire','pattern-change':false})
  assert(change(restored,await raw())<.001,'Override restores the correctly advanced underlying pattern')
  await api('set',{'pattern-change':true})
  await api('music',{timeSec:.9,sectionBuild:true,sectionStart:.9,energy:0})
  await api('set',{pattern:'emberRelay'})
  const manual=await raw();await api('repeatMusic')
  assert(change(manual,await raw())<.001,'Active build cannot steal manual Pattern selection')
  assert.equal(parameter(await api('status'),'pattern-change'),true)
  await api('music',{timeSec:1,event:'drop',eventId:301,energy:0})
  await api('advance',.22)
  assert(change(manual,await raw())>.03,'Fresh drop may authorize another bounded override')
  await api('advance',0,{paused:true})
  await api('set',{'auto-performance':false})
  assert(change(manual,await raw())<.001,'Paused Auto Performance OFF restores manual base immediately')
  // Runtime phase must freeze/resume, and reset deterministically on discontinuity.
  await clean({travel:.6,rotation:.15})
  await api('music',{timeSec:0,featuresAvailable:false,energy:0})
  await api('advance',.4)
  await api('advance',.1,{paused:true})
  const paused=await raw();await api('advance',.4,{paused:true})
  assert(change(paused,await raw())<.001,'Pause holds tunnel motion')
  await api('advance',.4,{paused:false})
  assert(change(paused,await raw())>.03,'Resume moves the tunnel')
  for(const input of [{timeSec:.1},{timeSec:0},{timeSec:0,trackId:'replacement-track'},{timeSec:0,revision:'new-analysis'}]) {
    const state=await api('music',{...input,featuresAvailable:false,energy:0})
    assert.equal(state.modules.failedModuleCount,0);assert.equal(state.render.failedPassCount,0)
  }
  // Replay equivalence after changing energy history: no current-rate * time reconstruction.
  await api('music',{timeSec:0,energy:0,featuresAvailable:false,bpm:120})
  await api('reenter',false)
  await clean({travel:.6,rotation:.15})
  await api('advance',.5)
  await api('music',{timeSec:.5,energy:1,featuresAvailable:false,bpm:120})
  const playedState=await api('advance',.5)
  const played=await raw(),position=playedState.transport.timeSec
  await api('music',{timeSec:.2,energy:0,featuresAvailable:false,bpm:120})
  await api('music',{timeSec:position,energy:1,featuresAvailable:false,bpm:120})
  assert(change(played,await raw())<.01,'Seeking must reconstruct the played geometry despite different prior energy history')
  await api('reenter',true)
  assert(change(played,await raw())<.01,'Re-entry must reconstruct the same canonical geometry')
  await api('music',{timeSec:0,energy:0,featuresAvailable:false})
  await api('reenter',false)
  await clean({travel:.6,'bpm-sync':false})
  const wrapTime=(2.4+.8)/(2*.6*2.3)
  await api('music',{timeSec:wrapTime-.001,energy:0,featuresAvailable:false})
  const beforeWrap=await raw()
  await api('music',{timeSec:wrapTime+.001,energy:0,featuresAvailable:false})
  const afterWrap=await raw()
  assert(regionChange(beforeWrap,afterWrap,(x,y)=>Math.hypot(x-360,y-360)<720*.22)<.05,'Recycled portals must fade from zero at the far end without a visible center pop')
  // No-track behavior is deliberately subtler than an active musical performance.
  await api('music',{timeSec:0},false);await api('reenter',false)
  await api('set',{bloom:0})
  const idleBefore=await raw();await api('advance',.5)
  assert(change(idleBefore,await raw())>.01,'No-track ambient travel must be visible')
  await clean({intensity:0,bloom:.65})
  const dark=await raw()
  assert(dark.every(v=>v<=1),'Master zero must extinguish all geometry and bloom')
  await api('music',{timeSec:0,energy:0})
  await clean()
  // Quality tiers keep hero geometry and controls while the engine manages targets.
  const low=await api('reenter',true,'low')
  assert.equal(low.current.modules.failedModuleCount,0)
  assert.equal(low.current.render.failedPassCount,0)
  assert.equal(low.current.effects.failedEffectCount,0)
  await page.screenshot({path:path.join(output,'low-quality.png')})
  await api('reenter',true,'high')
  const before = await page.screenshot()
  const reentry = await api('reenter',true)
  assert.equal(reentry.retired.snapshot.phase, 'disposed')
  assert.equal(reentry.current.modules.failedModuleCount, 0)
  assert.equal(reentry.current.modules.activeModuleCount, 1)
  assert.equal(reentry.current.render.failedPassCount, 0)
  assert(before.equals(await page.screenshot()), 'Re-entry must reconstruct the same static composition')
  const disposed = await api('dispose')
  assert.equal(disposed.snapshot.phase, 'disposed')
  assert.equal(disposed.snapshot.resources.activeWebGLContextCount, 0)
  assert.equal(disposed.snapshot.resources.activeAnimationFrameCount, 0)
  assert.deepEqual(errors, [])
  await writeFile(path.join(output, process.argv.includes('--score-only')?'report-score.json':'report.json'), JSON.stringify({ report, reentry, disposed, errors }, null, 2))
  const scope=process.argv.includes('--score-only')?'spatial score, visible transitions, authority, reconstruction, recycling and lifecycle':'controls, six patterns, canonical triggers, sync, spatial audio, Director, authority, effects, framing and lifecycle'
  console.log(`Ifrit acceptance passed: ${scope}. Captures: ${output}`)
  }
} finally {
  await browser?.close()
  server.kill('SIGTERM')
}

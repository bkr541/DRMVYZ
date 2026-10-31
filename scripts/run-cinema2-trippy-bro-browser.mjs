/* global window, document */
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from '@playwright/test'
import sharp from 'sharp'
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = '1'

// A focused real-runtime check; no repository build or unrelated acceptance suite.
const output = path.resolve('artifacts/cinema2-trippy-bro/acceptance')
const port = 48000 + process.pid % 1000
const url = `http://127.0.0.1:${port}/src/test/browser/cinema2-trippy-bro-production.html`
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] })
let serverLog = ''
server.stdout.on('data', value => { serverLog += value })
server.stderr.on('data', value => { serverLog += value })
let browser

function measure(data, width, height, channels) {
  let count = 0
  let central = 0
  const edgeCounts = { left: 0, right: 0, top: 0, bottom: 0 }
  let minX = width, minY = height, maxX = -1, maxY = -1
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * channels
    if (Math.max(data[i], data[i + 1], data[i + 2]) < 35) continue
    count++
    if (x === 0) edgeCounts.left++
    if (x === width - 1) edgeCounts.right++
    if (y === 0) edgeCounts.top++
    if (y === height - 1) edgeCounts.bottom++
    if (Math.hypot(x - width / 2, y - height / 2) < Math.min(width, height) * 0.09) central++
    minX = Math.min(minX, x); maxX = Math.max(maxX, x)
    minY = Math.min(minY, y); maxY = Math.max(maxY, y)
  }
  const short = Math.min(width, height)
  assert(count > short * short * 0.025 && count < width * height * 0.45, 'Hero must have legible strokes and substantial negative space')
  assert(central > 100, 'Central prism/lattice region must be visible')
  assert(Math.abs((minX + maxX + 1) / 2 - width / 2) <= 1, 'Hero must stay horizontally centered')
  assert(Math.abs((minY + maxY + 1) / 2 - height / 2) <= 1, 'Hero must stay vertically centered')
  for (const [edge, pixels] of Object.entries(edgeCounts)) {
    assert(pixels >= 8, `Visible geometry must cross the ${edge} canvas edge`)
  }
  // The magenta top edge of the center jewel crosses this off-center column.
  // Measure actual raster thickness so framing changes cannot hide hairline strokes.
  const span = Math.max(width, height) * 1.65
  const sampleX = Math.round(width / 2 + 0.095 * span * 0.25)
  const sampleY = Math.round(height / 2 - 0.095 * span * 0.25)
  let jewelStrokePixels = 0
  for (let y = sampleY - 10; y <= sampleY + 10; y++) {
    const i = (y * width + sampleX) * channels
    if (data[i] > 150 && data[i + 2] > 70 && data[i] > data[i + 1] * 1.15) jewelStrokePixels++
  }
  assert(jewelStrokePixels >= 7, 'Jewel contour must have substantial visible thickness')
  return { count, central, edgeCounts, jewelStrokePixels, bounds: { minX, minY, maxX, maxY } }
}

try {
  await mkdir(output, { recursive: true })
  let ready = false
  for (let attempt = 0; attempt < 150; attempt++) {
    if (server.exitCode != null) throw new Error(serverLog)
    try { if ((await fetch(url)).ok) { ready = true; break } } catch { /* server starting */ }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert(ready, `Vite did not start: ${serverLog}`)
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) })
  const page = await browser.newPage({ viewport: { width: 954, height: 954 }, deviceScaleFactor: 1 })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error' && !message.text().includes('favicon.ico')) errors.push(message.text()) })
  await page.goto(url)
  await page.waitForFunction(() => Boolean(window.__trippyBroProduction))
  const api = (method, ...args) => page.evaluate(({ method, args }) => window.__trippyBroProduction[method](...args), { method, args })
  const raw = async () => sharp(Buffer.from((await api('capture')).split(',')[1],'base64')).removeAlpha().raw().toBuffer()
  const change = (a,b) => { let total=0; for(let i=0;i<a.length;i++) total+=Math.abs(a[i]-b[i]); return total/a.length }
  const report = []
  if(!process.argv.includes('--music-only') && !process.argv.includes('--authority-only')) {
  const patterns = ['prismLattice','goldenFold','quadBloom','neonCross','liquidWeave','orbitalLace','prismEcho','chromaticKnot']
  const captures = []
  for(const pattern of patterns) {
    await api('set',{pattern})
    const png=await page.screenshot({path:path.join(output,`${pattern}.png`)})
    captures.push(await sharp(png).removeAlpha().raw().toBuffer())
  }
  for(let i=0;i<captures.length;i++) for(let j=0;j<i;j++) assert(change(captures[i],captures[j])>2, 'Patterns must have distinct geometry')
  await api('set',{pattern:'prismLattice',detail:0})
  for(const [name,low,high] of [['intensity',0,1],['scale',0.55,1.25],['density',5,21],['width',0.6,2],['detail',0,1]]) {
    await api('set',{[name]:low}); const a=await raw()
    await api('set',{[name]:high}); const b=await raw()
    const delta=change(a,b); assert(delta>0.12, `${name} must visibly change output`)
    report.push({control:name,delta})
    await api('reset')
  }
  for(const name of ['background','cyan','blue','magenta','amber','highlight']) {
    await api('reset'); const a=await raw()
    await api('set',{[name]:[0.08,1,0.12,1]}); const b=await raw()
    const delta=change(a,b); assert(delta>0.03, `${name} must have an independent visual consumer`)
    report.push({color:name,delta})
  }
  await api('reset')
  await api('music',{energy:0,bpm:70,featuresAvailable:false})
  const motionStart=await raw(); await api('advance',1)
  assert(change(motionStart,await raw())>0.2,'Native motion must be visible')
  await api('set',{speed:0}); const stopped=await raw(); await api('advance',0.5)
  assert(change(stopped,await raw())<0.01,'Zero speed stops phase travel')
  await api('set',{speed:1,amount:0}); const still=await raw(); await api('advance',0.5)
  assert(change(still,await raw())<0.01,'Zero motion amount stops geometry')
  await api('set',{amount:0.8,'bpm-sync':true}); const syncStart=await raw(); await api('advance',1,{bpm:70}); const synced=await raw()
  await api('set',{'bpm-sync':false}); await api('advance',1,{bpm:70}); const free=await raw()
  assert(change(syncStart,synced)>0.2 && change(synced,free)>0.2,'Sync timing must visibly move')
  await api('music',{},false); await api('reset')
  for (const [name,width,height] of [['square',954,954],['landscape',1280,720],['portrait',720,1280]]) {
    await page.setViewportSize({width,height})
    await page.waitForFunction(({width,height}) => {const c=document.querySelector('canvas');return c.width===width && c.height===height},{width,height})
    const state=await api('prepare')
    const image=await page.screenshot({path:path.join(output,`${name}.png`)})
    const {data,info}=await sharp(image).raw().toBuffer({resolveWithObject:true})
    report.push({name,width,height,...measure(data,width,height,info.channels),state})
  }
  await page.setViewportSize({width:1280,height:900})
  await api('showInspector',true)
  await page.screenshot({path:path.join(output,'inspector.png')})
  await api('set',{'pattern-change':true})
  await page.screenshot({path:path.join(output,'inspector-pattern-change.png')})
  await api('showInspector',false)
  }
  // Musical checks use a smaller canvas; final gallery above remains at source resolution.
  await page.setViewportSize({width:540,height:540})
  const clean = async (extra={}) => {
    await api('reset')
    await api('set',{reactivity:0,speed:0,amount:0,detail:0,bloom:0,trails:0,echo:0,...extra})
  }
  const values = state => state.parameters.persistentValues
  const pvalue = (state,key) => values(state)[`trippy-bro-${key}`]
  if(!process.argv.includes('--authority-only')) {
  // Actual shared Inspector controls, including its body-portaled option menu.
  await page.setViewportSize({width:1280,height:1000})
  await api('showInspector',true)
  const triggerControl=page.locator('[data-cinema2-control-id="trippy-bro-trigger"]')
  await api('set',{'pattern-change':false})
  assert.equal(await triggerControl.count(),0)
  await api('set',{'pattern-change':true})
  await triggerControl.getByRole('combobox').click()
  const labels=await page.getByRole('option').allTextContents()
  assert.equal(labels.length,11,'Production dropdown exposes exactly 11 triggers')
  await page.screenshot({path:path.join(output,'trigger-menu.png')})
  await page.getByRole('option',{name:'Kick',exact:true}).click()
  assert.equal(pvalue(await api('status'),'trigger'),'kick')
  await page.locator('[data-cinema2-control-id="trippy-bro-pattern"]').getByRole('combobox').click()
  assert.equal(await page.getByRole('option').count(),8)
  await page.getByRole('option',{name:'Orbital Lace',exact:true}).click()
  assert.equal(pvalue(await api('status'),'pattern'),'orbitalLace')
  assert.equal(pvalue(await api('status'),'pattern-change'),true)
  await api('showInspector',false)
  await page.setViewportSize({width:540,height:540})
  report.push({inspector:{triggerOptions:labels,patternCount:8}})
  for (const trigger of ['beat','kick','snare','downbeat','beat2','beat4','bar','bar4','bar8','phrase','drop']) {
    await clean({'pattern-change':true,trigger})
    await api('music',{timeSec:0,event:null,energy:0})
    const before=await raw()
    const event=trigger==='beat2'||trigger==='beat4'?'beat':trigger==='bar4'||trigger==='bar8'?'bar':trigger
    await api('music',{timeSec:0.1,event,eventId:64,beatIndex:64,energy:0})
    await api('advance',0.72)
    const after=await raw()
    assert(change(before,after)>2, `${trigger} must change actual rendered pattern`)
    await api('set',{pattern:'goldenFold','pattern-change':false})
    assert(change(after,await raw())<0.02, `${trigger} must advance to the expected next native pattern`)
    const state=await api('set',{'pattern-change':true,pattern:'liquidWeave'})
    assert.equal(pvalue(state,'pattern-change'),true,'Manual selection preserves cycling permission')
    const manual=await raw(); await api('repeatMusic')
    assert(change(manual,await raw())<0.02,'Held events cannot cancel a manual selection')
    report.push({trigger,delta:change(before,after)})
  }
  await writeFile(path.join(output,'trigger-report.json'),JSON.stringify(report,null,2))
  // Matched timing inputs distinguish true beat lock from the free-running reference rate.
  const timing=[]
  for(const synced of [true,false]) {
    await api('music',{timeSec:0,energy:0,featuresAvailable:false,bpm:70})
    await api('reenter',false)
    await clean({speed:1,amount:0.8,'bpm-sync':synced})
    await api('advance',1,{bpm:70})
    timing.push(await raw())
  }
  assert(change(timing[0],timing[1])>0.2,'Matched Sync ON/OFF inputs must produce different timing')
  report.push({syncDifference:change(timing[0],timing[1])})
  // Changing the analysis revision clears an old runtime pattern without mutating authored state.
  await clean({'pattern-change':true,trigger:'beat'})
  await api('music',{timeSec:0,energy:0,revision:'analysis-a'})
  const analysisBase=await raw()
  await api('music',{timeSec:0.1,event:'beat',eventId:1,beatIndex:1,energy:0,revision:'analysis-a'})
  await api('advance',0.72)
  assert(change(analysisBase,await raw())>2)
  await api('music',{timeSec:0.32,event:null,energy:0,revision:'analysis-b'})
  assert(change(analysisBase,await raw())<0.02,'Analysis revision must reset runtime-only pattern state')
  // Audio channels and geometry are exercised at a fixed pose to isolate each response.
  await clean({reactivity:1,amount:0.8,detail:1})
  await api('music',{timeSec:0,energy:0,bass:0,high:0,vocal:0,build:0})
  await api('advance',0.4)
  const quiet=await raw()
  let energetic=await api('music',{energy:1,bass:1,high:1,timeSec:0.45})
  energetic=await api('advance',0.5)
  assert(energetic.channels.energy>0.5 && energetic.channels.bass>0.5,'Shared continuous musical channels must resolve')
  assert(change(quiet,await raw())>0.2,'Energetic response must alter visible geometry')
  const energyFrame=await raw()
  await api('music',{energy:1,bass:1,vocal:1,timeSec:1})
  const vocalSettled=await api('advance',0.5)
  assert(vocalSettled.channels.vocal>0.5,'Vocal restraint must resolve')
  assert(change(energyFrame,await raw())>0.1,'Vocal restraint must change occupancy')
  for(const event of ['kick','snare','drop']) {
    await api('music',{timeSec:2,energy:0,event:null})
    await api('advance',0.3)
    const before=await raw()
    await api('music',{timeSec:2.35,energy:0,event,eventId:100})
    const state=await api('advance',0.035)
    assert(state.channels[event]>0.05,`${event} envelope must reach its distinct resolved channel`)
    assert(change(before,await raw())>0.08,`${event} must visibly react`)
    await api('advance',0.6)
    const decayed=await api('status')
    assert(decayed.channels[event]<0.01,`${event} envelope must return to base`)
  }
  // Auto Performance may substitute a look, but does not mutate authored settings.
  await clean({'auto-performance':true,'pattern-change':true,trigger:'beat'})
  await api('music',{timeSec:0,energy:0})
  await api('music',{timeSec:0.1,sectionBuild:true,sectionStart:0.1,energy:0})
  await api('advance',0.72)
  const overridden=await raw()
  const autoState=await api('status')
  assert.equal(pvalue(autoState,'pattern'),'prismLattice')
  assert.equal(pvalue(autoState,'pattern-change'),true)
  await api('set',{pattern:'liquidWeave'})
  const taken=await raw()
  assert(change(taken,overridden)>2,'Manual edit must replace visible Auto Performance override')
  await api('repeatMusic'); assert(change(taken,await raw())<0.02,'Active build cannot steal manual edit')
  await api('music',{timeSec:0.9,event:'beat',eventId:1,beatIndex:1,energy:0,sectionBuild:true,sectionStart:0.1})
  await api('advance',0.72)
  const advanced=await raw()
  await api('set',{pattern:'prismLattice','pattern-change':false})
  assert(change(advanced,await raw())<0.02,'Fresh trigger resumes progression from manual selection')
  // Pause/resume, seek, loop, track replacement, missing analysis, and preset re-entry.
  await clean({speed:1,amount:0.7})
  await api('music',{timeSec:0,featuresAvailable:false})
  await api('advance',0.4)
  await api('advance',0.1,{paused:true})
  const paused=await raw(); await api('advance',0.5,{paused:true})
  assert(change(paused,await raw())<0.02,'Pause must hold motion')
  await api('advance',0.4,{paused:false})
  assert(change(paused,await raw())>0.2,'Resume must restore motion')
  for(const input of [{timeSec:0.1},{timeSec:0},{timeSec:0,trackId:'replacement-track'}]) {
    const state=await api('music',{...input,featuresAvailable:false})
    assert.equal(state.modules.failedModuleCount,0)
    assert.equal(state.render.failedPassCount,0)
  }
  const reentry=await api('reenter',true,'low')
  assert.equal(reentry.retired.snapshot.phase,'disposed')
  assert.equal(reentry.current.modules.activeModuleCount,1)
  assert(Math.abs(pvalue(reentry.current,'amount')-0.7)<1e-9,'Preset re-entry preserves authored motion amount')
  // Effects must be visible at their extrema and disappear when set to zero.
  await api('reenter',false,'high')
  await api('music',{timeSec:0,energy:0})
  await clean({amount:0.6,speed:1})
  for(const [effect,max] of [['bloom',0.7],['split',1],['echo',1]]) {
    await api('set',{[effect]:0}); const off=await raw()
    await api('set',{[effect]:max}); const maximum=await raw()
    const delta=change(off,maximum); assert(delta>0.03,`${effect} must visibly change its intended output`)
    await page.screenshot({path:path.join(output,`effect-${effect}.png`)})
    await api('set',{[effect]:0}); assert(change(off,await raw())<0.02,`${effect} zero must disable output`)
    report.push({effect,delta})
  }
  await api('set',{trails:0.65}); await api('advance',0.5)
  const trailed=await raw()
  await api('set',{trails:0}); const untrailed=await raw()
  assert(change(trailed,untrailed)>0.03,'Trails must retain and release motion history')
  await api('set',{trails:0.65,intensity:0,bloom:0.7,echo:1,split:1})
  const dark=await raw()
  assert(dark.every(value=>value===0),'Master zero must remove retained emitted light')
  const finalState=await api('status')
  assert.equal(finalState.modules.failedModuleCount,0)
  assert.equal(finalState.effects.failedEffectCount,0)
  assert.equal(finalState.render.failedPassCount,0)
  report.push({audio:{quietVsEnergy:change(quiet,energyFrame),vocal:vocalSettled.channels,finalChannels:finalState.channels},performance:finalState.performance,resources:finalState.resources})
  }
  // Production proof of base advancement beneath an override, bounded expiry, and paused takeover.
  await clean({'auto-performance':true,'pattern-change':true,trigger:'beat'})
  await api('music',{timeSec:0,energy:0})
  const baseImage=await raw()
  await api('music',{timeSec:0.1,sectionBuild:true,sectionStart:0.1,energy:0})
  await api('advance',0.72)
  const buildImage=await raw()
  assert(change(baseImage,buildImage)>2,'Fresh build must substitute an authored performance pattern')
  await api('music',{timeSec:0.9,event:'beat',eventId:1,beatIndex:1,sectionBuild:true,sectionStart:0.1,energy:0})
  await api('music',{timeSec:1.0,event:'beat',eventId:2,beatIndex:2,sectionBuild:true,sectionStart:0.1,energy:0})
  assert(change(buildImage,await raw())<0.02,'Visible override must stay stable while the base advances')
  await api('music',{timeSec:1.1,sectionBuild:false,energy:0})
  await api('advance',0.72)
  const restored=await raw()
  await api('set',{pattern:'quadBloom','pattern-change':false})
  assert(change(restored,await raw())<0.02,'Override exit must restore the advanced underlying base')
  await clean({'auto-performance':true})
  await api('music',{timeSec:0,energy:0})
  const authored=await raw()
  await api('music',{timeSec:0.1,sectionBuild:true,sectionStart:0.1,energy:0})
  await api('advance',4.72)
  assert(change(authored,await raw())<0.02,'Build override must expire even if the same build section persists')
  await api('music',{timeSec:5,event:'drop',eventId:301,energy:0})
  await api('advance',0.72)
  assert(change(authored,await raw())>2,'Fresh drop must authorize a temporary performance pattern')
  await api('advance',0,{paused:true})
  await api('set',{'auto-performance':false})
  assert(change(authored,await raw())<0.02,'Disabling Auto Performance while paused must visibly restore the base immediately')
  report.push({authority:{advancedBaseRestored:true,buildExpiry:true,pausedTakeover:true}})
  const disposed = await page.evaluate(() => window.__trippyBroProduction.dispose())
  assert.equal(disposed.snapshot.phase, 'disposed')
  assert.equal(disposed.snapshot.resources.activeWebGLContextCount, 0)
  assert.equal(disposed.snapshot.resources.activeAnimationFrameCount, 0)
  assert.deepEqual(errors, [])
  await writeFile(path.join(output, process.argv.includes('--authority-only') ? 'report-authority.json' : process.argv.includes('--music-only') ? 'report-musical.json' : 'report.json'), JSON.stringify({ report, disposed, errors }, null, 2))
  const scope = process.argv.includes('--authority-only') ? 'override restoration, bounded expiry and paused takeover' : process.argv.includes('--music-only') ? 'Inspector dropdowns, 11 triggers, sync, audio, authority, transport, effects and re-entry' : 'eight patterns, controls, colors, motion, framing, musical performance and lifecycle'
  console.log(`Trippy, Bro acceptance passed: ${scope}. Captures: ${output}`)
} finally {
  await browser?.close()
  server.kill('SIGTERM')
}

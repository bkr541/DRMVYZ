/* global document */
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {chromium} from '@playwright/test'
import sharp from 'sharp'
const output='artifacts/cinema2-bass-sigil/performance'
await mkdir(output,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']})
const recoveryOnly=process.argv.includes('--recovery-only')
const lifecycleOnly=recoveryOnly||process.argv.includes('--lifecycle-only')
const report={lifecycleOnly,recoveryOnly,effects:[],quality:[],scenarios:[],errors:[]}
try {
 const page=await browser.newPage({viewport:{width:960,height:540}})
 page.on('pageerror',e=>report.errors.push(e.message))
 page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('CONTEXT_LOST'))report.errors.push(m.text())})
 const url=process.env.PLAYWRIGHT_BASE_URL??'http://127.0.0.1:5173'
 const api=(method,value)=>page.evaluate(([m,v])=>globalThis.bassSigilReview[m](v),[method,value])
 const set=async(name,value)=>assert((await page.evaluate(([n,v])=>globalThis.bassSigilReview.set(n,v),[name,value])).ok)
 const snapshot=()=>api('snapshot'),advance=seconds=>api('advance',seconds)
 const load=async(quality='high')=>{await page.goto(`${url}/src/test/browser/cinema2-bass-sigil.html?quality=${quality}`);await page.waitForFunction(()=>globalThis.bassSigilReview?.snapshot().modules.modules[0]?.inspection?.state==='ready',{}, {timeout:90000})}
 const pixels=async()=>sharp(await page.screenshot()).removeAlpha().raw().toBuffer()
 const delta=(a,b)=>{let t=0;for(let i=0;i<a.length;i++)t+=Math.abs(a[i]-b[i]);return t/a.length}
 const capture=async name=>{await page.screenshot({path:`${output}/${name}.png`});report.scenarios.push({name,snapshot:await snapshot()})}
 const effects={focus:1,trails:.45,bloom:.8,flares:.6,finishMix:1}
 if(!lifecycleOnly){
 await load();await set('cameraMode','manual');await set('logoMotion',false);await set('motionRate',0);await set('reactivity',0)
 await capture('default')
 for(const name of Object.keys(effects))await set(name,0)
 await capture('dry');const dry=await pixels()
 for(const[name,max]of Object.entries(effects)) {
  await set(name,max);await advance(.4);const d=delta(dry,await pixels())
  // Trails need moving background and a source; isolated below. Other effects must change actual pixels.
  if(name!=='trails')assert(d>.002,`${name} visibly changes pixels (${d})`)
  report.effects.push({name,max,difference:d});await capture(`max-${name}`);await set(name,0)
 }
 // Background trails use a depth mask: history is live and the opaque wordmark never enters it.
 await set('motionRate',1);await set('trails',.45);await api('music',{energy:.6,bass:.5});await advance(1)
 assert((await snapshot()).history.validBufferCount>0);await capture('moving-trails')
 await api('timing',{paused:true});await advance(.1);assert.equal((await snapshot()).history.validBufferCount,0)
 await api('timing',{paused:false});await set('trails',0)
 // Restore authored finish, then review a deterministic performance arc.
 for(const[name,value]of Object.entries({focus:.2,trails:.1,bloom:.3,flares:.15,finishMix:1,reactivity:1,logoMotion:true,autoPerformance:true}))await set(name,value)
 const saved=(await snapshot()).parameters.persistentValues
 await api('music',{energy:.15,bass:.1,high:.1,vocal:.8});await advance(3);await capture('calm-vocal')
 await api('music',{energy:.9,bass:.9,high:.6,vocal:0});await advance(3);await capture('drive')
 assert.equal((await snapshot()).modules.modules[0].inspection.patternControlsAutomatic,true)
 await api('music',{energy:.7,build:1,sectionBuild:true,sectionProgress:.8,tension:.95});await advance(1.5);await capture('build')
 assert.equal((await snapshot()).modules.modules[0].inspection.overrideReason,'build')
 await api('event','drop');await advance(.2);await capture('drop')
 assert.equal((await snapshot()).modules.modules[0].inspection.overrideReason,'drop')
 await api('music',{energy:.9,build:0,sectionBuild:false,tension:0});await advance(4.2)
 assert.equal((await snapshot()).modules.modules[0].inspection.overrideReason,null)
 await api('music',{energy:0,bass:0,high:0,vocal:0});await advance(5);await capture('silent-stop')
 assert((await snapshot()).mood.silence>.9);assert.equal((await snapshot()).modules.modules[0].inspection.effectivePatternChange,false)
 await api('event','drop');await advance(.2);assert.equal((await snapshot()).modules.modules[0].inspection.overrideReason,'drop')
 assert.deepEqual((await snapshot()).parameters.persistentValues,saved,'Performance never rewrites saved controls')
 } else {await load();await set('autoPerformance',true);await api('music',{energy:.8});await advance(.3);await api('event','drop');await advance(.2)}
 if(!recoveryOnly){
 // Pause freezes all geometry/logo/camera phases; seek and source replacement clear temporary programs.
 await api('timing',{paused:true});const held=(await snapshot()).modules.modules[0].inspection
 await advance(.5);const paused=(await snapshot()).modules.modules[0].inspection
 assert.equal(paused.phase,held.phase);assert.equal(paused.logoPhase,held.logoPhase);assert.equal(paused.overrideReason,held.overrideReason);assert.equal(paused.pattern,held.pattern)
 await api('timing',{paused:false});await api('seek',0);await advance(1/30);assert.equal((await snapshot()).modules.modules[0].inspection.overrideReason,null)
 await api('music',{energy:.5,trackId:'acceptance-next-track'});await advance(1/30);assert((await snapshot()).modules.modules[0].inspection.phase<.15);assert.equal((await snapshot()).modules.modules[0].inspection.overrideReason,null)
 // Real Inspector: same rows/geometry, expected shared lock, editable palette/BPM/Auto, live values.
 await set('autoPerformance',false);await api('inspector',true);await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(300)
 const ui=()=>page.evaluate(()=>{const h=document.querySelector('#bass-sigil-inspector');return {height:h.scrollHeight,locked:h.querySelectorAll('[data-auto-performance-locked]').length,controls:[...h.querySelectorAll('input,select,button,textarea')].map(e=>{const r=e.getBoundingClientRect(),row=e.closest('.rv-ctrl-row,.rv-ctrl-toggle-row')??e;return {label:e.getAttribute('aria-label')??row.textContent,group:e.closest('[data-cinema2-parent-group]')?.getAttribute('data-cinema2-parent-group'),disabled:e.disabled,header:/drc-header|collapsible-hdr/.test(String(e.className)),rect:[r.x,r.y,r.width,r.height]}})}})
 const off=await ui();await set('autoPerformance',true);await page.waitForTimeout(200);const on=await ui()
 report.inspector={off,on};assert.equal(off.controls.length,on.controls.length);assert.equal(off.height,on.height)
 for(let i=0;i<off.controls.length;i++)assert.deepEqual(off.controls[i].rect,on.controls[i].rect,'No lock-induced layout shift')
 assert(await page.locator('[data-live-policy=true]').count()>0,'Real shared policy readout is visible');assert(on.locked>10);assert(on.controls.filter(c=>c.group==='palette').every(c=>!c.disabled))
 assert(on.controls.filter(c=>/^(BPM Sync|Auto Performance)/.test(c.label)).every(c=>!c.disabled))
 assert(on.controls.filter(c=>['design','effects'].includes(c.group)&&!c.header).every(c=>c.disabled))
 await page.screenshot({path:`${output}/inspector-auto.png`});report.inspector={off,on};await api('inspector',false)
 }
 // WebGL context restoration and real production lifecycle.
 await page.evaluate(()=>{globalThis.bassSigilContextLoss=document.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context');globalThis.bassSigilContextLoss.loseContext()})
 await page.waitForFunction(()=>globalThis.bassSigilReview.snapshot().runtime.phase==='context-lost')
 await page.evaluate(()=>globalThis.bassSigilContextLoss.restoreContext())
 await page.waitForFunction(()=>globalThis.bassSigilReview.snapshot().runtime.phase==='running'&&globalThis.bassSigilReview.snapshot().modules.modules[0]?.inspection?.state==='ready',{}, {timeout:90000})
 await advance(.2);assert.equal((await snapshot()).render.failedPassCount,0)
 for(const quality of ['high','medium','low']) {
  if(quality!=='high')await load(quality)
  await page.setViewportSize({width:quality==='low'?540:960,height:quality==='low'?800:540});await advance(.2)
  const s=await snapshot();assert.equal(s.modules.failedModuleCount,0);assert.equal(s.effects.failedEffectCount,0);assert.equal(s.render.failedPassCount,0)
  report.quality.push({quality,runtime:s.runtime,modules:s.modules,render:s.render});await capture(`quality-${quality}`)
  const resources=await api('dispose');assert.equal(resources.activeLeaseCount,0);assert.equal(resources.activeSurfaceCount,0)
 }
 assert.deepEqual(report.errors,[])
 await writeFile(`${output}/${recoveryOnly?'recovery-report':lifecycleOnly?'lifecycle-report':'report'}.json`,JSON.stringify(report,null,2)+'\n')
 console.log(recoveryOnly?'Bass Sigil: context restoration, all quality tiers and disposal passed.':lifecycleOnly?'Bass Sigil: pause, seek, track reset, shared Inspector lock, context restoration, quality tiers and disposal passed.':'Bass Sigil: full performance and production acceptance passed.')
} finally {await writeFile(`${output}/${recoveryOnly?'recovery-report':lifecycleOnly?'lifecycle-report':'report'}.json`,JSON.stringify(report,null,2)+'\n');await browser.close()}

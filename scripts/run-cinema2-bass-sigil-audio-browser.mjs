// P3: real runtime + one shared intelligence bridge. No preset-local detector or synthetic renderer.
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {chromium} from '@playwright/test'
import sharp from 'sharp'
const output='artifacts/cinema2-bass-sigil/audio'
await mkdir(output,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']})
try {
 const page=await browser.newPage({viewport:{width:960,height:540}}),errors=[]
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
 await page.goto(`${process.env.PLAYWRIGHT_BASE_URL??'http://127.0.0.1:5173'}/src/test/browser/cinema2-bass-sigil.html`)
 await page.waitForFunction(()=>globalThis.bassSigilReview?.snapshot().modules.estimatedGpuBytes>0,{}, {timeout:90000})
 const warm=async()=>{for(let i=0;i<60;i++){await page.waitForTimeout(250);const s=await sharp(await page.screenshot()).stats();if(s.channels[0].stdev>12)return}throw new Error('Scene did not warm')}
 await warm()
 const api=(method,value)=>page.evaluate(([m,v])=>globalThis.bassSigilReview[m](v),[method,value])
 const set=async(name,value)=>assert((await page.evaluate(([n,v])=>globalThis.bassSigilReview.set(n,v),[name,value])).ok)
 const snapshot=()=>page.evaluate(()=>globalThis.bassSigilReview.snapshot())
 const advance=seconds=>api('advance',seconds)
 const pixels=async()=>sharp(await page.screenshot()).removeAlpha().raw().toBuffer()
 const difference=(a,b)=>{let total=0;for(let i=0;i<a.length;i++)total+=Math.abs(a[i]-b[i]);return total/a.length}
 await set('cameraMode','manual');await set('logoMotion',false);await set('pattern','axial-pressure');await set('motionRate',0);await set('reactivity',1)
 const quiet={active:true,energy:0,bass:0,high:0,vocal:0,event:null}
 await api('music',quiet);await advance(.5)
 const authored=(await snapshot()).parameters,base=await pixels(),scenarios=[]
 for(const[name,music,property,expected]of [['bass',{bass:1},'membraneScale',1.1],['highs',{high:1},'membraneOpacity',.85],['vocals',{vocal:1},'particleDensity',.7]]) {
  await api('music',{...quiet,...music});await advance(.7);const live=(await snapshot()).live,frame=await pixels(),delta=difference(base,frame)
  assert(delta>.02,`${name} must visibly affect the source scene (${delta})`)
  if(name==='vocals'||name==='highs')assert(live[property]<expected);else assert(live[property]>expected)
  scenarios.push({name,delta,live});await page.screenshot({path:`${output}/${name}.png`})
  await api('music',quiet);await advance(1.2)
 }
 assert.deepEqual((await snapshot()).parameters,authored,'Audio may not rewrite authored values')
 // Equal-time restarts isolate audio-driven motion from native motion.
 await set('motionRate',1)
 const energyFrames=[]
 for(const energy of [0,1]) {await api('music',{...quiet,energy});await api('restart');await page.waitForFunction(()=>globalThis.bassSigilReview.snapshot().modules.estimatedGpuBytes>0);await warm();await advance(1);energyFrames.push(await pixels());await page.screenshot({path:`${output}/energy-${energy}.png`})}
 assert(difference(...energyFrames)>.05,'Energy must visibly change motion, not only brightness')
 // All rhythm cases share real canonical source events; downbeats follow the shared bar clock.
 const groove={...quiet,energy:.6}
 await set('motionRate',0);await api('music',groove);await advance(1)
 for(const event of ['kick','snare','downbeat']) {
  if(event==='snare')await set('logoMotion',true)
  const before=(await snapshot()).live
  if(event==='downbeat') {for(let i=0;i<80;i++){await advance(1/30);if((await snapshot()).live.heroScale>1.005)break}}
  else {await api('event',event);await advance(.15)}
  const peak=await snapshot(),property=event==='kick'?'coreTravel':event==='snare'?'logoRoll':'heroScale'
  assert(peak.live[property]>before[property]+.001,`${event} must accent ${property}`)
  await page.screenshot({path:`${output}/${event}.png`});scenarios.push({event,property,peak:peak.live[property]})
  if(event==='kick') {await api('timing',{paused:true});const held=await snapshot();await advance(.5);assert.equal((await snapshot()).live.coreTravel,held.live.coreTravel);await api('timing',{paused:false})}
  await api('music',groove);await advance(.4)
 }
 // Pattern Change remains explicit: structural audio only advances an authorized underlying pattern.
 await set('logoMotion',false);await set('patternChange',true);await set('trigger','drop');await set('pattern','reference-vortex');await api('music',groove);await advance(.1)
 const beforePattern=await pixels();await api('event','drop');await advance(.15);const afterPattern=await pixels()
 assert(difference(beforePattern,afterPattern)>.05,'A new authorized drop must change the performing pattern')
 await set('patternChange',false)
 // Reactivity zero is differential against no features at an identical clock/pose.
 await set('reactivity',0);await set('logoMotion',false);await set('motionRate',0);await set('pattern','axial-pressure')
 const dry=[]
 for(const active of [true,false]) {await api('music',{...quiet,active,energy:1,bass:1,high:1,vocal:1});await api('restart');await page.waitForFunction(()=>globalThis.bassSigilReview.snapshot().modules.estimatedGpuBytes>0);await warm();await advance(.5);dry.push(await pixels())}
 assert(difference(...dry)<.01,'Reactivity zero must equal no audio at a fixed native pose')
 // Hard zeros/disable values stay off with full features; reset discontinuities clear accents.
 await set('reactivity',1);await set('coreTravel',0);await set('glow',0);await set('particleDensity',0);await set('geometryMotion',false)
 await api('music',{...quiet,energy:1,bass:1,high:1,vocal:1});await advance(.5);await api('event','kick');await advance(.15)
 const gated=(await snapshot()).live;assert.equal(gated.coreTravel,0);assert.equal(gated.glow,0);assert.equal(gated.particleDensity,0);assert.equal(gated.membraneScale,1)
 await set('geometryMotion',true);await set('coreTravel',.25);await api('music',groove);await api('event','kick');await advance(.15);assert((await snapshot()).live.coreTravel>.25)
 await api('seek',20);await advance(1/30);assert.equal((await snapshot()).live.coreTravel,.25)
 await api('music',{...quiet,trackId:'bass-sigil-next-track'});await advance(1/30);assert.equal((await snapshot()).live.coreTravel,.25)
 const final=await snapshot();assert.equal(final.modules.failedModuleCount,0);assert.equal(final.render.failedPassCount,0);assert.deepEqual(errors,[])
 const resources=await api('dispose');assert.equal(resources.activeLeaseCount,0);assert.equal(resources.activeSurfaceCount,0)
 await writeFile(`${output}/report.json`,JSON.stringify({scenarios,energyDifference:difference(...energyFrames),zeroReactivityDifference:difference(...dry),errors,resources},null,2)+'\n')
 console.log('Bass Sigil P3: continuous/rhythmic/structural audio, zero-strength differential, hard gates, pause/seek/track reset and cleanup passed.')
} finally {await browser.close()}

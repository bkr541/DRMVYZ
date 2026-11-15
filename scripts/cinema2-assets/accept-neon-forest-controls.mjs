// Supplemental final controls/idle checks and short review clips. The integrated
// suite owns audio authority/lifecycle coverage; this focuses on remaining ranges.
import assert from 'node:assert/strict'
import {mkdir,writeFile,readFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {createServer} from 'vite'
import {chromium} from '@playwright/test'
import sharp from 'sharp'
const root=resolve(import.meta.dirname,'../..'),out=resolve(root,'artifacts/cinema2-neon-forest-controls')
await mkdir(out,{recursive:true})
const server=await createServer({root,server:{host:'127.0.0.1',port:0,hmr:false},clearScreen:false})
let browser,page
const checks=[],captures=[],errors=[]
const check=(v,s)=>{assert.ok(v,s);checks.push(s)}
const set=v=>page.evaluate(v=>globalThis.__neonForestProduction.set(v),v)
const advance=(seconds,bpm=100,source=true)=>page.evaluate(v=>globalThis.__neonForestProduction.advance(v[0],v[1],false,v[2]),[seconds,bpm,source])
const ready=()=>page.waitForFunction(()=>globalThis.__neonForestProduction?.status().modules.estimatedGpuBytes>0,undefined,{timeout:120000})
const raw=async(name)=>{const b=await page.locator('canvas').screenshot(name?{path:resolve(out,name+'.png')}:{});if(name)captures.push(name);return sharp(b).removeAlpha().raw().toBuffer()}
const diff=(a,b)=>{assert.equal(a.length,b.length);let d=0;for(let i=0;i<a.length;i++)d+=Math.abs(a[i]-b[i]);return d/a.length}
const reset=async(v={})=>{await page.evaluate(()=>globalThis.__neonForestProduction.reenter());await ready();await set({cameraMode:'fixed',cameraMotion:false,atmosphereEnabled:false,bloomEnabled:false,reflectionsEnabled:false,particles:0,musicResponse:0,...v});await page.evaluate(()=>globalThis.__neonForestProduction.music({energy:.5,bpm:180}));await advance(2,180)}
try{
 await server.listen();browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'})
 page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1})
 page.setDefaultNavigationTimeout(120000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
 const url=`http://127.0.0.1:${server.httpServer.address().port}/src/test/browser/cinema2-neon-forest-production.html`
 await page.goto(url,{waitUntil:'domcontentloaded'});await ready();await reset({amount:1})
 if(process.argv.includes('--ranges')){const previous=JSON.parse(await readFile(resolve(out,'failure.json'),'utf8'));checks.push(...previous.checks);captures.push(...previous.captures)}
 if(!process.argv.includes('--ranges')){
 const patterns=['prism-tide','root-resonance','aisle-cascade','crown-spiral','portal-bloom','crosscurrent','crystal-choir','supernova-grove'],images=[]
 for(const pattern of patterns){await set({pattern});images.push(await raw())}
 for(let i=0;i<8;i++)for(let j=i+1;j<8;j++)check(diff(images[i],images[j])>.01,`${patterns[i]} / ${patterns[j]}: pairwise distinct geometry with effects OFF`)
 for(const pattern of patterns){await set({pattern});const a=await raw();await advance(.6);check(diff(a,await raw())>.01,`${pattern}: actual frame-to-frame geometry motion`)}
 }
 // Numeric controls at their actual authored default, minimum and maximum.
 for(const [key,min,normal,max,options]of [
  ['master',0,.85,1],['amount',0,.65,1],['density',0,1,1],['scale',.8,1,1.1],['portalSize',.65,1,1.35],['emission',0,.65,1],['particles',0,.45,1],['lightStrength',0,.8,1],
  ['fov',45,58,75],['radius',18,20,24,{cameraMode:'orbit',cameraMotion:false}],['heading',-180,0,180,{cameraMode:'orbit',cameraMotion:false}],['elevation',35,40,60,{cameraMode:'orbit',cameraMotion:false}],
  ['fogDensity',0,.45,1,{atmosphereEnabled:true}],['mist',0,.08,.2,{atmosphereEnabled:true}],['mistHeight',.2,1.8,5,{atmosphereEnabled:true}],['shafts',0,.65,2,{atmosphereEnabled:true}],['bloom',0,.45,1,{bloomEnabled:true}],['reflections',0,.3,1,{reflectionsEnabled:true}],
 ]){
  await reset({motion:key==='amount',...options});const states=[]
  for(const [name,value]of [['min',min],['default',normal],['max',max]]){await set({[key]:value});states.push(await raw(`${key}-${name}`))}
  // -180 and +180 describe the same orbit heading; compare the authored zero.
  check((key==='heading'?diff(states[0],states[1]):diff(states[0],states[2]))>.001,`${key}: minimum/default/maximum reach visible consumer`)
 }
 // Timing controls need an elapsed interval, not a same-frame state comparison.
 for(const [key,values,options]of [['speed',[0,1,2],{}],['cameraSpeed',[0,1,2],{motion:false,cameraMode:'orbit',cameraMotion:true}],['musicResponse',[0,.8,1],{}]]){
  const frames=[]
  for(const value of values){await reset(options);await set({[key]:value});if(key==='musicResponse')await page.evaluate(()=>globalThis.__neonForestProduction.music({energy:1,bass:1,high:1}));await advance(.8);frames.push(await raw(`${key}-${value}`))}
  check(diff(frames[0],frames[2])>.01,`${key}: elapsed production output changes across range`)
 }
 const sync=[]
 for(const on of [true,false]){await reset({bpmSync:on});await advance(2,180);sync.push(await raw(`bpm-sync-${on}`))}
 check(diff(sync[0],sync[1])>.01,'Mandatory BPM Sync changes actual motion timing at 180 BPM')
 await page.evaluate(()=>globalThis.__neonForestProduction.reenter());await ready();await set({cameraMode:'fixed',cameraMotion:false,atmosphereEnabled:false,bloomEnabled:false,reflectionsEnabled:false,particles:0,musicResponse:0})
 const idle=await raw();await advance(2,100,false);const movingIdle=await raw('ambient-idle')
 check(diff(idle,movingIdle)>.001,'No-track idle has gentle actual geometry motion')
 await page.evaluate(()=>globalThis.__neonForestProduction.music({energy:.5}));await advance(2);check(diff(movingIdle,await raw('playing-response'))>.01,'Music playback visibly leaves subdued idle state')
 await page.goto(url,{waitUntil:'domcontentloaded'});await ready()
 await set({cameraMode:'orbit',radius:20,elevation:40,heading:25});await advance(1,100,false);await raw('orbit-default')
 // Real video frames from the production renderer, using the same shared timing.
 const clipPage=await browser.newPage({viewport:{width:960,height:540},recordVideo:{dir:out,size:{width:960,height:540}}})
 clipPage.setDefaultNavigationTimeout(120000);await clipPage.goto(url,{waitUntil:'domcontentloaded'});await clipPage.waitForFunction(()=>globalThis.__neonForestProduction?.status().modules.estimatedGpuBytes>0)
 await clipPage.evaluate(()=>globalThis.__neonForestProduction.set({cameraMode:'fixed',cameraMotion:false,amount:1}))
 await clipPage.evaluate(()=>globalThis.__neonForestProduction.music({energy:.8,bass:.8,high:.7}))
 for(const pattern of ['prism-tide','portal-bloom','supernova-grove']){await clipPage.evaluate(p=>globalThis.__neonForestProduction.set({pattern:p}),pattern);await clipPage.evaluate(()=>globalThis.__neonForestProduction.advance(2,120,false,true))}
 await clipPage.evaluate(()=>globalThis.__neonForestProduction.set({cameraMode:'travel',cameraMotion:true}));await clipPage.evaluate(()=>globalThis.__neonForestProduction.advance(12,120,false,true))
 await clipPage.evaluate(()=>globalThis.__neonForestProduction.set({cameraMode:'orbit',radius:20,elevation:40}));await clipPage.evaluate(()=>globalThis.__neonForestProduction.advance(8,120,false,true))
 const video=clipPage.video();await clipPage.close();await video.saveAs(resolve(out,'NEON_FOREST-motion-review.webm'));await video.delete()
 const report=JSON.parse(await readFile(resolve(root,'artifacts/cinema2-neon-forest-final/report.json'),'utf8')),refs=report.metrics.references
 const nf=refs.neonForest.core.p99,comparison=Math.max(refs.mainframe.core.p99,refs.nightshift.core.p99,refs.cathedral.core.p99)
 check(nf>=comparison*.8&&nf<=comparison*1.4,'Bright-region luminance is comparable to the authored MAINFRAME/NIGHTSHIFT/Cathedral reference board')
 const disposed=await page.evaluate(()=>globalThis.__neonForestProduction.dispose());check(disposed.resources.activeLeaseCount===0,'Supplemental runtime releases resources');check(errors.length===0,'No browser/shader errors')
 await writeFile(resolve(out,'report.json'),JSON.stringify({checks,captures,errors,brightnessRatio:nf/comparison,disposed},null,2)+'\n');console.log(JSON.stringify({checks:checks.length,captures:captures.length,errors}))
}catch(e){await writeFile(resolve(out,'failure.json'),JSON.stringify({checks,captures,errors,message:String(e)},null,2));throw e}finally{await browser?.close();await server.close()}

/* global window */
// Real Cinema 2.0 runtime, final canvas and shared Inspector. Run from the repo root after npm ci.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from '@playwright/test'
import sharp from 'sharp'
const port=48500+process.pid%1000
const url=`http://127.0.0.1:${port}/src/test/browser/cinema2-allstar-production.html`
const output=path.resolve('artifacts/cinema2-allstar/acceptance')
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:['ignore','pipe','pipe']})
let log='',browser
server.stdout.on('data',v=>log+=v);server.stderr.on('data',v=>log+=v)
const patterns=['infinitePassage','starEruption','fracturedPrism','recursiveChamber','darkAperture','chromaticRelay','counterphase','morphCascade','depthSurge','segmentedPulse','geometricConvergence','radiantDischarge']
const change=(a,b)=>{assert.equal(a.length,b.length);let sum=0;for(let i=0;i<a.length;i++)sum+=Math.abs(a[i]-b[i]);return sum/a.length}
try {
  await mkdir(output,{recursive:true});let ready=false
  for(let i=0;i<150;i++){if(server.exitCode!==null)throw Error(log);try{if((await fetch(url)).ok){ready=true;break}}catch{/* server not up yet */}await new Promise(r=>setTimeout(r,100))}
  assert(ready,log)
  browser=await chromium.launch({headless:true,args:['--enable-webgl','--ignore-gpu-blocklist'],...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})})
  const page=await browser.newPage({viewport:{width:960,height:540},deviceScaleFactor:1})
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await page.waitForFunction(()=>!!window.__allstarProduction)
  const api=(method,...args)=>page.evaluate(({method,args})=>window.__allstarProduction[method](...args),{method,args})
  const capture=async(name)=>{const b=Buffer.from((await api('capture')).split(',')[1],'base64');if(name)await writeFile(path.join(output,`${name}.png`),b);return sharp(b).removeAlpha().raw().toBuffer()}
  const inspect=s=>s.modules.modules.find(m=>m.inspection?.performingPattern)?.inspection
  const report=[];await api('prepare');await api('set',{'auto-performance':false,'motion-safety':'lockoff','camera-motion':false})
  const captures=[]
  for(const pattern of patterns){await api('set',{pattern});const raw=await capture(pattern);assert(raw.some(v=>v>100),`${pattern} rendered no bright geometry`);captures.push(raw)}
  for(let i=0;i<captures.length;i++)for(let j=0;j<i;j++)assert(change(captures[i],captures[j])>.08,`${patterns[i]} and ${patterns[j]} must differ`)
  await api('set',{pattern:'starEruption'})
  const controls=[['intensity',0,2],['tunnel-width',2.8,5.5],['tunnel-depth',.75,1.5],['frame-thickness',.08,.32],['structural-detail',0,1],['surface-roughness',.12,.85],['geometry',false,true],['geometry-layers',1,9],['geometry-size',.5,1.5],['geometry-thickness',.015,.12],['morph-amount',0,1],['geometry-intensity',0,2],['geometric-separation',.2,1],['perimeter-lighting',false,true],['recessed-fixtures',false,true],['perimeter-intensity',0,2],['fixture-intensity',0,2],['fixture-density',.1,1],['lighting-contrast',0,1],['blackout-depth',0,1],['bloom',0,2],['bloom-spread',.05,.8],['light-spill',0,1],['reflections',0,1],['atmosphere',0,.12],['depth-falloff',0,1],['atmospheric-texture',0,.5],['finish',0,1],['contrast',.8,1.5],['saturation',0,1.5],['vignette',0,.8],['fov',50,85]]
  for(const [key,lo,hi] of controls){await api('reset');await api('set',{'auto-performance':false,'motion-safety':'lockoff','camera-motion':false,pattern:'darkAperture',[key]:lo});const a=await capture();await api('set',{[key]:hi});const delta=change(a,await capture());report.push({control:key,delta});assert(delta>.001,`${key} must affect final pixels`)}
  for(const key of ['background','metal','panel','perimeter','geometry-color','accent','atmosphere-color']){await api('reset');await api('set',{'auto-performance':false,'motion-safety':'lockoff',pattern:'starEruption'});const a=await capture();await api('set',{[key]:[.05,1,.12,1]});const delta=change(a,await capture());report.push({color:key,delta});assert(delta>.001,`${key} must affect final pixels`)}
  await api('reset');await api('set',{'auto-performance':false,'camera-motion':false});const idle=await capture();await api('advance',1);assert(change(idle,await capture())>.08,'Idle spatial motion must be visible')
  await api('music',{energy:.7,bass:.8,event:null,timeSec:10});const before=await capture();await api('advance',.4);assert(change(before,await capture())>.08,'Audio must change geometry or illumination')
  const triggerCases=[['beat','beat'],['kick','kick'],['snare','snare'],['downbeat','downbeat'],['beat2','beat'],['beat4','beat'],['bar','bar'],['bar4','bar'],['bar8','bar'],['phrase','phrase'],['drop','drop']]
  let eventId=100,time=12
  for(const [trigger,event] of triggerCases){await api('set',{'auto-performance':false,pattern:'infinitePassage','pattern-change':true,trigger});await api('music',{energy:.8,bass:.8,event:null,timeSec:time});const start=inspect(await api('status'));time+=.2;await api('music',{energy:.8,bass:.8,event,timeSec:time,beatIndex:32,eventId:++eventId});const after=inspect(await api('status'));assert.notEqual(after.basePattern,start.basePattern,`${trigger} must advance on its shared event`);await api('repeatMusic');assert.equal(inspect(await api('status')).basePattern,after.basePattern,`${trigger} must deduplicate`);time+=.2}
  await api('set',{'auto-performance':false,'pattern-change':false});await api('showInspector',true)
  const measure=()=>page.locator('[data-cinema2-control-id="allstar-travel-speed"]').evaluate(el=>({height:el.getBoundingClientRect().height,width:el.getBoundingClientRect().width}))
  const size=await measure();await api('set',{'auto-performance':true});await api('music',{energy:.9,bass:.9,build:.85,timeSec:time+.2});await api('advance',1);assert.deepEqual(await measure(),size,'Auto Performance must not change the row dimensions');assert(await page.locator('[data-auto-performance-locked="true"]').count()>0,'Shared Inspector must lock Design controls');await api('set',{'auto-performance':false});assert.equal(await page.locator('[data-auto-performance-locked="true"]').count(),0);await api('showInspector',false)
  for(const [width,height] of [[960,540],[640,640],[540,960]]){await page.setViewportSize({width,height});await api('reenter',true,'medium');await api('prepare');const s=await api('status');assert.equal(s.modules.failedModuleCount,0);assert.equal(s.render.failedPassCount,0);await capture(`resize-${width}x${height}`)}
  await api('dispose');assert.deepEqual(errors,[]);await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(`ALLSTAR automated production review captures: ${output}`)
}finally{await browser?.close();server.kill()}

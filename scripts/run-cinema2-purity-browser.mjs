/* global window, document */
// Production runtime + final canvas + shared Inspector. Run after npm ci and Playwright Chromium installation.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from '@playwright/test'
import sharp from 'sharp'
const port=48700+process.pid%1000
const url=`http://127.0.0.1:${port}/src/test/browser/cinema2-purity-production.html`
const output=path.resolve('artifacts/cinema2-purity/acceptance')
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:['ignore','pipe','pipe']})
let log='',browser
server.stdout.on('data',v=>log+=v);server.stderr.on('data',v=>log+=v)
const patterns=['ignition','monolith','strata','pillar','matrix','wireframe','fracture','cascade','relay','spine','crosswire','eclipse']
const change=(a,b)=>{assert.equal(a.length,b.length);let sum=0;for(let i=0;i<a.length;i++)sum+=Math.abs(a[i]-b[i]);return sum/a.length}
try {
  await mkdir(output,{recursive:true});let ready=false
  for(let i=0;i<150;i++){if(server.exitCode!==null)throw Error(log);try{if((await fetch(url)).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,100))}
  assert(ready,log)
  browser=await chromium.launch({headless:true,args:['--enable-webgl','--ignore-gpu-blocklist'],...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})})
  const page=await browser.newPage({viewport:{width:960,height:540},deviceScaleFactor:1})
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await page.waitForFunction(()=>!!window.__purityProduction)
  const api=(method,...args)=>page.evaluate(({method,args})=>window.__purityProduction[method](...args),{method,args})
  const capture=async(name)=>{const b=Buffer.from((await api('capture')).split(',')[1],'base64');if(name)await writeFile(path.join(output,`${name}.png`),b);return sharp(b).removeAlpha().raw().toBuffer()}
  const inspect=s=>s.modules.modules.find(m=>m.inspection?.performingPattern)?.inspection
  const report=[];await api('prepare');await api('set',{'auto-performance':false,'motion-safety':'lockoff','camera-motion':false})
  const captures=[]
  for(const pattern of patterns){await api('set',{pattern});const raw=await capture(pattern);assert(raw.some(v=>v>15),`${pattern} rendered no geometry`);captures.push(raw)}
  for(let i=0;i<captures.length;i++)for(let j=0;j<i;j++)assert(change(captures[i],captures[j])>.03,`${patterns[i]} and ${patterns[j]} must differ`)
  const controls=[['intensity',0,2],['tunnel-width',2.8,5.5],['tunnel-depth',.75,1.5],['frame-thickness',.08,.32],['structural-detail',0,1],['surface-roughness',.12,.85],['perimeter-lighting',false,true],['recessed-fixtures',false,true],['perimeter-intensity',0,2],['fixture-intensity',0,2],['fixture-density',.1,1,'matrix'],['lighting-contrast',0,1,'matrix'],['blackout-depth',0,1,'eclipse'],['bloom',0,2],['bloom-spread',.05,.8],['flares',0,1],['light-spill',0,1],['reflections',0,1],['atmosphere',0,.12],['depth-falloff',0,1],['atmospheric-texture',0,.5],['finish',0,1],['contrast',.8,1.5],['saturation',0,1.5],['vignette',0,.8],['fov',50,85]]
  for(const [key,lo,hi,pattern='monolith'] of controls){await api('reset');await api('set',{'auto-performance':false,'motion-safety':'lockoff','camera-motion':false,pattern,[key]:lo});const a=await capture();await api('set',{[key]:hi});const delta=change(a,await capture());report.push({control:key,delta});assert(delta>.001,`${key} must affect final pixels`)}
  for(const key of ['background','metal','panel','perimeter','panel-light','accent','atmosphere-color']){await api('reset');await api('set',{'auto-performance':false,'motion-safety':'lockoff','camera-motion':false,pattern:'matrix'});const a=await capture();await api('set',{[key]:[.05,1,.12,1]});const delta=change(a,await capture());report.push({color:key,delta});assert(delta>.001,`${key} must affect final pixels`)}
  // The runtime intentionally freezes animation when the host has no active audio. Supply deterministic active playback for timing tests.
  await api('reset');await api('set',{'auto-performance':false,'camera-motion':false,pattern:'monolith'})
  await api('music',{energy:.15,bass:0,event:null,timeSec:10,bpm:120});const before=await capture();const start=inspect(await api('status')).travel
  await api('advance',.6);assert(inspect(await api('status')).travel>start);assert(change(before,await capture())>.03,'Forward motion must affect pixels')
  await api('set',{'motion-safety':'lockoff'});await api('music',{energy:.15,bass:0,timeSec:11});await api('advance',.4);const quiet=await capture()
  await api('music',{energy:.9,bass:.9,high:.7,timeSec:11.4});await api('advance',.5);assert(change(quiet,await capture())>.01,'Audio alone must change final pixels')
  await api('set',{'motion-safety':'full','bpm-sync':true});assert.equal(inspect(await api('status')).beatLocked,true)
  await api('set',{'bpm-sync':false});assert.equal(inspect(await api('status')).beatLocked,false)
  const pauseTravel=inspect(await api('status')).travel;await api('advance',.5,{paused:true});assert.equal(inspect(await api('status')).travel,pauseTravel)
  await api('advance',.1,{paused:false});await api('music',{energy:.5,timeSec:2});assert(inspect(await api('status')).travel<.1,'Seek must reset runtime travel')
  // Multi-wrap flight on the actual production path, including drop, pause,
  // motion safety and a subsequent seek. Store timed frames and diagnostics.
  await api('reset');await api('set',{'auto-performance':false,'camera-motion':false,'pattern-change':false,pattern:'monolith','travel-speed':2,'motion-amount':1,'tunnel-depth':.75})
  await api('music',{energy:.35,bass:.2,timeSec:20,bpm:180})
  const flight=[];let last=inspect(await api('status'))
  const firstCycle=last.travelCycle
  for(let i=0;i<24;i++){
    if(i===8)await api('music',{energy:.95,bass:.9,event:'drop',eventId:80,bpm:180})
    await api('advance',.125)
    const current=inspect(await api('status'))
    assert(current.travel>=last.travel,'Flight must never reverse during playback')
    assert(current.travelVelocity>=0&&Number.isFinite(current.travelVelocity),'Invalid flight velocity')
    flight.push({frame:i,travel:current.travel,velocity:current.travelVelocity,cycle:current.travelCycle})
    await capture(`flight-${String(i).padStart(2,'0')}`);last=current
  }
  assert(last.travelCycle>=firstCycle+3,'Flight must cover multiple recycling boundaries')
  const paused=inspect(await api('advance',.25,{paused:true}));assert.equal(paused.travel,last.travel);assert.equal(paused.travelVelocity,0)
  await api('set',{'motion-safety':'lockoff'});await api('advance',.25);assert.equal(inspect(await api('status')).travel,paused.travel)
  await api('set',{'motion-safety':'full'});await api('music',{energy:.3,timeSec:2,bpm:120});assert(inspect(await api('status')).travel<.1)
  await writeFile(path.join(output,'flight.json'),JSON.stringify(flight,null,2))
  const triggerCases=[['beat','beat'],['kick','kick'],['snare','snare'],['downbeat','downbeat'],['beat2','beat'],['beat4','beat'],['bar','bar'],['bar4','bar'],['bar8','bar'],['phrase','phrase'],['drop','drop']]
  let eventId=100,time=2.2
  for(const [trigger,event] of triggerCases){
    await api('set',{'auto-performance':false,pattern:'ignition','pattern-change':true,trigger});await api('music',{energy:.8,bass:.8,event:null,timeSec:time,beatIndex:31});const start=inspect(await api('status'));time+=.2
    await api('music',{energy:.8,bass:.8,event,timeSec:time,beatIndex:32,eventId:++eventId});const after=inspect(await api('status'));assert.notEqual(after.basePattern,start.basePattern,`${trigger} must advance on its shared event`)
    await api('repeatMusic');assert.equal(inspect(await api('status')).basePattern,after.basePattern,`${trigger} must deduplicate`);time+=.2
  }
  await api('set',{'auto-performance':false,'pattern-change':true,trigger:'beat',pattern:'matrix'});assert.equal(inspect(await api('status')).basePattern,'matrix')
  await api('music',{energy:.8,event:null,timeSec:time});time+=.2;await api('music',{energy:.8,event:'beat',eventId:++eventId,timeSec:time});assert.equal(inspect(await api('status')).basePattern,'wireframe')
  await api('set',{'auto-performance':false,'pattern-change':false});await api('showInspector',true)
  const row=page.locator('[data-cinema2-control-id="purity-travel-speed"]');const measure=()=>row.evaluate(el=>({height:el.getBoundingClientRect().height,width:el.getBoundingClientRect().width}))
  const size=await measure();await api('set',{'auto-performance':true});await api('music',{energy:.9,bass:.9,build:.85,timeSec:time+.2});await api('advance',.6)
  assert.deepEqual(await measure(),size,'Auto Performance must not change row dimensions');assert(await page.locator('[data-auto-performance-locked="true"]').count()>0,'Shared Inspector must lock Design controls')
  await api('set',{'auto-performance':false});assert.equal(await page.locator('[data-auto-performance-locked="true"]').count(),0);await api('showInspector',false)
  for(const [width,height] of [[960,540],[640,640],[540,960]]){await page.setViewportSize({width,height});await api('reenter',true,'medium');await api('prepare');const s=await api('status');assert.equal(s.modules.failedModuleCount,0);assert.equal(s.render.failedPassCount,0);await capture(`resize-${width}x${height}`)}
  await api('dispose');assert.deepEqual(errors,[]);await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(`PURITY production review captures: ${output}`)
}finally{await browser?.close();server.kill()}

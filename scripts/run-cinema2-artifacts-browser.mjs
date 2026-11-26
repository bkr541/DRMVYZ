/* global window */
// Real production canvas/Inspector review. npm ci; npx playwright install chromium.
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdir,writeFile} from 'node:fs/promises'
import path from 'node:path'
import {chromium} from '@playwright/test'
import sharp from 'sharp'
const port=48700+process.pid%1000,url=`http://127.0.0.1:${port}/src/test/browser/cinema2-artifact-production.html`
const patterns={seraph:['awakening','ascension','halo','wingbeat','refraction','sanctuary','dominion','transcendence'],paradox:['knot','hypercube','interlock','inversion','orbital','prism','recursion','impossible'],relic:['dormant','awaken','roar','fracture','reconstruct','possession','siege','cataclysm'],monolith:['standby','ignition','telescope','gyroscope','unlock','convergence','overdrive','discharge']}
const cases=[['beat','beat'],['kick','kick'],['snare','snare'],['downbeat','downbeat'],['beat2','beat'],['beat4','beat'],['bar','bar'],['bar4','bar'],['bar8','bar'],['phrase','phrase'],['drop','drop']]
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:['ignore','pipe','pipe']})
let log='',browser
server.stdout.on('data',v=>log+=v);server.stderr.on('data',v=>log+=v)
const delta=(a,b)=>{assert.equal(a.length,b.length);let sum=0;for(let i=0;i<a.length;i++)sum+=Math.abs(a[i]-b[i]);return sum/a.length}
try{
 let ready=false;for(let i=0;i<150;i++){if(server.exitCode!==null)throw Error(log);try{if((await fetch(url)).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,100))}assert(ready,log)
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--ignore-gpu-blocklist'],...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})})
 const requested=process.env.CINEMA2_ARTIFACT_PRESET
 if(requested)assert(Object.hasOwn(patterns,requested),`Unknown artifact preset: ${requested}`)
 for(const [id,library] of Object.entries(patterns)){
  if(requested&&id!==requested)continue
  const output=path.resolve('artifacts/cinema2-artifacts',id),page=await browser.newPage({viewport:{width:960,height:540},deviceScaleFactor:1}),errors=[];await mkdir(output,{recursive:true})
  page.on('pageerror',e=>errors.push(e.message));await page.goto(`${url}?preset=${id}`);await page.waitForFunction(()=>!!window.__artifactProduction)
  const api=(method,...args)=>page.evaluate(({method,args})=>window.__artifactProduction[method](...args),{method,args})
  const capture=async(name)=>{const b=Buffer.from((await api('capture')).split(',')[1],'base64');if(name)await writeFile(path.join(output,`${name}.png`),b);return sharp(b).removeAlpha().raw().toBuffer()}
  const inspect=s=>s.modules.modules.find(m=>m.inspection?.performingPattern)?.inspection
  const report=[];await api('prepare');await capture('hero');await api('set',{'auto-performance':false,'motion-safety':'lockoff','camera-motion':false});const captures=[]
  for(const pattern of library){await api('set',{pattern});const raw=await capture(pattern);assert(raw.some(v=>v>15),`${id}/${pattern}: no visible output`);captures.push(raw)}
  for(let i=0;i<captures.length;i++)for(let j=0;j<i;j++)assert(delta(captures[i],captures[j])>.03,`${id}: ${library[i]} and ${library[j]} must differ`)
  assert.equal(inspect(await api('status')).shadowLights,2)
  assert.equal(inspect(await api('status')).overflow,0)
  if(id==='relic'){
   const solid=inspect(await api('status'));assert.equal(solid.relicSolidParts,6);assert(solid.relicSolidMeshes>20)
   await api('set',{pattern:'dormant','ring-enable':false});await capture('solid-skull-no-rings')
   await api('set',{'ring-enable':true})
  }
  await api('set',{'bloom':0,'atmosphere-mix':0,'finish-mix':0});await capture('effects-disabled')
  await api('set',{'motion-safety':'full','camera-motion':false});
  for(const pattern of library){await api('set',{pattern});await api('advance',.35);const a=await capture(`${pattern}-motion-a`);await api('advance',.75);const b=await capture(`${pattern}-motion-b`);report.push({pattern,motionDelta:delta(a,b)});assert(delta(a,b)>.001,`${id}/${pattern}: fixed-camera motion absent`)}
  await api('reset');await api('set',{'camera-mode':'orbit'});await api('advance',1);await capture('orbit');await api('set',{'camera-mode':'macro'});await api('advance',1);await capture('close-detail')
  for(const key of ['background','metal','secondary','strand','core','haze-tint']){await api('reset');await api('set',{'motion-safety':'lockoff','camera-motion':false});const a=await capture();await api('set',{[key]:[.05,1,.12,1]});const difference=delta(a,await capture());report.push({color:key,difference});assert(difference>.001,`${id}/${key}: unchanged pixels`)}
  await api('reset');await api('set',{'camera-motion':false});await api('music',{energy:.2,bass:.1,timeSec:10,bpm:120});await api('advance',.4);const quiet=await capture('quiet');await api('music',{energy:.9,bass:.9,high:.7,timeSec:10.4});await api('advance',.4);assert(delta(quiet,await capture('driving'))>.01)
  await api('set',{'bpm-sync':true});assert.equal(inspect(await api('status')).beatLocked,true);await api('set',{'bpm-sync':false});assert.equal(inspect(await api('status')).beatLocked,false)
  let eventId=100,time=11
  for(const [trigger,event] of cases){await api('set',{'auto-performance':false,pattern:library[0],'pattern-change':true,trigger});await api('music',{energy:.8,event:null,timeSec:time,beatIndex:31});const before=inspect(await api('status'));time+=.2;await api('music',{energy:.8,event,timeSec:time,beatIndex:32,eventId:++eventId});const after=inspect(await api('status'));assert.notEqual(before.basePattern,after.basePattern,`${id}/${trigger}`);await api('repeatMusic');assert.equal(inspect(await api('status')).basePattern,after.basePattern);time+=.2}
  await api('set',{'pattern-change':false});await api('showInspector',true);const row=page.locator(`[data-cinema2-control-id="${id}-motion-rate"]`);const measure=()=>row.evaluate(el=>({height:el.getBoundingClientRect().height,width:el.getBoundingClientRect().width}));const size=await measure();await api('set',{'auto-performance':true});await api('music',{energy:.9,bass:.9,build:.85,timeSec:time+.2});await api('advance',.5);assert.deepEqual(await measure(),size);assert(await page.locator('[data-auto-performance-locked="true"]').count()>0);await api('set',{'auto-performance':false});assert.equal(await page.locator('[data-auto-performance-locked="true"]').count(),0);await api('showInspector',false)
  for(const [width,height] of [[960,540],[640,640],[540,960]]){await page.setViewportSize({width,height});await api('reenter',true,'medium');await api('prepare');const s=await api('status');assert.equal(s.modules.failedModuleCount,0);assert.equal(s.render.failedPassCount,0);await capture(`resize-${width}x${height}`)}
  await api('dispose');assert.deepEqual(errors,[]);await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));await page.close()
 }
}finally{await browser?.close();server.kill()}

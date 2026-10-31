/* global window */
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from '@playwright/test'
import sharp from 'sharp'

// These captures contain only a canvas; remote UI fonts must not block raster validation.
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY='1'

const output=path.resolve('artifacts/cinema2-trippy-bro/rework')
const port=49000+process.pid%1000
const url=`http://127.0.0.1:${port}/src/test/browser/cinema2-trippy-bro-production.html`
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:['ignore','pipe','pipe']})
let log='',browser
server.stdout.on('data',data=>{log+=data});server.stderr.on('data',data=>{log+=data})
const patterns=['prismLattice','goldenFold','quadBloom','neonCross','liquidWeave','orbitalLace','prismEcho','chromaticKnot']
const changed=(a,b)=>{let sum=0;for(let i=0;i<a.length;i++)sum+=Math.abs(a[i]-b[i]);return sum/a.length}
const metrics=data=>{
  let lit=0,bright=0,white=0
  for(let i=0;i<data.length;i+=3){const max=Math.max(data[i],data[i+1],data[i+2]),min=Math.min(data[i],data[i+1],data[i+2]);if(max>40)lit++;if(max>200)bright++;if(min>160)white++}
  return {lit,bright,white}
}
const tiles=async(files,destination,columns=5,size=240)=>{
  const layers=[]
  for(let i=0;i<files.length;i++)layers.push({input:await sharp(files[i]).resize(size,size).toBuffer(),left:i%columns*size,top:Math.floor(i/columns)*size})
  await sharp({create:{width:columns*size,height:Math.ceil(files.length/columns)*size,channels:3,background:'#000'}}).composite(layers).png().toFile(destination)
}
try{
  await mkdir(output,{recursive:true});await mkdir(path.join(output,'sequence'),{recursive:true})
  let ready=false
  for(let i=0;i<150;i++){
    if(server.exitCode!=null)throw new Error(log)
    try{if((await fetch(url)).ok){ready=true;break}}catch{/* starting */}
    await new Promise(resolve=>setTimeout(resolve,100))
  }
  assert(ready,log)
  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})})
  const page=await browser.newPage({viewport:{width:540,height:540},deviceScaleFactor:1})
  const errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('favicon'))errors.push(m.text())})
  await page.goto(url);await page.waitForFunction(()=>Boolean(window.__trippyBroProduction))
  const api=(method,...args)=>page.evaluate(({method,args})=>window.__trippyBroProduction[method](...args),{method,args})
  const raw=async(file)=>sharp(await page.screenshot(file?{path:file,timeout:60000}:{timeout:60000})).removeAlpha().raw().toBuffer()
  const report={patterns:[],transitions:[],controls:[],errors}
  if(!process.argv.includes('--sequence-only')){
    // Five moving checkpoints per family: same renderer, advancing shared transport.
    const gallery=[]
    for(const pattern of patterns){
      const reuse=process.argv.includes('--resume')&&!['quadBloom'].includes(pattern)
      if(!reuse){await api('music',{timeSec:0,energy:0});await api('reenter',false)}
      if(!reuse)await api('set',{pattern,reactivity:0,'pattern-change':false})
      if(!reuse)await api('prepare')
      assert.deepEqual(errors,[])
      let previous=null
      const samples=[]
      for(let i=0;i<5;i++){
        if(i&&!reuse)await api('advance',0.40)
        const file=path.join(output,`${pattern}-${i}.png`),data=reuse?await sharp(file).removeAlpha().raw().toBuffer():await raw(file)
        if(previous)assert(changed(previous,data)>0.15,`${pattern} requires meaningful internal motion`)
        samples.push({...metrics(data),delta:previous?changed(previous,data):0});previous=data;gallery.push(file)
      }
      const occupancy=samples.map(s=>s.lit)
      assert(samples.some(s=>s.bright>100),`${pattern} must have luminous highlights`)
      report.patterns.push({pattern,samples,occupancyRange:Math.max(...occupancy)-Math.min(...occupancy)})
    }
    await tiles(gallery,path.join(output,'motion-contact-sheet.png'))
    await page.setViewportSize({width:540,height:540});await api('prepare')
    // Controls keep hard-zero semantics after the motion and lighting rewrite.
    await api('set',{pattern:'prismLattice',speed:0,reactivity:0,bloom:0,trails:0,echo:0})
    const fixed=await raw();await api('advance',0.5);assert(changed(fixed,await raw())<0.01,'Zero speed')
    await api('set',{speed:1,amount:0});const still=await raw();await api('advance',0.4);assert(changed(still,await raw())<0.01,'Zero amount')
    await api('set',{amount:0.45,speed:0})
    for(const [key,low,high]of [['width',0.6,2],['density',5,21],['scale',0.55,1.25],['detail',0,1],['bloom',0,0.7],['echo',0,1],['split',0,1]]){
      await api('set',{[key]:low});const a=await raw();await api('set',{[key]:high});const b=await raw()
      const delta=changed(a,b);assert(delta>0.04,`${key} visible consumer`);report.controls.push({key,delta});await api('reset');await api('set',{speed:0,reactivity:0})
    }
    for(const color of ['background','cyan','blue','magenta','amber','highlight']){
      const a=await raw();await api('set',{[color]:[0.1,1,0.1,1]});const b=await raw();assert(changed(a,b)>0.02,`${color} consumer`)
      await api('reset');await api('set',{speed:0,reactivity:0})
    }
    await api('set',{intensity:0,bloom:0.7,trails:0.65,echo:1,split:1});assert((await raw()).every(v=>v===0),'Master zero clears all emitted light')
  }
  // Canonical events drive a reference-like sequence; capture every intermediate frame at 12 fps.
  await api('music',{timeSec:0,energy:0});await api('reenter',false)
  await api('set',{'pattern-change':true,trigger:'beat',reactivity:0,trails:0.45})
  const frameFiles=[],transitionFiles=[]
  let eventIndex=0
  const changes=new Map([[18,1],[30,2],[54,3],[66,4],[90,5]])
  for(let i=0;i<108;i++){
    if(i)await api('advance',1/12)
    if(changes.has(i)){
      const state=await api('status')
      await api('music',{timeSec:state.transport.timeSec,event:'beat',eventId:++eventIndex,beatIndex:eventIndex,energy:0})
    }
    const file=path.join(output,'sequence',`${String(i).padStart(4,'0')}.png`)
    await raw(file);frameFiles.push(file)
    if(i>=30&&i<=39)transitionFiles.push(file)
  }
  await tiles(transitionFiles,path.join(output,'fan-handoff.png'),5)
  await tiles(frameFiles.filter((_,i)=>i%6===0),path.join(output,'sequence-contact-sheet.png'),6)
  const video=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-framerate','12','-i',path.join(output,'sequence','%04d.png'),'-c:v','libx264','-pix_fmt','yuv420p','-crf','19',path.join(output,'reference-rework.mp4')],{encoding:'utf8'})
  assert.equal(video.status,0,video.stderr)
  // Ghost-free endpoint proof: a manual selection of the same final family must not remove old scene silhouettes.
  await api('set',{speed:0,reactivity:0,amount:0,trails:0.65,'pattern-change':true,trigger:'beat',pattern:'goldenFold'})
  let state=await api('status')
  await api('music',{timeSec:state.transport.timeSec,event:'beat',eventId:900,beatIndex:900,energy:0})
  await api('advance',0.70)
  const automated=await raw(path.join(output,'transition-end.png'))
  state=await api('set',{pattern:'quadBloom','pattern-change':false})
  const manual=await raw();assert(changed(automated,manual)<0.02,'Shared history cannot retain an outgoing topology')
  assert.equal(state.parameters.persistentValues['trippy-bro-pattern'],'quadBloom')
  report.transitions.push({historyEndpointDifference:changed(automated,manual),frames:frameFiles.length})
  // Four-edge overscan and aspect preservation, using the largest original reference family.
  await api('set',{pattern:'prismLattice',speed:0,amount:0,trails:0,bloom:0.42})
  for(const [name,width,height]of [['square',954,954],['landscape',1280,720],['portrait',720,1280]]){
    await page.setViewportSize({width,height});await api('prepare')
    await raw(path.join(output,`${name}.png`))
    const state=await api('status');assert.equal(state.render.failedPassCount,0)
  }
  report.final=await api('status')
  const disposed=await api('dispose');assert.equal(disposed.snapshot.resources.activeWebGLContextCount,0)
  assert.equal(report.final.modules.failedModuleCount,0);assert.equal(report.final.effects.failedEffectCount,0)
  assert.deepEqual(errors,[])
  await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2))
  console.log(`Trippy, Bro rework checks passed. Motion, component transitions, emission, controls and sequence: ${output}`)
}finally{await browser?.close();server.kill('SIGTERM')}

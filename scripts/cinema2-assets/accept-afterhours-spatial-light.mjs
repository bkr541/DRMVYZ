// Focused production-path visual evidence for Afterhours beam optics and air.
import { mkdir, writeFile } from 'node:fs/promises'
import { execFileSync, spawn } from 'node:child_process'
import { once } from 'node:events'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import { chromium } from '@playwright/test'
import sharp from 'sharp'
const root=resolve(import.meta.dirname,'../..'),out=resolve(root,'artifacts/cinema2-afterhours-spatial-light')
const baseline=process.argv.includes('--baseline')
await mkdir(out,{recursive:true})
const rendererPath='src/components/vyzualz/cinema2/modules/afterhours/Cinema2AfterhoursRenderer.ts'
const oldRenderer=baseline?execFileSync('git',['show',`HEAD:${rendererPath}`],{cwd:root,encoding:'utf8'}):null
const server=await createServer({root,server:{host:'127.0.0.1',port:0},clearScreen:false,plugins:[{name:'afterhours-spatial-acceptance',enforce:'pre',load(id){
  if(oldRenderer&&id===resolve(root,rendererPath))return oldRenderer.replace('  getSnapshot():','  estimateGpuBytes() { return 0 }\n  getSnapshot():')
},configureServer(s){s.middlewares.use('/__afterhours-spatial',(_q,r)=>{r.setHeader('Content-Type','text/html');r.end('<html><body style="margin:0;background:black"><canvas width="960" height="540"></canvas></body></html>')})}}]})
const errors=[],checks=[],metrics={}
const check=(ok,message)=>{if(!ok)throw new Error(message);checks.push(message)}
let browser
try{
await server.listen();browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'})
const page=await browser.newPage({viewport:{width:960,height:540}})
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGL/.test(m.text()))errors.push(m.text())})
await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__afterhours-spatial`)
await page.evaluate(async()=>{
const {Cinema2Runtime}=await import('/src/components/vyzualz/cinema2/runtime/Cinema2Runtime.ts')
const preset=await import('/src/components/vyzualz/cinema2/presets/Cinema2AfterhoursPreset.ts')
const {Cinema2PresetRegistry}=await import('/src/components/vyzualz/cinema2/presets/Cinema2PresetRegistry.ts')
const {AudioFeatureBus}=await import('/src/features/musicIntelligence/AudioFeatureBus.ts')
const {nightshiftMusicFixture}=await import('/src/test/support/NightshiftMusicFixture.ts')
let runtime,next,time=0,timestamp=0,paused=false,audio=false,sequence=0,fixture={},cameraOffset=0
const tick=(count=1,advance=true)=>{for(let i=0;i<count;i++){timestamp+=1000/60;if(advance&&!paused)time+=1000/60;if(audio)AudioFeatureBus.setFrame(nightshiftMusicFixture({energy:0,...fixture,timeSec:time/1000,frameId:++sequence}));next(timestamp)}}
const boot=(offset=0,quality='high')=>{
  runtime?.dispose();AudioFeatureBus.reset();time=0;timestamp=0;paused=false;audio=false;cameraOffset=offset
  const registry=new Cinema2PresetRegistry()
  const manifest={...preset.CINEMA2_AFTERHOURS_PRESET_MANIFEST,cameras:preset.CINEMA2_AFTERHOURS_PRESET_MANIFEST.cameras.map(c=>({...c,transform:{...c.transform,position:[c.transform.position[0]+cameraOffset,c.transform.position[1],c.transform.position[2]]}}))}
  const registered=registry.register(manifest);if(!registered.ok)throw new Error(JSON.stringify(registered.diagnostics))
  const made=Cinema2Runtime.create(globalThis.document.querySelector('canvas'),{presetId:preset.CINEMA2_AFTERHOURS_PRESET_ID,presetRegistry:registry,renderQuality:quality,activationEntropy:()=> 'afterhours-spatial-light',diagnosticsEnabled:true,requestAnimationFrame:cb=>{next=cb;return 1},cancelAnimationFrame:()=>{},transportSource:{getState:()=>({sourcePresent:true,playing:!paused,paused,animationActive:!paused,analysisActive:true,timeSec:time/1000,trackId:audio?'nightshift-audio-fixture':'afterhours-spatial-fixture',bpm:120})}})
  if(!made.runtime)throw new Error(JSON.stringify(made.error));runtime=made.runtime;runtime.resize({width:960,height:540,dpr:1});runtime.start();tick(60)
}
boot()
globalThis.afterhoursSpatial={tick,boot,
previewFrame(){time+=1000/24;timestamp+=1000/24;next(timestamp)},
benchmark(){const gl=globalThis.document.querySelector('canvas').getContext('webgl2');gl.finish();const start=globalThis.performance.now();tick(30);gl.finish();return (globalThis.performance.now()-start)/30},
set(values){for(const[name,value]of Object.entries(values)){const id=name==='quality'?'quality-mode':`afterhours-${name}`;const result=runtime.getParameterState().setPersistentValue(id,value);if(!result.ok)throw new Error(JSON.stringify(result))}tick(40,false)},
music(options){audio=true;fixture=options;tick(30)},pause(value){paused=value;tick(40,false)},
resize(width,height){runtime.resize({width,height,dpr:1});tick(40,false)},
status:()=>({render:runtime.getRenderGraphExecutorSnapshot(),modules:runtime.getModuleRuntimeSnapshot(),effects:runtime.getEffectRuntimeSnapshot(),camera:runtime.getCameraRuntimeSnapshot().camera}),
dispose(){runtime.dispose();return runtime.getResourceManagerSnapshot()},
}
})
if(process.argv.includes('--preview')){
  const encoder=spawn('/opt/homebrew/bin/ffmpeg',['-y','-loglevel','error','-f','image2pipe','-framerate','24','-i','pipe:0','-c:v','libx264','-pix_fmt','yuv420p','-crf','20','-movflags','+faststart',resolve(out,'afterhours-spatial-light.mp4')],{stdio:['pipe','inherit','inherit']})
  const completion=once(encoder,'close')
  for(let i=0;i<216;i++){
    if(i%72===0)await page.evaluate(p=>globalThis.afterhoursSpatial.set({pattern:p}),['wideFan','splitWings','crossCanopy'][Math.floor(i/72)])
    await page.evaluate(()=>globalThis.afterhoursSpatial.previewFrame())
    const bytes=await page.locator('canvas').screenshot({type:'jpeg',quality:90})
    if(!encoder.stdin.write(bytes))await once(encoder.stdin,'drain')
  }
  encoder.stdin.end();const[code]=await completion;if(code!==0)throw new Error('Preview encoding failed')
  await page.evaluate(()=>globalThis.afterhoursSpatial.dispose());console.log('Production optics preview recorded.')
}else{
const set=v=>page.evaluate(x=>globalThis.afterhoursSpatial.set(x),v)
const tick=(count,advance=true)=>page.evaluate(v=>globalThis.afterhoursSpatial.tick(v.count,v.advance),{count,advance})
const shot=async name=>sharp(await page.locator('canvas').screenshot({path:resolve(out,`${baseline?'before':'after'}-${name}.png`)})).removeAlpha().raw().toBuffer()
const diff=(a,b)=>a.reduce((sum,v,i)=>sum+Math.abs(v-b[i]),0)/a.length
const luminance=bytes=>{let lit=0,cloud=0,black=0,total=0;for(let i=0;i<bytes.length;i+=3){const v=Math.max(bytes[i],bytes[i+1],bytes[i+2]);total+=v;if(v>150)lit++;if(v>5&&v<100)cloud++;if(v<3)black++}return{mean:total/(bytes.length/3),lit:lit/(bytes.length/3),cloud:cloud/(bytes.length/3),black:black/(bytes.length/3)}}
const authored=await shot('authored');metrics.authored=luminance(authored)
for(const pattern of ['wideFan','splitWings','crossCanopy']){await set({pattern});await tick(30);await shot(pattern)}
if(!baseline){
await page.evaluate(()=>globalThis.afterhoursSpatial.boot())
const frames=[]
for(const atmosphere of [0,.55,1]){await set({atmosphere});frames.push(await shot(`atmosphere-${atmosphere}`))}
metrics.atmosphere=frames.map(luminance)
check(diff(frames[0],frames[1])>.15&&diff(frames[1],frames[2])>.15,'Atmosphere OFF/default/max visibly changes shared air')
let cloudPixels=0;for(let i=0;i<frames[0].length;i+=3){const off=Math.max(...frames[0].subarray(i,i+3)),on=Math.max(...frames[1].subarray(i,i+3));if(off<4&&on>8&&on<100)cloudPixels++}
metrics.airBetweenBeams=cloudPixels/(frames[0].length/3)
check(metrics.airBetweenBeams>.01,'Default haze illuminates space beyond the narrow laser cores')
check(metrics.atmosphere[0].lit>.0005,'Crisp laser cores remain visible with Atmosphere OFF')
check(metrics.atmosphere[1].black>.3&&metrics.atmosphere[2].black>.15,'Default and maximum atmosphere retain a dark environment')
await set({'master-intensity':0});check(luminance(await shot('master-zero')).mean<.15,'Master zero extinguishes cores and shared cloud')
await set({'master-intensity':.75,atmosphere:.55,'primary-color':[1,.02,.01,1],'accent-color':[1,.02,.01,1]});const red=await shot('red-air')
let redEnergy=0,blueEnergy=0;for(let i=0;i<red.length;i+=3){redEnergy+=red[i];blueEnergy+=red[i+2]}check(redEnergy>blueEnergy*1.4,'The shared cloud follows the authored laser palette')
await page.evaluate(()=>globalThis.afterhoursSpatial.boot());await set({'motion-amount':0});const beforeMotion=await shot('air-start');await tick(120);const afterMotion=await shot('air-drift');metrics.motionDifference=diff(beforeMotion,afterMotion);check(metrics.motionDifference>.05,'World-space haze evolves while active')
await page.evaluate(()=>globalThis.afterhoursSpatial.pause(true));const paused=await shot('paused');await tick(80);check(diff(paused,await shot('paused-held'))<.03,'Pause freezes beam cues and cloud advection')
await page.evaluate(()=>globalThis.afterhoursSpatial.boot());const center=await shot('camera-center');await page.evaluate(()=>globalThis.afterhoursSpatial.boot(1.2));const side=await shot('camera-offset');metrics.parallaxDifference=diff(center,side);check(metrics.parallaxDifference>.5,'The final shared camera changes beam perspective and cloud sampling')
await page.evaluate(()=>globalThis.afterhoursSpatial.boot());await set({pattern:'crossCanopy'})
for(const quality of ['low','medium','high']){await page.evaluate(q=>globalThis.afterhoursSpatial.boot(0,q),quality);await set({pattern:'crossCanopy'});await shot(`quality-${quality}`);metrics[`${quality}MsPerFrame`]=await page.evaluate(()=>globalThis.afterhoursSpatial.benchmark());const s=await page.evaluate(()=>globalThis.afterhoursSpatial.status());check(!s.render.failedPassCount&&!s.modules.failedModuleCount&&!s.effects.failedEffectCount,`${quality} tier renders beams and shared air`)}
for(const [width,height]of [[640,640],[540,960],[960,540]]){await page.setViewportSize({width,height});await page.evaluate(v=>globalThis.afterhoursSpatial.resize(...v),[width,height]);check(luminance(await shot(`aspect-${width}-${height}`)).lit>.0005,`${width}x${height} retains visible beams`)}
await page.evaluate(()=>globalThis.afterhoursSpatial.boot());await page.evaluate(()=>globalThis.afterhoursSpatial.music({energy:1,bass:1,event:'kick',eventId:7}));await shot('audio-hit')
const s=await page.evaluate(()=>globalThis.afterhoursSpatial.status());check(!s.render.failedPassCount&&!s.modules.failedModuleCount&&!s.effects.failedEffectCount&&!errors.length,'Production music path has no shader, GL, module or effect failures')
await page.evaluate(()=>globalThis.afterhoursSpatial.boot());const restored=await shot('reentry');check(diff(authored,restored)<.1,'Re-entry restores authored geometry and atmosphere')
}
const disposed=await page.evaluate(()=>globalThis.afterhoursSpatial.dispose());check(disposed.activeLeaseCount===0&&disposed.estimatedGpuMemoryBytes===0,'Disposal releases engine-owned targets and module leases')
check(errors.length===0,'No browser or shader errors')
await writeFile(resolve(out,baseline?'before-report.json':'report.json'),JSON.stringify({checks,metrics,errors},null,2));console.log(JSON.stringify({checks,metrics,errors},null,2))
}
}finally{await browser?.close();await server.close()}

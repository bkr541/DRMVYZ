/* global window, study, getComputedStyle */
// Native Phase 2 preview and focused rendered control/motion checks.
import { mkdir,writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import { chromium } from '@playwright/test'
import sharp from 'sharp'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
const root=resolve(import.meta.dirname,'../..'),out=resolve(root,'artifacts/switch-it-phase2')
await mkdir(out,{recursive:true})
const script=`
const Refresh=(await import('/@react-refresh')).default;Refresh.injectIntoGlobalHook(globalThis);globalThis.$RefreshReg$=()=>{};globalThis.$RefreshSig$=()=>type=>type;globalThis.__vite_plugin_react_preamble_installed__=true;
const {Cinema2Runtime}=await import('/src/components/vyzualz/cinema2/runtime/Cinema2Runtime.ts');
const {createSwitchItPhase2Registries,SWITCH_IT_PHASE2_ID,switchItParameter}=await import('/src/components/vyzualz/cinema2/presets/Cinema2SwitchItPhase2Preset.ts');
let refreshInspector=()=>{};let pending,time=0,playing=false,track='phase2-review',bpm=120,hostSync=true,source=true,runtime;
const options={...createSwitchItPhase2Registries(),presetId:SWITCH_IT_PHASE2_ID,renderQuality:'high',diagnosticsEnabled:true,requestAnimationFrame:cb=>{pending=cb;return 1},cancelAnimationFrame:()=>{},transportSource:{getState:()=>({sourcePresent:source,playing,analysisActive:false,paused:!playing,animationActive:playing,trackId:track,timeSec:time/1000,bpm,bpmSync:hostSync})}};
const tick=(count=1)=>{for(let i=0;i<count;i++){wall+=1000/60;if(playing)time+=1000/60;pending(wall)}};let wall=0;
function enter(){const created=Cinema2Runtime.create(document.querySelector('canvas'),options);if(!created.runtime)throw Error(JSON.stringify(created));runtime=created.runtime;runtime.resize({width:640,height:640,dpr:1});runtime.start();tick()}
enter();
const set=values=>{for(const[name,value]of Object.entries(values))runtime.getParameterState().setPersistentValue(switchItParameter(name),value);tick(20);refreshInspector()};
window.study={tick,set,play:value=>{playing=value;tick()},tempo:(value,sync=true)=>{bpm=value;hostSync=sync;tick()},
reset(){time=0;track='review-'+Date.now();tick(2)},noSource(value){source=!value;playing=!value;tick()},
resize(w,h){runtime.resize({width:w,height:h,dpr:1});tick(3)},
status:()=>({render:runtime.getRenderGraphExecutorSnapshot(),modules:runtime.getModuleRuntimeSnapshot(),resources:runtime.getResourceManagerSnapshot(),camera:runtime.getCameraRuntimeSnapshot().camera}),
reenter(){const saved=runtime.serializeParameterState();runtime.dispose();const retired=runtime.getResourceManagerSnapshot();enter();runtime.getParameterState().restore(saved);tick(20);refreshInspector();return retired},
dispose(){runtime.dispose();return runtime.getResourceManagerSnapshot()}};
const ReactModule=await import('/node_modules/.vite/deps/react.js'),React=ReactModule.default??ReactModule,ClientModule=await import('/node_modules/.vite/deps/react-dom_client.js'),Client=ClientModule.default??ClientModule;
await import('/src/styles.css');await import('/src/styles/appearance.css');await import('/src/styles/groupSpacing.css');await import('/src/styles/reactView.css');await import('/src/styles/typography.css');
const {Cinema2InspectorPanel}=await import('/src/components/vyzualz/react/Cinema2InspectorPanel.tsx');const inspector=Client.createRoot(document.querySelector('#inspector'));refreshInspector=()=>inspector.render(React.createElement(Cinema2InspectorPanel,{runtime,surface:'design',sharedAudioAnalysis:false}));refreshInspector();window.inspectorReady=true;
document.querySelector('#play').onclick=()=>{playing=!playing;document.querySelector('#play').textContent=playing?'Pause preview':'Play preview'};
let previous=performance.now();function preview(now){if(window.autoPreview){const count=Math.min(4,Math.floor((now-previous)/(1000/60)));if(count){tick(count);previous=now}}else previous=now;requestAnimationFrame(preview)}requestAnimationFrame(preview);
`
const html=`<html><head><meta charset="UTF-8"><link rel="icon" href="data:,"></head><body style="margin:0;background:#080c10;color:#ccd3d5"><main style="display:flex"><section><button id="play">Play preview</button><canvas width="640" height="640" style="display:block"></canvas><p style="font:12px system-ui">Phase 2 development preview · supplied Demon Mask by egorova.e · CC BY 4.0 · textures resized and red lighting by DRMVYZ.</p></section><aside id="inspector" style="width:380px;height:100vh;overflow:auto"></aside></main><script type="module">${script}</script></body></html>`
const server=await createServer({root,clearScreen:false,server:{host:'127.0.0.1',port:0},plugins:[{name:'switch-it-phase2',configureServer(s){s.middlewares.use('/__switch-it-phase2',(_req,res)=>{res.setHeader('content-type','text/html');res.end(html.replace('window.study={','window.autoPreview='+process.argv.includes('--serve')+';window.study={'))})}}]})
let browser
const errors=[],checks=[]
try{
 await server.listen();const url=`http://127.0.0.1:${server.httpServer.address().port}/__switch-it-phase2`
 if(process.argv.includes('--serve')){console.log('Switch It Phase 2 review: '+url);await new Promise(()=>{})}
 browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'})
 const page=await browser.newPage({viewport:{width:1040,height:740}})
 page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text())})
 await page.goto(url);await page.waitForFunction(()=>{if(!window.study)return false;study.tick();return study.status().modules.modules.some(module=>module.activeResourceLeaseCount>0)}).catch(async error=>{console.error(JSON.stringify({errors,status:await page.evaluate(()=>window.study?.status())},null,2));throw error});await page.waitForFunction(()=>window.inspectorReady);await page.evaluate(()=>study.tick(20))
 const set=values=>page.evaluate(v=>study.set(v),values)
 const shot=async name=>sharp(await page.locator('canvas').screenshot({path:resolve(out,name+'.png')})).removeAlpha().raw().toBuffer()
 const difference=(a,b)=>a.reduce((n,v,i)=>n+Math.abs(v-b[i]),0)/a.length
 const assertDifferent=(a,b,name,min=.03)=>{const diff=difference(a,b);if(diff<min)throw Error(name+' is visually inert: '+diff);checks.push({name,difference:diff})}
 const advance=seconds=>page.evaluate(n=>study.tick(n),Math.round(seconds*60))
 const pause=()=>page.evaluate(()=>study.play(false)),play=()=>page.evaluate(()=>study.play(true))
 const reset=()=>page.evaluate(()=>study.reset())
 if(process.argv.includes('--inspector-only')){
  await set({pattern:'split-portrait',patternChange:true});await page.waitForSelector('[data-cinema2-control-id="switch-it-trigger"]');
  if(await page.getByText('No Cinema 2.0 parameters are declared for this workspace.').count())throw Error('False empty Inspector notice')
  const groups=await page.locator('[data-cinema2-parent-group]').count();if(groups!==4)throw Error('Canonical groups missing')
  await page.locator('[data-cinema2-control-id="switch-it-trigger"]').getByRole('combobox').click()
  const options=page.getByRole('option');if(await options.count()!==11)throw Error('Trigger choices missing')
  const fonts=await options.evaluateAll(items=>items.map(item=>getComputedStyle(item.querySelector('.drm-dropdown__option-label')).fontSize));if(fonts.some(font=>font!=='11px'))throw Error('Trigger typography differs')
  await page.getByRole('listbox').evaluate(el=>el.getAnimations({subtree:true}).forEach(animation=>animation.finish()))
  await page.screenshot({path:resolve(out,'inspector.png')});await page.keyboard.press('Escape');await page.screenshot({path:resolve(out,'inspector-controls.png')})
  const disposed=await page.evaluate(()=>study.dispose());if(disposed.activeLeaseCount||disposed.estimatedGpuMemoryBytes||errors.length)throw Error(JSON.stringify({errors,disposed}))
  console.log(JSON.stringify({groups,options:11,fonts:[...new Set(fonts)],errors,disposedLeases:disposed.activeLeaseCount}))
 }else{
 const patterns=['switch-cycle','split-portrait','twin-reveal','facet-peel','skull-projection','crown-surge']
 for(const pattern of patterns){
  await pause();await set({pattern,bpmSync:false});await reset();const first=await shot(pattern+'-start');await play();await advance(.85);await pause();const moving=await shot(pattern+'-mid');
  if(pattern!=='split-portrait')assertDifferent(first,moving,pattern+' motion',.005)
  else if(difference(first,moving)>.01)throw Error('Manual split drifts')
  const held=await shot(pattern+'-paused');await advance(1);if(difference(held,await shot(pattern+'-held'))>.01)throw Error('Paused program moves: '+pattern)
 }
 // The active pose is held during control comparisons; use the program where each control has a real consumer.
 for(const [name,values,pattern,seconds]of[
  ['master',[0,1,1.5],'split-portrait',0],['portraitScale',[.65,1,1.2],'split-portrait',0],['reveal',[0,.5,1],'split-portrait',0],['relief',[0,.06,.12],'split-portrait',0],
  ['reach',[0,.35,.8],'facet-peel',.85],['eyeIntensity',[0,1,2],'split-portrait',0],['columnIntensity',[0,1,2],'skull-projection',0],['fragmentAmount',[0,.5,1],'facet-peel',.85],['flareStrength',[0,.35,1],'crown-surge',1.05],
 ]){
  await pause();await set({pattern,flareEnabled:name==='flareStrength',portraitScale:1});await reset();await play();await advance(seconds);await pause()
  const pixels=[];for(const value of values){await set({[name]:value});pixels.push(await shot(`${name}-${value}`))}
  assertDifferent(pixels[0],pixels[1],name+' min/default');assertDifferent(pixels[1],pixels[2],name+' default/max');await set({[name]:values[1]})
 }
 await set({pattern:'split-portrait',master:1,flareEnabled:false,eyesEnabled:true});const eyes=await shot('eyes-on');await set({eyesEnabled:false});assertDifferent(eyes,await shot('eyes-off'),'Eyes Enabled');await set({eyesEnabled:true})
 await set({pattern:'crown-surge',flareEnabled:true});await reset();await play();await advance(1.05);await pause();const flare=await shot('flare-on');await set({flareEnabled:false});assertDifferent(flare,await shot('flare-off'),'Flare Enabled')
 for(const name of ['background','shell','rim','skull','energy','column']){await set({pattern:'split-portrait'});const base=await shot(name+'-base');await set({[name]:[.02,.5,.05,1]});assertDifferent(base,await shot(name+'-green'),'Palette '+name)}
 await set({background:[.001,.002,.005,1],shell:[.012,.023,.045,1],rim:[.66,.79,.9,1],skull:[.95,.12,.19,1],energy:[.85,.98,1,1],column:[.8,.005,.09,1],relief:0,fragmentAmount:1,reach:.35,pattern:'switch-cycle',speed:1,bpmSync:true})
 // Both sync permissions affect authored cadence; toggles don't reset the pose.
 await page.evaluate(()=>study.tempo(60));await reset();await play();await advance(.9);await pause();const sync=await shot('sync-60')
 await set({bpmSync:false});const beforeToggle=await shot('sync-toggle');if(difference(sync,beforeToggle)>.01)throw Error('Sync toggle jumped the pose')
 await reset();await play();await advance(.9);await pause();assertDifferent(sync,await shot('free-running'),'BPM Sync cadence',.2)
 await set({bpmSync:true});await page.evaluate(()=>study.tempo(60,false));await reset();await play();await advance(.9);await pause();const hostOff=await shot('host-sync-off');const free=await sharp(resolve(out,'free-running.png')).removeAlpha().raw().toBuffer();if(difference(hostOff,free)>.1)throw Error('Host sync OFF ignored')
 await set({speed:0});const frozen=await shot('speed-zero');await play();await advance(1);await pause();if(difference(frozen,await shot('speed-zero-held'))>.01)throw Error('Motion Speed zero does not hold')
 await set({speed:1,pattern:'split-portrait',reveal:.5})
 for(const [width,height]of[[960,540],[540,960],[640,640]]){await page.setViewportSize({width:Math.max(1040,width),height:Math.max(740,height+60)});await page.evaluate(v=>study.resize(...v),[width,height]);await shot(`aspect-${width}-${height}`);const status=await page.evaluate(()=>study.status());if(status.render.failedPassCount||status.modules.failedModuleCount)throw Error('Aspect render failed');if(JSON.stringify(status.camera.position)!=='[0,0,5]'||JSON.stringify(status.camera.target)!=='[0,0,0]')throw Error('Camera framing moved')}
 await page.setViewportSize({width:1040,height:740});await page.waitForSelector('[data-cinema2-parent-group]')
 const groups=await page.locator('[data-cinema2-parent-group]').count();if(groups!==4)throw Error('Expected four parent groups; got '+groups)
 await set({patternChange:true});await page.locator('[data-cinema2-control-id="switch-it-trigger"]').getByRole('combobox').click();if(await page.getByRole('option').count()!==11)throw Error('Canonical Trigger options missing')
 const fonts=await page.getByRole('option').evaluateAll(options=>options.map(option=>getComputedStyle(option.querySelector('.drm-dropdown__option-label')).fontSize));if(fonts.some(font=>font!=='11px'))throw Error('Trigger typography differs')
 await page.getByRole('listbox').evaluate(el=>el.getAnimations({subtree:true}).forEach(animation=>animation.finish()));await page.screenshot({path:resolve(out,'inspector.png')});await page.keyboard.press('Escape');await set({patternChange:false})
 const before=await shot('before-reentry'),retired=await page.evaluate(()=>study.reenter());await page.waitForFunction(()=>{study.tick();return study.status().modules.modules.some(m=>m.activeResourceLeaseCount>0)});await page.evaluate(()=>study.tick(20));if(difference(before,await shot('after-reentry'))>.01)throw Error('Reentry changed authored static output');if(retired.activeLeaseCount||retired.estimatedGpuMemoryBytes)throw Error('Retired resources leaked')
 // Short native-canvas film: each program gets a full free-running cycle.
 const encoder=spawn('/opt/homebrew/bin/ffmpeg',['-y','-loglevel','error','-f','image2pipe','-framerate','12','-i','pipe:0','-c:v','libx264','-pix_fmt','yuv420p','-crf','20','-movflags','+faststart',resolve(out,'six-patterns.mp4')],{stdio:['pipe','inherit','inherit']});const completion=once(encoder,'close')
 for(const pattern of patterns){await pause();await set({pattern,bpmSync:false});await reset();await play();for(let i=0;i<30;i++){await page.evaluate(()=>study.tick(5));const bytes=await page.locator('canvas').screenshot({type:'jpeg',quality:85});if(!encoder.stdin.write(bytes))await once(encoder.stdin,'drain')}}encoder.stdin.end();const[code]=await completion;if(code!==0)throw Error('Motion recording failed')
 const status=await page.evaluate(()=>study.status());if(status.render.failedPassCount||status.modules.failedModuleCount||status.modules.degradedModuleCount)throw Error(JSON.stringify(status));const disposed=await page.evaluate(()=>study.dispose());if(disposed.activeLeaseCount||disposed.estimatedGpuMemoryBytes)throw Error('Disposal leaked resources');if(errors.length)throw Error(errors.join('\n'))
 await writeFile(resolve(out,'report.json'),JSON.stringify({checks,groups,errors,retired,disposed},null,2));console.log(JSON.stringify({checks:checks.length,groups,errors,disposedLeases:disposed.activeLeaseCount},null,2))
 }
}finally{await browser?.close();await server.close()}

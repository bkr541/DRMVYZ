/* global window, study */
// Real Cinema 2.0 path: deterministic shared publications plus actual analyzed reference playback.
import { mkdir,writeFile,readFile } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { createServer } from 'vite'
import { chromium } from '@playwright/test'
import sharp from 'sharp'
const root=resolve(import.meta.dirname,'../..'),out=resolve(root,'artifacts/switch-it-phase3'),audioPath=resolve(out,'reference-audio.m4a')
await mkdir(out,{recursive:true})
execFileSync('/opt/homebrew/bin/ffmpeg',['-y','-loglevel','error','-i','/Users/kodyrobinson/Desktop/SwitchIt.mov','-vn','-c:a','copy',audioPath])
const script=`
const Refresh=(await import('/@react-refresh')).default;Refresh.injectIntoGlobalHook(globalThis);globalThis.$RefreshReg$=()=>{};globalThis.$RefreshSig$=()=>type=>type;globalThis.__vite_plugin_react_preamble_installed__=true;
const {Cinema2Runtime}=await import('/src/components/vyzualz/cinema2/runtime/Cinema2Runtime.ts');
const {createSwitchItPhase3Registries,SWITCH_IT_PHASE3_ID}=await import('/src/components/vyzualz/cinema2/presets/Cinema2SwitchItPhase3Preset.ts');
const {switchItParameter}=await import('/src/components/vyzualz/cinema2/presets/Cinema2SwitchItPhase2Preset.ts');
const {AudioFeatureBus}=await import('/src/features/musicIntelligence/AudioFeatureBus.ts');
const {nightshiftMusicFixture}=await import('/src/test/support/NightshiftMusicFixture.ts');
let runtime,pending,time=0,wall=0,playing=${!process.argv.includes('--serve')},enabled=false,profile={},event=null,sequence=0,track='nightshift-audio-fixture',bpm=120,hostSync=false,refresh=()=>{},real=null;
const options={...createSwitchItPhase3Registries(),presetId:SWITCH_IT_PHASE3_ID,renderQuality:'high',diagnosticsEnabled:true,requestAnimationFrame:cb=>{pending=cb;return 1},cancelAnimationFrame:()=>{},transportSource:{getState:()=>({sourcePresent:true,playing,paused:!playing,analysisActive:enabled,trackId:track,timeSec:time/1000,bpm,bpmSync:hostSync})}};
const tick=(n=1)=>{for(let i=0;i<n;i++){wall+=1000/60;if(playing)time+=1000/60;if(enabled&&!real){let frame=nightshiftMusicFixture({timeSec:time/1000,frameId:++sequence,trackId:track,energy:0,...profile,event:event?.event??null,eventId:event?.id??sequence});if(event?.event==='transient')frame={...frame,rhythm:{...frame.rhythm,transient:1,transientConfidence:.95}};AudioFeatureBus.setFrame(frame);event=null}pending(wall)}};
function enter(){const result=Cinema2Runtime.create(document.querySelector('canvas'),options);if(!result.runtime)throw Error(JSON.stringify(result));runtime=result.runtime;runtime.resize({width:640,height:640,dpr:1});runtime.start();tick()};enter();
const set=values=>{for(const[name,value]of Object.entries(values)){const result=runtime.getParameterState().setPersistentValue(switchItParameter(name),value);if(!result.ok)throw Error(JSON.stringify(result.diagnostics))}tick(20);refresh()};
const state=()=>({modules:runtime.getModuleRuntimeSnapshot(),render:runtime.getRenderGraphExecutorSnapshot(),choreography:runtime.getChoreographyRuntimeSnapshot(),resources:runtime.getResourceManagerSnapshot(),parameters:runtime.serializeParameterState()});
window.study={tick,set,state,music(value){enabled=value!=null;profile=value??{};if(!enabled)AudioFeatureBus.reset();tick()},hit(kind){enabled=true;event={event:kind,id:++sequence};tick()},pause(value){playing=!value;tick()},sync(value){hostSync=value;tick()},seek(value){time=value*1000;tick()},
reenter(){const saved=runtime.serializeParameterState();runtime.dispose();const retired=runtime.getResourceManagerSnapshot();enabled=false;AudioFeatureBus.reset();enter();runtime.getParameterState().restore(saved);tick(20);refresh();return retired},
dispose(){if(real){real.source.stop();real.context.close();real=null}runtime.dispose();return runtime.getResourceManagerSnapshot()},
async startReal(muted=true){
 if(real&&!real.done)return real.analysis;
 if(real){real.source.stop();await real.context.close();real=null}
 const {analyzeTrackBuffer}=await import('/src/features/musicIntelligence/offlineTrackAnalyzer.ts');const {MusicIntelligenceEngine}=await import('/src/features/musicIntelligence/MusicIntelligenceEngine.ts');
 const context=new AudioContext();await context.resume();const buffer=await context.decodeAudioData(await(await fetch('/__switch-it-audio')).arrayBuffer());
 const analysis=await analyzeTrackBuffer(buffer);const engine=new MusicIntelligenceEngine();engine.initialize({sampleRate:context.sampleRate});engine.setSourceId('switch-it-reference-audio','switch-it-reference-audio');engine.setTrackAnalysis(analysis);
 const source=context.createBufferSource();source.buffer=buffer;const analyser=context.createAnalyser();analyser.fftSize=2048;const gain=context.createGain();gain.gain.value=muted?0:.2;source.connect(analyser);analyser.connect(gain);gain.connect(context.destination);
 const capture=context.createMediaStreamDestination();source.connect(capture);const stream=document.querySelector('canvas').captureStream(30);for(const audioTrack of capture.stream.getAudioTracks())stream.addTrack(audioTrack);
 const chunks=[],recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9,opus',videoBitsPerSecond:4000000});const recording=new Promise(resolve=>{recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};recorder.onstop=()=>resolve(new Blob(chunks,{type:recorder.mimeType}))});recorder.start();
 track='switch-it-reference-audio';time=0;bpm=null;hostSync=true;playing=true;enabled=true;
 real={source,context,analyser,engine,recorder,recording,start:context.currentTime,last:performance.now(),done:false,frames:0,energy:[],bass:[],high:[],kicks:0,snares:0,analysis:{durationSec:buffer.duration,bpm:analysis.bpm,bpmConfidence:analysis.bpmConfidence,analysisVersion:analysis.analysisVersion,warnings:analysis.warnings}};
 source.start();function sample(){if(!real||real.done)return;time=(real.context.currentTime-real.start)*1000;const now=performance.now();wall+=Math.min(100,Math.max(0,now-real.last));real.last=now;
  real.engine.updateFromAnalyser({analyser:real.analyser,sampleRate:real.context.sampleRate,audioTime:Math.min(buffer.duration,time/1000),isPlaying:playing,publisherId:'switch-it-real-review'});pending(wall);
  const frame=AudioFeatureBus.getFrame();real.frames++;real.energy.push(frame.energy.instant);real.bass.push(frame.bands.normalizedBass);real.high.push(frame.bands.normalizedHigh);real.kicks+=frame.rhythm.kickHit?1:0;real.snares+=frame.rhythm.snareHit?1:0;
  if(time/1000>=buffer.duration-.1){real.done=true;playing=false;recorder.stop();document.querySelector('#real').disabled=false;document.querySelector('#real').textContent='Replay reference audio';return}requestAnimationFrame(sample)
 };requestAnimationFrame(sample);return real.analysis;
},async recording(){const blob=await real.recording;const data=new Uint8Array(await blob.arrayBuffer());let binary='';for(let i=0;i<data.length;i+=32768)binary+=String.fromCharCode(...data.subarray(i,i+32768));return btoa(binary)},realStatus(){if(!real)return null;const frame=AudioFeatureBus.getFrame();return{timeSec:time/1000,done:real.done,frames:real.frames,energyRange:[Math.min(...real.energy),Math.max(...real.energy)],bassRange:[Math.min(...real.bass),Math.max(...real.bass)],highRange:[Math.min(...real.high),Math.max(...real.high)],kicks:real.kicks,snares:real.snares,capabilities:frame.capabilities,analysis:real.analysis}}};
const ReactModule=await import('/node_modules/.vite/deps/react.js'),React=ReactModule.default??ReactModule,ClientModule=await import('/node_modules/.vite/deps/react-dom_client.js'),Client=ClientModule.default??ClientModule;
await import('/src/styles.css');await import('/src/styles/appearance.css');await import('/src/styles/groupSpacing.css');await import('/src/styles/reactView.css');await import('/src/styles/typography.css');const {Cinema2InspectorPanel}=await import('/src/components/vyzualz/react/Cinema2InspectorPanel.tsx');const inspector=Client.createRoot(document.querySelector('aside'));refresh=()=>inspector.render(React.createElement(Cinema2InspectorPanel,{runtime,surface:'design',sharedAudioAnalysis:false}));refresh();window.inspectorReady=true;
document.querySelector('#real').onclick=async()=>{const button=document.querySelector('#real');button.disabled=true;button.textContent='Analyzing reference audio…';try{await study.startReal(false);button.textContent='Reference playing'}catch(error){button.disabled=false;button.textContent='Retry reference audio';throw error}};document.querySelector('#pause').onclick=async()=>{if(real?.done)return;playing=!playing;if(real){if(playing)await real.context.resume();else await real.context.suspend()}};
if(window.autoPreview){let previous=performance.now();function idle(now){if(!real){const n=Math.min(4,Math.floor((now-previous)/(1000/60)));if(n){tick(n);previous=now}}else previous=now;requestAnimationFrame(idle)}requestAnimationFrame(idle)}
`
const html=`<html><head><meta charset="UTF-8"><link rel="icon" href="data:,"></head><body style="margin:0;background:#080c10;color:#ccd3d5"><main style="display:flex"><section><button id="real">Analyze and play reference audio</button><button id="pause">Pause / resume preview</button><canvas width="640" height="640" style="display:block"></canvas><p>Phase 3 development review · Demon Mask by egorova.e · CC BY 4.0.</p></section><aside style="width:380px;height:100vh;overflow:auto"></aside></main><script type="module">window.autoPreview=${process.argv.includes('--serve')};${script}</script></body></html>`
const server=await createServer({root,clearScreen:false,server:{host:'127.0.0.1',port:0},plugins:[{name:'switch-it-audio-review',configureServer(s){s.middlewares.use('/__switch-it-audio',(_req,res)=>{res.setHeader('Content-Type','audio/mp4');createReadStream(audioPath).pipe(res)});s.middlewares.use('/__switch-it-phase3',(_req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html)})}}]})
let browser
const errors=[],checks=[]
try{
 await server.listen();const url=`http://127.0.0.1:${server.httpServer.address().port}/__switch-it-phase3`
 if(process.argv.includes('--serve')){console.log('Switch It Phase 3 review: '+url);await new Promise(()=>{})}
 browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--autoplay-policy=no-user-gesture-required']})
 const page=await browser.newPage({viewport:{width:1040,height:740}});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
 await page.goto(url);await page.waitForFunction(()=>{if(!window.study)return false;study.tick();return study.state().modules.modules.some(m=>m.activeResourceLeaseCount>0)}).catch(error=>{console.error(errors);throw error});await page.waitForFunction(()=>window.inspectorReady)
 const set=v=>page.evaluate(value=>study.set(value),v),music=v=>page.evaluate(value=>study.music(value),v),tick=n=>page.evaluate(n=>study.tick(n),n),hit=v=>page.evaluate(value=>study.hit(value),v)
 const shot=async name=>sharp(await page.locator('canvas').screenshot({path:resolve(out,name+'.png')})).removeAlpha().raw().toBuffer()
 const diff=(a,b,region=[0,0,640,640])=>{let sum=0,n=0;for(let y=region[1];y<region[1]+region[3];y++)for(let x=region[0];x<region[0]+region[2];x++)for(let c=0;c<3;c++){const i=(y*640+x)*3+c;sum+=Math.abs(a[i]-b[i]);n++}return sum/n}
 const changes=(a,b,name,region,min=.02)=>{const difference=diff(a,b,region);if(difference<min)throw Error(name+' is inert: '+difference);checks.push({name,difference})}
 await set({pattern:'split-portrait',reveal:.5,speed:0,bpmSync:false,response:.8});await music(null);const baseline=await shot('no-audio')
 const approved=await sharp(resolve(root,'artifacts/switch-it-phase2/split-portrait-mid.png')).removeAlpha().raw().toBuffer();if(diff(baseline,approved)>.01)throw Error('No audio changed the approved baseline')
 await music({energy:.02});await tick(35);const quiet=await shot('quiet')
 await music({energy:1,bass:1});await tick(35);const bass=await shot('bass-energy');
 let eyeCore=0,occluded=0;for(let y=250;y<290;y++)for(let x=220;x<420;x++){const i=(y*640+x)*3;if(Math.min(quiet[i],quiet[i+1],quiet[i+2])>200){eyeCore++;if(Math.min(bass[i],bass[i+1],bass[i+2])<190)occluded++}}if(occluded>eyeCore*.03)throw Error('Audio facets obscure character eyes');checks.push({name:'Character eye clearance',eyeCore,occluded});changes(quiet,bass,'Bass/energy facet response',[130,45,190,420],.05)
 await music({energy:0,high:1});await tick(35);const high=await shot('high-band');await music({energy:0,high:0});await tick(35);changes(await shot('high-off'),high,'High-band mask edge',[350,150,290,400],.005)
 await music({energy:0});await tick(35);const beforeKick=await shot('before-kick');await hit('kick');await tick(3);const kick=await shot('kick');changes(beforeKick,kick,'Kick eye accent',[210,240,220,70],.1);await tick(30);if(diff(beforeKick,await shot('kick-released'))>.05)throw Error('Kick accent did not return')
 await hit('snare');await tick(3);const snare=await shot('snare');changes(beforeKick,snare,'Snare facets',[130,45,190,420],.02)
 await tick(30);await hit('transient');await tick(3);changes(beforeKick,await shot('transient'),'Shared transient facets',[130,45,190,420],.02);await music({energy:0});await tick(35)
 await music({energy:0,build:1});await tick(45);const build=await shot('build');changes(beforeKick,build,'Build crest geometry',[130,40,190,220],.03)
 await music({energy:0});await tick(50);await hit('drop');await tick(4);const drop=await shot('drop');changes(beforeKick,drop,'Semantic drop crest',[130,40,190,220],.03);await tick(60);if(diff(beforeKick,await shot('drop-released'))>.1)throw Error('Drop accent did not return')
 await music({energy:1,bass:1});await tick(45);const instrumental=await shot('instrumental');await music({energy:1,bass:1,vocal:1});await tick(60);changes(instrumental,await shot('vocal-restraint'),'Vocal restraint',[130,45,190,420],.02)
 await set({response:0});const zero=await shot('response-zero');if(diff(zero,baseline)>.01)throw Error('Response zero leaked');await music({energy:0});await tick(35);if(diff(zero,await shot('response-zero-quiet'))>.01)throw Error('Response zero depends on music')
 await set({response:.8,reach:0,fragmentAmount:0,columnIntensity:0,eyesEnabled:false});await music(null);const limits=await shot('limits-off');await music({energy:1,bass:1});await tick(35);await hit('kick');await tick(3);if(diff(limits,await shot('limits-loud'))>.01)throw Error('Audio bypassed manual OFF/zero')
 await set({reach:.35,fragmentAmount:1,columnIntensity:1,eyesEnabled:true,response:.8});await music({energy:1,bass:1});await tick(35);const held=await shot('before-pause');await page.evaluate(()=>study.pause(true));await tick(90);if(diff(held,await shot('paused'))>.01)throw Error('Paused visual drifted');await set({response:0});if(diff(baseline,await shot('paused-response-zero'))>.01)throw Error('Response zero ignored while paused');await page.evaluate(()=>study.pause(false));await set({response:.8})
 await music(null);const beforeReentry=await shot('before-reentry'),retired=await page.evaluate(()=>study.reenter());await page.waitForFunction(()=>{study.tick();return study.state().modules.modules.some(m=>m.activeResourceLeaseCount>0)});await tick(20);if(diff(beforeReentry,await shot('after-reentry'))>.01)throw Error('Reentry changed approved manual output');if(retired.activeLeaseCount||retired.estimatedGpuMemoryBytes)throw Error('Retired resources leaked')
 await page.waitForSelector('[data-cinema2-control-id="switch-it-response"]');if(await page.locator('[data-cinema2-parent-group]').count()!==4)throw Error('Parent groups changed');await page.screenshot({path:resolve(out,'inspector.png')})
 // Actual decoded source -> shared offline analyzer -> real WebAudio analyser -> MusicIntelligenceEngine -> AudioFeatureBus -> native engine.
 await set({speed:1,bpmSync:true,pattern:'switch-cycle'});console.log('Starting actual reference-audio analysis/playback')
 const analysis=await page.evaluate(()=>study.startReal(true));const realSamples=[]
 for(const seconds of [1,3,6,9,12]){await page.waitForFunction(t=>study.realStatus()?.timeSec>=t,seconds,{timeout:30000});await shot('real-'+seconds);realSamples.push(await page.evaluate(()=>study.realStatus()))}
 await page.waitForFunction(()=>study.realStatus()?.done,null,{timeout:30000});const real=await page.evaluate(()=>study.realStatus());if(real.frames<100||real.energyRange[1]-real.energyRange[0]<.01||real.bassRange[1]-real.bassRange[0]<.01)throw Error('Actual audio analysis did not deliver varying shared facts')
 const recording=await page.evaluate(()=>study.recording());await writeFile(resolve(out,'real-audio.webm'),Buffer.from(recording,'base64'));execFileSync('/opt/homebrew/bin/ffmpeg',['-y','-loglevel','error','-i',resolve(out,'real-audio.webm'),'-c:v','libx264','-pix_fmt','yuv420p','-crf','20','-c:a','aac','-b:a','192k','-movflags','+faststart',resolve(out,'real-audio-preview.mp4')]);
 const status=await page.evaluate(()=>study.state());if(status.modules.failedModuleCount||status.modules.degradedModuleCount||status.render.failedPassCount)throw Error(JSON.stringify(status));const disposed=await page.evaluate(()=>study.dispose());if(disposed.activeLeaseCount||disposed.estimatedGpuMemoryBytes||errors.length)throw Error(JSON.stringify({disposed,errors}))
 const bytes=await readFile(audioPath);await writeFile(resolve(out,'report.json'),JSON.stringify({checks,errors,retired,disposed,realAudio:{source:'/Users/kodyrobinson/Desktop/SwitchIt.mov',extractedSha256:createHash('sha256').update(bytes).digest('hex'),analysis,real,samples:realSamples}},null,2));console.log(JSON.stringify({checks,errors,actualFrames:real.frames,actualEnergy:real.energyRange,actualBass:real.bassRange,disposedLeases:disposed.activeLeaseCount},null,2))
}finally{await browser?.close();await server.close()}

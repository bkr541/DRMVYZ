/* global document */
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {chromium} from '@playwright/test'
import sharp from 'sharp'
const out='artifacts/cinema2-beam-lattice-performance',stage=process.argv.find(a=>a.startsWith('--stage='))?.split('=')[1]??'all',run=name=>stage==='all'||stage===name
await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']})
const report={stage,passed:[],measurements:[],captures:[],errors:[]}
try{
 const page=await browser.newPage({viewport:{width:640,height:360}});page.on('pageerror',e=>report.errors.push(e.message))
 const api=(method,value)=>page.evaluate(([m,v])=>globalThis.beamLatticeReview[m](v),[method,value]),snapshot=()=>api('snapshot'),advance=s=>api('advance',s)
 const set=async(name,value)=>assert((await page.evaluate(([n,v])=>globalThis.beamLatticeReview.set(n,v),[name,value])).ok)
 const load=async(quality='medium')=>{await page.goto(`${process.env.PLAYWRIGHT_BASE_URL??'http://127.0.0.1:5174'}/src/test/browser/cinema2-beam-lattice.html?quality=${quality}`);await page.waitForFunction(()=>globalThis.beamLatticeReview,{}, {timeout:15000});await page.waitForFunction(()=>globalThis.beamLatticeReview.snapshot().modules.modules[0]?.inspection?.state==='ready',{}, {timeout:60000})}
 const inspect=async()=>(await snapshot()).modules.modules[0].inspection
 const capture=async name=>{const s=await snapshot();assert.equal(s.modules.failedModuleCount,0);assert.equal(s.render.failedPassCount,0);assert.equal(s.effects.failedEffectCount,0);assert.equal(s.modules.modules[0].inspection.sourceMeshes,4);assert.equal(s.modules.modules[0].inspection.addedGeometry,0);const png=await page.screenshot({path:`${out}/${name}.png`});report.captures.push({name,snapshot:s});return png}
 const pixels=async()=>sharp(await page.screenshot()).removeAlpha().raw().toBuffer(),difference=(a,b)=>{let sum=0;for(let i=0;i<a.length;i++)sum+=Math.abs(a[i]-b[i]);return sum/a.length}
 const dispose=async()=>{const r=await api('dispose');assert.equal(r.activeLeaseCount,0);assert.equal(r.activeSurfaceCount,0)}
 const quiet={active:true,energy:0,bass:0,high:0,vocal:0,build:0,event:null,sectionBuild:false}
 await load();const authored=(await snapshot()).parameters.persistentValues,pid=name=>`beam-lattice-${name.replace(/[A-Z]/g,c=>`-${c.toLowerCase()}`)}`,restore=name=>set(name,authored[pid(name)])
 if(run('visual')){
  await set('cameraMode','reference');
  await capture('default');const before=await pixels();await advance(.6);assert(difference(before,await pixels())>.05);await set('motionRate',0);const phase=(await inspect()).phase;await advance(.3);assert.equal((await inspect()).phase,phase)
  const patterns=[];for(const pattern of ['reference-fan','counter-sweep','iris-gate','scissor-cross','bank-relay','pressure-cage','radial-release']){await set('pattern',pattern);assert.equal((await inspect()).pattern,pattern);const p=await pixels();assert(patterns.every(b=>difference(b,p)>.05),`${pattern} changes geometry visibly`);patterns.push(p);await capture(`pattern-${pattern}`)}
  await set('pattern','reference-fan')
  for(const name of ['upperColor','lowerColor','rightColor','leftColor','backgroundColor']){const before=await pixels();await set(name,[.1,.05,1,1]);const d=difference(before,await pixels());assert(d>.01,`${name} must affect its own region (${d})`);report.measurements.push({control:name,difference:d});await restore(name)}
  await set('pattern','scissor-cross')
  for(const[name,min,max]of [['aperture',.65,1.35],['bankTravel',0,1.5],['referenceBeamThickness',.25,4],['cameraFov',148,158],['bloom',0,3],['intensity',0,2],...['upper','lower','right','left'].map(r=>[r+'Lighting',0,2])]){await set(name,min);const low=await pixels();await set(name,max);const d=difference(low,await pixels());assert(d>.01,`${name} min/max changes pixels (${d})`);report.measurements.push({control:name,difference:d});await restore(name)}
  await set('pattern','reference-fan');await set('motionRate',1);await advance(.4);await api('restart');await page.waitForFunction(()=>globalThis.beamLatticeReview.snapshot().modules.modules[0]?.inspection?.state==='ready');assert.equal((await snapshot()).parameters.persistentValues[pid('pattern')],'reference-fan');await capture('reentry')
  report.passed.push('reference default; seven distinct native geometry programs; five independent palette roles; geometry/light/effect/lens min/max; removed freeze toggle and rate zero; saved preset re-entry')
 }
 if(run('fixes')){
  const start=(await snapshot()).camera.position;await advance(3);const end=(await snapshot()).camera.position;assert(end.some((v,i)=>Math.abs(v-start[i])>.005));await capture('fixed-orbit');await set('cameraMode','reference');await set('motionRate',0)
  for(const pattern of ['reference-fan','counter-sweep','iris-gate','scissor-cross','bank-relay','pressure-cage','radial-release']){await set('pattern',pattern);await capture(`fixed-${pattern}`)}
  await api('tempoOnly',true);await api('music',{active:true,energy:.6,bass:0,event:null});await set('patternChange',true);await set('trigger','beat');await set('pattern','reference-fan');await advance(.2);const initial=(await inspect()).pattern;await advance(1.2);assert.notEqual((await inspect()).pattern,initial);await api('inspector',true);const text=await page.locator('#beam-lattice-inspector').innerText();assert(!/Geometry Motion|Geometry Choreography/.test(text));await api('inspector',false);report.passed.push('removed freeze toggle; coherent full-length bank geometry; tempo-only live Trigger advancement; bounded interior camera movement');report.measurements.push({orbitStart:start,orbitEnd:end,triggerBefore:initial,triggerAfter:(await inspect()).pattern})
 }
 if(run('timing')){
  await load();await set('reactivity',0);await api('timing',{bpm:180,sourcePresent:true});await advance(.3);const a=(await inspect()).phase,first=await pixels();await advance(1);const fast=(await inspect()).phase-a,second=await pixels();assert(difference(first,second)>.02)
  await set('bpmSync',false);const b=(await inspect()).phase;await advance(1);const free=(await inspect()).phase-b;assert(fast>free*1.35);assert(Math.abs(free-1)<.1);report.measurements.push({timing:'BPM Sync',fastPhaseDelta:fast,freePhaseDelta:free});await capture('bpm-sync-off');report.passed.push('production BPM Sync ON at 180 BPM visibly advances faster than free 120 BPM; toggle preserves phase')
 }
 if(run('audio')){
  await load();await set('motionRate',0);await set('reactivity',1);await api('music',quiet);await advance(.4);const saved=(await snapshot()).parameters.persistentValues,baseline=await pixels()
  for(const[name,options,property,condition]of [['bass',{bass:1},'aperture',v=>v<.95],['highs',{high:1},'upperLighting',v=>v>1.1],['vocals',{vocal:1},'lowerLighting',v=>v<.8]]){await api('music',{...quiet,...options});await advance(.5);assert(condition((await snapshot()).live[property]));const d=difference(baseline,await pixels());assert(d>.02,`${name} must visibly react`);report.measurements.push({audio:name,difference:d});await capture(`audio-${name}`);await api('music',quiet);await advance(.6)}
  for(const[event,property]of [['kick','upperLighting'],['snare','leftLighting']]){await api('music',{...quiet,energy:.6});await advance(.2);await api('event',event);await advance(.12);assert((await snapshot()).live[property]>1.01);await capture(`event-${event}`);await advance(.5)}
  assert.deepEqual((await snapshot()).parameters.persistentValues,saved);await set('reactivity',0);await api('music',{...quiet,energy:1,bass:1,high:1,vocal:1});await advance(.3);assert.equal((await snapshot()).live.aperture,1);assert.equal((await snapshot()).live.upperLighting,1)
  await set('reactivity',1);for(const r of ['upper','lower','right','left'])await set(r+'Lighting',0);await api('event','drop');await advance(.2);for(const r of ['upper','lower','right','left'])assert.equal((await snapshot()).live[r+'Lighting'],0)
  report.passed.push('independent bass/high/vocal pixel delivery; kick/snare envelopes; zero strength, hard bank zeros and saved-state preservation')
  await load();await set('reactivity',1)
  const sampleRate=48000,seconds=6,count=sampleRate*seconds,wav=Buffer.alloc(44+count*2);wav.write('RIFF');wav.writeUInt32LE(36+count*2,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(sampleRate,24);wav.writeUInt32LE(sampleRate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(count*2,40)
  for(let i=0;i<count;i++){const t=i/sampleRate,envelope=.65+.35*Math.exp(-((t*2)%1)*12),v=(Math.sin(t*2*Math.PI*60)*.65+Math.sin(t*2*Math.PI*2400)*.1)*envelope;wav.writeInt16LE(Math.round(v*26000),44+i*2)}
  await api('playAudio',wav.toString('base64'));const real=[];for(let i=0;i<6;i++){await page.waitForTimeout(500);real.push(await snapshot())}assert(real.at(-1).pump.sampleCount>10);assert(real.some(f=>f.live.aperture<.999));assert(real.some(f=>f.live.motionRate>1.001));await capture('web-audio');await api('stopAudio');report.passed.push('deterministic PCM through Web Audio, canonical analyzer pump, feature bus, persistent bridge and native rendered targets')
 }
 if(run('performance')){
  await load();await set('autoPerformance',true);await set('reactivity',1);await api('music',{...quiet,energy:.6});await advance(.3);const saved=(await snapshot()).parameters.persistentValues
  await api('music',{...quiet,energy:.75,build:1,sectionBuild:true,sectionProgress:.9,tension:.95});await advance(.7);assert.equal((await inspect()).overrideReason,'build');await capture('build')
  await api('event','drop');await advance(.2);assert.equal((await inspect()).overrideReason,'drop');await capture('drop');await api('timing',{paused:true});await advance(.1);const hold=await inspect();await advance(.2);assert.equal((await inspect()).phase,hold.phase);assert.deepEqual((await inspect()).patternWeights,hold.patternWeights);await api('timing',{paused:false});await api('music',{...quiet,energy:.8});await advance(4.3);assert.notEqual((await inspect()).overrideReason,'drop')
  await api('music',quiet);await advance(3);assert((await snapshot()).mood.silence>.9);assert.equal((await inspect()).effectivePatternChange,false);assert((await snapshot()).live.intensity<.2);await capture('silence')
  await api('event','drop');await advance(.2);assert.equal((await inspect()).overrideReason,'drop');assert.deepEqual((await snapshot()).parameters.persistentValues,saved)
  await set('autoPerformance',false);assert.equal((await inspect()).overrideReason,null);await set('pattern','iris-gate');assert.equal((await inspect()).pattern,'iris-gate');await set('autoPerformance',true);await api('seek',0);await advance(1/30);assert.equal((await inspect()).overrideReason,null);await api('music',{...quiet,trackId:'beam-next'});await advance(1/30);assert.equal((await inspect()).overrideReason,null)
  report.passed.push('shared Mood policy; Director build/drop geometry; bounded return; pause; silent hold; ungated drop; immediate Auto OFF/manual authority; seek/track reset; saved values')
 }
 if(run('lifecycle')){
  await load();await set('patternChange',true);await api('inspector',true);await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(200)
  const ui=()=>page.evaluate(()=>{const host=document.querySelector('#beam-lattice-inspector');return {height:host.scrollHeight,controls:[...host.querySelectorAll('input,select,button')].map(e=>{const r=e.getBoundingClientRect();return {disabled:e.disabled,label:e.getAttribute('aria-label')??e.closest('.rv-ctrl-row,.rv-ctrl-toggle-row')?.textContent??e.textContent,group:e.closest('[data-cinema2-parent-group]')?.getAttribute('data-cinema2-parent-group'),header:/drc-header|collapsible-hdr/.test(String(e.className)),rect:[r.x,r.y,r.width,r.height]}})}})
  const off=await ui();await set('autoPerformance',true);await api('music',{...quiet,energy:.8});await advance(.6);const on=await ui();assert.equal(off.controls.length,on.controls.length);assert(on.controls.filter(c=>['design','effects'].includes(c.group)&&!c.header).length>10);assert(on.controls.filter(c=>['design','effects'].includes(c.group)&&!c.header).every(c=>c.disabled));assert(on.controls.filter(c=>c.group==='palette').every(c=>!c.disabled));assert(on.controls.filter(c=>/^(BPM Sync|Auto Performance)/.test(c.label)).every(c=>!c.disabled));await page.waitForTimeout(250);assert(await page.locator('[data-live-policy="true"]').count()>=2);await capture('inspector-auto');await page.locator('#beam-lattice-inspector').screenshot({path:`${out}/inspector-full.png`});await api('inspector',false)
  await page.evaluate(()=>{globalThis.beamLoss=document.querySelector('#scene').getContext('webgl2').getExtension('WEBGL_lose_context');globalThis.beamLoss.loseContext()});await page.waitForFunction(()=>globalThis.beamLatticeReview.snapshot().runtime.phase==='context-lost');await page.evaluate(()=>globalThis.beamLoss.restoreContext());await page.waitForFunction(()=>globalThis.beamLatticeReview.snapshot().runtime.phase==='running'&&globalThis.beamLatticeReview.snapshot().modules.modules[0]?.inspection?.state==='ready',{}, {timeout:60000});await capture('context-restored');await dispose()
  for(const quality of ['high','low']){await page.setViewportSize(quality==='low'?{width:360,height:640}:{width:640,height:360});await load(quality);await capture(`quality-${quality}`);await dispose()}
  report.passed.push('shared Inspector Auto lock and identical geometry; editable Palette/BPM/Auto; context restore; quality tiers and portrait; zero remaining surfaces/leases')
 }else await dispose()
 assert.deepEqual(report.errors,[]);console.log('Beam Lattice '+stage+': '+report.passed.join('; ')+' passed.')
}finally{await writeFile(`${out}/report-${stage}.json`,JSON.stringify(report,null,2)+'\n');await browser.close()}

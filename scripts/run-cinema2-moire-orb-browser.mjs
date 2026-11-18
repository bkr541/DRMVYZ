import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {chromium} from '@playwright/test'
import sharp from 'sharp'
const stage=process.argv.find(a=>a.startsWith('--stage='))?.split('=')[1]??'all',output=process.env.MOIRE_ORB_OUTPUT??'artifacts/cinema2-moire-orb'
await mkdir(output,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']})
const report={stage,passed:[],measurements:[],snapshots:[],errors:[]}
try {
 const page=await browser.newPage({viewport:{width:640,height:360}})
 page.on('pageerror',e=>report.errors.push(e.message))
 const api=(method,value)=>page.evaluate(([m,v])=>globalThis.moireOrbReview[m](v),[method,value])
 const set=async(name,value)=>assert((await page.evaluate(([n,v])=>globalThis.moireOrbReview.set(n,v),[name,value])).ok)
 const snapshot=()=>api('snapshot'),advance=s=>api('advance',s)
 const load=async(quality='medium')=>{await page.goto(`${process.env.PLAYWRIGHT_BASE_URL??'http://127.0.0.1:5174'}/src/test/browser/cinema2-moire-orb.html?quality=${quality}`);await page.waitForFunction(()=>globalThis.moireOrbReview,{}, {timeout:15000});await page.waitForFunction(()=>globalThis.moireOrbReview?.snapshot().modules.modules[0]?.inspection?.state==='ready',{}, {timeout:90000})}
 const inspect=async()=> (await snapshot()).modules.modules[0].inspection
 const capture=async name=>{await page.screenshot({path:`${output}/${name}.png`});report.snapshots.push({name,snapshot:await snapshot()})}
 const pixels=async()=>sharp(await page.screenshot()).removeAlpha().raw().toBuffer()
 const difference=(a,b)=>{let sum=0;for(let i=0;i<a.length;i++)sum+=Math.abs(a[i]-b[i]);return sum/a.length}
 const inventory=async()=>{const s=await snapshot(),i=s.modules.modules[0].inspection;assert.equal(i.sourceMeshes,5);assert.equal(i.ringSegments,48);assert.equal(i.movingFixtures,12);assert.equal(i.chamberCells,144);assert.equal(i.coreElectrodeCells,48);assert.equal(i.totalLightingCells,240);assert.equal(i.plasmaArmature,true);assert.equal(s.modules.failedModuleCount,0);assert.equal(s.render.failedPassCount,0);assert.equal(s.effects.failedEffectCount,0)}
 const staticView=async()=>{for(const[name,value]of Object.entries({cameraMode:'manual',pattern:'core-ignition',motionRate:0,fixtureMotion:false,reactivity:1,autoPerformance:false,ringLighting:.75,fixtureLighting:.65}))await set(name,value)}
 const quiet={active:true,energy:0,bass:0,high:0,vocal:0,build:0,event:null,sectionBuild:false}
 const run=name=>stage==='all'||stage===name
 await load();await inventory()
 const authored=(await snapshot()).parameters.persistentValues
 const pid=name=>`moire-orb-${name.replace(/[A-Z]/g,c=>`-${c.toLowerCase()}`)}`
 const restore=name=>set(name,authored[pid(name)])
 if(run('visual')){
  await set('cameraMode','manual');await capture('default')
  const stats=await sharp(await page.screenshot()).stats();assert(stats.channels.some(c=>c.stdev>8),'The actual scene must have visible structure')
  await set('bloom',0);await set('finishMix',0);await set('occlusion',0);const dry=await pixels();await capture('dry')
  for(const[name,max]of [['occlusion',1],['bloom',.8],['finishMix',1],['haze',0]]){await set(name,max);const d=difference(dry,await pixels());assert(d>.01,`${name} must change actual pixels (${d})`);report.measurements.push({control:name,difference:d});await capture(`effect-${name}`);await set(name,name==='haze'?authored[pid(name)]:0)}
  for(const name of ['bloom','finishMix','occlusion'])await restore(name)
  for(const name of ['chamberLighting','coreDetailLighting','coreOpacity']){await set(name,0);const off=await pixels();await set(name,name==='coreOpacity'?1:1.5);const d=difference(off,await pixels());assert(d>.01,`${name} must visibly change its own geometry (${d})`);report.measurements.push({control:name,difference:d});await capture(`control-${name}`);await restore(name)}
  const original=(await snapshot()).parameters.persistentValues
  for(const name of ['coreColor','ringColor','fixtureColor','chamberColor','detailColor']){const before=await pixels();await set(name,[1,.025,.08,1]);const d=difference(before,await pixels());assert(d>.01,`${name} changes its own visible region`);report.measurements.push({control:name,difference:d});const id=`moire-orb-${name.replace(/[A-Z]/g,c=>`-${c.toLowerCase()}`)}`;await set(name,original[id])}
  const patterns=[]
  for(const pattern of ['core-ignition','counter-rotation','vertical-surge','ring-chase','pressure-lock','radial-discharge']){await set('pattern',pattern);assert.equal((await inspect()).pattern,pattern);const buffer=await pixels();assert(patterns.every(p=>difference(p,buffer)>.02),`${pattern} is visibly distinct`);patterns.push(buffer);await capture(`pattern-${pattern}`)}
  await set('pattern','core-ignition')
  for(const[name,heading,elevation]of [['front',0,12],['right',90,12],['rear',180,12],['left',-90,12],['above',30,78],['below',-30,-78]]){await set('cameraHeading',heading);await set('cameraElevation',elevation);await inventory();const s=await sharp(await page.screenshot()).stats();assert(s.channels.some(c=>c.stdev>4),`${name} contains modeled scenery`);await capture(`view-${name}`)}
  await set('cameraMode','omnidirectional');const before=(await snapshot()).camera.position;await advance(2);const after=(await snapshot()).camera.position
  assert(after.every((v,i)=>Math.abs(v-before[i])>.1),'The camera travels through all three axes')
  await set('cameraSpeed',0);const held=(await snapshot()).camera.position;await advance(.2);assert.deepEqual((await snapshot()).camera.position,held)
  await capture('automatic-orbit');report.passed.push('dry geometry, exact inventory, distinct patterns, all palette roles, effects, all-direction environment, omnidirectional travel and zero-speed hold')
 }
 if(run('audio')){
  await staticView();await api('music',quiet);await advance(.4);const baseline=await pixels(),saved=(await snapshot()).parameters.persistentValues
  for(const[name,options,property,condition]of [['bass',{bass:1},'coreScale',v=>v<.97],['highs',{high:1},'ringLighting',v=>v>.78],['vocals',{vocal:1},'fixtureLighting',v=>v<.5]]){
   await api('music',{...quiet,...options});await advance(.5);assert(condition((await snapshot()).live[property]));const d=difference(baseline,await pixels());assert(d>.02,`${name} changes rendered pixels`);report.measurements.push({source:name,difference:d});await capture(`audio-${name}`);await api('music',quiet);await advance(.6)
  }
  assert.deepEqual((await snapshot()).parameters.persistentValues,saved)
  await api('music',{...quiet,energy:.6});await advance(.2)
  for(const[event,property,base]of [['kick','ringLighting',.75],['snare','fixtureLighting',.65]]){await api('event',event);await advance(.15);assert((await snapshot()).live[property]>base+.01);await capture(`event-${event}`);await api('music',{...quiet,energy:.6});await advance(.4)}
  await set('reactivity',0);await api('music',{...quiet,energy:1,bass:1,high:1,vocal:1});await advance(.3);const s=await snapshot();assert.equal(s.live.coreScale,1);assert.equal(s.live.ringLighting,.75);assert.equal(s.live.fixtureLighting,.65)
  await set('reactivity',1);await set('ringLighting',0);await set('fixtureLighting',0);await set('chamberLighting',0);await set('coreDetailLighting',0);await api('event','drop');await advance(.15);assert.equal((await snapshot()).live.ringLighting,0);assert.equal((await snapshot()).live.fixtureLighting,0);assert.equal((await snapshot()).live.chamberLighting,0);assert.equal((await snapshot()).live.coreDetailLighting,0);assert.equal((await inspect()).activeDirectLights,0)
  report.passed.push('independent bass/high/vocal pixel changes, kick/snare envelopes, saved values, zero reactivity and hard lighting zeros')
 }
 if(run('performance')){
  await staticView();for(const name of ['ringLighting','fixtureLighting','chamberLighting','coreDetailLighting'])await restore(name);await set('motionRate',1);await set('fixtureMotion',true);await set('autoPerformance',true);await api('music',{...quiet,energy:.6});await advance(.2)
  const saved=(await snapshot()).parameters.persistentValues
  await api('music',{...quiet,energy:.75,build:1,sectionBuild:true,sectionProgress:.9,tension:.95});await advance(.7);assert.equal((await inspect()).overrideReason,'build');await capture('build')
  await api('event','drop');await advance(.2);assert.equal((await inspect()).overrideReason,'drop');await capture('drop')
  await api('timing',{paused:true});await advance(.05);const held=await inspect();await advance(.2);const paused=await inspect();assert.equal(paused.phase,held.phase);assert.equal(paused.fixturePhase,held.fixturePhase);assert.equal(paused.overrideReason,held.overrideReason);assert.deepEqual(paused.patternWeights,held.patternWeights)
  await api('timing',{paused:false});await api('music',{...quiet,energy:.8});await advance(4.3);assert.equal((await inspect()).overrideReason,null)
  await api('music',quiet);await advance(3);assert((await snapshot()).mood.silence>.9);assert.equal((await inspect()).effectivePatternChange,false);assert((await snapshot()).live.intensity<.2);await capture('silence')
  await api('event','drop');await advance(.2);assert.equal((await inspect()).overrideReason,'drop');assert.deepEqual((await snapshot()).parameters.persistentValues,saved)
  await api('seek',0);await advance(1/30);assert.equal((await inspect()).overrideReason,null)
  await api('music',{...quiet,trackId:'moire-orb-next-track'});await advance(1/30);assert.equal((await inspect()).overrideReason,null)
  report.passed.push('shared Mood policy, build/drop substitutions, bounded return, pause hold, silence quiet/hold, ungated drop, seek/track reset, saved-value preservation')
 }
 if(run('lifecycle')){
  await api('music',{...quiet,energy:.8});await advance(.1);await set('autoPerformance',false);await set('patternChange',true);await api('inspector',true);await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(200)
  const ui=()=>page.evaluate(()=>{const host=document.querySelector('#moire-orb-inspector');return {height:host.scrollHeight,controls:[...host.querySelectorAll('input,select,button')].map(e=>{const r=e.getBoundingClientRect();return {disabled:e.disabled,label:e.getAttribute('aria-label')??e.closest('.rv-ctrl-row,.rv-ctrl-toggle-row')?.textContent??e.textContent,group:e.closest('[data-cinema2-parent-group]')?.getAttribute('data-cinema2-parent-group'),header:/drc-header|collapsible-hdr/.test(String(e.className)),rect:[r.x,r.y,r.width,r.height]}})}})
  const off=await ui();await set('autoPerformance',true);await page.waitForTimeout(250);const on=await ui();assert.equal(off.height,on.height);assert.equal(off.controls.length,on.controls.length);off.controls.forEach((c,i)=>assert.deepEqual(c.rect,on.controls[i].rect))
  assert(on.controls.filter(c=>['design','effects'].includes(c.group)&&!c.header).every(c=>c.disabled));assert(on.controls.filter(c=>c.group==='palette').every(c=>!c.disabled));assert(on.controls.filter(c=>/^(BPM Sync|Auto Performance)/.test(c.label)).every(c=>!c.disabled));await capture('inspector-auto');await api('inspector',false)
  await page.evaluate(()=>{globalThis.moireContextLoss=document.querySelector('#scene').getContext('webgl2').getExtension('WEBGL_lose_context');globalThis.moireContextLoss.loseContext()});await page.waitForFunction(()=>globalThis.moireOrbReview.snapshot().runtime.phase==='context-lost');await page.evaluate(()=>globalThis.moireContextLoss.restoreContext());await page.waitForFunction(()=>globalThis.moireOrbReview.snapshot().modules.modules[0]?.inspection?.state==='ready'&&globalThis.moireOrbReview.snapshot().runtime.phase==='running',{}, {timeout:90000});await inventory()
  report.passed.push('real Inspector lock/live-policy layout, editable palette/BPM/Auto and WebGL restoration')
  for(const quality of ['high','low']){await load(quality);await page.setViewportSize(quality==='low'?{width:360,height:640}:{width:640,height:360});await inventory();await capture(`quality-${quality}`);const i=await inspect();assert.equal(i.activeDirectLights,quality==='high'?12:4);const resources=await api('dispose');assert.equal(resources.activeLeaseCount,0);assert.equal(resources.activeSurfaceCount,0)}
  report.passed.push('all quality tiers preserve 240 cells and 12 fixtures, portrait resize, zero remaining surfaces/leases')
 }else{const resources=await api('dispose');assert.equal(resources.activeLeaseCount,0);assert.equal(resources.activeSurfaceCount,0)}
 assert.deepEqual(report.errors,[]);console.log(`Moire Orb ${stage}: ${report.passed.join('; ')} passed.`)
}finally{await writeFile(`${output}/report-${stage}.json`,JSON.stringify(report,null,2)+'\n');await browser.close()}

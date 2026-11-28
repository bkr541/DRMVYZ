/* global window, document */
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir,writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from '@playwright/test'
import sharp from 'sharp'
const hon03=process.argv.includes('--hon03'),phase06=hon03||process.argv.includes('--p06')
const port=48500+process.pid%1000,url=`http://127.0.0.1:${port}/src/test/browser/cinema2-honey-production.html${phase06?'?phase=06':''}`,output=path.resolve('artifacts/cinema2-honey',hon03?'hon03':phase06?'p06':'p05')
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:['ignore','pipe','pipe']})
let log='',browser;server.stdout.on('data',v=>log+=v);server.stderr.on('data',v=>log+=v)
try{
  await mkdir(output,{recursive:true});let ready=false
  for(let i=0;i<150;i++){if(server.exitCode!==null)throw Error(log);try{if((await fetch(url)).ok){ready=true;break}}catch{/* server not up yet */}await new Promise(r=>setTimeout(r,100))}assert(ready,log)
  browser=await chromium.launch({headless:true,args:['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'],...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})})
  const page=await browser.newPage({viewport:{width:960,height:540},deviceScaleFactor:1}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await page.waitForFunction(()=>!!window.__honeyProduction)
  const api=(method,...args)=>page.evaluate(({method,args})=>window.__honeyProduction[method](...args),{method,args})
  await api('showRail',true);await page.locator('[data-cinema2-preset-id="drmvyz.cinema2.honey"]').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,'selector.png')});await page.getByRole('button',{name:'Load HONEY',exact:true}).click();await api('showRail',false)
  const capture=async(name)=>{const b=Buffer.from((await api('capture')).split(',')[1],'base64');if(name)await writeFile(path.join(output,`${name}.png`),b);return sharp(b).removeAlpha().raw().toBuffer()}
  if(hon03){
    const shots=[]
    const sample=async name=>{const camera=await api('camera'),pixels=await capture(name);assert(pixels.some(v=>v>40),`${name}: visible output`);assert(camera.position[2]>=9.5&&camera.position[2]<=16.4);assert.equal(camera.rollDegrees,0);shots.push({name,position:camera.position,target:camera.target,aspect:camera.aspect});return camera.position}
    for(const [width,height] of [[960,540],[540,960],[640,640]]){
      await page.setViewportSize({width,height})
      for(const quality of ['performance','balanced','quality']){
        const tag=`${width}x${height}-${quality}`
        await api('reset');await api('quality',quality);await api('set','elevation',1);await api('set','motion',1);await api('set','camera-sway',1);await api('set','auto-performance',true)
        const saved=await api('saved'),home=await sample(`${tag}-home`)
        await api('play');await api('audioFixture',{energy:.65,build:.95,section:'build'});await page.waitForTimeout(1800);const build=await sample(`${tag}-build`);assert(build[2]<home[2]-.5)
        await api('audioFixture',{energy:1,cue:'drop',section:'drop'});await page.waitForTimeout(650);const drop=await sample(`${tag}-drop`);assert(drop[2]<home[2]-1)
        await api('audioFixture',{energy:.3,section:'breakdown'});await page.waitForTimeout(4000);const wide=await sample(`${tag}-breakdown`);assert(wide[2]>home[2]+.5)
        await api('pause');const paused=await sample(`${tag}-pause`);await api('audioSeek',20);assert.deepEqual(await sample(`${tag}-paused-seek`),paused);assert.equal(await api('saved'),saved)
        await api('set','camera-motion',false);assert.deepEqual(await sample(`${tag}-off`),home)
        await api('stop');await api('set','camera-motion',true);await api('set','auto-performance',false);await api('set','camera-safety','reduced');await api('play');await page.waitForTimeout(1000);await sample(`${tag}-reduced`);await api('stop');await api('prepare')
      }
    }
    await writeFile(path.join(output,'camera-shots.json'),JSON.stringify(shots,null,2));assert.deepEqual(errors,[]);await api('dispose');console.log(`HON-03 production captures: ${output}`)
  }else if(phase06){
    await api('quality','quality');await api('prepare');const baseline=await capture('default')
    const changed=async(name,edits)=>{await api('reset');await api('quality','quality');for(const [key,value] of Object.entries(edits))await api('set',key,value);await api('prepare');const pixels=await capture(name);assert(pixels.some((v,i)=>v!==baseline[i]),`${name} must affect pixels`)}
    await changed('particles-off',{particles:false});await changed('particles-low',{'particle-amount':.1});await changed('particles-high',{'particle-amount':1});const warm=await capture();await api('set','particle-color',[.1,1,.2,1]);const green=await capture('particles-color');assert(green.some((v,i)=>v!==warm[i]),'Particle color must independently affect pixels')
    await changed('atmosphere-off',{atmosphere:false});await changed('haze-high',{'haze-density':.025});await page.setViewportSize({width:1920,height:1080});await api('reset');await api('quality','quality');await api('set','focus-amount',1);const focusOn=await capture('dof-high');await api('set','depth-of-field',false);const focusOff=await capture('dof-off');assert(focusOff.some((v,i)=>v!==focusOn[i]),'DOF must affect full-resolution pixels');await page.setViewportSize({width:960,height:540});await changed('vignette-off',{vignette:0});await changed('grain-off',{grain:0});await changed('bloom-off',{bloom:0});await changed('ao-off',{ao:0})
    await api('reset');await api('quality','quality');await api('set','camera-motion',false);await api('play');await api('audioFixture',{band:'air',energy:.7});await page.waitForTimeout(350);await api('audioFixture',{band:'high',cue:'drop',energy:1});await capture('high-drop');await api('pause');const held=await capture('pause');assert.deepEqual(await capture('pause-hold'),held);await api('audioSeek',0);await capture('seek');await api('stop');await api('reset')
    const measurements=[]
    for(const [width,height] of [[1920,1080],[1080,1920],[1080,1080],[960,540],[640,360]]){
      await page.setViewportSize({width,height})
      for(const mode of ['performance','balanced','quality','auto']){
        await api('quality',mode);await api('prepare');await capture(`${width}x${height}-${mode}`);await api('play');measurements.push({mode,...await api('benchmark',30)});await api('stop')
      }
    }
    await writeFile(path.join(output,'performance.json'),JSON.stringify(measurements,null,2));await page.setViewportSize({width:960,height:540});await api('quality','quality');await api('prepare');await capture('pre-context-loss');const before=await api('status');await api('recoverContext');await api('prepare');await capture('context-restored')
    for(let i=0;i<3;i++){await api('reenter');await api('prepare')}
    const after=await api('status');assert.equal(after.modules.estimatedGpuBytes,before.modules.estimatedGpuBytes,'Module bytes must return after repeated switching')
    const outputPng=Buffer.from((await api('captureOutput')).split(',')[1],'base64');await writeFile(path.join(output,'canvas-stream.png'),outputPng);const outputPixels=await sharp(outputPng).removeAlpha().raw().toBuffer();assert(outputPixels.some(v=>v>40),'Canvas stream must contain rendered pixels')
    const disposed=await api('dispose');assert.equal(disposed.modules.estimatedGpuBytes,0);assert.equal(disposed.resources.activeLeaseCount,0);await writeFile(path.join(output,'lifecycle.json'),JSON.stringify({before,after,disposed},null,2));assert.deepEqual(errors,[]);console.log(`HONEY P06 production captures: ${output}`)
  }else{
  for(const [width,height] of [[960,540],[640,640],[540,960]]){await page.setViewportSize({width,height});const s=await api('prepare');assert.equal(s.active,'drmvyz.cinema2.honey');const pixels=await capture(`geometry-${width}x${height}`);assert(pixels.some(v=>v>40),'Expected visible geometry')}
  await page.setViewportSize({width:960,height:540});await api('prepare');const baseline=await capture('baseline');for(const key of ['face','edge','cavity','substrate','outer','inner','under']){await api('set',key,[.05,1,.15,1]);const pixels=await capture(`palette-${key}`);assert(pixels.some((v,i)=>v!==baseline[i]),`${key} must affect final pixels`);await api('reset')}
  // All captures use the registered preset and its actual shared effect graph. No material selector or camera override.
  const changed=async(name,edits,reference=baseline)=>{for(const [key,value] of Object.entries(edits))await api('set',key,value);await api('prepare');const pixels=await capture(name);assert(pixels.some((v,i)=>v!==reference[i]),`${name} must affect final pixels`);await api('reset');return pixels}
  for(const key of ['outerGain','innerGain','underGain','bloom','lightSpill','ambient','ao'])await changed(`${key}-off`,{[key]:0})
  const unbloomed=await changed('bloom-off',{bloom:0})
  await changed('emission-off-without-bloom',{bloom:0,outerGain:0,innerGain:0,underGain:0},unbloomed)
  await changed('sparse',{outerGain:0,innerGain:1,underGain:0})
  await changed('dense',{outerGain:1.35,innerGain:1.35,underGain:1.35})
  await changed('neutral-materials',{outerGain:0,innerGain:0,underGain:0,lightSpill:0,bloom:0,ao:0})
  await page.setViewportSize({width:540,height:960});await api('prepare');await capture('close-default');for(const key of ['outerGain','innerGain','underGain','lightSpill','bloom','ao'])await api('set',key,0);await capture('close-neutral');await api('reset')
  await page.setViewportSize({width:960,height:540});await api('prepare');assert.deepEqual(await capture('restored'),baseline)
  const status=await api('prepare');assert.equal(status.shadow.active,true);assert.equal(status.shadow.lastCasterCount,1);await writeFile(path.join(output,'runtime-status.json'),JSON.stringify(status,null,2))
  await api('showInspector',true);await page.screenshot({path:path.join(output,'inspector.png')});await api('showInspector',false);await api('reenter');await api('prepare');assert.deepEqual(await capture('reentry'),baseline)
  // Real runtime with an explicit test transport (no fabricated analysis or musical events).
  await api('set','camera-motion',false);await api('play',120,true)
  const patterns=['cascade','shockwave','fracture','alternating','convergence','current','submerge','overdrive'],frames=[]
  for(const pattern of patterns){
    await api('set','pattern',pattern);await page.waitForTimeout(1200);await api('prepare');const a=await capture(`${pattern}-a`);await page.waitForTimeout(500);const b=await capture(`${pattern}-b`)
    assert(a.some((v,i)=>v!==b[i]),`${pattern} must visibly move`);frames.push(b)
  }
  for(let i=0;i<frames.length;i++)for(let j=i+1;j<frames.length;j++)assert(frames[i].some((v,k)=>v!==frames[j][k]),'Distinct pattern captures required')
  await api('pause');const held=await capture('paused');await page.waitForTimeout(400);assert.deepEqual(await capture('paused-hold'),held)
  await api('stop');await api('reset');await api('prepare');await capture('returned-idle');
  await api('set','camera-motion',false);await api('play',120,false);await api('audioFixture');await page.waitForTimeout(250)
  const audioInspect=async()=>{const s=await api('prepare');const audio=s.modules.modules.find(m=>m.moduleId==='honey-wall')?.inspection?.audio;assert(audio,'Expected native HONEY audio diagnostics');return audio}
  await capture('audio-silence');const baselineAudio=await audioInspect();assert.equal(baselineAudio.available,true)
  for(const band of ['sub','bass','lowMid','mid','high','air']){
    await api('audioFixture',{band});await page.waitForTimeout(350);await capture(`audio-${band}`)
    assert((await audioInspect()).channels[band]>.8,`Expected routed ${band}`)
  }
  await api('audioFixture',{band:'bass',vocal:true});await page.waitForTimeout(350);await capture('audio-vocal-restraint')
  for(const cue of ['kick','snare','downbeat','phrase','drop']){
    await api('audioFixture',{energy:.7});await page.waitForTimeout(100);const prior=(await audioInspect()).consumed
    await api('audioFixture',{cue,energy:.7});await capture(`cue-${cue}`);const after=await audioInspect();assert.equal(after.consumed,prior+1,`Expected ${cue} once`)
    await page.waitForTimeout(100);assert.equal((await audioInspect()).consumed,after.consumed,'Held event must not replay')
  }
  await api('set','audio-reactivity',0);await api('audioFixture',{band:'sub',cue:'kick'});await capture('audio-off');const muted=await audioInspect();assert.equal(muted.envelopes.length,0);assert(Object.values(muted.channels).every(v=>v===0))
  await api('set','audio-reactivity',.8);await api('audioSeek',0);assert.equal((await audioInspect()).envelopes.length,0)
  await api('stop');await api('reset');await api('prepare');await capture('audio-returned-idle');
  // P05: exercise the actual registered runtime and shared Inspector (not mock pixels).
  await api('set','pattern-change',true);await api('set','trigger','snare');await api('set','auto-performance',true);await api('set','camera-motion',false)
  await api('play',120,true);await api('audioFixture',{energy:.10});await page.waitForTimeout(700)
  const savedAuto=await api('saved');await capture('director-calm')
  await api('showInspector',true)
  const control=id=>page.locator(`[data-cinema2-control-id="honey-${id}"]`)
  assert.equal(await control('motion-amount').locator('input[type=range]').isDisabled(),true)
  assert.equal(await control('bpm-sync').locator('xpath=ancestor::*[@data-auto-performance-locked]').count(),0)
  assert.equal(await control('face').locator('xpath=ancestor::*[@data-auto-performance-locked]').count(),0)
  await page.waitForFunction(()=>document.querySelector('[data-live-value]')&&document.querySelector('[data-live-policy]'))
  await page.screenshot({path:path.join(output,'auto-inspector-calm.png')});await api('showInspector',false)
  await api('audioFixture',{band:'bass',energy:.75,build:.95});await page.waitForTimeout(450);await capture('director-build')
  await api('audioFixture',{cue:'drop',band:'bass',energy:1});await capture('director-drop')
  await api('audioFixture',{energy:.35});await page.waitForTimeout(1200);await capture('director-release')
  await api('audioFixture',{energy:0});await page.waitForTimeout(900);await capture('director-silence')
  await api('audioFixture',{energy:.8,band:'bass'});await page.waitForTimeout(400);await capture('director-return')
  assert.equal(await api('saved'),savedAuto,'Auto must not change persisted settings')
  await api('audioFixture',{energy:.8,grid:false});const fallback=await api('prepare');const native=fallback.modules.modules.find(m=>m.moduleId==='honey-wall')?.inspection
  assert.equal(native.patternControlsAutomatic,false);assert.equal(native.effectiveTrigger,'snare')
  await api('set','face',[.2,.4,.6,1]);const edited=await api('saved');await api('reenter');assert.equal(await api('saved'),edited)
  await api('set','auto-performance',false);await api('showInspector',true);assert.equal(await control('motion-amount').locator('input[type=range]').isDisabled(),false)
  await page.screenshot({path:path.join(output,'auto-inspector-off.png')});await api('showInspector',false)
  await api('stop');await api('dispose');assert.deepEqual(errors,[]);console.log(`HONEY production captures: ${output}`)
  }
}finally{await browser?.close();server.kill()}

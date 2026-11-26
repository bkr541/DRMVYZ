import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir,writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from '@playwright/test'
import sharp from 'sharp'
import { pixelEvidence, visibleIssues } from './cinema2-assets/release-acceptance-core.mjs'
const port=48500+process.pid%1000,url=`http://127.0.0.1:${port}/src/test/browser/cinema2-spectrum-production.html`,output=path.resolve('artifacts/cinema2-spectrum/qa-03')
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:['ignore','pipe','pipe']})
let browser,log='';const report={captures:{},retirements:[],failures:{},errors:[],console:[],requests:[],renderer:null,environment:null};server.stdout.on('data',v=>log+=v);server.stderr.on('data',v=>log+=v)
try{
  await mkdir(output,{recursive:true});let ready=false
  for(let i=0;i<150;i++){if(server.exitCode!==null)throw Error(log);try{if((await fetch(url)).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,100))}assert(ready,log)
  browser=await chromium.launch({headless:true,args:['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'],...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})})
  const page=await browser.newPage({viewport:{width:960,height:540},deviceScaleFactor:1})
  let injection=null
  page.on('pageerror',e=>report.errors.push({kind:'pageerror',message:e.message,injection}))
  page.on('console',m=>{const entry={kind:m.type(),message:m.text(),injection};report.console.push(entry);if(m.type()==='error'||/GL_INVALID|WebGL.*error/i.test(m.text()))report.errors.push(entry)})
  page.on('requestfailed',r=>report.requests.push({url:r.url(),error:r.failure()?.errorText,injection}))
  page.on('response',r=>{if(r.status()>=400)report.requests.push({url:r.url(),status:r.status(),injection})})
  await page.goto(url);await page.waitForFunction(()=>!!window.__spectrumProduction)
  const api=(method,...args)=>page.evaluate(({method,args})=>window.__spectrumProduction[method](...args),{method,args})
  report.renderer=await api('renderer')
  report.environment={browser:browser.version(),software:/swiftshader|llvmpipe|software|lavapipe/i.test(report.renderer.renderer)?true:null}
  const spectrum='drmvyz.cinema2.spectrum'
  const inspect=s=>s.modules.modules.find(m=>m.moduleId==='spectrum-machine')
  const waitState=state=>page.waitForFunction(state=>window.__spectrumProduction.status().modules.modules.some(m=>m.moduleId==='spectrum-machine'&&m.inspection?.renderState===state),state,{timeout:60000})
  const assertRetired=(s,label)=>{
    report.retirements.push({label,status:s});assert.equal(s.runtime.phase,'disposed',label)
    assert.equal(s.modules.activeResourceLeaseCount,0,label);assert.equal(s.modules.estimatedGpuBytes,0,label)
    assert.equal(s.resources.activeLeaseCount,0,label);assert.equal(s.resources.estimatedGpuMemoryBytes,0,label);assert.equal(s.media.readyResourceCount,0,label)
  }
  const select=async(id,label)=>{const retired=await api('select',id);if(retired)assertRetired(retired,label??id)}
  const capture=async(name,{arena=true,other=false}={})=>{
    await page.waitForFunction(other=>{const s=window.__spectrumProduction.status();if(s.modules.failedModuleCount||s.render.failedPassCount)throw Error(JSON.stringify(s));return s.runtime.phase==='running'&&(other?s.modules.activeModuleCount>0&&s.render.frameCount>2&&s.modules.modules.every(m=>m.inspection?.ready!==false&&m.inspection?.renderReady!==false):s.modules.modules.find(m=>m.moduleId==='spectrum-machine')?.inspection?.renderReady===true)},other,{timeout:60000})
    const png=Buffer.from((await api('capture')).split(',')[1],'base64');await writeFile(path.join(output,`${name}.png`),png)
    const status=await api('status'),glError=await api('glError')
    const {data,info}=await sharp(png).toColourspace('srgb').removeAlpha().raw().toBuffer({resolveWithObject:true})
    const pixels=pixelEvidence(data,info.width,info.height)
    report.captures[name]={status,glError,pixels,width:info.width,height:info.height}
    assert.equal(status.modules.failedModuleCount,0,JSON.stringify(status));assert.equal(status.modules.degradedModuleCount,0,JSON.stringify(status));assert.equal(status.render.failedPassCount,0,JSON.stringify(status));assert.equal(status.media.errorCount,0);assert.equal(glError,0)
    assert.equal(status.runtime.phase,'running');assert(status.render.executedPassCount>0,'No render passes executed')
    assert.deepEqual(visibleIssues(arena?'spectrum':'other',pixels,arena?'default':'performance'),[],`${name}: invalid scene pixels`)
    return status
  }
  await capture('cold-default');await api('play','build');await capture('build');await api('play','drop');await capture('drop');await capture('drop-sustained');await api('play','breakdown');await capture('breakdown')
  // Retain the real picker path for reentry; verify the intervening preset itself renders.
  for(const other of ['afterhours','honey','allstar']){
    for(const id of [other,'spectrum']){
      await api('showRail',true);const card=page.locator(`[data-cinema2-preset-id="drmvyz.cinema2.${id}"]`);await card.scrollIntoViewIfNeeded();await card.click();await api('showRail',false);assertRetired(await api('retired'),`picker-to-${id}`)
      if(id===other)await capture(`other-${other}`,{arena:false,other:true})
    }
    await capture(`from-${other}`)
  }
  await api('pause');await capture('paused');await api('seek');await capture('seek');await api('play','drop');await capture('resumed')
  await api('pattern','radial-sweep');const pattern=await capture('radial-sweep');assert.equal(inspect(pattern).inspection.activePattern,'radial-sweep');await api('reset')
  for(const quality of ['performance','balanced','quality']){await api('quality',quality);await capture(quality)}
  await page.setViewportSize({width:540,height:960});await capture('portrait');await page.setViewportSize({width:960,height:540});await capture('landscape')
  const media=await api('media',false);assert.equal(media.media.readyResourceCount,1);const mediaFrame=await capture('media',{arena:false});assert.equal(inspect(mediaFrame).inspection.userMedia,true)
  await api('media',true);const removed=await capture('media-removed');assert.equal(removed.media.readyResourceCount,0);assert.equal(inspect(removed).inspection.userMedia,false)
  await api('procedural');await capture('procedural');await api('reset')
  const recover=async label=>{const result=await api('recoverContext');report.failures[label]=result;assert.equal(result.lost.modules.activeResourceLeaseCount,0);assert.equal(result.lost.modules.estimatedGpuBytes,0);assert(result.restored.runtime.contextGeneration>result.lost.runtime.contextGeneration)}
  await recover('ready-context-loss');await capture('context-restored')
  // Inject only at the test loader boundary. Each recovery draws the real arena.
  injection='recoverable';await api('fixture','reject');await select(spectrum);await waitState('recoverable-failure')
  const failure=await api('status');report.failures.recoverable=failure;assert.equal(inspect(failure).activeResourceLeaseCount,0);assert.equal(inspect(failure).estimatedGpuBytes,0);assert.match(JSON.stringify(failure),/QA-03 injected library rejection/)
  await api('fixture','restore');injection=null;await select(spectrum);await capture('recoverable-retry')
  injection='fatal';await api('fixture','fatal');await select(spectrum)
  await page.waitForFunction(()=>window.__spectrumProduction.status().modules.failedModuleCount===1,{},{timeout:60000})
  const fatal=await api('status');report.failures.fatal=fatal;assert.equal(inspect(fatal).activeResourceLeaseCount,0);assert.equal(inspect(fatal).estimatedGpuBytes,0);assert.match(JSON.stringify(fatal),/QA-03 injected arena construction failure/)
  await api('fixture','restore');injection=null;await select(spectrum);await capture('fatal-reentry')
  await api('fixture','delay');await select(spectrum);await waitState('loading');await select('drmvyz.cinema2.afterhours','retire-loading-to-other');await select(spectrum,'rapid-reentry');await waitState('loading');await select(spectrum,'repeat-loading-selection');await waitState('loading');await recover('loading-context-loss');await api('releaseLoad');await capture('delayed-reentry');await api('fixture','restore')
  // Dispose while the actual import is pending and release it only after unmount.
  await api('fixture','delay');await select(spectrum);await waitState('loading');const disposed=await api('dispose');assertRetired(disposed,'unmount-loading');await api('releaseLoad');await page.waitForTimeout(100);assertRetired(await api('status'),'after-late-completion')
  const unexpected=report.errors.filter(e=>!(e.injection&&/QA-03 injected (library rejection|arena construction failure)/.test(e.message)))
  assert.deepEqual(unexpected,[]);assert.deepEqual(report.requests,[])
  report.result='pass';console.log(`QA-03 captures: ${output}`)
}catch(error){report.result='fail';report.failure=String(error);throw error}
finally{await mkdir(output,{recursive:true});await writeFile(path.join(output,'status.json'),JSON.stringify(report,null,2));await browser?.close();server.kill()}

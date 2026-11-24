import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir,writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from '@playwright/test'
import sharp from 'sharp'
const port=48500+process.pid%1000,url=`http://127.0.0.1:${port}/src/test/browser/cinema2-hud-production.html`,output=path.resolve('artifacts/cinema2-hud')
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:['ignore','pipe','pipe']})
let log='',browser;server.stdout.on('data',v=>log+=v);server.stderr.on('data',v=>log+=v)
try{
  await mkdir(output,{recursive:true});let ready=false
  for(let i=0;i<150;i++){if(server.exitCode!==null)throw Error(log);try{if((await fetch(url)).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,100))}assert(ready,log)
  browser=await chromium.launch({headless:true,args:['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'],...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})})
  const page=await browser.newPage({viewport:{width:960,height:540},deviceScaleFactor:1}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await page.waitForFunction(()=>!!window.__hudProduction)
  const api=(method,...args)=>page.evaluate(({method,args})=>window.__hudProduction[method](...args),{method,args})
  await api('showRail',true);await page.getByRole('button',{name:'Load HUD',exact:true}).click();await api('showRail',false)
  const capture=async name=>{await api('prepare');const b=Buffer.from((await api('capture')).split(',')[1],'base64');await writeFile(path.join(output,`${name}.png`),b);return sharp(b).removeAlpha().raw().toBuffer()}
  const different=(a,b)=>a.length!==b.length||a.some((v,i)=>v!==b[i])
  const visible=pixels=>pixels.some(v=>v>40)
  const freeze=async()=>{await api('set','motion',0);await api('set','cameraMotion',false)}
  await freeze();const baseline=await capture('default');assert(visible(baseline),'HUD must render visible geometry')
  for(const key of ['primary','meters','indicators','metal','satellites','background']){
    await api('set',key,[.05,1,.15,1]);assert(different(baseline,await capture(`palette-${key}`)),`Palette role ${key} must affect final pixels`);await api('reset');await freeze()
  }
  for(const [key,value] of Object.entries({intensity:0,separation:0,coverage:0,satelliteAmount:0,shutter:0,meterTravel:0,bloom:0,haze:.02,vignette:0})){
    const before=await capture(`control-${key}-baseline`);await api('set',key,value);assert(different(before,await capture(`control-${key}`)),`${key} must affect final pixels`);await api('reset');await freeze()
  }
  const programs=['reactor','radar','counter-spin','energy-pulse','orbital','segment-chase','collapse','lock-on','overload'],patterns=[]
  await api('set','motion',.8);await api('play',120,true)
  for(const pattern of programs){await api('set','pattern',pattern);await page.waitForTimeout(750);const a=await capture(`${pattern}-a`);await page.waitForTimeout(400);const b=await capture(`${pattern}-b`);assert(different(a,b),`${pattern} must visibly animate`);assert(visible(b));patterns.push(b)}
  for(let i=0;i<patterns.length;i++)for(let j=i+1;j<patterns.length;j++)assert(different(patterns[i],patterns[j]),'Pattern outputs must differ')
  await api('pause');const paused=await capture('pause');await page.waitForTimeout(300);assert(!different(paused,await capture('pause-held')),'Paused geometry should hold')
  await api('stop');await api('reset');await freeze();await api('play',120,true);await api('audioFixture');const silent=await capture('audio-silence')
  await api('audioFixture',{band:'bass',energy:.7});await page.waitForTimeout(300);assert(different(silent,await capture('audio-bass')),'Bass must visibly affect geometry')
  await api('set','patternChange',true);await api('set','trigger','kick');await api('audioFixture');const read=async()=>{const s=await api('prepare');return s.modules.modules.find(m=>m.moduleId==='hud-reactor')?.inspection}
  const before=await read();await api('audioFixture',{cue:'kick',energy:.7});assert.notEqual((await read()).activePattern,before.activePattern)
  const triggered=await read();await page.waitForTimeout(250);assert.equal((await read()).activePattern,triggered.activePattern,'Held kick must not replay')
  await api('set','pattern','orbital');assert.equal((await read()).activePattern,'orbital');assert.equal((await read()).effectivePatternChange,true)
  await api('set','bpmSync',false);assert.equal((await read()).locked,false);await api('set','bpmSync',true);assert.equal((await read()).locked,true)
  await api('set','autoPerformance',true);const saved=await api('saved');await api('audioFixture',{band:'bass',energy:.8,build:.8});await page.waitForTimeout(600)
  await api('showInspector',true);const control=id=>page.locator(`[data-cinema2-control-id="hud-${id}"]`)
  assert.equal(await control('motion').locator('input[type=range]').isDisabled(),true)
  assert.equal(await control('bpm-sync').locator('xpath=ancestor::*[@data-auto-performance-locked]').count(),0)
  assert.equal(await control('primary').locator('xpath=ancestor::*[@data-auto-performance-locked]').count(),0)
  await page.waitForFunction(()=>document.querySelector('[data-live-value]')&&document.querySelector('[data-live-policy]'))
  const box=await control('motion').boundingBox();await api('audioFixture',{cue:'drop',energy:1,band:'bass'});const peak=await control('motion').boundingBox();assert.deepEqual(peak,box,'Live values must not shift the control layout');await page.screenshot({path:path.join(output,'auto-inspector.png')})
  await api('showInspector',false);await capture('drop');await api('audioFixture',{energy:0});await page.waitForTimeout(900);await capture('silent-stop');assert.equal(await api('saved'),saved,'Auto Performance must not mutate saved parameters')
  await api('set','autoPerformance',false);await api('showInspector',true);assert.equal(await control('motion').locator('input[type=range]').isDisabled(),false);await api('showInspector',false)
  await api('stop');await api('reset');await freeze()
  for(const [width,height] of [[960,540],[640,640],[540,960]]){await page.setViewportSize({width,height});assert(visible(await capture(`aspect-${width}x${height}`)))}
  const savedBefore=await api('saved');await api('reenter');assert.equal(await api('saved'),savedBefore);await capture('reentry')
  const outputPng=Buffer.from((await api('captureOutput')).split(',')[1],'base64');await writeFile(path.join(output,'canvas-stream.png'),outputPng);assert(visible(await sharp(outputPng).removeAlpha().raw().toBuffer()))
  const final=await api('dispose');assert.equal(final.resources.activeLeaseCount,0);await writeFile(path.join(output,'lifecycle.json'),JSON.stringify(final,null,2));assert.deepEqual(errors,[])
  console.log(`HUD production captures: ${output}`)
}finally{await browser?.close();server.kill()}

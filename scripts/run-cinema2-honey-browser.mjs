import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir,writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from '@playwright/test'
import sharp from 'sharp'
const port=48500+process.pid%1000,url=`http://127.0.0.1:${port}/src/test/browser/cinema2-honey-production.html`,output=path.resolve('artifacts/cinema2-honey/p02')
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:['ignore','pipe','pipe']})
let log='',browser;server.stdout.on('data',v=>log+=v);server.stderr.on('data',v=>log+=v)
try{
  await mkdir(output,{recursive:true});let ready=false
  for(let i=0;i<150;i++){if(server.exitCode!==null)throw Error(log);try{if((await fetch(url)).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,100))}assert(ready,log)
  browser=await chromium.launch({headless:true,args:['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'],...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})})
  const page=await browser.newPage({viewport:{width:960,height:540},deviceScaleFactor:1}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await page.waitForFunction(()=>!!window.__honeyProduction)
  const api=(method,...args)=>page.evaluate(({method,args})=>window.__honeyProduction[method](...args),{method,args})
  await api('showRail',true);await page.locator('[data-cinema2-preset-id="drmvyz.cinema2.honey"]').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,'selector.png')});await page.getByRole('button',{name:'Load HONEY',exact:true}).click();await api('showRail',false)
  const capture=async(name)=>{const b=Buffer.from((await api('capture')).split(',')[1],'base64');if(name)await writeFile(path.join(output,`${name}.png`),b);return sharp(b).removeAlpha().raw().toBuffer()}
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
  await api('showInspector',true);await page.screenshot({path:path.join(output,'inspector.png')});await api('showInspector',false);await api('reenter');await api('prepare');assert.deepEqual(await capture('reentry'),baseline);await api('dispose');assert.deepEqual(errors,[]);console.log(`HONEY production captures: ${output}`)
}finally{await browser?.close();server.kill()}

import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir,writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from '@playwright/test'
import sharp from 'sharp'
const port=48500+process.pid%1000,url=`http://127.0.0.1:${port}/src/test/browser/cinema2-spectrum-production.html`,output=path.resolve('artifacts/cinema2-spectrum/spe-01')
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:['ignore','pipe','pipe']})
let browser,log='';server.stdout.on('data',v=>log+=v);server.stderr.on('data',v=>log+=v)
try{
  await mkdir(output,{recursive:true});let ready=false
  for(let i=0;i<150;i++){if(server.exitCode!==null)throw Error(log);try{if((await fetch(url)).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,100))}assert(ready,log)
  browser=await chromium.launch({headless:true,args:['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'],...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})})
  const page=await browser.newPage({viewport:{width:960,height:540},deviceScaleFactor:1}),errors=[]
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/WebGL|shader|GL_INVALID/i.test(m.text()))errors.push(m.text())})
  await page.goto(url);await page.waitForFunction(()=>!!window.__spectrumProduction)
  const api=(method,...args)=>page.evaluate(({method,args})=>window.__spectrumProduction[method](...args),{method,args})
  const capture=async name=>{
    await page.waitForFunction(()=>{const s=window.__spectrumProduction.status();if(s.modules.failedModuleCount||s.render.failedPassCount)throw Error(JSON.stringify(s));return s.modules.modules.find(m=>m.moduleId==='spectrum-machine')?.inspection?.renderReady===true},{},{timeout:60000})
    const status=await api('status');assert.equal(status.modules.degradedModuleCount,0,JSON.stringify(status));assert.equal(await api('glError'),0)
    const png=Buffer.from((await api('capture')).split(',')[1],'base64');await writeFile(path.join(output,`${name}.png`),png)
    const {data,info}=await sharp(png).removeAlpha().raw().toBuffer({resolveWithObject:true});let lit=0,chroma=0;const zones=new Set()
    for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){const i=(y*info.width+x)*info.channels,r=data[i],g=data[i+1],b=data[i+2];if(Math.max(r,g,b)>45)lit++;if(Math.max(r,g,b)>55&&Math.max(r,g,b)-Math.min(r,g,b)>20){chroma++;zones.add(`${Math.floor(x/info.width*3)}:${Math.floor(y/info.height*3)}`)}}
    assert(lit>info.width*info.height*.005,`${name}: blank output`);assert(chroma>100&&zones.size>=2,`${name}: expected spatially distributed arena lighting`)
    return status
  }
  const cold=await capture('cold-default');await api('play');await capture('playing')
  for(const other of ['afterhours','honey','allstar']){
    for(const id of [other,'spectrum']){await api('showRail',true);const card=page.locator(`[data-cinema2-preset-id="drmvyz.cinema2.${id}"]`);await card.scrollIntoViewIfNeeded();await card.click();await api('showRail',false)}
    await capture(`from-${other}`)
  }
  await api('procedural');await api('pause');await capture('paused');await api('seek');await capture('seek');await api('reset')
  for(const quality of ['performance','balanced','quality']){await api('quality',quality);await capture(quality)}
  const disposed=await api('dispose');assert.equal(disposed.modules.activeResourceLeaseCount,0);assert.equal(disposed.modules.estimatedGpuBytes,0);assert.deepEqual(errors,[])
  await writeFile(path.join(output,'status.json'),JSON.stringify({cold,disposed},null,2));console.log(`SPE-01 captures: ${output}`)
}finally{await browser?.close();server.kill()}

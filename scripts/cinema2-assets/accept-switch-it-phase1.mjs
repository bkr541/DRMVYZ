/* global window, document, study */
// Phase 1 only: native runtime, private registries, static states, no music or finishing.
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import sharp from 'sharp'
const root = resolve(import.meta.dirname, '../..'), out = resolve(root, 'artifacts/switch-it-phase1')
await mkdir(out, { recursive: true })
const script = `
const {Cinema2Runtime}=await import('/src/components/vyzualz/cinema2/runtime/Cinema2Runtime.ts');
const {createSwitchItPhase1Registries,SWITCH_IT_PHASE1_ID,SWITCH_IT_PREVIEW_STATE_ID}=await import('/src/components/vyzualz/cinema2/presets/Cinema2SwitchItPhase1Preset.ts');
let pending,time=0,runtime;
const options={...createSwitchItPhase1Registries(),presetId:SWITCH_IT_PHASE1_ID,renderQuality:'high',diagnosticsEnabled:true,
requestAnimationFrame:cb=>{pending=cb;return 1},cancelAnimationFrame:()=>{},
transportSource:{getState:()=>({sourcePresent:false,playing:false,analysisActive:false,paused:false,animationActive:false,trackId:null,timeSec:time/1000})}};
const tick=(count=1)=>{for(let i=0;i<count;i++){time+=100;pending(time)}};
const enter=()=>{const result=Cinema2Runtime.create(document.querySelector('canvas'),options);if(!result.runtime)throw Error(JSON.stringify(result));runtime=result.runtime;runtime.resize({width:768,height:768,dpr:1});runtime.start();tick()};
enter();
window.study={tick,set:state=>{runtime.getParameterState().setPersistentValue(SWITCH_IT_PREVIEW_STATE_ID,state);tick(3)},
status:()=>({modules:runtime.getModuleRuntimeSnapshot(),render:runtime.getRenderGraphExecutorSnapshot(),resources:runtime.getResourceManagerSnapshot()}),
reenter:()=>{runtime.dispose();const retired=runtime.getResourceManagerSnapshot();enter();return retired},
dispose:()=>{runtime.dispose();return runtime.getResourceManagerSnapshot()}};
for(const name of ['human','skull','hybrid','crown']){const button=document.createElement('button');button.textContent=name;button.onclick=()=>study.set(name);document.querySelector('nav').append(button)}
setInterval(()=>tick(),100);
`
const html = `<html><head><link rel="icon" href="data:,"></head><body style="margin:0;background:#05060a;color:#ddd;font:14px system-ui"><nav style="position:absolute;top:8px;left:8px"></nav><canvas width="768" height="768"></canvas><footer style="padding:12px">Demon Mask by <a href="https://sketchfab.com/silentegor">egorova.e</a> · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a> · Textures resized; portrait registration and red lighting by DRMVYZ.</footer><script type="module">${script}</script></body></html>`
const server = await createServer({ root, clearScreen:false, server:{host:'127.0.0.1',port:0}, plugins:[{name:'switch-it-phase1',configureServer(s){s.middlewares.use('/__switch-it-phase1',(_req,res)=>{res.setHeader('Content-Type','text/html');res.end(html)})}}] })
let browser
const errors=[]
try {
 await server.listen()
 const url=`http://127.0.0.1:${server.httpServer.address().port}/__switch-it-phase1`
 if(process.argv.includes('--serve')){console.log(`Switch It Phase 1 review: ${url}`);await new Promise(()=>{});}
 browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'})
 const page=await browser.newPage({viewport:{width:768,height:768}})
 page.on('pageerror',e=>errors.push(e.message))
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
 await page.goto(url)
 await page.waitForFunction(()=>window.study?.status().modules.modules.some(m=>m.activeResourceLeaseCount>0)).catch(async error=>{console.error(JSON.stringify({errors,status:await page.evaluate(()=>window.study?.status())},null,2));throw error})
 await page.evaluate(()=>document.querySelector('nav').style.display='none')
 const capture=async name=>sharp(await page.locator('canvas').screenshot({path:resolve(out,`${name}.png`)})).removeAlpha().raw().toBuffer()
 const diff=(a,b)=>a.reduce((sum,v,i)=>sum+Math.abs(v-b[i]),0)/a.length
 const samples=[], images=[]
 await page.evaluate(()=>study.tick(3))
 for(const state of ['human','skull','hybrid','crown']){
  await page.evaluate(s=>study.set(s),state)
  const image=await capture(state);images.push(image)
  await page.evaluate(()=>study.tick(100))
  const held=await capture(`${state}-held`),difference=diff(image,held)
  if(difference>.01)throw Error(`Static state moved: ${state}: ${difference}`)
  let lit=0;for(let i=0;i<image.length;i+=3)if(Math.max(image[i],image[i+1],image[i+2])>45)lit++
  if(lit<1000)throw Error(`Empty subject: ${state}`)
  const status=await page.evaluate(()=>study.status())
  if(status.render.failedPassCount||status.modules.failedModuleCount||status.modules.degradedModuleCount)throw Error(JSON.stringify(status))
  const eyes=[308,460].map(cx=>{let white=0,dark=0;for(let y=297;y<351;y++)for(let x=cx-48;x<cx+48;x++){const i=(y*768+x)*3;if(Math.min(image[i],image[i+1],image[i+2])>170)white++;if(Math.max(image[i],image[i+1],image[i+2])<35)dark++}return{white,dark}})
  if(eyes.some(eye=>eye.white<350))throw Error('Human eye landmarks are missing')
  const maskSockets=[314,454].map(cx=>{let dark=0;for(let y=312;y<336;y++)for(let x=cx-12;x<cx+12;x++){const i=(y*768+x)*3;if(Math.max(image[i],image[i+1],image[i+2])<35)dark++}return dark})


  samples.push({state,staticDifference:difference,litPixels:lit,eyes,maskSockets})
 }
 for(let i=1;i<images.length;i++)if(diff(images[0],images[i])<1)throw Error('Review states are indistinguishable')
 const retired=await page.evaluate(()=>study.reenter())
 if(retired.activeLeaseCount||retired.estimatedGpuMemoryBytes)throw Error('Retired resource leak')
 await page.waitForFunction(()=>study.status().modules.modules.some(m=>m.activeResourceLeaseCount>0))
 await page.evaluate(()=>study.set('human'))
 const reentryDifference=diff(images[0],await capture('human-reentry'))
 if(reentryDifference>.01)throw Error(`Reentry changed output: ${reentryDifference}`)
 const disposed=await page.evaluate(()=>study.dispose())
 if(disposed.activeLeaseCount||disposed.estimatedGpuMemoryBytes)throw Error('Disposal leaked resources')
 if(errors.length)throw Error(errors.join('\n'))
 const cells=await Promise.all(['human','skull','hybrid','crown'].map(async(state,i)=>({input:await sharp(resolve(out,`${state}.png`)).resize(480,480).toBuffer(),left:i%2*480,top:Math.floor(i/2)*510+30})))
 const labels=Buffer.from(`<svg width="960" height="1020" xmlns="http://www.w3.org/2000/svg"><style>text{font:16px sans-serif;fill:#ddd}</style>${['Human','Skull','Hybrid','Crown'].map((s,i)=>`<text x="${i%2*480+15}" y="${Math.floor(i/2)*510+22}">${s}</text>`).join('')}</svg>`)
 await sharp({create:{width:960,height:1020,channels:3,background:'#05060a'}}).composite([...cells,{input:labels}]).png().toFile(resolve(out,'review-sheet.png'))
 const report={samples,reentryDifference,retired,disposed,errors}
 await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2))
}finally{await browser?.close();await server.close()}

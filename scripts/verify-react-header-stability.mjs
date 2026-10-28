import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import { chromium } from '@playwright/test'
const root=resolve(import.meta.dirname,'..'),out=resolve(root,'artifacts/react-header-stability')
await mkdir(out,{recursive:true})
const server=await createServer({root,server:{host:'127.0.0.1',port:0},clearScreen:false,plugins:[{name:'header-stability-check',configureServer(s){s.middlewares.use('/__header-stability',(_q,r)=>{r.setHeader('Content-Type','text/html');r.end('<html><body style="margin:0;background:#101014"><div id="root"></div></body></html>')})}}]})
let browser
const errors=[],samples=[]
try{
await server.listen();browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'})
const page=await browser.newPage({viewport:{width:1440,height:180}})
page.on('pageerror',e=>errors.push(e.message))
await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__header-stability`)
await page.evaluate(async()=>{
const Refresh=(await import('/@react-refresh')).default;Refresh.injectIntoGlobalHook(globalThis);globalThis.$RefreshReg$=()=>{};globalThis.$RefreshSig$=()=>type=>type;globalThis.__vite_plugin_react_preamble_installed__=true
for(const css of ['styles.css','styles/appearance.css','styles/vyzualz.css','styles/reactView.css','styles/typography.css'])await import(`/src/${css}`)
let percent=0
Object.defineProperty(globalThis,'drmvyzNative',{configurable:true,value:{system:{getCpuUsage:async()=>({percent,rawPercent:percent,processCount:6,cores:8,timestamp:Date.now()})}}})
const ReactModule=await import('/node_modules/.vite/deps/react.js'),React=ReactModule.default??ReactModule
const ClientModule=await import('/node_modules/.vite/deps/react-dom_client.js'),Client=ClientModule.default??ClientModule
const {ReactHeaderStatusCluster}=await import('/src/components/vyzualz/react/ReactHeaderStatusCluster.tsx')
const {useReactPersistenceStatusStore}=await import('/src/stores/reactPersistenceStatusStore.ts')
const {usePageActivityStore}=await import('/src/stores/pageActivityStore.ts')
const {NotificationPageProvider}=await import('/src/stores/notificationStore.ts')
const app=Client.createRoot(globalThis.document.querySelector('#root'))
const e=React.createElement
const render=(props={fps:0,qualityTier:'low'},phase='idle',retryPending=false)=>{
useReactPersistenceStatusStore.setState({phase,retryPending,lastSavedAt:phase==='saved'?new Date(2026,9,28,23,59).getTime():null,error:phase==='error'?'Storage is unavailable':null})
usePageActivityStore.getState().replaceOwnerSources('react','header-check',phase==='saving'?{assets:'Loading assets'}:{})
app.render(e(NotificationPageProvider,{value:'react'},e('div',{className:'rv-shell'},e('div',{className:'vz-header',style:{display:'flex',alignItems:'center',gap:8,width:'100%',padding:8,boxSizing:'border-box'}},
e('button',{className:'vsm-settings-btn','data-header-probe':'output',style:{width:34}},'◉'),e('span',{className:'az-spacer',style:{flex:1}}),
e('button',{className:'vsm-settings-btn','data-header-probe':'layout',style:{width:34}},'☷'),e(ReactHeaderStatusCluster,props),
e('button',{className:'vsm-settings-btn','data-header-probe':'settings',style:{width:34}},'⚙')))))
}
render()
globalThis.headerCheck={render,cpu:value=>{percent=value},dispose:()=>app.unmount(),rects(){const records={};for(const el of globalThis.document.querySelectorAll('[data-header-probe], .vz-header-readout, .vz-header-readout-label')){
const key=el.getAttribute('data-header-probe')??`${el.classList.contains('vz-header-readout-label')?'caption':'group'}-${el.querySelector('.vz-header-readout-label')?.textContent??el.textContent}`
const b=el.getBoundingClientRect(),style=globalThis.getComputedStyle(el);records[key]={x:b.x,y:b.y,width:b.width,height:b.height,font:style.fontFamily,size:style.fontSize,weight:style.fontWeight}
}return records}}
await globalThis.document.fonts.ready
})
await page.waitForSelector('[data-react-header-status]')
const cases=[{fps:0,qualityTier:'low',phase:'idle'},{fps:9,frameTimeMs:8.3,qualityTier:'high',phase:'saving'},{fps:999,frameTimeMs:1000,qualityTier:'medium',phase:'dirty'},{fps:10000,frameTimeMs:99999.9,qualityTier:'low',phase:'error'},{fps:60,frameTimeMs:16.7,qualityTier:'high',phase:'error',retry:true},{fps:1,frameTimeMs:1e20,qualityTier:'medium',phase:'saved'}]
for(const width of [1440,1280,1024]){
await page.setViewportSize({width,height:180})
let baseline
for(const state of cases){await page.evaluate(s=>globalThis.headerCheck.render({fps:s.fps,frameTimeMs:s.frameTimeMs,qualityTier:s.qualityTier},s.phase,s.retry??false),state);await page.evaluate(async()=>{await new Promise(globalThis.requestAnimationFrame);await new Promise(globalThis.requestAnimationFrame)})
const rects=await page.evaluate(()=>globalThis.headerCheck.rects());if(!baseline)baseline=rects
const overflow=await page.evaluate(()=>[...globalThis.document.querySelectorAll('[data-performance-metric="quality"], .vz-header-readout:first-child em')].filter(el=>el.scrollWidth>el.clientWidth+1).map(el=>({text:el.textContent,available:el.clientWidth,needed:el.scrollWidth})))
if(overflow.length)throw new Error(`Normal header values clipped: ${JSON.stringify(overflow)}`)
for(const[key,initial]of Object.entries(baseline))for(const prop of ['x','y','width','height'])if(Math.abs(initial[prop]-rects[key][prop])>.1)throw new Error(`${width}px ${key} ${prop} shifted: ${initial[prop]} → ${rects[key][prop]} (${JSON.stringify(state)})`)
samples.push({width,state,rects})
}
await page.evaluate(()=>globalThis.headerCheck.render({fps:60,frameTimeMs:16.7,qualityTier:'high'},'saved'));await page.evaluate(()=>new Promise(globalThis.requestAnimationFrame))
await page.screenshot({path:resolve(out,`header-${width}.png`)})
}
const beforeCpu=await page.evaluate(()=>globalThis.headerCheck.rects())
for(const cpu of [9,100]){await page.evaluate(v=>globalThis.headerCheck.cpu(v),cpu);await page.waitForFunction(v=>globalThis.document.querySelector('[data-header-cpu]')?.textContent===`${v}%`,cpu)
const rects=await page.evaluate(()=>globalThis.headerCheck.rects());for(const[key,initial]of Object.entries(beforeCpu))for(const prop of ['x','y','width','height'])if(Math.abs(initial[prop]-rects[key][prop])>.1)throw new Error(`CPU ${cpu}% shifted ${key} ${prop}`)
}
if(errors.length)throw new Error(errors.join('\n'))
await writeFile(resolve(out,'report.json'),JSON.stringify({cases:samples.length,cpuCases:2,errors,samples},null,2))
console.log(JSON.stringify({cases:samples.length,cpuCases:2,errors}))
await page.evaluate(()=>globalThis.headerCheck.dispose())
}finally{await browser?.close();await server.close()}

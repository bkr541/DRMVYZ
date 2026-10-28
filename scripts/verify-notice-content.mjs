import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import { chromium } from '@playwright/test'
const root=resolve(import.meta.dirname,'..'),out=resolve(root,'artifacts/notice-content')
await mkdir(out,{recursive:true})
const server=await createServer({root,server:{host:'127.0.0.1',port:0},clearScreen:false,plugins:[{name:'notice-content',configureServer(s){s.middlewares.use('/__notice-content',(_q,r)=>{r.setHeader('Content-Type','text/html');r.end('<html><body style="margin:0;background:#0b1114"><div id="root"></div></body></html>')})}}]})
let browser
const errors=[],checks=[]
try{
await server.listen()
browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'})
const page=await browser.newPage({viewport:{width:1000,height:800}})
page.on('pageerror',e=>errors.push(e.message))
await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__notice-content`)
await page.evaluate(async()=>{
const Refresh=(await import('/@react-refresh')).default;Refresh.injectIntoGlobalHook(globalThis);globalThis.$RefreshReg$=()=>{};globalThis.$RefreshSig$=()=>type=>type;globalThis.__vite_plugin_react_preamble_installed__=true
for(const css of ['styles.css','styles/appearance.css','styles/vyzualz.css','styles/reactView.css','styles/lyricManager.css','styles/typography.css'])await import(`/src/${css}`)
const R=await import('/node_modules/.vite/deps/react.js'),React=R.default??R,C=await import('/node_modules/.vite/deps/react-dom_client.js'),Client=C.default??C
const {LyricPreviewPanel}=await import('/src/features/lyrics/components/LyricPreviewPanel.tsx')
const {LayoutLabNoticeTab}=await import('/src/components/vyzualz/react/layoutLab/LayoutLabNoticeTab.tsx')
const {NoticeCard}=await import('/src/components/vyzualz/react/controls/NoticeCard.tsx')
const {HeaderNotificationsButton}=await import('/src/components/vyzualz/shared/HeaderNotificationsButton.tsx')
const {NotificationPageProvider,notify}=await import('/src/stores/notificationStore.ts')
const e=React.createElement,app=Client.createRoot(globalThis.document.querySelector('#root'))
const render=mode=>{
let content
if(mode==='lyrics')content=e(NotificationPageProvider,{value:'lyric-manager'},e(HeaderNotificationsButton,{page:'lyric-manager'}),e(LyricPreviewPanel,{cues:[],document:null}))
else if(mode==='gallery')content=e(LayoutLabNoticeTab)
else content=['info','success','warning','error'].flatMap(tone=>[undefined,'   ',false,[],e('button',{key:'retry'},'Retry')].map((body,index)=>e(NoticeCard,{key:`${tone}-${index}`,title:index===0?'':`${tone} state ${index}`,tone},body)))
app.render(e('div',{style:{padding:24,display:'grid',gap:12}},content))
}
globalThis.noticeCheck={render,dispose:()=>app.unmount(),events:()=>['info','success','warning','error'].forEach(tone=>notify('lyric-manager',{tone,title:`${tone} event`,message:''}))}
render('lyrics')
})
await page.getByRole('button',{name:/Notifications/}).click()
await page.getByRole('dialog',{name:'Notifications'}).waitFor()
await page.locator('.vz-notifications-drawer').evaluate(async drawer=>{
  await Promise.all(drawer.getAnimations({subtree:true}).filter(animation=>animation.effect.getComputedTiming().iterations!==Infinity).map(animation=>animation.finished.catch(()=>{})))
})
const validate=async name=>{
const rows=await page.locator('.dv-notice').evaluateAll(cards=>cards.map(card=>{const title=card.querySelector('.dv-notice-title'),body=card.querySelector('.dv-notice-body');return{title:title?.textContent?.trim(),body:body?.textContent?.trim(),height:body?.getBoundingClientRect().height}}))
if(!rows.length||rows.some(row=>!row.title||!row.body||row.height<15))throw new Error(`${name}: missing visible supporting copy: ${JSON.stringify(rows)}`)
checks.push({name,cards:rows.length})
return rows
}
let rows=await validate('empty-document drawer')
if(!rows.some(row=>row.title==='No cues in document'&&row.body.includes('Add a lyric cue')))throw new Error('Empty document recovery guidance missing')
await page.screenshot({path:resolve(out,'empty-document-drawer.png')})
await page.evaluate(()=>globalThis.noticeCheck.events())
await page.waitForFunction(()=>globalThis.document.querySelectorAll('.dv-notice').length===5)
await validate('empty-body notification events in all four tones')
for(const mode of ['gallery','matrix']){
await page.evaluate(mode=>globalThis.noticeCheck.render(mode),mode)
await page.waitForSelector(mode==='gallery'?'[data-layout-lab-notices]':'.dv-notice[data-tone="error"]')
await validate(mode)
}
if(errors.length)throw new Error(errors.join('\n'))
await writeFile(resolve(out,'report.json'),JSON.stringify({checks,errors},null,2))
console.log(JSON.stringify({checks,errors}))
await page.evaluate(()=>globalThis.noticeCheck.dispose())
}finally{await browser?.close();await server.close()}

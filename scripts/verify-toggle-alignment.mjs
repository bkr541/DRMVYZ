import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import { chromium } from '@playwright/test'
const root=resolve(import.meta.dirname,'..'),out=resolve(root,'artifacts/toggle-alignment')
await mkdir(out,{recursive:true})
const server=await createServer({root,server:{host:'127.0.0.1',port:0},clearScreen:false,plugins:[{name:'toggle-alignment',configureServer(s){s.middlewares.use('/__toggle-alignment',(_q,r)=>{r.setHeader('Content-Type','text/html');r.end('<html><body style="background:#0b1114"><div id="root"></div></body></html>')})}}]})
let browser
try{
await server.listen()
browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'})
const page=await browser.newPage({viewport:{width:800,height:600}})
await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__toggle-alignment`)
await page.evaluate(async()=>{
const Refresh=(await import('/@react-refresh')).default;Refresh.injectIntoGlobalHook(globalThis);globalThis.$RefreshReg$=()=>{};globalThis.$RefreshSig$=()=>type=>type;globalThis.__vite_plugin_react_preamble_installed__=true
for(const css of ['styles.css','styles/appearance.css','styles/vyzualz.css','styles/reactView.css','styles/typography.css'])await import(`/src/${css}`)
const R=await import('/node_modules/.vite/deps/react.js'),React=R.default??R,C=await import('/node_modules/.vite/deps/react-dom_client.js'),Client=C.default??C
const {ToggleRow}=await import('/src/components/vyzualz/react/ReactControlRows.tsx')
const {IconMorphToggle,IconMorphCheckbox}=await import('/src/components/vyzualz/react/controls/IconMorphToggle.tsx')
const e=React.createElement,app=Client.createRoot(globalThis.document.querySelector('#root'))
app.render(e('div',{style:{width:320,padding:24,display:'grid',gap:22}},
...[false,true].flatMap(checked=>[
e('div',{'data-alignment':`row-${checked}`,key:`row-${checked}`},e(ToggleRow,{label:`Toggle ${checked?'on':'off'}`,value:checked,onChange:()=>{},description:'A helper line below the control.'})),
e('label',{'data-alignment':`checkbox-${checked}`,key:`checkbox-${checked}`,className:'rv-ctrl-label'},e(IconMorphCheckbox,{checked,onChange:()=>{}}),' ',e('span',{'data-alignment-label':true},`Checkbox ${checked?'on':'off'}`)),
e('label',{'data-alignment':`inline-${checked}`,key:`inline-${checked}`,className:'rv-ctrl-label'},e(IconMorphToggle,{checked,onCheckedChange:()=>{}}),' ',e('span',{'data-alignment-label':true},`Inline ${checked?'on':'off'}`))])))
await globalThis.document.fonts.ready
})
await page.waitForSelector('[data-alignment] circle')
const results=await page.evaluate(()=>[...globalThis.document.querySelectorAll('[data-alignment]')].map(row=>{
const glyph=[...row.querySelectorAll('svg')].find(el=>el.getBoundingClientRect().height>0),label=row.querySelector('[data-alignment-label], .rv-ctrl-label'),a=glyph.getBoundingClientRect(),b=label.getBoundingClientRect()
return{name:row.dataset.alignment,delta:Math.abs(a.y+a.height/2-b.y-b.height/2),glyph:{y:a.y,height:a.height},label:{y:b.y,height:b.height}}
}))
await page.screenshot({path:resolve(out,'toggles.png')})
await writeFile(resolve(out,'report.json'),JSON.stringify(results,null,2))
if(results.some(row=>row.delta>1.5))throw new Error(`Toggle alignment differs: ${JSON.stringify(results)}`)
console.log(JSON.stringify({checks:results.length,results}))
}finally{await browser?.close();await server.close()}

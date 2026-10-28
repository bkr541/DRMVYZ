import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import { chromium } from '@playwright/test'
const root=resolve(import.meta.dirname,'..'),out=resolve(root,'artifacts/dialog-consistency')
await mkdir(out,{recursive:true})
const server=await createServer({root,server:{host:'127.0.0.1',port:0},clearScreen:false,plugins:[{name:'dialog-consistency',configureServer(s){s.middlewares.use('/__dialog-consistency',(_q,r)=>{r.setHeader('Content-Type','text/html');r.end('<html><body style="margin:0;background:#0b1114"><div id="root"></div></body></html>')})}}]})
let browser
const errors=[],checks=[]
try{
await server.listen()
browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'})
const page=await browser.newPage({viewport:{width:1280,height:800}})
page.on('pageerror',e=>errors.push(e.message))
await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__dialog-consistency`)
await page.evaluate(async()=>{
const Refresh=(await import('/@react-refresh')).default;Refresh.injectIntoGlobalHook(globalThis);globalThis.$RefreshReg$=()=>{};globalThis.$RefreshSig$=()=>type=>type;globalThis.__vite_plugin_react_preamble_installed__=true
for(const css of ['styles.css','styles/appearance.css','styles/vyzualz.css','styles/reactView.css','styles/lyricManager.css','styles/typography.css'])await import(`/src/${css}`)
await import('/src/components/vyzualz/react/layoutLab/optionB/optionB.css')
const R=await import('/node_modules/.vite/deps/react.js'),React=R.default??R,C=await import('/node_modules/.vite/deps/react-dom_client.js'),Client=C.default??C
const {ConfirmDialog}=await import('/src/components/vyzualz/react/controls/ConfirmDialog.tsx')
const {IconChipButton}=await import('/src/components/vyzualz/react/controls/IconChipButton.tsx')
const {UnsavedLyricChangesDialog}=await import('/src/features/lyrics/components/UnsavedLyricChangesDialog.tsx')
const {ConfirmLyricActivationDialog}=await import('/src/features/lyrics/components/ConfirmLyricActivationDialog.tsx')
const {UnsavedMediaChangesView}=await import('/src/components/vyzualz/media/UnsavedMediaChangesDialog.tsx')
const {SaveAsMediaDialog}=await import('/src/components/vyzualz/media/SaveAsMediaDialog.tsx')
const {MediaDeleteConfirmDialog}=await import('/src/components/vyzualz/media/MediaDeleteConfirmDialog.tsx')
const {ReactResetActionsControls}=await import('/src/components/vyzualz/react/ReactResetActions.tsx')
const {InfoPopover}=await import('/src/components/shared/InfoPopover/InfoPopover.tsx')
const {AppIcon}=await import('/src/components/shared/icons/AppIcon.tsx')
const e=React.createElement,app=Client.createRoot(globalThis.document.querySelector('#root')),noop=()=>{}
function Information({custom,theme}){
const anchor=React.useRef(null),[open,setOpen]=React.useState(true)
return e('div',{'data-ui-theme':theme,style:{padding:40}},e('button',{ref:anchor,onClick:()=>setOpen(true)},'Information'),e(InfoPopover,{open,anchorRef:anchor,title:'Engine information',description:'Review the engine settings before continuing.',headerIcon:custom?e(AppIcon,{kind:'cinema'}):undefined,placement:'below',align:'start',width:380,onOpenChange:setOpen,footer:e(IconChipButton,{onClick:()=>setOpen(false)},'Done')},e('p',null,'Your existing project settings are preserved.')))
}
const render=mode=>{
const props={onCancel:noop,onConfirm:noop}
let content
if(mode==='unsaved')content=e(UnsavedLyricChangesDialog,{open:true,onCancel:noop,onDiscard:noop,onSave:noop,message:'Save your lyric edits before leaving Lyric Manager?'})
else if(mode==='activation')content=e(ConfirmLyricActivationDialog,{targetTitle:'New lyrics',currentTitle:'Current lyrics',busy:false,...props})
else if(mode==='media')content=e(UnsavedMediaChangesView,{busy:false,error:'The media changes could not be saved.',onCancel:noop,onDiscard:noop,onSave:noop})
else if(mode==='save-as')content=e(SaveAsMediaDialog,{initialName:'New artwork',busy:false,error:null,onCancel:noop,onSubmit:noop,autoFocus:false})
else if(mode==='delete')content=e(MediaDeleteConfirmDialog,{count:3,...props})
else if(mode==='clear')content=e(ReactResetActionsControls,{onResetCurrentEngineSettings:noop,onResetReactViewPreferences:noop,onClearReactProjectContent:noop})
else if(mode.startsWith('info'))content=e(Information,{key:mode,custom:mode!=='info',theme:mode==='info-midnight'?'midnight':'default'})
else content=e(ConfirmDialog,{title:'Recovered lyric draft available',message:'Restore your unsaved local edits, review the differences, or discard this recovery copy.',cancelLabel:'Discard Recovery',cancelDanger:true,secondary:{label:'Review',onClick:noop},confirmLabel:'Restore as Unsaved',danger:false,confirmTone:'primary',iconTone:'neutral',...props})
app.render(e(React.Fragment,{key:mode},content))
}
globalThis.dialogCheck={render,dispose:()=>app.unmount()}
})
for(const [mode,width] of [['recovery',1280],['unsaved',1280],['activation',1280],['media',1280],['save-as',1280],['delete',1280],['clear',1280],['info',1280],['info-midnight',1280],['unsaved',480],['info',480]]){
await page.setViewportSize({width,height:800})
await page.evaluate(mode=>globalThis.dialogCheck.render(mode),mode)
if(mode==='clear')await page.getByRole('button',{name:'Clear Authored Automation & Project Content…',exact:true}).click()
const info=mode.startsWith('info'),selector=info?'.drm-info-popover':'.dv-confirm-dialog'
await page.locator(selector).waitFor({state:'visible'})
await page.locator(selector).evaluate(async el=>{await Promise.all(el.getAnimations({subtree:true}).filter(a=>a.effect.getComputedTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})))})
const geometry=await page.locator(selector).evaluate((el,info)=>{
const icon=el.querySelector(info?'.drm-info-popover__header-icon':'.dv-confirm-icon'),title=el.querySelector(info?'.drm-info-popover__title':'h2'),copy=el.querySelector(info?'.drm-info-popover__description':':scope > p'),actions=el.querySelector(info?'.drm-info-popover__footer':'.dv-confirm-actions')
const rect=node=>{const r=node.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,center:r.x+r.width/2}}
return{box:rect(el),icon:rect(icon),title:rect(title),copy:rect(copy),actions:rect(actions),font:globalThis.getComputedStyle(title).fontSize,weight:globalThis.getComputedStyle(title).fontWeight,copyFont:globalThis.getComputedStyle(copy).fontSize,titleAlign:globalThis.getComputedStyle(title).textAlign,copyAlign:globalThis.getComputedStyle(copy).textAlign,overflow:el.scrollWidth>el.clientWidth+1}
},info)
if(Math.abs(geometry.icon.center-geometry.box.center)>1||geometry.icon.bottom>geometry.title.y+1||geometry.title.bottom>geometry.copy.y+1||geometry.copy.bottom>geometry.actions.y+1||geometry.titleAlign!=='center'||geometry.copyAlign!=='center'||geometry.overflow)throw new Error(`${mode} ${width}: inconsistent hierarchy ${JSON.stringify(geometry)}`)
if(geometry.font!=='14px'||geometry.weight!=='700'||geometry.copyFont!=='11px')throw new Error(`${mode}: inconsistent typography ${JSON.stringify(geometry)}`)
checks.push({mode,width,geometry})
if(['unsaved','info'].includes(mode))await page.screenshot({path:resolve(out,`${mode}-${width}.png`)})
}
if(errors.length)throw new Error(errors.join('\n'))
await writeFile(resolve(out,'report.json'),JSON.stringify({checks,errors},null,2))
console.log(JSON.stringify({checks:checks.length,errors}))
await page.evaluate(()=>globalThis.dialogCheck.dispose())
}finally{await browser?.close();await server.close()}

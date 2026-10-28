import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import { chromium } from '@playwright/test'
const root=resolve(import.meta.dirname,'..'),out=resolve(root,'artifacts/sidebar-profile')
await mkdir(out,{recursive:true})
const server=await createServer({root,server:{host:'127.0.0.1',port:0},clearScreen:false,plugins:[{name:'sidebar-profile',configureServer(s){s.middlewares.use('/__sidebar-profile',(_q,r)=>{r.setHeader('Content-Type','text/html');r.end('<html><body style="margin:0"><div id="root"></div></body></html>')})}}]})
const errors=[],checks=[]

let browser
const check=(ok,message)=>{if(!ok)throw new Error(message);checks.push(message)}
try{
await server.listen();browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'})
const page=await browser.newPage({viewport:{width:1280,height:800}})
page.on('pageerror',e=>errors.push(e.message))
await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__sidebar-profile`)
await page.evaluate(async()=>{
const Refresh=(await import('/@react-refresh')).default;Refresh.injectIntoGlobalHook(globalThis);globalThis.$RefreshReg$=()=>{};globalThis.$RefreshSig$=()=>type=>type;globalThis.__vite_plugin_react_preamble_installed__=true
for(const css of ['styles.css','styles/appearance.css','styles/analyzer.css','styles/vyzualz.css','styles/reactView.css','styles/mediaManager.css','styles/lyricManager.css','styles/showManager.css','styles/floatingWorkspace.css','styles/typography.css'])await import(`/src/${css}`)
const R=await import('/node_modules/.vite/deps/react.js'),React=R.default??R
const C=await import('/node_modules/.vite/deps/react-dom_client.js'),Client=C.default??C
const {AudioEngineProvider}=await import('/src/context/AudioEngineContext.tsx')
const {ApplicationWorkspaceFrame,ApplicationHeaderControls}=await import('/src/components/vyzualz/layout/ApplicationWorkspaceFrame.tsx')
const {VyzualzHeaderActions}=await import('/src/components/vyzualz/shared/VyzualzHeaderActions.tsx')
const {NotificationPageProvider,notify,useNotificationStore}=await import('/src/stores/notificationStore.ts')
const {HeaderControlGroup}=await import('/src/components/vyzualz/layout/HeaderControlGroup.tsx')
const {HeaderIconKey}=await import('/src/components/vyzualz/layout/HeaderIconKey.tsx')
const {AppIcon}=await import('/src/components/shared/icons/AppIcon.tsx')
const {LyricManagerHeader}=await import('/src/features/lyrics/components/LyricManagerHeader.tsx')
const {ReactGlobalOutputControls}=await import('/src/components/vyzualz/react/ReactGlobalOutputControls.tsx')
const {ReactEngineBrowser}=await import('/src/components/vyzualz/react/ReactEngineBrowser.tsx')
const {ReactHeaderStatusCluster}=await import('/src/components/vyzualz/react/ReactHeaderStatusCluster.tsx')
const e=React.createElement,app=Client.createRoot(globalThis.document.querySelector('#root'))
const {OptionEHeader}=await import('/src/components/vyzualz/react/layoutLab/optionE/OptionEChrome.tsx')
await import('/src/components/vyzualz/react/layoutLab/optionE/optionE.css')
const referenceNode=globalThis.document.createElement('div');referenceNode.className='ll-design-workbench oe-root';referenceNode.style.cssText='position:fixed;left:-10000px;width:1600px';globalThis.document.body.append(referenceNode);const referenceRoot=Client.createRoot(referenceNode);referenceRoot.render(e(OptionEHeader));
function Header({view}) {
if(view==='presetManager')return null
if(view==='lyrics')return e(LyricManagerHeader,{isSaving:false,saveStatus:'saved',lyricsDisplayEnabled:false,hasDocument:true,dirty:false,onToggleLyricsDisplay:()=>{},onSave:()=>{},onSaveAndMakeActive:()=>{}})
const headerClass={react:'vz-header',media:'mmv-header',showManager:'sm-topbar'}[view]
let actions
if(view==='react')actions=e(ReactGlobalOutputControls)
else if(view==='media')actions=['save','delete'].map(kind=>e(HeaderIconKey,{key:kind,label:kind,icon:e(AppIcon,{kind}),onClick:()=>{}}))
else actions=e('div',{className:'sm-header-show-actions'},...['fileAdd','folder','saveActive','pointer','move','grid'].map(kind=>e('button',{key:kind,className:'sm-header-icon-button',title:kind},e(AppIcon,{kind}))))
return e('header',{className:headerClass},e(HeaderControlGroup,{label:`${view} controls`},actions),view==='react'?e(ReactEngineBrowser,{placement:'header',presetName:'Cathedral'}):null,e('span',{className:'az-spacer'}),view==='react'?e(ReactHeaderStatusCluster,{fps:60,frameTimeMs:16.7,qualityTier:'high'}):e(VyzualzHeaderActions,{page:{media:'media-manager',showManager:'show-manager'}[view]}))
}
function Harness(){const[view,setView]=React.useState('react'),[collapsed,setCollapsed]=React.useState(true)
return e(AudioEngineProvider,null,e(ApplicationWorkspaceFrame,{appView:view,onAppViewChange:setView,sidebarCollapsed:collapsed,onSidebarCollapsedChange:setCollapsed},e(NotificationPageProvider,{value:'react'},e(ApplicationHeaderControls,null,e(Header,{view})),e('main',null,view))))}
app.render(e(Harness));globalThis.profileCheck={dispose:()=>{app.unmount();referenceRoot.unmount();referenceNode.remove()},notify:(page,title)=>notify(page,{tone:'warning',title,message:'Navigation notification check'}),unread:page=>useNotificationStore.getState().events[page].filter(e=>e.unread).length}
})
const button=page.getByRole('button',{name:'Profile and settings',exact:true})
await button.waitFor();await page.evaluate(()=>globalThis.document.fonts.ready)
for(const destination of ['React','Preset Manager','Show Manager','Lyric Manager','Media Manager']){
await page.getByRole('button',{name:destination,exact:true}).click()
check(await button.count()===1,`${destination}: one persistent navigation profile control`)
check(await page.locator('.fw-app-header .vz-header-avatar, .fw-app-header .vz-profile-control, .fw-app-header .vz-header-notifications, .fw-app-header [title="Settings"]').count()===0,`${destination}: no profile or notification controls in header`)
const header=page.locator('.fw-app-header')
check(await header.locator('.fw-sidebar-toggle').count()===0,`${destination}: collapse control removed from header`)
check(await page.locator('.az-sidebar-account .az-sidebar-layout-lab + .az-sidebar-notifications').count()===1,`${destination}: Layout Lab sits immediately above Notifications`)
if(destination==='Preset Manager')check(!(await header.textContent()).includes('Preset Manager'),'Preset Manager: no header title')
else {
const style=await header.locator('.vz-header-group').evaluate(el=>{const s=globalThis.getComputedStyle(el),b=el.getBoundingClientRect(),h=el.closest('.fw-app-header-inner').getBoundingClientRect();return{x:b.x-h.x,position:s.position,background:s.backgroundImage,border:s.borderTopWidth,icons:[...el.querySelectorAll('button svg')].map(i=>{const c=globalThis.getComputedStyle(i);return{size:parseFloat(c.width),filter:c.filter}}),buttons:[...el.querySelectorAll('button')].map(i=>{const c=globalThis.getComputedStyle(i);return{height:parseFloat(c.height),border:c.borderTopWidth,background:c.backgroundColor}})}})
check(style.x>=0&&style.x<=16&&style.position!=='absolute',`${destination}: actions align to the left of the header`)
check(style.background==='none'&&style.border==='0px'&&style.icons.every(i=>i.size===24&&i.filter.includes('drop-shadow')),`${destination}: toolbar is background-free with elevated 24px icons`)
check(style.buttons.every(b=>b.height===38&&b.border==='0px'&&b.background==='rgba(0, 0, 0, 0)'),`${destination}: actions use background-free 38px hit areas`)
}
if(destination==='React'){
for(const width of [1440,1280,1024]){
await page.setViewportSize({width,height:800})
const geometry=await page.evaluate(()=>{const engine=globalThis.document.querySelector('.rv-engine-dropdown--header'),header=engine.closest('.fw-app-header-inner').getBoundingClientRect(),box=engine.getBoundingClientRect(),status=globalThis.document.querySelector('[data-react-header-status]').getBoundingClientRect(),label=engine.querySelector('.rv-engine-dropdown-label'),style=globalThis.getComputedStyle(label);return{center:box.x+box.width/2,headerCenter:header.x+header.width/2,right:box.right,statusLeft:status.left,font:style.fontSize,weight:style.fontWeight}})
check(Math.abs(geometry.center-geometry.headerCenter)<1,`React ${width}px: engine dropdown is centred in the top header`)
check(geometry.right<=geometry.statusLeft,`React ${width}px: engine selector does not overlap telemetry (${JSON.stringify(geometry)})`)
check(geometry.font==='11px'&&geometry.weight==='600',`React ${width}px: engine label uses shared field typography`)
}
const readouts=await page.evaluate(()=>{
const shape=el=>{const s=globalThis.getComputedStyle(el);return{height:s.height,border:s.borderLeftWidth,padding:s.padding,background:s.backgroundColor,borderTop:s.borderTopWidth}}
const font=el=>{const s=globalThis.getComputedStyle(el);return{size:s.fontSize,weight:s.fontWeight,tracking:s.letterSpacing}}
return{production:[...globalThis.document.querySelectorAll('.rv-header-status .vz-header-readout')].map(shape),reference:shape(globalThis.document.querySelector('.oe-readout')),label:font(globalThis.document.querySelector('.vz-header-readout-label')),referenceLabel:font(globalThis.document.querySelector('.oe-readout-label')),primary:font(globalThis.document.querySelector('.vz-header-readout-primary')),referencePrimary:font(globalThis.document.querySelector('.oe-readout strong'))}
})
check(readouts.production.length===3&&readouts.production.every(style=>JSON.stringify(style)===JSON.stringify(readouts.reference)),`React: three readout surfaces and dividers match Option E (${JSON.stringify(readouts)})`)
check(JSON.stringify(readouts.label)===JSON.stringify(readouts.referenceLabel)&&JSON.stringify(readouts.primary)===JSON.stringify(readouts.referencePrimary),'React: readout typography matches Option E')
const trigger=page.getByTitle('Choose React engine',{exact:true})
await trigger.click()
const menu=page.getByRole('listbox',{name:'React visual engines'})
await menu.waitFor()
check(await menu.getByRole('option').count()>0,'React: header engine menu opens')
await menu.getByRole('option').filter({hasText:'Cinema 2.0'}).click()
check((await trigger.getAttribute('aria-label')).includes('Cinema 2.0'),'React: selecting an engine updates the header')
await trigger.click();await menu.waitFor();await page.keyboard.press('Escape');await menu.waitFor({state:'detached'})
await trigger.click();await menu.waitFor();await page.locator('.fw-app-content').click({position:{x:10,y:10}});await menu.waitFor({state:'detached'})
check(true,'React: Escape and outside click close the engine menu')
await page.setViewportSize({width:1280,height:800})
await page.screenshot({path:resolve(out,'react-engine-header.png')})
}
const scope={'React':'react','Preset Manager':'preset-manager','Show Manager':'show-manager','Lyric Manager':'lyric-manager','Media Manager':'media-manager'}[destination]
await page.evaluate(v=>globalThis.profileCheck.notify(v.scope,`${v.destination} notice`),{scope,destination})
const bell=page.locator('.az-sidebar-notifications')
check(await bell.textContent()==='',`${destination}: notification control is icon-only`)
check(await bell.locator('.vz-header-notifications-dot').count()===1,`${destination}: unread indicator is visible`)
await bell.click();const drawer=page.getByRole('dialog',{name:'Notifications',exact:true});await drawer.waitFor()
check(await drawer.getByText(`${destination} notice`,{exact:true}).count()===1,`${destination}: drawer shows this workspace's notification`)
check(await page.evaluate(p=>globalThis.profileCheck.unread(p),scope)===0,`${destination}: opening marks notifications read`)
await page.keyboard.press('Escape');await drawer.waitFor({state:'detached'})
await button.click();await page.getByRole('dialog').waitFor()
check(await page.getByRole('dialog').evaluate(el=>!el.closest('.az-sidebar')),`${destination}: settings opens outside navigation clipping`)
await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'detached'})
check(await button.evaluate(el=>globalThis.document.activeElement===el),`${destination}: Escape restores focus to navigation profile`)
}
for(const expanded of [false,true]){
if(expanded)await page.getByTitle('Expand sidebar',{exact:true}).click()
await page.waitForTimeout(250)
const avatar=await button.locator('.vz-header-avatar').boundingBox()
check(avatar&&Math.abs(avatar.width-38)<1&&Math.abs(avatar.height-38)<1,`${expanded?'Expanded':'Collapsed'} rail: profile avatar fills a 38px square`)
const notification=page.locator('.az-sidebar-notifications')
const bellStyle=await notification.evaluate(el=>{const b=globalThis.getComputedStyle(el),i=el.querySelector('svg'),s=globalThis.getComputedStyle(i);return{background:b.backgroundColor,border:b.borderTopWidth,shadow:b.boxShadow,size:parseFloat(s.width),filter:s.filter}})
check(bellStyle.background==='rgba(0, 0, 0, 0)'&&bellStyle.border==='0px'&&bellStyle.shadow==='none',`${expanded?'Expanded':'Collapsed'} rail: bell has no background, border or button shadow`)
check(Math.abs(bellStyle.size-24)<1&&bellStyle.filter.includes('drop-shadow'),`${expanded?'Expanded':'Collapsed'} rail: larger bell has an elevated drop shadow`)
await notification.hover()
check(await notification.evaluate(el=>globalThis.getComputedStyle(el).backgroundColor)==='rgba(0, 0, 0, 0)',`${expanded?'Expanded':'Collapsed'} rail: hovered bell stays background-free`)
const bellBox=await page.locator('.az-sidebar-notifications').boundingBox(),profileBox=await button.boundingBox()
check(bellBox&&profileBox&&bellBox.y+bellBox.height<profileBox.y,`${expanded?'Expanded':'Collapsed'} rail: Notifications is directly above Profile`)
const position=await button.evaluate(el=>{const b=el.getBoundingClientRect(),a=el.closest('aside').getBoundingClientRect();return{bottom:a.bottom-b.bottom,center:b.x+b.width/2,sideCenter:a.x+a.width/2}})
check(position.bottom>=0&&position.bottom<35,`${expanded?'Expanded':'Collapsed'} rail: profile remains at the bottom`)
if(!expanded)check(Math.abs(position.center-position.sideCenter)<2,'Collapsed rail: profile icon is centered')
await page.screenshot({path:resolve(out,expanded?'expanded.png':'collapsed.png')})
}
await button.click();await page.getByRole('dialog').waitFor()
await page.getByRole('tab',{name:'Appearance',exact:true}).click()
await page.screenshot({path:resolve(out,'settings-from-navigation.png')})
await page.getByRole('button',{name:'Close settings',exact:true}).click()
await page.getByRole('dialog').waitFor({state:'detached'})
check(errors.length===0,'No browser page errors')
await writeFile(resolve(out,'report.json'),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2))
await page.evaluate(()=>globalThis.profileCheck.dispose())
}finally{await browser?.close();await server.close()}

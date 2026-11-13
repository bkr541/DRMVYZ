import { createServer } from 'vite'
import { _electron, chromium, expect } from '@playwright/test'
import { createRequire } from 'node:module'
import { mkdir, writeFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
const require=createRequire(import.meta.url), root=process.cwd(),output=path.join(root,'artifacts/mobile-preview')
await mkdir(output,{recursive:true})
const entry=`import React from 'react';import {createRoot} from 'react-dom/client';import {MobilePreviewLauncher} from '/src/components/vyzualz/layout/MobilePreviewLauncher.tsx';import {mobilePreviewProductionStyles} from '/src/components/vyzualz/layout/mobilePreviewProductionStyles.ts';
import {ReactPresetCard} from '/src/components/vyzualz/react/ReactPresetCard.tsx';import {PerformancePad} from '/src/components/vyzualz/react/controls/PerformancePad.tsx';import {RailWindowHeader} from '/src/components/vyzualz/layout/RailWindowHeader.tsx';import {UnderlineTabs} from '/src/components/vyzualz/react/controls/UnderlineTabs.tsx';import {PresetSearchRow} from '/src/components/vyzualz/react/controls/PresetSearchRow.tsx';import {SliderRow,ToggleRow,SelectRow} from '/src/components/vyzualz/react/ReactControlRows.tsx';
import {MOBILE_SAMPLE_PRESETS} from '/src/components/vyzualz/layout/MobilePerformanceMockup.tsx';import {useReactStore} from '/src/stores/reactStore.ts';
const style=document.createElement('style');style.textContent=mobilePreviewProductionStyles;document.head.append(style);globalThis.mobileRuntimeSnapshot=()=>JSON.stringify({engine:useReactStore.getState().activeReactEngineId,preset:useReactStore.getState().activeReactPresetId,pads:useReactStore.getState().performancePads});
const e=React.createElement,noop=()=>{},preset=MOBILE_SAMPLE_PRESETS[0];
createRoot(document.getElementById('root')).render(e(React.Fragment,null,e(MobilePreviewLauncher),e('div',{id:'production-reference',style:{position:'fixed',left:-10000,width:170}},
 e(ReactPresetCard,{id:preset.id,title:preset.metadata.name,description:preset.metadata.name,isActive:true,activateLabel:'Reference preset',onActivate:noop}),
 e(PerformancePad,{label:'Reactor',shortcut:'1',color:'#5993e8',density:'compact'}),e(RailWindowHeader,{side:'left',label:'Inspector',icon:e('svg')}),
 e(UnderlineTabs,{tabs:[{id:'Presets',label:'Presets'},{id:'Pads',label:'Pads'}],activeTab:'Presets',onChange:noop,ariaLabel:'Reference tabs'}),
 e(PresetSearchRow,{query:'',onQueryChange:noop}),e(SliderRow,{label:'Intensity',value:.75,onChange:noop}),e(ToggleRow,{label:'BPM Sync',value:true,onChange:noop}),e(SelectRow,{label:'Reference quality',value:'1080p / 60 fps',onChange:noop,options:[{value:'1080p / 60 fps',label:'1080p / 60 fps'}]})
)));`
const server=await createServer({configFile:false,root,cacheDir:'node_modules/.cache/mobile-preview-review-vite',esbuild:{jsx:'automatic'},resolve:{dedupe:['react','react-dom']},server:{host:'127.0.0.1',port:0,watch:null,hmr:false},plugins:[{name:'mobile-review',resolveId(id){if(id==='/__mobile.tsx')return '\0mobile-review.tsx'},load(id){if(id==='\0mobile-review.tsx')return entry},configureServer(s){s.middlewares.use((req,res,next)=>{if(req.url==='/__mobile.html'){res.setHeader('content-type','text/html');res.end('<html><body style="margin:0"><div id="root"></div><script type="module" src="/__mobile.tsx"></script></body></html>');return;}next()})}}]})
const errors=[],checks=[];let browser,app,temp,options
try{
 await server.listen();const url='http://127.0.0.1:'+server.httpServer.address().port+'/__mobile.html'
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1200,height:950}});page.on('pageerror',e=>errors.push(e.message));await page.goto(url,{waitUntil:'domcontentloaded'})
 const button=page.getByRole('button',{name:'Mobile Preview',exact:true});await expect(button).toBeVisible();const runtimeBefore=await page.evaluate(()=>globalThis.mobileRuntimeSnapshot());
 const event=page.waitForEvent('popup');await button.click();const popup=await event;await expect(popup.getByRole('main',{name:'Mobile preview canvas'})).toBeVisible();assert.deepEqual(await popup.evaluate(()=>({width:globalThis.innerWidth,height:globalThis.innerHeight})),{width:1200,height:1000});await button.click();assert.equal(page.context().pages().length,2);checks.push('Browser popup 1200 × 1000; repeated clicks reuse one window')
 const nav=popup.getByRole('navigation',{name:'Mobile preview views'});await expect(nav.getByRole('button')).toHaveCount(4);
 const productionStyles=async (surface,selector,pseudo)=>surface.locator(selector).first().evaluate((n,pseudo)=>{const s=getComputedStyle(n,pseudo);return Object.fromEntries(['fontFamily','fontSize','fontWeight','lineHeight','letterSpacing','color','backgroundColor','backgroundImage','borderTopColor','borderRadius','boxShadow'].map(key=>[key,s[key]]))},pseudo);
 const refs={title:await productionStyles(page,'.rv-preset-spotlight-name'),card:await productionStyles(page,'.rv-preset-spotlight-card'),header:await productionStyles(page,'.rw-window-header'),tab:await productionStyles(page,'.dv-underline-tab.is-active'),padLabel:await productionStyles(page,'.performance-pad-label'),padNumber:await productionStyles(page,'.performance-pad-number'),pad:await productionStyles(page,'.performance-pad'),placeholder:await productionStyles(page,'.vz-md-search-input','::placeholder'),field:await productionStyles(page,'.rv-ctrl-label')};
 await page.getByRole('combobox',{name:'Reference quality',exact:true}).evaluate(n=>n.click());
 const menuReference=await productionStyles(page,'.drm-dropdown__menu'),optionReference=await productionStyles(page,'.drm-dropdown__option');
 const phone=popup.locator('.mobile-preview-screen');
 for(const number of [1,2,3,4]){
  const label=`Option ${number}`;await nav.getByRole('button',{name:label,exact:true}).click();
  await expect(nav.getByRole('button',{name:label,exact:true})).toHaveAttribute('aria-current','page');
  await expect(popup.getByRole('main')).toHaveAttribute('data-mobile-view',`option-${number}`);
  await expect(popup.locator('.mpm')).toHaveAttribute('data-concept',String(number));
  await phone.screenshot({path:path.join(output,`option-${number}.png`)});
  for(const screen of ['Presets','Pads','Controls','Cast']){
   if(number===4)await popup.locator('.mpm-hub').getByRole('button',{name:new RegExp(screen)}).click();
   else await popup.getByRole('tab',{name:screen,exact:true}).click();
   await expect(popup.locator('.mpm-body')).toHaveAttribute('data-mobile-page',screen);
   await popup.mouse.move(0,0);
   const header=await productionStyles(popup,'.rw-window-header');assert.deepEqual(header,refs.header,`Option ${number} header differs from production`);
   if(screen==='Presets'){
    assert.deepEqual(await productionStyles(popup,'.rv-preset-spotlight-name'),refs.title);
    assert.deepEqual(await productionStyles(popup,'.rv-preset-spotlight-card--active'),refs.card);
    assert.deepEqual(await productionStyles(popup,'.vz-md-search-input','::placeholder'),refs.placeholder);
    if(number!==4)assert.deepEqual(await productionStyles(popup,'.dv-underline-tab.is-active'),refs.tab);
    await popup.getByRole('button',{name:'Select Reactor',exact:true}).click();await expect(popup.getByRole('button',{name:'Select Reactor',exact:true})).toHaveAttribute('aria-pressed','true');
    await popup.getByRole('textbox',{name:'Search presets'}).fill('Psylo');await expect(popup.locator('.mpm-body [data-preset-card]')).toHaveCount(number===2?2:1);
    await popup.getByRole('textbox',{name:'Search presets'}).fill('');
    const blueprint=popup.locator('[data-preset-card-id="drmvyz.cinema2.afterhours"] .rv-preset-blueprint-scene');await expect(blueprint.first()).toHaveClass(/authored/);
    await popup.getByRole('tab',{name:'USER',exact:true}).click();await expect(popup.getByRole('status')).toContainText('No user presets');await popup.getByRole('tab',{name:'SYSTEM',exact:true}).click();
    await popup.getByRole('button',{name:'Show favorites',exact:true}).click();await expect(popup.locator('.mpm-body [data-preset-card]')).toHaveCount(number===2?2:1);await popup.getByRole('button',{name:'Show favorites',exact:true}).click();
   }
   if(screen==='Pads'){
    await expect(popup.locator('.performance-pad')).toHaveCount(20);await expect(popup.locator('.performance-pad:disabled').first()).toBeDisabled();
    assert.deepEqual(await productionStyles(popup,'.performance-pad-label'),refs.padLabel);assert.deepEqual(await productionStyles(popup,'.performance-pad-number'),refs.padNumber);assert.deepEqual(await productionStyles(popup,'.performance-pad'),refs.pad);
    const pad=popup.getByRole('button',{name:'Reactor, pad 1',exact:true});await pad.hover();await popup.mouse.down();await expect(pad).toHaveAttribute('data-hit','true');await popup.mouse.up();await expect(pad).not.toHaveAttribute('data-hit','true');await expect(pad).toHaveAttribute('data-selected','true');await expect(popup.getByRole('status')).toContainText('Reactor');
    const bounds=await pad.boundingBox();assert.equal(bounds.height,40);
   }
   if(screen==='Controls'){
    await expect(popup.getByRole('slider')).toHaveCount(4);assert.deepEqual(await productionStyles(popup,'.rv-ctrl-label'),refs.field);
    await popup.getByRole('slider',{name:'Intensity',exact:true}).fill('0.5');
    await expect(popup.getByRole('switch',{name:'BPM Sync',exact:true})).toHaveAttribute('aria-checked','true');
    await popup.getByRole('switch',{name:'Auto Performance',exact:true}).click();await expect(popup.getByRole('switch',{name:'Auto Performance',exact:true})).toHaveAttribute('aria-checked','true');
   }
   if(screen==='Cast'){
    await popup.getByRole('button',{name:/Studio projector/}).click();
    await popup.getByRole('combobox',{name:'Output quality',exact:true}).click();await expect(popup.getByRole('listbox')).toBeVisible();assert.deepEqual(await productionStyles(popup,'.drm-dropdown__menu'),menuReference);assert.deepEqual(await productionStyles(popup,'.drm-dropdown__option'),optionReference);assert.equal(await popup.locator('.drm-dropdown__menu').evaluate(n=>n.ownerDocument===document),true);
    const menuBox=await popup.getByRole('listbox').boundingBox(),phoneBox=await phone.boundingBox();assert(menuBox.x>=phoneBox.x&&menuBox.x+menuBox.width<=phoneBox.x+phoneBox.width);
    await popup.getByRole('option',{name:'720p / 30 fps',exact:true}).click();
    await popup.getByRole('button',{name:'Start casting',exact:true}).click();await expect(popup.getByRole('status')).toContainText('Preview connected to Studio projector');await expect(popup.getByRole('button',{name:'Stop casting'})).toBeVisible();
   }
   if(number===3){const tabs=popup.getByRole('navigation',{name:'Mockup mobile navigation'}),navBox=await tabs.boundingBox(),bodyBox=await popup.locator('.mpm-body').boundingBox();assert(navBox.y>=bodyBox.y+bodyBox.height-1);const boxes=await tabs.getByRole('tab').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().y));assert.equal(new Set(boxes).size,1);}
   assert.equal(await popup.locator('.mpm-body').evaluate(n=>n.scrollWidth>n.clientWidth),false,`Option ${number}/${screen} overflow`);
   await phone.screenshot({path:path.join(output,`option-${number}-${screen.toLowerCase()}.png`)});
   if(number===4)await popup.getByRole('button',{name:'Session dashboard',exact:true}).click();
  }
  assert.equal(await nav.locator('[aria-current="page"]').count(),1);
 }
 assert.equal(await page.evaluate(()=>globalThis.mobileRuntimeSnapshot()),runtimeBefore,'Preview changed live application state');
 checks.push('All four compositions and 16 screens; real production header/card/tab/pad/field/placeholder style parity, canonical artwork, filters, switches, popup dropdown, pad strike states and local-only casting');
 for(const [width,height] of [[800,700],[500,800]]){
 await popup.setViewportSize({width,height});await expect(popup.getByLabel('Mobile performance layout mockup')).toBeVisible();
 const dimensions=await popup.locator('.mobile-preview-screen').evaluate(n=>{const r=n.getBoundingClientRect();return {width:r.width,height:r.height,transform:globalThis.getComputedStyle(n).transform}});assert.deepEqual(dimensions,{width:393,height:852,transform:'none'});
 const stage=popup.locator('.mobile-preview-stage');assert(await stage.evaluate(n=>n.scrollHeight>n.clientHeight));if(width===500)assert(await stage.evaluate(n=>n.scrollWidth>n.clientWidth));
 await stage.evaluate(n=>{n.scrollTop=n.scrollHeight;n.scrollLeft=n.scrollWidth});
 const home=await popup.locator('.mobile-preview-home').boundingBox();assert(home.y>=0&&home.y+home.height<=height);await expect(popup.getByRole('navigation',{name:'Mobile preview views'})).toBeVisible();
 await popup.screenshot({path:path.join(output,'iphone16-compact-'+width+'.png')});
 }
 await popup.setViewportSize({width:1200,height:1000});checks.push('Actual phone bounds stay 393 × 852 at every window size; overflow scrolls while navigation stays visible');

 await popup.screenshot({path:path.join(output,'iphone16-browser.png')});await popup.close();const event2=page.waitForEvent('popup');await button.click();const reopened=await event2;await expect(reopened.getByRole('main')).toBeVisible();await reopened.keyboard.press('Escape').catch(error=>{if(!reopened.isClosed())throw error});await expect.poll(()=>reopened.isClosed()).toBe(true);checks.push('Manual close, reopen and Escape close')
 await page.evaluate(()=>{globalThis.open=()=>null});await button.click();await expect(page.getByRole('alert')).toContainText('blocked');checks.push('Blocked popup produces actionable feedback')
 await browser.close();browser=null
 if(!process.argv.includes('--browser-only')){
 // The isolated bootstrap changes only this test process's app-data directory,
 // then loads the real production main-process code, including its window policy.
 temp=await mkdtemp(path.join(tmpdir(),'drmvyz-mobile-review-'))
 const bootstrap=path.join(temp,'bootstrap.cjs');await mkdir(path.join(temp,'app-data'))
 // Electron's built-in module must be resolved by its runtime rather than the npm launcher.
 await writeFile(bootstrap,`const {app}=require('electron');app.setPath('appData',${JSON.stringify(path.join(temp,'app-data'))});require(${JSON.stringify(path.join(root,'electron/main.cjs'))});`)
 app=await _electron.launch({executablePath:require('electron'),args:[bootstrap],env:{...process.env,DRMVYZ_VITE_DEV_SERVER_URL:url},timeout:45000});const main=await app.firstWindow();main.on('pageerror',e=>errors.push(e.message));await expect(main.getByRole('button',{name:'Mobile Preview',exact:true})).toBeVisible()
 const nativeEvent=app.waitForEvent('window');await main.getByRole('button',{name:'Mobile Preview',exact:true}).click();const native=await nativeEvent;await expect(native.getByRole('main')).toBeVisible();assert.deepEqual(await native.evaluate(()=>({width:globalThis.innerWidth,height:globalThis.innerHeight})),{width:1200,height:1000})
 options=await app.evaluate(({BrowserWindow})=>{const child=BrowserWindow.getAllWindows().find(w=>w.getTitle()==='DRMVYZ — Mobile Preview');return {size:child.getContentSize(),resizable:child.isResizable(),preferences:child.webContents.getLastWebPreferences()}});const nativePhone=await native.locator('.mobile-preview-screen').evaluate(n=>{const r=n.getBoundingClientRect();return {width:r.width,height:r.height}});assert.deepEqual(nativePhone,{width:393,height:852});const visiblePhone=await native.locator('.mobile-preview-screen').evaluate(n=>{const r=n.getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=globalThis.innerWidth&&r.bottom<=globalThis.innerHeight});assert(visiblePhone,'The whole phone must fit inside the native preview');assert.deepEqual(options.size,[1200,1000]);assert.equal(options.resizable,true);assert.equal(options.preferences.nodeIntegration,false);assert.equal(options.preferences.contextIsolation,true);assert.equal(options.preferences.sandbox,true);assert.equal(options.preferences.webSecurity,true)
 await native.screenshot({path:path.join(output,'iphone16-electron.png')});await main.getByRole('button',{name:'Mobile Preview',exact:true}).click();assert.equal(app.windows().length,2);await native.close();checks.push('Actual Electron main: resizable 1200 × 1000 content, isolated sandbox, one separate native window')
 }
 assert.deepEqual(errors,[]);await writeFile(path.join(output,'result.json'),JSON.stringify({passed:true,checks,native:options?{size:options.size,resizable:options.resizable}:null,errors},null,2));console.log('Mobile Preview passed',checks.length,'checks')
}finally{await browser?.close();await app?.close();await server.close();if(temp)await rm(temp,{recursive:true,force:true})}

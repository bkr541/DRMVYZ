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
import {useReactStore} from '/src/stores/reactStore.ts';
const style=document.createElement('style');style.textContent=mobilePreviewProductionStyles;document.head.append(style);globalThis.mobileRuntimeSnapshot=()=>JSON.stringify({engine:useReactStore.getState().activeReactEngineId,preset:useReactStore.getState().activeReactPresetId,pads:useReactStore.getState().performancePads});
createRoot(document.getElementById('root')).render(React.createElement(MobilePreviewLauncher));`
const server=await createServer({configFile:false,root,cacheDir:'node_modules/.cache/mobile-preview-review-vite',esbuild:{jsx:'automatic'},resolve:{dedupe:['react','react-dom']},server:{host:'127.0.0.1',port:0,watch:null,hmr:false},plugins:[{name:'mobile-review',resolveId(id){if(id==='/__mobile.tsx')return '\0mobile-review.tsx'},load(id){if(id==='\0mobile-review.tsx')return entry},configureServer(s){s.middlewares.use((req,res,next)=>{if(req.url==='/__mobile.html'){res.setHeader('content-type','text/html');res.end('<html><body style="margin:0"><div id="root"></div><script type="module" src="/__mobile.tsx"></script></body></html>');return;}next()})}}]})
const errors=[],checks=[];let browser,app,temp,options
try{
 await server.listen();const url='http://127.0.0.1:'+server.httpServer.address().port+'/__mobile.html'
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1200,height:950}});page.on('pageerror',e=>errors.push(e.message));await page.goto(url,{waitUntil:'domcontentloaded'})
 const button=page.getByRole('button',{name:'Mobile Preview',exact:true});await expect(button).toBeVisible();const runtimeBefore=await page.evaluate(()=>globalThis.mobileRuntimeSnapshot());
 const event=page.waitForEvent('popup');await button.click();const popup=await event;await expect(popup.getByRole('main',{name:'Mobile preview canvas'})).toBeVisible();assert.deepEqual(await popup.evaluate(()=>({width:globalThis.innerWidth,height:globalThis.innerHeight})),{width:1200,height:1000});await button.click();assert.equal(page.context().pages().length,2);checks.push('Browser popup 1200 × 1000; repeated clicks reuse one window')
 const nav=popup.getByRole('navigation',{name:'Mobile preview views'});const sub=nav.getByRole('group',{name:'Mobile screens'});
 await expect(nav.getByRole('button')).toHaveCount(6);await expect(sub.getByRole('button')).toHaveText(['Auth','Perform','Remote','Pads','Visualizer']);
 const phone=popup.locator('.mobile-preview-screen');
 // Auth: the real sign-in screen, inert, in a phone-width frame; no header and no bottom navigation.
 await expect(sub.getByRole('button',{name:'Auth',exact:true})).toHaveAttribute('aria-current','page');
 const authFrame=await (await popup.locator('iframe.mobile-preview-app-frame').elementHandle()).contentFrame();await authFrame.waitForSelector('.auth-root');
 assert.equal(await authFrame.evaluate(()=>globalThis.innerWidth),393);assert.equal(await phone.locator('.rw-window-header, .mpm-navigation').count(),0);
 await authFrame.getByPlaceholder('you@example.com').fill('someone@example.com');await authFrame.locator('input[type=password]').first().fill('not-a-real-password');
 const authRequests=[];popup.context().on('request',r=>{if(/\/auth\/v1\//.test(r.url()))authRequests.push(r.url())});await authFrame.locator('input[type=password]').first().press('Enter');await popup.waitForTimeout(500);assert.deepEqual(authRequests,[],'Previewing sign-in must never submit it');
 checks.push('Auth shows the real sign-in screen at 393px, with no header or bottom navigation, and cannot submit');
 // Every signed-in page has a centred text-only header (no icon) and the shared bottom navigation; the two navigations stay in sync.
 for(const page2 of ['Perform','Remote','Pads','Visualizer']){
  await sub.getByRole('button',{name:page2,exact:true}).click();await expect(sub.getByRole('button',{name:page2,exact:true})).toHaveAttribute('aria-current','page');
  await expect(phone.locator('.rw-window-header-label')).toHaveText(page2);await expect(phone.locator('.rw-window-header > svg')).toHaveCount(0);await expect(phone.locator('.rw-window-header .vz-header-notifications')).toHaveCount(1);await expect(phone.locator('.mpm-body [role=status]')).toHaveCount(0);
  await expect(phone.getByRole('navigation',{name:'Mobile navigation'}).getByRole('tab')).toHaveCount(4);await expect(phone.locator('.mpm-tabs .is-active')).toHaveText(page2);
  const sizes=await phone.evaluate(n=>({header:n.querySelector('.rw-window-header').getBoundingClientRect().height,nav:n.querySelector('.mpm-navigation').getBoundingClientRect().height}));assert.equal(sizes.header,38);assert.equal(Math.round(sizes.nav),61);
  assert.equal(await phone.locator('.mpm-body').evaluate(n=>n.scrollWidth>n.clientWidth),false,page2+' overflows sideways');
 }
 await phone.getByRole('navigation',{name:'Mobile navigation'}).getByRole('tab',{name:'Pads'}).click();await expect(sub.getByRole('button',{name:'Pads',exact:true})).toHaveAttribute('aria-current','page');
 checks.push('Perform, Remote, Pads and Visualizer: 38px centred icon-free headers, 61px bottom navigation, left and bottom navigation in sync');
 // Perform: engine dropdown at its production size, engine-specific presets, SYSTEM/USER and search above a scrolling list only.
 await sub.getByRole('button',{name:'Perform',exact:true}).click();
 const trigger=phone.locator('.rv-engine-dropdown-trigger');assert.equal(Math.round((await trigger.boundingBox()).height),84);await expect(phone.locator('.mpm-perform [data-preset-grid] > *').first()).toBeVisible();
 await expect(phone.getByRole('tab',{name:'SYSTEM',exact:true})).toBeVisible();await phone.getByRole('tab',{name:'USER',exact:true}).click();await expect(phone.locator('.mpm-body [role=status]')).toHaveCount(0);await phone.getByRole('button',{name:/^Notifications/}).click();await expect(phone.locator('.vz-notifications-drawer')).toContainText('No user presets');await popup.keyboard.press('Escape');await expect(phone.locator('.vz-notifications-drawer')).toHaveCount(0);assert(!popup.isClosed(),'Escape must close the drawer, not the window');await phone.getByRole('tab',{name:'SYSTEM',exact:true}).click();
 const cinemaCards=await phone.locator('[data-preset-grid] > *').count();await trigger.click();await popup.locator('.rv-engine-dropdown-option',{hasText:/Sound Drawing\s*$/i}).first().click();
 await expect(phone.locator('.rv-engine-dropdown-label').first()).toHaveText(/Sound Drawing/i);assert.notEqual(await phone.locator('[data-preset-grid] > *').count(),cinemaCards,'Presets must follow the engine');
 const scroller=phone.locator('[data-mpm-scroll="presets"]');assert(await scroller.evaluate(n=>n.scrollHeight>=n.clientHeight));
 const fixedTop=await phone.locator('.rv-engine-dropdown-trigger').boundingBox();await scroller.evaluate(n=>{n.scrollTop=n.scrollHeight});assert.deepEqual(await phone.locator('.rv-engine-dropdown-trigger').boundingBox(),fixedTop,'The engine card must not scroll');
 await phone.getByRole('tab',{name:'Controls',exact:true}).first().click();await expect(phone.getByRole('slider',{name:'Intensity',exact:true})).toBeVisible();await phone.getByRole('switch',{name:'Auto Performance',exact:true}).click();await expect(phone.getByRole('switch',{name:'Auto Performance',exact:true})).toHaveAttribute('aria-checked','true');
 checks.push('Notices live only in the Notifications drawer opened from the header bell; Escape closes the drawer first');checks.push('Perform: 84px production engine dropdown, presets follow the engine, SYSTEM/USER, search, only the lists scroll, Controls tab works');
 // Visualizer: the output sits edge to edge, a Design / React tab row follows it, and Design has all four production parent groups.
 await sub.getByRole('button',{name:'Visualizer',exact:true}).click();await expect(phone.getByRole('tab',{name:'Design',exact:true})).toBeVisible();await expect(phone.getByRole('tab',{name:'React',exact:true})).toBeVisible();
 assert.deepEqual(await phone.evaluate(n=>[...n.querySelectorAll('[data-cinema2-parent-group]')].map(g=>g.getAttribute('data-cinema2-parent-group'))),['master-controls','design','effects','palette'],'Design must show all four parent groups');
 const edges=await phone.evaluate(n=>{const x=s=>{const r=n.querySelector(s).getBoundingClientRect();return [Math.round(r.left),Math.round(r.right)]};return {header:x('.mpm-page-window'),canvas:x('.mpm-output-canvas'),nav:x('.mpm-navigation')}});assert.deepEqual(edges.canvas,edges.header);assert.deepEqual(edges.nav,edges.header);await expect(phone.locator('.mpm-visualizer .rv-workspace-panel')).toHaveCSS('background-color','rgba(0, 0, 0, 0)');assert.equal(await phone.evaluate(n=>[...n.querySelectorAll('.rv-ctrl-description')].filter(e=>e.getBoundingClientRect().height>0).length),0,'Control descriptions are hidden in production');assert.deepEqual(await phone.evaluate(n=>{const r=n.querySelector('.rv-workspace-panel').getBoundingClientRect();return [Math.round(r.left),Math.round(r.right)]}),edges.header,'The inspector adds no inset');
 await phone.getByRole('tab',{name:'React',exact:true}).click();await expect(phone.locator('.mpm-scroll')).toContainText('Reactive Strength');
 checks.push('Visualizer: output aligned with header and navigation; Design shows Master Controls, Design, Effects and Palette; React shows real model-response controls');
 assert.equal(await page.evaluate(()=>globalThis.mobileRuntimeSnapshot()),runtimeBefore,'Preview changed live application state');
 for(const [width,height] of [[800,700],[500,800]]){
 await popup.setViewportSize({width,height});await expect(popup.getByRole('navigation',{name:'Mobile preview views'})).toBeVisible();
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

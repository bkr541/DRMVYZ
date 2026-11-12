import { createServer } from 'vite'
import { _electron, chromium, expect } from '@playwright/test'
import { createRequire } from 'node:module'
import { mkdir, writeFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
const require=createRequire(import.meta.url), root=process.cwd(),output=path.join(root,'artifacts/mobile-preview')
await mkdir(output,{recursive:true})
const entry=`import React from 'react';import {createRoot} from 'react-dom/client';import {MobilePreviewLauncher} from '/src/components/vyzualz/layout/MobilePreviewLauncher.tsx';import '/src/styles.css';import '/src/styles/floatingWorkspace.css';import '/src/styles/typography.css';
createRoot(document.getElementById('root')).render(React.createElement(React.Fragment,null,React.createElement(MobilePreviewLauncher),React.createElement('button',{className:'fw-layout-lab-launcher','aria-label':'Layout Lab'},'L')));`
const server=await createServer({configFile:false,root,cacheDir:'node_modules/.cache/mobile-preview-review-vite',esbuild:{jsx:'automatic'},resolve:{dedupe:['react','react-dom']},server:{host:'127.0.0.1',port:0,watch:null,hmr:false},plugins:[{name:'mobile-review',resolveId(id){if(id==='/__mobile.tsx')return '\0mobile-review.tsx'},load(id){if(id==='\0mobile-review.tsx')return entry},configureServer(s){s.middlewares.use((req,res,next)=>{if(req.url==='/__mobile.html'){res.setHeader('content-type','text/html');res.end('<html><body style="margin:0"><div id="root"></div><script type="module" src="/__mobile.tsx"></script></body></html>');return;}next()})}}]})
const errors=[],checks=[];let browser,app,temp,options
try{
 await server.listen();const url='http://127.0.0.1:'+server.httpServer.address().port+'/__mobile.html'
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1200,height:950}});page.on('pageerror',e=>errors.push(e.message));await page.goto(url)
 const button=page.getByRole('button',{name:'Mobile Preview',exact:true});await expect(button).toBeVisible();const mobile=await button.boundingBox(),lab=await page.getByRole('button',{name:'Layout Lab',exact:true}).boundingBox();assert.equal(lab.x-(mobile.x+mobile.width),10);assert.equal(lab.y,mobile.y);assert.equal(mobile.width,lab.width);checks.push('Matching floating keys, same baseline, 10px gap to left of Layout Lab')
 const event=page.waitForEvent('popup');await button.click();const popup=await event;await expect(popup.getByRole('main',{name:'Mobile preview canvas'})).toBeVisible();assert.deepEqual(await popup.evaluate(()=>({width:globalThis.innerWidth,height:globalThis.innerHeight})),{width:1200,height:1000});await button.click();assert.equal(page.context().pages().length,2);checks.push('Browser popup 1200 × 1000; repeated clicks reuse one window')
 const nav=popup.getByRole('navigation',{name:'Mobile preview views'});await expect(nav.getByRole('button')).toHaveCount(4);
 for(const number of [1,2,3,4]){
  const label=`Option ${number}`;await nav.getByRole('button',{name:label,exact:true}).click();
  await expect(nav.getByRole('button',{name:label,exact:true})).toHaveAttribute('aria-current','page');
  await expect(popup.getByRole('main')).toHaveAttribute('data-mobile-view',`option-${number}`);
  await expect(popup.locator('.mpm')).toHaveAttribute('data-concept',String(number));
  await popup.screenshot({path:path.join(output,`option-${number}.png`)});
  for(const screen of ['Presets','Pads','Controls','Cast']){
   if(number===4)await popup.locator('.mpm-hub').getByRole('button',{name:new RegExp(screen)}).click();
   else await popup.getByRole('navigation',{name:'Mockup mobile navigation'}).getByRole('button',{name:screen,exact:true}).click();
   await expect(popup.locator('.mpm-body')).toHaveAttribute('data-mobile-page',screen);
   if(screen==='Presets'){
    await popup.getByRole('button',{name:/Reactor/}).click();await expect(popup.getByRole('button',{name:/Reactor/})).toHaveAttribute('aria-pressed','true');
    await popup.getByRole('textbox',{name:'Find a preset'}).fill('Psylo');await expect(popup.locator('.mpm-preset')).toHaveCount(1);
    await popup.getByRole('textbox',{name:'Find a preset'}).fill('');
   }
   if(screen==='Pads'){await popup.getByRole('button',{name:/01 Flash/}).click();await expect(popup.getByRole('status')).toContainText('Flash selected');}
   if(screen==='Controls'){await expect(popup.getByRole('slider')).toHaveCount(4);await popup.getByRole('slider',{name:'Intensity',exact:true}).fill('50');}
   if(screen==='Cast'){
    await popup.getByRole('button',{name:/Studio projector/}).click();await popup.getByRole('button',{name:'Start casting',exact:true}).click();
    await expect(popup.getByRole('status')).toContainText('Demo connected to Studio projector');await expect(popup.getByRole('button',{name:'Stop casting'})).toBeVisible();
   }
   const overflow=await popup.locator('.mpm-body').evaluate(n=>n.scrollWidth>n.clientWidth);assert.equal(overflow,false,`Option ${number} / ${screen} horizontal overflow`);
   await popup.screenshot({path:path.join(output,`option-${number}-${screen.toLowerCase()}.png`)});
   if(number===4)await popup.getByRole('button',{name:'← Session dashboard',exact:true}).click();
  }
  assert.equal(await nav.locator('[aria-current="page"]').count(),1);
 }
 await nav.getByRole('button',{name:'Option 1',exact:true}).click();
 const phone=await popup.locator('.mobile-preview-screen').evaluate(n=>({w:n.clientWidth,h:n.clientHeight}));assert.deepEqual(phone,{w:393,h:852});checks.push('Four distinct concepts, all 16 internal screens, dashboard return links and local demo controls; fixed 393 × 852 phone');
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

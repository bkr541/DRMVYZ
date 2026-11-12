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
const errors=[],checks=[];let browser,app,temp
try{
 await server.listen();const url='http://127.0.0.1:'+server.httpServer.address().port+'/__mobile.html'
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1200,height:950}});page.on('pageerror',e=>errors.push(e.message));await page.goto(url)
 const button=page.getByRole('button',{name:'Mobile Preview',exact:true});await expect(button).toBeVisible();const mobile=await button.boundingBox(),lab=await page.getByRole('button',{name:'Layout Lab',exact:true}).boundingBox();assert.equal(lab.x-(mobile.x+mobile.width),10);assert.equal(lab.y,mobile.y);assert.equal(mobile.width,lab.width);checks.push('Matching floating keys, same baseline, 10px gap to left of Layout Lab')
 const event=page.waitForEvent('popup');await button.click();const popup=await event;await expect(popup.getByRole('main',{name:'Mobile preview canvas'})).toBeVisible();assert.deepEqual(await popup.evaluate(()=>({width:globalThis.innerWidth,height:globalThis.innerHeight})),{width:393,height:852});await button.click();assert.equal(page.context().pages().length,2);checks.push('Browser popup 393 × 852; repeated clicks reuse one window')
 await popup.screenshot({path:path.join(output,'iphone16-browser.png')});await popup.close();const event2=page.waitForEvent('popup');await button.click();const reopened=await event2;await expect(reopened.getByRole('main')).toBeVisible();await reopened.keyboard.press('Escape').catch(error=>{if(!reopened.isClosed())throw error});await expect.poll(()=>reopened.isClosed()).toBe(true);checks.push('Manual close, reopen and Escape close')
 await page.evaluate(()=>{globalThis.open=()=>null});await button.click();await expect(page.getByRole('alert')).toContainText('blocked');checks.push('Blocked popup produces actionable feedback')
 await browser.close();browser=null
 // The isolated bootstrap changes only this test process's app-data directory,
 // then loads the real production main-process code, including its window policy.
 temp=await mkdtemp(path.join(tmpdir(),'drmvyz-mobile-review-'))
 const bootstrap=path.join(temp,'bootstrap.cjs');await mkdir(path.join(temp,'app-data'))
 // Electron's built-in module must be resolved by its runtime rather than the npm launcher.
 await writeFile(bootstrap,`const {app}=require('electron');app.setPath('appData',${JSON.stringify(path.join(temp,'app-data'))});require(${JSON.stringify(path.join(root,'electron/main.cjs'))});`)
 app=await _electron.launch({executablePath:require('electron'),args:[bootstrap],env:{...process.env,DRMVYZ_VITE_DEV_SERVER_URL:url},timeout:45000});const main=await app.firstWindow();main.on('pageerror',e=>errors.push(e.message));await expect(main.getByRole('button',{name:'Mobile Preview',exact:true})).toBeVisible()
 const nativeEvent=app.waitForEvent('window');await main.getByRole('button',{name:'Mobile Preview',exact:true}).click();const native=await nativeEvent;await expect(native.getByRole('main')).toBeVisible();assert.deepEqual(await native.evaluate(()=>({width:globalThis.innerWidth,height:globalThis.innerHeight})),{width:393,height:852})
 const options=await app.evaluate(({BrowserWindow})=>{const child=BrowserWindow.getAllWindows().find(w=>w.getTitle()==='DRMVYZ — iPhone 16 Preview');return {size:child.getContentSize(),resizable:child.isResizable(),preferences:child.webContents.getLastWebPreferences()}});assert.deepEqual(options.size,[393,852]);assert.equal(options.resizable,false);assert.equal(options.preferences.nodeIntegration,false);assert.equal(options.preferences.contextIsolation,true);assert.equal(options.preferences.sandbox,true);assert.equal(options.preferences.webSecurity,true)
 await native.screenshot({path:path.join(output,'iphone16-electron.png')});await main.getByRole('button',{name:'Mobile Preview',exact:true}).click();assert.equal(app.windows().length,2);await native.close();checks.push('Actual Electron main: fixed 393 × 852 content, isolated sandbox, one separate native window')
 assert.deepEqual(errors,[]);await writeFile(path.join(output,'result.json'),JSON.stringify({passed:true,checks,native:{size:options.size,resizable:options.resizable},errors},null,2));console.log('Mobile Preview passed',checks.length,'checks')
}finally{await browser?.close();await app?.close();await server.close();if(temp)await rm(temp,{recursive:true,force:true})}

import {createServer} from 'vite'
import {chromium,expect} from '@playwright/test'
import {writeFile,mkdir} from 'node:fs/promises'
import assert from 'node:assert/strict'
const entry=`
import React from 'react';import {createRoot} from 'react-dom/client';import {VyzualzView} from '/src/components/vyzualz/VyzualzView.tsx';import {AudioEngineProvider} from '/src/context/AudioEngineContext.tsx';
import '/src/styles.css';import '/src/styles/analyzer.css';import '/src/styles/appearance.css';import '/src/styles/vyzualz.css';import '/src/styles/reactView.css';import '/src/styles/mediaManager.css';import '/src/styles/presetManager.css';import '/src/styles/showManager.css';import '/src/styles/lyricManager.css';import '/src/styles/floatingWorkspace.css';import '/src/styles/typography.css';
import {useReactStore} from '/src/stores/reactStore.ts';import {REACT_ENGINE_IDS} from '/src/components/vyzualz/react/reactEngineCatalog.ts';import {cinema2NativePresetRegistry} from '/src/components/vyzualz/cinema2/presets/Cinema2PresetRegistry.ts';globalThis.performanceReview={state:()=>({engine:useReactStore.getState().activeReactEngineId,preset:useReactStore.getState().activeReactPresetId,pads:useReactStore.getState().performancePads,pad:useReactStore.getState().activePadId}),engines:REACT_ENGINE_IDS,updatePad:()=>useReactStore.getState().updatePerformancePad('pad-1',{label:'Live pad update'}),cinemaPresets:()=>cinema2NativePresetRegistry.list().filter(p=>!p.metadata.tags?.includes('internal')).map(p=>p.id)};
const root=createRoot(document.getElementById('root'));globalThis.review={go:view=>root.render(React.createElement(AudioEngineProvider,null,React.createElement(VyzualzView,{key:view,initialAppView:view}))) };globalThis.review.go('performanceManager');
`;
await mkdir('artifacts/performance-manager-phase01',{recursive:true});
const server=await createServer({configFile:false,root:process.cwd(),cacheDir:'node_modules/.cache/toolbar-review-vite',resolve:{dedupe:['react','react-dom']},esbuild:{jsx:'automatic'},define:{'import.meta.env.VITE_SUPABASE_URL':JSON.stringify(''),'import.meta.env.VITE_SUPABASE_ANON_KEY':JSON.stringify('')},optimizeDeps:{include:['react','react-dom/client','react/jsx-runtime','react/jsx-dev-runtime','zustand','zustand/react/shallow','three']},server:{host:'127.0.0.1',port:0,hmr:false,watch:null},plugins:[{name:'review',resolveId(id){if(id==='/__toolbar.tsx')return '\0toolbar.tsx'},load(id){if(id==='\0toolbar.tsx')return entry},configureServer(s){s.middlewares.use((req,res,next)=>{if(req.url==='/__toolbar.html'){res.setHeader('content-type','text/html');res.end('<html><body style="margin:0"><div id="root" style="height:100vh"></div><script type="module" src="/__toolbar.tsx"></script></body></html>');return;}next();});}}]});let browser;const errors=[];
try{
 await server.listen();browser=await chromium.launch({headless:true,args:['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--use-angle=swiftshader']});const page=await browser.newPage({viewport:{width:1588,height:960}});page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message)});await page.goto('http://127.0.0.1:'+server.httpServer.address().port+'/__toolbar.html',{waitUntil:'domcontentloaded',timeout:60000});console.log('Document loaded');await page.waitForFunction(()=>globalThis.review);
 await page.evaluate(()=>globalThis.review.go('performanceManager'));
 await expect(page.getByRole('group',{name:'Engines',exact:true})).toBeVisible({timeout:60000});

 const checks=[];const state=()=>page.evaluate(()=>globalThis.performanceReview.state());const before=await state();
 const cards=page.locator('.pfm-engine-card');assert.equal(await cards.count(),await page.evaluate(()=>globalThis.performanceReview.engines.length));
 assert.equal(await page.locator('.pfm-pad-body .rv-pad').count(),before.pads.length);
 assert.equal(await page.locator('.pfm-configuration-canvas').innerHTML(),'');
 assert.equal(await page.locator('.pfm-center canvas').count(),0,'No visualizer is mounted');
 assert.equal(await page.locator('.pfm-root .vz-transport-dock').count(),1);
 const dock=await page.locator('.pfm-root .vz-transport-dock').elementHandle();
 for(const label of ['Cinema 2.0','Sound Drawing','Sound Drawing XY','CANVAS','LaserDMX','PixGrid','HEADLINER']){
  await page.getByRole('button',{name:label,exact:true}).click();
  const search=page.getByRole('textbox',{name:'Search '+label+' presets',exact:true});await expect(search).toBeVisible();
  const count=await page.locator('.pfm-root [data-preset-card]').count();assert(count>0,label+' has presets');
  const first=page.locator('.pfm-root [data-preset-card]').first();await first.click();await expect(first).toHaveClass(/rv-preset-card--active/);
  assert.deepEqual(await state(),before,'Browsing must not mutate live state');
  console.log('Checking',label,count);await search.fill('no-presets-match-this-fixture');await page.screenshot({path:'artifacts/performance-manager-phase01/search-empty.png'});await expect(page.getByText('No presets match your search.',{exact:true})).toBeVisible();await search.fill('');
  if(label==='Cinema 2.0')assert.deepEqual(await page.locator('.pfm-root [data-preset-card]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-preset-card-id'))),await page.evaluate(()=>globalThis.performanceReview.cinemaPresets()));
  checks.push('Engine browsing/search/selection: '+label);
 }
 await page.getByRole('button',{name:'Cinema 2.0',exact:true}).click();await expect(page.locator('.pfm-pad-body .rv-pad:not(:disabled)').first()).toHaveAttribute('aria-disabled','true');await page.locator('.pfm-pad-body .rv-pad:not(:disabled)').first().dispatchEvent('click');await page.keyboard.press('1');assert.deepEqual(await state(),before);checks.push('Mirrored pads do not trigger live performance or keyboard shortcuts');
 await page.evaluate(()=>globalThis.performanceReview.updatePad());await expect(page.locator('.pfm-pad-body')).toContainText('Live pad update');checks.push('Pad mirror follows live assignment updates');
 await page.getByRole('tab',{name:'EDIT',exact:true}).click();assert.equal(await page.locator('.pfm-root .vz-inspector--right .vz-panel-body').innerHTML(),'');await page.getByRole('tab',{name:'PRESETS',exact:true}).click();
 assert.equal(await page.locator('.pfm-root [role="tab"]:disabled').count(),3);checks.push('Empty Edit and three disabled placeholder tabs');
 for(const [width,height]of [[1588,960],[954,844],[800,844]]){
  await page.setViewportSize({width,height});
  const layout=await page.locator('.pfm-root').evaluate(root=>{const rect=n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,bottom:r.bottom}};return {root:rect(root),dock:rect(root.querySelector('.vz-transport-dock')),pads:rect(root.querySelector('.pfm-pad-window')),config:rect(root.querySelector('.pfm-configuration')),engineColumns:globalThis.getComputedStyle(root.querySelector('.pfm-engine-grid')).gridTemplateColumns,overflow:globalThis.document.documentElement.scrollWidth>globalThis.innerWidth};});
  const tile=await page.locator('.pfm-root [data-preset-card]').first().boundingBox();assert(tile.height>=64);
  assert(!layout.overflow);assert(layout.config.h>120&&layout.pads.h>100);assert(Math.abs(layout.dock.bottom-layout.root.bottom)<2);assert.equal(layout.engineColumns.split(' ').length,2);
  await page.screenshot({path:'artifacts/performance-manager-phase01/workspace-'+width+'.png'});
 }
 const padNode=await page.locator('.pfm-pad-window').elementHandle();
 for(const side of ['left','right']){await page.getByRole('button',{name:'Collapse '+side+' inspector',exact:true}).click();await page.getByRole('button',{name:'Expand '+side+' inspector',exact:true}).click();}
 assert(await padNode.evaluate(n=>n.isConnected));assert(await dock.evaluate(n=>n.isConnected));checks.push('Three responsive widths; rail collapse preserves pad and dock identity');
 // Compare the actual React/Cinema preset search position to the manager's, within its right window.
 const searchOffset=()=>page.locator('.fw-app-content .vz-inspector--right').evaluate(rail=>{const field=rail.querySelector('.rv-preset-search-row');return field.getBoundingClientRect().y-rail.getBoundingClientRect().y});
 const managerSearchOffset=await searchOffset();await page.getByRole('button',{name:'React',exact:true}).click();await expect(page.locator('[data-app-workspace="react"]')).toBeVisible();await expect(page.locator('.vz-inspector--right .rv-preset-search-row')).toBeVisible({timeout:45000});const reactSearchOffset=await searchOffset();assert(Math.abs(managerSearchOffset-reactSearchOffset)<1,managerSearchOffset+' vs '+reactSearchOffset);
 await page.getByRole('button',{name:'Performance Manager',exact:true}).click();await expect(page.getByRole('group',{name:'Engines',exact:true})).toBeVisible();checks.push('Sidebar routing and exact React search-row vertical placement');
 await writeFile('artifacts/performance-manager-phase01/result.json',JSON.stringify({passed:true,checks,errors,managerSearchOffset,reactSearchOffset},null,2));if(errors.length)throw new Error(JSON.stringify(errors));console.log('Performance Manager checks passed',checks.length);

}finally{await browser?.close();await server.close();}

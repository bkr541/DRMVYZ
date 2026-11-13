import {createServer} from 'vite'
import {chromium,expect} from '@playwright/test'
import {writeFile,mkdir} from 'node:fs/promises'
import assert from 'node:assert/strict'
const entry=`
import React from 'react';import {createRoot} from 'react-dom/client';import {VyzualzView} from '/src/components/vyzualz/VyzualzView.tsx';import {AudioEngineProvider} from '/src/context/AudioEngineContext.tsx';
import '/src/styles.css';import '/src/styles/analyzer.css';import '/src/styles/appearance.css';import '/src/styles/vyzualz.css';import '/src/styles/reactView.css';import '/src/styles/mediaManager.css';import '/src/styles/presetManager.css';import '/src/styles/showManager.css';import '/src/styles/lyricManager.css';import '/src/styles/floatingWorkspace.css';import '/src/styles/typography.css';import '/src/styles/tabRows.css';
import {useReactStore} from '/src/stores/reactStore.ts';import {REACT_ENGINE_IDS} from '/src/components/vyzualz/react/reactEngineCatalog.ts';import {cinema2NativePresetRegistry} from '/src/components/vyzualz/cinema2/presets/Cinema2PresetRegistry.ts';globalThis.performanceReview={state:()=>({engine:useReactStore.getState().activeReactEngineId,preset:useReactStore.getState().activeReactPresetId,pads:useReactStore.getState().performancePads,pad:useReactStore.getState().activePadId}),engines:REACT_ENGINE_IDS,updatePad:()=>useReactStore.getState().updatePerformancePad('pad-1',{label:'Live pad update'}),cinemaPresets:()=>cinema2NativePresetRegistry.list().filter(p=>!p.metadata.tags?.includes('internal')).map(p=>p.id)};
const root=createRoot(document.getElementById('root'));globalThis.review={go:view=>root.render(React.createElement(AudioEngineProvider,null,React.createElement(VyzualzView,{key:view,initialAppView:view}))) };globalThis.review.go('performanceManager');
`;
await mkdir('artifacts/performance-manager-phase01',{recursive:true});
const server=await createServer({configFile:false,root:process.cwd(),cacheDir:'node_modules/.cache/toolbar-review-vite',resolve:{dedupe:['react','react-dom']},esbuild:{jsx:'automatic'},define:{'import.meta.env.VITE_SUPABASE_URL':JSON.stringify(''),'import.meta.env.VITE_SUPABASE_ANON_KEY':JSON.stringify('')},optimizeDeps:{include:['react','react-dom/client','react/jsx-runtime','react/jsx-dev-runtime','zustand','zustand/react/shallow','three']},server:{host:'127.0.0.1',port:0,hmr:false,watch:null},plugins:[{name:'review',resolveId(id){if(id==='/__toolbar.tsx')return '\0toolbar.tsx'},load(id){if(id==='\0toolbar.tsx')return entry},configureServer(s){s.middlewares.use((req,res,next)=>{if(req.url==='/__toolbar.html'){res.setHeader('content-type','text/html');res.end('<html><body style="margin:0"><div id="root" style="height:100vh"></div><script type="module" src="/__toolbar.tsx"></script></body></html>');return;}next();});}}]});let browser;const errors=[];
try{
 await server.listen();browser=await chromium.launch({headless:true,args:['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--use-angle=swiftshader']});const page=await browser.newPage({viewport:{width:1588,height:960}});page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message)});await page.goto('http://127.0.0.1:'+server.httpServer.address().port+'/__toolbar.html',{waitUntil:'domcontentloaded',timeout:60000});console.log('Document loaded');await page.waitForFunction(()=>globalThis.review);await page.addStyleTag({content:'*,*::before,*::after{transition:none!important;animation:none!important}'});
 await page.evaluate(()=>globalThis.review.go('performanceManager'));
 await expect(page.getByRole('group',{name:'Engines',exact:true})).toBeVisible({timeout:60000});


 // Compare actual React rows, not independently invented constants. Each side
 // has a different canonical layout, and the number of tabs may differ.
 const measureTabs=async selector=>page.locator(selector).first().evaluate(row=>{
  const properties=['display','paddingTop','paddingRight','paddingBottom','paddingLeft','marginTop','marginBottom','columnGap','justifyContent','alignItems','borderBottomWidth','fontFamily','fontSize','fontWeight','lineHeight','letterSpacing','minWidth','flexGrow','flexShrink','flexBasis','textAlign'];
  const css=n=>{const s=globalThis.getComputedStyle(n);return Object.fromEntries(properties.map(k=>[k,s[k]]))};
  const rect=row.getBoundingClientRect(),rail=row.closest('.vz-inspector').getBoundingClientRect();
  return {row:css(row),button:css(row.querySelector('[role="tab"]')),geometry:{left:rect.left-rail.left,right:rail.right-rect.right,height:rect.height,width:rect.width},tabs:[...row.querySelectorAll('[role="tab"]')].map(tab=>{const b=tab.getBoundingClientRect(),range=globalThis.document.createRange();range.selectNodeContents(tab);const text=range.getBoundingClientRect();return{center:Math.abs(text.left+text.width/2-(b.left+b.width/2)),fits:b.left>=rect.left&&b.right<=rect.right}})};
 });
 const referenceTabs={};
 await page.getByRole('button',{name:'React',exact:true}).click();
 await expect(page.locator('.rv-context-workspace-tabs')).toBeVisible({timeout:45000});
 for(const [width,height] of [[1588,960],[1280,844],[1180,844]]){
  await page.setViewportSize({width,height});
  referenceTabs[width]={left:await measureTabs('.rv-context-workspace-tabs'),right:await measureTabs('[data-app-workspace="react"] .rv-main-workspace-tabs')};
  await page.screenshot({path:`artifacts/performance-manager-phase01/react-tab-reference-${width}.png`});
 }
 await page.setViewportSize({width:1588,height:960});
 await page.getByRole('button',{name:'Performance Manager',exact:true}).click();
 await expect(page.getByRole('group',{name:'Engines',exact:true})).toBeVisible();
 const checks=[];const state=()=>page.evaluate(()=>globalThis.performanceReview.state());const before=await state();
 const cards=page.locator('.pfm-engine-card');assert.equal(await cards.count(),await page.evaluate(()=>globalThis.performanceReview.engines.length));
 assert.equal(await page.locator('.pfm-pad-body .rv-pad').count(),before.pads.length);
 const padColors=()=>page.locator('.pfm-pad-body .rv-pad').evaluateAll(nodes=>nodes.map(n=>n.style.getPropertyValue('--pad-color')));
 const colors=await padColors();assert.equal(new Set(colors.filter(Boolean)).size,colors.filter(Boolean).length,'Only assigned slots have dedicated colors');
 checks.push('Both rail tab rows match measured React padding, spacing, typography, fit and insets');
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
  const selectedStyle=await page.locator('.pfm-engine-card[aria-pressed="true"]').evaluate(n=>{const s=globalThis.getComputedStyle(n);return{border:s.borderTopColor,shadow:s.boxShadow}});
  await expect.poll(()=>first.evaluate(n=>globalThis.getComputedStyle(n).borderTopColor)).toBe(selectedStyle.border);
  const presetStyle=await first.evaluate(n=>{const s=globalThis.getComputedStyle(n);return{border:s.borderTopColor,shadow:s.boxShadow}});
  assert.deepEqual(selectedStyle,presetStyle,'Engine and preset cards share the selected outline and glow');
  assert.deepEqual(await padColors(),colors,'Slot colors survive browsing engine changes');
  console.log('Checking',label,count);await search.fill('no-presets-match-this-fixture');await page.screenshot({path:'artifacts/performance-manager-phase01/search-empty.png'});await expect(page.getByText('No presets match your search.',{exact:true})).toBeVisible();await search.fill('');
  if(label==='Cinema 2.0')assert.deepEqual(await page.locator('.pfm-root [data-preset-card]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-preset-card-id'))),await page.evaluate(()=>globalThis.performanceReview.cinemaPresets()));
  checks.push('Engine browsing/search/selection: '+label);
 }
 await page.getByRole('button',{name:'Cinema 2.0',exact:true}).click();await expect(page.locator('.pfm-pad-body .rv-pad:not(:disabled)').first()).toHaveAttribute('aria-disabled','true');await page.locator('.pfm-pad-body .rv-pad:not(:disabled)').first().dispatchEvent('click');await page.keyboard.press('1');assert.deepEqual(await state(),before);checks.push('Mirrored pads do not trigger live performance or keyboard shortcuts');
 await page.evaluate(()=>globalThis.performanceReview.updatePad());await expect(page.locator('.pfm-pad-body')).toContainText('Live pad update');checks.push('Pad mirror follows live assignment updates');
 await page.getByRole('tab',{name:'EDIT',exact:true}).click();assert.equal(await page.locator('.pfm-root .vz-inspector--right .vz-panel-body').innerHTML(),'');await page.getByRole('tab',{name:'PRESETS',exact:true}).click();
 assert.equal(await page.locator('.pfm-root [role="tab"]:disabled').count(),3);checks.push('Empty Edit and three disabled placeholder tabs');
 for(const [width,height]of [[1588,960],[1280,844],[1180,844]]){
  await page.setViewportSize({width,height});
  const leftContentGap=await page.locator('.pfm-root .vz-inspector--left').evaluate(rail=>rail.querySelector('.pfm-engine-grid').getBoundingClientRect().top-rail.querySelector('[role="tablist"]').getBoundingClientRect().bottom);
  assert.equal(leftContentGap,18,'Left content matches Lyric Manager: 8px panel inset + 10px library-body spacing');
  for(const side of ['left','right']){
   const actual=await measureTabs(`.pfm-root .vz-inspector--${side} [role="tablist"]`),reference=referenceTabs[width][side];
   assert.deepEqual(actual.row,reference.row,`${side} row CSS must match React at ${width}px`);
   assert.deepEqual(actual.button,reference.button,`${side} tab CSS must match React at ${width}px`);
   for(const key of ['left','right','height','width'])assert(Math.abs(actual.geometry[key]-reference.geometry[key])<1,`${side} ${key} must match React at ${width}px: ${actual.geometry[key]} vs ${reference.geometry[key]}`);
   for(const tab of actual.tabs){assert(tab.center<1,'Tab labels stay centred');assert(tab.fits,'Tabs fit within the row')}
  }
  const layout=await page.locator('.pfm-root').evaluate(root=>{const rect=n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,bottom:r.bottom}};return {root:rect(root),dock:rect(root.querySelector('.vz-transport-dock')),pads:rect(root.querySelector('.pfm-pad-window')),config:rect(root.querySelector('.pfm-configuration')),engineColumns:globalThis.getComputedStyle(root.querySelector('.pfm-engine-grid')).gridTemplateColumns,overflow:globalThis.document.documentElement.scrollWidth>globalThis.innerWidth};});
  const tile=await page.locator('.pfm-root [data-preset-card]').first().boundingBox();assert(tile.height>=64);
  const configurationGain=await page.locator('.pfm-center').evaluate(n=>{const pane=n.querySelector('.pfm-configuration'),after=pane.getBoundingClientRect().height,original=n.style.gridTemplateRows;n.style.gridTemplateRows='minmax(0, 1fr) minmax(140px, 26%)';const before=pane.getBoundingClientRect().height;n.style.gridTemplateRows=original;return after-before});assert(Math.abs(configurationGain-48)<0.1,`Configuration increases by 48px at ${width}px: ${configurationGain}`);
  const padType=await page.locator('.pfm-pad-body .rv-pad').evaluateAll(nodes=>nodes.map(n=>{const p=n.getBoundingClientRect(),label=n.querySelector('.rv-pad-label'),key=n.querySelector('.rv-pad-key'),l=label.getBoundingClientRect(),k=key.getBoundingClientRect(),s=globalThis.getComputedStyle(label);return{size:parseFloat(s.fontSize),weight:s.fontWeight,center:Math.abs(l.top+l.height/2-(p.top+p.height/2)),gap:k.top-l.bottom,inside:k.bottom<=p.bottom,background:globalThis.getComputedStyle(n).backgroundColor,empty:n.classList.contains('rv-pad--empty'),color:n.style.getPropertyValue('--pad-color'),before:globalThis.getComputedStyle(n,'::before').backgroundColor}}));
  for(const pad of padType){assert(pad.size>=12&&pad.size<=18);assert.equal(pad.weight,'500');assert(pad.center<1);assert(pad.gap<0);assert(pad.inside)}
  const assigned=padType.filter(p=>!p.empty),empty=padType.filter(p=>p.empty);assert(assigned.length>0&&empty.length>0);
  assert.equal(new Set(assigned.map(p=>p.color)).size,assigned.length,'Assigned pad accent colors stay distinct');
  for(const pad of empty){assert.equal(pad.background,'rgba(0, 0, 0, 0)','Empty pads have no background');assert.equal(pad.before,'rgba(0, 0, 0, 0)');assert.equal(pad.color,'','Empty pads have no slot color')}
  const padRows=await page.locator('.pfm-pad-body .rv-pad').evaluateAll(nodes=>nodes.filter((_,i)=>i%5===0).map(n=>{const r=n.getBoundingClientRect();return{top:r.top,bottom:r.bottom}}));for(let row=1;row<padRows.length;row++)assert(padRows[row].top>=padRows[row-1].bottom,'Pad rows must scroll rather than overlap');
  assert(!layout.overflow);assert(layout.config.h>120&&layout.pads.h>100);assert(Math.abs(layout.dock.bottom-layout.root.bottom)<2);assert.equal(layout.engineColumns.split(' ').length,2);
  await page.screenshot({path:'artifacts/performance-manager-phase01/workspace-'+width+'.png'});
 }
 const padNode=await page.locator('.pfm-pad-window').elementHandle();
 for(const side of ['left','right']){await page.getByRole('button',{name:'Collapse '+side+' inspector',exact:true}).click();await page.getByRole('button',{name:'Expand '+side+' inspector',exact:true}).click();}
 assert(await padNode.evaluate(n=>n.isConnected));assert(await dock.evaluate(n=>n.isConnected));checks.push('Three responsive widths; rail collapse preserves pad and dock identity');
 // Compare the actual React/Cinema preset search position to the manager's, within its right window.
 const searchOffset=()=>page.locator('.fw-app-content .vz-inspector--right').evaluate(rail=>{const field=rail.querySelector('.rv-preset-search-row');return field.getBoundingClientRect().y-rail.getBoundingClientRect().y});
 const managerSearchOffset=await searchOffset();await page.getByRole('button',{name:'React',exact:true}).click();await expect(page.locator('[data-app-workspace="react"]')).toBeVisible();await expect(page.locator('.vz-inspector--right .rv-preset-search-row')).toBeVisible({timeout:45000});const reactSearchOffset=await searchOffset();assert(Math.abs(managerSearchOffset-reactSearchOffset)<1,managerSearchOffset+' vs '+reactSearchOffset);
 const compactType=await page.locator('.rv-pad-label').first().evaluate(n=>globalThis.getComputedStyle(n).fontSize);assert.equal(compactType,'8.5px','React retains its original compact pad typography');
 await page.screenshot({path:'artifacts/performance-manager-phase01/react-compact-pads.png'});
 const engineMenu=page.getByTitle('Choose React engine',{exact:true});await engineMenu.click();await expect(page.getByRole('listbox',{name:'React visual engines'})).toBeVisible();await page.screenshot({path:'artifacts/performance-manager-phase01/react-engine-menu.png'});await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Performance Manager',exact:true}).click();await expect(page.getByRole('group',{name:'Engines',exact:true})).toBeVisible();checks.push('Sidebar routing and exact React search-row vertical placement');
 await writeFile('artifacts/performance-manager-phase01/result.json',JSON.stringify({passed:true,checks,errors,managerSearchOffset,reactSearchOffset,referenceTabs},null,2));if(errors.length)throw new Error(JSON.stringify(errors));console.log('Performance Manager checks passed',checks.length);

}finally{await browser?.close();await server.close();}

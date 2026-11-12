import { createServer } from 'vite'
import { chromium, expect } from '@playwright/test'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import assert from 'node:assert/strict'
const root = process.cwd(), output = path.resolve(root, 'artifacts/model-manager-phase03')
const entry = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { VyzualzView } from '/src/components/vyzualz/VyzualzView.tsx';
import { AudioEngineProvider } from '/src/context/AudioEngineContext.tsx';
import { useMediaStore } from '/src/stores/mediaStore.ts';
import { useAudioStore } from '/src/stores/audioStore.ts';
import { modelAssetRepository } from '/src/features/models/data/modelAssetRepository.ts';
import { createModelArtifact, createDefaultModelRecipe } from '/src/features/models/generator/createModelArtifact.ts';
import '/src/styles.css'; import '/src/styles/analyzer.css'; import '/src/styles/vyzualz.css'; import '/src/styles/mediaManager.css'; import '/src/styles/mediaUploadModal.css'; import '/src/styles/workspaceShell.css'; import '/src/styles/floatingWorkspace.css'; import '/src/styles/tabRows.css'; import '/src/styles/typography.css';
const owner = 'a0000000-0000-4000-8000-000000000001';
const media = (id, name, file, mime) => ({ id,dbId:id,name,title:name,type:'image',url:'/fixtures/'+file,thumbnailUrl:'/fixtures/'+file,mediaRole:mime==='image/svg+xml'?'svg':'logo',mimeType:mime,tags:[],collectionIds:[],favorite:false,metadata:{width:32,height:32},meta:mime,revision:1,lifecycleStatus:'complete' });
const a=media('c0000000-0000-4000-8000-000000000001','Source SVG','donut.svg','image/svg+xml'), b=media('c0000000-0000-4000-8000-000000000002','Source PNG','alpha-donut.png','image/png'), c=media('c0000000-0000-4000-8000-000000000003','Opaque logo','opaque-logo.png','image/png');
const query = q => useMediaStore.setState({queryItemIds:useMediaStore.getState().items.filter(i=>(!q.search||i.name.toLowerCase().includes(q.search.toLowerCase()))&&(q.filter!=='favorites'||i.favorite)).map(i=>i.id)});
useMediaStore.setState({ accountId:owner,items:[a,b,c],queryItemIds:[a.id,b.id,c.id],storageAvailable:true,authRequired:false,loading:false,invalidated:false,hasMore:false,collections:[],loadFromSupabase:async()=>{},loadCollections:async()=>{},setLibraryQuery:query,ensureLibraryLoaded:async()=>{},ensureMediaSigned:async()=>{},retryMediaAsset:async()=>false,refreshLibrary:async()=>{}, uploadQueuedMedia:async()=>{
 const q=useMediaStore.getState().uploadQueue[0]; if(!q) throw new Error('Expected canonical upload queue');
 const item={...b,id:'c0000000-0000-4000-8000-000000000004',dbId:'c0000000-0000-4000-8000-000000000004',name:q.file.name,title:q.file.name,uploadOperationId:q.operationId,url:URL.createObjectURL(q.file),thumbnailUrl:null};
 useMediaStore.setState(s=>({items:[...s.items,item],queryItemIds:[...s.queryItemIds,item.id],uploadQueue:[]}));return {total:1,succeeded:1,failures:[]};
}});
useAudioStore.setState({savedTracks:[],loading:false,loadSavedTracks:async()=>{}});
const opaqueImage=await createImageBitmap(await(await fetch('/fixtures/opaque-logo.png')).blob());
const opaqueCanvas=document.createElement('canvas');opaqueCanvas.width=opaqueImage.width;opaqueCanvas.height=opaqueImage.height;opaqueCanvas.getContext('2d').drawImage(opaqueImage,0,0);opaqueImage.close();
const jpeg=await new Promise(resolve=>opaqueCanvas.toBlob(resolve,'image/jpeg'));c.url=c.thumbnailUrl=URL.createObjectURL(jpeg);c.mimeType='image/jpeg';
const saved=await createModelArtifact({source:await (await fetch('/fixtures/donut.svg')).blob(),recipe:createDefaultModelRecipe()});
const glb=URL.createObjectURL(saved.glb);
const asset={id:a.id,userId:owner,sourceMediaId:a.id,name:'Cloud model',description:null,favorite:false,status:'ready',currentVersion:1,createdAt:'2026-11-12T00:00:00Z',updatedAt:'2026-11-12T00:00:00Z'};
modelAssetRepository.list=async q=>({items:(!q.search||asset.name.toLowerCase().includes(q.search.toLowerCase()))&&(!q.favorite||asset.favorite)?[{...asset}]:[],nextCursor:null});
modelAssetRepository.update=async(id,patch)=>Object.assign(asset,patch);
modelAssetRepository.getVersion=async()=>({generatorRecipe:saved.recipe});
modelAssetRepository.signedUrl=async(id,version,artifact)=>({url:artifact==='thumbnailPath'?'/fixtures/alpha-donut.png':glb,expiresAt:Date.now()+300000});
createRoot(document.getElementById('root')).render(React.createElement(AudioEngineProvider,null,React.createElement(VyzualzView,{initialAppView:'media',activeView:'vyzualz',onNavigate:()=>{}})));
`
const server = await createServer({ configFile: false, root, resolve: { dedupe: ['react', 'react-dom'] }, optimizeDeps: { include: ['react', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'three', 'zustand', 'zustand/react/shallow'] }, esbuild: { jsx: 'automatic' }, define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(''), 'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('') },
  server: { host: '127.0.0.1', port: 0, watch: null, hmr: false }, plugins: [{ name: 'model-manager-fixture',
    resolveId(id) { if (id === '/__model_manager_fixture.tsx') return '\0model-manager-fixture.tsx' },
    load(id) { if (id === '\0model-manager-fixture.tsx') return entry },
    configureServer(server) { server.middlewares.use(async (req,res,next) => {
      if (req.url === '/__model_manager.html') { res.setHeader('Content-Type','text/html'); res.end('<!doctype html><html><head><style>html,body,#root{height:100%;margin:0}body{overflow:hidden}</style></head><body><div id="root"></div><script type="module" src="/__model_manager_fixture.tsx"></script></body></html>'); return }
      if (req.url?.startsWith('/fixtures/')) { try { const file=path.resolve(root,'src/features/models/__tests__/fixtures',path.basename(req.url));res.setHeader('Content-Type',file.endsWith('.svg')?'image/svg+xml':'image/png');res.end(await readFile(file)) } catch {res.statusCode=404;res.end()} return }
      next()
    }) }
  }] })
await mkdir(output,{recursive:true}); await server.listen()
const browser = await chromium.launch({headless:true,args:['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--use-angle=swiftshader']})
const page = await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1})
const errors=[];page.on('pageerror',error=>{errors.push(error.message);console.error(error.stack ?? error.message)})
const hash = buffer=>createHash('sha256').update(buffer).digest('hex')
try {
  await page.goto('http://127.0.0.1:'+server.httpServer.address().port+'/__model_manager.html')
  await page.getByRole('button',{name:'Select 3D model Cloud model',exact:true}).waitFor({timeout:45000})
  await page.screenshot({path:path.join(output,'00-all-library.png')})
  await page.getByRole('tab',{name:'3D Models',exact:true}).click()
  assert.equal(await page.locator('.vz-media-card').count(),0,'Models category must not use image cards')
  await page.getByRole('button',{name:'List view',exact:true}).click()
  await expect(page.locator('.mm-model-card--list')).toHaveCount(1)
  await page.getByRole('button',{name:'Favorite model Cloud model',exact:true}).click()
  await expect(page.getByRole('button',{name:'Favorite model Cloud model',exact:true})).toHaveAttribute('aria-pressed','true')
  await page.getByRole('textbox',{name:'Search models',exact:true}).fill('missing')
  await page.getByText('No models match this search.',{exact:true}).waitFor()
  await page.getByRole('textbox',{name:'Search models',exact:true}).fill('Cloud')
  await page.getByRole('button',{name:'Select 3D model Cloud model',exact:true}).waitFor()
  await page.getByRole('textbox',{name:'Search models',exact:true}).fill('')
  await page.getByRole('tab',{name:'All Visuals',exact:true}).click()
  await page.getByRole('button',{name:'Grid view',exact:true}).click()
  await page.getByRole('button',{name:'Select 3D model Cloud model',exact:true}).click()
  const canvas=page.getByRole('img',{name:'3D model viewport',exact:true});await canvas.waitFor()
  await page.waitForTimeout(800)
  assert.equal(await page.getByRole('button',{name:'Create 3D Model',exact:true}).isDisabled(),true)
  await page.getByRole('tab',{name:'Images',exact:true}).click()
  await page.locator('img[alt="Source SVG"]').first().click()
  assert.equal(await page.getByRole('button',{name:'Create 3D Model',exact:true}).isEnabled(),true)
  await page.getByRole('button',{name:'Create 3D Model',exact:true}).click()
  await page.getByRole('button',{name:'Generate 3D Model',exact:true}).waitFor()
  await page.getByRole('button',{name:'Generate 3D Model',exact:true}).click()
  await page.getByRole('button',{name:'Fit model',exact:true}).waitFor({state:'visible'})
  await expect(page.getByRole('button',{name:'Fit model',exact:true})).toBeEnabled({timeout:30000})
  await page.waitForTimeout(400)
  await page.screenshot({path:path.join(output,'01-svg-model.png')})
  await page.getByRole('combobox',{name:'Quality',exact:true}).click()
  const option=page.getByRole('option',{name:'High',exact:true});await option.waitFor()
  const labelSize=await page.locator('label').filter({hasText:/^Quality$/}).evaluate(element=>globalThis.getComputedStyle(element).fontSize)
  assert.equal(await option.locator('.drm-dropdown__option-label').evaluate(element=>globalThis.getComputedStyle(element).fontSize),labelSize,'Portaled dropdown typography matches shared labels')
  await page.screenshot({path:path.join(output,'06-control-typography.png')})
  await page.keyboard.press('Escape')
  const box=await canvas.boundingBox(), x=box.x+box.width*.55,y=box.y+box.height*.45
  const before=hash(await canvas.screenshot())
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+150,y+70,{steps:8});await page.mouse.up();await page.waitForTimeout(150)
  const orbit=hash(await canvas.screenshot());assert.notEqual(orbit,before,'Orbit must change rendered geometry')
  await page.mouse.wheel(0,-250);await page.waitForTimeout(150)
  const zoom=hash(await canvas.screenshot());assert.notEqual(zoom,orbit,'Wheel zoom must affect rendering')
  await page.mouse.move(x,y);await page.mouse.down({button:'right'});await page.mouse.move(x+80,y+40,{steps:6});await page.mouse.up({button:'right'});await page.waitForTimeout(150)
  assert.notEqual(hash(await canvas.screenshot()),zoom,'Pan must affect rendering')
  const contextLoss=await canvas.evaluate(element=>new Promise(resolve=>{const context=element.getContext('webgl2');const extension=context.getExtension('WEBGL_lose_context');globalThis.__modelRestore=()=>extension.restoreContext();element.addEventListener('webglcontextlost',()=>setTimeout(()=>resolve({event:true,lost:context.isContextLost(),message:globalThis.document.body.textContent.includes('The graphics context was lost')}),100),{once:true});extension.loseContext();setTimeout(()=>resolve({event:false,lost:context.isContextLost()}),1500)}))
  console.log('Context loss check',contextLoss)
  assert.equal(contextLoss.event,true,'The browser must dispatch context loss')
  await page.getByText('The graphics context was lost. Waiting for recovery…',{exact:false}).waitFor()
  await page.evaluate(()=>globalThis.__modelRestore())
  await page.getByText('The graphics context was lost. Waiting for recovery…',{exact:false}).waitFor({state:'hidden'})
  await page.getByRole('button',{name:'Reset camera',exact:true}).click();await page.waitForTimeout(150)
  assert.equal(hash(await canvas.screenshot()),before,'Reset must restore the initial camera')
  await page.getByRole('button',{name:'Collapse left inspector',exact:true}).click()
  await page.getByRole('button',{name:'Collapse right inspector',exact:true}).click();await page.waitForTimeout(150)
  assert((await canvas.boundingBox()).width>box.width,'Canvas resizes after rail collapse')
  await page.screenshot({path:path.join(output,'02-collapsed-model.png')})
  await page.getByRole('button',{name:'Expand left inspector',exact:true}).click();await page.getByRole('button',{name:'Expand right inspector',exact:true}).click()
  await page.locator('img[alt="Source PNG"]').first().click()
  await page.getByRole('alertdialog').waitFor();assert.equal(await page.getByRole('button',{name:'Save',exact:true}).isDisabled(),true)
  await page.getByRole('button',{name:'Cancel',exact:true}).click();await canvas.waitFor()
  await page.locator('img[alt="Source PNG"]').first().click();await page.getByRole('button',{name:'Discard Changes',exact:true}).click()
  await page.getByRole('button',{name:'Create 3D Model',exact:true}).click();await page.getByRole('button',{name:'Generate 3D Model',exact:true}).click()
  await expect(page.getByRole('button',{name:'Fit model',exact:true})).toBeEnabled({timeout:30000})
  await page.screenshot({path:path.join(output,'03-png-model.png')})
  await page.getByRole('button',{name:'React',exact:true}).click();await page.getByRole('alertdialog').waitFor();await page.getByRole('button',{name:'Cancel',exact:true}).click()
  await page.locator('img[alt="Opaque logo"]').first().click();await page.getByRole('button',{name:'Discard Changes',exact:true}).click()
  await page.getByRole('button',{name:'Create 3D Model',exact:true}).click();await page.getByText('Confirm foreground preview',{exact:true}).waitFor()
  assert.equal(await page.getByRole('button',{name:'Generate 3D Model',exact:true}).isDisabled(),true)
  await page.screenshot({path:path.join(output,'04-foreground-confirmation.png')})
  await page.getByRole('switch',{name:'Confirm foreground preview',exact:true}).click()
  await page.getByRole('button',{name:'Generate 3D Model',exact:true}).click();await expect(page.getByRole('button',{name:'Fit model',exact:true})).toBeEnabled({timeout:30000})
  await page.getByRole('button',{name:'Import Image for 3D',exact:true}).click();await page.getByRole('button',{name:'Discard Changes',exact:true}).click()
  await page.locator('input[type="file"]').setInputFiles(path.resolve(root,'src/features/models/__tests__/fixtures/alpha-donut.png'))
  await page.getByRole('button',{name:/^Upload .*Media$/}).click()
  await page.getByRole('button',{name:'Generate 3D Model',exact:true}).waitFor();await page.getByRole('button',{name:'Generate 3D Model',exact:true}).click()
  await expect(page.getByRole('button',{name:'Fit model',exact:true})).toBeEnabled({timeout:30000})
  await page.screenshot({path:path.join(output,'05-upload-model.png')})
  assert.deepEqual(errors,[])
  await writeFile(path.join(output,'result.json'),JSON.stringify({passed:true,checks:['saved identity collision','SVG creation','orbit','zoom','pan','camera reset','rail resize','dirty cancel/discard','PNG actual VTracer','workspace navigation guard','opaque confirmation','canonical upload entry','model search/list/favorites','context recovery','portaled typography'],screenshots:7,errors},null,2))
  console.log('Media Manager model browser validation passed',output)
} catch(error) { await page.screenshot({path:path.join(output,'failure.png')}); await writeFile(path.join(output,'failure.html'),await page.content()); throw error } finally {await browser.close();await server.close()}

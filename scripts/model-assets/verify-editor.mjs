import { createServer } from 'vite'
import { chromium, expect } from '@playwright/test'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import crypto from 'node:crypto'
import path from 'node:path'
import assert from 'node:assert/strict'
const root=process.cwd(),release=process.argv.includes('--release'),output=path.resolve(root,release?'artifacts/model-release-phase07/workflow':'artifacts/model-editor-phase04')
// Only the remote service boundary is a fixture. UI, generator, WebGL capture,
// stored bytes, signed-URL download, GLTFLoader and material comparison are real.
const models=new Map();let failNextSave=false
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
useMediaStore.setState({ accountId:owner,items:[a,b,c],queryItemIds:[a.id,b.id,c.id],storageAvailable:true,authRequired:false,loading:false,invalidated:false,hasMore:false,collections:[{id:'d0000000-0000-4000-8000-000000000001',name:'Brand assets'}],loadFromSupabase:async()=>{},loadCollections:async()=>{},setLibraryQuery:query,ensureLibraryLoaded:async()=>{},ensureMediaSigned:async()=>{},retryMediaAsset:async()=>false,refreshLibrary:async()=>{}, uploadQueuedMedia:async()=>{
 const q=useMediaStore.getState().uploadQueue[0]; if(!q) throw new Error('Expected canonical upload queue');
 const item={...b,id:'c0000000-0000-4000-8000-000000000004',dbId:'c0000000-0000-4000-8000-000000000004',name:q.file.name,title:q.file.name,uploadOperationId:q.operationId,url:URL.createObjectURL(q.file),thumbnailUrl:null};
 useMediaStore.setState(s=>({items:[...s.items,item],queryItemIds:[...s.queryItemIds,item.id],uploadQueue:[]}));return {total:1,succeeded:1,failures:[]};
}});
useAudioStore.setState({savedTracks:[],loading:false,loadSavedTracks:async()=>{}});
const opaqueImage=await createImageBitmap(await(await fetch('/fixtures/opaque-logo.png')).blob());
const opaqueCanvas=document.createElement('canvas');opaqueCanvas.width=opaqueImage.width;opaqueCanvas.height=opaqueImage.height;opaqueCanvas.getContext('2d').drawImage(opaqueImage,0,0);opaqueImage.close();
const jpeg=await new Promise(resolve=>opaqueCanvas.toBlob(resolve,'image/jpeg'));c.url=c.thumbnailUrl=URL.createObjectURL(jpeg);c.mimeType='image/jpeg';

import { useModelEditorStore } from '/src/features/models/state/modelEditorStore.ts';
globalThis.editor = useModelEditorStore;
const api = async (action, payload={}) => { const res=await fetch('/cloud/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const value=await res.json();if(!res.ok)throw new Error(value.error);return value; };
modelAssetRepository.list=q=>api('list',q);
modelAssetRepository.get=id=>api('get',{id});
modelAssetRepository.createDraft=form=>api('draft',form);
modelAssetRepository.update=(id,patch)=>api('update',{id,patch});
modelAssetRepository.getOrganization=id=>api('organization',{id});
modelAssetRepository.updateMetadata=(id,version,form)=>api('metadata',{id,version,form});
modelAssetRepository.listVersions=(id,before)=>api('versions',{id,before});
modelAssetRepository.getVersion=(id,version)=>api('version',{id,version});
modelAssetRepository.saveVersion=async input=>{
 const files={};for(const [key,file] of Object.entries(input.files)){const bytes=new Uint8Array(await new Blob([file.data]).arrayBuffer());let data='';for(const b of bytes)data+=String.fromCharCode(b);files[key]={data:btoa(data),contentType:file.contentType};}
 return api('save',{...input,signal:undefined,files});
};
modelAssetRepository.cancelSave=async()=>null;
modelAssetRepository.delete=id=>api('delete',{id});
modelAssetRepository.signedUrl=async(id,version,artifact)=>({url:'/cloud/files/'+id+'/'+version+'/'+artifact,expiresAt:Date.now()+300000});
const application = createRoot(document.getElementById('root'));const mountManager=()=>application.render(React.createElement(AudioEngineProvider,null,React.createElement(VyzualzView,{initialAppView:'media',activeView:'vyzualz',onNavigate:()=>{}})));mountManager();

import {Cinema2Runtime} from '/src/components/vyzualz/cinema2/runtime/Cinema2Runtime.ts';
import {Cinema2ModuleRegistry} from '/src/components/vyzualz/cinema2/modules/Cinema2ModuleRegistry.ts';
import {createCinema2ThreeSceneModuleDefinition} from '/src/components/vyzualz/cinema2/modules/Cinema2ThreeSceneModule.ts';
import {Cinema2UserModelCache} from '/src/components/vyzualz/cinema2/model/Cinema2UserModelCache.ts';
import {Cinema2UserModelResolver} from '/src/components/vyzualz/cinema2/model/Cinema2UserModelResolver.ts';
import {Cinema2InspectorPanel} from '/src/components/vyzualz/react/Cinema2InspectorPanel.tsx';
import {activateCinema2Workspace,createEmptyCinema2WorkspaceDocument,parseCinema2WorkspaceDocument} from '/src/components/vyzualz/cinema2/runtime/Cinema2WorkspacePersistence.ts';
import {cinema2UserModelPreviewParameterId as parameterId} from '/src/components/vyzualz/cinema2/presets/Cinema2UserModelPresetFactory.ts';
const cache=new Cinema2UserModelCache(new Cinema2UserModelResolver({repository:modelAssetRepository,currentUser:async()=>owner}));
const moduleRegistry=new Cinema2ModuleRegistry();moduleRegistry.register(createCinema2ThreeSceneModuleDefinition({userModels:cache,subscribeModelAccount:()=>()=>{}}));
let cinema=null,cinemaRail=null,cinemaKind='form',workspace=createEmptyCinema2WorkspaceDocument();
const startCinema=(kind,modelId)=>{
 cinemaRail?.unmount();cinemaRail=null;cinema?.dispose();cinemaKind=kind;cinema=null;
 const previous=document.querySelector('#release-cinema');previous?.remove();
 const host=document.createElement('section');host.id='release-cinema';host.style.cssText='position:fixed;inset:0;display:flex;background:#10171c';
 const canvas=document.createElement('canvas');canvas.style.cssText='width:1000px;height:800px';host.append(canvas);const rail=document.createElement('aside');rail.style.cssText='width:360px;height:800px;overflow:auto';host.append(rail);document.body.append(host);
 const presetId='drmvyz.cinema2.user-model-'+kind;
 workspace=activateCinema2Workspace(workspace,{presetId,parameterPatch:{[parameterId(kind,'model')]:'user-model:'+modelId+':1'}}).document;
 const state=workspace.presets.find(p=>p.presetId===presetId);
 const result=Cinema2Runtime.create(canvas,{presetId,moduleRegistry,serializedParameterState:state.serializedParameterState,diagnosticsEnabled:true,renderQuality:'medium'});
 if(!result.runtime)throw new Error(result.error);cinema=result.runtime;cinema.resize({width:1000,height:800,dpr:1});cinema.start();
 cinemaRail=createRoot(rail);cinemaRail.render(React.createElement(Cinema2InspectorPanel,{runtime:cinema,surface:'design',sharedAudioAnalysis:false}));
};
globalThis.releaseReview={
 sourceRemoved:async()=>{useMediaStore.setState(s=>({items:s.items.filter(i=>i.id!==a.id),queryItemIds:s.queryItemIds.filter(id=>id!==a.id)}));await api('source-delete',{id:a.id});},
 cinema:async(kind,modelId)=>{application.render(null);await new Promise(r=>setTimeout(r,30));startCinema(kind,modelId);},
 status:()=>({modules:cinema?.getModuleRuntimeSnapshot(),cache:cache.getSnapshot(),values:cinema?.getParameterState().getSnapshot().persistentValues,frame:cinema?.getSnapshot().frameCount}),
 restore:()=>{const presetId=cinema.getCompiledPresetPlan().presetId;workspace=activateCinema2Workspace(workspace,{presetId,parameterPatch:cinema.getParameterState().getSnapshot().persistentValues}).document;const parsed=parseCinema2WorkspaceDocument(JSON.parse(JSON.stringify(workspace)));const saved=parsed.value.presets.find(p=>p.presetId===presetId);const binding=JSON.parse(saved.serializedParameterState).values[parameterId(cinemaKind,'model')];startCinema(cinemaKind,binding.split(':')[1]);return parsed.ok;},
 manager:()=>{cinemaRail?.unmount();cinemaRail=null;cinema?.dispose();cinema=null;document.querySelector('#release-cinema')?.remove();mountManager();return cache.getSnapshot();}
};
`
const server = await createServer({ configFile: false, root, resolve: { dedupe: ['react', 'react-dom'] }, optimizeDeps: { include: ['react', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'three', 'zustand', 'zustand/react/shallow'] }, esbuild: { jsx: 'automatic' }, define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(''), 'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('') },
  server: { host: '127.0.0.1', port: 0, watch: null, hmr: false }, plugins: [{ name: 'model-manager-fixture',
    resolveId(id) { if (id === '/__model_manager_fixture.tsx') return '\0model-manager-fixture.tsx' },
    load(id) { if (id === '\0model-manager-fixture.tsx') return entry },
    configureServer(server) { server.middlewares.use(async (req,res,next) => {
      if(req.url?.startsWith('/cloud/')) {
        try {
          const action=req.url.slice(7);
          if(action.startsWith('files/')) {
            const [,id,version,kind]=action.split('/'),key={glbPath:'glb',sourceSnapshotPath:'source',traceSvgPath:'trace',thumbnailPath:'thumbnail'}[kind];
            const file=models.get(id)?.versions.find(v=>v.record.version===Number(version))?.files[key];
            if(!file){res.statusCode=404;res.end('Missing file');return;}
            res.setHeader('Content-Type',file.contentType);res.end(Buffer.from(file.data,'base64'));return;
          }
          let input='';for await(const chunk of req)input+=chunk;const p=JSON.parse(input||'{}');let value;const item=models.get(p.id??p.modelAssetId);
          if(action==='list')value={items:[...models.values()].map(m=>m.asset).filter(a=>(!p.search||a.name.toLowerCase().includes(p.search.toLowerCase()))&&(!p.favorite||a.favorite)&&(!p.collectionId||models.get(a.id).organization.collectionIds.includes(p.collectionId))),nextCursor:null};
          else if(action==='draft'){const id=crypto.randomUUID();value={...p,id,userId:'a0000000-0000-4000-8000-000000000001',sourceMediaId:p.sourceMediaId??null,description:p.description??null,favorite:p.favorite??false,currentVersion:0,status:'draft',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};models.set(id,{asset:value,organization:{tags:[],collectionIds:[]},versions:[]});}
          else if(action==='source-delete'){for(const model of models.values())if(model.asset.sourceMediaId===p.id)model.asset.sourceMediaId=null;value=null;}
          else if(!item)throw new Error('Model unavailable');
          else if(action==='get')value=item.asset;
          else if(action==='update')value=Object.assign(item.asset,p.patch);
          else if(action==='organization')value=item.organization;
          else if(action==='versions')value=item.versions.map(v=>v.record).filter(v=>!p.before||v.version<p.before).reverse();
          else if(action==='version')value=item.versions.find(v=>v.record.version===p.version).record;
          else if(action==='metadata'){if(item.asset.currentVersion!==p.version)throw new Error('Model version conflict');Object.assign(item.asset,{name:p.form.name,description:p.form.description,favorite:p.form.favorite});item.organization={tags:p.form.tags,collectionIds:p.form.collectionIds};value=item.asset;}
          else if(action==='save'){
            if(failNextSave){failNextSave=false;throw new Error('Storage denied (fixture)');}
            if(item.asset.currentVersion!==p.expectedVersion)throw new Error('Model version conflict');
            const version=p.expectedVersion+1;value={id:crypto.randomUUID(),modelAssetId:p.modelAssetId,version,operationId:p.operationId,generatorRecipe:p.generatorRecipe,geometryStats:p.geometryStats,createdAt:new Date().toISOString()};
            item.versions.push({record:value,files:p.files});item.asset.currentVersion=version;item.asset.status='ready';
          } else if(action==='delete'){models.delete(p.id);value=null;}
          else throw new Error('Unknown fixture operation');
          res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));
        }catch(error){res.statusCode=400;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:error.message}));}return;
      }
      if (req.url === '/__model_manager.html') { res.setHeader('Content-Type','text/html'); res.end('<!doctype html><html><head><style>html,body,#root{height:100%;margin:0}body{overflow:hidden}</style></head><body><div id="root"></div><script type="module" src="/__model_manager_fixture.tsx"></script></body></html>'); return }
      if (req.url?.startsWith('/fixtures/')) { try { const file=path.resolve(root,'src/features/models/__tests__/fixtures',path.basename(req.url));res.setHeader('Content-Type',file.endsWith('.svg')?'image/svg+xml':'image/png');res.end(await readFile(file)) } catch {res.statusCode=404;res.end()} return }
      next()
    }) }
  }] })
await mkdir(output,{recursive:true});await server.listen()
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--use-angle=swiftshader']})
const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1}), errors=[],checks=[]
page.setDefaultTimeout(15000)
page.on('pageerror',e=>{errors.push(e.message);console.error(e.stack)})
const state=()=>page.evaluate(()=>{const s=globalThis.editor.getState();return {id:s.id,dirty:s.dirty,status:s.status,error:s.error,recipe:s.recipe,activeVersion:s.activeVersion,generationPending:s.generationPending,source:!!s.source,artifact:!!s.artifact,warnings:s.warnings,model:!!s.model}})
const ready=async()=>{await expect.poll(async()=>{const s=await state();return s.status==='ready'&&!s.generationPending&&s.artifact},{timeout:30000}).toBe(true)}
const shot=name=>page.screenshot({path:path.join(output,name+'.png')})
const tab=name=>page.getByRole('tab',{name,exact:true}).click()
const select=async(label,option)=>{await page.getByRole('combobox',{name:label,exact:true}).click();await page.getByRole('option',{name:option,exact:true}).click()}
const save=async()=>{await page.getByRole('button',{name:'Save Changes',exact:true}).click();await expect.poll(async()=>{const s=await state();if(s.error)throw new Error(s.error);return !s.dirty&&s.status==='ready'},{timeout:30000}).toBe(true)}
try{
 console.log('Opening fixture');await page.goto('http://127.0.0.1:'+server.httpServer.address().port+'/__model_manager.html')
 console.log('Selecting image');await tab('Images');await page.locator('img[alt="Source SVG"]').first().click();await page.getByRole('button',{name:'Create 3D Model',exact:true}).click();await page.getByRole('button',{name:'Generate 3D Model',exact:true}).click();await ready()
 await page.getByRole('spinbutton',{name:'Depth',exact:true}).fill('0.65');await page.getByRole('spinbutton',{name:'Bevel width',exact:true}).fill('0.02');await ready()
 await select('front material preset','Gold');await ready();await select('side material preset','Clay');await ready()
 await page.getByRole('slider',{name:'front clearcoat',exact:true}).focus();await page.keyboard.press('End');await ready()
 await page.getByRole('slider',{name:'side opacity',exact:true}).focus();await page.keyboard.press('ArrowLeft');await ready()
 console.log('Styled model ready');await page.getByRole('combobox',{name:'Quality',exact:true}).click();const option=page.getByRole('option',{name:'High',exact:true});assert.equal(await option.locator('.drm-dropdown__option-label').evaluate(e=>globalThis.getComputedStyle(e).fontSize),'11px');await shot('05-control-typography');await page.keyboard.press('Escape');await shot('01-styled-draft');checks.push('SVG geometry / front gold / side clay / clearcoat / transparency live regeneration')
 await tab('Info');await page.getByRole('textbox',{name:'Model name',exact:true}).fill('Gold emblem');await page.getByRole('textbox',{name:'Tags',exact:true}).fill('Brand');await page.getByRole('textbox',{name:'Tags',exact:true}).press('Enter');await page.getByRole('combobox',{name:'Collections',exact:true}).fill('Brand');await page.getByRole('option',{name:'Brand assets',exact:true}).click();await page.getByRole('switch',{name:'Favorite model',exact:true}).click()
 console.log('Saving version 1');await save();const id=(await state()).id;assert.equal(models.get(id).versions.length,1)
 const first=models.get(id).versions[0],files=first.files
 assert.deepEqual(Object.keys(files).sort(),['glb','source','thumbnail','trace']);assert.equal(Buffer.from(files.glb.data,'base64').readUInt32LE(0),0x46546c67)
 assert.equal(Buffer.from(files.thumbnail.data,'base64').subarray(1,4).toString(),'PNG');assert(Buffer.from(files.thumbnail.data,'base64').length>1000);assert(first.record.geometryStats.source.width>0);assert.equal(first.record.generatorRecipe.materials[0].clearcoat,1);assert.equal(first.record.generatorRecipe.materials[1].opacity,.99)
 await shot('02-saved-info');checks.push('four real artifacts and nonblank WebGL PNG saved; signed GLB independently verified')
 await page.reload();await tab('3D Models');await page.getByRole('button',{name:'Select 3D model Gold emblem',exact:true}).click();await ready();assert.equal((await state()).dirty,false);assert.equal((await state()).recipe.geometry.depth,.65)
 await expect(page.getByText('Brand',{exact:true})).toBeVisible();await expect(page.getByText('Brand assets',{exact:true})).toBeVisible();await expect(page.getByRole('switch',{name:'Favorite model',exact:true})).toHaveAttribute('aria-checked','true');checks.push('restart restores recipe, source, favorite, tags and collections')
 await tab('Edit');await page.getByRole('spinbutton',{name:'Depth',exact:true}).fill('1.25');await ready();await select('front material preset','Chrome');await ready();await save();assert.equal(models.get(id).versions.length,2);assert.notEqual(models.get(id).versions[1].files.glb.data,first.files.glb.data)
 await tab('Output');await select('Model version','Version 1');await ready();assert.equal((await state()).recipe.geometry.depth,.65);await select('Model version','Version 2');await ready();assert.equal((await state()).recipe.geometry.depth,1.25);checks.push('immutable versions restore distinct geometry and materials')
 await shot('03-version-output')
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Download GLB',exact:true}).click();const downloaded=await downloadPromise;const bytes=await readFile(await downloaded.path());assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.length,models.get(id).versions[1].record.geometryStats.glbBytes);checks.push('real GLB download with exact persisted binary size')
 await tab('Edit');const before=(await state()).recipe;await page.getByRole('switch',{name:'Preview grid',exact:true}).click();await page.getByRole('switch',{name:'Preview shadows',exact:true}).click();await page.getByRole('switch',{name:'Turntable',exact:true}).click();await page.waitForTimeout(250);await page.getByRole('switch',{name:'Turntable',exact:true}).click();assert.equal((await state()).recipe.geometry.depth,before.geometry.depth)
 failNextSave=true;await page.getByRole('button',{name:'Save Changes',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'Storage denied'})).toBeVisible();assert.equal((await state()).dirty,true);assert.equal(models.get(id).versions.length,2);await page.getByRole('button',{name:'Retry Save',exact:true}).click();await expect.poll(async()=>!(await state()).dirty,{timeout:30000}).toBe(true);assert.equal(models.get(id).versions.length,3);checks.push('preview-only controls; denied save keeps draft and previous version, retry completes')
 await tab('Output');await page.getByRole('button',{name:'Save As New Model',exact:true}).click();await page.getByRole('textbox',{name:'New model name',exact:true}).fill('Independent copy');await page.getByRole('button',{name:'Save New Model',exact:true}).click();await expect.poll(async()=>!(await state()).dirty,{timeout:30000}).toBe(true);const copy=(await state()).id;assert.notEqual(copy,id);assert.equal(models.get(copy).versions.length,1);assert.equal(models.get(id).versions.length,3);checks.push('Save As produces new identity and independent history')
 await tab('Edit');await page.getByRole('spinbutton',{name:'Depth',exact:true}).fill('0.4');await ready();await tab('Images');await page.locator('img[alt="Source PNG"]').first().click();await page.getByRole('alertdialog').waitFor();await page.getByRole('button',{name:'Save',exact:true}).click();await page.getByRole('alertdialog').waitFor({state:'hidden'});assert.equal(models.get(copy).versions.length,2);checks.push('navigation waits for save and independent GLB verification')
 if(release){
  await page.evaluate(()=>globalThis.releaseReview.sourceRemoved());
  for(const kind of ['form','shatter','dust','hologram','slices','voxel']){
   console.log('Loading saved model in Cinema',kind);
   await page.evaluate(({kind,id})=>globalThis.releaseReview.cinema(kind,id),{kind,id});
   await expect.poll(async()=>page.evaluate(()=>{const s=globalThis.releaseReview.status();return s.cache.heldCount===1&&s.modules.activeResourceLeaseCount===1&&s.modules.modules.every(m=>m.diagnostics.length===0)&&s.modules.estimatedGpuBytes>0;}),{timeout:30000}).toBe(true);
   await page.waitForTimeout(250);await shot('cinema-'+kind);
   assert.equal(await page.evaluate(()=>globalThis.releaseReview.restore()),true);
   await expect.poll(async()=>page.evaluate(()=>globalThis.releaseReview.status().cache.heldCount),{timeout:30000}).toBe(1);
  }
  assert.deepEqual(await page.evaluate(()=>globalThis.releaseReview.manager()),{entryCount:0,heldCount:0});
  await tab('3D Models');await page.getByRole('button',{name:'Select 3D model Gold emblem',exact:true}).click();await ready();assert.equal((await state()).recipe.geometry.depth,1.25);assert.equal((await state()).source,true);
  checks.push('saved Storage-fixture GLB renders in all six native presets; pinned workspace restore; zero leases after return; source-deleted model remains editable');
 }
 await tab('3D Models');await page.getByRole('button',{name:'Select 3D model Independent copy',exact:true}).click();await ready();await page.getByRole('button',{name:'Delete Media',exact:true}).click();await page.getByRole('button',{name:'Delete',exact:true}).click();await expect.poll(()=>models.has(copy)).toBe(false);checks.push('confirmed model deletion and library invalidation')
 assert.deepEqual(errors,[]);await shot('04-library-after-delete');await writeFile(path.join(output,'result.json'),JSON.stringify({passed:true,cloudEndToEnd:'pending; remote persistence is a local HTTP fixture',checks,errors},null,2));console.log('Phase04 browser checks passed:',checks.length,output)
}catch(error){console.error('Editor state:',await state());if(release)console.error('Cinema state:',JSON.stringify(await page.evaluate(()=>globalThis.releaseReview?.status())));await shot('failure');await writeFile(path.join(output,'failure.html'),await page.content());throw error}finally{await browser.close();await server.close()}

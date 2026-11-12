import { createServer } from 'vite'
import { chromium, expect } from '@playwright/test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
const root=process.cwd(),output=path.resolve('artifacts/model-runtime-phase05')
const entry=`
import React from 'react';import {createRoot} from 'react-dom/client';
import {Cinema2Runtime} from '/src/components/vyzualz/cinema2/runtime/Cinema2Runtime.ts';
import {Cinema2InspectorPanel} from '/src/components/vyzualz/react/Cinema2InspectorPanel.tsx';
import {Cinema2PresetRegistry} from '/src/components/vyzualz/cinema2/presets/Cinema2PresetRegistry.ts';
import {Cinema2ModuleRegistry} from '/src/components/vyzualz/cinema2/modules/Cinema2ModuleRegistry.ts';
import {createCinema2ThreeSceneModuleDefinition} from '/src/components/vyzualz/cinema2/modules/Cinema2ThreeSceneModule.ts';
import {Cinema2UserModelCache} from '/src/components/vyzualz/cinema2/model/Cinema2UserModelCache.ts';
import {Cinema2UserModelResolver} from '/src/components/vyzualz/cinema2/model/Cinema2UserModelResolver.ts';
import {CINEMA2_USER_MODEL_REFERENCE_MANIFEST as manifest,CINEMA2_USER_MODEL_PARAMETER_ID as bindingId,CINEMA2_USER_MODEL_PALETTE_ID as paletteId,CINEMA2_USER_MODEL_TINT_ID as tintId} from '/src/components/vyzualz/cinema2/model/Cinema2UserModelReferenceHarness.ts';
import {createEmptyCinema2WorkspaceDocument,activateCinema2Workspace,parseCinema2WorkspaceDocument} from '/src/components/vyzualz/cinema2/runtime/Cinema2WorkspacePersistence.ts';
import {useMediaStore} from '/src/stores/mediaStore.ts';
import {modelAssetRepository as repo} from '/src/features/models/data/modelAssetRepository.ts';
import {ModelAssetError} from '/src/features/models/domain/modelAssetTypes.ts';
import {createModelArtifact,createDefaultModelRecipe} from '/src/features/models/generator/createModelArtifact.ts';
import '/src/styles.css';import '/src/styles/vyzualz.css';import '/src/styles/reactView.css';import '/src/styles/typography.css';
const userA='a0000000-0000-4000-8000-000000000001',userB='b0000000-0000-4000-8000-000000000001';let owner=userA,missing=false,time=0,openCount=0;
useMediaStore.setState({accountId:owner});const listeners=new Set();
const ids=['c0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000002'];
const a=await createModelArtifact({source:await(await fetch('/fixtures/donut.svg')).blob(),recipe:createDefaultModelRecipe()});
const next=createDefaultModelRecipe();next.geometry.depth=.8;next.materials[0].color='#cc633b';
const b=await createModelArtifact({source:await(await fetch('/fixtures/islands.svg')).blob(),recipe:next});
const models=[a,b],urls=models.map(m=>URL.createObjectURL(m.glb)),thumb='/fixtures/alpha-donut.png';
const assets=ids.map((id,i)=>({id,userId:userA,sourceMediaId:null,name:i?'Wide model':'Cutout model',description:null,favorite:false,status:'ready',currentVersion:2,createdAt:'2026-11-12T00:00:00Z',updatedAt:'2026-11-12T00:00:00Z'}));
const authorize=id=>{if(owner!==userA)throw new ModelAssetError('authorization','This account cannot access the private model.');const asset=assets.find(a=>a.id===id);if(!asset)throw new Error('Model missing');return {...asset,status:missing?'deletion_pending':'ready'};};
repo.list=async(q={})=>({items:owner===userA?assets.filter(a=>!q.search||a.name.toLowerCase().includes(q.search.toLowerCase())):[],nextCursor:null});
repo.get=async id=>authorize(id);
repo.getVersion=async(id,version)=>{authorize(id);const m=models[ids.indexOf(id)];return {modelAssetId:id,version,generatorRecipe:m.recipe,geometryStats:m.stats};};
repo.signedUrl=async(id,version,kind)=>{authorize(id);return {url:kind==='thumbnailPath'?thumb:urls[ids.indexOf(id)],expiresAt:Date.now()+60000};};
const cache=new Cinema2UserModelCache(new Cinema2UserModelResolver({repository:repo,currentUser:async()=>owner}));
const presets=new Cinema2PresetRegistry();const registration=presets.register(manifest);if(!registration.ok)throw new Error(JSON.stringify(registration.diagnostics));
const modules=new Cinema2ModuleRegistry();modules.register(createCinema2ThreeSceneModuleDefinition({userModels:cache,subscribeModelAccount:listener=>{listeners.add(listener);return()=>listeners.delete(listener);}}));
const canvas=document.querySelector('canvas'),inspector=createRoot(document.querySelector('aside'));
let runtime;
const create=serialized=>{const result=Cinema2Runtime.create(canvas,{presetId:manifest.id,presetRegistry:presets,moduleRegistry:modules,serializedParameterState:serialized,diagnosticsEnabled:true,renderQuality:'high',randomness:{mode:'deterministic',seed:'private-model-reference'},requestAnimationFrame:callback=>requestAnimationFrame(()=>callback(time+=16)),cancelAnimationFrame:id=>cancelAnimationFrame(id),transportSource:{getState:()=>({sourcePresent:false,playing:false,paused:true,analysisActive:false,timeSec:0,bpm:120,bpmSync:false,trackId:null})}});if(!result.runtime)throw new Error(result.error);runtime=result.runtime;runtime.resize({width:900,height:700,dpr:1});runtime.start();inspector.render(React.createElement(Cinema2InspectorPanel,{runtime,surface:'design',sharedAudioAnalysis:false,onOpenMediaManager:()=>{openCount++;}}));};
let serialized;const saved=localStorage.getItem('private-model-workspace');if(saved){const document=parseCinema2WorkspaceDocument(JSON.parse(saved),presets);serialized=document.value.presets[0]?.serializedParameterState;}create(serialized);
globalThis.review={
 status:()=>({modules:runtime.getModuleRuntimeSnapshot(),runtime:runtime.getSnapshot(),camera:runtime.getCameraRuntimeSnapshot().camera,render:runtime.getRenderGraphExecutorSnapshot(),cache:cache.getSnapshot(),value:runtime.getParameterState().getSnapshot().persistentValues[bindingId],openCount}),
 bind:(id,version=1)=>runtime.getParameterState().setPersistentValue(bindingId,id==='default'?'default-model':'user-model:'+ids[id]+':'+version),
 tint:(enabled,color)=>{runtime.getParameterState().setPersistentValue(paletteId,enabled);runtime.getParameterState().setPersistentValue(tintId,color);},
 denied:()=>{owner=userB;useMediaStore.setState({accountId:owner});listeners.forEach(fn=>fn());},
 restoreOwner:()=>{owner=userA;useMediaStore.setState({accountId:owner});listeners.forEach(fn=>fn());},
 deleted:()=>{missing=true;listeners.forEach(fn=>fn());},
 save:()=>{const result=activateCinema2Workspace(createEmptyCinema2WorkspaceDocument(),{presetId:manifest.id,parameterPatch:runtime.getParameterState().getSnapshot().persistentValues},presets);localStorage.setItem('private-model-workspace',JSON.stringify(result.document));return result.document;},
 reenter:()=>{const serialized=runtime.getParameterState().serialize();runtime.dispose();create(serialized);},
 lose:()=>{const gl=canvas.getContext('webgl2'),ext=gl.getExtension('WEBGL_lose_context');globalThis.restore=()=>ext.restoreContext();ext.loseContext();},
 stop:()=>{runtime.dispose();return cache.getSnapshot();}
};
`
const server=await createServer({configFile:false,root,resolve:{dedupe:['react','react-dom']},esbuild:{jsx:'automatic'},optimizeDeps:{include:['react','react-dom/client','react/jsx-runtime','react/jsx-dev-runtime','three','zustand','zustand/react/shallow','three/examples/jsm/loaders/GLTFLoader.js','three/examples/jsm/environments/RoomEnvironment.js']},define:{'import.meta.env.VITE_SUPABASE_URL':JSON.stringify(''),'import.meta.env.VITE_SUPABASE_ANON_KEY':JSON.stringify('')},server:{host:'127.0.0.1',port:0,watch:null,hmr:false},plugins:[{name:'private-cinema-model-fixture',resolveId:id=>id==='/__cinema_models.tsx'?'\0cinema-models.tsx':undefined,load:id=>id==='\0cinema-models.tsx'?entry:undefined,configureServer(server){server.middlewares.use(async(req,res,next)=>{
 if(req.url==='/__cinema_models.html'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><style>body{margin:0;background:#0e151a;color:white;display:flex}canvas{width:900px;height:700px}aside{width:350px;height:700px;overflow:auto}</style></head><body><canvas aria-label="Cinema private model stage"></canvas><aside></aside><script type="module" src="/__cinema_models.tsx"></script></body></html>');return;}
 if(req.url?.startsWith('/fixtures/')){try{const name=path.basename(req.url);res.setHeader('Content-Type',name.endsWith('.svg')?'image/svg+xml':'image/png');res.end(await readFile(path.resolve(root,'src/features/models/__tests__/fixtures',name)));}catch{res.statusCode=404;res.end();}return;}next();});}}]})
await mkdir(output,{recursive:true});await server.listen();let browser
const errors=[],checks=[];let activePage
try{
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--use-angle=swiftshader']});const page=await browser.newPage({viewport:{width:1250,height:700},deviceScaleFactor:1});activePage=page;page.setDefaultTimeout(15000);page.on('pageerror',e=>{errors.push(e.message);console.error(e.stack);});
 const api=(name,...args)=>page.evaluate(({name,args})=>globalThis.review[name](...args),{name,args});
 const ready=async()=>expect.poll(async()=>{const s=await api('status');return s.modules.activeResourceLeaseCount===1&&!s.modules.modules.some(m=>m.diagnostics.length)&&s.modules.estimatedGpuBytes>0;},{timeout:30000}).toBe(true);
 const hash=async()=>createHash('sha256').update(await page.locator('canvas').screenshot()).digest('hex');
 await page.goto('http://127.0.0.1:'+server.httpServer.address().port+'/__cinema_models.html');await page.waitForFunction(()=>!!globalThis.review);await ready();console.log('Neutral stage ready');await page.waitForTimeout(600);const fallback=await hash();await page.screenshot({path:path.join(output,'01-default.png')});
 await page.getByRole('combobox',{name:'Model',exact:true}).click();const option=page.getByRole('option',{name:/^Cutout model · v2/});await option.waitFor();assert.equal(await option.locator('.drm-dropdown__option-label').evaluate(e=>globalThis.getComputedStyle(e).fontSize),'11px');await page.screenshot({path:path.join(output,'04-selector-typography.png')});await option.click();await expect.poll(async()=>(await api('status')).cache.heldCount).toBe(1);await ready();await page.waitForTimeout(300);console.log('Private model ready');const a=await hash(),camera=(await api('status')).camera;assert.notEqual(a,fallback);assert((await api('status')).value.endsWith(':2'));checks.push('generic Design model selector resolves owned signed GLB into actual Cinema stage');await page.screenshot({path:path.join(output,'02-private-model.png')});
 await api('bind',1,1);await ready();await page.waitForTimeout(300);const b=await hash();assert.notEqual(b,a);assert.deepEqual((await api('status')).camera,camera);
 await api('bind',0,2);await ready();await page.waitForTimeout(300);assert.equal(await hash(),a);assert.deepEqual((await api('status')).cache,{entryCount:1,heldCount:1});checks.push('A→B→A changes only the model; camera stable and one shared lease');
 await api('tint',true,[0.05,0.8,1,1]);await page.waitForTimeout(150);assert.notEqual(await hash(),a);await api('tint',false,[0.05,0.8,1,1]);await page.waitForTimeout(150);assert.equal(await hash(),a);checks.push('explicit palette permission changes pixels and restores saved PBR colors');
 const document=await api('save');assert.equal(document.schemaVersion,1);assert(!JSON.stringify(document).includes('blob:'));await page.reload();await page.waitForFunction(()=>!!globalThis.review);await ready();await page.waitForTimeout(300);assert((await api('status')).value.endsWith(':2'));assert.equal(await hash(),a);checks.push('workspace reload recreates the pinned version without URLs');
 await api('reenter');await ready();await page.waitForTimeout(300);assert.equal(await hash(),a);checks.push('preset reentry recreates pinned identity and releases old resources');
 await api('lose');await expect.poll(async()=>(await api('status')).runtime.phase).toBe('context-lost');await page.evaluate(()=>globalThis.restore());await ready();await page.waitForTimeout(500);assert.equal(await hash(),a);checks.push('real WEBGL_lose_context recovery restores the same pinned model');
 await api('denied');await expect.poll(async()=>(await api('status')).modules.modules.flatMap(m=>m.diagnostics).some(d=>d.code==='CINEMA2_USER_MODEL_UNAUTHORIZED')).toBe(true);await expect(page.getByRole('alert').filter({hasText:'This account cannot access the private model.'})).toBeVisible();await page.waitForTimeout(300);assert.equal((await api('status')).cache.heldCount,0);assert((await api('status')).value.endsWith(':2'));assert.notEqual(await hash(),a);await page.screenshot({path:path.join(output,'03-unauthorized.png')});checks.push('account revocation drops private geometry, preserves binding and renders safe default');
 await api('restoreOwner');await ready();await api('deleted');await expect.poll(async()=>(await api('status')).modules.modules.flatMap(m=>m.diagnostics).some(d=>d.code==='CINEMA2_USER_MODEL_MISSING')).toBe(true);checks.push('deleted model falls back with an explicit missing diagnostic');
 await page.getByRole('button',{name:'Create in Media Manager',exact:true}).click();assert.equal((await api('status')).openCount,1);checks.push('empty-state action uses the host Media Manager navigation callback');
 assert.deepEqual(await api('stop'),{entryCount:0,heldCount:0});assert.deepEqual(errors,[]);await writeFile(path.join(output,'result.json'),JSON.stringify({passed:true,cloudEndToEnd:'pending; Auth and model repository boundary fixture',checks,errors},null,2));console.log('Cinema private model browser check passed:',checks.length,output)
}catch(error){if(activePage){await activePage.screenshot({path:path.join(output,'failure.png')});await writeFile(path.join(output,'failure.html'),await activePage.content());console.error(JSON.stringify(await activePage.evaluate(()=>globalThis.review?.status()),null,2));}console.error(error);throw error;}finally{await browser?.close();await server.close();}

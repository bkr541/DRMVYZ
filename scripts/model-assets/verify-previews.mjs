import { createServer } from 'vite'
import { chromium, expect } from '@playwright/test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import sharp from 'sharp'
const root=process.cwd(),output=path.resolve('artifacts/model-preview-phase06')
const entry=`
import React from 'react';import {createRoot} from 'react-dom/client';
import {Cinema2Runtime} from '/src/components/vyzualz/cinema2/runtime/Cinema2Runtime.ts';
import {Cinema2InspectorPanel} from '/src/components/vyzualz/react/Cinema2InspectorPanel.tsx';
import {Cinema2ModuleRegistry} from '/src/components/vyzualz/cinema2/modules/Cinema2ModuleRegistry.ts';
import {createCinema2ThreeSceneModuleDefinition} from '/src/components/vyzualz/cinema2/modules/Cinema2ThreeSceneModule.ts';
import {Cinema2UserModelCache} from '/src/components/vyzualz/cinema2/model/Cinema2UserModelCache.ts';
import {Cinema2UserModelResolver} from '/src/components/vyzualz/cinema2/model/Cinema2UserModelResolver.ts';
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

import { cinema2NativePresetRegistry as presets } from '/src/components/vyzualz/cinema2/presets/Cinema2PresetRegistry.ts';
import { CINEMA2_USER_MODEL_PREVIEWS as patterns } from '/src/components/vyzualz/cinema2/model/Cinema2UserModelPreviewPatterns.ts';
import { cinema2UserModelPreviewParameterId as parameterId } from '/src/components/vyzualz/cinema2/presets/Cinema2UserModelPresetFactory.ts';
import { Cinema2PresetsPanel } from '/src/components/vyzualz/react/Cinema2PresetsPanel.tsx';
import {getLoadedCinema2ThreeLibrary} from '/src/components/vyzualz/cinema2/modules/three/Cinema2ThreeLibrary.ts';
import {getCinema2ThreeRenderer} from '/src/components/vyzualz/cinema2/modules/three/Cinema2ThreeRendererHost.ts';
import { AudioFeatureBus } from '/src/features/musicIntelligence/AudioFeatureBus.ts';
import { ifritMusicFixture } from '/src/test/support/IfritMusicFixture.ts';
const cache=new Cinema2UserModelCache(new Cinema2UserModelResolver({repository:repo,currentUser:async()=>owner}));
const modules=new Cinema2ModuleRegistry();modules.register(createCinema2ThreeSceneModuleDefinition({userModels:cache,subscribeModelAccount:listener=>{listeners.add(listener);return()=>listeners.delete(listener);}}));
const canvas=document.querySelector('canvas'),inspector=createRoot(document.querySelector('aside')),catalog=createRoot(document.querySelector('nav'));
let runtime,kind='shatter',pending=null,callbackId=0,source=true,paused=true,bpm=120,trackTime=2,serial=0;
const states=new Map();
const create=(nextKind,serialized)=>{kind=nextKind;const result=Cinema2Runtime.create(canvas,{presetId:'drmvyz.cinema2.user-model-'+kind,presetRegistry:presets,moduleRegistry:modules,serializedParameterState:serialized,diagnosticsEnabled:true,renderQuality:'high',randomness:{mode:'deterministic',seed:'model-previews'},requestAnimationFrame:callback=>{pending=callback;return++callbackId;},cancelAnimationFrame:()=>{pending=null;},transportSource:{getState:()=>({sourcePresent:source,playing:source&&!paused,paused,analysisActive:source,timeSec:trackTime,bpm,bpmSync:false,trackId:'ifrit-audio-fixture'})}});if(!result.runtime)throw new Error(result.error);runtime=result.runtime;runtime.resize({width:800,height:600,dpr:1});runtime.start();inspector.render(React.createElement(Cinema2InspectorPanel,{runtime,surface:'design',sharedAudioAnalysis:false,onOpenMediaManager:()=>{openCount++;}}));catalog.render(React.createElement(Cinema2PresetsPanel,{activePresetId:runtime.getCompiledPresetPlan().presetId,onSelectPreset:id=>switchKind(id.split('user-model-')[1]),catalog:{presets:presets.list().filter(p=>p.id.includes('user-model-')&&!p.metadata.tags?.includes('internal')),userIds:new Set()}}));};
const switchKind=next=>{if(runtime){states.set(kind,runtime.getParameterState().serialize());runtime.dispose();}create(next,states.get(next));};
const saved=localStorage.getItem('model-preview-workspace');if(saved){const document=parseCinema2WorkspaceDocument(JSON.parse(saved));for(const record of document.value.presets)if(presets.get(record.presetId))states.set(record.presetId.split('user-model-')[1],record.serializedParameterState);}create('shatter',states.get('shatter'));
globalThis.review={
 status:()=>({memory:getLoadedCinema2ThreeLibrary()?{...getCinema2ThreeRenderer(getLoadedCinema2ThreeLibrary(),canvas.getContext('webgl2')).renderer.info.memory}:null,kind,modules:runtime.getModuleRuntimeSnapshot(),runtime:runtime.getSnapshot(),render:runtime.getRenderGraphExecutorSnapshot(),camera:runtime.getCameraRuntimeSnapshot().camera,cache:cache.getSnapshot(),values:runtime.getParameterState().getSnapshot().persistentValues,resources:runtime.getResourceManagerSnapshot(),openCount}),
 switch:switchKind,
 set:(property,value)=>runtime.getParameterState().setPersistentValue(property==='quality'?'quality-mode':parameterId(kind,property),value),
 tick:(options={})=>{trackTime=options.time??trackTime;paused=options.paused??paused;bpm=options.bpm??bpm;AudioFeatureBus.setFrame(ifritMusicFixture({timeSec:trackTime,frameId:++serial,bpm,energy:options.energy??0,event:options.event??null,eventId:options.eventId??1,eventTime:options.eventTime??trackTime}));const callback=pending;pending=null;if(callback)callback(time+=16);},
 bind:(id,version=1)=>runtime.getParameterState().setPersistentValue(parameterId(kind,'model'),id==='default'?'default-model':'user-model:'+ids[id]+':'+version),
 deleted:()=>{missing=true;listeners.forEach(fn=>fn());},
 save:()=>{states.set(kind,runtime.getParameterState().serialize());let document=createEmptyCinema2WorkspaceDocument();for(const [key,serialized]of states){const values=JSON.parse(serialized).values;document=activateCinema2Workspace(document,{presetId:'drmvyz.cinema2.user-model-'+key,parameterPatch:values}).document;}localStorage.setItem('model-preview-workspace',JSON.stringify(document));return document;},
 reenter:()=>switchKind(kind),
 resize:(w,h)=>{canvas.style.width=w+'px';canvas.style.height=h+'px';runtime.resize({width:w,height:h,dpr:1});},
 stop:()=>{runtime.dispose();return cache.getSnapshot();}
};
`
const server=await createServer({configFile:false,root,resolve:{dedupe:['react','react-dom']},esbuild:{jsx:'automatic'},optimizeDeps:{include:['react','react-dom/client','react/jsx-runtime','react/jsx-dev-runtime','three','zustand','zustand/react/shallow','three/examples/jsm/loaders/GLTFLoader.js','three/examples/jsm/environments/RoomEnvironment.js']},define:{'import.meta.env.VITE_SUPABASE_URL':JSON.stringify(''),'import.meta.env.VITE_SUPABASE_ANON_KEY':JSON.stringify('')},server:{host:'127.0.0.1',port:0,watch:null,hmr:false},plugins:[{name:'private-cinema-model-fixture',resolveId:id=>id==='/__cinema_models.tsx'?'\0cinema-models.tsx':undefined,load:id=>id==='\0cinema-models.tsx'?entry:undefined,configureServer(server){server.middlewares.use(async(req,res,next)=>{
 if(req.url==='/__cinema_models.html'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><style>body{margin:0;background:#0e151a;color:white;display:flex}nav{width:240px;height:600px;overflow:auto}canvas{width:800px;height:600px}aside{width:350px;height:600px;overflow:auto}</style></head><body><nav></nav><canvas aria-label="Cinema private model stage"></canvas><aside></aside><script type="module" src="/__cinema_models.tsx"></script></body></html>');return;}
 if(req.url?.startsWith('/fixtures/')){try{const name=path.basename(req.url);res.setHeader('Content-Type',name.endsWith('.svg')?'image/svg+xml':'image/png');res.end(await readFile(path.resolve(root,'src/features/models/__tests__/fixtures',name)));}catch{res.statusCode=404;res.end();}return;}next();});}}]})

await mkdir(output,{recursive:true});await server.listen();let browser,page
const errors=[],checks=[],captures=[]
try{
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--use-angle=swiftshader']});page=await browser.newPage({viewport:{width:1390,height:600},deviceScaleFactor:1});page.setDefaultTimeout(15000);page.on('pageerror',e=>{errors.push(e.message);console.error(e.stack);});
 const api=(name,...args)=>page.evaluate(({name,args})=>globalThis.review[name](...args),{name,args});
 const tick=async(options={})=>{await api('tick',options);await page.waitForTimeout(8);};
 const settle=async(options={})=>{for(let i=0;i<12;i++)await tick(options);};
 const ready=async()=>{for(let i=0;i<180;i++){await tick();const s=await api('status');if(s.modules.activeResourceLeaseCount===1&&!s.modules.modules.some(m=>m.diagnostics.length)&&s.modules.estimatedGpuBytes>0){await settle();return;}}throw new Error(JSON.stringify(await api('status')));};
 const image=async()=>page.locator('canvas').screenshot();
 const pixels=async buffer=>sharp(buffer).removeAlpha().raw().toBuffer();
 const diff=async(a,b)=>{a=await pixels(a);b=await pixels(b);let sum=0;assert.equal(a.length,b.length);for(let i=0;i<a.length;i++)sum+=Math.abs(a[i]-b[i]);return sum/a.length;};
 const shot=async(name)=>{const buffer=await image();await writeFile(path.join(output,name+'.png'),buffer);captures.push(name);return buffer;};
 const set=async(key,value)=>{const result=await api('set',key,value);assert(result.ok,JSON.stringify(result));await settle();};
 await page.goto('http://127.0.0.1:'+server.httpServer.address().port+'/__cinema_models.html');await page.waitForFunction(()=>!!globalThis.review);await ready();
 const names={shatter:['Radial Burst','Twin Banks','Crown Lift','Pinwheel Debris','Ripple Break','Rejoined Clusters'],dust:['Surface Cloud','Rising Drift','Halo Orbit','Twin Plumes','Wave Gather','Compressed Mist'],hologram:['Wire Signal','Scan Sweep','Double Echo','Tilted Projection','Signal Pulse','Cross Scan'],slices:['Layer Stack','Stair Step','Fan Sections','Alternating Bands','Ribbon Wave','Collapsed Layers']};
 const representations=[],metrics=[];
 // Rewind between samples and advance the real published beat grid, not a fake visual timer.
 const rewind=async()=>{await settle({time:10,paused:true,energy:0,bpm:120});await settle({time:0,paused:false,energy:0,bpm:120});};
 const advance=async(from,to,options={})=>{for(let t=from+.125;t<=to+.0001;t+=.125)await tick({time:t,paused:false,energy:0,bpm:120,...options});};
 await expect(page.getByRole('button',{name:'Load 3D FORM (Preview)',exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Load 3D VOXEL (Preview)',exact:true})).toHaveCount(0);
 for(const [kind,patterns]of Object.entries(names)){
  console.log('Checking',kind);await api('switch',kind);await ready();await api('bind',0,1);await ready();
  const before=await api('status');assert.equal(before.values['user-model-'+kind+'-pattern-change'],false);
  await expect(page.getByRole('combobox',{name:'Trigger',exact:true})).toHaveCount(0);
  await page.getByRole('switch',{name:'Pattern Change',exact:true}).click();await settle();await page.getByRole('combobox',{name:'Trigger',exact:true}).click();await expect(page.getByRole('option')).toHaveCount(11);await page.keyboard.press('Escape');await page.getByRole('switch',{name:'Pattern Change',exact:true}).click();await settle();
  await set('reactivity',0);await set('speed',1);await set('movement',.35);
  const frames=[];
  for(let i=0;i<patterns.length;i++){
   await set('pattern',patterns[i]);await rewind();const solid=await shot(kind+'-solid-'+i);
   await advance(0,4);const peak=await shot(kind+'-pattern-'+i);frames.push(peak);
   assert(await diff(solid,peak)>.025,kind+' must transform the actual model: '+patterns[i]);
   await advance(4,8);const restored=await shot(kind+'-restored-'+i);
   assert(await diff(solid,restored)<await diff(solid,peak),kind+' must restore the original pose: '+patterns[i]);
   if(i===0){representations.push(peak);await writeFile(path.join(output,kind+'-default.png'),peak);}
  }
  if(!process.argv.includes('--controls-only'))for(let i=0;i<frames.length;i++)for(let j=i+1;j<frames.length;j++)assert(await diff(frames[i],frames[j])>.025,kind+' patterns '+i+'/'+j+' must differ visibly');
  await set('pattern',patterns[0]);await rewind();await advance(0,4);const quiet=await image();
  await set('reactivity',1);await tick({time:4.125,paused:false,energy:1,event:'kick',eventId:11});assert(await diff(quiet,await image())>.025,kind+' must respond to a musical accent');
  await api('bind',1,1);await ready();const other=await image();await api('bind',0,1);await ready();assert(await diff(other,await image())>.1,kind+' must switch to the selected model');assert.equal((await api('status')).cache.heldCount,1);
  for(const quality of ['performance','balanced','quality']){await set('quality',quality);await ready();assert.equal((await api('status')).modules.failedModuleCount,0);}
  await set('pattern',patterns[1]);await api('save');await api('reenter');await ready();assert.equal((await api('status')).values['user-model-'+kind+'-pattern'],patterns[1]);
  checks.push(kind+': intact model, all six transformations, reassembly, musical accent, model switching, quality and persistence');
 }
 for(let i=0;i<representations.length;i++)for(let j=i+1;j<representations.length;j++)assert(await diff(representations[i],representations[j])>.1,'Effect representations must be distinct');
 await api('switch','shatter');await ready();await api('save');await page.reload();await page.waitForFunction(()=>!!globalThis.review);await ready();assert.equal((await api('status')).values['user-model-shatter-model'],'user-model:c0000000-0000-4000-8000-000000000001:1');
 await api('deleted');for(let i=0;i<25;i++)await tick();assert((await api('status')).modules.modules.flatMap(m=>m.diagnostics).some(d=>d.code==='CINEMA2_USER_MODEL_MISSING'));assert.equal((await api('status')).cache.heldCount,0);checks.push('missing private model falls back inside the existing scene');
 assert.deepEqual(await api('stop'),{entryCount:0,heldCount:0});if(process.argv.includes('--thumbnails'))for(const kind of Object.keys(names))await sharp(path.join(output,kind+'-default.png')).resize(640,480).webp({quality:85}).toFile(path.join(root,'public/preset-artwork/drmvyz.cinema2.user-model-'+kind+'.webp')); assert.deepEqual(errors,[]);await writeFile(path.join(output,process.argv.includes('--controls-only')?'controls-result.json':'result.json'),JSON.stringify({passed:true,checks,metrics,captures,errors,cloudEndToEnd:'pending; remote repository/Auth fixture only'},null,2));console.log('Four preview validation passed',output);
}catch(error){if(page){await page.screenshot({path:path.join(output,'failure.png')});await writeFile(path.join(output,'failure.html'),await page.content());console.error(JSON.stringify(await page.evaluate(()=>globalThis.review?.status()),null,2));}throw error;}finally{await browser?.close();await server.close();}

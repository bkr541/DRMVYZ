import {createServer} from 'vite'
import {chromium} from '@playwright/test'
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
const output='artifacts/conduit-wordmark-model-viewer'
const entry=`
import React from 'react';import {createRoot} from 'react-dom/client';
import {VyzualzView} from '/src/components/vyzualz/VyzualzView.tsx';
import {AudioEngineProvider} from '/src/context/AudioEngineContext.tsx';
import {useMediaStore} from '/src/stores/mediaStore.ts';import {useAudioStore} from '/src/stores/audioStore.ts';
import {modelAssetRepository} from '/src/features/models/data/modelAssetRepository.ts';import {useModelEditorStore} from '/src/features/models/state/modelEditorStore.ts';
import '/src/styles.css';import '/src/styles/analyzer.css';import '/src/styles/appearance.css';import '/src/styles/groupSpacing.css';import '/src/styles/vyzualz.css';import '/src/styles/mediaManager.css';import '/src/styles/workspaceShell.css';import '/src/styles/floatingWorkspace.css';import '/src/styles/tabRows.css';import '/src/styles/typography.css';
useMediaStore.setState({accountId:'a0000000-0000-4000-8000-000000000001',items:[],queryItemIds:[],storageAvailable:true,authRequired:false,loading:false,invalidated:false,hasMore:false,collections:[],loadFromSupabase:async()=>{},loadCollections:async()=>{},setLibraryQuery:()=>{},ensureLibraryLoaded:async()=>{},ensureMediaSigned:async()=>{},refreshLibrary:async()=>{}});
useAudioStore.setState({savedTracks:[],loading:false,loadSavedTracks:async()=>{}});modelAssetRepository.list=async()=>({items:[],nextCursor:null});
globalThis.wordmarkReview={state:()=>{const s=useModelEditorStore.getState();return {status:s.status,error:s.error,name:s.name,stats:s.model?.stats,dirty:s.dirty}},reset:()=>useModelEditorStore.getState().reset()};
createRoot(document.getElementById('root')).render(React.createElement(AudioEngineProvider,null,React.createElement(VyzualzView,{initialAppView:'media',activeView:'vyzualz',onNavigate:()=>{}})));
`
const server=await createServer({configFile:false,root:process.cwd(),resolve:{dedupe:['react','react-dom']},esbuild:{jsx:'automatic'},define:{'import.meta.env.VITE_SUPABASE_URL':JSON.stringify(''),'import.meta.env.VITE_SUPABASE_ANON_KEY':JSON.stringify('')},server:{host:'127.0.0.1',port:0,hmr:false,watch:null},plugins:[{name:'wordmark-review',resolveId:id=>id==='/wordmark-review.tsx'?'\0wordmark-review.tsx':undefined,load:id=>id==='\0wordmark-review.tsx'?entry:undefined,configureServer(s){s.middlewares.use((req,res,next)=>{if(req.url!=='/wordmark-review.html'){next();return}res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><style>html,body,#root{height:100%;margin:0}</style></head><body><div id="root"></div><script type="module" src="/wordmark-review.tsx"></script></body></html>')})}}]})
await mkdir(output,{recursive:true});await server.listen();const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']})
try {
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/wordmark-review.html`)
 await page.getByRole('tab',{name:'3D Models',exact:true}).click()
 await page.getByRole('button',{name:'Select 3D model DVYDRM Wordmark',exact:true}).click()
 await page.waitForFunction(()=>globalThis.wordmarkReview.state().status==='ready',{}, {timeout:60000})
 const state=await page.evaluate(()=>globalThis.wordmarkReview.state());assert.equal(state.dirty,false);assert.equal(state.stats.triangles,57882)
 const viewport=page.getByRole('img',{name:'3D model viewport',exact:true});await viewport.waitFor();await page.waitForTimeout(300)
 await page.screenshot({path:`${output}/wordmark.png`});const before=await viewport.screenshot()
 const box=await viewport.boundingBox();assert(box.width>300&&box.height>300,'The wordmark must have a usable visible viewport');await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.7,box.y+box.height*.6,{steps:12});await page.mouse.up();await page.waitForTimeout(150)
 assert.notDeepEqual(await viewport.screenshot(),before,'Orbit changes the 3D view')
 await page.getByRole('button',{name:'Fit Model',exact:true}).click();await page.getByRole('button',{name:'Reset Camera',exact:true}).click()
 assert(await page.getByRole('button',{name:'Save Changes',exact:true}).isDisabled());assert(await page.getByRole('button',{name:'Delete Media',exact:true}).isDisabled());assert.equal(await page.getByRole('button',{name:'Regenerate 3D Model',exact:true}).count(),0)
 await page.evaluate(()=>globalThis.wordmarkReview.reset());assert.deepEqual(errors,[])
 await writeFile(`${output}/report.json`,JSON.stringify({state,orbit:true,fit:true,reset:true,viewOnly:true,errors},null,2)+'\n');console.log('Conduit wordmark: model library selection, original GLB, orbit, fit/reset and view-only controls passed.')
} finally {await browser.close();await server.close()}

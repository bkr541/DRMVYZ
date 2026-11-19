import {createServer} from 'vite'
import {chromium} from '@playwright/test'
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
const output='artifacts/conduit-wordmark-model-viewer'
const thumbnailUrl='/cinema2/models/conduit-wordmark-thumbnail.webp'
const entry=`
import React from 'react';import {createRoot} from 'react-dom/client';
import {VyzualzView} from '/src/components/vyzualz/VyzualzView.tsx';
import {AudioEngineProvider} from '/src/context/AudioEngineContext.tsx';
import {useMediaStore} from '/src/stores/mediaStore.ts';import {useAudioStore} from '/src/stores/audioStore.ts';
import {modelAssetRepository} from '/src/features/models/data/modelAssetRepository.ts';import {useModelEditorStore} from '/src/features/models/state/modelEditorStore.ts';
import {captureModelPreview} from '/src/features/models/state/modelViewportBridge.ts';
import '/src/styles.css';import '/src/styles/analyzer.css';import '/src/styles/appearance.css';import '/src/styles/groupSpacing.css';import '/src/styles/vyzualz.css';import '/src/styles/mediaManager.css';import '/src/styles/workspaceShell.css';import '/src/styles/floatingWorkspace.css';import '/src/styles/tabRows.css';import '/src/styles/typography.css';
useMediaStore.setState({accountId:'a0000000-0000-4000-8000-000000000001',items:[],queryItemIds:[],storageAvailable:true,authRequired:false,loading:false,invalidated:false,hasMore:false,collections:[],loadFromSupabase:async()=>{},loadCollections:async()=>{},setLibraryQuery:()=>{},ensureLibraryLoaded:async()=>{},ensureMediaSigned:async()=>{},refreshLibrary:async()=>{}});
useAudioStore.setState({savedTracks:[],loading:false,loadSavedTracks:async()=>{}});modelAssetRepository.list=async()=>({items:[],nextCursor:null});
modelAssetRepository.getBuiltinOrganization=async()=>({tags:[],collectionIds:[]});
modelAssetRepository.updateBuiltinOrganization=async(_id,organization)=>organization;
async function captureThumbnail() {
  const {group} = useModelEditorStore.getState().model
  const bitmap = await createImageBitmap(await captureModelPreview(group, undefined, 768))
  const source = document.createElement('canvas')
  source.width = bitmap.width; source.height = bitmap.height
  const ctx = source.getContext('2d')
  ctx.drawImage(bitmap, 0, 0); bitmap.close()
  const {data} = ctx.getImageData(0, 0, source.width, source.height)
  let left = source.width, right = -1, top = source.height, bottom = -1
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      const i = (y * source.width + x) * 4
      if (Math.max(Math.abs(data[i] - data[0]), Math.abs(data[i + 1] - data[1]), Math.abs(data[i + 2] - data[2])) <= 5) continue
      left = Math.min(left, x); right = Math.max(right, x)
      top = Math.min(top, y); bottom = Math.max(bottom, y)
    }
  }
  if (right < left || bottom < top) throw new Error('The wordmark capture is blank.')
  const thumbnail = document.createElement('canvas')
  thumbnail.width = 480; thumbnail.height = 288
  const output = thumbnail.getContext('2d')
  output.fillStyle = '#10181d'; output.fillRect(0, 0, thumbnail.width, thumbnail.height)
  const width = right - left + 1, height = bottom - top + 1
  const scale = Math.min((thumbnail.width - 38) / width, (thumbnail.height - 30) / height)
  output.drawImage(source, left, top, width, height, (thumbnail.width - width * scale) / 2, (thumbnail.height - height * scale) / 2, width * scale, height * scale)
  const blob = await new Promise(resolve => thumbnail.toBlob(resolve, 'image/webp', .94))
  if (blob?.type !== 'image/webp') throw new Error('Could not encode the wordmark thumbnail.')
  return Array.from(new Uint8Array(await blob.arrayBuffer()))
}
globalThis.wordmarkReview={state:()=>{const s=useModelEditorStore.getState();return {status:s.status,error:s.error,name:s.name,stats:s.model?.stats,dirty:s.dirty}},captureThumbnail,reset:()=>useModelEditorStore.getState().reset()};
createRoot(document.getElementById('root')).render(React.createElement(AudioEngineProvider,null,React.createElement(VyzualzView,{initialAppView:'media',activeView:'vyzualz',onNavigate:()=>{}})));
`
const server=await createServer({configFile:false,root:process.cwd(),resolve:{dedupe:['react','react-dom']},esbuild:{jsx:'automatic'},define:{'import.meta.env.VITE_SUPABASE_URL':JSON.stringify(''),'import.meta.env.VITE_SUPABASE_ANON_KEY':JSON.stringify('')},server:{host:'127.0.0.1',port:0,hmr:false,watch:null},plugins:[{name:'wordmark-review',resolveId:id=>id==='/wordmark-review.tsx'?'\0wordmark-review.tsx':undefined,load:id=>id==='\0wordmark-review.tsx'?entry:undefined,configureServer(s){s.middlewares.use((req,res,next)=>{if(req.url!=='/wordmark-review.html'){next();return}res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><style>html,body,#root{height:100%;margin:0}</style></head><body><div id="root"></div><script type="module" src="/wordmark-review.tsx"></script></body></html>')})}}]})
await mkdir(output,{recursive:true});await server.listen();const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']})
try {
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/wordmark-review.html`,{waitUntil:'commit'})
 await page.getByRole('tab',{name:'3D Models',exact:true}).click()
 const card=page.getByRole('button',{name:'Select 3D model DVYDRM Wordmark',exact:true})
 await card.click()
 await page.waitForFunction(()=>globalThis.wordmarkReview.state().status==='ready',{}, {timeout:60000})
 const state=await page.evaluate(()=>globalThis.wordmarkReview.state());assert.equal(state.dirty,false);assert.equal(state.stats.triangles,57882)
 const viewport=page.getByRole('img',{name:'3D model viewport',exact:true});await viewport.waitFor();await page.waitForTimeout(300)
 const inspector=page.getByRole('tablist',{name:'Media Manager inspector tabs'})
 assert.equal(await inspector.getByRole('tab',{name:'Info',exact:true}).getAttribute('aria-selected'),'true')
 for (const tab of ['Edit','Output']) {
   await inspector.getByRole('tab',{name:tab,exact:true}).click()
   assert.equal(await page.getByLabel('Tags',{exact:true}).count(),0)
 }
 await inspector.getByRole('tab',{name:'Info',exact:true}).click()
 const tags=page.getByLabel('Tags',{exact:true})
 await tags.fill('Wordmark')
 await tags.press('Enter')
 await page.getByRole('button',{name:'Save Changes',exact:true}).click()
 await page.waitForFunction(()=>!globalThis.wordmarkReview.state().dirty)
 if (process.argv.includes('--write-thumbnail')) {
   const bytes=Buffer.from(await page.evaluate(()=>globalThis.wordmarkReview.captureThumbnail()))
   await writeFile(`public${thumbnailUrl}`,bytes)
   // The running Vite server may not know about a newly created public file.
   await page.route(`**${thumbnailUrl}*`,route=>route.fulfill({body:bytes,contentType:'image/webp'}))
   await card.locator('img').evaluate((image,url)=>{ image.src = url + '?generated=1' },thumbnailUrl)
 }
 await card.locator('img').evaluate(image=>image.decode())
 const thumbnail=await card.locator('img').boundingBox()
 assert(thumbnail.width>=115&&thumbnail.height>70,'The model card should display a large thumbnail.')
 await page.screenshot({path:`${output}/wordmark.png`});const before=await viewport.screenshot()
 await page.getByRole('region',{name:'3D Models',exact:true}).getByRole('button',{name:'List view',exact:true}).click()
 const listThumbnail=await card.locator('img').boundingBox()
 assert(listThumbnail.width>=90&&listThumbnail.height>60,'List view should also display a large thumbnail.')
 await page.getByRole('tab',{name:'All Visuals',exact:true}).click()
 await card.locator('img').evaluate(image=>image.decode())
 const box=await viewport.boundingBox();assert(box.width>300&&box.height>300,'The wordmark must have a usable visible viewport');await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.7,box.y+box.height*.6,{steps:12});await page.mouse.up();await page.waitForTimeout(150)
 assert.notDeepEqual(await viewport.screenshot(),before,'Orbit changes the 3D view')
 await page.getByRole('button',{name:'Fit Model',exact:true}).click();await page.getByRole('button',{name:'Reset Camera',exact:true}).click()
 assert(await page.getByRole('button',{name:'Save Changes',exact:true}).isDisabled());assert(await page.getByRole('button',{name:'Delete Media',exact:true}).isDisabled());assert.equal(await page.getByRole('button',{name:'Regenerate 3D Model',exact:true}).count(),0)
 await page.evaluate(()=>globalThis.wordmarkReview.reset());assert.deepEqual(errors,[])
 await writeFile(`${output}/report.json`,JSON.stringify({state,thumbnail:{grid:thumbnail,list:listThumbnail},orbit:true,fit:true,reset:true,viewOnly:true,errors},null,2)+'\n');console.log('Conduit wordmark: grid and list thumbnails, original GLB, orbit, fit/reset and view-only controls passed.')
} finally {await browser.close();await server.close()}

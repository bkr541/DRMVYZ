import { build, Platform, Arch } from 'electron-builder'
import { _electron, expect } from '@playwright/test'
import { readFile, writeFile, stat, readdir, mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import assert from 'node:assert/strict'
import { listPackage, extractFile } from '@electron/asar'
const root=process.cwd(),output=path.resolve('artifacts/model-release-phase07'),require=createRequire(import.meta.url)
const pkg=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'))
const distribution=process.env.DRMVYZ_MODEL_ELECTRON_DISTRIBUTION
const packageOutput=process.env.DRMVYZ_MODEL_PACKAGE_OUTPUT
if(!distribution||!packageOutput)throw new Error('Set DRMVYZ_MODEL_ELECTRON_DISTRIBUTION and a disposable DRMVYZ_MODEL_PACKAGE_OUTPUT outside installed apps.')
await mkdir(output,{recursive:true})
// Use the project's actual builder configuration, main, preload and native code.
// This is an unsigned directory package, never a publish or notarization operation.
await build({projectDir:root,targets:Platform.MAC.createTarget(['dir'],Arch.arm64),publish:'never',config:{...pkg.build,electronDist:path.resolve(distribution),electronVersion:require('electron/package.json').version,npmRebuild:false,directories:{...pkg.build.directories,output:path.resolve(packageOutput)},mac:{...pkg.build.mac,identity:null}}})
const appDir=path.join(packageOutput,'mac-arm64',pkg.build.productName+'.app'),resources=path.join(appDir,'Contents/Resources'),asar=path.join(resources,'app.asar')
const entries=listPackage(asar),models=entries.filter(name=>/vtracer|\.wasm$|user-model-.*\.webp$|model-generator\.js$/.test(name))
assert(entries.includes('/dist/assets/model-generator.js'))
assert(entries.some(name=>name.endsWith('.wasm')))
for(const kind of ['form','shatter','dust','hologram','slices','voxel'])assert(entries.includes('/dist/preset-artwork/drmvyz.cinema2.user-model-'+kind+'.webp'))
assert(entries.includes('/dist/models/vtracer/LICENSE.txt'))
const pages=[],errors=[]
let app
try{
 app=await _electron.launch({executablePath:path.join(appDir,'Contents/MacOS',pkg.build.productName),timeout:45000,args:['--user-data-dir='+path.join(packageOutput,'smoke-user-data'),'--enable-webgl','--ignore-gpu-blocklist']})
 assert.equal(await app.evaluate(({app})=>app.isPackaged),true)
 const page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));await page.waitForURL('drmvyz-app://app/index.html');await expect(page.getByText('Supabase not configured')).toBeVisible({timeout:30000});pages.push('actual product main/preload/protocol boot')
 const engine=await page.evaluate(async()=>{
  const module=await import('/assets/model-generator.js'),recipe=module.createDefaultModelRecipe();const canvas=globalThis.document.createElement('canvas');canvas.width=canvas.height=32;const ctx=canvas.getContext('2d');ctx.clearRect(0,0,32,32);ctx.fillStyle='#111';ctx.fillRect(4,4,24,24);ctx.clearRect(12,12,8,8);const source=await new Promise(r=>canvas.toBlob(r,'image/png'));
  recipe.materials[0]={region:'front',...module.MODEL_MATERIAL_PRESETS.Gold};const artifact=await module.createModelArtifact({source,recipe});
  const bytes=await artifact.glb.arrayBuffer(),header=new DataView(bytes);if(header.getUint32(0,true)!==0x46546c67)throw new Error('Not GLB');const result={triangles:artifact.stats.triangles,glbBytes:bytes.byteLength,traceBytes:artifact.traceSvg.length,sourceBytes:artifact.sourceSnapshot.size};artifact.dispose();return result;
 });assert(engine.triangles>0&&engine.traceBytes>0);pages.push('packaged VTracer worker/WASM and GLB round trip')
 await page.screenshot({path:path.join(output,'packaged-product-boot.png')})
 assert.deepEqual(errors,[])
 async function size(dir){let bytes=0;for(const e of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())bytes+=await size(p);else if(e.isFile())bytes+=(await stat(p)).size;}return bytes;}
 const record={passed:true,unsigned:true,installer:false,appDir,appBytes:await size(appDir),asarBytes:(await stat(asar)).size,modelEngineEntryBytes:extractFile(asar,'dist/assets/model-generator.js').length,modelRelatedPackagedFiles:models,engine,checks:pages,errors}
 await writeFile(path.join(output,'desktop-package.json'),JSON.stringify(record,null,2));console.log('Desktop directory package smoke passed',JSON.stringify({appBytes:record.appBytes,asarBytes:record.asarBytes,engine}))
}finally{await app?.close()}

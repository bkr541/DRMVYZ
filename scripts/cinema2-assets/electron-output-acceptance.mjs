#!/usr/bin/env node
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import os from 'node:os'
const root=resolve(import.meta.dirname,'../..'),dir=join(root,'artifacts/cinema2-electron-output');await mkdir(dir,{recursive:true});const out=await mkdtemp(join(dir,'run-'))
const report={schemaVersion:1,environment:{platform:os.platform(),osRelease:os.release(),arch:os.arch(),cpu:os.cpus()[0]?.model},gates:{electronPreview:'not-run',electronFullscreen:'not-run',casting:'not-run',externalCasting:'not-run',hardwareTiming:'not-run',humanVisual:'pending'},checks:[],blockers:[]}
let app
const check=(name,evidence)=>report.checks.push({name,...evidence})
try{
  if(process.env.STAGELESS_QA07_ELECTRON!=='1'||!process.env.STAGELESS_QA07_DISPLAY)throw Error('Opt-in and explicit local display name required')
  const {_electron,expect}=await import('@playwright/test')
  app=await _electron.launch({args:[root,'--production'],cwd:root,timeout:60000})
  const page=await app.firstWindow();report.environment.electron=await app.evaluate(({app})=>app.getVersion());report.environment.displays=await app.evaluate(({screen})=>screen.getAllDisplays().map(d=>({bounds:d.bounds,scaleFactor:d.scaleFactor,refreshHz:d.displayFrequency})))
  // Operator logs into the approved development profile and starts a Cinema 2.0 fixture using the real UI. No token injection or test renderer.
  console.log('In STAGELESS, open React, select a reviewed Cinema 2.0 preset, and start playback. The smoke test waits for the cast control.')
  const cast=page.getByRole('button',{name:'Cast visual output',exact:true})
  await expect(cast).toBeVisible({timeout:180000});await expect(page.locator('.rv-canvas-wrap canvas').first()).toBeVisible();
  if(process.env.STAGELESS_QA07_READY_WAIT_MS)await new Promise(r=>setTimeout(r,Math.min(180000,Number(process.env.STAGELESS_QA07_READY_WAIT_MS)||0)))
  const errors=[];page.on('pageerror',()=>errors.push('Uncaught renderer error'));page.on('console',m=>{if(/GL_INVALID|WebGL.*error|context bound exceeded/i.test(m.text()))errors.push('GL/context error')})
  const stage=page.locator('[data-cinema2-stage=runtime]');await expect(stage).toHaveAttribute('data-runtime-phase','running',{timeout:30000});await expect(stage.locator('canvas[data-cinema2-output-canvas]')).toHaveCount(1)
  const selectPreset=async key=>{const card=page.locator(`[data-cinema2-preset-id="drmvyz.cinema2.${key}"]`);await card.click();await expect(card).toHaveAttribute('aria-pressed','true');await expect(stage).toHaveAttribute('data-runtime-phase','running');await expect(stage.locator('canvas[data-cinema2-output-canvas]')).toHaveCount(1)}
  await selectPreset('spectrum')
  const sampleCanvas=async locator=>locator.evaluate(async c=>{const hashes=[];for(let i=0;i<4;i++){await new Promise(r=>setTimeout(r,200));const sample=document.createElement('canvas');sample.width=32;sample.height=18;const ctx=sample.getContext('2d');ctx.drawImage(c,0,0,32,18);const data=ctx.getImageData(0,0,32,18).data;let hash=2166136261;for(const n of data)hash=Math.imul(hash^n,16777619);hashes.push(hash)}return {width:c.width,height:c.height,distinct:new Set(hashes).size}})
  const modeTests=[['Window: Standard movable output window','16:9',16/9],['Full Screen: Take over the selected screen','9:16',9/16],['Window: Standard movable output window','16:9',16/9]]
  for(const [mode,aspect,ratio] of modeTests){
    await cast.click();await page.getByRole('button',{name:mode,exact:true}).click();await page.getByRole('button',{name:aspect,exact:true}).click();await page.getByRole('button',{name:'Local',exact:true}).click()
    const receiverPromise=app.waitForEvent('window',{timeout:30000});await page.getByRole('region',{name:'Local displays'}).getByRole('button',{name:process.env.STAGELESS_QA07_DISPLAY,exact:false}).click();const receiver=await receiverPromise
    const video=receiver.locator('video#output');await expect(video).toBeVisible({timeout:30000})
    await receiver.waitForFunction(()=>{const v=document.querySelector('video');return v&&v.videoWidth>0&&v.readyState>=2},{},{timeout:30000})
    const receive=()=>video.evaluate(async v=>{const first=v.getVideoPlaybackQuality().totalVideoFrames;await new Promise(r=>setTimeout(r,2000));return {frames:v.getVideoPlaybackQuality().totalVideoFrames-first,width:v.videoWidth,height:v.videoHeight}})
    const received=await receive()
    if(received.frames<2||Math.abs(received.width/received.height-ratio)>.03)throw Error('Receiver frame delivery or aspect failed')
    const handle=await app.browserWindow(receiver);let windowState
    try{await expect.poll(()=>handle.evaluate(w=>w.isFullScreen()),{timeout:15000}).toBe(mode.startsWith('Full Screen'));windowState=await handle.evaluate(w=>({fullscreen:w.isFullScreen(),bounds:w.getBounds()}))}finally{await handle.dispose()}
    if(windowState.fullscreen!==mode.startsWith('Full Screen'))throw Error('Output window fullscreen state mismatch')
    await page.bringToFront();await page.getByRole('button',{name:'Show cast preview'}).click();const preview=page.getByRole('dialog',{name:'Cast preview'}).locator('canvas');await expect(preview).toBeVisible();const pixels=await sampleCanvas(preview);if(pixels.distinct<2)throw Error('Cast preview pixels did not advance')
    await page.getByRole('button',{name:'Close cast preview'}).click();await expect(preview).toHaveCount(0)
    let switched=null
    if(!mode.startsWith('Full Screen')){await selectPreset('honey');switched=await receive();if(switched.frames<2)throw Error('Receiver stopped after preset switch');await selectPreset('spectrum');await expect(stage).toHaveAttribute('data-runtime-phase','running')}
    const stop=page.getByRole('button',{name:'Stop Output'});if(!await stop.isVisible())await page.getByRole('button',{name:/Output casting to/}).click();await stop.click();await expect(cast).toBeVisible({timeout:30000});await expect(page.getByRole('button',{name:'Show cast preview'})).toHaveCount(0)
    await expect.poll(()=>receiver.isClosed(),{timeout:30000}).toBe(true)
    check(mode,{aspect,received,windowState,pixels,switched,stopped:true})
  }
  if(errors.length)throw Error('Renderer/GL errors observed')
  report.gates.electronPreview='pass';report.gates.electronFullscreen='pass';report.gates.casting='pass'
}catch(error){report.blockers.push(error?.code??error?.name??'Error');report.reason=app?'Production UI/output checks did not complete; inspect local app without sharing credentials.':'Electron launch or prerequisites unavailable.';if(app){for(const gate of ['electronPreview','electronFullscreen','casting'])report.gates[gate]='incomplete'}}
finally{await app?.close();await writeFile(join(out,'manifest.json'),JSON.stringify(report,null,2)+'\n');console.log(`Electron output evidence: ${out}`)}
process.exitCode=report.gates.casting==='pass'?0:1

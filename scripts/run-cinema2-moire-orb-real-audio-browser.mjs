import assert from 'node:assert/strict'
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {execFileSync} from 'node:child_process'
import {chromium} from '@playwright/test'
const source=process.env.MOIRE_ORB_REFERENCE_VIDEO??'/Users/kodyrobinson/Desktop/Bass_Sigil_Ref.mov'
const pcm='/tmp/moire-orb-reference-pcm.wav',output='artifacts/cinema2-moire-orb/real-audio'
execFileSync('ffmpeg',['-v','error','-i',source,'-vn','-af','volume=32dB','-t','12','-ar','48000','-ac','2','-y',pcm])
await mkdir(output,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']})
try {
 const page=await browser.newPage({viewport:{width:640,height:360}}),errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 await page.goto(`${process.env.PLAYWRIGHT_BASE_URL??'http://127.0.0.1:5173'}/src/test/browser/cinema2-moire-orb.html?quality=low`)
 await page.waitForFunction(()=>globalThis.moireOrbReview?.snapshot().modules.modules[0]?.inspection?.state==='ready',{}, {timeout:90000})
 await page.evaluate(async()=>{await globalThis.moireOrbReview.set('cameraMode','manual');await globalThis.moireOrbReview.set('reactivity',1)})
 await page.evaluate(encoded=>globalThis.moireOrbReview.playAudio(encoded),(await readFile(pcm)).toString('base64'))
 const frames=[]
 for(let i=0;i<10;i++){await page.waitForTimeout(500);frames.push(await page.evaluate(()=>globalThis.moireOrbReview.snapshot()))}
 assert(frames.at(-1).pump.sampleCount>10,'The canonical analyzer pump must sample actual soundtrack PCM')
 assert(frames.some(f=>f.live.motionRate>1.0001),'Real soundtrack energy must reach the actual rendered motion-rate target')
 assert(frames.some(f=>f.live.coreScale<.99999),'Real soundtrack bass must reach the actual source-orb compression target')
 assert(frames.every(f=>f.render.failedPassCount===0&&f.modules.failedModuleCount===0&&f.effects.failedEffectCount===0))
 await page.screenshot({path:`${output}/source-soundtrack.png`})
 await page.evaluate(()=>globalThis.moireOrbReview.stopAudio())
 const retired=await page.evaluate(()=>globalThis.moireOrbReview.dispose());assert.equal(retired.activeLeaseCount,0);assert.equal(retired.activeSurfaceCount,0)
 assert.deepEqual(errors,[])
 await writeFile(`${output}/report.json`,JSON.stringify({source,testOnlyGainDb:32,route:'WebAudio PCM -> canonical MusicIntelligenceAnalyserFramePump -> AudioFeatureBus -> persistent Cinema2AudioIntelligenceBridge -> Choreography -> native renderer',frames:frames.map(f=>({audio:f.audio.upstream,live:f.live,pump:f.pump})),retired,errors,limitation:'Source-soundtrack integration proof; not representative whole-song or human musicality acceptance.'},null,2)+'\n')
 console.log('Moire Orb: actual source soundtrack reaches shared energy/bass and native rendered targets; cleanup passed.')
} finally {await browser.close()}

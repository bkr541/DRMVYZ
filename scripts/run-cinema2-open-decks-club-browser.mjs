/* global openDecksReview */
// Run against Vite: verifies the production audio-intelligence club reveal.
import assert from 'node:assert/strict'
import {chromium} from '@playwright/test'
import {mkdir} from 'node:fs/promises'
await mkdir('artifacts/cinema2-open-decks', {recursive:true})
const browser=await chromium.launch({args:['--enable-unsafe-swiftshader']})
try {
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173'}/src/test/browser/cinema2-open-decks.html?audio`)
 await page.waitForFunction(()=>globalThis.openDecksReview?.snapshot().modules.estimatedGpuBytes>0)
 await page.waitForTimeout(8000)
 await page.evaluate(()=>{openDecksReview.set('auto-performance',true);openDecksReview.music()})
 let f=await page.evaluate(()=>openDecksReview.snapshot().runtime.frameCount)
 await page.waitForFunction(f=>openDecksReview.snapshot().runtime.frameCount>=f+10,f)
 const baseline=await page.evaluate(()=>openDecksReview.snapshot().camera)
 await page.evaluate(()=>openDecksReview.drop())
 f=await page.evaluate(()=>openDecksReview.snapshot().runtime.frameCount)
 await page.waitForFunction(f=>openDecksReview.snapshot().runtime.frameCount>=f+27,f,{timeout:90000})
 const dip=await page.evaluate(()=>openDecksReview.snapshot().camera)
 const angle=c=>Math.atan2(c.position[1]-c.target[1],Math.hypot(c.position[0]-c.target[0],c.position[2]-c.target[2]))*180/Math.PI
 assert(angle(dip)<angle(baseline)-10,JSON.stringify({baseline,dip}))
 await page.screenshot({path:'artifacts/cinema2-open-decks/audio-club-reveal.png'})
 await page.waitForFunction(f=>openDecksReview.snapshot().runtime.frameCount>=f+160,f,{timeout:90000})
 const recovered=await page.evaluate(()=>openDecksReview.snapshot().camera)
 assert(Math.abs(angle(recovered)-30)<1)
 assert.deepEqual(errors,[])
 const resources=await page.evaluate(()=>openDecksReview.dispose());assert.equal(resources.activeLeaseCount,0);assert.equal(resources.activeSurfaceCount,0)
 console.log(JSON.stringify({baseline:angle(baseline),dip:angle(dip),recovered:angle(recovered),errors,resources}))
} finally {await browser.close()}

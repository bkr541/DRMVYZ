// Focused acceptance for the original sphere's camera and independent logo motion.
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {chromium} from '@playwright/test'
import sharp from 'sharp'
const output='artifacts/cinema2-bass-sigil/orbit'
await mkdir(output,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']})
try {
 const page=await browser.newPage({viewport:{width:960,height:540}}),errors=[]
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
 await page.goto(`${process.env.PLAYWRIGHT_BASE_URL??'http://127.0.0.1:5173'}/src/test/browser/cinema2-bass-sigil.html`)
 await page.waitForFunction(()=>globalThis.bassSigilReview?.snapshot().modules.estimatedGpuBytes>0,{}, {timeout:90000})
 for(let i=0;i<80;i++){await page.waitForTimeout(250);const s=await sharp(await page.screenshot()).stats();if(s.channels[0].stdev>12)break}
 const set=async(n,v)=>assert((await page.evaluate(([n,v])=>globalThis.bassSigilReview.set(n,v),[n,v])).ok)
 const camera=()=>page.evaluate(()=>globalThis.bassSigilReview.snapshot().camera)
 await set('cameraMode','manual');await set('geometryMotion',false);await set('logoMotion',false)
 const views=[]
 for(const [name,heading,elevation]of [['front',0,0],['right',90,0],['rear',180,0],['left',-90,0],['above',30,75],['below',-30,-75]]) {
  await set('cameraHeading',heading);await set('cameraElevation',elevation)
  const c=await camera();assert(c.viewMatrix.every(Number.isFinite));assert(Math.abs(Math.hypot(...c.position)-11.2)<.01)
  await page.screenshot({path:`${output}/${name}.png`});views.push({name,heading,elevation,position:c.position})
 }
 await set('cameraHeading',0);await set('cameraElevation',0)
 const baseline=await page.screenshot()
 await set('logoHeading',45);await set('logoPitch',20);await set('logoRoll',12);const tilted=await page.screenshot({path:`${output}/logo-manual.png`});assert.notDeepEqual(tilted,baseline)
 for(const name of ['logoHeading','logoPitch','logoRoll'])await set(name,0)
 await set('logoMotion',true);await page.evaluate(()=>globalThis.bassSigilReview.timing({sourcePresent:true,paused:false}))
 const before=await page.screenshot();await page.evaluate(()=>globalThis.bassSigilReview.advance(2));const spun=await page.screenshot({path:`${output}/logo-moving.png`});assert.notDeepEqual(spun,before)
 // Isolate the logo: stopped environment and fixed camera above, then hard-off holds its manual pose.
 await set('logoMotion',false);const off=await page.screenshot();await page.evaluate(()=>globalThis.bassSigilReview.advance(.5));assert.deepEqual(await page.screenshot(),off)
 await set('cameraMode','omnidirectional');await set('cameraSpeed',2)
 const orbit=[]
 for(let i=0;i<9;i++){await page.evaluate(()=>globalThis.bassSigilReview.advance(2));const c=await camera();orbit.push(c.position);if(i%2===0)await page.screenshot({path:`${output}/orbit-${i}.png`})}
 assert(Math.max(...orbit.map(p=>p[1]))>6&&Math.min(...orbit.map(p=>p[1]))<-6,'Camera must travel above and below the original sphere')
 assert(Math.max(...orbit.map(p=>p[2]))>6&&Math.min(...orbit.map(p=>p[2]))<-6,'Camera must travel in front and behind')
 await set('cameraSpeed',0);const held=await camera();await page.evaluate(()=>globalThis.bassSigilReview.advance(.5));assert.deepEqual((await camera()).position,held.position)
 await set('cameraSpeed',1);await page.evaluate(()=>globalThis.bassSigilReview.timing({paused:true}));const paused=await camera();await page.evaluate(()=>globalThis.bassSigilReview.advance(.5));assert.deepEqual((await camera()).position,paused.position)
 await set('cameraMode','horizontal');await page.evaluate(()=>globalThis.bassSigilReview.timing({paused:false}));const horizontalA=await camera();await page.evaluate(()=>globalThis.bassSigilReview.advance(1));const horizontalB=await camera();assert.notDeepEqual(horizontalA.position,horizontalB.position);assert(Math.abs(horizontalB.position[1])<.01)
 await set('cameraMode','manual');await set('logoMotion',true)
 for(const[width,height]of [[720,720],[540,960]]){await page.setViewportSize({width,height});await page.waitForTimeout(200);await page.screenshot({path:`${output}/aspect-${width}x${height}.png`})}
 await page.setViewportSize({width:1280,height:1000});await page.evaluate(()=>globalThis.bassSigilReview.inspector(true));await page.waitForTimeout(200)
 for(const label of ['Camera Mode','Camera Heading','Camera Elevation','Logo Motion','Logo Spin Rate','Logo Sway'])assert(await page.getByText(label,{exact:true}).count()>0,label)
 await page.screenshot({path:`${output}/inspector.png`})
 const snap=await page.evaluate(()=>globalThis.bassSigilReview.snapshot());assert.equal(snap.modules.failedModuleCount,0);assert.equal(snap.render.failedPassCount,0);assert.deepEqual(errors,[])
 const resources=await page.evaluate(()=>globalThis.bassSigilReview.dispose());assert.equal(resources.activeLeaseCount,0);assert.equal(resources.activeSurfaceCount,0)
 await writeFile(`${output}/report.json`,JSON.stringify({views,orbit,errors,resources},null,2)+'\n')
 console.log('Bass Sigil: six manual directions, automatic 3D/horizontal orbit, independent logo movement, pause/hold and cleanup passed.')
}finally{await browser.close()}

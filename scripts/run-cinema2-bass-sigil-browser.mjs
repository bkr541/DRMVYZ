// P2 uses the real runtime/Inspector with a controlled transport, without audio analysis or choreography.
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {chromium} from '@playwright/test'
import sharp from 'sharp'
const output='artifacts/cinema2-bass-sigil/p2'
await mkdir(output,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']})
try {
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[]
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
  await page.goto(`${process.env.PLAYWRIGHT_BASE_URL??'http://127.0.0.1:5173'}/src/test/browser/cinema2-bass-sigil.html`)
  await page.waitForFunction(()=>globalThis.bassSigilReview?.snapshot().modules.estimatedGpuBytes>0,{}, {timeout:90000})
  let baseline
  for(let i=0;i<80;i++) {await page.waitForTimeout(500);baseline=await page.screenshot();const s=await sharp(baseline).stats();if(s.channels[0].max>160&&s.channels[0].stdev>12)break}
  await writeFile(`${output}/original-environment.png`,baseline)
  const snap=await page.evaluate(()=>globalThis.bassSigilReview.snapshot())
  assert.equal(snap.modules.failedModuleCount,0);assert.equal(snap.render.failedPassCount,0);assert.deepEqual(errors,[])
  if(!process.argv.includes('--preview')) {
    const set=async(name,value)=>assert((await page.evaluate(([n,v])=>globalThis.bassSigilReview.set(n,v),[name,value])).ok,`set ${name}`)
    await set('cameraMode','manual');await set('logoMotion',false) // Isolate the original geometry-control acceptance.
    const pixels=async()=>sharp(await page.screenshot()).removeAlpha().raw().toBuffer()
    const difference=(a,b)=>{let total=0;for(let i=0;i<a.length;i++)total+=Math.abs(a[i]-b[i]);return total/a.length}
    const report={controls:[],patterns:[],aspects:[]}
    const numeric=[['intensity',0,1,2],['motionRate',0,1,2],['geometryExtent',0,.35,1],['coreTravel',0,.25,1],['membraneScale',.65,1,1.4],['particleDensity',0,1,1],['tunnelDepth',.5,1,1.5],['heroScale',.75,1,1.15],['membraneOpacity',0,1,1],['glow',0,1,2]]
    await page.evaluate(()=>globalThis.bassSigilReview.timing({sourcePresent:true}))
    await page.evaluate(()=>globalThis.bassSigilReview.advance(.6))
    for(const [name,min,normal,max]of numeric) {
      await set('pattern',name==='geometryExtent'?'axial-pressure':'reference-vortex')
      await set(name,min);if(name==='motionRate')await page.evaluate(()=>globalThis.bassSigilReview.advance(.5));const a=await pixels()
      await set(name,normal);const b=await pixels()
      await set(name,max);if(name==='motionRate')await page.evaluate(()=>globalThis.bassSigilReview.advance(.5));const c=await pixels()
      const change=difference(a,c);assert(change>.008,`${name} has no perceptible min/max effect (${change})`)
      await page.screenshot({path:`${output}/control-${name}-max.png`});report.controls.push({name,min,normal,max,minMaxMeanPixelChange:change,defaultDelta:difference(a,b)})
      await set(name,normal)
    }
    for(const role of ['wordmark','edge','core','membrane','particles','background']) {
      const name=role==='background'?role:`${role}Color`,value=(snap.parameters.values??{})[`bass-sigil-${name}`]
      const a=await pixels();await set(name,[0,1,0,1]);const b=await pixels(),delta=difference(a,b)
      assert(delta>.002,`palette ${role} has no visible effect (${delta})`);report.controls.push({name,paletteDifference:delta})
      const fallback={wordmark:[0,0,0,1],edge:[.906,.906,.906,1],core:[1,0,0,1],membrane:[1,1,1,1],particles:[.36,.557,1,1],background:[0,0,0,1]}
      await set(name,value??fallback[role])
    }
    for(const pattern of ['reference-vortex','countercurrent','axial-pressure','orbital-weave','broken-crown','tidal-ribbon','lens-collapse','shock-bloom']) {
      await set('pattern',pattern);const a=await pixels();await page.evaluate(()=>globalThis.bassSigilReview.advance(.5));const b=await pixels()
      const delta=difference(a,b);assert(delta>.01,`${pattern} is static`);report.patterns.push({pattern,frameDifference:delta});await page.screenshot({path:`${output}/pattern-${pattern}.png`})
    }
    await set('geometryMotion',false);const frozen=await pixels();await page.evaluate(()=>globalThis.bassSigilReview.advance(.5));assert(difference(frozen,await pixels())<.01,'Geometry Motion OFF must hold')
    await set('geometryMotion',true);await page.evaluate(()=>globalThis.bassSigilReview.timing({paused:true}));const paused=await pixels();await page.evaluate(()=>globalThis.bassSigilReview.advance(.5));assert(difference(paused,await pixels())<.01,'Pause must freeze')
    await page.evaluate(()=>globalThis.bassSigilReview.timing({paused:false}));await set('pattern','reference-vortex')
    for(const[width,height]of [[960,720],[720,720],[540,960]]) {await page.setViewportSize({width,height});await page.waitForTimeout(250);await page.screenshot({path:`${output}/aspect-${width}x${height}.png`});report.aspects.push({width,height})}
    report.timing=[]
    const timingImages=[]
    for(const [sync,bpm,hostSync] of [[true,90,false],[true,180,true],[false,90,true],[false,180,false]]) {
      await set('bpmSync',sync);await page.evaluate(options=>{globalThis.bassSigilReview.timing(options);globalThis.bassSigilReview.restart()},{bpm,hostSync,sourcePresent:true,paused:false})
      await page.waitForFunction(()=>globalThis.bassSigilReview.snapshot().modules.estimatedGpuBytes>0,{}, {timeout:90000})
      for(let i=0;i<60;i++){await page.waitForTimeout(250);const s=await sharp(await page.screenshot()).stats();if(s.channels[0].stdev>12)break}
      await page.evaluate(()=>globalThis.bassSigilReview.advance(1));timingImages.push(await pixels());report.timing.push({sync,bpm,hostSync})
    }
    const syncedDifference=difference(timingImages[0],timingImages[1]),freeDifference=difference(timingImages[2],timingImages[3])
    assert(syncedDifference>.1,'BPM Sync ON must change rendered motion with tempo');assert(freeDifference<.02,`Sync OFF must ignore tempo and host toggle (${freeDifference})`)
    report.timingComparison={syncedDifference,freeDifference}
    await page.setViewportSize({width:1280,height:1000});await page.evaluate(()=>globalThis.bassSigilReview.inspector(true));await page.waitForTimeout(250)
    assert(await page.getByText('BPM Sync',{exact:true}).count()>0);assert(await page.getByText('Pattern',{exact:true}).count()>0)
    assert.equal(await page.getByText('Trigger',{exact:true}).count(),0);await set('patternChange',true);assert(await page.getByText('Trigger',{exact:true}).count()>0);await set('patternChange',false)
    await page.screenshot({path:`${output}/inspector.png`});await writeFile(`${output}/report.json`,JSON.stringify(report,null,2)+'\n')
  }
  assert.deepEqual(errors,[])
  const resources=await page.evaluate(()=>globalThis.bassSigilReview.dispose());assert.equal(resources.activeLeaseCount,0);assert.equal(resources.activeSurfaceCount,0)
  console.log('Bass Sigil: original asset, controls, native motion and clean disposal checked.')
} finally {await browser.close()}

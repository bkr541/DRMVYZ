import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {chromium} from '@playwright/test'
import sharp from 'sharp'
const out='artifacts/cinema2-beam-lattice-coverage';await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']})
const report={reference:'Reference_vid.mov',checks:0,worst:[],errors:[],failures:[]}
try{
 const page=await browser.newPage();page.on('pageerror',e=>report.errors.push(e.message))
 const set=(n,v)=>page.evaluate(([n,v])=>globalThis.beamLatticeReview.set(n,v),[n,v])
 const tileMinimum=async png=>{const {data,info}=await sharp(png).resize(256,144).removeAlpha().raw().toBuffer({resolveWithObject:true});let min=Infinity;for(let row=0;row<6;row++)for(let col=0;col<8;col++){if(row>=2&&row<=3&&col>=3&&col<=4)continue;let sum=0;for(let y=row*24;y<(row+1)*24;y++)for(let x=col*32;x<(col+1)*32;x++){const k=(y*256+x)*info.channels;sum+=.2126*data[k]+.7152*data[k+1]+.0722*data[k+2]}min=Math.min(min,sum/768)}return min}
 for(const [aspect,width,height]of [['wide',512,288],['square',384,384],['portrait',288,512]]){
  await page.setViewportSize({width,height})
  for(const pose of ['centre','min','max','cross']){
   await page.goto(`${process.env.PLAYWRIGHT_BASE_URL??'http://127.0.0.1:5174'}/src/test/browser/cinema2-beam-lattice.html?quality=medium&coveragePose=${pose}`);await page.waitForFunction(()=>globalThis.beamLatticeReview,{}, {timeout:10000});await page.waitForFunction(()=>globalThis.beamLatticeReview?.snapshot().modules.modules[0]?.inspection?.state==='ready',{}, {timeout:60000});await set('cameraMode','reference');await set('reactivity',0);await set('aperture',.65);await set('bankTravel',1.5);await set('cameraFov',158)
   for(const pattern of ['reference-fan','counter-sweep','iris-gate','scissor-cross','bank-relay','pressure-cage','radial-release']){
    await set('pattern',pattern)
    for(let sample=0;sample<12;sample++){
     const time=sample*10.416666984558105/12;await page.evaluate(t=>globalThis.beamLatticeReview.coverageAt(t),time)
     const png=await page.screenshot(),min=await tileMinimum(png),entry={aspect,pose,pattern,time,minTileLuma:min};report.checks++
     if(min<25){report.failures.push(entry);if(report.failures.length<=5)await writeFile(`${out}/failure-${report.failures.length}.png`,png);if(report.failures.length>=5)throw Error('Coverage regression: stopping after five failing frames')}
     if(report.worst.length<5||min<report.worst.at(-1).minTileLuma){report.worst.push(entry);report.worst.sort((a,b)=>a.minTileLuma-b.minTileLuma);report.worst=report.worst.slice(0,5);await writeFile(`${out}/worst-${aspect}.png`,png)}
    }
   }
   await page.evaluate(()=>globalThis.beamLatticeReview.dispose())
  }
 }
 assert.deepEqual(report.errors,[]);assert.equal(report.failures.length,0,`${report.failures.length} frames expose empty regions`);console.log(JSON.stringify({checks:report.checks,worst:report.worst,errors:report.errors}));
}finally{await writeFile(`${out}/report.json`,JSON.stringify(report,null,2)+'\n');await browser.close()}

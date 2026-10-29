// Analyze the native captures produced by accept-switch-it-phase2.mjs; no rerender required.
import sharp from 'sharp'
import { resolve } from 'node:path'
import { writeFile } from 'node:fs/promises'
const out=resolve(import.meta.dirname,'../../artifacts/switch-it-phase2')
const pixels=async name=>sharp(resolve(out,name+'.png')).removeAlpha().raw().toBuffer()
const [human,clear,solid,half]=await Promise.all(['switch-cycle-start','reveal-0','skull-projection-mid','split-portrait-mid'].map(pixels))
const roiDifference=(a,b)=>{let sum=0,count=0;for(let y=330;y<460;y++)for(let x=280;x<360;x++)for(let c=0;c<3;c++){sum+=Math.abs(a[(y*640+x)*3+c]-b[(y*640+x)*3+c]);count++}return sum/count}
const retainedFaceDifference=roiDifference(human,clear)
if(retainedFaceDifference>.05)throw Error('Mask OFF does not retain the actual character face: '+retainedFaceDifference)
let retainedBodyDifference=0,bodySamples=0
for(let y=575;y<620;y++)for(let x=270;x<370;x++)for(let c=0;c<3;c++){const i=(y*640+x)*3+c;retainedBodyDifference+=Math.abs(human[i]-solid[i]);bodySamples++}
retainedBodyDifference/=bodySamples
if(retainedBodyDifference>.05)throw Error('Character neck/chest no longer retained beneath the mask: '+retainedBodyDifference)
let dividerWhitePixels=0
for(let y=60;y<500;y++)if(y<245||y>292)for(let x=316;x<325;x++){const i=(y*640+x)*3;if(Math.min(half[i],half[i+1],half[i+2])>190)dividerWhitePixels++}
if(dividerWhitePixels>12)throw Error('Bright vertical divider remains: '+dividerWhitePixels)
const eyes=[257,383].map(cx=>{
 let count=0,minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity
 for(let y=250;y<290;y++)for(let x=cx-38;x<cx+38;x++){const i=(y*640+x)*3;if(Math.min(solid[i],solid[i+1],solid[i+2])>170){count++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y)}}
 const aspect=(maxX-minX+1)/(maxY-minY+1)
 if(count<200||aspect<2.4)throw Error('The open socket is not showing the narrow character eye: '+JSON.stringify({cx,count,aspect}))
 return{cx,count,aspect}
})
const report={retainedFaceDifference,retainedBodyDifference,dividerWhitePixels,eyes}
await writeFile(resolve(out,'overlay-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2))

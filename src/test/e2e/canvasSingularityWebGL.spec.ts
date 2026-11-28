import { expect, test } from '@playwright/test'
import { build } from 'vite'
import { resolve } from 'node:path'
import type { SingularityRenderer } from '../../components/vyzualz/react/renderers/singularity/SingularityRenderer'
import { DEFAULT_CANVAS_SINGULARITY_SETTINGS } from '../../components/vyzualz/react/renderers/singularity/SingularitySettings'
const systemChromium = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
test.use({ video: 'off', trace: 'off', launchOptions: { args: ['--enable-webgl','--ignore-gpu-blocklist','--use-angle=swiftshader','--enable-unsafe-swiftshader'], ...(systemChromium ? { executablePath: systemChromium } : {}) } })
test('SINGULARITY production renderer compiles, differentiates patterns, reconstructs and resizes', async ({ page }, testInfo) => {
  test.setTimeout(120_000)
  const result = await build({ configFile:false, publicDir:false, logLevel:'error', build:{write:false,minify:false,lib:{entry:resolve('src/components/vyzualz/react/renderers/singularity/SingularityRenderer.ts'),formats:['iife'],name:'SingularityTestRuntime'}} })
  const bundle = Array.isArray(result) ? result[0] : result
  if (!('output' in bundle)) throw new Error('Expected renderer bundle')
  const chunk = bundle.output.find(item=>item.type==='chunk')
  if (!chunk || chunk.type !== 'chunk') throw new Error('Missing renderer chunk')
  await page.setContent('<body style="background:black;margin:0"></body>'); await page.addScriptTag({content:chunk.code})
  const metrics = await page.evaluate(defaults=>{
    const runtime = (window as unknown as {SingularityTestRuntime:{SingularityRenderer:typeof SingularityRenderer}}).SingularityTestRuntime
    const source=document.createElement('canvas');source.width=320;source.height=180
    const ctx=source.getContext('2d')!;ctx.fillStyle='#fff';ctx.beginPath();ctx.moveTo(105,45);ctx.lineTo(215,45);ctx.lineTo(160,135);ctx.closePath();ctx.fill()
    const output=document.createElement('canvas');document.body.append(output)
    const renderer=runtime.SingularityRenderer.create(output);const gl=output.getContext('webgl2')!
    const draw=(pattern:number,dissolve:number,motion:number,glow=.7,width=320,height=180)=>{
      const ok=renderer.render({source,settings:{...defaults,quality:'low',glow},frame:{motion,age:motion,pattern,dissolve,glitch:dissolve*.55,hit:dissolve*.3,energy:.3,accent:.1,force:pattern%2?-1:1,paused:false,reset:true},fitMode:'contain',transform:{scale:1,positionX:0,positionY:0,rotation:0},viewport:{width,height},dpr:1})
      if(!ok)throw new Error('No drawable frame')
      const pixels=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels)
      if(gl.getError()!==gl.NO_ERROR)throw new Error('Pixel readback failed')
      return pixels
    }
    const diff=(a:Uint8Array,b:Uint8Array)=>a.reduce((n,v,i)=>n+Math.abs(v-b[i]),0)/a.length
    const lit=(a:Uint8Array)=>a.reduce((n,v,i)=>n+(i%4===1&&v>25?1:0),0)
    const clean=draw(0,0,0),patterns:Uint8Array[]=[],captures:string[]=[]
    for(let i=0;i<10;i++){patterns.push(draw(i,.65,3));captures.push(output.toDataURL('image/png'))}
    const noGlow=draw(4,.65,3,0),moved=draw(4,.65,4),recovered=draw(0,0,0),resized=draw(0,.3,1,.7,400,240)
    const size=[output.width,output.height];renderer.dispose()
    return {lit:patterns.map(lit),distinct:patterns.slice(1).map((p,i)=>diff(patterns[i],p)),motion:diff(patterns[4],moved),bloom:diff(patterns[4],noGlow),recovery:diff(clean,recovered),resizeLit:lit(resized),size,captures}
  },DEFAULT_CANVAS_SINGULARITY_SETTINGS)
  for(const [i,capture] of metrics.captures.entries())await testInfo.attach(`pattern-${i}`,{body:Buffer.from(capture.split(',')[1],'base64'),contentType:'image/png'})
  expect(metrics.lit.every(n=>n>200)).toBe(true);expect(metrics.distinct.every(n=>n>.1)).toBe(true)
  expect(metrics.motion).toBeGreaterThan(.1);expect(metrics.bloom).toBeGreaterThan(.02);expect(metrics.recovery).toBeLessThan(.1)
  expect(metrics.resizeLit).toBeGreaterThan(200);expect(metrics.size).toEqual([400,240])
})

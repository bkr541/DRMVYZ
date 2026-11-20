import {chromium} from '@playwright/test'
const S='/private/tmp/claude-501/-Users-kodyrobinson-Development-DRMVYZ/e04ab3d0-8215-4335-85cd-87e3f68a757c/scratchpad'
const b=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']})
const p=await b.newPage({viewport:{width:1280,height:720}})
await p.goto('http://127.0.0.1:5173/src/test/browser/_glyphscratch/p.html')
await p.waitForTimeout(10000)
await p.evaluate(()=>{g.set(g.ids.l2,'CIPHER');g.set(g.ids.p('lineHold'),'1');g.set(g.ids.p('pattern'),'open-gate');g.set(g.ids.p('cameraMode'),'reveal')})
for(let i=0;i<12;i++){await p.waitForTimeout(1100);await p.screenshot({path:`${S}/pr${i}.png`})}
await b.close()

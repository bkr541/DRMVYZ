#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import os from 'node:os'
import { inventory, config, pixelEvidence, visibleIssues, controlEvidence, pixelDistance, technicalIssues, retiredIssues, p95, regressionIssues } from './release-acceptance-core.mjs'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..')
const args=process.argv.slice(2)
const opt=(name,fallback)=>{const i=args.indexOf(`--${name}`);return i<0?fallback:args[i+1]}
const keys=opt('presets',inventory.join(',')).split(',')
if(!keys.length||new Set(keys).size!==keys.length||keys.some(k=>!inventory.includes(k)))throw Error('Unknown or duplicate preset')
const parent=join(root,'artifacts/cinema2-release');await mkdir(parent,{recursive:true})
const output=await mkdtemp(join(parent,'run-'));console.log(`Release evidence: ${output}`)
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const save=(path,data)=>writeFile(path,JSON.stringify(data,null,2)+'\n')
const report={config,inventory:keys,fullInventory:keys.length===inventory.length,environment:{platform:os.platform(),arch:os.arch(),cpu:os.cpus()[0]?.model, node:process.version},
  presets:Object.fromEntries(keys.map(key=>[key,{status:'not-run',reason:'Browser not started'}])),
  gates:{humanVisual:'pending',electronPreview:'not-run',electronFullscreen:'not-run',casting:'not-run',performanceComparison:'not-run'},errors:[]}
let vite,browser
try {
  const [{chromium},{createServer},{default:sharp}]=await Promise.all([import('@playwright/test'),import('vite'),import('sharp')])
  vite=await createServer({root,server:{host:'127.0.0.1',port:0}});await vite.listen()
  const url=vite.resolvedUrls.local[0]+'src/test/browser/cinema2-quality-review.html'
  browser=await chromium.launch({headless:true,args:['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'],...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})})
  report.environment.chromium=browser.version()
  // Identify renderer separately from browser version (software vs hardware).
  const probe=await browser.newPage();report.environment.gl=await probe.evaluate(()=>{const gl=document.createElement('canvas').getContext('webgl2');if(!gl)return null;const ext=gl.getExtension('WEBGL_debug_renderer_info');return {vendor:gl.getParameter(ext?.UNMASKED_VENDOR_WEBGL??gl.VENDOR),renderer:gl.getParameter(ext?.UNMASKED_RENDERER_WEBGL??gl.RENDERER)}});await probe.close()
  if(!report.environment.gl)throw Error('WebGL2 unavailable in Chromium')
  for(const key of keys){
    const folder=join(output,key);await mkdir(folder,{recursive:true})
    const result={status:'running',errors:[],checks:[],frames:[],metrics:{},humanVisual:'pending'};report.presets[key]=result
    const page=await browser.newPage({viewport:{width:config.width,height:config.height},deviceScaleFactor:1})
    page.on('pageerror',e=>result.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'||/GL_INVALID|WebGL.*error/i.test(m.text()))result.errors.push(m.text())})
    const api=(method,...values)=>page.evaluate(({method,values})=>window.__cinema2QualityReview[method](...values),{method,values})
    const check=(name,issues=[],evidence={})=>result.checks.push({name,status:issues.length?'fail':'pass',issues,evidence})
    const notRun=(name,reason)=>result.checks.push({name,status:'not-run',reason})
    const scenario=async(name,fn)=>{try{await fn()}catch(e){check(name,[String(e)])}}
    const set=async(p,value)=>{if(!p)throw Error('Required control missing');const actual=await api('set',p.id,value);if(JSON.stringify(actual)!==JSON.stringify(value))throw Error(`Control ${p.id} rejected value: ${JSON.stringify(actual)}`)}
    const capture=async(name,stage='drop',frames=15,visible=false)=>{
      const {png,...c}=await api('capture',stage,frames)
      const image=Buffer.from(png.split(',')[1],'base64'), file=`${name}.png`
      const {data,info}=await sharp(image).toColourspace('srgb').removeAlpha().raw().toBuffer({resolveWithObject:true})
      await writeFile(join(folder,file),image)
      const pixels=pixelEvidence(data,info.width,info.height),issues=technicalIssues(c),d=c.diagnostics
      if(visible)issues.push(...visibleIssues(key,pixels,name==='default'?'default':stage))
      if(info.width!==d.runtime.viewport.width||info.height!==d.runtime.viewport.height)issues.push('Unexpected backing canvas size')
      const settings=await api('saved')
      result.frames.push({name,file,sha256:hash(image),pixels,settings,...c})
      result.metrics[name]={cpuP95:p95(c.timings),gpuBytes:d.resources.estimatedGpuMemoryBytes+d.modules.estimatedGpuBytes,settings,width:info.width,height:info.height}
      check(name,issues);return {data,pixels,d}
    }
    // Bound a failed preset rather than stopping the entire matrix. Closing the
    // page also terminates a wedged evaluate/asset load.
    let timer
    const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{void page.close();reject(Error('Preset exceeded 300s deadline'))},300000)})
    try{await Promise.race([deadline,(async()=>{
      await page.goto(`${url}?preset=drmvyz.cinema2.${key}&quality=high&mode=authored&release=1`)
      await page.waitForFunction(()=>!!window.__cinema2QualityReview,{},{timeout:30000})
      const meta=await api('inventory');result.manifest=meta
      const find=label=>meta.controls.find(p=>p.label.toLowerCase()===label.toLowerCase())
      const auto=find('Auto Performance'),pattern=find('Pattern'),change=find('Pattern Change'),trigger=find('Trigger'),camera=find('Camera Motion')??find('Camera Movement'),sync=find('BPM Sync')
      const authored=JSON.parse(meta.parameters).values
      result.prepare=await api('prepare');await capture('default','reference',1,true)
      await scenario('manual-controls',async()=>{
        await set(auto,false);await set(change,false)
        await capture('manual-play','breakdown',15,true);await api('pause',true)
        // Independently exercise palette controls and one representative geometry
        // or exposure slider. Use A/A drift control before each B measurement.
        const palette=meta.controls.filter(p=>p.type==='color'&&p.designParentGroup==='palette'&&p.exposure!=='hidden')
        check('palette-inventory',palette.length>=4?[]:['Fewer than four palette controls'])
        const slider=meta.controls.find(p=>p.type==='float'&&p.designParentGroup==='design'&&p.exposure==='primary'&&p.min!==undefined&&p.max!==undefined&&!p.visibleWhen&&!p.enabledWhen&&!/camera|media|motion|speed|rate|transition/i.test(p.label))
        if(!slider)notRun('representative-slider','No unconditional Design slider selected')
        for(const p of [...palette,...(slider?[slider]:[])])await scenario(`control-${p.id}`,async()=>{
          const value=authored[p.id];if(value===undefined)throw Error('No authored value')
          // Color schema uses normalized RGB(A); preserve alpha if present.
          const variants=p.type==='color'?[Array.isArray(value)?value.map((v,i)=>i===3?v:1-v):[1,0,1,1]]:[p.min,p.max].filter(v=>v!==value)
          await set(p,value)
          const a=await capture(`${p.id}-a1`,'breakdown',8),aa=await capture(`${p.id}-a2`,'breakdown',8)
          const evidence=[]
          try { for(const [i,v] of variants.entries()){await set(p,v);const b=await capture(`${p.id}-b${i}`,'breakdown',8);evidence.push(controlEvidence(a.data,aa.data,b.data))} } finally { await set(p,value) }
          check(`visible-control-${p.id}`,evidence.some(e=>e.pass)?[]:['No output difference above unchanged-frame drift'],evidence)
        })
        await api('pause',false)
        await set(sync,false);const off=await capture('bpm-off','build',15);await set(sync,true);const on=await capture('bpm-on','build',15);check('bpm-transport',off.d.transport?.bpmSync===false&&on.d.transport?.bpmSync===true?[]:['BPM Sync did not reach transport'],{off:off.d.transport,on:on.d.transport})
      })
      await scenario('patterns',async()=>{
        await set(auto,false);await set(change,false);await api('pause',false)
        check('pattern-inventory',meta.patterns.length>=6&&trigger?.options?.length===11?[]:['Missing six patterns or eleven shared triggers'])
        for(const [i,p] of meta.patterns.entries())await scenario(`pattern-${p.value}`,async()=>{
          await set(pattern,p.value);const a=await capture(`pattern-${i}-build`,'build',15);const b=await capture(`pattern-${i}-drop`,'drop',15);const c=await capture(`pattern-${i}-hold`,'drop',15)
          const reported=c.d.modules.modules.map(m=>m.inspection?.basePattern??m.inspection?.activePattern).filter(v=>v!==undefined)
          if(!reported.length)notRun(`pattern-selected-${i}`,'No base/active pattern inspection');else check(`pattern-selected-${i}`,!reported.includes(p.value)?['Module did not report the selected pattern']:[],{reported,expected:p.value})
          check(`pattern-motion-${i}`,[],{buildToDrop:pixelDistance(a.data,b.data),dropToHold:pixelDistance(b.data,c.data)})
        })
        await set(change,true);await set(trigger,'drop');await set(pattern,meta.patterns[0].value);await capture('pattern-manual-takeover','breakdown',1);await capture('pattern-manual-hold','breakdown',15);await capture('pattern-fresh-drop','drop',1);await capture('pattern-drop-hold','drop',15)
        check('pattern-change-retained',JSON.parse(await api('saved')).values[change.id]===true?[]:['Manual selection disabled Pattern Change'])
      })
      await scenario('camera',async()=>{
        await set(auto,false)
        const bound=meta.cameras?.find(c=>c.controls?.motionEnabled)?.controls?.motionEnabled?.$ref
        const permission=meta.controls.find(p=>p.id===bound)??(camera?.type==='boolean'?camera:null)
        if(!permission){notRun('camera-permission','No boolean camera permission in compiled manifest');return}
        await set(permission,false);const offA=await capture('camera-off-a','build',15),offB=await capture('camera-off-b','drop',15)
        await set(permission,true);const onA=await capture('camera-on-a','build',15),onB=await capture('camera-on-b','drop',15)
        const pose=c=>{const {position,target,fovDegrees,rollDegrees}=c.d.camera.camera;return JSON.stringify({position,target,fovDegrees,rollDegrees})}
        check('camera-off-lock',pose(offA)===pose(offB)?[]:['Camera pose changed with hard permission off'])
        check('camera-on-evidence',pose(onA)!==pose(onB)?[]:['Camera pose did not change during ON checkpoints'],{changed:pose(onA)!==pose(onB)})
      })
      await scenario('transport-auto',async()=>{
        await set(auto,true);await capture('auto-build','build',30);await capture('auto-drop-onset','drop',1)
        const drop=await capture('auto-drop-sustain','drop',30);const quiet=await capture('auto-breakdown','breakdown',30)
        check('performance-visible',visibleIssues(key,drop.pixels,'drop').length&&visibleIssues(key,quiet.pixels,'breakdown').length?['No visible sustained checkpoint']:[])
        await api('pause',true);const a=await capture('paused-a','breakdown',1),b=await capture('paused-b','breakdown',15)
        check('pause-clock',a.d.visualTime===b.d.visualTime&&a.d.transport?.timeSec===b.d.transport?.timeSec?[]:['Paused clock advanced'])
        await api('seek',.25);await capture('seek','build',15);await api('pause',false);await capture('resume','drop',15)
        const reset=JSON.parse(await api('reset')).values;check('reset',JSON.stringify(reset)===JSON.stringify(authored)?[]:['Reset did not restore authored values']);await capture('reset','reference',15,true)
      })
      await scenario('media',async()=>{
        if(!meta.mediaSlots.some(s=>s.accepts.includes('image'))){result.checks.push({name:'media',status:'not-applicable',reason:'No image slot in manifest'});return}
        await set(auto,false);const mode=find('Source Mode');if(mode?.options?.some(o=>o.value==='single'))await set(mode,'single')
        const fallback=await capture('media-before','reference',15,true);const loaded=await api('mediaFixture');check('media-loaded',loaded.readyResourceCount>0?[]:['No ready media texture'],loaded)
        await capture('media-build','build',30);const media=await capture('media-drop','drop',30,true);check('media-pixel-evidence',[],{difference:pixelDistance(fallback.data,media.data)})
        const removed=await api('mediaFixture',true);check('media-removed',removed.readyResourceCount===0?[]:['Media resource remained after removal'],removed)
        if(mode?.options?.some(o=>o.value==='auto'))await set(mode,'auto');await capture('media-fallback','reference',30,true)
      })
      await scenario('model',async()=>{
        if(!meta.controls.some(p=>p.metadata?.editor==='user-model-selector')){result.checks.push({name:'model',status:'not-applicable',reason:'No pinned model selector'});return}
        await set(auto,false);await api('modelFixture');let model
        for(let i=0;i<8;i++){await api('prepare');const d=await api('diagnostics');model=d.modules.modules.find(m=>m.inspection?.userModel)?.inspection.userModel;if(model?.status==='ready'&&model.binding?.startsWith('user-model:'))break}
        check('model-loaded',model?.status==='ready'&&model.binding?.startsWith('user-model:')?[]:['Pinned model did not report ready'],model);await capture('model','build',30,true)
        await api('modelFixture',true);await capture('model-fallback','reference',30,true)
      })
      await scenario('reentry',async()=>{
        await api('reset');const saved=await api('saved'),other=key==='spectrum'?'honey':'spectrum'
        for(let i=0;i<2;i++){
          let retired=await api('switchPreset',`drmvyz.cinema2.${other}`,'high');check(`retire-${i}`,retiredIssues(retired),retired);await api('prepare')
          retired=await api('switchPreset',meta.id,'high',saved);check(`retire-other-${i}`,retiredIssues(retired),retired);await api('prepare');await capture(`reentry-${i}`,'reference',15,true)
          check(`saved-reentry-${i}`,await api('saved')===saved?[]:['Saved state differs after reentry'])
        }
        await page.setViewportSize({width:540,height:960});await api('resize',540,960);await capture('portrait','build',30,true)
        await page.setViewportSize({width:960,height:540});const retired=await api('switchPreset',meta.id,'medium',saved);check('retire-portrait',retiredIssues(retired),retired);await api('prepare');await capture('medium','build',30,true)
        const recovery=await api('recoverContext');if(!recovery.supported)notRun('context-recovery','WEBGL_lose_context unavailable');else{check('context-restored',[],recovery);await api('prepare');await capture('context-recovered','reference',15,true)}
      })
    })()])}catch(e){result.errors.push(String(e))}
    finally{clearTimeout(timer);if(!page.isClosed()){try{await api('dispose');const d=await api('diagnostics');check('final-dispose',retiredIssues(d),d)}catch(e){result.errors.push(String(e))}await page.close()}}
    result.status=result.errors.length||result.checks.some(c=>c.status==='fail')||!result.frames.length?'fail':result.checks.some(c=>c.status==='not-run')?'incomplete':'pass'
    await save(join(folder,'report.json'),result);await save(join(output,'manifest.json'),report);console.log(`${key}: ${result.status}; ${result.frames.length} captures`)
  }
  const baseline=opt('baseline',null)
  if(baseline){const previous=JSON.parse(await readFile(resolve(baseline),'utf8'));const issues=regressionIssues(previous,report);report.gates.performanceComparison=issues.length?'fail':'pass';report.errors.push(...issues)}
}catch(e){report.errors.push(String(e))}
finally{await browser?.close();await vite?.close();await save(join(output,'manifest.json'),report)}
if(report.errors.length||Object.values(report.presets).some(p=>p.status!=='pass'))process.exitCode=1

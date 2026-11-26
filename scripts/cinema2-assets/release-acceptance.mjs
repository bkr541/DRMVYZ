#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import os from 'node:os'
import { inventory, config, pixelEvidence, visibleIssues, controlEvidence, technicalIssues, retiredIssues, p95, regressionIssues, recordCheck, assertion, scenarioDecision, presetStatus, reportStatus, reportExitCode, motionEvidence, pairwiseEvidence, sourceVisibility, fallbackEvidence, triggerEvidence, recoveryEvidence } from './release-acceptance-core.mjs'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..')
const args=process.argv.slice(2)
const opt=(name,fallback)=>{const i=args.indexOf(`--${name}`);return i<0?fallback:args[i+1]}
const keys=opt('presets',inventory.join(',')).split(',')
if(!keys.length||new Set(keys).size!==keys.length||keys.some(k=>!inventory.includes(k)))throw Error('Unknown or duplicate preset')
const parent=join(root,'artifacts/cinema2-release');await mkdir(parent,{recursive:true})
const output=await mkdtemp(join(parent,'run-'));console.log(`Release evidence: ${output}`)
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const save=(path,data)=>writeFile(path,JSON.stringify(data,null,2)+'\n')
const report={schemaVersion:2,technicalStatus:'incomplete',config,inventory:keys,fullInventory:keys.length===inventory.length,environment:{platform:os.platform(),arch:os.arch(),cpu:os.cpus()[0]?.model, node:process.version},
  presets:Object.fromEntries(keys.map(key=>[key,{status:'not-run',reason:'Browser not started'}])),
  gates:{humanVisual:'pending',electronPreview:'not-run',electronFullscreen:'not-run',casting:'not-run',performanceComparison:'not-run'},errors:[],blockers:[]}
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
    const result={status:'running',errors:[],checks:[],required:['scenario:manual-controls','scenario:patterns','scenario:camera','scenario:transport-auto','scenario:media','scenario:model','scenario:reentry','frame:default','final-dispose'],frames:[],metrics:{},humanVisual:'pending'};report.presets[key]=result
    const page=await browser.newPage({viewport:{width:config.width,height:config.height},deviceScaleFactor:1})
    page.on('pageerror',e=>result.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'||/GL_INVALID|WebGL.*error/i.test(m.text()))result.errors.push(m.text())})
    const api=(method,...values)=>page.evaluate(({method,values})=>window.__cinema2QualityReview[method](...values),{method,values})
    const requireCheck=name=>{if(!result.required.includes(name))result.required.push(name)}
    const decide=(name,decision)=>{requireCheck(name);recordCheck(result,name,decision)}
    const check=(name,issues,evidence={})=>decide(name,assertion(issues,evidence))
    const notRun=(name,reason)=>decide(name,{status:'incomplete',issues:[reason],reason})
    const notApplicable=(name,reason)=>decide(name,{status:'not-applicable',reason})
    const scenario=async(name,fn)=>{const label=`scenario:${name}`;requireCheck(label);const first=result.checks.length;try{await fn();decide(label,scenarioDecision(result.checks.slice(first)))}catch(e){check(label,[String(e)])}}
    const set=async(p,value)=>{if(!p)throw Error('Required control missing');const actual=await api('set',p.id,value);if(JSON.stringify(actual)!==JSON.stringify(value))throw Error(`Control ${p.id} rejected value: ${JSON.stringify(actual)}`)}
    const capture=async(name,stage='drop',frames=15,visible=false,fixture=null)=>{
      requireCheck(`frame:${name}`)
      const {png,...c}=await api('capture',stage,frames,fixture)
      const image=Buffer.from(png.split(',')[1],'base64'), file=`${name}.png`
      await writeFile(join(folder,file),image)
      const frameRecord={name,file,sha256:hash(image),...c};result.frames.push(frameRecord)
      const {data,info}=await sharp(image).toColourspace('srgb').removeAlpha().raw().toBuffer({resolveWithObject:true})
      const pixels=pixelEvidence(data,info.width,info.height),issues=technicalIssues(c),d=c.diagnostics
      if(c.timings?.length!==frames||!Number.isSafeInteger(c.frame)||!Number.isFinite(c.musicTime)||!Number.isFinite(d.visualTime)||!Number.isFinite(d.resources.estimatedGpuMemoryBytes)||!Number.isFinite(d.modules.estimatedGpuBytes))issues.push('Invalid or insufficient frame samples')
      if(visible)issues.push(...visibleIssues(key,pixels,name==='default'?'default':stage))
      if(info.width!==d.runtime.viewport.width||info.height!==d.runtime.viewport.height)issues.push('Unexpected backing canvas size')
      const settings=await api('saved')
      Object.assign(frameRecord,{pixels,settings})
      result.metrics[name]={cpuP95:p95(c.timings),gpuBytes:d.resources.estimatedGpuMemoryBytes+d.modules.estimatedGpuBytes,settings,width:info.width,height:info.height}
      check(`frame:${name}`,issues)
      const {position,target,fovDegrees,rollDegrees}=d.camera.camera
      const values=JSON.parse(settings).values
      const inspections=d.modules.modules.map(m=>({id:m.moduleId,...m.inspection}))
      const motion=Object.fromEntries(inspections.flatMap(m=>['phase','travel','geometryTravel','spin','morphPhase','routePhase','projectionPhase'].filter(k=>Number.isFinite(m[k])).map(k=>[`${m.id}:${k}`,m[k]])))
      return {data,pixels,d,capture:c,width:info.width,height:info.height,settings,inspections,motion,event:c.event,
        conditions:{stage:c.stage,fixture:c.fixture,quality:c.quality,frame:c.frame,stageFrame:c.stageFrame,musicTime:c.musicTime,visualTime:d.visualTime,settings,pattern:values[patternId],camera:{position,target,fovDegrees,rollDegrees}}}

    }
    let patternId
    // Bound a failed preset rather than stopping the entire matrix. Closing the
    // page also terminates a wedged evaluate/asset load.
    let timer
    const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{void page.close();reject(Error('Preset exceeded 600s deadline'))},600000)})
    try{await Promise.race([deadline,(async()=>{
      await page.goto(`${url}?preset=drmvyz.cinema2.${key}&quality=high&mode=authored&release=1`)
      await page.waitForFunction(()=>!!window.__cinema2QualityReview,{},{timeout:30000})
      const meta=await api('inventory');result.manifest=meta
      const find=label=>meta.controls.find(p=>p.label.toLowerCase()===label.toLowerCase())
      const auto=find('Auto Performance'),pattern=find('Pattern'),change=find('Pattern Change'),trigger=find('Trigger'),camera=find('Camera Motion')??find('Camera Movement'),sync=find('BPM Sync')
      patternId=pattern?.id
      const authored=JSON.parse(meta.parameters).values
      // Register unconditional assertions before scenarios execute. Dynamic
      // controls/patterns register their expected checks from the manifest.
      for(const name of ['palette-inventory','bpm-transport','pattern-inventory','pattern-trigger-transition','performance-visible','pause-clock','reset','context-restored','final-dispose'])requireCheck(name)
      for(const p of meta.controls.filter(p=>p.type==='color'&&p.designParentGroup==='palette'&&p.exposure!=='hidden'))requireCheck(`visible-control-${p.id}`)
      for(const [i] of meta.patterns.entries()){requireCheck(`pattern-selected-${i}`);requireCheck(`pattern-motion-${i}`);if(i)requireCheck(`pattern-pair-${i-1}-${i}`)}
      for(const i of [0,1])for(const name of [`retire-${i}`,`retire-other-${i}`,`frame:reentry-${i}`,`saved-reentry-${i}`])requireCheck(name)
      for(const name of ['retire-portrait','frame:portrait','frame:medium'])requireCheck(name)
      const permissionId=meta.cameras?.find(c=>c.controls?.motionEnabled)?.controls?.motionEnabled?.$ref
      const cameraPermission=meta.controls.find(p=>p.id===permissionId)??(camera?.type==='boolean'?camera:null)
      for(const name of cameraPermission?['camera-off-lock','camera-on-evidence']:['camera-permission'])requireCheck(name)
      const freshRuntime=async(saved,name)=>{const retired=await api('switchPreset',meta.id,'high',saved);check(`retire:${name}`,retiredIssues(retired),retired)}
      const active=f=>f.inspections.find(m=>typeof (m.activePattern??m.performingPattern)==='string')
      const patternValue=f=>{const m=active(f);return m?.activePattern??m?.performingPattern}
      const state=f=>{const m=active(f),v=JSON.parse(f.settings).values;return {active:patternValue(f),base:m?.basePattern,saved:v[pattern.id],enabled:v[change.id],trigger:v[trigger.id],effectiveChange:m?.effectivePatternChange,effectiveTrigger:m?.effectiveTrigger,event:f.event,musicTime:f.conditions.musicTime}}
      const sameSettingsWithout=(f,id)=>{const saved=JSON.parse(f.settings);delete saved.values[id];return {...f,conditions:{...f.conditions,settings:JSON.stringify(saved)}}}
      const imageSlots=meta.mediaSlots.filter(s=>s.accepts.includes('image'))
      for(const name of imageSlots.length?['media-loaded','media-pixel-evidence','media-fallback-evidence','media-hidden-negative-control']:['media'])requireCheck(name)
      for(const name of meta.controls.some(p=>p.metadata?.editor==='user-model-selector')?['model-loaded','model-pixel-evidence','model-fallback-evidence']:['model'])requireCheck(name)
      // Center-facing sources vs wrapping banks; the latter can occupy every zone.
      const mediaZones=['overdrive','livewire'].includes(key)?[1,3,4,5,7]:[0,1,2,3,4,5,6,7,8]
      const mediaReady=f=>imageSlots.every(s=>f.d.media.slots.some(m=>m.id===s.id&&m.status==='ready'&&m.source?.id==='sys06-rgb'))
      const mediaRestored=f=>imageSlots.every(s=>f.d.media.slots.some(m=>m.id===s.id&&m.source===null&&m.status!=='ready'))&&f.d.media.readyResourceCount===0&&f.inspections.every(m=>m.userMedia!==true)
      const modelState=f=>f.inspections.find(m=>m.userModel)?.userModel

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
        const spatial=key==='crate-wireframe-portal'?['Spatial Spread','Structural Density','Depth Distribution'].map(find).filter(Boolean):[]
        if(key==='crate-wireframe-portal')check('wireframe-spatial-controls',spatial.length===3?[]:['Missing Wireframe Portal structure controls'])
        const sliders=[...new Set([...(slider?[slider]:[]),...spatial])]
        for(const p of sliders)requireCheck(`visible-control-${p.id}`)
        for(const p of [...palette,...sliders])await scenario(`control-${p.id}`,async()=>{
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
        if(cameraPermission)await set(cameraPermission,false)
        const saved=await api('saved')
        check('pattern-inventory',meta.patterns.length>=6&&trigger?.options?.length===11?[]:['Missing six patterns or eleven shared triggers'])
        let previous
        for(const [i,p] of meta.patterns.entries()){
          for(const name of [`pattern-selected-${i}`,`pattern-motion-${i}`])requireCheck(name)
          if(i>0)requireCheck(`pattern-pair-${i-1}-${i}`)
          await scenario(`pattern-${p.value}`,async()=>{
            // Identical activation state, seed, warmup and fixture; change the
            // pattern only after activation so random geometry stays comparable.
            const sample=async(suffix)=>{await freshRuntime(saved,`pattern-${i}-${suffix}`);await set(pattern,p.value);await api('prepare');return capture(`pattern-${i}-${suffix}`,'breakdown',30,false,'none')}
            const a=await sample('a'),aa=await sample('aa'),b=await capture(`pattern-${i}-advance`,'breakdown',30,false,'none'),later=await capture(`pattern-${i}-later`,'breakdown',30,false,'none')
            const observed=[a,aa,b,later].map(patternValue)
            if(observed.some(v=>v===undefined))notRun(`pattern-selected-${i}`,'No effective pattern inspection');else check(`pattern-selected-${i}`,observed.every(v=>v===p.value)?[]:['Module did not hold selected pattern'],{observed,expected:p.value})
            decide(`pattern-motion-${i}`,motionEvidence(a,aa,b,later))
            if(i>0){if(previous)decide(`pattern-pair-${i-1}-${i}`,pairwiseEvidence(previous.a,previous.aa,a));else notRun(`pattern-pair-${i-1}-${i}`,'Previous pattern missing')}
            previous={a,aa}
            // Preserve the original musical-phase captures for artistic review.
            // They are technical frame checks, not evidence of controlled motion.
            await capture(`pattern-${i}-build`,'build',15);await capture(`pattern-${i}-drop`,'drop',15);await capture(`pattern-${i}-hold`,'drop',15)
          })
        }
        requireCheck('pattern-trigger-transition')
        await freshRuntime(saved,'trigger');await api('prepare');await set(change,true);await set(trigger,'drop')
        await set(pattern,meta.patterns[0].value)
        await capture('pattern-trigger-arm','breakdown',15,false,'none')
        const before=await capture('pattern-before-takeover','breakdown',1,false,'fresh')
        // Pick a different authored value from the current effective pattern.
        const selected=meta.patterns.find(p=>p.value!==patternValue(before)&&p.value!==state(before).saved)?.value
        await set(pattern,selected)
        const takeover=await capture('pattern-manual-takeover','breakdown',1,false,'duplicate')
        const noEvent=await capture('pattern-manual-hold','breakdown',15,false,'none')
        const stale=await capture('pattern-stale-drop','breakdown',1,false,'stale')
        const expectedNext=await api('expectedNextPattern',selected)
        const fresh=await capture('pattern-fresh-drop','breakdown',1,false,'fresh')
        const duplicate=await capture('pattern-duplicate-drop','breakdown',1,false,'duplicate')
        const hold=await capture('pattern-drop-hold','breakdown',15,false,'none')
        decide('pattern-trigger-transition',triggerEvidence(Object.fromEntries(Object.entries({before,takeover,noEvent,stale,fresh,duplicate,hold}).map(([k,f])=>[k,state(f)])),meta.patterns.map(p=>p.value),selected,JSON.parse(await api('saved')).values[change.id]===true,expectedNext))
      })
      await scenario('camera',async()=>{
        await set(auto,false)
        const bound=meta.cameras?.find(c=>c.controls?.motionEnabled)?.controls?.motionEnabled?.$ref
        const permission=meta.controls.find(p=>p.id===bound)??(camera?.type==='boolean'?camera:null)
        if(!permission){if(meta.cameras?.length&&meta.cameras.every(c=>!c.motion&&!c.controls?.motionEnabled&&c.rig?.kind==='static'))notApplicable('camera-permission','No authored camera motion or permission; module motion is checked separately');else notRun('camera-permission','No boolean camera permission in compiled manifest');return}
        requireCheck('camera-off-lock');requireCheck('camera-on-evidence')
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
        if(!imageSlots.length){notApplicable('media','No image slot in manifest');return}
        for(const name of ['media-loaded','media-pixel-evidence','media-fallback-evidence'])requireCheck(name)
        await set(auto,false);await set(change,false)
        const mode=find('Source Mode'),visibility=find('Media Visible')
        if(mode?.options?.some(o=>o.value==='auto'))await set(mode,'auto');else if(mode?.options?.some(o=>o.value==='single'))await set(mode,'single')
        if(visibility?.type==='boolean')await set(visibility,true)
        if(cameraPermission)await set(cameraPermission,false)
        const saved=await api('saved')
        const sample=async(name,action,settings=saved)=>{
          await freshRuntime(settings,name)
          if(action!=='off')await api('mediaFixture')
          await api('prepare')
          const beforeRemoval=await api('diagnostics')
          if(action==='remove')await api('mediaFixture',true)
          await api('prepare')
          const frame=await capture(name,'breakdown',30,false,'none')
          return {...frame,beforeRemoval}
        }
        const a=await sample('media-before','off'),aa=await sample('media-before-aa','off'),on=await sample('media-on','on')
        // Retain build/drop visual-review images separately from matched evidence.
        await capture('media-build','build',30);await capture('media-drop','drop',30,true)
        const removed=await sample('media-fallback','remove')
        check('media-loaded',mediaReady(on)?[]:['Expected fixture slot not ready'],on.d.media)
        // Broad projected panel ROIs for wrapping architectural sources; no
        // hard-coded central rectangle that would exclude corridor wall panels.
        decide('media-pixel-evidence',sourceVisibility(a,aa,on,{ready:mediaReady(on),fixture:true,expectedZones:mediaZones}))
        decide('media-fallback-evidence',fallbackEvidence(a,aa,on,removed,mediaReady({d:removed.beforeRemoval})&&mediaRestored(removed)&&!removed.pixels.uniform&&removed.inspections.filter(m=>m.sourceMode!==undefined).every(m=>a.inspections.some(base=>base.id===m.id&&base.sourceMode===m.sourceMode))))
        if(visibility?.type==='boolean'){
          await set(visibility,false);const hiddenSaved=await api('saved')
          const x=await sample('media-hidden-off','off',hiddenSaved),xx=await sample('media-hidden-aa','off',hiddenSaved),y=await sample('media-hidden-on','on',hiddenSaved)
          const rejected=sourceVisibility(x,xx,y,{ready:mediaReady(y),fixture:true,expectedZones:mediaZones})
          check('media-hidden-negative-control',mediaReady(y)&&rejected.status==='fail'&&rejected.issues.includes('Ready source has no visible contribution in expected regions')?[]:['Loaded-but-hidden fixture was not conclusively rejected'],rejected)
        }else notApplicable('media-hidden-negative-control','No hard Media Visible permission; pure evaluator negative fixture remains mandatory')
      })
      await scenario('model',async()=>{
        const modelControl=meta.controls.find(p=>p.metadata?.editor==='user-model-selector')
        if(!modelControl){notApplicable('model','No pinned model selector');return}
        for(const name of ['model-loaded','model-pixel-evidence','model-fallback-evidence'])requireCheck(name)
        await set(auto,false);await set(change,false);if(cameraPermission)await set(cameraPermission,false)
        const visible=find('Model Visible');if(visible?.type==='boolean')await set(visible,true)
        const content=find('Content Type');if(content?.options?.some(o=>o.value==='model'))await set(content,'model')
        await api('modelFixture',true);const saved=await api('saved')
        const sample=async(name,action)=>{
          await freshRuntime(saved,name)
          let binding='default-model'
          if(action!=='off')binding=await api('modelFixture')
          await api('prepare');await api('prepare')
          const beforeRemoval=await api('diagnostics')
          if(action==='remove')await api('modelFixture',true)
          await api('prepare')
          const f=await capture(name,'breakdown',30,false,'none')
          return {...sameSettingsWithout(f,modelControl.id),binding,beforeRemoval}
        }
        const a=await sample('model-before','off'),aa=await sample('model-before-aa','off'),on=await sample('model','on'),removed=await sample('model-fallback','remove')
        const model=modelState(on),ready=model?.status==='ready'&&model.binding===on.binding&&on.binding.startsWith('user-model:')
        check('model-loaded',ready?[]:['Pinned model did not report expected ready binding'],model)
        decide('model-pixel-evidence',sourceVisibility(a,aa,on,{ready,expectedZones:[1,3,4,5,7]}))
        const beforeRemoval=removed.beforeRemoval.modules.modules.find(m=>m.inspection?.userModel)?.inspection.userModel
        const restored=modelState(removed),original=modelState(a)
        if(!restored||!original||!beforeRemoval)notRun('model-fallback-evidence','Model source inspection unavailable')
        else decide('model-fallback-evidence',fallbackEvidence(a,aa,on,removed,beforeRemoval.binding===removed.binding&&beforeRemoval.status==='ready'&&restored.binding===original.binding&&restored.binding==='default-model'&&restored.status==='ready'&&!removed.pixels.uniform))
      })
      await scenario('reentry',async()=>{
        await api('reset');const saved=await api('saved'),other=key==='spectrum'?'honey':'spectrum'
        for(let i=0;i<2;i++){
          let retired=await api('switchPreset',`drmvyz.cinema2.${other}`,'high');check(`retire-${i}`,retiredIssues(retired),retired);await api('prepare')
          retired=await api('switchPreset',meta.id,'high',saved);check(`retire-other-${i}`,retiredIssues(retired),retired);await api('prepare');await capture(`reentry-${i}`,'reference',15,true)
          check(`saved-reentry-${i}`,await api('saved')===saved?[]:['Saved state differs after reentry'])
        }
        await page.setViewportSize({width:540,height:960});await api('resize',540,960);await capture('portrait','build',30,true)
        await page.setViewportSize({width:960,height:540});const retired=await api('switchPreset',meta.id,'medium',saved);check('retire-portrait',retiredIssues(retired),retired);await api('prepare');const medium=await capture('medium','build',30,true)
        requireCheck('context-restored');const recovery=await api('recoverContext');if(!recovery.supported)notRun('context-restored','WEBGL_lose_context unavailable');else{await api('prepare');const recovered=await capture('context-recovered','reference',15,true);decide('context-restored',recoveryEvidence(recovery,medium,recovered))}
      })
    })()])}catch(e){result.errors.push(String(e))}
    finally{clearTimeout(timer);if(!page.isClosed()){try{await api('dispose');const d=await api('diagnostics');check('final-dispose',retiredIssues(d),d)}catch(e){result.errors.push(String(e))}await page.close()}}
    result.status=presetStatus(result)
    await save(join(folder,'report.json'),result);await save(join(output,'manifest.json'),report);console.log(`${key}: ${result.status}; ${result.frames.length} captures`)
  }
  const baseline=opt('baseline',null)
  if(baseline){const previous=JSON.parse(await readFile(resolve(baseline),'utf8'));const issues=regressionIssues(previous,report);report.gates.performanceComparison=issues.length?'fail':'pass';report.errors.push(...issues)}
}catch(e){
  // Infrastructure prevented any preset from running; distinguish this from a
  // measured technical failure. Both cases still exit nonzero.
  if(Object.values(report.presets).every(p=>p.status==='not-run')){report.blockers.push(String(e));for(const p of Object.values(report.presets))p.reason=String(e)}else report.errors.push(String(e))
}
finally{await browser?.close();await vite?.close();report.technicalStatus=reportStatus(report);await save(join(output,'manifest.json'),report)}
process.exitCode=reportExitCode(report)

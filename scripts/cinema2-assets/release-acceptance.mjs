#!/usr/bin/env node
/* global document, window */
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import os from 'node:os'
import { sourceRevision, seal } from './visual-evidence-io.mjs'
import { inventory, config, pixelEvidence, visibleIssues, controlEvidence, technicalIssues, retiredIssues, p95, regressionIssues, recordCheck, assertion, scenarioDecision, presetStatus, reportStatus, reportExitCode, fullInventoryStatus, motionEvidence, pairwiseEvidence, cameraSequenceEvidence, cameraRenderEvidence, triggerSequenceEvidence, sourceVisibility, fallbackEvidence, triggerEvidence, recoveryEvidence } from './release-acceptance-core.mjs'
import { decodedMediaEvidence, videoFrameEvidence, projectedMediaEvidence } from './media-fidelity-evidence.mjs'
import { materialRegions, compareMaterialRegions, authoredMaterialEvidence } from './model-fidelity-evidence.mjs'
import { reviewedEntries, validateInventory, inventoryCoverage, capabilityPlan } from './reviewed-release-inventory.mjs'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..')
const args=process.argv.slice(2)
const opt=(name,fallback)=>{const i=args.indexOf(`--${name}`);return i<0?fallback:args[i+1]}
const keys=opt('presets',inventory.join(',')).split(',')
// Optional independently authored masks; absence must never count as a pass.
const maskFile=opt('media-masks',null)
const mediaMasks=maskFile?JSON.parse(await readFile(resolve(maskFile),'utf8')):{}
const coverage=inventoryCoverage(keys,args.includes('--presets'))
const parent=join(root,'artifacts/cinema2-release');await mkdir(parent,{recursive:true})
const output=await mkdtemp(join(parent,'run-'));console.log(`Release evidence: ${output}`)
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const save=(path,data)=>writeFile(path,JSON.stringify(data,null,2)+'\n')
const report={schemaVersion:6,sourceRevision:await sourceRevision(root),technicalStatus:'incomplete',config,inventory:keys,...coverage,fullInventoryStatus:'incomplete',releaseApproval:false,environment:{platform:os.platform(),arch:os.arch(),cpu:os.cpus()[0]?.model, node:process.version},
  presets:Object.fromEntries(keys.map(key=>[key,{status:'not-run',reason:'Browser not started'}])),
  gates:{browserTechnical:'not-run',humanVisual:'pending',hardwareTiming:'not-run',electronPreview:'not-run',electronFullscreen:'not-run',casting:'not-run',externalCasting:'not-run',captureComparison:'not-run',performanceComparison:'not-run'},errors:[],blockers:[]}
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
  const preflight=await browser.newPage()
  try { await preflight.goto(vite.resolvedUrls.local[0]+'src/test/browser/cinema2-release-inventory.html');await preflight.waitForFunction(()=>!!window.__cinema2ResolveReviewedIds,{},{timeout:30000});report.registry=await preflight.evaluate(ids=>window.__cinema2ResolveReviewedIds(ids),coverage.expectedIds);validateInventory(reviewedEntries,report.registry);report.modelInventory=await preflight.evaluate(()=>window.__cinema2ModelInventory()) } finally { await preflight.close() }
  for(const key of keys){
    const folder=join(output,key);await mkdir(folder,{recursive:true})
    const result={status:'running',errors:[],checks:[],required:['scenario:manual-controls','scenario:patterns','scenario:camera','scenario:transport-auto','scenario:trigger-matrix','scenario:media','scenario:model','scenario:reentry','frame:default','final-dispose'],frames:[],metrics:{},humanVisual:'pending',qa06:{physicalAttribution:'pending visual review',sourceFraming:'pending source-bound clearance and visual review',perceivedDirection:key==='purity'?'pending visual review':'not-applicable'}};report.presets[key]=result
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
    const capture=async(name,stage='drop',frames=15,visible=false,fixture=null,explicit=null)=>{
      requireCheck(`frame:${name}`)
      const {png,...c}=await api('capture',stage,frames,fixture,explicit)
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
      const motion=Object.fromEntries(inspections.flatMap(m=>['phase','travel','geometryTravel','spin','morphPhase','routePhase','projectionPhase','aperture','extrusion','forwardTravel','cameraClearance'].filter(k=>Number.isFinite(m[k])).map(k=>[`${m.id}:${k}`,m[k]])))
      return {data,pixels,d,capture:c,width:info.width,height:info.height,settings,inspections,motion,event:c.event,
        conditions:{stage:c.stage,fixture:c.fixture,quality:c.quality,frame:c.frame,stageFrame:c.stageFrame,musicTime:c.musicTime,visualTime:d.visualTime,settings,pattern:values[patternId],camera:{position,target,fovDegrees,rollDegrees}}}

    }
    let patternId
    // Bound a failed preset rather than stopping the entire matrix. Closing the
    // page also terminates a wedged evaluate/asset load.
    let timer
    const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{void page.close();reject(Error('Preset exceeded 1800s deadline'))},1800000)})
    try{await Promise.race([deadline,(async()=>{
      await page.goto(`${url}?preset=drmvyz.cinema2.${key}&quality=high&mode=authored&release=1`)
      await page.waitForFunction(()=>!!window.__cinema2QualityReview,{},{timeout:30000})
      const meta=await api('inventory');result.manifest=meta
      if(meta.id!==reviewedEntries.find(e=>e.key===key).id)throw Error('Runtime manifest does not match reviewed ID')
      const capabilities=capabilityPlan(meta);result.capabilities=capabilities
      result.mustPass=['frame:default','final-dispose','scenario:patterns','scenario:reentry','scenario:manual-controls','scenario:transport-auto','pattern-trigger-transition','context-restored']
      for(const kind of ['image','video','svg']){const name=`media-format:${kind}`;requireCheck(name);if(capabilities.media[kind].length)result.mustPass.push(name)}
      const find=label=>meta.controls.find(p=>p.label.toLowerCase()===label.toLowerCase())
      const auto=find('Auto Performance'),pattern=find('Pattern'),change=find('Pattern Change'),trigger=find('Trigger'),camera=find('Camera Motion')??find('Camera Movement'),sync=find('BPM Sync')
      patternId=pattern?.id
      const authored=JSON.parse(meta.parameters).values
      // Register unconditional assertions before scenarios execute. Dynamic
      // controls/patterns register their expected checks from the manifest.
      for(const id of capabilities.patternTriggers)requireCheck(`trigger-matrix:${id}`)
      for(const name of ['palette-inventory','bpm-transport','pattern-inventory','pattern-trigger-transition','performance-visible','pause-clock','reset','context-restored','final-dispose'])requireCheck(name)
      for(const p of meta.controls.filter(p=>p.type==='color'&&p.designParentGroup==='palette'&&p.exposure!=='hidden'))requireCheck(`visible-control-${p.id}`)
      for(const [i] of meta.patterns.entries()){requireCheck(`pattern-selected-${i}`);requireCheck(`pattern-motion-${i}`);for(let j=0;j<i;j++)requireCheck(`pattern-pair-${j}-${i}`)}
      for(const i of [0,1])for(const name of [`retire-${i}`,`retire-other-${i}`,`frame:reentry-${i}`,`saved-reentry-${i}`])requireCheck(name)
      for(const name of ['retire-portrait','frame:portrait','frame:medium'])requireCheck(name)
      const permissionId=meta.cameras?.find(c=>c.controls?.motionEnabled)?.controls?.motionEnabled?.$ref
      const cameraPermission=meta.controls.find(p=>p.id===permissionId)??(camera?.type==='boolean'?camera:null)
      const cameraMode=meta.controls.find(p=>p.id===capabilities.camera.mode)
      const lockCamera=async()=>{if(cameraPermission)await set(cameraPermission,false);else if(cameraMode)await set(cameraMode,'home');const zoom=meta.controls.find(p=>p.id===meta.cameras?.find(c=>c.controls?.kickZoom)?.controls?.kickZoom?.$ref);if(zoom?.type==='boolean')await set(zoom,false)}
      for(const name of (cameraPermission||cameraMode)?['camera-off-lock','camera-on-evidence']:['camera-permission'])requireCheck(name)
      const freshRuntime=async(saved,name,quality='high')=>{const retired=await api('switchPreset',meta.id,quality,saved);check(`retire:${name}`,retiredIssues(retired),retired)}
      const active=f=>f.inspections.find(m=>typeof (m.activePattern??m.performingPattern??m.pattern)==='string')
      // Livewire deliberately delegates to Say It's internal controller IDs. Keep
      // raw inspections in the report; compare the corresponding authored IDs.
      const authoredPatternId=value=>key==='livewire'?meta.patterns[['solid','pulse','letter-chase','alternate','center-wave','strobe'].indexOf(value)]?.value??value:value
      const patternValue=f=>{const m=active(f);return authoredPatternId(m?.activePattern??m?.performingPattern??m?.pattern)}
      const state=f=>{const m=active(f),v=JSON.parse(f.settings).values;return {active:patternValue(f),base:authoredPatternId(m?.basePattern),saved:v[pattern.id],enabled:v[change.id],trigger:v[trigger.id],effectiveChange:m?.effectivePatternChange,effectiveTrigger:m?.effectiveTrigger,event:f.event,musicTime:f.conditions.musicTime}}
      const sameSettingsWithout=(f,id)=>{const saved=JSON.parse(f.settings);delete saved.values[id];return {...f,conditions:{...f.conditions,settings:JSON.stringify(saved)}}}
      if(cameraPermission||cameraMode)result.mustPass.push('camera-off-lock','camera-on-evidence')
      for(const [i] of meta.patterns.entries()){result.mustPass.push(`pattern-selected-${i}`,`pattern-motion-${i}`);for(let j=0;j<i;j++)result.mustPass.push(`pattern-pair-${j}-${i}`)}
      const imageSlots=meta.mediaSlots.filter(s=>s.accepts.includes('image'))
      if(imageSlots.length)result.mustPass.push('media-loaded','media-pixel-evidence','media-fallback-evidence')
      if(meta.mediaSlots.length)result.mustPass.push('media-projected-fidelity','media-lifecycle-fidelity')
      for(const name of imageSlots.length?['media-loaded','media-pixel-evidence','media-fallback-evidence','media-hidden-negative-control']:['media'])requireCheck(name)
      for(const name of meta.controls.some(p=>p.metadata?.editor==='user-model-selector')?['model-loaded','model-pixel-evidence','model-fallback-evidence']:['model'])requireCheck(name)
      if(capabilities.model){result.mustPass.push('model-material-fidelity','model-authored-materials','model-pinned-upgrade','model-cache-released','model-pinned-reentry','model-replacement','model-replacement-visible','model-failed-load','model-failed-load-fallback');if(find('Model Visible')?.type==='boolean')result.mustPass.push('model-hidden-negative-control');else notApplicable('model-hidden-negative-control','No hard model visibility control in manifest');result.mustPass.push('model-loaded','model-pixel-evidence','model-fallback-evidence');if(key==='chamber')result.mustPass.push('chamber-model-placement');if(capabilities.model.contentMode)result.mustPass.push('native-typography','native-typography-visible','model-replacement','model-replacement-visible','model-failed-load','model-failed-load-fallback','typography-saved-restored','typography-pixel-restored')}
      if(capabilities.model)for(const mode of capabilities.model.presentationModes.filter(m=>m!=='original')){
        result.mustPass.push(`model-mode-${mode}`,`model-original-restored-${mode}`)
        if(['brushed','edge'].includes(mode))result.mustPass.push(`model-stylization-${mode}`)
      }
      for(const name of result.mustPass)requireCheck(name)
      // Center-facing sources vs wrapping banks; the latter can occupy every zone.
      const mediaZones=['overdrive','livewire'].includes(key)?[1,3,4,5,7]:[0,1,2,3,4,5,6,7,8]
      const mediaReady=f=>imageSlots.every(s=>f.d.media.slots.some(m=>m.id===s.id&&m.status==='ready'&&m.source?.id==='qa05-chart'))
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
        await lockCamera()
        const saved=await api('saved')
        check('pattern-inventory',meta.patterns.length>=6&&Array.isArray(meta.sharedTriggers)&&meta.sharedTriggers.length===trigger?.options?.length&&meta.sharedTriggers.every(id=>trigger.options.some(o=>o.value===id))?[]:['Missing six patterns or eleven shared triggers'])
        const previous=[]
        for(const [i,p] of meta.patterns.entries()){
          for(const name of [`pattern-selected-${i}`,`pattern-motion-${i}`])requireCheck(name)
          for(let j=0;j<i;j++)requireCheck(`pattern-pair-${j}-${i}`)
          await scenario(`pattern-${p.value}`,async()=>{
            // Identical activation state, seed, warmup and fixture; change the
            // pattern only after activation so random geometry stays comparable.
            const sample=async(suffix)=>{await freshRuntime(saved,`pattern-${i}-${suffix}`);await set(pattern,p.value);await api('prepare');const sequence=[];for(let n=0;n<3;n++)sequence.push(await capture(`pattern-${i}-${suffix}-${n}`,'breakdown',30,false,'none'));return sequence}
            const first=await sample('a'),second=await sample('aa'),[a]=first,[aa,b,later]=second
            const observed=[...first,...second].map(patternValue)
            if(observed.some(v=>v===undefined))notRun(`pattern-selected-${i}`,'No effective pattern inspection');else check(`pattern-selected-${i}`,observed.every(v=>v===p.value)?[]:['Module did not hold selected pattern'],{observed,expected:p.value})
            decide(`pattern-motion-${i}`,motionEvidence(a,aa,b,later))
            if(key==='purity'){
              const travel=second.map(f=>active(f)?.travel)
              if(travel.some(v=>!Number.isFinite(v)))notRun(`purity-forward-${i}`,'Missing native travel inspection')
              else check(`purity-forward-${i}`,travel.every((v,n)=>n===0||v>travel[n-1])?[]:['Purity native forward travel stalled or reversed'],{travel,visualDirection:'human review pending'})
            }
            for(let j=0;j<i;j++){
              const earlier=previous[j]
              if(!earlier){notRun(`pattern-pair-${j}-${i}`,'Previous pattern missing');continue}
              const checkpoints=first.map((f,n)=>{const forward=pairwiseEvidence(earlier.first[n],earlier.second[n],f),reverse=pairwiseEvidence(f,second[n],earlier.first[n]);return {...scenarioDecision([{name:'forward',...forward},{name:'reverse',...reverse}]),forward,reverse}})
              const status=checkpoints.some(c=>c.status==='pass')?'pass':checkpoints.some(c=>c.status==='incomplete')?'incomplete':'fail'
              decide(`pattern-pair-${j}-${i}`,{status,issues:status==='pass'?[]:['No distinguishable matched checkpoint above both repeatability baselines'],evidence:{checkpoints,classification:key==='livewire'?'LED topology/timing':'spatial edge differences; physical attribution requires inspection'}})
            }
            previous[i]={first,second}
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
      await scenario('trigger-matrix',async()=>{
        await api('reset');await set(auto,false);await lockCamera()
        await set(pattern,meta.patterns[0].value);await set(change,true)
        let identity=100000
        for(const id of capabilities.patternTriggers){
          await set(trigger,id);await api('seek',15.8)
          const arm=await capture(`trigger-${id}-arm`,'breakdown',4,false,'none')
          const kind=['bar','bar4','bar8'].includes(id)?'bar':['beat2','beat4'].includes(id)?'beat':id
          const negativeKind=['beat2','beat4','bar4','bar8'].includes(id)?kind:id==='kick'?'snare':'kick'
          const negativeBeat=['bar4','bar8'].includes(id)?4:31
          const emit=(name,kind,beat,eventId,replay=false)=>capture(`trigger-${id}-${name}`,'breakdown',1,false,'none',{trigger:id,kind,beat,id:eventId,replay})
          const negative=await emit('nonqualifying',negativeKind,negativeBeat,++identity)
          const expectedNext=await api('expectedNextPattern',patternValue(negative))
          const eventId=++identity
          const fresh=await emit('fresh',kind,32,eventId)
          const duplicate=await emit('duplicate',kind,32,eventId,true)
          const hold=await capture(`trigger-${id}-hold`,'breakdown',2,false,'none')
          await api('pause',true)
          const paused=await capture(`trigger-${id}-paused`,'breakdown',2,false,'none')
          await api('pause',false)
          const resume=await capture(`trigger-${id}-resume`,'breakdown',2,false,'none')
          await set(change,false)
          await api('seek',31.8)
          const disabled=await capture(`trigger-${id}-disabled`,'breakdown',5,false,'none')
          const disabledEvent=await emit('disabled-event',kind,64,++identity)
          const samples=Object.fromEntries(Object.entries({arm,negative,fresh,duplicate,hold,paused,resume,disabled,disabledEvent}).map(([k,f])=>[k,state(f)]))
          decide(`trigger-matrix:${id}`,triggerSequenceEvidence(samples,id,expectedNext))
          await set(change,true)
        }
        await api('reset')
      })
      await scenario('camera',async()=>{
        await api('reset');await set(auto,false);await set(change,false)
        const binding=meta.cameras?.find(c=>c.controls?.motionEnabled||c.controls?.rigMode||c.motion)
        const controlFor=name=>meta.controls.find(p=>p.id===binding?.controls?.[name]?.$ref)
        const permission=controlFor('motionEnabled')??cameraPermission
        const safety=controlFor('motionSafety'),amount=controlFor('masterMotionAmount')??controlFor('motionAmount'),zoom=controlFor('kickZoom')
        const baseline=await api('saved')
        const sample=async(name,configure,portrait=false)=>{
          await freshRuntime(baseline,`camera-${name}`)
          if(portrait)await api('resize',540,960)
          await configure();await api('prepare')
          await capture(`camera-${name}-idle`,'idle',15,false,'none')
          const frames=[]
          for(const [i,stage] of ['build','build','drop','drop','breakdown'].entries())frames.push(await capture(`camera-${name}-${i}`,stage,15,false,'staged'))
          await api('pause',true)
          // First paused frame may settle the transport state; compare subsequent frames.
          const held=await capture(`camera-${name}-paused`,'breakdown',1,false,'none')
          const heldLater=await capture(`camera-${name}-paused-later`,'breakdown',15,false,'none')
          decide(`camera-${name}-pause`,cameraSequenceEvidence([held,heldLater],{expect:'locked'}))
          await api('pause',false)
          const decision=cameraSequenceEvidence(frames,{expect:'measure',safety:binding?.safety})
          decide(`camera-${name}-bounds`,decision)
          return {frames,decision}
        }
        const on=async()=>{if(permission)await set(permission,true);if(cameraMode)await set(cameraMode,'drift');if(safety?.options?.some(o=>o.value==='full'))await set(safety,'full');if(zoom)await set(zoom,false)}
        if(!permission&&!cameraMode){
          if(meta.cameras?.length&&meta.cameras.every(c=>!c.motion&&!c.controls?.motionEnabled&&c.rig?.kind==='static'))notApplicable('camera-permission','Authored static rig without camera motion controls; native motion checked separately')
          else notRun('camera-permission','No hard permission or supported mode in compiled manifest; independent camera evidence required')
          return
        }
        const off=await sample('off',async()=>{await on();await lockCamera()})
        const offRepeat=await sample('off-repeat',async()=>{await on();await lockCamera()})
        const enabled=await sample('on',on)
        decide('camera-off-lock',cameraSequenceEvidence(off.frames,{expect:'locked',safety:binding?.safety}))
        decide('camera-on-evidence',cameraSequenceEvidence(enabled.frames,{expect:'moving',safety:binding?.safety}))
        decide('camera-rendered-view',cameraRenderEvidence(off.frames,offRepeat.frames,enabled.frames,[permission?.id,cameraMode?.id].filter(Boolean)))
        if(safety){
          for(const mode of ['reduced','lockoff'].filter(v=>safety.options?.some(o=>o.value===v))){
            const measured=await sample(mode,async()=>{await on();await set(safety,mode)})
            const evidence=cameraSequenceEvidence(measured.frames,{expect:mode==='lockoff'?'locked':'reduced',reference:enabled.decision.evidence,safety:binding?.safety})
            decide(`camera-safety-${mode}`,evidence)
          }
        }
        if(amount&&Number.isFinite(amount.min)&&Number.isFinite(amount.max)){
          for(const [label,value] of [['min',amount.min],['max',amount.max]]){
            const measured=await sample(`amount-${label}`,async()=>{await on();await set(amount,value)})
            // A zero additive amount is not a hard stop for every authored rig.
            decide(`camera-amount-${label}`,cameraSequenceEvidence(measured.frames,{expect:'measure',safety:binding?.safety}))
          }
        }
        if(zoom)await sample('kick-zoom',async()=>{await on();await set(zoom,true)})
        if(sync)await sample('free-time',async()=>{await on();await set(sync,false)})
        await sample('auto',async()=>{await on();await set(auto,true)})
        await sample('portrait',on,true)
        await api('resize',config.width,config.height)
        await api('reset')
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
        const formats=['image','video','svg'].filter(kind=>capabilities.media[kind].length)
        for(const kind of ['image','video','svg'].filter(k=>!formats.includes(k)))notApplicable(`media-format:${kind}`,`No compiled ${kind} slot`)
        if(!formats.length){notApplicable('media','No compiled media slots');return}
        await api('reset');await set(auto,false);await set(change,false);await lockCamera()
        const mode=find('Source Mode')??find('Content Mode'),visibility=find('Media Visible')
        if(mode?.options?.some(o=>o.value==='auto'))await set(mode,'auto')
        if(visibility?.type==='boolean')await set(visibility,true)
        if(key==='overdrive') {await set(find('Display Style'),'color');await set(find('LED Intensity'),1)}
        const saved=await api('saved')
        const ready=(f,kind,variant)=>capabilities.media[kind].every(s=>f.d.media.slots.some(m=>m.id===s.id&&m.status==='ready'&&m.source?.id===`qa05-${variant}`&&m.source.kind===kind))
        const restored=(f,kind)=>capabilities.media[kind].every(s=>f.d.media.slots.some(m=>m.id===s.id&&m.source===null&&m.status!=='ready'))&&f.d.media.readyResourceCount===0&&f.inspections.every(m=>m.userMedia!==true)
        const sample=async(name,action,kind,variant,{settings=saved,stage='breakdown',quality='high',time=.2,replacement=false}={})=>{
          await freshRuntime(settings,name,quality)
          if(replacement)await api('mediaFixture',false,'image','chart')
          else if(action!=='off')await api('mediaFixture',false,kind,variant)
          await api('prepare')
          if(replacement)await api('mediaFixture',false,kind,variant)
          const beforeRemoval=await api('diagnostics')
          if(action==='remove')await api('mediaFixture',true,kind,variant)
          if(action==='on'&&kind==='video')await api('mediaTime',time)
          await api('prepare')
          const frame=await capture(name,stage,30,false,stage==='breakdown'?'none':'staged')
          const decoded=action==='on'?await api('mediaDecode',variant,time):null
          const source=frame.d.media.slots.filter(s=>s.source).map(s=>({slot:s.id,id:s.source.id,kind:s.source.kind,playback:s.playback}))
          return {...frame,beforeRemoval,decoded,source}
        }
        const run=async(kind,variant,quality,stage,strict=true)=>{
          const label=`media-${variant}-${quality}-${stage}`
          const options={quality,stage}
          const a=await sample(`${label}-off`,'off',kind,variant,options),aa=await sample(`${label}-aa`,'off',kind,variant,options),on=await sample(`${label}-on`,'on',kind,variant,options)
          const removed=await sample(`${label}-removed`,'remove',kind,variant,options)
          const loaded=ready(on,kind,variant)
          const visibilityEvidence=sourceVisibility(a,aa,on,{ready:loaded,fixture:true,expectedZones:mediaZones})
          const fallback=fallbackEvidence(a,aa,on,removed,ready({d:removed.beforeRemoval},kind,variant)&&restored(removed,kind)&&!removed.pixels.uniform&&removed.inspections.filter(m=>m.sourceMode!==undefined).every(m=>a.inspections.some(base=>base.id===m.id&&base.sourceMode===m.sourceMode)))
          const decorate=decision=>({...decision,evidence:{...decision.evidence,source:on.source,variant,phase:stage,quality,roi:mediaZones}})
          decide(`${label}-decode`,decodedMediaEvidence(on.decoded,variant,kind==='video'?.2:0))
          check(`${label}-loaded`,loaded?[]:['Expected fixture slot not ready'],{source:on.source})
          if(strict){
            decide(`${label}-visibility`,decorate(visibilityEvidence));decide(`${label}-fallback`,decorate(fallback))
            const calibration=mediaMasks[`${key}/${variant}/${quality}/${stage}`]
            decide(`${label}-projection`,decorate(projectedMediaEvidence(on,a,calibration?.width===on.width&&calibration?.height===on.height?calibration.regions:[])))
          }
          else {
            // Authored dark/fade/distortion intervals are not automatically a defect.
            // Record measured observations, not a readability pass.
            result.mediaPhaseObservations??=[];result.mediaPhaseObservations.push({label,visibility:decorate(visibilityEvidence),fallback:decorate(fallback)})
          }
          if(kind==='video'&&strict){
            const repeat=await sample(`${label}-video-aa`,'on',kind,variant,options)
            const second=await sample(`${label}-video-next`,'on',kind,variant,{...options,time:1.2})
            decide(`${label}-video-repeat-decode`,decodedMediaEvidence(repeat.decoded,variant,.2))
            decide(`${label}-video-second-decode`,decodedMediaEvidence(second.decoded,variant,1.2))
            check(`${label}-video-slot-identity`,ready(repeat,kind,variant)&&ready(second,kind,variant)?[]:['Video fixture identity or readiness lost during seek'],{repeat:repeat.source,second:second.source})
            decide(`${label}-video-advances`,videoFrameEvidence(on,repeat,second,{first:on.decoded?.playback?.currentTimeSec,repeat:repeat.decoded?.playback?.currentTimeSec,second:second.decoded?.playback?.currentTimeSec,expectedZones:mediaZones}))
            if(quality==='high'){const playback=await api('mediaPlayback');check('media-video-playback',playback.before?.paused&&playback.held?.paused&&Math.abs(playback.before.currentTimeSec-playback.held.currentTimeSec)<.05&&playback.advanced&&playback.wrapped&&playback.after?.loop?[]:['Video did not pause, resume and loop through production transport'],playback)}
          }
          return {a,aa,on,removed,loaded,visibilityEvidence,fallback}
        }
        const projectionStart=result.checks.length
        for(const kind of formats){
          const start=result.checks.length
          for(const quality of ['high','medium','low'])for(const variant of kind==='image'?['chart','alpha','tall']:[kind]){
            const evidence=await run(kind,variant,quality,'breakdown')
            if(kind==='image'&&variant==='alpha'&&quality==='high'){
              const replaced=await sample('media-replacement','on','image','alpha',{replacement:true})
              const repeat=await sample('media-replacement-aa','on','image','alpha')
              const comparison=fallbackEvidence(evidence.on,repeat,evidence.a,replaced,ready(replaced,'image','alpha'))
              decide('media-replacement',comparison)
            }
            if(kind==='image'&&variant==='chart'&&quality==='high'){
              check('media-loaded',evidence.loaded?[]:['Expected fixture slot not ready'],evidence.on.d.media)
              decide('media-pixel-evidence',evidence.visibilityEvidence);decide('media-fallback-evidence',evidence.fallback)
            }
          }
          if(kind==='image')for(const stage of ['idle','build','drop'])await run(kind,'chart','high',stage,false)
          decide(`media-format:${kind}`,scenarioDecision(result.checks.slice(start)))
        }
        decide('media-projected-fidelity',scenarioDecision(result.checks.slice(projectionStart).filter(c=>c.name.endsWith('-projection'))))
        if(visibility?.type==='boolean'&&imageSlots.length){
          await freshRuntime(saved,'media-hidden-settings');await set(visibility,false);const settings=await api('saved')
          const x=await sample('media-hidden-off','off','image','chart',{settings}),xx=await sample('media-hidden-aa','off','image','chart',{settings}),y=await sample('media-hidden-on','on','image','chart',{settings})
          const rejected=sourceVisibility(x,xx,y,{ready:mediaReady(y),fixture:true,expectedZones:mediaZones})
          check('media-hidden-negative-control',mediaReady(y)&&rejected.status==='fail'&&rejected.issues.includes('Ready source has no visible contribution in expected regions')?[]:['Loaded-but-hidden fixture was not conclusively rejected'],rejected)
        }else if(imageSlots.length)notApplicable('media-hidden-negative-control','No hard Media Visible permission; pure evaluator negative fixture remains mandatory')
        if(meta.poolSlots?.length&&capabilities.media.image.length){
          await freshRuntime(saved,'pool-settings')
          const trigger=find('Pool Trigger'),automation=find('Pool Automation')
          if(automation)await set(automation,true)
          const cadence=trigger?.options?.find(o=>o.value==='beat')??trigger?.options?.find(o=>o.value==='beat2')
          if(cadence){
            await set(trigger,cadence.value);const settings=await api('saved')
            const poolSample=async(name,action)=>{
              await freshRuntime(settings,name);if(action!=='off')await api('mediaPool',true)
              await api('prepare');const requestsBefore=await api('mediaPoolRequests')
              if(action==='remove')await api('mediaPool',false)
              const frame=await capture(name,'build',120,false,'staged')
              return {...frame,requestsBefore,requests:await api('mediaPoolRequests')}
            }
            const a=await poolSample('media-pool-off','off'),aa=await poolSample('media-pool-aa','off'),on=await poolSample('media-pool-on','on'),removed=await poolSample('media-pool-removed','remove')
            const poolReady=f=>f.inspections.some(m=>m.poolReady===true||m.poolReady>0||m.poolReadyChannels>0)
            decide('media-pool-visible',sourceVisibility(a,aa,on,{ready:poolReady(on),fixture:true,expectedZones:mediaZones}))
            check('media-pool-rotation',on.requests.includes('qa05-pool-3')&&poolReady(on)?[]:['No resolved fourth pool entry after shared cadence'],{initial:on.requestsBefore,requests:on.requests,inspections:on.inspections})
            decide('media-pool-fallback',fallbackEvidence(a,aa,on,removed,!poolReady(removed)&&removed.inspections.every(m=>m.sourceMode!=='pool')))
          }else notRun('media-pool-rotation','No supported short pool cadence found; capability requires a dedicated scenario')
        }else if(!meta.poolSlots?.length)notApplicable('media-pool-rotation','No pool-capable compiled slot')
        // The direct decoder and pool lifecycle have separate gates; final-frame
        // loop and reentry remain unverified until matched scene calibration.
        notRun('media-lifecycle-fidelity','Matched final-frame pause/resume, loop and source-preserving quality/reentry captures remain pending')
      })
      await scenario('model',async()=>{
        const modelControl=meta.controls.find(p=>p.metadata?.editor==='user-model-selector')
        if(!modelControl){notApplicable('model','No pinned model selector');return}
        if(!capabilities.model?.bound)throw Error('Model selector is not bound to compiled module')
        for(const name of ['model-loaded','model-pixel-evidence','model-fallback-evidence'])requireCheck(name)
        await set(auto,false);await set(change,false);await lockCamera()
        const presentation=find('Model Presentation');if(presentation?.options?.some(o=>o.value==='original'))await set(presentation,'original')
        const materialState=f=>f.inspections.find(m=>m.userModelMaterials)?.userModelMaterials
        const visible=find('Model Visible');if(visible?.type==='boolean')await set(visible,true)
        const content=meta.controls.find(p=>p.id===capabilities.model.contentMode)
        const text=content&&find('Text'),font=content&&find('Font');let typography,typographyAA
        if(content){
          await set(content,'text');await set(text,'QA RELEASE');await set(font,font.options.find(o=>o.value!==authored[font.id]).value)
          await api('modelFixture',true)
          const textSaved=await api('saved');result.typographySaved=JSON.parse(textSaved).values
          const nativeSample=async(name,settings=textSaved)=>{await freshRuntime(settings,name);await api('prepare');await api('prepare');await api('prepare');return capture(name,'breakdown',30,true,'none')}
          typography=await nativeSample('native-typography');typographyAA=await nativeSample('native-typography-aa')
          if(visible?.type==='boolean'){await set(visible,false);const hidden=await nativeSample('native-typography-hidden',await api('saved'));check('native-typography-visible',controlEvidence(typography.data,typographyAA.data,hidden.data).pass?[]:['Native hero visibility has no visible contribution']);await set(visible,true)}
          check('native-typography',modelState(typography)?.binding==='default-model'&&JSON.parse(typography.settings).values[text.id]==='QA RELEASE'&&JSON.parse(typography.settings).values[font.id]===result.typographySaved[font.id]?[]:['Native typography settings or binding not restored'])
          await set(content,'model')
        }
        await api('modelFixture',true);const saved=await api('saved')
        const sample=async(name,action)=>{
          await freshRuntime(saved,name)
          let binding='default-model'
          if(action!=='off')binding=await api('modelFixture',false,'primary')
          await api('prepare');await api('prepare')
          const beforeRemoval=await api('diagnostics')
          if(action==='remove')await api('modelFixture',true)
          if(['replacement','missing','upgrade','wrong-color','opaque','no-texture','no-mask'].includes(action))binding=await api('modelFixture',false,action)
          await api('prepare')
          const f=await capture(name,'breakdown',30,false,'none')
          return {...sameSettingsWithout(f,modelControl.id),binding,beforeRemoval,cache:await api('modelCache')}
        }
        const a=await sample('model-before','off'),aa=await sample('model-before-aa','off'),on=await sample('model','on'),removed=await sample('model-fallback','remove')
        const model=modelState(on),ready=model?.status==='ready'&&model.binding===on.binding&&on.binding.startsWith('user-model:')
        check('model-loaded',ready?[]:['Pinned model did not report expected ready binding'],model)
        decide('model-pixel-evidence',sourceVisibility(a,aa,on,{ready,expectedZones:[1,3,4,5,7]}))
        const beforeRemoval=removed.beforeRemoval.modules.modules.find(m=>m.inspection?.userModel)?.inspection.userModel
        const restored=modelState(removed),original=modelState(a)
        if(!restored||!original||!beforeRemoval)notRun('model-fallback-evidence','Model source inspection unavailable')
        else decide('model-fallback-evidence',fallbackEvidence(a,aa,on,removed,beforeRemoval.binding===removed.binding&&beforeRemoval.status==='ready'&&restored.binding===original.binding&&restored.binding==='default-model'&&restored.status==='ready'&&!removed.pixels.uniform))
        if(visible?.type==='boolean'){
          await set(visible,false)
          // Start both hidden runs with the same cleared binding (and restore the model-mode baseline after).
          await api('modelFixture',true);const hiddenBase=await api('saved')
          const hiddenCapture=async(name,withModel)=>{await freshRuntime(hiddenBase,name);if(withModel)await api('modelFixture');await api('prepare');await api('prepare');await api('prepare');return sameSettingsWithout(await capture(name,'breakdown',30,false,'none'),modelControl.id)}
          const h=await hiddenCapture('model-hidden-off',false),hh=await hiddenCapture('model-hidden-aa',false),ho=await hiddenCapture('model-hidden-on',true)
          const evidence=sourceVisibility(h,hh,ho,{ready:modelState(ho)?.status==='ready'})
          check('model-hidden-negative-control',modelState(ho)?.status==='ready'&&evidence.status==='fail'&&evidence.issues.includes('Ready source has no visible contribution in expected regions')?[]:['Hidden model was not conclusively rejected'],evidence)
          await set(visible,true)
        }
        if(key==='chamber')check('chamber-model-placement',on.inspections.some(m=>m.modelPlaced===true&&m.source==='dark-chamber.glb')&&removed.inspections.some(m=>m.modelPlaced===false)?[]:['Chamber model not placed or cleared'])
        const onAA=await sample('model-on-aa','on')
        const wrongColor=await sample('model-wrong-color','wrong-color'),opaque=await sample('model-opaque','opaque'),noTexture=await sample('model-no-texture','no-texture'),noMask=await sample('model-no-mask','no-mask')
        const editorCapture=async(name,variant)=>{
          const {png,...reference}=await api('modelEditorReference',variant)
          const image=Buffer.from(png.split(',')[1],'base64'),file=`${name}.png`;await writeFile(join(folder,file),image)
          const {data,info}=await sharp(image).toColourspace('srgb').removeAlpha().raw().toBuffer({resolveWithObject:true})
          result.editorReferences??=[];result.editorReferences.push({name,file,sha256:hash(image),...reference,width:info.width,height:info.height})
          return {data,width:info.width,height:info.height,binding:reference.binding,materials:reference.materials}
        }
        const e=await editorCapture('editor-primary','primary'),ee=await editorCapture('editor-primary-aa','primary'),ec=await editorCapture('editor-wrong-color','wrong-color'),eo=await editorCapture('editor-opaque','opaque'),et=await editorCapture('editor-no-texture','no-texture'),em=await editorCapture('editor-no-mask','no-mask')
        const editor=materialRegions({primary:e,repeat:ee,wrongColor:ec,opaque:eo,noTexture:et,noMask:em})
        const production=materialRegions({primary:on,repeat:onAA,wrongColor,opaque,noTexture,noMask,native:aa})
        const bound=[on,onAA,wrongColor,opaque,noTexture,noMask].every(f=>modelState(f)?.status==='ready'&&modelState(f)?.binding===f.binding)
        const sameVersions=e.binding===on.binding&&ee.binding===onAA.binding&&ec.binding===wrongColor.binding&&eo.binding===opaque.binding&&et.binding===noTexture.binding&&em.binding===noMask.binding
        const matched=[onAA,wrongColor,opaque,noTexture,noMask].every(f=>JSON.stringify(f.conditions)===JSON.stringify(on.conditions))
        if(!bound||!sameVersions||!matched)check('model-material-fidelity',['Material capture used an incorrect or unready pinned source'],{bound,sameVersions,matched})
        else decide('model-material-fidelity',compareMaterialRegions(editor,production))
        decide('model-authored-materials',authoredMaterialEvidence(e.materials,materialState(on)?.materials))
        // Rebind v1 while the library advertises v2; recreate with serialized
        // selection, then exercise every supported presentation on that instance.
        await sample('model-mode-primary','on')
        const pinnedSaved=await api('saved')
        await freshRuntime(pinnedSaved,'model-pinned-reentry');await api('prepare');await api('prepare');await api('prepare')
        const reentry=await capture('model-pinned-reentry','breakdown',30,false,'none')
        check('model-pinned-reentry',modelState(reentry)?.binding===on.binding&&modelState(reentry)?.status==='ready'&&reentry.settings===pinnedSaved?[]:['Pinned model changed on source reentry'],modelState(reentry))
        if(presentation?.options?.some(o=>o.value==='original')){
          for(const option of presentation.options.filter(o=>o.value!=='original')){
            await set(presentation,option.value);const styled=await capture(`model-mode-${option.value}`,'breakdown',15,false,'none')
            const actual=materialState(styled),expected=['brushed','edge'].includes(option.value)?'stylized':option.value
            check(`model-mode-${option.value}`,actual?.presentation===expected&&modelState(styled)?.binding===on.binding&&actual.materials.length>0?[]:['Presentation did not reach the bound model'],actual)
            if(option.value==='brushed'||option.value==='edge'){
              const key=option.value==='brushed'?'roughness':'emissiveIntensity'
              check(`model-stylization-${option.value}`,actual?.materials.some(m=>e.materials.some(r=>r.name===m.name&&Math.abs(r[key]-m[key])>1e-5))?[]:['Explicit stylization did not change its authored surface channel'],actual)
            }
            await set(presentation,'original');const back=await capture(`model-restored-${option.value}`,'breakdown',15,false,'none')
            decide(`model-original-restored-${option.value}`,authoredMaterialEvidence(e.materials,materialState(back)?.materials))
          }
        }else notApplicable('model-presentation-roundtrip','No selectable Model Presentation enum')
        const upgrade=await sample('model-explicit-upgrade','upgrade')
        check('model-pinned-upgrade',modelState(on)?.binding===on.binding&&on.binding.endsWith(':1')&&upgrade.binding===on.binding.replace(/:1$/,':2')&&modelState(upgrade)?.binding===upgrade.binding&&modelState(upgrade)?.status==='ready'?[]:['Pinned v1 or explicit v2 binding was not preserved'],{before:modelState(on),after:modelState(upgrade)})
        {
          const replacement=await sample('model-replacement','replacement')
          const previousBinding=replacement.beforeRemoval.modules.modules.find(m=>m.inspection?.userModel)?.inspection.userModel
          check('model-replacement',previousBinding?.binding===on.binding&&previousBinding.status==='ready'&&modelState(replacement)?.binding===replacement.binding&&modelState(replacement)?.status==='ready'&&replacement.binding!==on.binding?[]:['Replacement pinned binding not ready'])
          decide('model-replacement-visible',sourceVisibility(on,onAA,replacement,{ready:modelState(replacement)?.status==='ready'}))
          const missing=await sample('model-failed-load','missing')
          check('model-failed-load',modelState(missing)?.binding===missing.binding&&['error','missing','unauthorized'].includes(modelState(missing)?.status)?[]:['Failed model did not produce an explicit failure state'])
          decide('model-failed-load-fallback',fallbackEvidence(a,aa,on,missing,modelState(missing)?.binding===missing.binding&&['error','missing','unauthorized'].includes(modelState(missing)?.status)))
        }
        await api('modelFixture',true);await api('prepare');const cache=await api('modelCache')
        check('model-cache-released',on.cache.heldCount>0&&removed.cache.entryCount===0&&removed.cache.heldCount===0&&cache.entryCount===0&&cache.heldCount===0?[]:['Private model cache did not hold/release the expected leases'],{loaded:on.cache,removed:removed.cache,final:cache})
        if(content){
          await set(content,'text');const restoredSaved=await api('saved')
          const values=JSON.parse(restoredSaved).values
          check('typography-saved-restored',JSON.stringify(values)===JSON.stringify(result.typographySaved)?[]:['Text/font or saved source settings changed'])
          const textSample=async name=>{await freshRuntime(restoredSaved,name);await api('prepare');await api('prepare');await api('prepare');return capture(name,'breakdown',30,true,'none')}
          const t=await textSample('typography-restored'),tt=await textSample('typography-restored-aa')
          const distance=controlEvidence(typography.data,typographyAA.data,t.data),fallback=controlEvidence(t.data,tt.data,a.data)
          check('typography-pixel-restored',!distance.pass&&!fallback.pass?[]:['Restored text differs from native text or model-mode fallback beyond drift'],{distance,fallback})
        }
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
  if(baseline){const previous=JSON.parse(await readFile(resolve(baseline),'utf8'));const issues=regressionIssues(previous,report);report.gates.captureComparison=issues.length?'fail':'pass';report.errors.push(...issues)}
}catch(e){
  // Infrastructure prevented any preset from running; distinguish this from a
  // measured technical failure. Both cases still exit nonzero.
  if(Object.values(report.presets).every(p=>p.status==='not-run')){report.blockers.push(String(e));for(const p of Object.values(report.presets))p.reason=String(e)}else report.errors.push(String(e))
}
finally{await browser?.close();await vite?.close();report.technicalStatus=reportStatus(report);report.gates.browserTechnical=report.technicalStatus;if(await sourceRevision(root)!==report.sourceRevision){report.errors.push('Source changed during capture');report.technicalStatus='fail';report.gates.browserTechnical='fail'}report.fullInventoryStatus=fullInventoryStatus(report);await save(join(output,'manifest.json'),seal(report))}
process.exitCode=reportExitCode(report)

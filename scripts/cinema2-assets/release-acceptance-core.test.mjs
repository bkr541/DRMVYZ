import test from 'node:test'
import assert from 'node:assert/strict'
import { inventory, pixelEvidence, visibleIssues, controlEvidence, p95, regressionIssues, retiredIssues } from './release-acceptance-core.mjs'
import { reviewedEntries, inventoryVersion, inventoryCoverage, validateInventory, capabilityPlan } from './reviewed-release-inventory.mjs'
import { fullInventoryStatus } from './release-acceptance-core.mjs'
const registry=reviewedEntries.map(e=>({id:e.id,active:true,compiled:true}))
const rgb=(r,g,b)=>Uint8Array.from(Array.from({length:81},()=>[r,g,b]).flat())
test('release inventory covers all available review anchors without duplicate IDs',()=>{
  assert.equal(new Set(inventory).size,inventory.length);assert.ok(inventory.length>=21)
  for(const key of ['spectrum','hud','honey','purity','colossus','overdrive','crate-wireframe-portal','chamber','monument','monolith','paradox'])assert.ok(inventory.includes(key))
})
test('blank and flat bright output fail; dark spatial detail is not rejected',()=>{
  for(const frame of [rgb(0,0,0),rgb(255,255,255),rgb(50,100,150)])assert.ok(visibleIssues('honey',pixelEvidence(frame,9,9),'default').length)
  const dark=rgb(0,0,0);dark[0]=3;assert.deepEqual(visibleIssues('honey',pixelEvidence(dark,9,9),'default'),[])
  assert.ok(visibleIssues('spectrum',pixelEvidence(dark,9,9),'default').length)
})
test('ignored control and unchanged noisy control fail; actual change passes',()=>{
  const a=rgb(10,10,10), noise=rgb(11,10,10), b=rgb(200,40,10)
  assert.equal(controlEvidence(a,a,a).pass,false);assert.equal(controlEvidence(a,noise,noise).pass,false)
  assert.equal(controlEvidence(a,noise,b).pass,true)
})
test('p95 and comparative regression gate are not pass-by-absence',()=>{
  assert.equal(p95([1,2,3,4]),4);assert.throws(()=>p95([]))
  const make=(cpuP95,gpuBytes)=>({inventoryVersion,config:{},environment:{},inventory:['honey'],presets:{honey:{status:'pass',metrics:{default:{cpuP95,gpuBytes,settings:'x',width:960,height:540}}}}})
  assert.deepEqual(regressionIssues(make(4,100),make(5,100)),[])
  assert.equal(regressionIssues(make(4,100),make(100,100)).length,1)
  assert.equal(regressionIssues(make(4,100),{...make(4,100),presets:{}}).length,1)
})
test('retired allocations fail even when runtime reports disposed',()=>{
  const d={runtime:{phase:'disposed',resources:{activeAnimationFrameCount:0}},modules:{activeResourceLeaseCount:0,estimatedGpuBytes:0},resources:{activeLeaseCount:0,estimatedGpuMemoryBytes:0},media:{readyResourceCount:0},glErrors:[]}
  assert.deepEqual(retiredIssues(d),[]);d.modules.activeResourceLeaseCount=1;assert.equal(retiredIssues(d).length,1)
})

import { motionEvidence, pairwiseEvidence, sourceVisibility, fallbackEvidence, triggerEvidence, recoveryEvidence, recordCheck, assertion, scenarioDecision, presetStatus, reportStatus, reportExitCode, pixelDistance, technicalIssues } from './release-acceptance-core.mjs'
const size=30
const settings=pattern=>JSON.stringify({values:{pattern,auto:false,change:false}})
const conditions={stage:'breakdown',fixture:'none',quality:'high',frame:90,stageFrame:30,musicTime:1,visualTime:1,settings:settings('a'),pattern:'a',camera:{position:[0,0,4],target:[0,0,0],fovDegrees:50,rollDegrees:0}}
const frame=(draw=()=>[10,10,10],overrides={})=>({data:Uint8Array.from(Array.from({length:size*size},(_,i)=>draw(i%size,Math.floor(i/size))).flat()),width:size,height:size,conditions:{...conditions,...overrides},motion:{phase:1}})
const advance=(f,time=2,phase=time)=>({...f,conditions:{...f.conditions,frame:90+30*(time-1),stageFrame:30*time,musicTime:time,visualTime:time},motion:{phase}})
const square=(left,top=10)=>frame((x,y)=>x>=left&&x<left+7&&y>=top&&y<top+7?[200,200,200]:[10,10,10])
const shifted=square(14),original=square(8)
const noisy={...original,data:Uint8Array.from(original.data,(v,i)=>Math.min(255,v+(i%29===0?1:0)))}
test('motion requires matched deterministic A/A, spatial movement and time advancement, not exposure or phase alone',()=>{
  assert.equal(motionEvidence(original,original,advance(original)).status,'fail')
  assert.equal(motionEvidence(original,noisy,advance(noisy)).status,'fail')
  assert.equal(motionEvidence(original,noisy,advance(shifted)).status,'pass')
  const brighter={...original,data:Uint8Array.from(original.data,v=>v+20)}
  assert.equal(motionEvidence(original,original,advance(brighter)).status,'fail')
  assert.equal(motionEvidence(original,original,advance(shifted,2,1)).status,'fail')
  // A temporarily held pose can pass only when the later controlled sample moves.
  assert.equal(motionEvidence(original,original,advance(original),advance(shifted,3)).status,'pass')
  assert.equal(motionEvidence(original,original,shifted).status,'incomplete')
  assert.equal(motionEvidence(original,{...original,width:99},advance(shifted)).status,'incomplete')
  assert.equal(motionEvidence(original,original,{...advance(shifted),conditions:{...advance(shifted).conditions,visualTime:NaN}}).status,'incomplete')
  assert.equal(motionEvidence(original,original,{...advance(shifted),conditions:{...advance(shifted).conditions,camera:{...conditions.camera,position:[1,0,4]}}}).status,'incomplete')
  assert.throws(()=>pixelDistance(new Uint8Array(4),new Uint8Array(4)))
  assert.throws(()=>pixelEvidence(new Float32Array([NaN,0,0]),1,1))
})
test('pairwise pattern comparisons require identical fixture and non-pattern settings',()=>{
  const next=f=>({...f,conditions:{...f.conditions,pattern:'b',settings:settings('b')}})
  assert.equal(pairwiseEvidence(original,noisy,next(shifted)).status,'pass')
  assert.equal(pairwiseEvidence(original,original,next(original)).status,'fail')
  const changed=next(shifted);changed.conditions.settings=JSON.stringify({values:{pattern:'b',auto:true,change:false}})
  assert.equal(pairwiseEvidence(original,original,changed).status,'incomplete')
})
test('ready but hidden texture fails, known chromatic ROI passes; wrong phase and wrong region cannot pass',()=>{
  const off=frame(), on=frame((x,y)=>x>=10&&x<20&&y>=10&&y<20?(x<15?[255,34,34]:[24,237,112]):[10,10,10])
  const opts={ready:true,fixture:true,expectedZones:[4]}
  assert.equal(sourceVisibility(off,off,off,opts).status,'fail')
  assert.equal(sourceVisibility(off,off,on,opts).status,'pass')
  assert.equal(sourceVisibility(off,off,on,{...opts,ready:false}).status,'fail')
  assert.equal(sourceVisibility(off,off,on,{...opts,expectedZones:[0]}).status,'fail')
  assert.equal(sourceVisibility(off,off,advance(on),opts).status,'incomplete')
  assert.equal(sourceVisibility(off,off,on,{}).status,'incomplete')
  assert.equal(sourceVisibility(off,off,frame(()=>[100,100,100]),opts).status,'fail')
})
test('fallback requires correct identity, visible replacement and restored reference',()=>{
  assert.equal(fallbackEvidence(original,noisy,shifted,original,true).status,'pass')
  assert.equal(fallbackEvidence(original,noisy,shifted,original,false).status,'fail')
  assert.equal(fallbackEvidence(original,noisy,shifted,shifted,true).status,'fail')
  assert.equal(fallbackEvidence(original,noisy,original,original,true).status,'fail')
  assert.equal(fallbackEvidence(original,noisy,shifted,original,undefined).status,'incomplete')
})
const patterns=['a','b','c']
function triggerSamples(){
  const row=(active,saved,mode,musicTime,id,eventTime=musicTime)=>({active,saved,enabled:true,trigger:'drop',effectiveChange:true,effectiveTrigger:'drop',musicTime,event:{mode,publicationSequence:Math.round(musicTime*30),semanticMoments:id?[{id,timeSec:eventTime}]:[]}})
  return {before:row('b','a','fresh',1,'drop1'),takeover:row('c','c','duplicate',1.1,'drop1',1),noEvent:row('c','c','none',2),stale:row('c','c','stale',2.1,'stale',1.6),fresh:row('a','c','fresh',2.2,'drop2'),duplicate:row('a','c','duplicate',2.3,'drop2',2.2),hold:row('a','c','none',3)}
}
test('fresh, stale, duplicate and manual takeover assertions inspect effective authority and exact next pattern',()=>{
  const run=s=>triggerEvidence(s,patterns,'c',true,'a')
  assert.equal(run(triggerSamples()).status,'pass')
  for(const [name,value] of [['stale','b'],['fresh','c'],['fresh','b'],['duplicate','b'],['takeover','b'],['hold','b']]){const s=triggerSamples();s[name].active=value;assert.equal(run(s).status,'fail',name)}
  const lost=triggerSamples();delete lost.stale;assert.equal(run(lost).status,'incomplete')
  const altered=triggerSamples();altered.duplicate.event.semanticMoments[0].id='wrong';assert.equal(run(altered).status,'fail')
  const effective=triggerSamples();effective.fresh.effectiveChange=false;assert.equal(run(effective).status,'fail')
  assert.equal(triggerEvidence(triggerSamples(),patterns,'c',false,'a').status,'fail')
  assert.equal(triggerEvidence(triggerSamples(),patterns,'c',true,null).status,'incomplete')
})
function recoveryFixture(){
  const snapshot=(phase,generation,frameCount,scheduled=1)=>({phase,contextGeneration:generation,frameCount,resources:{activeAnimationFrameCount:scheduled,activeWebGLContextCount:1}})
  const d={runtime:snapshot('running',2,20),resources:{contextAvailable:true,reconstructedAllocationCount:3},modules:{failedModuleCount:0,modules:[]},render:{failedPassCount:0},media:{errorCount:0},glErrors:[]}
  return {recovery:{supported:true,lost:{runtime:snapshot('context-lost',1,10,0),modules:{activeResourceLeaseCount:0},resources:{contextAvailable:false,activeLeaseCount:2,estimatedGpuMemoryBytes:0,pooledAllocationCount:0,reconstructedAllocationCount:1}},restoredSnapshot:{runtime:snapshot('running',2,10)}},before:{d:{runtime:snapshot('running',1,10)}},after:{...original,d,pixels:{uniform:false},capture:{diagnostics:d,parametersUnchanged:true}}}
}
test('context loss requires retired resources, reconstructed generation, fresh frames and clean GL',()=>{
  const run=({recovery,before,after})=>recoveryEvidence(recovery,before,after)
  assert.equal(run(recoveryFixture()).status,'pass')
  for(const mutate of [x=>x.after.d.runtime.frameCount=10,x=>x.after.d.runtime.contextGeneration=1,x=>x.after.d.glErrors.push(1282),x=>x.recovery.lost.resources.estimatedGpuMemoryBytes=1,x=>x.after.d.resources.reconstructedAllocationCount=1]){const x=recoveryFixture();mutate(x);assert.equal(run(x).status,'fail')}
  const x=recoveryFixture();x.recovery.supported=false;assert.equal(run(x).status,'incomplete')
  assert.ok(technicalIssues({}).length)
})
test('runner decision path propagates negative evidence, missing scenarios and invalid skips to report and exit code',()=>{
  const result={manifest:{id:'drmvyz.cinema2.honey'},required:['motion','scenario:patterns','fallback'],checks:[],errors:[],frames:[{name:'fixture'}]}
  const report={registry,inventory:['honey'],...inventoryCoverage(['honey'],true),presets:{honey:result},errors:[],gates:{humanVisual:'pending',casting:'not-run'}}
  const refresh=()=>{result.status=presetStatus(result);return [reportStatus(report),reportExitCode(report)]}
  assert.deepEqual(refresh(),['incomplete',1])
  assert.throws(()=>recordCheck(result,'motion',undefined))
  assert.throws(()=>recordCheck(result,'fallback',{status:'not-applicable'}))
  recordCheck(result,'motion',motionEvidence(original,original,advance(original)))
  recordCheck(result,'scenario:patterns',scenarioDecision(result.checks))
  assert.deepEqual(refresh(),['fail',1]);assert.equal(result.checks[1].status,'fail')
  const positive={...result,checks:[],errors:[]};report.presets.honey=positive
  recordCheck(positive,'motion',motionEvidence(original,noisy,advance(shifted)))
  recordCheck(positive,'scenario:patterns',scenarioDecision(positive.checks))
  positive.status=presetStatus(positive);assert.equal(positive.status,'incomplete');assert.equal(reportExitCode(report),1)
  recordCheck(positive,'fallback',fallbackEvidence(original,noisy,shifted,original,true))
  positive.status=presetStatus(positive);assert.equal(reportStatus(report),'pass');assert.equal(reportExitCode(report),0)
  assert.equal(report.gates.humanVisual,'pending');assert.equal(report.gates.casting,'not-run')
  assert.equal(scenarioDecision([]).status,'incomplete')
  assert.throws(()=>assertion(undefined))
})


test('reviewed inventory rejects missing Chamber/Monument, duplicate aliases and wrong same-count sets before rendering',()=>{
  validateInventory()
  for(const key of ['chamber','monument'])assert.throws(()=>validateInventory(reviewedEntries.filter(e=>e.key!==key)))
  assert.throws(()=>validateInventory([...reviewedEntries,reviewedEntries[0]]))
  assert.throws(()=>validateInventory([...reviewedEntries.slice(0,-1),{key:'monolith-copy',id:'drmvyz.cinema2.monument'}]))
  assert.throws(()=>validateInventory(reviewedEntries.map(e=>e.key==='monument'?{...e,id:'drmvyz.cinema2.monolith'}:e)))
  const compiled=reviewedEntries.map(e=>({id:e.id,compiled:true,active:true}))
  validateInventory(reviewedEntries,compiled)
  for(const bad of [compiled.slice(1),compiled.map((e,i)=>i===0?{...e,id:'unknown'}:e),compiled.map((e,i)=>i===0?{...e,active:false}:e)])assert.throws(()=>validateInventory(reviewedEntries,bad))
  assert.throws(()=>inventoryCoverage(['honey','honey'],true));assert.throws(()=>inventoryCoverage(['unknown'],true))
})
test('subset technical success cannot become full-inventory approval; forged coverage and missing result fail closed',()=>{
  const make=(keys,explicit)=>({registry,inventory:keys,...inventoryCoverage(keys,explicit),presets:Object.fromEntries(keys.map(k=>[k,{status:'pass',manifest:{id:`drmvyz.cinema2.${k}`},required:['fixture'],checks:[{name:'fixture',status:'pass'}],frames:[{}],errors:[]}])) ,errors:[]})
  const subset=make(['chamber','monument'],true)
  assert.equal(reportExitCode(subset),0);assert.equal(fullInventoryStatus(subset),'subset-only');assert.equal(subset.absentEntries.length,19)
  assert.equal(reportExitCode({...subset,fullInventory:true}),1)
  assert.equal(reportExitCode(make(['chamber'],false)),1)
  const full=make([...inventory],false);assert.equal(fullInventoryStatus(full),'pass')
  assert.equal(fullInventoryStatus(make([...inventory].reverse(),true)),'subset-only');assert.equal(reportExitCode({...full,registry:registry.slice(1)}),1);full.presets.monument.manifest.id='drmvyz.cinema2.monolith';assert.equal(reportExitCode(full),1);delete full.presets.monument;assert.equal(reportExitCode(full),1)
})
test('compiled capabilities distinguish optional source slots and native typography from labels',()=>{
  const meta={controls:[{id:'model',metadata:{editor:'user-model-selector'}},{id:'mode',options:[{value:'text'},{value:'model'}]},{id:'camera',options:[{value:'home'},{value:'drift'}]},{label:'Trigger',options:[{value:'drop'}]}],modules:[{parameterBindings:{userModel:{$ref:'model'},'content-type':{$ref:'mode'}},config:{instances:[{asset:'room'}]}}],cameras:[{controls:{rigMode:{$ref:'camera'}}}],mediaSlots:[{id:'panel',accepts:['image','video']},{id:'logo',accepts:['svg'],required:true}]}
  const plan=capabilityPlan(meta);assert.deepEqual(plan.media.svg,[{id:'logo',required:true}]);assert.deepEqual(plan.media.video,[{id:'panel',required:false}]);assert.equal(plan.model.bound,true);assert.equal(plan.model.contentMode,'mode');assert.deepEqual(plan.model.fixedAssets,['room']);assert.equal(plan.camera.mode,'camera');assert.deepEqual(plan.patternTriggers,['drop'])
  assert.equal(capabilityPlan({...meta,modules:[]}).model.bound,false);assert.deepEqual(capabilityPlan({controls:[{label:'Model'}]}).media,{image:[],video:[],svg:[]})
})
test('a required capability cannot be passed as not applicable',()=>{
  const result={required:['model'],mustPass:['model'],checks:[{name:'model',status:'not-applicable',reason:'incorrect'}],errors:[],frames:[{}]};assert.equal(presetStatus(result),'incomplete')
})

import { cameraSequenceEvidence } from './release-acceptance-core.mjs'
const cameraFrame=(x=0,near=.1,far=20)=>({width:960,height:540,d:{camera:{camera:{position:[x,0,4],target:[x,0,0],near,far,aspect:960/540,fovDegrees:50,rollDegrees:0,viewProjectionMatrix:[.5,0,0,0,0,.5,0,0,0,0,.1,0,-x*.5,0,0,1]}}}})
test('camera sequence rejects moving lock, imperceptible enabled camera and unsafe clipping',()=>{
  const a=cameraFrame(),b=cameraFrame(.1)
  assert.equal(cameraSequenceEvidence([a,a],{expect:'locked'}).status,'pass')
  assert.equal(cameraSequenceEvidence([a,b],{expect:'locked'}).status,'fail')
  assert.equal(cameraSequenceEvidence([a,a],{expect:'moving'}).status,'fail')
  assert.equal(cameraSequenceEvidence([a,cameraFrame(.0001)],{expect:'moving'}).status,'fail')
  const full=cameraSequenceEvidence([a,b],{expect:'moving'})
  assert.equal(full.status,'pass');assert.ok(full.evidence.maxPixels>1)
  assert.equal(cameraSequenceEvidence([a,cameraFrame(.2)],{expect:'reduced',reference:full.evidence}).status,'fail')
  assert.equal(cameraSequenceEvidence([a,cameraFrame(.02)],{expect:'reduced',reference:full.evidence}).status,'pass')
  assert.equal(cameraSequenceEvidence([a,cameraFrame(0,3,2)]).status,'fail')
  assert.equal(cameraSequenceEvidence([a,cameraFrame(0,.01,20)],{safety:{minNear:.1}}).status,'fail')
  const clipped=cameraFrame();clipped.d.camera.camera.viewProjectionMatrix[14]=2
  assert.equal(cameraSequenceEvidence([a,clipped]).status,'fail')
  assert.equal(cameraSequenceEvidence([a,{}]).status,'incomplete')
})

import { triggerSequenceEvidence } from './release-acceptance-core.mjs'
test('trigger matrix requires exact successor, matching replay, nonqualifying hold and disabled hold',()=>{
  const row=(active,canonical=null,explicit=null,enabled=true)=>({active,saved:'a',trigger:'kick',effectiveTrigger:'kick',enabled,effectiveChange:enabled,event:{canonical,explicit}})
  const make=()=>({arm:row('a'),negative:row('a',null,{id:1}),fresh:row('b','hit2',{id:2}),duplicate:row('b','hit2',{id:2,replay:true}),hold:row('b'),paused:row('b'),resume:row('b'),disabled:row('a',null,null,false),disabledEvent:row('a','hit3',{id:3},false)})
  assert.equal(triggerSequenceEvidence(make(),'kick','b').status,'pass')
  for(const key of ['negative','duplicate','paused','disabledEvent']){const s=make();s[key].active='c';assert.equal(triggerSequenceEvidence(s,'kick','b').status,'fail')}
  const wrong=make();wrong.fresh.active='c';assert.equal(triggerSequenceEvidence(wrong,'kick','b').status,'fail')
  assert.equal(triggerSequenceEvidence(make(),'kick',null).status,'incomplete')
})

import { cameraRenderEvidence } from './release-acceptance-core.mjs'
test('camera rendered comparison rejects unchanged output and unrelated object motion',()=>{
  const cameraOn=f=>({...f,conditions:{...f.conditions,settings:JSON.stringify({...JSON.parse(f.conditions.settings),values:{...JSON.parse(f.conditions.settings).values,camera:true}}),camera:{...f.conditions.camera,position:[.2,0,4]}}})
  assert.equal(cameraRenderEvidence([original],[original],[cameraOn(original)],['camera']).status,'fail')
  assert.equal(cameraRenderEvidence([original],[original],[cameraOn(shifted)],['camera']).status,'pass')
  assert.equal(cameraRenderEvidence([original],[original],[{...cameraOn(shifted),motion:{phase:2}}],['camera']).status,'incomplete')
})

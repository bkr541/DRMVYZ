import { inspectPixels } from './quality-review-core.mjs'
import { coverageValid, inventoryVersion, equalSet } from './reviewed-release-inventory.mjs'
export { inventory } from './reviewed-release-inventory.mjs'
export const config = Object.freeze({ fixture: 'qa06-v1/sys04-review-v1', fps: 30, dpr: 1, width: 960, height: 540, quality: 'high' })
export function pixelEvidence(rgb, width, height) {
  if (!(rgb instanceof Uint8Array) || !Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0 || rgb.length !== width * height * 3) throw Error('Unexpected RGB dimensions')
  const zones = Array.from({ length: 9 }, () => ({ min: 255, max: 0, chromatic: 0, lit: 0, count: 0 }))
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 3, r = rgb[i], g = rgb[i + 1], b = rgb[i + 2]
    const z = zones[Math.floor(y / height * 3) * 3 + Math.floor(x / width * 3)], hi = Math.max(r,g,b), lo = Math.min(r,g,b)
    z.min = Math.min(z.min, hi); z.max = Math.max(z.max, hi); z.count++
    if (hi > 45) z.lit++
    if (hi > 55 && hi - lo > 20) z.chromatic++
  }
  return { ...inspectPixels(rgb), zones, litFraction: zones.reduce((n,z)=>n+z.lit,0)/(width*height),
    chromaticPixels: zones.reduce((n,z)=>n+z.chromatic,0), chromaticZones: zones.filter(z=>z.chromatic>0).length }
}
export function visibleIssues(key, pixels, stage) {
  // No global brightness floor: dark, spatially varied artwork is valid.
  // Individual musical transition frames may be dark; callers separately
  // require a visible default and a visible sustained performance checkpoint.
  if (pixels.uniform || pixels.spatialVariation < 2) return ['No spatially distinguishable scene']
  // Existing SPE-01 arena criterion is specific to the default source, not
  // arbitrary dark/monochrome media or a deliberately dark pattern.
  if (key === 'spectrum' && stage === 'default' && (pixels.litFraction <= .005 || pixels.chromaticPixels <= 100 || pixels.chromaticZones < 2)) return ['SPECTRUM default lacks distributed arena lighting']
  return []
}
export function pixelDistance(a,b) {
  if (!(a instanceof Uint8Array) || !(b instanceof Uint8Array) || a.length !== b.length || !a.length || a.length % 3) throw Error('Mismatched pixel buffers')
  let sum = 0, changed = 0
  for (let i=0;i<a.length;i+=3) {
    const delta = Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]))
    sum += delta; if(delta>=8) changed++
  }
  return { mean: sum/(a.length/3), fraction: changed/(a.length/3) }
}
export function controlEvidence(a1,a2,b) {
  const noise = pixelDistance(a1,a2), change = pixelDistance(a2,b)
  // Drift measured under identical saved settings is not evidence of a control.
  const pass = change.mean > Math.max(.25,noise.mean*2) && change.fraction > Math.max(.001,noise.fraction*2)
  return { pass, noise, change }
}
export function technicalIssues(capture) {
  const d=capture?.diagnostics
  if(!d?.runtime||!d.modules||!d.render||!d.media||!Array.isArray(d.glErrors)||!Array.isArray(d.modules.modules)||
    ![d.modules.failedModuleCount,d.render.failedPassCount,d.media.errorCount].every(n=>Number.isSafeInteger(n)&&n>=0))return ['Missing or invalid production diagnostics']
  return [capture.parametersUnchanged!==true && 'Saved settings mutated or unavailable', d.runtime.phase!=='running' && `Runtime ${d.runtime.phase}`,
    d.glErrors.length && `GL errors: ${d.glErrors.join(',')}`, d.modules.failedModuleCount && 'Failed module',
    d.render.failedPassCount && 'Failed render pass', d.modules.modules.some(m=>m.inspection?.ready===false||m.inspection?.renderReady===false) && 'Module not ready',
    d.media.errorCount && 'Media slot error'].filter(Boolean)
}
export function retiredIssues(d) {
  return [d.runtime.phase!=='disposed' && 'Retired runtime not disposed', Object.values(d.runtime.resources).some(Boolean) && 'Retired runtime owns handles',
    d.modules.activeResourceLeaseCount!==0 && 'Retired module leases', d.modules.estimatedGpuBytes!==0 && 'Retired module GPU bytes',
    d.resources.activeLeaseCount!==0 && 'Retired render target leases', d.resources.estimatedGpuMemoryBytes!==0 && 'Retired render target bytes',
    d.media.readyResourceCount!==0 && 'Retired media textures', d.glErrors.length>0 && 'Retired runtime had GL errors'].filter(Boolean)
}
export function p95(values) {
  if (!values.length || values.some(v=>!Number.isFinite(v)||v<0)) throw Error('Invalid timing samples')
  return [...values].sort((a,b)=>a-b)[Math.ceil(values.length*.95)-1]
}
export function regressionIssues(before,after) {
  const issues=[]
  if (before.inventoryVersion!==inventoryVersion || after.inventoryVersion!==inventoryVersion || JSON.stringify(before.config)!==JSON.stringify(after.config) || JSON.stringify(before.environment)!==JSON.stringify(after.environment) || !equalSet(before.inventory,after.inventory)) return ['Incomparable capture configuration, environment or inventory']
  for (const key of after.inventory) {
    const a=before.presets[key], b=after.presets[key]
    if(a?.status!=='pass'||b?.status!=='pass'){issues.push(`${key}: missing/pending/failed comparison evidence`);continue}
    for (const name of Object.keys(a.metrics)) {
      const x=a.metrics[name], y=b.metrics[name]
      if(!y || x.settings!==y.settings || x.width!==y.width || x.height!==y.height){issues.push(`${key}/${name}: missing or different capture settings`);continue}
      // Conservative release tripwires, not a GPU FPS claim. Absolute slack
      // prevents noise near zero dominating the comparison.
      if(y.cpuP95>x.cpuP95*1.5+2) issues.push(`${key}/${name}: CPU callback p95 regression`)
      if(y.gpuBytes>x.gpuBytes*1.25+4*1024*1024) issues.push(`${key}/${name}: estimated GPU allocation regression`)
    }
  }
  return issues
}

// QA-01: evidence is a three-state decision. Missing observations are not success.
const outcome=(issues=[],missing=[],evidence={})=>({status:issues.length?'fail':missing.length?'incomplete':'pass',issues:[...issues,...missing],evidence})
export function recordCheck(result,name,decision) {
  if (!decision || !['pass','fail','incomplete','not-applicable'].includes(decision.status)) throw Error(`Missing explicit predicate for ${name}`)
  if (decision.status==='not-applicable' && !decision.reason?.trim()) throw Error(`Missing capability reason for ${name}`)
  if (result.checks.some(c=>c.name===name)) throw Error(`Duplicate check: ${name}`)
  result.checks.push({name,...decision})
}
export function assertion(issues,evidence={}) {
  if(!Array.isArray(issues)) throw Error('Explicit issues array required')
  return outcome(issues,[],evidence)
}
export function scenarioDecision(checks) {
  if(!checks.length)return outcome([],['Scenario produced no assertions'])
  const failed=checks.filter(c=>c.status==='fail').map(c=>c.name)
  const missing=checks.filter(c=>!['pass','fail','not-applicable'].includes(c.status)).map(c=>c.name)
  return outcome(failed.map(n=>`Failed: ${n}`),missing.map(n=>`Incomplete: ${n}`),{checks:checks.map(c=>c.name)})
}
export function presetStatus(result) {
  const missing=(result.required??[]).filter(name=>!result.checks.some(c=>c.name===name))
  result.missingChecks=missing
  if(result.errors.length||result.checks.some(c=>c.status==='fail'))return 'fail'
  if(!result.required?.length||missing.length||result.checks.some(c=>c.status==='not-applicable'&&result.mustPass?.includes(c.name))||!result.frames.length||result.checks.some(c=>!['pass','not-applicable'].includes(c.status)))return 'incomplete'
  return 'pass'
}
export function reportStatus(report) {
  if(report.errors.length||Object.values(report.presets).some(p=>p.status==='fail'))return 'fail'
  if(!coverageValid(report)||report.blockers?.length||!report.inventory.length||report.inventory.some(k=>{const p=report.presets[k];return p?.status!=='pass'||p.manifest?.id!==`drmvyz.cinema2.${k}`||!Array.isArray(p.checks)||!Array.isArray(p.frames)||!Array.isArray(p.errors)||presetStatus(p)!=='pass'}))return 'incomplete'
  return 'pass'
}
export const fullInventoryStatus=report=>reportStatus(report)==='pass'&&report.scope==='full-inventory'&&report.fullInventory?'pass':report.scope==='full-inventory'?reportStatus(report):'subset-only'
export const reportExitCode=report=>reportStatus(report)==='pass'?0:1

function validFrame(f) {
  return f && Number.isSafeInteger(f.width)&&Number.isSafeInteger(f.height)&&f.width>=3&&f.height>=3&&
    f.data instanceof Uint8Array&&f.data.length===f.width*f.height*3
}
function comparableFrames(frames) {
  return frames.every(validFrame)&&frames.every(f=>f.width===frames[0].width&&f.height===frames[0].height)
}
// Local edge differences reject uniform brightness shifts as physical motion.
// Each 3x3 zone is an ROI; normalize gradients by local intensity to suppress
// exposure-only changes. Use both raw RGB and edge evidence, never phase alone.
function roiDistances(a,b,kind='edges') {
  const scale=f=>{const min=[255,255,255],max=[0,0,0];for(let i=0;i<f.data.length;i++){const c=i%3;min[c]=Math.min(min[c],f.data[i]);max[c]=Math.max(max[c],f.data[i])}return max.map((v,c)=>Math.max(24,v-min[c]))}
  const as=kind==='edges'?scale(a):null,bs=kind==='edges'?scale(b):null
  const zones=Array.from({length:9},()=>({sum:0,changed:0,count:0}))
  const {width:w,height:h}=a
  for(let y=0;y<h-1;y++)for(let x=0;x<w-1;x++){
    const i=(y*w+x)*3,z=zones[Math.floor(y/h*3)*3+Math.floor(x/w*3)]
    let delta=0
    for(let c=0;c<3;c++){
      const k=i+c
      if(kind==='rgb')delta=Math.max(delta,Math.abs(a.data[k]-b.data[k]))
      else for(const offset of [3,w*3]){
        const edge=(d,scale)=>255*(d[k]-d[k+offset])/scale[c]
        delta=Math.max(delta,Math.abs(edge(a.data,as)-edge(b.data,bs)))
      }
    }
    z.sum+=delta;z.changed+=Number(delta>=8);z.count++
  }
  return zones.map(z=>({mean:z.count?z.sum/z.count:0,fraction:z.count?z.changed/z.count:0}))
}
const thresholds=Object.freeze({mean:.25,fraction:.002,noiseMultiplier:2})
function spatialChange(a,aa,b,kind) {
  const noise=roiDistances(a,aa,kind),change=roiDistances(aa,b,kind)
  const passingZones=change.flatMap((v,i)=>v.mean>Math.max(thresholds.mean,noise[i].mean*2)&&v.fraction>Math.max(thresholds.fraction,noise[i].fraction*2)?[i]:[])
  return {noise,change,passingZones,thresholds,kind}
}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
function validConditions(c) {
  try {if(!c||!JSON.parse(c.settings)?.values)return false}catch{return false}
  return c&&typeof c.stage==='string'&&typeof c.fixture==='string'&&typeof c.quality==='string'&&typeof c.settings==='string'&&typeof c.pattern==='string'&&
    Number.isSafeInteger(c.frame)&&c.frame>0&&Number.isSafeInteger(c.stageFrame)&&c.stageFrame>=0&&[c.musicTime,c.visualTime,c.camera?.fovDegrees,c.camera?.rollDegrees].every(Number.isFinite)&&
    [c.camera?.position,c.camera?.target].every(v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite))
}
function matching(a,b,{time=true,settings=true,camera=true}={}) {
  const x=a.conditions,y=b.conditions
  return validConditions(x)&&validConditions(y)&&x.stage===y.stage&&x.fixture===y.fixture&&x.quality===y.quality&&x.pattern===y.pattern&&
    (!settings||x.settings===y.settings)&&(!camera||same(x.camera,y.camera))&&(!time||(x.musicTime===y.musicTime&&x.visualTime===y.visualTime&&x.stageFrame===y.stageFrame&&x.frame===y.frame))
}
export function motionEvidence(a,aa,...samples) {
  if(!samples.length||!comparableFrames([a,aa,...samples])||!matching(a,aa)||samples.some(b=>!matching(aa,b,{time:false})))return outcome([],['Missing or unmatched motion checkpoint'])
  if(samples.some((b,i)=>b.conditions.visualTime<=(i?samples[i-1]:aa).conditions.visualTime||b.conditions.musicTime<=(i?samples[i-1]:aa).conditions.musicTime||b.conditions.frame<=(i?samples[i-1]:aa).conditions.frame))return outcome([],['No controlled time advancement'])
  const observations=samples.map(b=>{
    const spatial=spatialChange(a,aa,b,'edges')
    const phases=Object.keys(aa.motion??{}).filter(k=>Number.isFinite(aa.motion[k])&&Number.isFinite(b.motion?.[k]))
    const changedPhases=phases.filter(k=>Math.abs(aa.motion[k]-b.motion[k])>1e-5)
    return {...spatial,conditions:b.conditions,changedPhases,phases,pass:spatial.passingZones.length>0&&(!phases.length||changedPhases.length>0)}
  })
  const evidence={baseline:[a.conditions,aa.conditions],observations}
  return outcome(observations.some(o=>o.pass)?[]:['No spatial motion above A/A noise with corroborating inspected motion where available'],[],evidence)
}
export function pairwiseEvidence(a,aa,b) {
  if(!comparableFrames([a,aa,b])||!matching(a,aa)||!validConditions(b.conditions)||a.conditions.pattern===b.conditions.pattern||
    !matching({...a,conditions:{...a.conditions,pattern:b.conditions.pattern}},b,{settings:false}))return outcome([],['Unmatched pairwise pattern evidence'])
  // The runner keeps the same activation state and edits only the Pattern.
  // Check the saved values too, excluding exactly the pattern parameter.
  const av=JSON.parse(a.conditions.settings).values,bv=JSON.parse(b.conditions.settings).values
  const edits=Object.keys({...av,...bv}).filter(k=>!same(av[k],bv[k]))
  if(edits.length!==1||av[edits[0]]!==a.conditions.pattern||bv[edits[0]]!==b.conditions.pattern)return outcome([],['Pairwise settings differ beyond selected pattern'])
  const evidence=spatialChange(a,aa,b,'edges')
  return outcome(evidence.passingZones.length?[]:['Patterns visually indistinguishable'],[],{...evidence,conditions:[a.conditions,aa.conditions,b.conditions]})
}
// The synthetic RGB quadrants must contribute actual localized chromatic
// pixels, not just illumination or a resource-ready flag. Projected panels
// can crop/rotate, so require two of the three fixture hues in the changed ROIs.
function fixtureHues(a,b,zones) {
  const counts=[0,0,0],{width:w,height:h}=a
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    if(!zones.includes(Math.floor(y/h*3)*3+Math.floor(x/w*3)))continue
    const i=(y*w+x)*3, rgb=[b.data[i],b.data[i+1],b.data[i+2]],max=Math.max(...rgb),min=Math.min(...rgb),channel=rgb.indexOf(max)
    if(max>=55&&max-min>=35&&max-rgb[(channel+1)%3]>=15&&max-rgb[(channel+2)%3]>=15&&max-a.data[i+channel]>=20)counts[channel]++
  }
  return counts
}
export function sourceVisibility(a,aa,b,{ready,fixture=false,expectedZones=[0,1,2,3,4,5,6,7,8]}={}) {
  if(!comparableFrames([a,aa,b])||!matching(a,aa)||!matching(aa,b)||typeof ready!=='boolean'||!Array.isArray(expectedZones)||!expectedZones.length||expectedZones.some(i=>!Number.isInteger(i)||i<0||i>8))return outcome([],['Missing or unmatched source evidence'])
  const spatial=spatialChange(a,aa,b,'rgb'),zones=spatial.passingZones.filter(i=>expectedZones.includes(i)),hues=fixture?fixtureHues(aa,b,zones):null
  const evidence={...spatial,expectedZones,zones,hues,conditions:[a.conditions,aa.conditions,b.conditions],ready}
  return outcome([!ready&&'Source not ready',!zones.length&&'Ready source has no visible contribution in expected regions',fixture&&hues.filter(n=>n>=Math.max(4,a.width*a.height*.00005)).length<2&&'Fixture chromatic signature absent'].filter(Boolean),[],evidence)
}
export function fallbackEvidence(a,aa,on,removed,identityRestored) {
  if(!comparableFrames([a,aa,on,removed])||!matching(a,aa)||!matching(aa,on)||!matching(aa,removed)||typeof identityRestored!=='boolean')return outcome([],['Missing matched fallback or source identity evidence'])
  const replacement=spatialChange(a,aa,on,'rgb'),residual=spatialChange(a,aa,removed,'rgb')
  return outcome([!identityRestored&&'Incorrect fallback source identity',!replacement.passingZones.length&&'Replacement was never visibly distinct',residual.passingZones.length&&'Removed source did not restore reference appearance'].filter(Boolean),[],{replacement,residual,identityRestored,conditions:[a.conditions,aa.conditions,on.conditions,removed.conditions]})
}
export function triggerEvidence(samples,patterns,selected,savedRetained,expectedNext) {
  const names=['before','takeover','noEvent','stale','fresh','duplicate','hold']
  if(!samples||names.some(k=>!samples[k]||typeof samples[k].active!=='string'||typeof samples[k].saved!=='string'||typeof samples[k].enabled!=='boolean'||samples[k].trigger!=='drop')||typeof savedRetained!=='boolean'||!patterns.includes(selected)||patterns.length<2)return outcome([],['Missing pattern/trigger observations'])
  if(names.some(k=>typeof samples[k].effectiveChange!=='boolean'||typeof samples[k].effectiveTrigger!=='string'))return outcome([],['Missing effective trigger authority inspection'])
  const event=(k)=>samples[k].event?.semanticMoments?.[0]
  const modes={before:'fresh',takeover:'duplicate',noEvent:'none',stale:'stale',fresh:'fresh',duplicate:'duplicate',hold:'none'}
  if(names.some(k=>samples[k].event?.mode!==modes[k]||!Number.isFinite(samples[k].event?.publicationSequence)||!Number.isFinite(samples[k].musicTime)))return outcome([],['Missing explicit trigger publication metadata'])
  if(!event('before')||!event('takeover')||!event('fresh')||!event('duplicate')||!event('stale'))return outcome([],['Missing fresh/stale/duplicate event identities'])
  const fresh=samples.fresh.active
  const issues=[!patterns.includes(samples.before.active)||samples.before.active===selected||samples.before.saved===selected?'Before-takeover state was not distinct and eligible':null,
    ...names.filter(k=>samples[k].effectiveChange!==true||samples[k].effectiveTrigger!=='drop').map(k=>`${k}: effective authority differs from saved trigger`),
    event('before').id!==event('takeover').id||event('fresh').id!==event('duplicate').id||event('fresh').id===event('before').id?'Fixture duplicate/fresh identities invalid':null,
    event('stale').timeSec>=samples.noEvent.musicTime||event('fresh').timeSec!==samples.fresh.musicTime?'Fixture stale/fresh timing invalid':null,
    event('noEvent')||event('hold')?'No-event fixture published an event':null,
    ...names.filter(k=>k!=='before'&&(samples[k].saved!==selected||!samples[k].enabled)).map(k=>`${k}: saved authority changed`),
    ...['takeover','noEvent','stale'].filter(k=>samples[k].active!==selected).map(k=>`${k}: manual pattern not held`),
    (!patterns.includes(fresh)||fresh===selected||(expectedNext&&fresh!==expectedNext))&&'Fresh event did not select an eligible next pattern',
    ...['duplicate','hold'].filter(k=>samples[k].active!==fresh).map(k=>`${k}: repeated/absent event changed pattern`),!savedRetained&&'Saved Pattern Change not retained'].filter(Boolean)
  return outcome(issues,expectedNext?[]:['Exact authored transition policy not registered for this preset'],{samples,selected,expectedNext,patterns,savedRetained})
}
export function recoveryEvidence(recovery,before,after) {
  if(!recovery?.supported)return outcome([],['WEBGL_lose_context unavailable'])
  if(!before?.d?.runtime||!after?.d?.runtime||!recovery.lost?.runtime||!recovery.restoredSnapshot?.runtime||!validFrame(after)||!after.capture||!after.pixels)return outcome([],['Missing context lifecycle or fresh frame evidence'])
  const old=before.d.runtime,now=after.d.runtime,lost=recovery.lost.runtime,restored=recovery.restoredSnapshot.runtime
  const snapshots=[old,now,lost,restored]
  if(snapshots.some(d=>!Number.isSafeInteger(d.contextGeneration)||!Number.isSafeInteger(d.frameCount)||!Number.isSafeInteger(d.resources?.activeAnimationFrameCount)||!Number.isSafeInteger(d.resources?.activeWebGLContextCount))||!recovery.lost.modules||!recovery.lost.resources||!after.d.resources||!Number.isFinite(after.d.resources.reconstructedAllocationCount)||!Number.isFinite(recovery.lost.resources.reconstructedAllocationCount))return outcome([],['Invalid lifecycle counters'])
  const issues=[lost.phase!=='context-lost'&&'Loss phase not observed',lost.resources.activeAnimationFrameCount!==0&&'Lost generation still scheduled',
    recovery.lost.modules.activeResourceLeaseCount!==0&&'Lost module leases retained',(recovery.lost.resources.contextAvailable!==false||recovery.lost.resources.estimatedGpuMemoryBytes!==0||recovery.lost.resources.pooledAllocationCount!==0)&&'Lost generation retained resident render allocations',
    after.d.resources.contextAvailable!==true&&'Restored resource manager unavailable',
    (recovery.lost.resources.activeLeaseCount>0&&after.d.resources.reconstructedAllocationCount<=recovery.lost.resources.reconstructedAllocationCount)&&'Persistent render targets not reconstructed',
    now.contextGeneration!==old.contextGeneration+1&&'Context generation did not advance exactly once',restored.contextGeneration!==now.contextGeneration&&'Unexpected recovery generation',
    now.phase!=='running'&&'Recovered runtime not running',now.resources.activeAnimationFrameCount!==1&&'Recovered runtime did not schedule next frame',now.frameCount<=restored.frameCount&&'No fresh production frame',now.resources.activeWebGLContextCount!==1&&'Unexpected WebGL ownership',
    after.pixels?.uniform&&'Recovered frame uniform',...technicalIssues(after.capture)].filter(Boolean)
  return outcome(issues,[],{recovery,before:old,after:now})
}

// Camera-only displacement uses fixed world probes, never moving scene geometry.
// This is a projection diagnostic, not proof that the actual source is unclipped.
export function cameraSequenceEvidence(frames,{expect='measure',reference,safety={}}={}) {
  if(!Array.isArray(frames)||frames.length<2)return outcome([],['Missing camera sequence'])
  const cameras=frames.map(f=>f.d?.camera?.camera)
  const valid=c=>c&&[c.position,c.target].every(v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite))&&
    [c.near,c.far,c.fovDegrees,c.rollDegrees,c.aspect].every(Number.isFinite)&&Array.isArray(c.viewProjectionMatrix)&&c.viewProjectionMatrix.length===16&&c.viewProjectionMatrix.every(Number.isFinite)
  if(cameras.some(c=>!valid(c))||frames.some(f=>!Number.isFinite(f.width)||!Number.isFinite(f.height)||f.width!==frames[0].width||f.height!==frames[0].height))return outcome([],['Missing comparable camera poses, lenses or matrices'])
  const first=cameras[0],distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i])),depth=distance(first.position,first.target)
  const direction=first.target.map((v,i)=>(v-first.position[i])/Math.max(depth,1e-9))
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
  const rightRaw=cross(direction,Math.abs(direction[1])>.95?[0,0,1]:[0,1,0]),right=rightRaw.map(x=>x/Math.max(1e-9,Math.hypot(...rightRaw))),up=cross(right,direction)
  const probes=[first.target,...[-1,1].flatMap(side=>[-.15,.15].map(z=>first.target.map((v,i)=>v+depth*(side*.12*right[i]+.08*up[i]+z*direction[i]))))]
  const project=(c,p)=>{const m=c.viewProjectionMatrix,v=[...p,1],q=[0,1,2,3].map(r=>v.reduce((n,x,i)=>n+x*m[i*4+r],0));return q[3]>1e-9?[q[0]/q[3]*frames[0].width/2,q[1]/q[3]*frames[0].height/2,q[2]/q[3]]:null}
  const initial=probes.map(p=>project(first,p)), projected=cameras.map(c=>probes.map(p=>project(c,p)))
  const inView=p=>p&&Math.abs(p[0])<=frames[0].width/2&&Math.abs(p[1])<=frames[0].height/2&&Math.abs(p[2])<=1
  const maxPixels=Math.max(0,...projected.flatMap(row=>row.map((p,i)=>inView(p)&&inView(initial[i])?distance(p.slice(0,2),initial[i].slice(0,2)):0)))
  const poseDelta=Math.max(...cameras.map(c=>Math.max(distance(c.position,first.position),distance(c.target,first.target),Math.abs(c.fovDegrees-first.fovDegrees),Math.abs(c.rollDegrees-first.rollDegrees),Math.abs(c.near-first.near),Math.abs(c.far-first.far))))
  const issues=[]
  for(const [i,c] of cameras.entries()){
    const target=project(c,c.target)
    if(c.near<=0||c.far<=c.near||c.aspect<=0||c.fovDegrees<=0||c.fovDegrees>=180||distance(c.position,c.target)<=1e-6||!target||Math.abs(target[2])>1+1e-5)issues.push(`Camera ${i}: invalid lens or target outside depth clip`)
    if(c.near<(safety.minNear??0)-1e-6||c.far>(safety.maxFar??Infinity)+1e-6||c.fovDegrees<(safety.minFovDegrees??0)-1e-6||c.fovDegrees>(safety.maxFovDegrees??180)+1e-6)issues.push(`Camera ${i}: authored lens safety exceeded`)
  }
  if(expect==='locked'&&poseDelta>1e-6)issues.push('Locked camera pose/lens moved')
  if(expect==='moving'&&(poseDelta<=1e-6||maxPixels<1))issues.push('Enabled camera has no measurable authored view displacement (1 px minimum)')
  if(expect==='reduced'&&(!Number.isFinite(reference?.maxPixels)||reference.maxPixels<1))return outcome(issues,['Missing measurable full-motion reference'],{poseDelta,maxPixels,projected})
  if(expect==='reduced'&&maxPixels>reference.maxPixels+1)issues.push('Reduced motion exceeds full-motion displacement')
  return outcome(issues,[],{poseDelta,maxPixels,projected,thresholdPixels:1,probes,expect,cameras:cameras.map(({position,target,fovDegrees,rollDegrees,near,far})=>({position,target,fovDegrees,rollDegrees,near,far}))})
}

// Canonical event routing is observed from the production audio bridge. The
// expected cycle is authored, not inferred from a successful transition.
export function triggerSequenceEvidence(samples,trigger,expectedNext) {
  const names=['arm','negative','fresh','duplicate','hold','paused','resume','disabled','disabledEvent']
  if(names.some(k=>!samples?.[k]||typeof samples[k].active!=='string'||typeof samples[k].saved!=='string'||typeof samples[k].effectiveChange!=='boolean'||samples[k].effectiveTrigger!==trigger||samples[k].trigger!==trigger))return outcome([],['Missing effective trigger matrix observations'],{samples,trigger})
  const {arm,negative,fresh,duplicate,hold,paused,resume,disabled,disabledEvent}=samples
  if(!negative.event?.explicit||!fresh.event?.explicit||!duplicate.event?.explicit||!disabledEvent.event?.explicit||typeof expectedNext!=='string')return outcome([],['Missing fixture identity or authored next-pattern policy'],{samples,trigger,expectedNext})
  const issues=[]
  if(negative.event.canonical!==null||negative.active!==arm.active)issues.push('Nonqualifying event advanced pattern or qualified unexpectedly')
  if(typeof fresh.event.canonical!=='string'||fresh.active!==expectedNext||fresh.active===negative.active)issues.push('Qualifying event did not advance exactly to authored successor')
  if(duplicate.event.explicit.id!==fresh.event.explicit.id||duplicate.event.explicit.replay!==true||duplicate.event.canonical!==null&&duplicate.event.canonical!==fresh.event.canonical||duplicate.active!==fresh.active)issues.push('Duplicate identity advanced pattern or fixture was not a duplicate')
  if([hold,paused,resume].some(v=>v.active!==fresh.active))issues.push('Pattern changed without qualifying event during hold/pause/resume')
  if([arm,negative,fresh,duplicate,hold,paused,resume].some(v=>v.enabled!==true||v.effectiveChange!==true))issues.push('Enabled manual authority was not retained')
  if([disabled,disabledEvent].some(v=>v.enabled!==false||v.effectiveChange!==false||v.active!==v.saved)||typeof disabledEvent.event.canonical!=='string')issues.push('Pattern Change off did not hold through a qualifying event')
  if(names.some(k=>samples[k].saved!==arm.saved))issues.push('Saved pattern changed during trigger sequence')
  return outcome(issues,[],{samples,trigger,expectedNext})
}

// Matched camera OFF/OFF/ON sequences: reject unpaired times, unrelated
// parameter changes and differing inspected geometry phases. Actual pixels
// corroborate the independent fixed-probe displacement, not the reverse.
export function cameraRenderEvidence(off,repeat,on,cameraIds) {
  if(!Array.isArray(off)||!Array.isArray(repeat)||!Array.isArray(on)||!off.length||off.length!==repeat.length||off.length!==on.length||!cameraIds?.length)return outcome([],['Missing camera render comparison'])
  const observations=[]
  for(let i=0;i<off.length;i++){
    const [a,aa,b]=[off[i],repeat[i],on[i]]
    if(!comparableFrames([a,aa,b])||!matching(a,aa)||!matching(a,b,{settings:false,camera:false}))return outcome([],['Unmatched camera render checkpoint'])
    const withoutCamera=f=>{const v=JSON.parse(f.conditions.settings).values;for(const id of cameraIds)delete v[id];return v}
    if(!same(withoutCamera(a),withoutCamera(b))||!same(a.motion,b.motion)||!same(a.motion,aa.motion))return outcome([],['Geometry phases or non-camera settings differ in camera comparison'])
    const spatial=spatialChange(a,aa,b,'edges')
    observations.push({...spatial,stage:a.conditions.stage,frame:a.conditions.frame})
  }
  return outcome(observations.some(v=>v.passingZones.length)?[]:['Camera change not visible above repeated OFF capture noise'],[],{observations,cameraIds})
}

import { describe, expect, it } from 'vitest'
import { ARTIFACT_PRESET_MANIFESTS, artifactPresetId } from '../presets/Cinema2ArtifactPresets'
import { ARTIFACT_SPECS } from '../modules/artifactSculptures/ArtifactSpecs'
import { defaults, SIGNALS, lightPosition, type ArtifactState } from '../modules/artifactSculptures/ArtifactDomain'
import { cathedral, mathematicalChamber, containmentVault, alienSanctuary, type Architecture } from '../modules/artifactSculptures/ArtifactArchitecture'
import { ArtifactSelection, type ArtifactSelectionInput } from '../modules/artifactSculptures/ArtifactSelection'
import { artifactModuleTypeId } from '../modules/Cinema2ArtifactNativeModule'
import { cinema2NativeModuleRegistry } from '../modules/Cinema2ModuleRegistry'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { computeCinema2AutoCoverage, withCinema2AutoCoverage } from '../presets/Cinema2AutoCoverage'
import { CINEMA2_AFTERHOURS_TRIGGER_IDS } from '../modules/Cinema2AfterhoursNativeModule'

for(const [index,spec] of ARTIFACT_SPECS.entries()) describe(`${spec.id} native reference`,()=>{
 const manifest=ARTIFACT_PRESET_MANIFESTS[index]!
 const state:ArtifactState={values:defaults(spec),pattern:spec.patterns[0]!,previous:spec.patterns[0]!,transition:1,phase:1,motion:.8,flash:.28,silence:0,projectionPhase:0,extraEnabled:true,palette:{...spec.palette}}
 const base:ArtifactSelectionInput={authored:spec.patterns[0]!,revision:0,patternChange:true,trigger:'beat',event:null,auto:false,buildEvent:null,dropEvent:null,time:0,beat:0,active:true,reset:false}
 it('registers and compiles the authored and Auto-covered manifest',()=>{
  expect(cinema2NativeModuleRegistry.get(artifactModuleTypeId(spec.id),1)).not.toBeNull()
  expect(cinema2NativePresetRegistry.get(artifactPresetId(spec.id))).not.toBeNull()
  expect(validateCinema2PresetAuthoringConventions({role:'reference',manifest})).toEqual({ok:true,diagnostics:[]})
  for(const m of [manifest,withCinema2AutoCoverage(manifest)]){const result=compileCinema2NativePreset(m,{availableCapabilities:m.capabilities!.map(c=>c.id)});expect(result.ok,JSON.stringify(result.diagnostics)).toBe(true)}
  expect(computeCinema2AutoCoverage(manifest).skipped).toEqual([])
 })
 it('exposes all patterns, canonical triggers, six independent color roles and shared mood policy',()=>{
  const params=manifest.parameters!,find=(name:string)=>params.find(p=>p.id===`${spec.id}-${name}`)!
  expect(new Set(params.filter(p=>p.section==='Design').map(p=>p.designParentGroup))).toEqual(new Set(['master-controls','design','effects','palette']))
  expect(find('pattern').options!.map(o=>o.value)).toEqual(spec.patterns)
  expect(find('trigger').options!.map(o=>o.value)).toEqual(CINEMA2_AFTERHOURS_TRIGGER_IDS)
  expect(find('trigger').visibleWhen).toEqual([{kind:'parameter-equals',parameterId:`${spec.id}-pattern-change`,value:true}])
  expect(find('auto-performance').metadata?.moodPolicy).toBe('autoPerformance')
  expect(params.filter(p=>p.designParentGroup==='palette'&&p.type==='color')).toHaveLength(6)
 })
 it('emits finite, bounded, different structural geometry at three quality levels',()=>{
  const signatures=new Set<string>()
  for(const pattern of spec.patterns)for(const quality of ['low','medium','high']){
   const s={...state,pattern,previous:pattern,values:{...state.values,...Object.fromEntries(Object.keys(SIGNALS).map(k=>[k,1]))}}
   const coords:number[]=[];let rods=0
   spec.geometry(s,(a,b,r,role,energy)=>{expect([...a,...b,r,energy??1].every(Number.isFinite)).toBe(true);expect(Math.max(Math.hypot(...a),Math.hypot(...b))).toBeLessThan(12);coords.push(...a,...b,r,role??0);rods++},quality)
   expect(rods).toBeGreaterThan(100);expect(rods).toBeLessThan(4600)
   if(quality==='high')signatures.add(JSON.stringify(coords))
   expect(lightPosition(spec,s,0)).not.toEqual(lightPosition(spec,s,1))
  }
  expect(signatures.size).toBe(8)
 })
 it('preserves finite physical assemblies at simultaneous control extremes and during transitions',()=>{
  for(const pattern of spec.patterns)for(const extreme of ['min','max'] as const)for(const transition of [0,.5,1]){
   const values={...defaults(spec),...Object.fromEntries(spec.controls.map(c=>[c.key,c[extreme]])),...Object.fromEntries(Object.keys(SIGNALS).map(k=>[k,1])),density:1,coreScale:1.3}
   const counts=[0,0,0]
   spec.geometry({...state,pattern,previous:spec.patterns[0]!,transition,phase:3,motion:1,values},(a,b,r,role=0)=>{
    expect([...a,...b,r].every(Number.isFinite)).toBe(true)
    expect(Math.min(a[1],b[1])-r).toBeGreaterThan(spec.room.floor)
    expect(Math.max(Math.hypot(...a),Math.hypot(...b))+r).toBeLessThan(12)
    counts[role]++
   },'high')
   expect(counts.every(n=>n<4600)).toBe(true)
  }
 })
 it('moves physical non-emissive geometry with fixed camera and no projection phase change',()=>{
  const geometry=(s:ArtifactState)=>{const points:number[]=[];spec.geometry(s,(a,b,r,role=0)=>{if(role!==2)points.push(...a,...b,r)},'medium');return points}
  const pattern=spec.patterns[1]!,a={...state,pattern,previous:pattern,transition:1,phase:.1}
  const b={...a,phase:3,values:{...a.values,bassPressure:1,kickAccent:1,snareAccent:1,dropAccent:1}}
  expect(geometry(a)).not.toEqual(geometry(b))
 })
 it('holds, advances, deduplicates and respects manual takeover for eleven canonical triggers',()=>{
  for(const trigger of CINEMA2_AFTERHOURS_TRIGGER_IDS){
   const sel=new ArtifactSelection(spec);sel.update({...base,trigger})
   expect(sel.update({...base,trigger,event:'a'}).base).toBe(spec.patterns[1]);expect(sel.update({...base,trigger,event:'a'}).base).toBe(spec.patterns[1])
   expect(sel.update({...base,trigger,event:'a',authored:spec.patterns[3]!,revision:1}).base).toBe(spec.patterns[3]);expect(sel.update({...base,trigger,event:'b',authored:spec.patterns[3]!,revision:1}).base).toBe(spec.patterns[4])
   expect(sel.update({...base,trigger,event:'c',patternChange:false}).base).toBe(spec.patterns[0]);sel.reset();expect(sel.update({...base,trigger,event:'c'}).base).toBe(spec.patterns[0])
  }
 })
 it('performs bounded temporary build/drop overrides and returns to the base pattern',()=>{
  const sel=new ArtifactSelection(spec);sel.update({...base,auto:true})
  expect(sel.update({...base,auto:true,buildEvent:'build',time:.5}).performing).toBe(spec.build)
  const drop=sel.update({...base,auto:true,event:'beat',dropEvent:'drop',time:1});expect(drop.performing).toBe(spec.drop);expect(drop.base).toBe(spec.patterns[1])
  expect(sel.update({...base,auto:true,time:3}).performing).toBe(spec.patterns[1]);expect(sel.update({...base,auto:false,time:4}).performing).toBe(spec.patterns[0])
 })
})

it('four environments remain geometrically distinct without materials or sculptures',()=>{
 const signatures=new Set<string>()
 const builders=[cathedral,mathematicalChamber,containmentVault,alienSanctuary]
 for(const builder of builders){
  const primitives:unknown[]=[]
  const a:Architecture={box:(p,size,_role,rotation)=>primitives.push(['box',p,size,rotation]),beam:(p,q,r)=>primitives.push(['beam',p,q,r]),disk:(p,r,h,_role,n)=>primitives.push(['disk',p,r,h,n]),ring:(p,r,h,_role,n)=>primitives.push(['ring',p,r,h,n])}
  builder(a,-8);expect(primitives.length).toBeGreaterThan(30);signatures.add(JSON.stringify(primitives))
 }
 expect(signatures.size).toBe(4)
})

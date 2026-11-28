import { describe, expect, it } from 'vitest'
import { CINEMA2_PURITY_PRESET_MANIFEST as manifest, CINEMA2_PURITY_PRESET_ID } from '../presets/Cinema2PurityPreset'
import { CINEMA2_PURITY_NATIVE_MODULE_TYPE_ID } from '../modules/Cinema2PurityNativeModule'
import { cinema2NativeModuleRegistry } from '../modules/Cinema2ModuleRegistry'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { withCinema2AutoCoverage } from '../presets/Cinema2AutoCoverage'
import { CINEMA2_AUTO_COVERAGE_EXEMPT } from '../presets/Cinema2AutoCoverageExemptions'
import { PURITY_PATTERNS, PuritySelection, type PuritySelectionInput } from '../modules/purity/Cinema2PurityPatterns'
import { PurityGeometry, PURITY_MAX_INSTANCES, PURITY_INSTANCE_STRIDE, type PurityVisualState } from '../modules/purity/Cinema2PurityRenderer'
import { PURITY_ROUTE, PURITY_ZONES, purityZoneAt } from '../modules/purity/Cinema2PurityMaze'
import { purityBars } from '../modules/purity/Cinema2PurityArchitecture'
import { Cinema2CameraRuntime } from '../spatial/Cinema2CameraRuntime'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { Cinema2FinalValueResolver } from '../parameters/Cinema2TargetRuntime'
import { Cinema2SpatialRuntime } from '../spatial/Cinema2SpatialRuntime'
import type { Cinema2ParameterId } from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_AFTERHOURS_TRIGGER_IDS } from '../modules/Cinema2AfterhoursNativeModule'

const defaults=manifest.modules![0]!.parameters!
const state:PurityVisualState={number:name=>Number(defaults[name]??0),enabled:name=>defaults[name]!==false,pattern:'ignition',previous:'ignition',transition:1,travel:.4,chase:.9,wave:.5,segments:22,motion:.75,flash:0,silence:0}
const base:PuritySelectionInput={authored:'ignition',editRevision:0,enabled:true,trigger:'beat',event:null,auto:false,buildEvent:null,dropEvent:null,timeSec:0,beats:0,playing:true,reset:false}
const values=(g:PurityGeometry)=>g.data.slice(0,g.count*PURITY_INSTANCE_STRIDE)

describe('PURITY native review preset',()=>{
  it('registers and compiles native and full catalog-covered manifests',()=>{
    expect(cinema2NativeModuleRegistry.get(CINEMA2_PURITY_NATIVE_MODULE_TYPE_ID,1)).not.toBeNull()
    expect(cinema2NativePresetRegistry.get(CINEMA2_PURITY_PRESET_ID)).not.toBeNull()
    expect(validateCinema2PresetAuthoringConventions({role:'keeper',manifest})).toEqual({ok:true,diagnostics:[]})
    for(const candidate of [manifest,withCinema2AutoCoverage(manifest,{exempt:CINEMA2_AUTO_COVERAGE_EXEMPT.purity})]){
      const result=compileCinema2NativePreset(candidate,{availableCapabilities:candidate.capabilities!.map(c=>c.id)})
      expect(result.ok,result.diagnostics.map(d=>`${d.path}: ${d.message}`).join('\n')).toBe(true)
    }
  })
  it('uses four parent groups, shared trigger list, conditional visibility, mood policy and seven independent palette roles',()=>{
    const params=manifest.parameters!,find=(name:string)=>params.find(p=>p.id===`purity-${name}`)!
    expect(new Set(params.filter(p=>p.section==='Design').map(p=>p.designParentGroup))).toEqual(new Set(['master-controls','design','effects','palette']))
    expect(find('pattern').options!.map(o=>o.value)).toEqual(PURITY_PATTERNS)
    expect(find('trigger').options!.map(o=>o.value)).toEqual(CINEMA2_AFTERHOURS_TRIGGER_IDS)
    expect(find('trigger').visibleWhen).toEqual([{kind:'parameter-equals',parameterId:'purity-pattern-change',value:true}])
    expect(find('bpm-sync').designParentGroup).toBe('master-controls')
    expect(find('auto-performance').metadata?.moodPolicy).toBe('autoPerformance')
    expect(find('pattern-change').metadata?.moodPolicy).toBe('patternChange')
    expect(find('trigger').metadata?.moodPolicy).toBe('trigger')
    expect(params.filter(p=>p.designParentGroup==='palette')).toHaveLength(7)
    expect(manifest.effects!.map(e=>e.typeId)).toEqual(['reflective-floor','volumetric-atmosphere','hdr-bloom','glare','cinematic-finish'])
  })
  it('keeps world geometry bounded across all patterns, quality tiers and dimension extremes',()=>{
    const g=new PurityGeometry()
    for(const segments of [10,16,22])for(const pattern of PURITY_PATTERNS)for(const size of [2.8,5.5]){
      g.update({...state,segments,pattern,previous:pattern,number:k=>k==='tunnelWidth'?size:k==='frameThickness'?.32:k==='tunnelDepth'?1.5:state.number(k)})
      expect(g.count).toBeGreaterThan(0);expect(g.count).toBeLessThan(PURITY_MAX_INSTANCES)
      expect(values(g).every(Number.isFinite)).toBe(true)
      expect(g.pattern).toBe(PURITY_PATTERNS.indexOf(pattern))
    }
  })
  it('keeps stationary geometry, modulates light phase, respects emitter and flash permissions',()=>{
    const g=new PurityGeometry();g.update(state);const before=values(g)
    g.update({...state,travel:1.3});expect(values(g)).toEqual(before)
    g.update({...state,wave:1.2});expect(values(g)).not.toEqual(before)
    g.update({...state,enabled:name=>!['perimeterLighting','recessedFixtures'].includes(name)})
    for(let i=0;i<g.count;i++)expect(g.data[i*PURITY_INSTANCE_STRIDE+7]).toBeLessThan(2)
    const number=(name:string)=>['snareAccent','dropAccent','kickAccent'].includes(name)?1:state.number(name)
    g.update({...state,number,flash:0});const off=values(g)
    g.update({...state,number,flash:1});expect(values(g)).not.toEqual(off)
    g.update({...state,number,flash:0});expect(values(g)).toEqual(off)
  })
  it('defines eight distinct architectural silhouettes and eighteen stable patterns',()=>{
    expect(PURITY_PATTERNS).toHaveLength(18)
    expect(new Set(PURITY_ZONES.map(zone=>JSON.stringify(purityBars(zone,0)))).size).toBe(8)
    expect(manifest.cameras![0]!.rig).toMatchObject({kind:'fly',loop:true,points:PURITY_ROUTE})
  })
  it('traverses all eight zones without crossing a housing, holds on lockoff and resumes without resetting the path',()=>{
    const compiled=compileCinema2NativePreset(manifest,{availableCapabilities:manifest.capabilities!.map(c=>c.id)})
    if(!compiled.ok)throw new Error(JSON.stringify(compiled.diagnostics))
    const plan=compiled.plan, parameters=new Cinema2ParameterState(plan.parameters)
    const resolver=new Cinema2FinalValueResolver(plan.targets,{resolveBaseValue:t=>t.parameterId==null?t.authoredBaseValue:parameters.getValue(t.parameterId)})
    const spatial=new Cinema2SpatialRuntime(plan.scene,plan.targets.targets,resolver)
    const camera=new Cinema2CameraRuntime(plan,parameters,resolver,spatial)
    const set=(id:string,value:string|number)=>expect(parameters.setPersistentValue(`purity-${id}` as Cinema2ParameterId,value).ok).toBe(true)
    set('traversal-mode','run');set('travel-speed',2);set('motion-amount',1);set('head-bob',1);set('camera-sway',.5)
    let time=0
    const tick=()=>{time+=.05;return camera.update({frameId:Math.round(time*20)+1,timestampMs:time*1000,deltaTimeSec:.05,elapsedTimeSec:time,viewport:{width:1280,height:720,dpr:1},contextGeneration:1,audio:null,director:null})}
    const g=new PurityGeometry()
    for(const layout of ['mixed','angular','geometric','minimal']){
      // Supply every bay for collision checks by updating against the current camera when needed.
      camera.reset();let previous:readonly number[]|null=null;const zones=new Set<number>()
      for(let i=0;i<1200;i++){
        const c=tick(),[x,y,z]=c.position;zones.add(purityZoneAt(x,z))
        if(previous)expect(Math.hypot(x-previous[0]!,y-previous[1]!,z-previous[2]!)).toBeLessThan(.5)
        previous=c.position
        // Geometry is static; refresh the conservative distance culling only every second.
        if(i%20===0)g.update({...state,layout,cameraPosition:c.position,number:k=>k==='tunnelWidth'?2.8:k==='tunnelDepth'?.75:k==='frameThickness'?.32:state.number(k)})
        for(let j=0;j<g.count;j++){
          const a=j*PURITY_INSTANCE_STRIDE,d=g.data;if(d[a+7]!>=2)continue
          const dx=x-d[a]!,dy=y-d[a+1]!,dz=z-d[a+2]!,yaw=d[a+12]!,roll=d[a+3]!
          const rx=Math.cos(yaw)*dx-Math.sin(yaw)*dz,rz=Math.sin(yaw)*dx+Math.cos(yaw)*dz
          const lx=Math.cos(roll)*rx+Math.sin(roll)*dy,ly=-Math.sin(roll)*rx+Math.cos(roll)*dy
          if(Math.abs(lx)<d[a+4]!/2+.15&&Math.abs(ly)<d[a+5]!/2+.15&&Math.abs(rz)<d[a+6]!/2+.15)throw new Error(`Camera collision in ${layout}, frame ${i}, housing ${j}`)
        }
      }
      expect(zones.size).toBe(8)
    }
    const before=tick();set('motion-safety','lockoff');const held=tick();expect(held.pathDistance).toBe(before.pathDistance);expect(held.pathVelocity).toBe(0)
    expect(tick().pathDistance).toBe(held.pathDistance)
    set('motion-safety','full');expect(tick().pathDistance!).toBeGreaterThanOrEqual(held.pathDistance!)
    set('traversal-mode','walk');const walk=tick();expect(walk.pathDistance!).toBeGreaterThanOrEqual(held.pathDistance!)
    set('travel-speed',0);const stopped=tick();expect(tick().pathDistance).toBe(stopped.pathDistance)
    camera.reset();expect(tick().pathDistance).toBe(0)
    camera.dispose();spatial.dispose()
  },15000)
  it('deduplicates all eleven event IDs, preserves manual pattern change, and resets to authored pattern',()=>{
    for(const trigger of CINEMA2_AFTERHOURS_TRIGGER_IDS){
      const select=new PuritySelection();select.update({...base,trigger})
      expect(select.update({...base,trigger,event:'new'}).base).toBe('monolith')
      expect(select.update({...base,trigger,event:'new'}).base).toBe('monolith')
      expect(select.update({...base,trigger,authored:'matrix',editRevision:1,event:'new'}).base).toBe('matrix')
      expect(select.update({...base,trigger,authored:'matrix',editRevision:1,event:'next'}).base).toBe('wireframe')
      select.reset();expect(select.update({...base,trigger,authored:'matrix',editRevision:1,event:'next'}).base).toBe('matrix')
    }
  })
  it('temporarily substitutes build/drop patterns while base advances and restores the current base',()=>{
    const select=new PuritySelection();select.update({...base,auto:true})
    const build=select.update({...base,auto:true,buildEvent:'build1',timeSec:.5});expect(build.performing).toBe('cascade')
    const drop=select.update({...base,auto:true,event:'beat1',dropEvent:'drop1',timeSec:1});expect(drop.performing).toBe('monolith');expect(drop.base).toBe('monolith')
    expect(select.update({...base,auto:true,event:'beat2',timeSec:1.5}).base).toBe('strata')
    expect(select.update({...base,auto:true,timeSec:3}).performing).toBe('strata')
    expect(select.update({...base,auto:false,authored:'spine',editRevision:1,timeSec:4}).performing).toBe('spine')
  })
})

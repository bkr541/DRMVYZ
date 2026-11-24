import { describe,expect,it } from 'vitest'
import { CINEMA2_HONEY_PRESET_MANIFEST as manifest,honeyParameterId } from '../presets/Cinema2HoneyPreset'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from '../presets/Cinema2AfterhoursPreset'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { computeCinema2AutoCoverage,withCinema2AutoCoverage } from '../presets/Cinema2AutoCoverage'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { createCinema2DesignParentGroupModel } from '../parameters/Cinema2InspectorModel'
import { Cinema2FinalValueResolver } from '../parameters/Cinema2TargetRuntime'
import { Cinema2SpatialRuntime } from '../spatial/Cinema2SpatialRuntime'
import { Cinema2CameraRuntime } from '../spatial/Cinema2CameraRuntime'
import type { Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'
const compiled=compileCinema2NativePreset(withCinema2AutoCoverage(manifest));if(!compiled.ok)throw Error(JSON.stringify(compiled.diagnostics));const plan=compiled.plan
const controls=(state:Cinema2ParameterState)=>createCinema2DesignParentGroupModel(plan,state.getSnapshot()).flatMap(parent=>[...parent.controls,...parent.groups.flatMap(group=>group.controls)])
const get=(state:Cinema2ParameterState,key:string)=>controls(state).find(c=>c.definition.id===honeyParameterId(key))
describe('HONEY shared inspector and camera controls',()=>{
  it('retains four parents, eight patterns, canonical trigger options, conditional visibility and shared locks',()=>{
    const state=new Cinema2ParameterState(plan.parameters);state.setPersistentValue(honeyParameterId('auto-performance'),false)
    expect(createCinema2DesignParentGroupModel(plan,state.getSnapshot()).map(g=>g.id)).toEqual(['master-controls','design','effects','palette'])
    expect(get(state,'pattern')?.definition.options).toHaveLength(8);expect(get(state,'trigger')).toBeUndefined()
    state.setPersistentValue(honeyParameterId('pattern-change'),true);expect(get(state,'trigger')?.definition.options).toEqual(CINEMA2_AFTERHOURS_TRIGGER_OPTIONS)
    state.setPersistentValue(honeyParameterId('auto-performance'),true);expect(get(state,'motion')?.enabled).toBe(false);expect(get(state,'face')?.enabled).toBe(true)
    expect(get(state,'auto-performance')?.enabled).toBe(true);expect(get(state,'bpm-sync')?.enabled).toBe(true)
    expect(computeCinema2AutoCoverage(withCinema2AutoCoverage(manifest)).drives).toHaveLength(0)
    expect(computeCinema2AutoCoverage(withCinema2AutoCoverage(manifest)).skipped.filter(s=>s.reason==='unbound')).toHaveLength(0)
  })
  it('round-trips every numeric minimum and maximum and restores authored defaults',()=>{
    const state=new Cinema2ParameterState(plan.parameters)
    for(const p of manifest.parameters??[]){if(p.type!=='float')continue
      for(const v of [p.min!,p.max!]){expect(state.setPersistentValue(p.id,v).ok).toBe(true);const restored=new Cinema2ParameterState(plan.parameters);expect(restored.restore(state.serialize()).ok).toBe(true);expect(restored.getValue(p.id)).toBe(v)}
      expect(state.reset(p.id).ok).toBe(true);expect(state.getValue(p.id)).toBe(p.defaultValue)
    }
  })
  it('round-trips every palette, toggle and enum option and preserves the complete shared lock inventory',()=>{
    const state=new Cinema2ParameterState(plan.parameters)
    for(const p of manifest.parameters??[]){
      if(p.persistence!=='preset'||p.type==='float')continue
      const candidates=p.type==='color'?[[0,0,0,1],[1,1,1,1]]:p.type==='boolean'?[false,true]:p.type==='enum'?(p.options??[]).map(o=>o.value):[]
      for(const value of candidates){
        expect(state.setPersistentValue(p.id,value).ok).toBe(true)
        const restored=new Cinema2ParameterState(plan.parameters);expect(restored.restore(state.serialize()).ok).toBe(true)
        expect(restored.getValue(p.id)).toEqual(value)
      }
      expect(state.reset(p.id).ok).toBe(true);expect(state.getValue(p.id)).toEqual(p.defaultValue)
    }
    state.setPersistentValue(honeyParameterId('pattern-change'),true)
    state.setPersistentValue(honeyParameterId('camera-motion'),true)
    const unlocked=controls(state)
    expect(unlocked.filter(c=>c.definition.designParentGroup==='palette')).toHaveLength(8)
    state.setPersistentValue(honeyParameterId('auto-performance'),true)
    const locked=controls(state)
    expect(locked.map(c=>c.definition.id)).toEqual(unlocked.map(c=>c.definition.id))
    for(const c of locked){
      const editable=c.definition.designParentGroup==='palette'||c.definition.id===honeyParameterId('auto-performance')||c.definition.id===honeyParameterId('bpm-sync')
      expect(c.enabled).toBe(editable)
      if(c.definition.id!==honeyParameterId('auto-performance'))expect(c.value).toEqual(unlocked.find(u=>u.definition.id===c.definition.id)?.value)
    }
    state.setPersistentValue(honeyParameterId('auto-performance'),false)
    expect(controls(state).map(c=>[c.definition.id,c.value,c.enabled])).toEqual(unlocked.map(c=>[c.definition.id,c.value,c.enabled]))
  })
  it('uses the real shared camera with slight lateral sway, constant lens and hard-off permissions',()=>{
    const state=new Cinema2ParameterState(plan.parameters),resolver=new Cinema2FinalValueResolver(plan.targets,{resolveBaseValue:t=>t.parameterId==null?t.authoredBaseValue:state.getValue(t.parameterId)}),spatial=new Cinema2SpatialRuntime(plan.scene,plan.targets.targets,resolver),camera=new Cinema2CameraRuntime(plan,state,resolver,spatial)
    const frame=(i:number):Cinema2ModuleFrameReadContext=>({frameId:i,timestampMs:i*1000/60,deltaTimeSec:1/60,elapsedTimeSec:i/60,viewport:{width:960,height:540,dpr:1},contextGeneration:1,audio:null,director:null,transport:{sourcePresent:true,playing:true,analysisActive:true,animationActive:true,paused:false,trackId:'track',timeSec:i/60,bpm:120,bpmSync:true}})
    const initial=camera.update(frame(0));let last=initial
    for(let i=1;i<61;i++)last=camera.update(frame(i))
    expect(Math.abs(last.position[0]-initial.position[0])).toBeGreaterThan(.03);expect(Math.abs(last.position[0]-initial.position[0])).toBeLessThan(.35);expect(last.position[2]).toBe(initial.position[2]);expect(last.fovDegrees).toBe(initial.fovDegrees)
    state.setPersistentValue(honeyParameterId('camera-motion'),false);last=camera.update(frame(61));expect(last.position).toEqual(initial.position)
    state.setPersistentValue(honeyParameterId('camera-motion'),true);state.setPersistentValue(honeyParameterId('camera-sway'),0);last=camera.update(frame(62));expect(last.position).toEqual(initial.position)
  })
})

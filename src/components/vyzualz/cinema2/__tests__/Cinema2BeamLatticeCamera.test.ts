import {expect,it} from 'vitest'
import {CINEMA2_CRATE_PRESET_MANIFESTS} from '../presets/Cinema2CratePresets'
import {compileCinema2NativePreset} from '../presets/Cinema2PresetCompiler'
import {beamLatticeParameterId as pid} from '../presets/Cinema2BeamLatticePerformance'
import {Cinema2ParameterState} from '../parameters/Cinema2ParameterState'
import {Cinema2FinalValueResolver} from '../parameters/Cinema2TargetRuntime'
import {Cinema2SpatialRuntime} from '../spatial/Cinema2SpatialRuntime'
import {Cinema2CameraRuntime} from '../spatial/Cinema2CameraRuntime'
import type {Cinema2ModuleFrameReadContext} from '../modules/Cinema2ModuleContracts'
const manifest=CINEMA2_CRATE_PRESET_MANIFESTS.find(m=>m.id==='drmvyz.cinema2.crate-beam-lattice')!
it('keeps automatic and manual views inside the reference aperture throughout their entire motion',()=>{
 const compiled=compileCinema2NativePreset(manifest);if(!compiled.ok)throw Error(JSON.stringify(compiled.diagnostics));const state=new Cinema2ParameterState(compiled.plan.parameters),resolver=new Cinema2FinalValueResolver(compiled.plan.targets,{resolveBaseValue:t=>t.parameterId?state.getValue(t.parameterId):t.authoredBaseValue}),spatial=new Cinema2SpatialRuntime(compiled.plan.scene,compiled.plan.targets.targets,resolver),camera=new Cinema2CameraRuntime(compiled.plan,state,resolver,spatial)
 const frame=(time:number)=>({frameId:time*30+1,timestampMs:time*1000,elapsedTimeSec:time,deltaTimeSec:1/30,contextGeneration:1,viewport:{width:1280,height:720,dpr:1},audio:null,director:null,transport:{sourcePresent:true,playing:true,paused:false,animationActive:true,timeSec:time,bpm:120}} as unknown as Cinema2ModuleFrameReadContext)
 const positions=[];for(let i=0;i<=600;i++){const p=camera.update(frame(i/30));if(i%30===0)positions.push(p.position);expect(p.viewMatrix.every(Number.isFinite)).toBe(true);expect(p.position[0]).toBeGreaterThanOrEqual(-.04629);expect(p.position[0]).toBeLessThanOrEqual(.003712);expect(p.position[1]).toBeGreaterThanOrEqual(.261655);expect(p.position[1]).toBeLessThanOrEqual(.311657);expect(p.position[2]).toBeGreaterThanOrEqual(.799999);expect(p.position[2]).toBeLessThanOrEqual(.840001)}
 for(const axis of [0,1,2])expect(Math.max(...positions.map(p=>p[axis]))-Math.min(...positions.map(p=>p[axis]))).toBeGreaterThan(.015)
 state.setPersistentValue(pid('cameraMode'),'reference');camera.reset();const ref=camera.update(frame(0)).position;expect(camera.update(frame(5)).position).toEqual(ref)
 state.setPersistentValue(pid('cameraMode'),'manual');state.setPersistentValue(pid('cameraHeading'),1.5);state.setPersistentValue(pid('cameraElevation'),1.5);camera.reset();const manual=camera.update(frame(0));expect(manual.position[0]).toBeGreaterThan(-.021289);expect(manual.position[1]).toBeGreaterThan(.286656);expect(manual.position[2]).toBeGreaterThan(.8);camera.dispose()
 expect(manifest.parameters!.some(p=>p.label==='Geometry Motion')).toBe(false)
})

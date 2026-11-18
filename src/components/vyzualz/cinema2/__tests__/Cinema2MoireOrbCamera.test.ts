import { expect, it } from 'vitest'
import { CINEMA2_MOIRE_ORB_PRESET_MANIFEST as manifest, moireOrbParameterId } from '../presets/Cinema2MoireOrbPreset'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { Cinema2FinalValueResolver } from '../parameters/Cinema2TargetRuntime'
import { Cinema2SpatialRuntime } from '../spatial/Cinema2SpatialRuntime'
import { Cinema2CameraRuntime } from '../spatial/Cinema2CameraRuntime'
import type { Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'
function setup() {
  const compiled=cinema2NativePresetRegistry.compile(manifest.id);if(!compiled.ok)throw new Error(JSON.stringify(compiled.diagnostics))
  const state=new Cinema2ParameterState(compiled.plan.parameters)
  const resolver=new Cinema2FinalValueResolver(compiled.plan.targets,{resolveBaseValue:t=>t.parameterId?state.getValue(t.parameterId):t.authoredBaseValue})
  const spatial=new Cinema2SpatialRuntime(compiled.plan.scene,compiled.plan.targets.targets,resolver)
  const camera=new Cinema2CameraRuntime(compiled.plan,state,resolver,spatial)
  const set=(name:string,value:number|string)=>state.setPersistentValue(moireOrbParameterId(name),value)
  const frame=(time:number,paused=false)=>({frameId:Math.round(time*30)+1,timestampMs:time*1000,elapsedTimeSec:time,deltaTimeSec:1/30,contextGeneration:1,viewport:{width:1280,height:720,dpr:1},audio:null,director:null,transport:{sourcePresent:true,playing:!paused,paused,animationActive:!paused,timeSec:time,trackId:'track',bpm:120}} as unknown as Cinema2ModuleFrameReadContext)
  return {camera,set,frame}
}
it('can inspect front, rear, either side and both poles without singular matrices',()=>{
  const s=setup();s.set('cameraMode','manual')
  for(const heading of [-180,-90,0,90,180])for(const elevation of [-89.9,-60,0,60,89.9]) {
    s.set('cameraHeading',heading);s.set('cameraElevation',elevation)
    const p=s.camera.update(s.frame(0))
    expect(Math.hypot(...p.position)).toBeCloseTo(8.6,4)
    expect(p.position[1]).toBeCloseTo(8.6*Math.sin(elevation*Math.PI/180),4)
    expect(p.viewMatrix.every(Number.isFinite)).toBe(true)
  }
  s.camera.dispose()
})
it('automatically travels in all three axes, holds at speed zero and freezes on pause',()=>{
  const s=setup(),positions=[]
  for(let i=0;i<=40*30;i++){const p=s.camera.update(s.frame(i/30));if(i%30===0)positions.push(p.position)}
  for(const axis of [0,1,2]){expect(Math.max(...positions.map(p=>p[axis]))).toBeGreaterThan(6);expect(Math.min(...positions.map(p=>p[axis]))).toBeLessThan(-6)}
  s.set('cameraSpeed',0);const before=s.camera.update(s.frame(33)).position
  for(let i=1;i<30;i++)expect(s.camera.update(s.frame(33+i/30)).position).toEqual(before)
  s.set('cameraSpeed',1);const paused=s.camera.update(s.frame(34,true)).position
  for(let i=1;i<30;i++)expect(s.camera.update(s.frame(34+i/30,true)).position).toEqual(paused)
  s.camera.dispose()
})


it('keeps the flight outside the reactor and inside every fixture mount',()=>{
 const s=setup()
 for(let i=0;i<=1200;i++){const p=s.camera.update(s.frame(i/30));const radius=Math.hypot(...p.position);expect(radius).toBeGreaterThan(6.5);expect(radius).toBeLessThan(9.1)}
 s.camera.dispose()
})

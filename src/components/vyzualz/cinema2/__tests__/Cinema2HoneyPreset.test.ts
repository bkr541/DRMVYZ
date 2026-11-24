import { describe,expect,it,vi } from 'vitest'
import { CINEMA2_HONEY_PRESET_ID,CINEMA2_HONEY_PRESET_MANIFEST as manifest,honeyParameterId } from '../presets/Cinema2HoneyPreset'
import { CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS } from '../presets/Cinema2FirstPartyPresetCatalog'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'
import { cinema2NativeModuleRegistry } from '../modules/Cinema2ModuleRegistry'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { Cinema2FinalValueResolver } from '../parameters/Cinema2TargetRuntime'
import { Cinema2SpatialRuntime } from '../spatial/Cinema2SpatialRuntime'
import { Cinema2CameraRuntime } from '../spatial/Cinema2CameraRuntime'
import { createCinema2HoneyNativeModuleDefinition } from '../modules/Cinema2HoneyNativeModule'
import { Cinema2ModuleResourceScope } from '../modules/Cinema2ModuleResources'
import type { Cinema2ModuleCreateContext,Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'
import { HONEY_PALETTE_KEYS,HONEY_PALETTE } from '../modules/honey/Cinema2HoneyDomain'
import { Cinema2HoneyRenderer } from '../modules/honey/Cinema2HoneyRenderer'
import { HONEY_LIGHT_DEFAULTS } from '../modules/honey/Cinema2HoneyLighting'
import { buildHoneyLayout } from '../modules/honey/Cinema2HoneyLayout'
import { createCinemaMockWebGL } from '../../../../test/support/CinemaWebGLTestUtils'

const frame: Cinema2ModuleFrameReadContext={frameId:1,timestampMs:0,deltaTimeSec:0,elapsedTimeSec:0,viewport:{width:960,height:540,dpr:1},contextGeneration:1,audio:null,director:null}
function plan(){const result=compileCinema2NativePreset(manifest);if(!result.ok)throw Error(JSON.stringify(result.diagnostics));return result.plan}
function camera(f=frame){const p=plan(),state=new Cinema2ParameterState(p.parameters),resolver=new Cinema2FinalValueResolver(p.targets,{resolveBaseValue:t=>t.authoredBaseValue}),spatial=new Cinema2SpatialRuntime(p.scene,p.targets.targets,resolver);return new Cinema2CameraRuntime(p,state,resolver,spatial).update(f)}
describe('HONEY performance reference',()=>{
  it('compiles and is visible in the first-party native registry with real performance controls',()=>{
    expect(plan().presetId).toBe(CINEMA2_HONEY_PRESET_ID)
    expect(validateCinema2PresetAuthoringConventions({role:'reference',manifest}).ok).toBe(true)
    expect(cinema2NativeModuleRegistry.validateModules(manifest.modules??[]).ok).toBe(true)
    expect(CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS.find(d=>d.manifest.id===manifest.id)?.role).toBe('reference')
    expect(cinema2NativePresetRegistry.list().find(m=>m.id===manifest.id)?.metadata.tags).toEqual(['cinematic','3d','audio-reactive'])
    expect(manifest.parameters?.filter(p=>/^(Auto Performance|BPM Sync|Pattern)$/.test(p.label))).toHaveLength(3)
    const state=new Cinema2ParameterState(plan().parameters)
    for(const key of HONEY_PALETTE_KEYS){expect(state.setPersistentValue(honeyParameterId(key),[.2,.4,.6,1]).ok).toBe(true);expect(state.getValue(honeyParameterId(key))).toEqual([.2,.4,.6,1])}
    const restored=new Cinema2ParameterState(plan().parameters);expect(restored.restore(state.serialize()).ok).toBe(true)
    for(const key of HONEY_PALETTE_KEYS)expect(restored.getValue(honeyParameterId(key))).toEqual([.2,.4,.6,1])
  })
  it.each([[960,540],[540,960],[640,640]])('keeps the projected substrate oversized at %sx%s',(width,height)=>{
    const matrix=camera({...frame,viewport:{width,height,dpr:1}}).viewProjectionMatrix
    const project=(x:number,y:number)=>{const p=[x,y,-.165,1],clip=[0,1,3].map(row=>p.reduce((s,v,col)=>s+v*matrix[col*4+row]!,0));return [clip[0]!/clip[2]!,clip[1]!/clip[2]!]}
    // Inner rectangle is strictly covered by the 25-by-25 field, not its stepped outside edges.
    const corners=[project(-16,-19),project(16,-19),project(16,19),project(-16,19)]
    for(const x of [-1,1])for(const y of [-1,1])expect(corners.every((a,i)=>{const b=corners[(i+1)%4]!;return (b[0]!-a[0]!)*(y-a[1]!)-(b[1]!-a[1]!)*(x-a[0]!)>0})).toBe(true)
  })
  it('leases one renderer, binds independent live colors, and retires resources on exit',()=>{
    const gl=createCinemaMockWebGL(),resources=new Cinema2ModuleResourceScope(gl,vi.fn()),renderer={draw:vi.fn(),drawShadow:vi.fn(),dispose:vi.fn(),estimateGpuBytes:()=>1000},factory=vi.fn(()=>renderer)
    const values:Record<string,readonly [number,number,number,number]>={...HONEY_PALETTE},unused=()=>{throw Error('Unused static facet')}
    const context:Cinema2ModuleCreateContext={module:manifest.modules![0]!,resources,parameters:{get:key=>values[key],getAuthored:key=>values[key],resolve:()=>null},targets:{getTarget:()=>null,resolve:unused,dispatch:unused},media:{get:()=>null,getSlot:()=>null},randomness:{sample:unused,probability:unused,stream:unused,eventStream:unused}}
    const instance=createCinema2HoneyNativeModuleDefinition(factory).create(context),execute=instance.render!.providers[0]!.execute,execution={frame,target:null,width:960,height:540,depthAvailable:true,camera:camera()}
    expect(()=>execute({...execution,depthAvailable:false})).toThrow(/depth/)
    execute(execution);values.face=[1,0,0,1];execute(execution);expect(factory).toHaveBeenCalledTimes(1);expect(renderer.draw).toHaveBeenLastCalledWith(execution.camera.viewProjectionMatrix,{...HONEY_PALETTE,face:[1,0,0,1]},expect.objectContaining({controls:HONEY_LIGHT_DEFAULTS,eye:execution.camera.position}))
    expect(resources.getSnapshot()).toMatchObject({activeLeaseCount:1,estimatedGpuBytes:1000})
    instance.lifecycle.dispose();resources.disposeAll();expect(renderer.dispose).toHaveBeenCalledTimes(1);expect(resources.getSnapshot()).toMatchObject({activeLeaseCount:0,estimatedGpuBytes:0})
  })
  it('allocates two buffers once and uses one instanced draw per frame',()=>{
    const gl=Object.assign(createCinemaMockWebGL(),{uniform3fv:vi.fn()})
    const renderer=new Cinema2HoneyRenderer(gl,buildHoneyLayout()),allocated=gl.__calls.createdBuffers
    renderer.draw(camera().viewProjectionMatrix,HONEY_PALETTE);renderer.draw(camera().viewProjectionMatrix,HONEY_PALETTE)
    expect(allocated).toBe(2);expect(gl.__calls.createdBuffers).toBe(allocated);expect(gl.drawArraysInstanced).toHaveBeenCalledTimes(2);expect(renderer.estimateGpuBytes()).toBeLessThan(160000)
    renderer.dispose();renderer.dispose();expect(gl.__calls.deletedBuffers).toBe(allocated);expect(gl.__calls.deletedVertexArrays).toBe(gl.__calls.createdVertexArrays);expect(gl.__calls.deletedPrograms).toBe(gl.__calls.createdPrograms);expect(gl.__calls.deletedTextures).toBe(gl.__calls.createdTextures)
  })
})

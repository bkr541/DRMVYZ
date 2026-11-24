import { describe,expect,it,vi } from 'vitest'
import { HONEY_PALETTE,HONEY_PALETTE_KEYS } from '../modules/honey/Cinema2HoneyDomain'
import { buildHoneyLayout } from '../modules/honey/Cinema2HoneyLayout'
import { buildHoneyGeometry } from '../modules/honey/Cinema2HoneyGeometry'
import { HONEY_LIGHT_DEFAULTS,honeyReadLightControls } from '../modules/honey/Cinema2HoneyLighting'
import { Cinema2HoneyRenderer } from '../modules/honey/Cinema2HoneyRenderer'
import { CINEMA2_HONEY_PRESET_MANIFEST as manifest,honeyParameterId } from '../presets/Cinema2HoneyPreset'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { Cinema2FinalValueResolver } from '../parameters/Cinema2TargetRuntime'
import { Cinema2SpatialRuntime } from '../spatial/Cinema2SpatialRuntime'
import { Cinema2LightingEnvironmentRuntime } from '../spatial/Cinema2LightingEnvironmentRuntime'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { createCinemaMockWebGL } from '../../../../test/support/CinemaWebGLTestUtils'

const matrix=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]
describe('HONEY independent emissive channels and shared finishing',()=>{
  it('authors physically separate seats and deterministic independent on/off levels',()=>{
    const parts=buildHoneyGeometry()
    for(const [name,moving] of [['outer-channel-seat',true],['inner-channel-seat',true],['lower-channel-seat',false]] as const){
      const part=parts.find(p=>p.name===name)!;expect(part.moving).toBe(moving);expect(part.vertices.length).toBeGreaterThan(100)
    }
    const states=new Set(buildHoneyLayout().map(c=>c.channels.map(v=>v>0?1:0).join('')))
    expect(states.size).toBe(8);expect(states.has('000')).toBe(true);expect(states.has('111')).toBe(true)
    expect(honeyReadLightControls(key=>key==='innerGain'?0:undefined)).toEqual({...HONEY_LIGHT_DEFAULTS,innerGain:0})
    expect(honeyReadLightControls(key=>key==='outerGain'?100:NaN).outerGain).toBe(2)
  })
  it('binds all palette roles separately and passes independent gain uniforms without geometry rebuild',()=>{
    const gl=Object.assign(createCinemaMockWebGL(),{uniform3fv:vi.fn()}),renderer=new Cinema2HoneyRenderer(gl,buildHoneyLayout())
    const controls={...HONEY_LIGHT_DEFAULTS,outerGain:0,innerGain:.4,underGain:1.8}
    renderer.draw(matrix,HONEY_PALETTE,{controls,eye:[0,0,13]})
    const first=Array.from(gl.uniform3fv.mock.calls.at(-1)![1] as Float32Array)
    for(const [i,key] of HONEY_PALETTE_KEYS.entries()){
      renderer.draw(matrix,{...HONEY_PALETTE,[key]:[1,0,1,1]},{controls,eye:[0,0,13]})
      const colors=Array.from(gl.uniform3fv.mock.calls.at(-1)![1] as Float32Array)
      expect(colors.slice(i*3,i*3+3)).toEqual([1,0,1]);expect(colors.filter((_,j)=>Math.floor(j/3)!==i)).toEqual(first.filter((_,j)=>Math.floor(j/3)!==i))
    }
    expect(gl.uniform3f).toHaveBeenCalledWith(expect.anything(),0,.4,1.8)
    expect(gl.__calls.createdBuffers).toBe(2);renderer.dispose();expect(gl.__calls.deletedTextures).toBe(gl.__calls.createdTextures)
  })
  it('restores Phase 01 saves with new defaults and resolves live light and effect controls through the shared targets',()=>{
    const compiled=compileCinema2NativePreset(manifest);if(!compiled.ok)throw Error(JSON.stringify(compiled.diagnostics))
    const plan=compiled.plan,state=new Cinema2ParameterState(plan.parameters)
    const previous=JSON.parse(state.serialize())
    previous.values=Object.fromEntries(Object.entries(previous.values).filter(([key])=>key==='quality-mode'||HONEY_PALETTE_KEYS.some(k=>honeyParameterId(k)===key)))
    previous.values[honeyParameterId('face')]=[.2,.3,.4,1]
    expect(state.restore(previous).ok).toBe(true);expect(state.getValue(honeyParameterId('face'))).toEqual([.2,.3,.4,1])
    for(const [key,value] of Object.entries(HONEY_LIGHT_DEFAULTS))expect(state.getValue(honeyParameterId(key))).toBe(value)
    const resolver=new Cinema2FinalValueResolver(plan.targets,{resolveBaseValue:t=>t.parameterId==null?t.authoredBaseValue:state.getValue(t.parameterId)})
    const spatial=new Cinema2SpatialRuntime(plan.scene,plan.targets.targets,resolver),environment=new Cinema2LightingEnvironmentRuntime(plan,resolver,spatial)
    for(const key of ['ambient','bloom','ao'])expect(state.setPersistentValue(honeyParameterId(key),0).ok).toBe(true)
    expect(environment.update().lights.find(l=>l.type==='ambient')?.intensity).toBe(0)
    for(const key of ['bloom','ao']){const t=plan.targets.targets.find(t=>t.kind==='effect'&&t.parameterId===honeyParameterId(key))!;expect(resolver.resolve(t.id).value).toBe(0)}
    const restored=new Cinema2ParameterState(plan.parameters);expect(restored.restore(state.serialize()).ok).toBe(true);expect(restored.getValue(honeyParameterId('ao'))).toBe(0)
  })
  it('compiles HDR with fallback, real depth into AO, restrained bloom and final display output',()=>{
    const compiled=compileCinema2NativePreset(manifest);expect(compiled.ok).toBe(true)
    const scene=manifest.render!.passes[0]!,ao=manifest.render!.passes[1]!,depth=scene.outputs!.find(o=>o.attachment==='depth')!
    expect(ao.inputs?.find(i=>i.attachment==='depth')?.source.output).toBe(depth.id)
    expect(ao.inputs?.find(i=>i.attachment==='depth')?.source.pass.$ref).toBe(scene.id)
    expect(manifest.render!.targets!.filter(t=>t.descriptor.colorFormat==='rgba16f').every(t=>t.descriptor.fallbackColorFormat==='rgba8')).toBe(true)
    expect(manifest.effects?.find(e=>e.typeId==='hdr-bloom')?.parameters).toMatchObject({intensity:.3,threshold:.85,spread:.35})
    expect(manifest.effects?.find(e=>e.typeId==='hdr-bloom')?.parameterBindings?.intensity?.$ref).toBe(honeyParameterId('bloom'))
    expect(manifest.effects?.find(e=>e.typeId==='ambient-occlusion')?.parameterBindings?.intensity?.$ref).toBe(honeyParameterId('ao'))
  })
})

import { describe,expect,it } from 'vitest'
import { CINEMA2_HONEY_PRESET_MANIFEST as manifest,honeyParameterId } from '../presets/Cinema2HoneyPreset'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { cinema2NativeEffectRegistry } from '../effects/Cinema2EffectRegistry'
import { computeCinema2AutoCoverage } from '../presets/Cinema2AutoCoverage'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { Cinema2FinalValueResolver } from '../parameters/Cinema2TargetRuntime'

describe('HONEY P06 real shared effect graph',()=>{
  it('compiles six registered effects with original scene depth and HDR fallback',()=>{
    const result=compileCinema2NativePreset(manifest);expect(result.ok).toBe(true)
    expect(cinema2NativeEffectRegistry.validateEffects(manifest.effects!).ok).toBe(true)
    expect(manifest.effects!.map(e=>e.typeId)).toEqual(['ambient-occlusion','volumetric-atmosphere','depth-of-field','hdr-bloom','cinematic-finish','anti-aliasing'])
    const scene=manifest.render!.passes[0]!,depth=scene.outputs!.find(o=>o.attachment==='depth')!
    for(const id of ['honey-ao-pass','honey-atmosphere-pass','honey-dof-pass']){
      const pass=manifest.render!.passes.find(p=>p.id===id)!;expect(pass.inputs!.find(i=>i.attachment==='depth')?.source).toEqual({pass:{$ref:scene.id},output:depth.id})
    }
    expect(manifest.render!.targets!.filter(t=>t.descriptor.colorFormat==='rgba16f').every(t=>t.descriptor.fallbackColorFormat==='rgba8')).toBe(true)
    expect(manifest.render!.outputPass!.$ref).toBe('honey-aa-pass')
    expect(manifest.effects!.find(e=>e.id==='honey-dof')?.quality?.min).toBe('medium')
  })
  it('binds hard permissions and saved numerical zero through canonical targets; palette stays independent',()=>{
    const result=compileCinema2NativePreset(manifest);if(!result.ok)throw Error(JSON.stringify(result.diagnostics))
    const plan=result.plan,state=new Cinema2ParameterState(plan.parameters),resolver=new Cinema2FinalValueResolver(plan.targets,{resolveBaseValue:t=>t.parameterId==null?t.authoredBaseValue:state.getValue(t.parameterId)})
    for(const [key,value] of [['atmosphere',false],['depth-of-field',false],['particles',false],['focus-amount',0],['haze-density',0],['grain',0],['vignette',0],['particle-amount',0]] as const){
      const param=honeyParameterId(key);expect(state.setPersistentValue(param,value).ok).toBe(true);const target=plan.targets.targets.find(t=>t.parameterId===param&&t.kind!=='parameter')!;expect(resolver.resolve(target.id).value).toBe(value)
    }
    const color=honeyParameterId('particle-color'),face=honeyParameterId('face'),before=state.getValue(face);expect(state.setPersistentValue(color,[0,1,0,1]).ok).toBe(true);expect(state.getValue(face)).toEqual(before)
    const coverage=computeCinema2AutoCoverage(manifest);expect(coverage.drives).toEqual([]);expect(coverage.skipped).toEqual([])
  })
})

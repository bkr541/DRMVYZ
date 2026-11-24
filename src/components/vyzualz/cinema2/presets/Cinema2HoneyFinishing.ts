import { cinema2StableId,cinema2Ref,type Cinema2NativePresetManifest,type Cinema2ParameterId,type Cinema2EffectId,type Cinema2RenderPassId,type Cinema2RenderTargetId,type Cinema2RenderSlotId,type Cinema2RenderPassManifest,type Cinema2RenderTargetManifest,type Cinema2EffectManifest } from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID } from '../effects/Cinema2HdrBloomEffect'
import { CINEMA2_AMBIENT_OCCLUSION_EFFECT_TYPE_ID } from '../effects/Cinema2AmbientOcclusionEffect'
import { CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID } from '../effects/Cinema2CinematicFinishEffect'
import { HONEY_LIGHT_DEFAULTS } from '../modules/honey/Cinema2HoneyLighting'

/** Uses shared effect implementations and the original scene depth, never private postprocessing targets. */
export function finishHoney(manifest:Readonly<Cinema2NativePresetManifest>,pid:(key:string)=>Cinema2ParameterId):Readonly<Cinema2NativePresetManifest>{
  const id=(key:string)=>cinema2StableId<Cinema2EffectId>(`honey-${key}`)
  const effects:Cinema2EffectManifest[]=[
    {id:id('ao'),typeId:CINEMA2_AMBIENT_OCCLUSION_EFFECT_TYPE_ID,version:1,parameters:{mix:1,radius:.32,intensity:HONEY_LIGHT_DEFAULTS.ao,power:1.1,emissiveProtect:.95},parameterBindings:{intensity:cinema2Ref(pid('ao'))}},
    {id:id('bloom'),typeId:CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID,version:1,parameters:{mix:1,intensity:HONEY_LIGHT_DEFAULTS.bloom,threshold:.85,knee:.22,spread:.35,levels:4,clampMax:4},parameterBindings:{intensity:cinema2Ref(pid('bloom'))}},
    {id:id('grade'),typeId:CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID,version:1,parameters:{mix:1,toneMap:2,exposure:1,contrast:1,saturation:1,vignette:0,grain:0,aberration:0}},
  ]
  const scene=manifest.render!.passes[0]!,depth=scene.outputs!.find(o=>o.attachment==='depth')!
  const targets:Cinema2RenderTargetManifest[]=manifest.render!.targets!.map(t=>({...t,descriptor:{...t.descriptor,colorFormat:'rgba16f',fallbackColorFormat:'rgba8'}}))
  const passes:Cinema2RenderPassManifest[]=[scene]
  let previous=scene.id,output=scene.outputs!.find(o=>o.attachment==='color')!.id
  for(const effect of effects){
    const pass=cinema2StableId<Cinema2RenderPassId>(`${effect.id}-pass`),target=cinema2StableId<Cinema2RenderTargetId>(`${effect.id}-target`),slot=cinema2StableId<Cinema2RenderSlotId>(`${effect.id}-color`)
    targets.push({id:target,ownership:'transient',descriptor:{size:{kind:'viewport'},colorFormat:effect.id===id('grade')?'rgba8':'rgba16f',...(effect.id===id('grade')?{}:{fallbackColorFormat:'rgba8' as const})}})
    passes.push({id:pass,kind:'fullscreen',effect:cinema2Ref(effect.id),dependsOn:[cinema2Ref(previous)],inputs:[{id:cinema2StableId<Cinema2RenderSlotId>(`${effect.id}-input`),source:{pass:cinema2Ref(previous),output},attachment:'color'},...(effect.id===id('ao')?[{id:cinema2StableId<Cinema2RenderSlotId>('honey-ao-depth'),source:{pass:cinema2Ref(scene.id),output:depth.id},attachment:'depth' as const}]:[])],outputs:[{id:slot,target:cinema2Ref(target),attachment:'color'}]})
    previous=pass;output=slot
  }
  return {...manifest,effects,render:{targets,passes,outputPass:cinema2Ref(previous)},output:{...manifest.output,renderPass:cinema2Ref(previous)}}
}

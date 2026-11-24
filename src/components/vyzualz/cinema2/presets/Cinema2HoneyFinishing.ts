import { cinema2StableId,cinema2Ref,type Cinema2NativePresetManifest,type Cinema2ParameterId,type Cinema2EffectId,type Cinema2RenderPassId,type Cinema2RenderTargetId,type Cinema2RenderSlotId,type Cinema2RenderPassManifest,type Cinema2RenderTargetManifest,type Cinema2EffectManifest } from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID } from '../effects/Cinema2HdrBloomEffect'
import { CINEMA2_AMBIENT_OCCLUSION_EFFECT_TYPE_ID } from '../effects/Cinema2AmbientOcclusionEffect'
import { CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID } from '../effects/Cinema2CinematicFinishEffect'
import { CINEMA2_VOLUMETRIC_ATMOSPHERE_EFFECT_TYPE_ID } from '../effects/Cinema2VolumetricAtmosphereEffect'
import { CINEMA2_DEPTH_OF_FIELD_EFFECT_TYPE_ID } from '../effects/Cinema2DepthOfFieldEffect'
import { CINEMA2_ANTI_ALIASING_EFFECT_TYPE_ID } from '../effects/Cinema2AntiAliasingEffect'
import { HONEY_LIGHT_DEFAULTS } from '../modules/honey/Cinema2HoneyLighting'

/** Uses shared effect implementations and the original scene depth, never private postprocessing targets. */
export function finishHoney(manifest:Readonly<Cinema2NativePresetManifest>,pid:(key:string)=>Cinema2ParameterId):Readonly<Cinema2NativePresetManifest>{
  const id=(key:string)=>cinema2StableId<Cinema2EffectId>(`honey-${key}`)
  const effects:Cinema2EffectManifest[]=[
    {id:id('ao'),typeId:CINEMA2_AMBIENT_OCCLUSION_EFFECT_TYPE_ID,version:1,parameters:{mix:1,radius:.32,intensity:HONEY_LIGHT_DEFAULTS.ao,power:1.1,emissiveProtect:.95},parameterBindings:{intensity:cinema2Ref(pid('ao'))}},
    {id:id('atmosphere'),typeId:CINEMA2_VOLUMETRIC_ATMOSPHERE_EFFECT_TYPE_ID,version:1,parameters:{mix:1,density:.004,beamIntensity:0,ambientHaze:.12,hazeColor:[.27,.34,.43,1],occlusion:.9,noiseStrength:.12,drift:0,maxDistance:24,reactivity:0,mistAmount:0,floorReflection:0},parameterBindings:{enabled:cinema2Ref(pid('atmosphere')),density:cinema2Ref(pid('haze-density'))}},
    {id:id('dof'),typeId:CINEMA2_DEPTH_OF_FIELD_EFFECT_TYPE_ID,version:1,quality:{min:'medium'},parameters:{mix:.25,focusCameraTarget:true,focusDistance:12.75,focusRange:1.5,falloff:4,nearBlur:2,farBlur:3.5},parameterBindings:{enabled:cinema2Ref(pid('depth-of-field')),mix:cinema2Ref(pid('focus-amount'))}},
    {id:id('bloom'),typeId:CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID,version:1,parameters:{mix:1,intensity:HONEY_LIGHT_DEFAULTS.bloom,threshold:.85,knee:.22,spread:.35,levels:4,clampMax:4},parameterBindings:{intensity:cinema2Ref(pid('bloom'))}},
    {id:id('grade'),typeId:CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID,version:1,parameters:{mix:1,toneMap:2,exposure:1,contrast:1.10,saturation:.95,vignette:.18,grain:.015,aberration:0},parameterBindings:{vignette:cinema2Ref(pid('vignette')),grain:cinema2Ref(pid('grain'))}},
    {id:id('aa'),typeId:CINEMA2_ANTI_ALIASING_EFFECT_TYPE_ID,version:1,parameters:{mix:1,mode:'auto'}},
  ]
  const scene=manifest.render!.passes[0]!,depth=scene.outputs!.find(o=>o.attachment==='depth')!
  const targets:Cinema2RenderTargetManifest[]=manifest.render!.targets!.map(t=>({...t,descriptor:{...t.descriptor,colorFormat:'rgba16f',fallbackColorFormat:'rgba8'}}))
  const passes:Cinema2RenderPassManifest[]=[scene]
  let previous=scene.id,output=scene.outputs!.find(o=>o.attachment==='color')!.id
  for(const effect of effects){
    const pass=cinema2StableId<Cinema2RenderPassId>(`${effect.id}-pass`),target=cinema2StableId<Cinema2RenderTargetId>(`${effect.id}-target`),slot=cinema2StableId<Cinema2RenderSlotId>(`${effect.id}-color`)
    targets.push({id:target,ownership:'transient',descriptor:{size:{kind:'viewport'},colorFormat:(effect.id===id('grade')||effect.id===id('aa'))?'rgba8':'rgba16f',...((effect.id===id('grade')||effect.id===id('aa'))?{}:{fallbackColorFormat:'rgba8' as const})}})
    passes.push({id:pass,kind:'fullscreen',effect:cinema2Ref(effect.id),dependsOn:previous===scene.id||!['honey-atmosphere','honey-dof'].includes(effect.id)?[cinema2Ref(previous)]:[cinema2Ref(previous),cinema2Ref(scene.id)],inputs:[{id:cinema2StableId<Cinema2RenderSlotId>(`${effect.id}-input`),source:{pass:cinema2Ref(previous),output},attachment:'color'},...(['honey-ao','honey-atmosphere','honey-dof'].includes(effect.id)?[{id:cinema2StableId<Cinema2RenderSlotId>(`${effect.id}-depth`),source:{pass:cinema2Ref(scene.id),output:depth.id},attachment:'depth' as const}]:[])],outputs:[{id:slot,target:cinema2Ref(target),attachment:'color'}]})
    previous=pass;output=slot
  }
  return {...manifest,effects,render:{targets,passes,outputPass:cinema2Ref(previous)},output:{...manifest.output,renderPass:cinema2Ref(previous)}}
}

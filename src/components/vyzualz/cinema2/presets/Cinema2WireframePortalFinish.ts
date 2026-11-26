import { cinema2StableId, cinema2Ref, type Cinema2EffectManifest, type Cinema2RenderPassManifest, type Cinema2RenderTargetManifest, type Cinema2EffectId, type Cinema2RenderTargetId, type Cinema2RenderPassId, type Cinema2RenderSlotId, type Cinema2ParameterId, type Cinema2NativePresetManifest } from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID } from '../effects/Cinema2HdrBloomEffect'
import { CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID } from '../effects/Cinema2CinematicFinishEffect'
import { CINEMA2_DEPTH_OF_FIELD_EFFECT_TYPE_ID } from '../effects/Cinema2DepthOfFieldEffect'
import { CINEMA2_GLARE_EFFECT_TYPE_ID } from '../effects/Cinema2GlareEffect'

export function finishWireframePortal(manifest:Readonly<Cinema2NativePresetManifest>,pid:(name:string)=>Cinema2ParameterId):Readonly<Cinema2NativePresetManifest>{
 const ref=(name:string)=>cinema2Ref(pid(name)),eid=(name:string)=>cinema2StableId<Cinema2EffectId>(`wireframe-portal-${name}`)
 const effects: Cinema2EffectManifest[]=[
  {id:eid('focus'),typeId:CINEMA2_DEPTH_OF_FIELD_EFFECT_TYPE_ID,version:1,parameters:{mix:.55,focusDistance:23,focusCameraTarget:true,focusRange:11,falloff:9,nearBlur:3,farBlur:5},parameterBindings:{mix:ref('focus')}},
  {id:eid('bloom'),typeId:CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID,version:1,parameters:{mix:1,intensity:.38,threshold:.8,knee:.5,spread:.55,levels:5},parameterBindings:{intensity:ref('bloom')}},
  {id:eid('flares'),typeId:CINEMA2_GLARE_EFFECT_TYPE_ID,version:1,parameters:{mix:.2,intensity:.55,threshold:1.1,length:.04,streaks:4},parameterBindings:{mix:ref('flares')}},
  {id:eid('grade'),typeId:CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID,version:1,parameters:{mix:1,toneMap:1,exposure:.85,contrast:1.14,saturation:.92,vignette:.45,vignetteSoftness:.55,grain:.12,grainSize:1.4,aberration:.1,tintAmount:.3,shadowTint:[.42,.52,.7],highlightTint:[1,.82,.62]},parameterBindings:{mix:ref('finishMix')}},
 ]
 const basePass=manifest.render!.passes[0],sceneTarget=manifest.render!.targets![0],sceneDepth=cinema2StableId<Cinema2RenderSlotId>('wireframe-portal-depth')
 const passes: Cinema2RenderPassManifest[]=[{...basePass,outputs:[...basePass.outputs!,{id:sceneDepth,target:cinema2Ref(sceneTarget.id),attachment:'depth' as const}]}]
 const targets: Cinema2RenderTargetManifest[]=[{...sceneTarget,descriptor:{...sceneTarget.descriptor,colorFormat:'rgba16f' as const}}]
 let previous=basePass.id,output=basePass.outputs![0].id
 for(const effect of effects){
  const name=String(effect.id),pass=cinema2StableId<Cinema2RenderPassId>(`${name}-pass`),target=cinema2StableId<Cinema2RenderTargetId>(`${name}-target`),slot=cinema2StableId<Cinema2RenderSlotId>(`${name}-color`)
  targets.push({id:target,descriptor:{size:{kind:'viewport'},colorFormat:effect.id===eid('grade')?'rgba8':'rgba16f',depthFormat:'none'}})
  passes.push({id:pass,kind:'fullscreen',dependsOn:[cinema2Ref(previous)],effect:cinema2Ref(effect.id),inputs:[{id:cinema2StableId<Cinema2RenderSlotId>(`${name}-input`),source:{pass:cinema2Ref(previous),output},attachment:'color'},...(effect.id===eid('focus')?[{id:cinema2StableId<Cinema2RenderSlotId>(`${name}-depth`),source:{pass:cinema2Ref(basePass.id),output:sceneDepth},attachment:'depth' as const}]:[])],outputs:[{id:slot,target:cinema2Ref(target),attachment:'color'}]})
  previous=pass;output=slot
 }
 return {...manifest,effects,render:{targets,passes,outputPass:cinema2Ref(previous)},output:{renderPass:cinema2Ref(previous),colorSpace:'srgb',alphaMode:'opaque'}}
}

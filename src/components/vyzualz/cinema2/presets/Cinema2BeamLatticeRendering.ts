import {cinema2StableId,cinema2Ref,type Cinema2NativePresetManifest,type Cinema2EffectId,type Cinema2EffectTypeId,type Cinema2RenderPassId,type Cinema2RenderTargetId,type Cinema2RenderSlotId} from '../contracts/Cinema2NativePresetManifest'
/** Reference_vid.mov: centred view inside the original four-bank field, with the viewer's yellow light spill. */
export function withBeamLatticeReferenceRendering(manifest:Readonly<Cinema2NativePresetManifest>):Readonly<Cinema2NativePresetManifest>{
 const id=cinema2StableId,bloom=id<Cinema2EffectId>('beam-lattice-reference-bloom'),pass=id<Cinema2RenderPassId>('beam-lattice-reference-bloom-pass'),target=id<Cinema2RenderTargetId>('beam-lattice-reference-bloom-target'),slot=id<Cinema2RenderSlotId>('beam-lattice-reference-bloom-color'),source=manifest.render!.passes[0]
 return {...manifest,revision:2,
  metadata:{...manifest.metadata,description:'The original laser GLB and authored animation, framed from inside the four beam banks with the yellow glow shown in Reference_vid.mov.'},
  cameras:manifest.cameras!.map(camera=>({...camera,fovDegrees:154,near:.001,far:10,transform:{position:[-.021289,.286656,.82]},target:[-.021289,.286656,0]})),
  environment:{backgroundColor:[0,0,0,1],exposure:1},
  modules:manifest.modules!.map(module=>({...module,parameters:{...module.parameters,emissive:[1,1,0,1],emissiveIntensity:6.019065962867696,referenceBeamThickness:2},config:{...module.config,hdr:true,instances:(module.config!.instances as readonly Record<string,import('../contracts/Cinema2NativePresetManifest').Cinema2JsonValue>[]).map(instance=>({...instance,preserveMaterials:false}))}})),
  effects:[{id:bloom,typeId:id<Cinema2EffectTypeId>('hdr-bloom'),version:1,parameters:{mix:1,intensity:.9,threshold:.1,knee:.2,spread:.85,levels:7,clampMax:2,tint:[1,1,1,1]}}],
  render:{targets:[{...manifest.render!.targets![0],descriptor:{...manifest.render!.targets![0].descriptor,size:{kind:'viewport',widthScale:2,heightScale:2},colorFormat:'rgba16f',fallbackColorFormat:'rgba8'}},{id:target,descriptor:{size:{kind:'viewport'},colorFormat:'rgba8'}}],passes:[source,{id:pass,kind:'fullscreen',effect:cinema2Ref(bloom),dependsOn:[cinema2Ref(source.id)],inputs:[{id:id<Cinema2RenderSlotId>('beam-lattice-reference-bloom-input'),source:{pass:cinema2Ref(source.id),output:source.outputs![0].id},attachment:'color'}],outputs:[{id:slot,target:cinema2Ref(target),attachment:'color'}]}],outputPass:cinema2Ref(pass)},output:{...manifest.output,renderPass:cinema2Ref(pass)},
 }
}

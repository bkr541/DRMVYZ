import {
  cinema2Ref, cinema2StableId, type Cinema2EffectId, type Cinema2EffectManifest,
  type Cinema2LayerId, type Cinema2RenderPassId, type Cinema2RenderSlotId, type Cinema2RenderTargetId, type Cinema2RenderManifest,
} from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID } from '../effects/Cinema2HdrBloomEffect'
import { ifritParameterId as pid } from '../modules/ifrit/Cinema2IfritDomain'

const bloom=cinema2StableId<Cinema2EffectId>('ifrit-bloom')
export const IFRIT_EFFECTS: readonly Cinema2EffectManifest[] = [{
  id:bloom,typeId:CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID,version:1,enabled:true,order:0,scope:'output',
  parameters:{mix:0.28,threshold:0.75,knee:0.3,intensity:2,spread:0.6,levels:5,clampMax:8},parameterBindings:{mix:cinema2Ref(pid('bloom'))},
}]
const scene=cinema2StableId<Cinema2RenderPassId>('ifrit-scene-pass')
const finish=cinema2StableId<Cinema2RenderPassId>('ifrit-bloom-pass')
const target=cinema2StableId<Cinema2RenderTargetId>('ifrit-scene-target')
const color=cinema2StableId<Cinema2RenderSlotId>('ifrit-scene-color')
export const IFRIT_RENDER_GRAPH: Cinema2RenderManifest = {
  targets:[{id:target,descriptor:{size:{kind:'viewport'},colorFormat:'rgba16f',depthFormat:'depth24'},ownership:'transient'}],
  passes:[
    {id:scene,kind:'scene',layers:[cinema2Ref(cinema2StableId<Cinema2LayerId>('ifrit-world'))],outputs:[{id:color,target:cinema2Ref(target),attachment:'color'},{id:cinema2StableId<Cinema2RenderSlotId>('ifrit-scene-depth'),target:cinema2Ref(target),attachment:'depth'}]},
    {id:finish,kind:'fullscreen',effect:cinema2Ref(bloom),inputs:[{id:cinema2StableId<Cinema2RenderSlotId>('ifrit-bloom-input'),source:{pass:cinema2Ref(scene),output:color}}]},
  ],outputPass:cinema2Ref(finish),
}

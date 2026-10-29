import {
  cinema2Ref, cinema2StableId, type Cinema2EffectId, type Cinema2EffectManifest,
  type Cinema2LayerId, type Cinema2RenderPassId, type Cinema2RenderSlotId, type Cinema2RenderTargetId,
  type Cinema2RenderManifest, type Cinema2ChoreographyRuleManifest, type Cinema2ChoreographyRuleId, type Cinema2ChoreographyActionId,
} from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_BLOOM_EFFECT_TYPE_ID, CINEMA2_FEEDBACK_TRAILS_EFFECT_TYPE_ID } from '../effects/Cinema2BuiltinEffects'
import { trippyBroParameterId as pid } from '../modules/trippyBro/Cinema2TrippyBroDomain'

const trails = cinema2StableId<Cinema2EffectId>('trippy-bro-trails')
const bloom = cinema2StableId<Cinema2EffectId>('trippy-bro-bloom')
export const TRIPPY_BRO_EFFECTS: readonly Cinema2EffectManifest[] = [
  { id: trails, typeId: CINEMA2_FEEDBACK_TRAILS_EFFECT_TYPE_ID, version: 1, enabled: true, order: 0, scope: 'output',
    parameters: { mix: 0, persistence: 0.8, drift: 0, transportAware: true }, parameterBindings: { mix: cinema2Ref(pid('trails')) } },
  { id: bloom, typeId: CINEMA2_BLOOM_EFFECT_TYPE_ID, version: 1, enabled: true, order: 1, scope: 'output',
    parameters: { mix: 0.22, threshold: 0.35, radius: 2.6, intensity: 1.4 }, parameterBindings: { mix: cinema2Ref(pid('bloom')) } },
]
// The user's master ceiling also removes retained light, even when trails are at maximum.
export const TRIPPY_BRO_FINISHING_RULES: readonly Cinema2ChoreographyRuleManifest[] = [trails,bloom].map((effect,index)=>({
  id: cinema2StableId<Cinema2ChoreographyRuleId>(`trippy-bro-finish-${index}`),priority:100,
  source:{signal:'parameter',parameter:cinema2Ref(pid('intensity')),scale:-1,offset:1,clamp:[0,1]},
  actions:[{id:cinema2StableId<Cinema2ChoreographyActionId>(`trippy-bro-finish-${index}-gate`),target:{kind:'effect',ref:cinema2Ref(effect),property:'mix'},operation:'multiply',value:0}],
}))
const pass = (name:string)=>cinema2StableId<Cinema2RenderPassId>(`trippy-bro-${name}-pass`)
const slot = (name:string)=>cinema2StableId<Cinema2RenderSlotId>(`trippy-bro-${name}-color`)
const target = (name:string)=>cinema2StableId<Cinema2RenderTargetId>(`trippy-bro-${name}-target`)
export const TRIPPY_BRO_RENDER_GRAPH: Cinema2RenderManifest = {
  targets: ['scene','trails'].map(name=>({id:target(name),descriptor:{size:{kind:'viewport'},colorFormat:'rgba8'},ownership:'transient'})),
  passes:[
    {id:pass('scene'),kind:'scene',layers:[cinema2Ref(cinema2StableId<Cinema2LayerId>('trippy-bro-hero'))],outputs:[{id:slot('scene'),target:cinema2Ref(target('scene'))}]},
    {id:pass('trails'),kind:'fullscreen',effect:cinema2Ref(trails),inputs:[{id:slot('trails-input'),source:{pass:cinema2Ref(pass('scene')),output:slot('scene')}}],outputs:[{id:slot('trails'),target:cinema2Ref(target('trails'))}]},
    {id:pass('bloom'),kind:'fullscreen',effect:cinema2Ref(bloom),inputs:[{id:slot('bloom-input'),source:{pass:cinema2Ref(pass('trails')),output:slot('trails')}}]},
  ],
  outputPass:cinema2Ref(pass('bloom')),
}

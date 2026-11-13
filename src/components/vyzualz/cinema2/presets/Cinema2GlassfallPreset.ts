import { cinema2NamespacedId, cinema2StableId, cinema2Ref, type Cinema2PresetId, type Cinema2NativePresetManifest, type Cinema2ParameterManifest, type Cinema2EffectId, type Cinema2RenderPassId, type Cinema2RenderSlotId } from '../contracts/Cinema2NativePresetManifest'
import { GLASSFALL_CHOREOGRAPHY_ENABLED_ID } from './Cinema2GlassfallChoreography'
import { GLASSFALL_PHASE5_MANIFEST } from './Cinema2GlassfallPhase5Definition'
import { glassfallParameterId as pid } from './Cinema2GlassfallPhase2Definition'
import { GLASSFALL_MODULE_TYPE } from '../modules/glassfall/Cinema2GlassfallNativeModule'
import { CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID } from '../effects/Cinema2HdrBloomEffect'
export const CINEMA2_GLASSFALL_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.glassfall')
const module = GLASSFALL_PHASE5_MANIFEST.modules![0]
const bloom = cinema2StableId<Cinema2EffectId>('glassfall-bloom')
const finish = cinema2StableId<Cinema2RenderPassId>('glassfall-finish')
const input = cinema2StableId<Cinema2RenderSlotId>('glassfall-finish-input')
const base = { section: 'Design', exposure: 'primary', persistence: 'preset', reset: 'authored-default' } as const
const additions: Cinema2ParameterManifest[] = [
  { ...base, id: pid('autoPerformance'), label: 'Auto Performance', description: 'Permits temporary build (up to 4s) and drop (1.2s) pattern performances. The current base resumes afterward. Manual Pattern edits immediately take precedence until a new qualifying moment. Also enables music-driven depth, illumination, event pulses and Director enhancement. OFF restores the authored base. Pattern Change remains independent.', type: 'boolean', defaultValue: false, designParentGroup: 'master-controls', group: 'Master', order: 12 },
  { ...base, id: pid('bloom'), label: 'Bloom', description: 'Contained glow around luminous edges. Zero is an exact bypass; automation cannot change it.', type: 'float', defaultValue: .18, min: 0, max: .45, step: .01, designParentGroup: 'effects', group: 'Finishing', order: 0 },
  { ...base, id: pid('reflectionStrength'), label: 'Reflection Strength', description: 'Panel material highlights and reflection response. Zero gives a rough matte surface; automation cannot change it.', type: 'float', defaultValue: .35, min: 0, max: 1, step: .01, designParentGroup: 'effects', group: 'Finishing', order: 1 },
]
const scene = GLASSFALL_PHASE5_MANIFEST.render!.passes[0]
export const CINEMA2_GLASSFALL_PRESET_MANIFEST: Cinema2NativePresetManifest = {
  ...GLASSFALL_PHASE5_MANIFEST, id: CINEMA2_GLASSFALL_PRESET_ID, revision: 1,
  metadata: { name: 'GLASSFALL', description: 'Raised luminous triangles above layered black panels. Six native programs, shared musical performance and contained bloom. Final human acceptance pending.', author: 'DRMVYZ; Triangle by LTPman (CC BY 4.0)', tags: ['glassfall', 'geometric', '3d', 'audio-reactive', 'review'] },
  parameters: [...GLASSFALL_PHASE5_MANIFEST.parameters!.filter(p => p.exposure !== 'diagnostic').map(p => p.id === GLASSFALL_CHOREOGRAPHY_ENABLED_ID ? { ...p, exposure: 'hidden' as const, description: 'Legacy saved-state compatibility only. Auto Performance owns all choreography.' } : p.id === pid('sync') ? { ...p, order: 11 } : p.id === pid('directorInfluence') ? { ...p, description: 'Strength of musical significance enhancement while Auto Performance is on. Zero removes this enhancement; Music Reactivity still controls musical response.' } : p), ...additions],
  modules: [{ ...module, typeId: GLASSFALL_MODULE_TYPE, parameters: { ...module.parameters, autoPerformance: false, choreography: false, reflectionStrength: .35 }, parameterBindings: { ...Object.fromEntries(Object.entries(module.parameterBindings ?? {}).filter(([key]) => !key.startsWith('review'))), autoPerformance: cinema2Ref(pid('autoPerformance')), choreography: cinema2Ref(pid('autoPerformance')), reflectionStrength: cinema2Ref(pid('reflectionStrength')) } }],
  choreography: { rules: GLASSFALL_PHASE5_MANIFEST.choreography!.rules.map(rule => ({ ...rule, enabledParameter: cinema2Ref(pid('autoPerformance')) })) },
  effects: [{ id: bloom, typeId: CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID, version: 1, enabled: true, order: 0, scope: 'output', parameters: { mix: .18, threshold: .8, knee: .25, intensity: 1.2, spread: .45, levels: 4, clampMax: 4 }, parameterBindings: { mix: cinema2Ref(pid('bloom')) } }],
  render: { targets: GLASSFALL_PHASE5_MANIFEST.render!.targets!.map(target => ({ ...target, descriptor: { ...target.descriptor, colorFormat: 'rgba16f' as const } })), passes: [scene, { id: finish, kind: 'fullscreen', effect: cinema2Ref(bloom), inputs: [{ id: input, source: { pass: cinema2Ref(scene.id), output: scene.outputs![0].id }, attachment: 'color' }] }], outputPass: cinema2Ref(finish) },
  output: { renderPass: cinema2Ref(finish), colorSpace: 'srgb', alphaMode: 'opaque' },
}

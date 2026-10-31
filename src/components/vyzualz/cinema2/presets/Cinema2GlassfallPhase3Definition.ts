import { cinema2NamespacedId, cinema2Ref, type Cinema2PresetId, type Cinema2NativePresetManifest } from '../contracts/Cinema2NativePresetManifest'
import { GLASSFALL_PHASE2_MANIFEST, glassfallParameterId as pid } from './Cinema2GlassfallPhase2Definition'
import { GLASSFALL_PHASE3_MODULE_TYPE, cinema2GlassfallPhase3Module } from '../modules/glassfall/Cinema2GlassfallNativeModule'
export const GLASSFALL_PHASE3_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.glassfall.phase3')
const module = GLASSFALL_PHASE2_MANIFEST.modules![0]
export const GLASSFALL_PHASE3_MANIFEST: Cinema2NativePresetManifest = {
  ...GLASSFALL_PHASE2_MANIFEST, id: GLASSFALL_PHASE3_ID, revision: 1,
  metadata: { name: 'GLASSFALL — Phase 3 Review', description: 'Shared Audio Intelligence and canonical event-driven native pattern selection.', tags: ['internal', 'diagnostic'] },
  capabilities: [...GLASSFALL_PHASE2_MANIFEST.capabilities!, ...(['audio.transport', 'audio.features', 'audio.bands', 'music.beat', 'music.rhythm-events', 'music.downbeat', 'music.bar', 'music.phrase', 'music.section', 'music.build', 'music.drop', 'music.vocal-presence'] as const).map(id => ({ id, requirement: 'optional' as const, purpose: 'Shared facts and event identities; no preset-local musical analysis.' }))],
  parameters: [...GLASSFALL_PHASE2_MANIFEST.parameters!.filter(p => p.id !== pid('eventsReady')).map(p => p.id === pid('patternChange') || p.id === pid('trigger') ? { ...p, enabledWhen: undefined, description: p.id === pid('patternChange') ? 'Advance the performing pattern once on a fresh selected shared event. Manual selection stays immediate.' : 'Canonical shared musical event that advances the pattern.' } : p),
    { id: pid('response'), label: 'Music Reactivity', description: 'Bounded shared energy, relief, contour and rhythmic response. Zero restores manual behavior; Pattern Change is a separate permission.', type: 'float', min: 0, max: 1, step: .01, defaultValue: .7, section: 'Design', designParentGroup: 'master-controls', group: 'Master', order: 2, exposure: 'primary', persistence: 'preset', reset: 'authored-default' }],
  modules: [{ ...module, typeId: GLASSFALL_PHASE3_MODULE_TYPE, parameters: { ...module.parameters, response: .7 }, parameterBindings: { ...module.parameterBindings, response: cinema2Ref(pid('response')) } }],
}

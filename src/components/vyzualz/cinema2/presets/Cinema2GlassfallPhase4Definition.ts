import { cinema2NamespacedId, cinema2Ref, type Cinema2PresetId, type Cinema2NativePresetManifest } from '../contracts/Cinema2NativePresetManifest'
import { GLASSFALL_PHASE3_MANIFEST } from './Cinema2GlassfallPhase3Definition'
import { GLASSFALL_PHASE4_MODULE_TYPE, cinema2GlassfallPhase4Module } from '../modules/glassfall/Cinema2GlassfallNativeModule'
import { GLASSFALL_CHOREOGRAPHY_CHANNELS } from '../modules/glassfall/Cinema2GlassfallAudio'
import { GLASSFALL_CHOREOGRAPHY_ENABLED_ID, createGlassfallChoreography } from './Cinema2GlassfallChoreography'
export const GLASSFALL_PHASE4_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.glassfall.phase4')
const module = GLASSFALL_PHASE3_MANIFEST.modules![0]
export const GLASSFALL_PHASE4_MANIFEST: Cinema2NativePresetManifest = {
  ...GLASSFALL_PHASE3_MANIFEST, id: GLASSFALL_PHASE4_ID, revision: 1,
  metadata: { name: 'GLASSFALL — Phase 4 Review', description: 'Bounded shared choreography, smoothed musical response and reset-safe event envelopes.', tags: ['internal', 'diagnostic'] },
  parameters: [...GLASSFALL_PHASE3_MANIFEST.parameters!, { id: GLASSFALL_CHOREOGRAPHY_ENABLED_ID, label: 'Choreography', description: 'Permission for shared continuous modulation and event envelopes. OFF restores the authored visual immediately; Pattern Change is independent.', type: 'boolean', defaultValue: true, section: 'Design', designParentGroup: 'master-controls', group: 'Master', order: 3, exposure: 'primary', persistence: 'preset', reset: 'authored-default' }],
  modules: [{ ...module, typeId: GLASSFALL_PHASE4_MODULE_TYPE,
    parameters: { ...module.parameters, choreography: true, ...Object.fromEntries(GLASSFALL_CHOREOGRAPHY_CHANNELS.map(name => [`choreo-${name}`, 0])) },
    parameterBindings: { ...module.parameterBindings, choreography: cinema2Ref(GLASSFALL_CHOREOGRAPHY_ENABLED_ID) } }],
  choreography: { rules: createGlassfallChoreography(module.id) },
}

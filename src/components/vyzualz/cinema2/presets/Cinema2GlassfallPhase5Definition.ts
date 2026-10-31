import { cinema2NamespacedId, cinema2Ref, type Cinema2PresetId, type Cinema2NativePresetManifest } from '../contracts/Cinema2NativePresetManifest'
import { GLASSFALL_PHASE4_MANIFEST } from './Cinema2GlassfallPhase4Definition'
import { glassfallParameterId as pid } from './Cinema2GlassfallPhase2Definition'
import { GLASSFALL_PHASE5_MODULE_TYPE, cinema2GlassfallPhase5Module } from '../modules/glassfall/Cinema2GlassfallNativeModule'
import { GLASSFALL_DIRECTOR_CHANNELS } from '../modules/glassfall/Cinema2GlassfallDirector'
import { createGlassfallDirectorRoutes } from './Cinema2GlassfallDirectorRoutes'
export const GLASSFALL_PHASE5_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.glassfall.phase5')
const module = GLASSFALL_PHASE4_MANIFEST.modules![0]
export const GLASSFALL_PHASE5_MANIFEST: Cinema2NativePresetManifest = {
  ...GLASSFALL_PHASE4_MANIFEST, id: GLASSFALL_PHASE5_ID, revision: 1,
  metadata: { name: 'GLASSFALL — Phase 5 Review', description: 'Bounded Visual Director significance enhances existing shared choreography; no automatic pattern ownership.', tags: ['internal', 'diagnostic'] },
  capabilities: [...GLASSFALL_PHASE4_MANIFEST.capabilities!, { id: 'visual-director.significance', requirement: 'optional', purpose: 'Preset-agnostic intensity, momentum, build and impact meaning.' }],
  parameters: [...GLASSFALL_PHASE4_MANIFEST.parameters!, { id: pid('directorInfluence'), label: 'Director Influence', description: 'Bounded significance enhancement of existing musical gestures. Zero restores phase-four choreography. Cannot choose patterns, colors or camera. Choreography OFF and Music Reactivity zero take precedence.', type: 'float', min: 0, max: 1, step: .01, defaultValue: .35, section: 'Design', designParentGroup: 'master-controls', group: 'Master', order: 4, exposure: 'primary', persistence: 'preset', reset: 'authored-default' }],
  modules: [{ ...module, typeId: GLASSFALL_PHASE5_MODULE_TYPE,
    parameters: { ...module.parameters, directorInfluence: .35, ...Object.fromEntries(GLASSFALL_DIRECTOR_CHANNELS.map(name => [`director-${name}`, 0])) },
    parameterBindings: { ...module.parameterBindings, directorInfluence: cinema2Ref(pid('directorInfluence')) } }],
  choreography: { rules: [...GLASSFALL_PHASE4_MANIFEST.choreography!.rules, ...createGlassfallDirectorRoutes(module.id)] },
}

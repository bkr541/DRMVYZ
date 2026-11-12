import {
  cinema2NamespacedId, cinema2Ref, cinema2StableId,
  type Cinema2ChoreographyActionId, type Cinema2ChoreographyRuleId, type Cinema2ChoreographyRuleManifest,
  type Cinema2NativePresetManifest, type Cinema2ParameterManifest, type Cinema2ParameterId, type Cinema2PresetId,
} from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_SAY_IT_PRESET_MANIFEST } from './Cinema2SayItPreset'
import { CINEMA2_ORBITAL_MODULE_TYPE_ID } from '../modules/Cinema2OrbitalNativeModule'
import { CINEMA2_ORBITAL_PATTERNS } from '../modules/orbital/Cinema2OrbitalMotion'

export const CINEMA2_ORBITAL_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.orbital')
const id = (name: string) => cinema2StableId<Cinema2ParameterId>(`orbital-${name}`)

// Share the bounded glyph layout, camera, canonical trigger values and depth-aware render chain.
// Remap authored IDs so ORBITAL owns its own saved settings, scene and effects.
const template = JSON.parse(JSON.stringify(CINEMA2_SAY_IT_PRESET_MANIFEST)
  .replaceAll('say-it', 'orbital').replaceAll('SAY IT', 'ORBITAL')) as Cinema2NativePresetManifest
const removed = new Set(['motion-program', 'motion-direction', 'glyph-delay', 'axis-x', 'axis-y', 'axis-z', 'random-seed', 'spread'].map(id))
const changes: Record<string, Partial<Cinema2ParameterManifest>> = {
  text: { defaultValue: 'ORBITAL' },
  'glyph-scale': { defaultValue: .80 },
  motion: { defaultValue: .7, description: 'Strength of movement across the letters, sphere and debris.' },
  'motion-safety': { description: 'Reduced limits geometry movement. Lock Off holds the lettering and orbital assembly in place.' },
  'cycle-seconds': { label: 'Orbit Period', defaultValue: 8, description: 'Time in seconds for one orbital cycle at 120 BPM. BPM Sync follows the detected tempo.' },
  'material-style': { defaultValue: 'artifact', description: 'Use the supplied sphere material or a clean silver finish.', options: [
    { value: 'artifact', label: 'Sphere Material' }, { value: 'polished', label: 'Polished Silver' }, { value: 'amethyst', label: 'Brushed Silver' },
  ] },
  roughness: { defaultValue: .54 },
  'environment-reflection': { defaultValue: .85 },
  'led-outline': { exposure: 'hidden', label: 'Inlay Glow', defaultValue: true, description: 'Show violet light around the metal letter contours.' },
  'highlight-sweep': { defaultValue: .2 },
  'camera-motion': { defaultValue: .3 },
  trails: { defaultValue: 0 },
  focus: { defaultValue: 0 },
  bloom: { defaultValue: .4 },
  finish: { defaultValue: .42 },
  pattern: { defaultValue: 'gyroscopic-drift', options: CINEMA2_ORBITAL_PATTERNS, description: 'Choose the geometric choreography for the lettering and orbital assembly.' },
  trigger: { description: 'The standard musical event that advances the geometric pattern while Pattern Change is enabled.' },
  background: { label: 'Space Tint', defaultValue: [.008, .012, .018, 1], description: 'Background color of the orbital scene.' },
  chrome: { label: 'Letter Tint', defaultValue: [1, 1, 1, 1], description: 'Tint mixed with the sphere texture or the selected solid finish.' },
  'outline-color': { exposure: 'hidden', label: 'Inlay Color', defaultValue: [.49, .23, .98, 1], description: 'Accent color of the letter contours and the orbital lights.' },
}
function control(name: string, label: string, defaultValue: number, min: number, max: number, order: number, description: string): Cinema2ParameterManifest {
  return { id: id(name), label, description, type: 'float', defaultValue, min, max, step: .01,
    section: 'Design', group: 'Orbital Assembly', designParentGroup: 'design', order,
    exposure: 'primary', persistence: 'preset', reset: 'authored-default', modulatable: true, choreographable: true }
}
const orbitalParameters = [
  control('letter-depth', 'Letter Depth', 1, .4, 2, 30, 'Extrusion depth of the solid letter meshes.'),
  control('gyroscope-size', 'Sphere Size', 1, .55, 1.35, 31, 'Scale of the supplied metal sphere behind the curved lettering.'),
  control('ring-travel', 'Sphere Motion', 1, 0, 1.4, 32, 'Amount of the sphere’s original three-part animation.'),
  { ...control('planet', 'Legacy Planet', 0, 0, 1, 33, 'Retained only for saved scene compatibility; the old planet is removed.'), exposure: 'hidden' as const },
  control('debris', 'Orbital Debris', .55, 0, 1, 34, 'Density of the drifting debris field.'),
]
const sourceModule = template.modules![0]!
const parameterBindings = Object.fromEntries(Object.entries(sourceModule.parameterBindings ?? {}).filter(([, ref]) => !removed.has(ref.$ref)))
for (const parameter of orbitalParameters) parameterBindings[parameter.id.slice('orbital-'.length)] = cinema2Ref(parameter.id)

const routes = [
  ['bass', 'audio.bands.bass', 100], ['mids', 'audio.bands.mid', 160], ['highs', 'audio.bands.high', 90],
] as const
const geometryRules: Cinema2ChoreographyRuleManifest[] = routes.map(([property, path, smoothingMs], index) => ({
  id: cinema2StableId<Cinema2ChoreographyRuleId>(`orbital-${property}-route`),
  priority: 10 + index,
  enabledParameter: cinema2Ref(id('auto-performance')),
  source: { signal: 'continuous', path, capability: 'audio.bands', clamp: [0, 1], smoothingMs },
  actions: [{ id: cinema2StableId<Cinema2ChoreographyActionId>(`orbital-${property}-geometry`),
    target: { kind: 'module', ref: cinema2Ref(sourceModule.id), property }, operation: 'replace' }],
}))
const parameters = template.parameters!.filter(parameter => !removed.has(parameter.id))
  .map(parameter => ({ ...parameter, ...changes[parameter.id.slice('orbital-'.length)] }))

export const CINEMA2_ORBITAL_PRESET_MANIFEST = Object.freeze<Cinema2NativePresetManifest>({
  ...template,
  id: CINEMA2_ORBITAL_PRESET_ID, revision: 1,
  metadata: { ...template.metadata, name: 'ORBITAL', description: 'Metal lettering gently wrapped around the supplied textured sphere, sharing its physical surface finish in a dark neutral space.', tags: ['3d', 'typography', 'space', 'sphere'] },
  capabilities: [...template.capabilities!, { id: 'audio.bands', requirement: 'optional', purpose: 'Bass drives ring expansion, mids articulate the rig, and highs animate debris and docking lights.' }],
  parameters: [...parameters, ...orbitalParameters],
  modules: [{ ...sourceModule, typeId: CINEMA2_ORBITAL_MODULE_TYPE_ID, parameterBindings, parameters: {
    ...sourceModule.parameters, line1Text: 'ORBITAL', materialStyle: 'artifact', pattern: 'gyroscopic-drift', bass: 0, mids: 0, highs: 0,
    ...Object.fromEntries(orbitalParameters.map(parameter => [parameter.id.slice('orbital-'.length), parameter.defaultValue])),
  } }],
  choreography: { ...template.choreography, rules: [...template.choreography!.rules, ...geometryRules] },
  lighting: { ...template.lighting, lights: template.lighting!.lights.map(light => ({ ...light,
    color: light.type === 'ambient' ? [.3, .35, .4, 1] as const : [1, .98, .94, 1] as const,
    intensity: light.type === 'ambient' ? .38 : (light.intensity ?? 1) * .18,
  })) },
  environment: { ...template.environment, backgroundColor: [.008, .012, .018, 1] },
})

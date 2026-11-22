import { cinema2AutoTargets } from './Cinema2AutoPerformanceAuthoring'
import { withCinema2MoodDrives } from './Cinema2MoodConductorAuthoring'
import { cinema2StableId as moodStableId, type Cinema2ParameterId as MoodParameterId } from '../contracts/Cinema2NativePresetManifest'
import {
  cinema2NamespacedId, cinema2Ref, cinema2StableId,
  type Cinema2ChoreographyActionId, type Cinema2ChoreographyRuleId, type Cinema2ChoreographyRuleManifest,
  type Cinema2NativePresetManifest, type Cinema2ParameterManifest, type Cinema2ParameterId, type Cinema2PresetId,
} from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_SAY_IT_AUTHORED_PRESET_MANIFEST } from './Cinema2SayItPreset'
import { CINEMA2_ORBITAL_MODULE_TYPE_ID } from '../modules/Cinema2OrbitalNativeModule'
import { CINEMA2_ORBITAL_PATTERNS, CINEMA2_ORBITAL_POSITIONS } from '../modules/orbital/Cinema2OrbitalMotion'

export const CINEMA2_ORBITAL_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.orbital')
const id = (name: string) => cinema2StableId<Cinema2ParameterId>(`orbital-${name}`)

// Share the bounded glyph layout, camera, canonical trigger values and depth-aware render chain.
// Remap authored IDs so ORBITAL owns its own saved settings, scene and effects.
const template = JSON.parse(JSON.stringify(CINEMA2_SAY_IT_AUTHORED_PRESET_MANIFEST)
  .replaceAll('say-it', 'orbital').replaceAll('SAY IT', 'ORBITAL')) as Cinema2NativePresetManifest
const removed = new Set(['motion-program', 'motion-direction', 'glyph-delay', 'axis-x', 'axis-y', 'axis-z', 'random-seed', 'spread', 'alignment'].map(id))
const changes: Record<string, Partial<Cinema2ParameterManifest>> = {
  text: { defaultValue: 'ORBITAL' },
  'glyph-scale': { defaultValue: .80 },
  motion: { defaultValue: .7, description: 'Strength of movement across the letters, sphere and debris.' },
  'motion-safety': { description: 'Reduced limits geometry movement. Lock Off holds the lettering and orbital assembly in place.' },
  'cycle-seconds': { label: 'Orbit Period', defaultValue: 16, description: 'Time in seconds for the lettering to travel once round the sphere, and for one cycle of the sphere\u2019s movement, at 120 BPM. BPM Sync follows the detected tempo.' },
  'material-style': { defaultValue: 'artifact', description: 'Use the supplied sphere material or a clean silver finish.', options: [
    { value: 'artifact', label: 'Sphere Material' }, { value: 'polished', label: 'Polished Silver' }, { value: 'amethyst', label: 'Brushed Silver' },
  ] },
  roughness: { defaultValue: .32 },
  'environment-reflection': { defaultValue: 1.6 },
  'led-outline': { exposure: 'hidden', label: 'Inlay Glow', defaultValue: true, description: 'Show violet light around the metal letter contours.' },
  'highlight-sweep': { defaultValue: .45 },
  'camera-motion': { defaultValue: .3 },
  trails: { defaultValue: 0 },
  focus: { defaultValue: 0 },
  bloom: { defaultValue: .6 },
  finish: { defaultValue: .42 },
  pattern: { defaultValue: 'gyroscopic-drift', options: CINEMA2_ORBITAL_PATTERNS, description: 'Choose the geometric choreography for the lettering and orbital assembly.' },
  trigger: { description: 'The standard musical event that advances the geometric pattern while Pattern Change is enabled.' },
  background: { label: 'Space Tint', defaultValue: [.008, .012, .018, 1], description: 'Background color of the orbital scene.' },
  chrome: { label: 'Letter Tint', defaultValue: [.42, .44, .5, 1], description: 'Tint mixed with the sphere texture or the selected solid finish. The default is a dark gunmetal that lets the weathered texture and the highlights read.' },
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
// Position replaces the template's Alignment. It sits where Alignment did, and like Line 2 it is offered only while two lines are allowed.
const positionParameter: Cinema2ParameterManifest = Object.freeze({
  ...template.parameters!.find(parameter => parameter.id === id('alignment'))!,
  id: id('position'), label: 'Position', defaultValue: 'stacked', options: CINEMA2_ORBITAL_POSITIONS,
  description: 'Stacked keeps the two lines one above the other. Linear puts them on one row, opposite each other: one in front of the sphere and one behind it.',
  visibleWhen: Object.freeze([Object.freeze({ kind: 'parameter-equals' as const, parameterId: id('line-mode'), value: 'two' })]),
})
const sourceModule = template.modules![0]!
const parameterBindings = Object.fromEntries(Object.entries(sourceModule.parameterBindings ?? {}).filter(([, ref]) => !removed.has(ref.$ref)))
for (const parameter of orbitalParameters) parameterBindings[parameter.id.slice('orbital-'.length)] = cinema2Ref(parameter.id)
parameterBindings.position = cinema2Ref(positionParameter.id)

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

const CINEMA2_ORBITAL_AUTHORED_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = Object.freeze<Cinema2NativePresetManifest>({
  ...template,
  id: CINEMA2_ORBITAL_PRESET_ID, revision: 2,
  metadata: { ...template.metadata, name: 'ORBITAL', description: 'Metal lettering gently wrapped around the supplied textured sphere, sharing its physical surface finish in a dark neutral space.', tags: ['3d', 'typography', 'space', 'sphere'] },
  capabilities: [...template.capabilities!, { id: 'audio.bands', requirement: 'optional', purpose: 'Bass drives ring expansion, mids articulate the rig, and highs animate debris and docking lights.' }],
  parameters: [...parameters, positionParameter, ...orbitalParameters],
  modules: [{ ...sourceModule, typeId: CINEMA2_ORBITAL_MODULE_TYPE_ID, parameterBindings, parameters: {
    ...sourceModule.parameters, line1Text: 'ORBITAL', position: 'stacked', materialStyle: 'artifact', pattern: 'gyroscopic-drift', bass: 0, mids: 0, highs: 0,
    ...Object.fromEntries(orbitalParameters.map(parameter => [parameter.id.slice('orbital-'.length), parameter.defaultValue])),
  } }],
  choreography: { ...template.choreography, rules: [...template.choreography!.rules, ...geometryRules] },
  lighting: { ...template.lighting, lights: template.lighting!.lights.map(light => ({ ...light,
    color: light.type === 'ambient' ? [.3, .35, .4, 1] as const : [1, .98, .94, 1] as const,
    intensity: light.type === 'ambient' ? .38 : (light.intensity ?? 1) * .18,
  })) },
  environment: { ...template.environment, backgroundColor: [.008, .012, .018, 1] },
})

const moduleTarget = (property: string) => cinema2AutoTargets.module('orbital-glyphs' as string, property)
const moodParameter = (id: string) => moodStableId<MoodParameterId>(id)
// The migration's own changes to the authored preset: the Pattern controls move to Design, and the module reads the Auto Performance toggle
// (it needs it to know when the music chooses Pattern Change and the Trigger).
const ORBITAL_MOVED_TO_DESIGN: Readonly<Record<string, number>> = Object.freeze({ 'orbital-pattern': 20, 'orbital-pattern-change': 21, 'orbital-trigger': 22 })
const CINEMA2_ORBITAL_MOOD_BASE_MANIFEST: Readonly<Cinema2NativePresetManifest> = Object.freeze({
  ...CINEMA2_ORBITAL_AUTHORED_PRESET_MANIFEST,
  parameters: Object.freeze((CINEMA2_ORBITAL_AUTHORED_PRESET_MANIFEST.parameters ?? []).map(parameter => (
    ORBITAL_MOVED_TO_DESIGN[parameter.id] != null ? Object.freeze({ ...parameter, designParentGroup: 'design' as const, order: ORBITAL_MOVED_TO_DESIGN[parameter.id] }) : parameter
  ))),
  modules: Object.freeze((CINEMA2_ORBITAL_AUTHORED_PRESET_MANIFEST.modules ?? []).map(module => Object.freeze({
    ...module,
    parameters: Object.freeze({ ...(module.parameters ?? {}), autoPerformance: true }),
    parameterBindings: Object.freeze({ ...(module.parameterBindings ?? {}), autoPerformance: cinema2Ref(id('auto-performance')) }),
  }))),
})
/**
 * ORBITAL with the shared Mood Conductor and Auto Performance. With Auto Performance on, the passage's mood moves the assembly around its authored
 * values and the music chooses Pattern Change and the Trigger for the Pattern (these controls moved to Design). The orbit quickens as the passage
 * gets active and slows in a calm one; sphere motion, letter depth, reflections, the highlight sweep and the bloom swell on a peak and a drop; the
 * debris follows activity. Your text, layout, material and colors stay yours, and Motion Amount scales every drive.
 */
export const CINEMA2_ORBITAL_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = withCinema2MoodDrives(CINEMA2_ORBITAL_MOOD_BASE_MANIFEST, {
  idPrefix: 'orbital-auto',
  enabledParameter: moodParameter('orbital-auto-performance'),
  strengthParameter: moodParameter('orbital-motion'),
  patternControls: { patternChange: moodParameter('orbital-pattern-change'), trigger: moodParameter('orbital-trigger') },
  drives: [
    { id: 'cycle-activity', target: moduleTarget('cycleSeconds'), source: 'mood.activity', operation: 'add', value: -2.5 },
    { id: 'cycle-calm', target: moduleTarget('cycleSeconds'), source: 'mood.calm', operation: 'add', value: 2.5 },
    { id: 'travel-peak', target: moduleTarget('ring-travel'), source: 'mood.peak', operation: 'add', value: 0.2 },
    { id: 'travel-shock', target: moduleTarget('ring-travel'), source: 'mood.shock', operation: 'add', value: 0.3 },
    { id: 'sphere-shock', target: moduleTarget('gyroscope-size'), source: 'mood.shock', operation: 'add', value: 0.08 },
    { id: 'debris-activity', target: moduleTarget('debris'), source: 'mood.activity', operation: 'add', value: 0.25 },
    { id: 'debris-peak', target: moduleTarget('debris'), source: 'mood.peak', operation: 'add', value: 0.2 },
    { id: 'debris-calm', target: moduleTarget('debris'), source: 'mood.calm', operation: 'add', value: -0.15 },
    { id: 'depth-peak', target: moduleTarget('letter-depth'), source: 'mood.peak', operation: 'add', value: 0.2 },
    { id: 'reflection-peak', target: moduleTarget('environmentIntensity'), source: 'mood.peak', operation: 'add', value: 0.4 },
    { id: 'reflection-shock', target: moduleTarget('environmentIntensity'), source: 'mood.shock', operation: 'add', value: 0.6 },
    { id: 'sweep-activity', target: moduleTarget('highlightSweep'), source: 'mood.activity', operation: 'add', value: 0.3 },
    { id: 'sweep-shock', target: moduleTarget('highlightSweep'), source: 'mood.shock', operation: 'add', value: 0.4 },
    { id: 'bloom-peak', target: cinema2AutoTargets.effect('orbital-bloom-effect', 'intensity'), source: 'mood.peak', operation: 'add', value: 0.2 },
    { id: 'bloom-shock', target: cinema2AutoTargets.effect('orbital-bloom-effect', 'intensity'), source: 'mood.shock', operation: 'add', value: 0.5 },
  ],
})

import { cinema2NamespacedId, cinema2Ref, cinema2StableId, type Cinema2ChoreographyActionId, type Cinema2ChoreographyRuleId, type Cinema2ChoreographyRuleManifest, type Cinema2NativePresetManifest, type Cinema2ParameterManifest, type Cinema2ParameterId, type Cinema2PresetId } from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_SAY_IT_PRESET_MANIFEST } from './Cinema2SayItPreset'
import { CINEMA2_SUBMERGE_MODULE_TYPE_ID } from '../modules/Cinema2SubmergeNativeModule'
import { CINEMA2_SUBMERGE_PATTERNS } from '../modules/submerge/Cinema2SubmergeMotion'

export const CINEMA2_SUBMERGE_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.submerge')
export const submergeParameterId = (name: string) => cinema2StableId<Cinema2ParameterId>(`submerge-${name}`)

// Compose the proven typography camera, depth-aware post chain and musical authority.
// A private copy gives this preset independent, persistent identities for every node and control.
const template = JSON.parse(JSON.stringify(CINEMA2_SAY_IT_PRESET_MANIFEST)
  .replaceAll('say-it', 'submerge').replaceAll('SAY IT', 'SUBMERGE')) as Cinema2NativePresetManifest
const removed = new Set(['motion-program', 'motion-direction', 'glyph-delay', 'axis-x', 'axis-y', 'axis-z', 'random-seed'].map(submergeParameterId))
const changes: Record<string, Partial<Cinema2ParameterManifest>> = {
  text: { defaultValue: 'SUBMERGE' },
  motion: { defaultValue: 0.65, description: 'Strength of the underwater geometric choreography. Zero assembles every letter and stills the architecture.' },
  'motion-safety': { description: 'Reduced limits geometric movement; Lock Off holds letters, columns and arches in place.' },
  spread: { label: 'Current Reach', description: 'Bounded distance traveled by letters and architecture.', defaultValue: 1, max: 1.5 },
  'cycle-seconds': { label: 'Current Period', description: 'Duration of an underwater movement cycle at 120 BPM; BPM Sync follows the track tempo.', defaultValue: 8 },
  'material-style': { defaultValue: 'ceramic', description: 'Select glazed ceramic, reflective metal or translucent frosted glass.', options: [{ value: 'ceramic', label: 'Glazed Ceramic' }, { value: 'metal', label: 'Metal' }, { value: 'glass', label: 'Frosted Glass' }] },
  roughness: { defaultValue: 0.28 },
  'environment-reflection': { defaultValue: 0.85, description: 'Strength of the reflected environment on the submerged letters.' },
  'led-outline': { label: 'Edge Glow', defaultValue: false, description: 'Illuminate the contours of the submerged letters.' },
  'highlight-sweep': { defaultValue: 0.2, description: 'Speed of the reflected highlights traveling across the letter surfaces.' },
  'camera-motion': { defaultValue: 0.25 },
  trails: { defaultValue: 0 },
  focus: { defaultValue: 0.08 },
  bloom: { defaultValue: 0.55 },
  pattern: { defaultValue: 'suspension', description: 'Select one of six coordinated letter and environment movement patterns.', options: CINEMA2_SUBMERGE_PATTERNS },
  trigger: { description: 'The standard musical event that advances the geometric pattern when Pattern Change is enabled.' },
  background: { label: 'Water Tint', description: 'Color of the water, depth haze and submerged background.', defaultValue: [0.012, 0.11, 0.16, 1] },
  chrome: { label: 'Letter Tint', description: 'Surface color of the extruded lettering.', defaultValue: [0.53, 0.74, 0.81, 1] },
  'outline-color': { label: 'Edge Glow', defaultValue: [0.12, 0.8, 1, 1] },
}
function environmentControl(name: string, label: string, defaultValue: number, min: number, max: number, step: number, order: number, description: string): Cinema2ParameterManifest {
  return {
    id: submergeParameterId(name), label, description, type: 'float', defaultValue, min, max, step,
    section: 'Design', group: 'Environment', designParentGroup: 'design', order,
    exposure: 'primary', persistence: 'preset', reset: 'authored-default', modulatable: true, choreographable: true,
  }
}
const environmentParameters = [
  environmentControl('buoyancy', 'Letter Buoyancy', 0.6, 0, 1, 0.01, 30, 'Vertical freedom of suspended letters.'),
  environmentControl('letter-depth', 'Letter Depth', 1, 0.4, 2, 0.05, 31, 'Extrusion depth of the solid glyph meshes.'),
  environmentControl('architecture', 'Architecture', 1, 0, 1, 0.01, 32, 'Visibility of submerged columns, arches and floor.'),
  environmentControl('caustics', 'Caustic Light', 0.75, 0, 1.5, 0.01, 33, 'Moving water-light patterns projected over the architecture.'),
  environmentControl('haze', 'Depth Haze', 0.055, 0, 0.15, 0.001, 34, 'Water fog density; distant structures fade into the water.'),
  environmentControl('particles', 'Suspended Particles', 0.65, 0, 1, 0.01, 35, 'Density of slowly drifting suspended particles.'),
  environmentControl('bubbles', 'Bubble Trails', 0.5, 0, 1, 0.01, 36, 'Density of rising bubble trails, accented by high-frequency energy.'),
]
const sourceModule = template.modules![0]!
const parameterBindings = Object.fromEntries(Object.entries(sourceModule.parameterBindings ?? {}).filter(([, ref]) => !removed.has(ref.$ref)))
for (const parameter of environmentParameters) parameterBindings[parameter.id.replace('submerge-', '')] = cinema2Ref(parameter.id)
parameterBindings.waterColor = cinema2Ref(submergeParameterId('background'))

const waterAudioRoutes = [
  ['bass', 'audio.bands.bass', 'audio.bands', 120],
  ['mids', 'audio.bands.mid', 'audio.bands', 180],
  ['highs', 'audio.bands.high', 'audio.bands', 90],
  ['energy', 'audio.features.overallEnergy', 'audio.features', 160],
] as const
const waterAudioRules: Cinema2ChoreographyRuleManifest[] = waterAudioRoutes.map(([property, path, capability, smoothingMs], index) => ({
  id: cinema2StableId<Cinema2ChoreographyRuleId>(`submerge-${property}-route`),
  priority: 10 + index,
  enabledParameter: cinema2Ref(submergeParameterId('auto-performance')),
  source: { signal: 'continuous', path, capability, clamp: [0, 1], smoothingMs },
  actions: [{
    id: cinema2StableId<Cinema2ChoreographyActionId>(`submerge-${property}-geometry`),
    target: { kind: 'module', ref: cinema2Ref(sourceModule.id), property },
    operation: 'replace',
  }],
}))

export const CINEMA2_SUBMERGE_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = Object.freeze<Cinema2NativePresetManifest>({
  ...template,
  revision: 1,
  id: CINEMA2_SUBMERGE_PRESET_ID,
  metadata: { ...template.metadata, name: 'SUBMERGE', description: 'Configurable solid 3D typography suspended in a submerged colonnade, with musical pressure waves, currents, caustics and bubbles.', tags: ['3d', 'typography', 'underwater', 'submerge'] },
  capabilities: [
    ...template.capabilities!,
    { id: 'audio.bands', requirement: 'optional', purpose: 'Bass displaces glyphs, mids animate caustics, and highs lift bubbles.' },
    { id: 'audio.features', requirement: 'optional', purpose: 'Overall energy adds bounded geometric motion.' },
  ],
  choreography: { ...template.choreography, rules: [...template.choreography!.rules, ...waterAudioRules] },
  parameters: [
    ...template.parameters!.filter(parameter => !removed.has(parameter.id)).map(parameter => ({ ...parameter, ...changes[parameter.id.replace('submerge-', '')] }) as Cinema2ParameterManifest),
    ...environmentParameters,
  ],
  modules: [{ ...sourceModule, typeId: CINEMA2_SUBMERGE_MODULE_TYPE_ID, parameterBindings, parameters: {
    ...sourceModule.parameters, line1Text: 'SUBMERGE', materialStyle: 'ceramic', pattern: 'suspension', waterColor: [0.012, 0.11, 0.16, 1], bass: 0, mids: 0, highs: 0, energy: 0,
    ...Object.fromEntries(environmentParameters.map(parameter => [parameter.id.replace('submerge-', ''), parameter.defaultValue])),
  } }],
  lighting: { ...template.lighting, lights: template.lighting!.lights.map(light => ({ ...light,
    color: light.type === 'ambient' ? [0.18, 0.47, 0.58, 1] as const : light.color,
    intensity: light.type === 'ambient' ? 0.25 : (light.intensity ?? 1) * 0.7,
  })) },
  environment: { ...template.environment, backgroundColor: [0.012, 0.11, 0.16, 1] as const },
})

import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID, CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  cinema2NamespacedId, cinema2Ref, cinema2StableId,
  type Cinema2LayerId, type Cinema2ModuleId, type Cinema2NativePresetManifest,
  type Cinema2PresetId, type Cinema2SceneNodeId, type Cinema2ParameterManifest,
} from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_TRIPPY_BRO_NATIVE_MODULE_TYPE_ID } from '../modules/Cinema2TrippyBroNativeModule'
import { TRIPPY_BRO_COLORS, TRIPPY_BRO_NUMBERS, TRIPPY_BRO_PATTERNS, TRIPPY_BRO_PATTERN_LABELS, trippyBroParameterId as pid } from '../modules/trippyBro/Cinema2TrippyBroDomain'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from './Cinema2AfterhoursPreset'
import { TRIPPY_BRO_CHANNELS, TRIPPY_BRO_CHOREOGRAPHY } from './Cinema2TrippyBroChoreography'
import { TRIPPY_BRO_EFFECTS, TRIPPY_BRO_FINISHING_RULES, TRIPPY_BRO_RENDER_GRAPH } from './Cinema2TrippyBroFinishing'

export const CINEMA2_TRIPPY_BRO_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.trippy-bro')
export const TRIPPY_BRO_MODULE_ID = cinema2StableId<Cinema2ModuleId>('trippy-bro-system')
const ROOT_ID = cinema2StableId<Cinema2SceneNodeId>('trippy-bro-root')
const NODE_ID = cinema2StableId<Cinema2SceneNodeId>('trippy-bro-lattice')
const base = { section: 'Design', exposure: 'primary', persistence: 'preset', reset: 'authored-default' } as const
const numberLabels: Record<string, string> = { intensity: 'Master Intensity', reactivity: 'Music Reactivity', scale: 'Composition Scale', density: 'Line Density', width: 'Stroke Width', speed: 'Motion Speed', amount: 'Motion Amount', detail: 'Secondary Detail', bloom: 'Bloom', trails: 'Trails', split: 'Chromatic Separation', echo: 'Geometric Echo' }
const numberDescriptions: Record<string, string> = {
  intensity: 'Emission ceiling; zero extinguishes artwork while retaining Background.', reactivity: 'Strength of bounded shared musical responses.',
  scale: 'Uniform cover scale. Overscan beyond all four edges is intentional.', density: 'Subdivision budget for the active geometric pattern.',
  width: 'Multiplies the approved bold stroke weight.', speed: 'Pattern travel rate. Zero stops phase travel.', amount: 'Geometric motion range. Zero stops procedural deformation.',
  detail: 'Budget for orbiting tracers and peripheral ticks. Zero removes them.', bloom: 'Shared bloom mix. Zero bypasses the halo.',
  trails: 'Shared finite feedback persistence mix. Zero clears history.', split: 'Bounded color separation across stroke edges. Zero disables separation.', echo: 'Two faint, delayed geometric contours. Zero removes both.',
}
// Controls are authored generically; artwork and transient performance stay module-local.
const designKeys = ['intensity', 'reactivity', 'scale', 'density', 'width', 'speed', 'amount', 'detail', 'bloom', 'trails', 'split', 'echo'] as const
const parameters: Cinema2ParameterManifest[] = [
  ...designKeys.map(key => ({ ...base, id: pid(key), label: numberLabels[key], description: numberDescriptions[key], type: key === 'density' ? 'integer' as const : 'float' as const,
    min: TRIPPY_BRO_NUMBERS[key][0], defaultValue: TRIPPY_BRO_NUMBERS[key][1], max: TRIPPY_BRO_NUMBERS[key][2], step: key === 'density' ? 1 : 0.01,
    designParentGroup: (key === 'intensity' || key === 'reactivity') ? 'master-controls' as const : (['bloom','trails','split','echo'].includes(key) ? 'effects' as const : 'design' as const), group: key === 'intensity' ? 'Output' : (['bloom','trails','split','echo'].includes(key) ? 'Finishing' : 'Geometry'), order: 10 + designKeys.indexOf(key) })),
  { ...base, id: pid('auto-performance'), label: 'Auto Performance', description: 'Allows temporary build/drop pattern substitutions. Manual selection takes effect immediately; the underlying base resumes afterward.', type: 'boolean', defaultValue: false, designParentGroup: 'master-controls', group: 'Timing', order: 2 },
  { ...base, id: pid('bpm-sync'), label: 'BPM Sync', description: 'Locks motion cycles to shared musical timing; OFF uses authored seconds-based rates. Host sync does not veto this choice.', type: 'boolean', defaultValue: true, designParentGroup: 'master-controls', group: 'Timing', order: 1 },
  { ...base, id: pid('pattern'), label: 'Pattern', type: 'enum', defaultValue: 'prismLattice', options: TRIPPY_BRO_PATTERNS.map((value, i) => ({ value, label: TRIPPY_BRO_PATTERN_LABELS[i] })), designParentGroup: 'design', group: 'Pattern', order: 0 },
  { ...base, id: pid('pattern-change'), label: 'Pattern Change', type: 'boolean', defaultValue: false, designParentGroup: 'design', group: 'Pattern', order: 1 },
  { ...base, id: pid('trigger'), label: 'Trigger', type: 'enum', defaultValue: 'phrase', options: CINEMA2_AFTERHOURS_TRIGGER_OPTIONS, visibleWhen: [{ kind: 'parameter-equals', parameterId: pid('pattern-change'), value: true }], designParentGroup: 'design', group: 'Pattern', order: 2 },
  ...Object.entries(TRIPPY_BRO_COLORS).map(([key, defaultValue], order) => ({ ...base, id: pid(key), label: ({ background: 'Background', cyan: 'Cyan Structure', blue: 'Blue Weave', magenta: 'Magenta Accent', amber: 'Amber Orbit', highlight: 'Highlight' } as Record<string, string>)[key], type: 'color' as const, defaultValue: [...defaultValue], designParentGroup: 'palette' as const, group: 'Colors', order })),
]

export const CINEMA2_TRIPPY_BRO_PRESET_MANIFEST = Object.freeze<Cinema2NativePresetManifest>({
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID, schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_TRIPPY_BRO_PRESET_ID, revision: 3,
  metadata: { name: 'Trippy, Bro', description: 'Eight oversized neon geometric instruments with woven lattices, rotating fans, and musical choreography.', tags: ['geometric', 'neon', 'psychedelic', 'audio-reactive'] },
  capabilities: [{ id: 'render.webgl2', requirement: 'required', purpose: 'Native screen-space geometric artwork.' },
    ...(['audio.transport','audio.features','audio.bands','music.beat','music.rhythm-events','music.downbeat','music.bar','music.phrase','music.section','music.build','music.drop','music.vocal-presence','visual-director.significance','render.history'] as const).map(id=>({id, requirement:'optional' as const,purpose:'Shared musical timing and bounded neon instrument performance.'})),
  ],
  parameters,
  modules: [{ id: TRIPPY_BRO_MODULE_ID, typeId: CINEMA2_TRIPPY_BRO_NATIVE_MODULE_TYPE_ID, version: 1, enabled: true,
    parameters: { ...Object.fromEntries(parameters.map(p => [p.id.replace('trippy-bro-', ''), p.defaultValue!])), ...Object.fromEntries(TRIPPY_BRO_CHANNELS.map(name=>[name,0])) },
    parameterBindings: Object.fromEntries(parameters.map(p => [p.id.replace('trippy-bro-', ''), cinema2Ref(p.id)])),
  }],
  choreography: { rules: [...TRIPPY_BRO_CHOREOGRAPHY,...TRIPPY_BRO_FINISHING_RULES] },
  effects: TRIPPY_BRO_EFFECTS, render: TRIPPY_BRO_RENDER_GRAPH,
  scene: { nodes: [
    { id: ROOT_ID, kind: 'group', coordinateSpace: 'normalized-screen', visible: true },
    { id: NODE_ID, kind: 'module', parent: cinema2Ref(ROOT_ID), module: cinema2Ref(TRIPPY_BRO_MODULE_ID), visible: true },
  ] },
  layers: [{ id: cinema2StableId<Cinema2LayerId>('trippy-bro-hero'), label: 'Neon Instrument', source: cinema2Ref(ROOT_ID), visible: true, opacity: 1, blendMode: 'normal', depthPolicy: 'disabled', order: 0 }],
})

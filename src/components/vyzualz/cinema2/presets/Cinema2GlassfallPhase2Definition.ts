import { cinema2NamespacedId, cinema2StableId, cinema2Ref, type Cinema2PresetId, type Cinema2ParameterId, type Cinema2ParameterManifest, type Cinema2NativePresetManifest } from '../contracts/Cinema2NativePresetManifest'
import { GLASSFALL_PHASE1_MANIFEST } from './Cinema2GlassfallPhase1Definition'
import { GLASSFALL_PHASE2_MODULE_TYPE, cinema2GlassfallPhase2Module } from '../modules/glassfall/Cinema2GlassfallNativeModule'
import { GLASSFALL_NUMBERS, GLASSFALL_PALETTE, GLASSFALL_PATTERNS, GLASSFALL_PATTERN_LABELS } from '../modules/glassfall/Cinema2GlassfallMotion'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from './Cinema2AfterhoursPreset'
export const GLASSFALL_PHASE2_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.glassfall.phase2')
export const glassfallParameterId = (name: string) => cinema2StableId<Cinema2ParameterId>(`glassfall-${name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`)
const pid = glassfallParameterId
const base = { section: 'Design', exposure: 'primary', persistence: 'preset', reset: 'authored-default', modulatable: false, choreographable: false, automatable: false } as const
const labels: Record<string, string> = { intensity: 'Master Intensity', scale: 'Field Scale', spacing: 'Spacing', speed: 'Fall Speed', sequenceSpeed: 'Sequence Speed', relief: 'Relief' }
const descriptions: Record<string, string> = { intensity: 'Ceiling for motif light; the unlit physical form remains.', scale: 'Uniform scale of the triangle installation. Camera remains fixed.', spacing: 'Changes triangle spacing on the paired-band lattice.', speed: 'Downward travel rate. Zero holds the current travel phase.', sequenceSpeed: 'Lighting program rate. Zero holds the sequence phase.', relief: 'Physical extrusion depth for the triangles.' }
const eventGate = [{ kind: 'parameter-equals' as const, parameterId: pid('eventsReady'), value: true }]
const parameters: Cinema2ParameterManifest[] = [
  ...(GLASSFALL_PHASE1_MANIFEST.parameters ?? []),
  ...Object.entries(GLASSFALL_NUMBERS).map(([name, [min, defaultValue, max]], order) => ({ ...base, id: pid(name), label: labels[name], description: descriptions[name], type: 'float' as const, min, defaultValue, max, step: .01, designParentGroup: name === 'intensity' ? 'master-controls' as const : 'design' as const, group: name === 'intensity' ? 'Master' : 'Field', order: 10 + order })),
  { ...base, id: pid('sync'), label: 'BPM Sync', description: 'Locks descent and illumination timing to shared transport/grid. OFF uses authored seconds; host Sync does not veto this toggle.', type: 'boolean', defaultValue: true, designParentGroup: 'master-controls', group: 'Timing', order: 0 },
  { ...base, id: pid('pattern'), label: 'Pattern', type: 'enum', defaultValue: 'glassfall', options: GLASSFALL_PATTERNS.map((value, i) => ({ value, label: GLASSFALL_PATTERN_LABELS[i] })), designParentGroup: 'design', group: 'Pattern', order: 0 },
  { ...base, id: pid('patternChange'), label: 'Pattern Change', description: 'Preview: shared musical-event switching connects in phase 3.', type: 'boolean', defaultValue: false, enabledWhen: eventGate, designParentGroup: 'design', group: 'Pattern', order: 1 },
  { ...base, id: pid('trigger'), label: 'Trigger', description: 'Preview: canonical event choices; event consumption connects in phase 3.', type: 'enum', defaultValue: 'phrase', options: CINEMA2_AFTERHOURS_TRIGGER_OPTIONS, enabledWhen: eventGate, visibleWhen: [{ kind: 'parameter-equals', parameterId: pid('patternChange'), value: true }], designParentGroup: 'design', group: 'Pattern', order: 2 },
  ...Object.entries(GLASSFALL_PALETTE).map(([name, defaultValue], order) => ({ ...base, id: pid(name), label: ({ background: 'Background', cyan: 'Triangle Cyan', violet: 'Triangle Violet', highlight: 'Triangle Highlight', panel: 'Panel Color' } as Record<string, string>)[name], description: 'Independent authored color role.', type: 'color' as const, defaultValue: [...defaultValue, 1], designParentGroup: 'palette' as const, group: 'Colors', order })),
  { id: pid('eventsReady'), label: 'Phase 3 Events Ready', type: 'boolean', defaultValue: false, section: 'Diagnostics', group: 'Phase 2', exposure: 'hidden', persistence: 'preset', reset: 'authored-default' },
]
const module = GLASSFALL_PHASE1_MANIFEST.modules![0]
/** Manual/motion review only. Not a completed first-party catalog declaration. */
export const GLASSFALL_PHASE2_MANIFEST: Cinema2NativePresetManifest = {
  ...GLASSFALL_PHASE1_MANIFEST, id: GLASSFALL_PHASE2_ID, revision: 1,
  metadata: { name: 'GLASSFALL — Phase 2 Review', description: 'Manual controls, six native lighting programs and shared-transport motion. Audio/event switching deferred.', tags: ['internal', 'diagnostic'] },
  parameters,
  modules: [{ ...module, typeId: GLASSFALL_PHASE2_MODULE_TYPE, parameters: { ...module.parameters, ...Object.fromEntries(parameters.filter(p => p.id.startsWith('glassfall-') && p.section === 'Design').map(p => [p.id.slice('glassfall-'.length).replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase()), p.defaultValue!])) }, parameterBindings: { ...module.parameterBindings, ...Object.fromEntries(parameters.filter(p => p.section === 'Design').map(p => [p.id.slice('glassfall-'.length).replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase()), cinema2Ref(p.id)])) } }],
}

import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID, CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  cinema2NamespacedId, cinema2Ref, cinema2StableId,
  type Cinema2NativePresetManifest, type Cinema2PresetId, type Cinema2ModuleId, type Cinema2ParameterId,
  type Cinema2ParameterManifest, type Cinema2SceneNodeId, type Cinema2CameraId, type Cinema2Vector3,
  type Cinema2RenderPassId, type Cinema2RenderTargetId, type Cinema2RenderSlotId, type Cinema2EffectId,
  type Cinema2EffectTypeId, type Cinema2LightId, type Cinema2ChoreographyRuleId, type Cinema2ChoreographyActionId,
  type Cinema2ChoreographyRuleManifest, type Cinema2ChoreographyContinuousSourcePath, type Cinema2CapabilityId,
} from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_SIGNS_ASSET_ID, CINEMA2_SIGNS_MODULE_TYPE_ID } from '../modules/Cinema2SignsNativeModule'
import { SIGNS_DEFAULT_PATTERN, SIGNS_PATTERN_OPTIONS, SIGNS_SCALARS, SIGNS_PALETTE, SIGNS_PALETTE_LABELS } from '../modules/signs/SignsPatterns'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from './Cinema2AfterhoursPreset'
import { withCinema2MoodDrives, type Cinema2MoodDrive } from './Cinema2MoodConductorAuthoring'

export const CINEMA2_SIGNS_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.signs')
export const signsParameterId = (name: string) => cinema2StableId<Cinema2ParameterId>(`signs-${name.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}`)
const pid = signsParameterId, bind = (name: string) => cinema2Ref(pid(name))
const moduleId = cinema2StableId<Cinema2ModuleId>('signs-scene'), root = cinema2StableId<Cinema2SceneNodeId>('signs-root'), model = cinema2StableId<Cinema2SceneNodeId>('signs-model')
const camera = cinema2StableId<Cinema2CameraId>('signs-camera')
const target = (name: string) => cinema2StableId<Cinema2RenderTargetId>(`signs-${name}-target`)
const pass = (name: string) => cinema2StableId<Cinema2RenderPassId>(`signs-${name}-pass`)
const slot = (name: string) => cinema2StableId<Cinema2RenderSlotId>(`signs-${name}-color`)
const effect = (name: string) => cinema2StableId<Cinema2EffectId>(`signs-${name}`)
const base = { section: 'Design', exposure: 'primary', persistence: 'preset', reset: 'authored-default' } as const
const toggle = (name: string, label: string, parent: Cinema2ParameterManifest['designParentGroup'], value: boolean, order: number, group?: string): Cinema2ParameterManifest => ({ ...base, id: pid(name), label, type: 'boolean', defaultValue: value, designParentGroup: parent, order, group })
const scalar = (name: string, label: string, parent: Cinema2ParameterManifest['designParentGroup'], value: number, min: number, max: number, order: number, group?: string): Cinema2ParameterManifest => ({ ...base, id: pid(name), label, type: 'float', defaultValue: value, min, max, step: .01, designParentGroup: parent, order, group })
const parameters: readonly Cinema2ParameterManifest[] = [
  toggle('autoPerformance', 'Auto Performance', 'master-controls', false, 0),
  toggle('bpmSync', 'BPM Sync', 'master-controls', true, 1),
  ...SIGNS_SCALARS.map(([key, label, parent, value, min, max], i) => scalar(key, label, parent, value, min, max, i + 2, parent === 'design' ? 'Signal' : undefined)),
  { ...base, id: pid('pattern'), label: 'Pattern', type: 'enum', defaultValue: SIGNS_DEFAULT_PATTERN, options: SIGNS_PATTERN_OPTIONS, designParentGroup: 'design', group: 'Pattern', order: 0 },
  toggle('patternChange', 'Pattern Change', 'design', false, 1, 'Pattern'),
  { ...base, id: pid('trigger'), label: 'Trigger', type: 'enum', defaultValue: 'bar4', options: CINEMA2_AFTERHOURS_TRIGGER_OPTIONS, designParentGroup: 'design', group: 'Pattern', order: 2, visibleWhen: [{ kind: 'parameter-equals', parameterId: pid('patternChange'), value: true }] },
  { ...base, id: pid('cameraMode'), label: 'Camera Mode', type: 'enum', defaultValue: 'drift', options: [{ value: 'static', label: 'Front Lock' }, { value: 'drift', label: 'Signal Drift' }, { value: 'dolly', label: 'Slow Push' }], designParentGroup: 'design', group: 'Camera', order: 0 },
  toggle('cameraMotion', 'Camera Motion', 'design', true, 1, 'Camera'),
  scalar('cameraSpeed', 'Camera Speed', 'design', .65, 0, 2, 2, 'Camera'),
  ...Object.entries(SIGNS_PALETTE).map(([key, value], order): Cinema2ParameterManifest => ({ ...base, id: pid(key), label: SIGNS_PALETTE_LABELS[key as keyof typeof SIGNS_PALETTE], type: 'color', defaultValue: value, designParentGroup: 'palette', order })),
]
// The two effects and the background belong to the shared render graph, not the model controller.
const bound = ['autoPerformance', 'bpmSync', 'pattern', 'patternChange', 'trigger', ...SIGNS_SCALARS.map(([key]) => key).filter(key => key !== 'bloom' && key !== 'finishMix'), ...Object.keys(SIGNS_PALETTE).filter(key => key !== 'backgroundColor')]
const mt = (property: string) => ({ kind: 'module' as const, ref: cinema2Ref(moduleId), property })
const continuous = (name: string, capability: Cinema2CapabilityId, path: Cinema2ChoreographyContinuousSourcePath, property: string, value: number): Cinema2ChoreographyRuleManifest => ({
  id: cinema2StableId<Cinema2ChoreographyRuleId>(`signs-${name}`), priority: 20, strengthParameter: bind('reactivity'),
  source: { signal: 'continuous', capability, path, clamp: [0, 1], smoothingMs: 130 }, conditions: [{ kind: 'not-silent' }],
  actions: [{ id: cinema2StableId<Cinema2ChoreographyActionId>(`signs-${name}-drive`), target: mt(property), operation: 'multiply', value }],
})
const accent = (signal: 'kick' | 'snare' | 'drop', property: string, value: number, release: number): Cinema2ChoreographyRuleManifest => ({
  id: cinema2StableId<Cinema2ChoreographyRuleId>(`signs-${signal}-${pid(property)}`), priority: 30, strengthParameter: bind('reactivity'),
  source: { signal, capability: signal === 'drop' ? 'music.drop' : 'music.rhythm-events' }, conditions: [{ kind: 'once-per-event' }, ...(signal === 'drop' ? [] : [{ kind: 'not-silent' as const }])],
  actions: [{ id: cinema2StableId<Cinema2ChoreographyActionId>(`signs-${signal}-${pid(property)}-envelope`), target: mt(property), operation: 'envelope', composition: 'multiply', value, envelope: { attack: .025, hold: .04, release, unit: 'seconds' }, retrigger: 'restart' }],
})
const home: Cinema2Vector3 = [0, 0, 3.85], focus: Cinema2Vector3 = [0, 0, 0]
const points = Array.from({ length: 16 }, (_, i) => { const a = i * Math.PI / 8; return { position: [.58 * Math.sin(a), .35 * Math.sin(a * 2), 3.85 + .22 * (1 - Math.cos(a))] as Cinema2Vector3, target: focus } })
const dolly = [home, [0, .14, 3.55], [0, 0, 3.85], [0, -.14, 4.15]].map(position => ({ position: position as Cinema2Vector3, target: focus }))
const authored: Readonly<Cinema2NativePresetManifest> = {
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID, schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION, id: CINEMA2_SIGNS_PRESET_ID, revision: 1,
  metadata: { name: 'SIGNS', description: 'An interwoven neon transmission: original animated crop-circle artwork with thicker illuminated paths and an expanded crop-circle field.', tags: ['neon', 'abstract', '3d', 'audio-reactive'] },
  capabilities: [
    { id: 'render.webgl2', requirement: 'required', purpose: 'Native textured sign and light markers.' },
    { id: 'render.depth', requirement: 'required', purpose: 'Original occluding structure and emissive plane.' },
    { id: 'scene.3d', requirement: 'required', purpose: 'Preserved imported scene hierarchy.' },
    { id: 'camera.world', requirement: 'required', purpose: 'Bounded frontal cinematic camera.' },
    { id: 'lighting', requirement: 'required', purpose: 'Dark sculptural structure lighting.' },
    { id: 'render.hdr', requirement: 'optional', purpose: 'Emissive texture and selective bloom.' },
    ...(['audio.transport', 'audio.features', 'audio.bands', 'music.beat', 'music.rhythm-events', 'music.downbeat', 'music.bar', 'music.phrase', 'music.section', 'music.vocal-presence', 'music.build', 'music.drop', 'visual-director.significance'] as const).map(id => ({ id, requirement: 'optional' as const, purpose: 'Shared timing, musical facts and performance meaning.' })),
  ],
  parameters,
  modules: [{ id: moduleId, typeId: CINEMA2_SIGNS_MODULE_TYPE_ID, version: 1, parameters: { ...Object.fromEntries(bound.map(name => [name, parameters.find(p => p.id === pid(name))!.defaultValue!])), environmentIntensity: .03 }, parameterBindings: Object.fromEntries(bound.map(name => [name, bind(name)])), config: { hdr: true, instances: [{ asset: CINEMA2_SIGNS_ASSET_ID, node: model, preserveMaterials: true, spin: false }] } }],
  scene: { nodes: [{ id: root, kind: 'group', coordinateSpace: 'world' }, { id: model, kind: 'module', parent: cinema2Ref(root), module: cinema2Ref(moduleId) }], roots: [cinema2Ref(root)] },
  cameras: [{ id: camera, label: 'SIGNS frontal camera', projection: 'perspective', fovDegrees: 42, minAspect: 1, minAspectAnchor: 0, near: .1, far: 40, transform: { position: home }, target: focus,
    rig: { kind: 'path', points, durationSeconds: 24, loop: true }, rigVariants: { static: { kind: 'static' }, drift: { kind: 'path', points, durationSeconds: 24, loop: true }, dolly: { kind: 'path', points: dolly, durationSeconds: 20, loop: true } }, motion: { idleMotion: true, interpolation: 'spline', constantSpeed: true, tempo: { referenceBpm: 120, flightSpeed: true } }, controls: { rigMode: bind('cameraMode'), motionEnabled: bind('cameraMotion'), motionSpeed: bind('cameraSpeed'), tempoSync: bind('bpmSync') }, safety: { minPosition: [-1, -1, 3.45], maxPosition: [1, 1, 4.5], minFovDegrees: 40, maxFovDegrees: 45 } }],
  defaults: { camera: cinema2Ref(camera) },
  lighting: { lights: [{ id: cinema2StableId<Cinema2LightId>('signs-fill'), type: 'ambient', color: [.55, .65, .8, 1], intensity: .05 }, { id: cinema2StableId<Cinema2LightId>('signs-key'), type: 'directional', color: [.65, .8, 1, 1], intensity: .16, transform: { position: [3, 4, 5] }, targetNode: cinema2Ref(root) }] },
  environment: { backgroundColor: SIGNS_PALETTE.backgroundColor, exposure: 1, controls: { backgroundColor: bind('backgroundColor') } },
  choreography: { tempoSyncParameter: bind('bpmSync'), rules: [
    continuous('bass-depth', 'audio.bands', 'audio.bands.bass', 'chaseDepth', 1.25),
    continuous('high-markers', 'audio.bands', 'audio.bands.high', 'markerLevel', 1.55),
    continuous('energy-rate', 'audio.features', 'audio.features.overallEnergy', 'chaseRate', 1.3),
    continuous('vocal-restraint', 'music.vocal-presence', 'audio.features.vocalPresence', 'accentMix', .5),
    continuous('director-momentum', 'visual-director.significance', 'director.momentum', 'rotationRate', 1.2),
    accent('kick', 'intensity', 1.3, .28), accent('snare', 'accentMix', 1.7, .24), accent('drop', 'markerLevel', 1.8, 1.25), accent('drop', 'intensity', 1.45, .9),
  ] },
  effects: [
    { id: effect('bloom'), typeId: cinema2StableId<Cinema2EffectTypeId>('hdr-bloom'), version: 1, enabled: true, order: 0, scope: 'output', parameters: { mix: 1, threshold: .85, knee: .3, intensity: .38, spread: .32, levels: 4, clampMax: 12 }, parameterBindings: { intensity: bind('bloom') } },
    { id: effect('finish'), typeId: cinema2StableId<Cinema2EffectTypeId>('cinematic-finish'), version: 1, enabled: true, order: 1, scope: 'output', parameters: { mix: 1, toneMap: 1, exposure: .95, contrast: 1.06, saturation: 1, vignette: .12, vignetteSoftness: .7, grain: 0, aberration: 0 }, parameterBindings: { mix: bind('finishMix') } },
  ],
  render: { targets: [{ id: target('scene'), descriptor: { size: { kind: 'viewport' }, colorFormat: 'rgba16f', fallbackColorFormat: 'rgba8', depthFormat: 'depth24' } }, { id: target('bloom'), descriptor: { size: { kind: 'viewport' }, colorFormat: 'rgba16f', fallbackColorFormat: 'rgba8' } }], passes: [
    { id: pass('scene'), kind: 'scene', scene: cinema2Ref(root), outputs: [{ id: slot('scene'), target: cinema2Ref(target('scene')), attachment: 'color' }, { id: cinema2StableId<Cinema2RenderSlotId>('signs-scene-depth'), target: cinema2Ref(target('scene')), attachment: 'depth' }] },
    { id: pass('bloom'), kind: 'fullscreen', effect: cinema2Ref(effect('bloom')), dependsOn: [cinema2Ref(pass('scene'))], inputs: [{ id: slot('bloom-input'), source: { pass: cinema2Ref(pass('scene')), output: slot('scene') }, attachment: 'color' }], outputs: [{ id: slot('bloom'), target: cinema2Ref(target('bloom')), attachment: 'color' }] },
    { id: pass('finish'), kind: 'fullscreen', effect: cinema2Ref(effect('finish')), dependsOn: [cinema2Ref(pass('bloom'))], inputs: [{ id: slot('finish-input'), source: { pass: cinema2Ref(pass('bloom')), output: slot('bloom') }, attachment: 'color' }] },
  ], outputPass: cinema2Ref(pass('finish')) },
  output: { renderPass: cinema2Ref(pass('finish')), colorSpace: 'srgb', alphaMode: 'opaque' },
}
const drive = (id: string, property: string, source: Cinema2MoodDrive['source'], value: number): Cinema2MoodDrive => ({ id, target: mt(property), source, operation: 'multiply', value })
export const CINEMA2_SIGNS_PRESET_MANIFEST = withCinema2MoodDrives(authored, {
  idPrefix: 'signs-auto', enabledParameter: pid('autoPerformance'), strengthParameter: pid('reactivity'), patternControls: { patternChange: pid('patternChange'), trigger: pid('trigger') },
  drives: [drive('calm-motion', 'rotationRate', 'mood.calm', .45), drive('momentum-chase', 'chaseRate', 'mood.momentum', 1.5), drive('build-depth', 'chaseDepth', 'mood.build', 1.4), drive('peak-markers', 'markerLevel', 'mood.peak', 1.5), drive('shock-accent', 'accentMix', 'mood.shock', 1.45), drive('silence-intensity', 'intensity', 'mood.silence', .08), drive('silence-motion', 'chaseRate', 'mood.silence', .1), drive('silence-rotation', 'rotationRate', 'mood.silence', .1),
    { id: 'brightness-bloom', target: { kind: 'effect', ref: cinema2Ref(effect('bloom')), property: 'intensity' }, source: 'mood.brightness', operation: 'multiply', value: 1.45 },
    { id: 'calm-grade', target: { kind: 'effect', ref: cinema2Ref(effect('finish')), property: 'mix' }, source: 'mood.calm', operation: 'multiply', value: .75 },
  ],
})

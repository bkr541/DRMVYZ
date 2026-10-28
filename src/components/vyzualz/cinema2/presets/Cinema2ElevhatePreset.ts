import { elevhateAudioRules } from './Cinema2ElevhateChoreography'
import { ELEVHATE_CHANNELS } from '../modules/elevhate/Cinema2ElevhatePerformance'
import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID, CINEMA2_NATIVE_PRESET_SCHEMA_VERSION, cinema2NamespacedId, cinema2StableId, cinema2Ref,
  type Cinema2NativePresetManifest, type Cinema2PresetId, type Cinema2ParameterId, type Cinema2ModuleId, type Cinema2CameraId,
  type Cinema2SceneNodeId, type Cinema2LayerId, type Cinema2RenderTargetId, type Cinema2RenderPassId, type Cinema2RenderSlotId,
  type Cinema2EffectId, type Cinema2ParameterManifest,
} from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_ELEVHATE_MODULE_TYPE_ID } from '../modules/Cinema2ElevhateNativeModule'
import { buildElevhateFlight, ELEVHATE_PATTERNS } from '../modules/elevhate/Cinema2ElevhateGeometry'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from './Cinema2AfterhoursPreset'
import { CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID } from '../effects/Cinema2HdrBloomEffect'
import { CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID } from '../effects/Cinema2CinematicFinishEffect'
import { CINEMA2_QUALITY_MODE_PARAMETER } from '../parameters/Cinema2PerformanceParameters'

export const CINEMA2_ELEVHATE_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.elevhate')
export const ELEVHATE_MODULE = cinema2StableId<Cinema2ModuleId>('elevhate-world')
export const ELEVHATE_CAMERA = cinema2StableId<Cinema2CameraId>('elevhate-flight')
export const elevhateParameter = (name: string) => cinema2StableId<Cinema2ParameterId>(`elevhate-${name.toLowerCase()}`)
const node = cinema2StableId<Cinema2SceneNodeId>('elevhate-root'), layer = cinema2StableId<Cinema2LayerId>('elevhate-layer')
const target = cinema2StableId<Cinema2RenderTargetId>('elevhate-scene-target'), bloomTarget = cinema2StableId<Cinema2RenderTargetId>('elevhate-bloom-target')
const scene = cinema2StableId<Cinema2RenderPassId>('elevhate-scene'), bloomPass = cinema2StableId<Cinema2RenderPassId>('elevhate-bloom'), finishPass = cinema2StableId<Cinema2RenderPassId>('elevhate-finish')
const slot = (name: string) => cinema2StableId<Cinema2RenderSlotId>(`elevhate-${name.toLowerCase()}`)
const bloom = cinema2StableId<Cinema2EffectId>('elevhate-bloom'), finish = cinema2StableId<Cinema2EffectId>('elevhate-finish')
const base = { section: 'Design', exposure: 'primary', persistence: 'preset', reset: 'authored-default', modulatable: false, choreographable: false, automatable: false } as const
const param = (name: string, label: string, type: 'float' | 'boolean' | 'color', defaultValue: number | boolean | readonly [number, number, number, number], parent: 'master-controls' | 'design' | 'effects' | 'palette', order: number, description: string, min = 0, max = 1, step = .01): Cinema2ParameterManifest => ({
  ...base, id: elevhateParameter(name), label, type, defaultValue, designParentGroup: parent, group: parent === 'palette' ? 'Colors' : parent === 'master-controls' ? 'Playback' : parent === 'design' ? 'Architecture' : 'Finishing', order, description,
  ...(type === 'float' ? { min, max, step } : {}),
} as Cinema2ParameterManifest)
const bindings = Object.fromEntries(['master','speed','response','bpmSync','autoPerformance','pattern','patternChange','trigger','opening','width','sway','haze','void','body','primary','junction','secondary'].map(name => [name, cinema2Ref(elevhateParameter(name))]))
export const CINEMA2_ELEVHATE_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = {
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID, schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_ELEVHATE_PRESET_ID, revision: 1,
  metadata: { name: 'Elevhate', description: 'An outlined black megastructure with a continuous journey through passages, crossings and stacked levels.', tags: ['keeper', '3d', 'architecture', 'elevhate'] },
  capabilities: [
    { id: 'render.webgl2', requirement: 'required', purpose: 'Instanced solid lattice.' },
    { id: 'render.depth', requirement: 'required', purpose: 'Opaque occlusion between populated levels.' },
    { id: 'scene.3d', requirement: 'required', purpose: 'Physical multi-axis passages.' },
    { id: 'camera.world', requirement: 'required', purpose: 'Shared world-space camera flight.' },
    ...(['audio.features','audio.bands','music.beat','music.rhythm-events','music.downbeat','music.bar','music.phrase','music.build','music.drop','music.vocal-presence','visual-director.significance'] as const).map(id => ({ id, requirement: 'optional' as const, purpose: 'Shared musical facts and bounded native choreography.' })),
    { id: 'render.hdr' , requirement: 'optional', purpose: 'Fine emissive edges and contained bloom.' },
  ],
  choreography: { rules: elevhateAudioRules(ELEVHATE_MODULE, elevhateParameter('response')) },
  parameters: [CINEMA2_QUALITY_MODE_PARAMETER,
    param('master','Master Intensity','float',1,'master-controls',1,'Scales structure and edge emission.',0,1.5),
    param('speed','Travel Speed','float',1,'master-controls',2,'Journey rate. Zero holds the camera.',0,2),
    param('response','Music Response','float',.8,'master-controls',3,'Scales bounded musical responses.'),
    param('bpmSync','BPM Sync','boolean',true,'master-controls',4,'Follows shared track tempo; OFF uses 120 BPM.'),
    param('autoPerformance','Auto Performance','boolean',false,'master-controls',5,'Allows temporary build/drop patterns; a manual pattern immediately takes control.'),
    { ...base, id: elevhateParameter('pattern'), label: 'Pattern', description: 'Chooses one of six structural programs without changing the journey.', type: 'enum', defaultValue: 'crossgrid', options: ELEVHATE_PATTERNS, designParentGroup: 'design', group: 'Pattern', order: 1 },
    { ...base, id: elevhateParameter('patternChange'), label: 'Pattern Change', description: 'Advances the base pattern on a fresh selected musical event.', type: 'boolean', defaultValue: false, designParentGroup: 'design', group: 'Pattern', order: 2 },
    { ...base, id: elevhateParameter('trigger'), label: 'Trigger', description: 'Selects the shared event that advances the base pattern.', type: 'enum', defaultValue: 'bar4', options: CINEMA2_AFTERHOURS_TRIGGER_OPTIONS, visibleWhen: [{ kind: 'parameter-equals', parameterId: elevhateParameter('patternChange'), value: true }], designParentGroup: 'design', group: 'Pattern', order: 3 },
    param('opening','Opening Width','float',4,'design',4,'Clear width of the square passages.',3,6),
    param('width','Edge Thickness','float',1.15,'design',5,'Screen-space width of outlined edges.',.6,3),
    param('sway','Camera Sway','float',.025,'design',6,'Restrained horizontal weave and bob. Zero disables sway.',0,.2),
    param('bloom','Bloom','float',.2,'effects',1,'Contained halo around bright outlines. Zero bypasses bloom.'),
    param('haze','Depth Haze','float',.004,'effects',2,'Depth attenuation of distant geometry. Zero disables haze.',0,.05,.001),
    param('void','Void','color',[.001,.001,.001,1],'palette',1,'Background and distant void.'),
    param('body','Structure','color',[.002,.002,.002,1],'palette',2,'Opaque solid faces.'),
    param('primary','Primary Edges','color',[1,1,1,1],'palette',3,'Vertical structural outlines.'),
    param('junction','Junction Edges','color',[1,1,1,1],'palette',4,'Horizontal outlines and hub frames.'),
    param('secondary','Secondary Edges','color',[.8,.8,.8,1],'palette',5,'Distant outlines and inset rails.'),
  ],
  modules: [{ id: ELEVHATE_MODULE, typeId: CINEMA2_ELEVHATE_MODULE_TYPE_ID, version: 1, enabled: true, parameters: { ...ELEVHATE_CHANNELS, master: 1, speed: 1, response: .8, bpmSync: true, autoPerformance: false, pattern: 'crossgrid', patternChange: false, trigger: 'bar4', opening: 4, width: 1.15, sway: .025, haze: .004, void: [.001,.001,.001,1], body: [.002,.002,.002,1], primary: [1,1,1,1], junction: [1,1,1,1], secondary: [.8,.8,.8,1] }, parameterBindings: bindings }],
  scene: { nodes: [{ id: node, kind: 'module', module: cinema2Ref(ELEVHATE_MODULE) }], roots: [cinema2Ref(node)] },
  layers: [{ id: layer, label: 'Solid lattice', source: cinema2Ref(node), role: 'world', depthPolicy: 'read-write', order: 0 }],
  cameras: [{ id: ELEVHATE_CAMERA, label: 'Elevhate Journey', projection: 'perspective', fovDegrees: 80, near: .1, far: 140,
    transform: { position: [0,0,0] }, target: [0,.7,-18],
    rig: { kind: 'fly', points: buildElevhateFlight(), durationSeconds: 40, loop: true },
    motion: { interpolation: 'spline', constantSpeed: true, tempo: { referenceBpm: 120, flightSpeed: true, minRate: .33, maxRate: 2, weave: 1, bob: .5, roll: 0, fov: 0, punch: 0 } },
    controls: { tempoSync: cinema2Ref(elevhateParameter('bpmSync')), motionSpeed: cinema2Ref(elevhateParameter('speed')), motionAmount: cinema2Ref(elevhateParameter('sway')) },
    smoothingMs: 60,
    safety: { minPosition: [-100,-40,-100], maxPosition: [100,40,100], maxPositionOffset: [1,1,1], maxTargetOffset: [1,1,1], minFovDegrees: 79, maxFovDegrees: 81, minNear: .1, maxFar: 140 },
  }],
  environment: { backgroundColor: [.001,.001,.001,1], exposure: 1, controls: { backgroundColor: cinema2Ref(elevhateParameter('void')) } },
  effects: [
    { id: bloom, typeId: CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID, version: 1, enabled: true, order: 0, scope: 'output', parameters: { mix: 1, threshold: 1.7, knee: .3, intensity: .2, spread: .2, levels: 3, clampMax: 8 }, parameterBindings: { intensity: cinema2Ref(elevhateParameter('bloom')) } },
    { id: finish, typeId: CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID, version: 1, enabled: true, order: 1, scope: 'output', parameters: { mix: 1, toneMap: 1, exposure: 1, contrast: 1, saturation: 1, vignette: 0, grain: 0, aberration: 0 } },
  ],
  render: {
    targets: [
      { id: target, descriptor: { size: { kind: 'viewport' }, colorFormat: 'rgba16f', fallbackColorFormat: 'rgba8', depthFormat: 'depth24' }, ownership: 'transient' },
      { id: bloomTarget, descriptor: { size: { kind: 'viewport' }, colorFormat: 'rgba16f', fallbackColorFormat: 'rgba8' }, ownership: 'transient' },
    ],
    passes: [
      { id: scene, kind: 'scene', layers: [cinema2Ref(layer)], outputs: [{ id: slot('scene-color'), target: cinema2Ref(target), attachment: 'color' }, { id: slot('scene-depth'), target: cinema2Ref(target), attachment: 'depth' }] },
      { id: bloomPass, kind: 'fullscreen', dependsOn: [cinema2Ref(scene)], effect: cinema2Ref(bloom), inputs: [{ id: slot('bloom-in'), source: { pass: cinema2Ref(scene), output: slot('scene-color') }, attachment: 'color' }], outputs: [{ id: slot('bloom-out'), target: cinema2Ref(bloomTarget), attachment: 'color' }] },
      { id: finishPass, kind: 'fullscreen', dependsOn: [cinema2Ref(bloomPass)], effect: cinema2Ref(finish), inputs: [{ id: slot('finish-in'), source: { pass: cinema2Ref(bloomPass), output: slot('bloom-out') }, attachment: 'color' }] },
    ], outputPass: cinema2Ref(finishPass),
  },
  defaults: { camera: cinema2Ref(ELEVHATE_CAMERA) }, output: { renderPass: cinema2Ref(finishPass), colorSpace: 'srgb', alphaMode: 'opaque' },
}

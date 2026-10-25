import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID, CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  cinema2NamespacedId, cinema2Ref, cinema2StableId,
  type Cinema2CameraId, type Cinema2EffectId, type Cinema2EffectManifest, type Cinema2EffectTypeId, type Cinema2LayerId, type Cinema2LightId,
  type Cinema2MediaSlotId, type Cinema2ModuleId, type Cinema2NativePresetManifest, type Cinema2ParameterId, type Cinema2ParameterManifest,
  type Cinema2PresetId, type Cinema2RenderPassId, type Cinema2RenderSlotId, type Cinema2RenderTargetId, type Cinema2SceneNodeId, type Cinema2Vector3,
} from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_QUALITY_MODE_PARAMETER } from '../parameters/Cinema2PerformanceParameters'
import { CINEMA2_WET_CONCRETE_TEXTURE_ASSET_ID } from '../assets/Cinema2TextureAssetManifest'
import { CINEMA2_VACANCY_MODULE_TYPE_ID } from '../modules/Cinema2VacancyNativeModule'
import { VACANCY_ASSET_ID, VACANCY_COLORS, VACANCY_DEFAULTS, VACANCY_PATTERNS } from '../modules/vacancy/Cinema2VacancyDomain'

import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from './Cinema2AfterhoursPreset'
import { VACANCY_RESPONSE_DEFAULTS } from '../modules/vacancy/Cinema2VacancyPerformance'
import { vacancyMusicRules, vacancyFinishGates } from './Cinema2VacancyChoreography'

export const CINEMA2_VACANCY_MEDIA_ID = cinema2StableId<Cinema2MediaSlotId>('vacancy-screen-media')
export const CINEMA2_VACANCY_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.vacancy')
export const CINEMA2_VACANCY_CAMERA_ID = cinema2StableId<Cinema2CameraId>('vacancy-reference-camera')
const ROOT = cinema2StableId<Cinema2SceneNodeId>('vacancy-root')
const MODEL = cinema2StableId<Cinema2SceneNodeId>('vacancy-room-and-tower')
const MODULE = cinema2StableId<Cinema2ModuleId>('vacancy-core')
const LAYER = cinema2StableId<Cinema2LayerId>('vacancy-world')
const TARGET = cinema2StableId<Cinema2RenderTargetId>('vacancy-scene-target')
const SCENE = cinema2StableId<Cinema2RenderPassId>('vacancy-scene')
const OUTPUT = cinema2StableId<Cinema2RenderPassId>('vacancy-output')
const COLOR = cinema2StableId<Cinema2RenderSlotId>('vacancy-color')
const DEPTH = cinema2StableId<Cinema2RenderSlotId>('vacancy-depth')
const vec = (x: number, y: number, z: number): Cinema2Vector3 => [x, y, z]

const parameter = (name: string) => cinema2StableId<Cinema2ParameterId>(`vacancy-${name}`)
export const CINEMA2_VACANCY_PARAMETER_IDS = {
  master: parameter('master-intensity'),
  roomVisibility: parameter('room-visibility'),
  backgroundColor: parameter('background-color'),
  screenColor: parameter('screen-color'),
  ...Object.fromEntries(['bpmSync', 'musicResponse', 'bassRattle', 'autoPerformance', 'cameraMotion', 'cameraOrbit', 'pattern', 'patternChange', 'trigger', 'screensLit', 'static', 'scanlines', 'towerSize', 'mediaOnScreens', 'mediaLayout', 'staticOverMedia', 'media', 'bloom', 'reflections', 'haze', 'highlightColor', 'glowColor', 'hazeColor'].map(name => [name, parameter(name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`))])) as Record<'bpmSync' | 'musicResponse' | 'bassRattle' | 'autoPerformance' | 'cameraMotion' | 'cameraOrbit' | 'pattern' | 'patternChange' | 'trigger' | 'screensLit' | 'static' | 'scanlines' | 'towerSize' | 'mediaOnScreens' | 'mediaLayout' | 'staticOverMedia' | 'media' | 'bloom' | 'reflections' | 'haze' | 'highlightColor' | 'glowColor' | 'hazeColor', Cinema2ParameterId>,
} as const
const P = CINEMA2_VACANCY_PARAMETER_IDS
const base = { section: 'Design', exposure: 'primary', persistence: 'preset', reset: 'authored-default' } as const

const float = (key: keyof typeof P, label: string, value: number, parent: 'master-controls' | 'design' | 'effects', order: number): Cinema2ParameterManifest => ({
  ...base, id: P[key], label, type: 'float', min: 0, max: 1, step: .01, defaultValue: value, designParentGroup: parent,
  group: parent === 'master-controls' ? 'Performance' : parent === 'effects' ? 'Room Finish' : 'Televisions', order,
})
const toggle = (key: keyof typeof P, label: string, value: boolean, parent: 'master-controls' | 'design', order: number): Cinema2ParameterManifest => ({
  ...base, id: P[key], label, type: 'boolean', defaultValue: value, designParentGroup: parent,
  group: parent === 'master-controls' ? 'Performance' : 'Televisions', order,
})
const parameters: Cinema2ParameterManifest[] = [
  CINEMA2_QUALITY_MODE_PARAMETER,
  float('master', 'Master Intensity', VACANCY_DEFAULTS.master, 'master-controls', 1),
  { ...toggle('bpmSync', 'BPM Sync', true, 'master-controls', 2), description: 'Locks screen programs and band roll to shared BPM. Off free-runs at 100 BPM. Independent of Audio Dock BPM Sync and event triggers.' },
  float('musicResponse', 'Music Response', VACANCY_DEFAULTS.musicResponse, 'master-controls', 3),
  float('bassRattle', 'Bass Rattle', VACANCY_DEFAULTS.bassRattle, 'master-controls', 4),
  { ...float('cameraMotion', 'Camera Motion', VACANCY_DEFAULTS.cameraMotion, 'master-controls', 5), description: 'Bounded camera drift. Zero restores the authored shot at the selected orbit angle.' },
  { ...float('cameraOrbit', 'Orbit Angle', 0, 'master-controls', 6), min: -25, max: 25, step: .5, unit: 'degrees', description: 'Rotate around the front of the stack within the room’s clear viewing arc. Zero restores the approved frontal shot.' },
  { ...toggle('autoPerformance', 'Auto Performance', false, 'master-controls', 7), description: 'Temporarily substitutes Vacancy during new builds and Dead Air during fresh drops. The current base resumes; manual Pattern edits take over immediately.' },
  { ...base, id: P.pattern, label: 'Pattern', type: 'enum', options: VACANCY_PATTERNS, defaultValue: 'dead-air', designParentGroup: 'design', group: 'Pattern', order: 1 },
  { ...toggle('patternChange', 'Pattern Change', false, 'design', 2), group: 'Pattern' },
  { ...base, id: P.trigger, label: 'Trigger', type: 'enum', options: CINEMA2_AFTERHOURS_TRIGGER_OPTIONS, defaultValue: 'bar4', designParentGroup: 'design', group: 'Pattern', order: 3,
    visibleWhen: [{ kind: 'parameter-equals', parameterId: P.patternChange, value: true }] },
  float('screensLit', 'Screens Lit', 1, 'design', 10), float('static', 'Static', 1, 'design', 11), float('scanlines', 'Scanlines', 1, 'design', 12),
  { ...base, id: P.towerSize, label: 'Tower Size', type: 'enum', defaultValue: 'standard', options: ['compact', 'standard', 'tall'].map(value => ({ value, label: value[0]!.toUpperCase() + value.slice(1) })), designParentGroup: 'design', group: 'Televisions', order: 13 },
  toggle('mediaOnScreens', 'Media on Screens', false, 'design', 20),
  { ...base, id: P.media, label: 'Media', type: 'media', defaultValue: null, mediaSlot: cinema2Ref(CINEMA2_VACANCY_MEDIA_ID), designParentGroup: 'design', group: 'Screen Media', order: 21,
    visibleWhen: [{ kind: 'parameter-equals', parameterId: P.mediaOnScreens, value: true }] },
  { ...base, id: P.mediaLayout, label: 'Media Layout', type: 'enum', defaultValue: 'every-screen', options: [{ value: 'every-screen', label: 'Every screen' }, { value: 'stack-wall', label: 'Stack wall' }], designParentGroup: 'design', group: 'Screen Media', order: 22,
    visibleWhen: [{ kind: 'parameter-equals', parameterId: P.mediaOnScreens, value: true }] },
  { ...float('staticOverMedia', 'Static Over Media', .12, 'design', 23), group: 'Screen Media', visibleWhen: [{ kind: 'parameter-equals', parameterId: P.mediaOnScreens, value: true }] },
  float('bloom', 'Bloom', VACANCY_DEFAULTS.bloom, 'effects', 1), float('reflections', 'Floor Reflections', VACANCY_DEFAULTS.reflections, 'effects', 2),
  float('haze', 'Haze', 0, 'effects', 3), float('roomVisibility', 'Room Visibility', VACANCY_DEFAULTS.roomVisibility, 'effects', 4),
  ...Object.entries(VACANCY_COLORS).map(([name, defaultValue], order): Cinema2ParameterManifest => ({ ...base, id: P[`${name}Color` as keyof typeof P],
    label: name[0]!.toUpperCase() + name.slice(1), type: 'color', defaultValue, designParentGroup: 'palette', group: 'Room Palette', order })),
]

const EFFECTS = Object.fromEntries(['reflections', 'haze', 'bloom'].map(name => [name, cinema2StableId<Cinema2EffectId>(`vacancy-${name}-effect`)])) as Record<'reflections' | 'haze' | 'bloom', Cinema2EffectId>

const effects: readonly Cinema2EffectManifest[] = [
  // The room's floor is the plane y = 0; this replaces it with dark, wet concrete that mirrors the screens.
  { id: EFFECTS.reflections, typeId: cinema2StableId<Cinema2EffectTypeId>('reflective-floor'), version: 1, enabled: true, scope: 'output', order: 0,
    parameters: { mix: .62, floorY: .004, reflectivity: .8, lowReflectivity: .35, mediumReflectivity: .55, roughness: .32, fresnel: 2.4,
      baseColor: [.012, .016, .024, 1], skyColor: [.012, .016, .024, 1], baseLift: 1, albedo: .04, poolIntensity: 0, specular: .2,
      maxReflection: 40, fadeDistance: 24, thickness: 2.5, grit: .12, gritScale: 4, streak: 0, samplingStability: 1, edgeFallback: .6,
      surfaceTexture: CINEMA2_WET_CONCRETE_TEXTURE_ASSET_ID, surfaceTextureScale: 4, surfaceTextureStrength: .3 },
    parameterBindings: { mix: cinema2Ref(P.reflections), baseColor: cinema2Ref(P.backgroundColor), skyColor: cinema2Ref(P.backgroundColor) } },
  { id: EFFECTS.haze, typeId: cinema2StableId<Cinema2EffectTypeId>('volumetric-atmosphere'), version: 1, enabled: true, scope: 'output', order: 1,
    parameters: { mix: 0, density: .008, beamIntensity: .3, ambientHaze: .5, mistAmount: .1, mistHeight: 1, floorY: 0, floorReflection: 0, maxDistance: 15, reactivity: 0, occlusion: .15, noiseScale: .4, noiseStrength: .6, drift: .08, hazeColor: VACANCY_COLORS.haze },
    parameterBindings: { mix: cinema2Ref(P.haze), hazeColor: cinema2Ref(P.hazeColor) } },
  { id: EFFECTS.bloom, typeId: cinema2StableId<Cinema2EffectTypeId>('hdr-bloom'), version: 1, enabled: true, scope: 'output', order: 2,
    parameters: { mix: .8, threshold: .6, knee: .3, intensity: 1.8, spread: .7, levels: 6, clampMax: 8 }, parameterBindings: { mix: cinema2Ref(P.bloom) } },
]

function finishingGraph() {
  let previousPass = SCENE, previousColor = COLOR
  const targets = [], passes = []
  for (const name of ['reflections', 'haze', 'bloom'] as const) {
    const id = cinema2StableId<Cinema2RenderPassId>(`vacancy-${name}-pass`)
    const target = cinema2StableId<Cinema2RenderTargetId>(`vacancy-${name}-target`)
    const slot = cinema2StableId<Cinema2RenderSlotId>(`vacancy-${name}-color`)
    targets.push({ id: target, descriptor: { size: { kind: 'viewport' as const }, colorFormat: 'rgba8' as const }, ownership: 'transient' as const })
    passes.push({ id, kind: 'fullscreen' as const, effect: cinema2Ref(EFFECTS[name]), dependsOn: [cinema2Ref(previousPass)],
      inputs: [{ id: cinema2StableId<Cinema2RenderSlotId>(`vacancy-${name}-source`), attachment: 'color' as const, source: { pass: cinema2Ref(previousPass), output: previousColor } },
        ...(name === 'bloom' ? [] : [{ id: cinema2StableId<Cinema2RenderSlotId>(`vacancy-${name}-depth`), attachment: 'depth' as const, source: { pass: cinema2Ref(SCENE), output: DEPTH } }])],
      outputs: [{ id: slot, target: cinema2Ref(target), attachment: 'color' as const }] })
    previousPass = id; previousColor = slot
  }
  return { targets, passes, pass: previousPass, color: previousColor }
}
const finishing = finishingGraph()

/** VACANCY: a tower of stacked CRT televisions in an empty dark room, every screen glowing analog static. Approved composition with native CRT programs, media and bounded music response. */
export const CINEMA2_VACANCY_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = {
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID, schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_VACANCY_PRESET_ID, revision: 2,
  metadata: {
    name: 'VACANCY',
    description: 'A pyramid of stacked CRT televisions in the middle of an empty, dark brick room. Every screen glows with analog static that lights the wet concrete floor and the room around it.',
    tags: ['keeper', 'vacancy', 'televisions', '3d'],
  },
  capabilities: [
    { id: 'render.webgl2', requirement: 'required', purpose: 'Depth-tested world-space room, television tower and glowing screens.' },
    ...(['media.image', 'media.video', 'media.svg', 'audio.bands', 'audio.features', 'music.beat', 'music.rhythm-events', 'music.downbeat', 'music.phrase', 'music.drop', 'music.build', 'music.vocal-presence', 'visual-director.significance'] as const).map(id => ({ id, requirement: 'optional' as const, purpose: 'Shared musical timing and bounded CRT screen response.' })),
  ],
  parameters,
  mediaSlots: [{ id: CINEMA2_VACANCY_MEDIA_ID, label: 'Screen Media', accepts: ['image', 'video', 'svg'] }],
  choreography: { rules: [...vacancyMusicRules(MODULE), ...vacancyFinishGates(P.master, Object.values(EFFECTS))] },
  modules: [{
    id: MODULE, typeId: CINEMA2_VACANCY_MODULE_TYPE_ID, version: 1, enabled: true,
    parameters: { ...VACANCY_DEFAULTS, ...VACANCY_RESPONSE_DEFAULTS, bpmSync: true, pattern: 'dead-air', patternChange: false, trigger: 'bar4', autoPerformance: false, towerSize: 'standard', mediaOnScreens: false, mediaLayout: 'every-screen',
      ...Object.fromEntries(Object.entries(VACANCY_COLORS).map(([name, color]) => [`${name}Color`, color])) },
    parameterBindings: Object.fromEntries(Object.entries(P).filter(([name]) => !['cameraMotion', 'cameraOrbit', 'media', 'bloom', 'reflections', 'haze'].includes(name)).map(([name, id]) => [name, cinema2Ref(id)])),
    media: { screenMedia: cinema2Ref(CINEMA2_VACANCY_MEDIA_ID) },
    config: { asset: VACANCY_ASSET_ID },
  }],
  effects,
  scene: { nodes: [
    { id: ROOT, kind: 'group', coordinateSpace: 'world' },
    { id: MODEL, kind: 'module', parent: cinema2Ref(ROOT), module: cinema2Ref(MODULE) },
  ], roots: [cinema2Ref(ROOT)] },
  layers: [{ id: LAYER, label: 'VACANCY room and tower', source: cinema2Ref(ROOT), role: 'world', depthPolicy: 'read-write', order: 0 }],
  cameras: [{
    id: CINEMA2_VACANCY_CAMERA_ID, label: 'Pyramid hero', projection: 'perspective',
    fovDegrees: 40, minAspect: 1, near: 0.4, far: 24,
    transform: { position: vec(0.46, 1.28, 4.05) }, target: vec(0.46, 1.04, -0.1), rig: { kind: 'orbit', radius: Math.hypot(4.15, .24), azimuthDegrees: 0, elevationDegrees: Math.atan2(.24, 4.15) * 180 / Math.PI, angularVelocityDegreesPerSecond: 0 },
    motion: { drift: { position: .04, target: .008, rollDegrees: .2, fovDegrees: .2, speed: .06, seed: 391 } },
    controls: { motionAmount: cinema2Ref(P.cameraMotion), orbitAzimuthDegrees: cinema2Ref(P.cameraOrbit) },
    safety: { minPosition: vec(-1.35, 1.2, 3.5), maxPosition: vec(2.3, 1.36, 4.15), maxTargetOffset: vec(.02, .02, .02), minFovDegrees: 39.5, maxFovDegrees: 40.5 },
  }],
  defaults: { camera: cinema2Ref(CINEMA2_VACANCY_CAMERA_ID) },
  lighting: { lights: [
    { id: cinema2StableId<Cinema2LightId>('vacancy-ambient'), type: 'ambient', color: [0.05, 0.06, 0.09, 1], intensity: 0.004 },
  ] },
  environment: { backgroundColor: VACANCY_COLORS.background, exposure: 1, controls: { backgroundColor: cinema2Ref(P.backgroundColor) } },
  render: {
    targets: [{ id: TARGET, descriptor: { size: { kind: 'viewport' }, colorFormat: 'rgba8', depthFormat: 'depth24' }, ownership: 'transient' }, ...finishing.targets],
    passes: [
      { id: SCENE, kind: 'scene', layers: [cinema2Ref(LAYER)], outputs: [
        { id: COLOR, target: cinema2Ref(TARGET), attachment: 'color' },
        { id: DEPTH, target: cinema2Ref(TARGET), attachment: 'depth' },
      ] },
      ...finishing.passes,
      { id: OUTPUT, kind: 'output', inputs: [{ id: cinema2StableId<Cinema2RenderSlotId>('vacancy-final-color'), source: { pass: cinema2Ref(finishing.pass), output: finishing.color }, attachment: 'color' }] },
    ], outputPass: cinema2Ref(OUTPUT),
  },
  output: { renderPass: cinema2Ref(OUTPUT), colorSpace: 'srgb', alphaMode: 'opaque' },
}

import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID, CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  cinema2NamespacedId, cinema2StableId, cinema2Ref,
  type Cinema2PresetId, type Cinema2ModuleId, type Cinema2SceneNodeId, type Cinema2LayerId,
  type Cinema2CameraId, type Cinema2RenderPassId, type Cinema2RenderTargetId, type Cinema2RenderSlotId, type Cinema2EffectId,
  type Cinema2NativePresetManifest, type Cinema2ParameterManifest, type Cinema2ParameterId,
} from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_BLOCKSHIFT_NATIVE_MODULE_TYPE_ID } from '../modules/Cinema2BlockshiftNativeModule'
import { CINEMA2_BLOCKSHIFT_BLOCK_COUNT, CINEMA2_BLOCKSHIFT_PALETTE, CINEMA2_BLOCKSHIFT_PATTERN_IDS } from '../modules/blockshift/Cinema2BlockshiftDomain'
import { CINEMA2_BLOCKSHIFT_AUDIO_DEFAULTS } from '../modules/blockshift/Cinema2BlockshiftAudio'
import { CINEMA2_BLOCKSHIFT_DIRECTOR_DEFAULTS } from '../modules/blockshift/Cinema2BlockshiftPerformance'
import { blockshiftAudioRules } from './Cinema2BlockshiftChoreography'
import { CINEMA2_QUALITY_MODE_PARAMETER } from '../parameters/Cinema2PerformanceParameters'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from './Cinema2AfterhoursPreset'
import { CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID } from '../effects/Cinema2HdrBloomEffect'
import { CINEMA2_VOLUMETRIC_ATMOSPHERE_EFFECT_TYPE_ID } from '../effects/Cinema2VolumetricAtmosphereEffect'
import { CINEMA2_SMOKE_VOLUME_TEXTURE_ASSET_ID } from '../assets/Cinema2TextureAssetManifest'

export const CINEMA2_BLOCKSHIFT_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.blockshift')
export const CINEMA2_BLOCKSHIFT_MODULE_ID = cinema2StableId<Cinema2ModuleId>('blockshift-sculpture')
const root = cinema2StableId<Cinema2SceneNodeId>('blockshift-root')
const sculpture = cinema2StableId<Cinema2SceneNodeId>('blockshift-sculpture-node')
const layer = cinema2StableId<Cinema2LayerId>('blockshift-world')
const camera = cinema2StableId<Cinema2CameraId>('blockshift-camera')
const target = cinema2StableId<Cinema2RenderTargetId>('blockshift-scene-target')
const pass = cinema2StableId<Cinema2RenderPassId>('blockshift-scene-pass')
const color = cinema2StableId<Cinema2RenderSlotId>('blockshift-scene-color')
const depth = cinema2StableId<Cinema2RenderSlotId>('blockshift-scene-depth')
const bloomEffect = cinema2StableId<Cinema2EffectId>('blockshift-bloom')
const bloomPass = cinema2StableId<Cinema2RenderPassId>('blockshift-bloom-pass')
const atmosphereEffect = cinema2StableId<Cinema2EffectId>('blockshift-atmosphere')
const atmospherePass = cinema2StableId<Cinema2RenderPassId>('blockshift-atmosphere-pass')
const atmosphereTarget = cinema2StableId<Cinema2RenderTargetId>('blockshift-atmosphere-target')
const atmosphereColor = cinema2StableId<Cinema2RenderSlotId>('blockshift-atmosphere-color')

const parameter = (suffix: string) => cinema2StableId<Cinema2ParameterId>(`blockshift-${suffix}`)
export const CINEMA2_BLOCKSHIFT_PARAMETER_IDS = {
  musicalCue: parameter('musical-cue'), bpmSync: parameter('bpm-sync'), masterIntensity: parameter('master-intensity'), autoPerformance: parameter('auto-performance'),
  motionAmount: parameter('motion-amount'), audioReactivity: parameter('audio-reactivity'), pattern: parameter('pattern'),
  patternChange: parameter('pattern-change'), trigger: parameter('trigger'), blockSize: parameter('block-size'),
  spread: parameter('spread'), depth: parameter('depth'), rotationRange: parameter('rotation-range'),
  cameraMotion: parameter('camera-motion'), cameraFloatAmount: parameter('camera-float-amount'), cameraFloatSpeed: parameter('camera-float-speed'), cameraFov: parameter('camera-fov'),
  orbitCamera: parameter('orbit-camera'), orbitIntensity: parameter('orbit-intensity'),
  rotateCubes: parameter('rotate-cubes'), atmosphere: parameter('atmosphere'),
  motionRate: parameter('motion-rate'), transitionLength: parameter('transition-length'), bloom: parameter('bloom'),
  primaryEdge: parameter('primary-edge'), secondaryEdge: parameter('secondary-edge'), impactAccent: parameter('impact-accent'),
  blockBody: parameter('block-body'), background: parameter('background'),
} as const
const ids = CINEMA2_BLOCKSHIFT_PARAMETER_IDS
const base = { section: 'Design', exposure: 'primary', persistence: 'preset', reset: 'authored-default', modulatable: false, choreographable: false, automatable: false } as const
const numeric = (id: Cinema2ParameterId, label: string, value: number, min: number, max: number, parent: 'master-controls' | 'design' | 'effects', order: number, group = 'Blocks'): Cinema2ParameterManifest => ({ ...base, id, label, type: 'float', defaultValue: value, min, max, step: 0.01, designParentGroup: parent, order, group })
const moduleValues = {
  bpmSync: true, masterIntensity: 1, autoPerformance: false, motionAmount: 0.55, audioReactivity: 0.8,
  pattern: 'stagger', patternChange: false, trigger: 'bar4', blockSize: 1.35, spread: 1, depth: 0.45,
  rotationRange: 16, motionRate: 1, rotateCubes: false, transitionLength: '1', ...CINEMA2_BLOCKSHIFT_PALETTE,
}
/** Native surrounding field with shared audio, Director, camera and restrained engine-owned bloom. Reference preview pending final acceptance. */
export const CINEMA2_BLOCKSHIFT_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = {
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID, schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_BLOCKSHIFT_PRESET_ID, revision: 17,
  metadata: { name: 'BLOCKSHIFT', description: 'Float inside a surrounding field of massive Hallow Cubes and a deeper Impossible Cube.', author: 'DVYDRM', tags: ['cinematic', 'prototype'] },
  capabilities: [
    { id: 'render.webgl2', requirement: 'required', purpose: 'Instanced supplied GLBs with self-emissive LED bar surfaces and shared-signal geometry choreography.' },
    { id: 'render.depth', requirement: 'required', purpose: 'Depth-tested authored model surfaces and frames.' },
    { id: 'scene.3d', requirement: 'required', purpose: 'Fifteen identity-stable world-space blocks.' },
    { id: 'camera.world', requirement: 'required', purpose: 'Engine-owned perspective camera and aspect framing.' },
    { id: 'render.hdr', requirement: 'optional', purpose: 'Preserves bright frame emission for shared HDR bloom, with the engine 8-bit fallback.' },
    ...(['visual-director.significance', 'audio.bands', 'audio.features', 'music.vocal-presence', 'music.build', 'music.section', 'audio.transport', 'music.beat', 'music.downbeat', 'music.rhythm-events', 'music.bar', 'music.phrase', 'music.drop'] as const).map(id => ({ id, requirement: 'optional' as const, purpose: 'Shared clock and canonical pattern-change events; static manual operation when unavailable.' })),
  ],
  parameters: ([
    { id: ids.musicalCue, label: 'Musical Cue', type: 'trigger', exposure: 'hidden', persistence: 'runtime-only', reset: 'none', section: 'React', group: 'Runtime', order: 999 },
    { ...CINEMA2_QUALITY_MODE_PARAMETER, defaultValue: 'quality', designParentGroup: 'master-controls' },
    { ...base, id: ids.bpmSync, label: 'BPM Sync', type: 'boolean', defaultValue: true, designParentGroup: 'master-controls', order: 1 },
    numeric(ids.masterIntensity, 'Master Intensity', 1, 0, 2, 'master-controls', 2),
    { ...base, id: ids.autoPerformance, label: 'Auto Performance', type: 'boolean', defaultValue: false, designParentGroup: 'master-controls', order: 3 },
    numeric(ids.motionAmount, 'Motion Amount', 0.55, 0, 1, 'master-controls', 4),
    numeric(ids.audioReactivity, 'Audio Reactivity', 0.8, 0, 1, 'master-controls', 5),
    { ...base, id: ids.pattern, label: 'Pattern', type: 'enum', defaultValue: 'stagger', options: CINEMA2_BLOCKSHIFT_PATTERN_IDS.map(value => ({ value, label: value[0]!.toUpperCase() + value.slice(1) })), designParentGroup: 'design', group: 'Pattern', order: 1 },
    { ...base, id: ids.patternChange, label: 'Pattern Change', type: 'boolean', defaultValue: false, designParentGroup: 'design', group: 'Pattern', order: 2 },
    { ...base, id: ids.trigger, label: 'Trigger', type: 'enum', defaultValue: 'bar4', options: CINEMA2_AFTERHOURS_TRIGGER_OPTIONS, visibleWhen: [{ kind: 'parameter-equals', parameterId: ids.patternChange, value: true }], designParentGroup: 'design', group: 'Pattern', order: 3 },
    numeric(ids.blockSize, 'Block Size', 1.35, 1.05, 6, 'design', 10),
    numeric(ids.spread, 'Spread', 1, 0.5, 3, 'design', 11),
    numeric(ids.depth, 'Depth', 0.45, 0, 1, 'design', 12),
    { ...numeric(ids.rotationRange, 'Rotation Range', 16, 0, 45, 'design', 13), unit: '°', step: 1 },
    numeric(ids.motionRate, 'Motion Rate', 1, 0.25, 2, 'design', 20, 'Motion'),
    { ...base, id: ids.transitionLength, label: 'Transition Length', type: 'enum', defaultValue: '1', options: ['0.5', '1', '2', '4'].map(value => ({ value, label: `${value} beats` })), designParentGroup: 'design', group: 'Motion', order: 21 },
    { ...base, id: ids.rotateCubes, label: 'Rotate Cubes', type: 'boolean', defaultValue: false, designParentGroup: 'design', group: 'Motion', order: 22, description: 'Adds varied cube rotations. Motion Amount and Motion Rate govern speed; off holds the added orientation.' },
    { ...base, id: ids.orbitCamera, label: 'Orbit Camera', type: 'boolean', defaultValue: false, designParentGroup: 'design', group: 'Motion', order: 23, visibleWhen: [{ kind: 'parameter-equals', parameterId: ids.cameraMotion, value: true }] },
    { ...numeric(ids.orbitIntensity, 'Orbit Intensity', 0.35, 0, 1, 'design', 24, 'Motion'), visibleWhen: [{ kind: 'parameter-equals', parameterId: ids.cameraMotion, value: true }, { kind: 'parameter-equals', parameterId: ids.orbitCamera, value: true }], description: 'Controls orbit speed. Zero holds the current heading while float continues.' },
    numeric(ids.bloom, 'Bloom', 0.3, 0, 1, 'effects', 1, 'Scene'),
    { ...base, id: ids.atmosphere, label: 'Atmosphere', type: 'boolean', defaultValue: true, designParentGroup: 'effects', group: 'Scene', order: 2, description: 'Depth-aware smoke and colored light shafts from the LED bars, using the shared Threshold atmosphere effect.' },
    { ...base, id: ids.cameraMotion, label: 'Camera Motion', type: 'boolean', defaultValue: true, designParentGroup: 'master-controls', order: 6 },
    { ...numeric(ids.cameraFloatAmount, 'Camera Motion Intensity', 0.6, 0, 1, 'master-controls', 7), group: undefined, visibleWhen: [{ kind: 'parameter-equals', parameterId: ids.cameraMotion, value: true }], description: 'Floating movement within the Master Motion Amount limit.' },
    { ...numeric(ids.cameraFloatSpeed, 'Float Speed', 0.7, 0.25, 2, 'effects', 12, 'Camera'), visibleWhen: [{ kind: 'parameter-equals', parameterId: ids.cameraMotion, value: true }] },
    { ...numeric(ids.cameraFov, 'Field of View', 85, 60, 100, 'effects', 13, 'Camera'), unit: '°', step: 1 },
    ...(['primaryEdge', 'secondaryEdge', 'impactAccent', 'blockBody', 'background'] as const).map((key, index): Cinema2ParameterManifest => ({
      ...base, id: ids[key], label: ['Primary Edge', 'Secondary Edge', 'Impact Accent', 'Block Body', 'Background'][index]!, type: 'color',
      defaultValue: CINEMA2_BLOCKSHIFT_PALETTE[key], designParentGroup: 'palette', order: index + 1,
    })),
  ] satisfies Cinema2ParameterManifest[]),
  modules: [{ id: CINEMA2_BLOCKSHIFT_MODULE_ID, typeId: CINEMA2_BLOCKSHIFT_NATIVE_MODULE_TYPE_ID, version: 1, config: { blockCount: CINEMA2_BLOCKSHIFT_BLOCK_COUNT },
    parameters: { ...moduleValues, ...CINEMA2_BLOCKSHIFT_AUDIO_DEFAULTS, ...CINEMA2_BLOCKSHIFT_DIRECTOR_DEFAULTS },
    actionBindings: { musicalCue: cinema2Ref(ids.musicalCue) },
    parameterBindings: Object.fromEntries(Object.keys(moduleValues).map(key => [key, cinema2Ref(ids[key as keyof typeof moduleValues])])),
  }],
  choreography: { rules: blockshiftAudioRules(CINEMA2_BLOCKSHIFT_MODULE_ID, ids.musicalCue) },
  scene: {
    nodes: [{ id: root, kind: 'group', coordinateSpace: 'world' }, { id: sculpture, kind: 'module', parent: cinema2Ref(root), module: cinema2Ref(CINEMA2_BLOCKSHIFT_MODULE_ID) }],
    roots: [cinema2Ref(root)],
  },
  layers: [{ id: layer, label: 'BLOCKSHIFT Sculpture', source: cinema2Ref(root), role: 'world', depthPolicy: 'read-write', order: 0 }],
  cameras: [{ id: camera, label: 'BLOCKSHIFT Inside the Field', projection: 'perspective', transform: { position: [0, 0, 0] }, target: [0, 0, -10], fovDegrees: 85, minAspect: 0.9, near: 0.2, far: 840, rig: { kind: 'static' },
    motion: { orbit: { angularSpeedDegreesPerSecond: 24 }, drift: { position: 0.6, target: 0.8, rollDegrees: 0.35, speed: 0.045, seed: 41 }, tempo: { referenceBpm: 120, minRate: 0.35, maxRate: 2.5 } },
    controls: { orbitMotionEnabled: cinema2Ref(ids.orbitCamera), orbitMotionSpeed: cinema2Ref(ids.orbitIntensity), motionEnabled: cinema2Ref(ids.cameraMotion), motionAmount: cinema2Ref(ids.cameraFloatAmount), motionSpeed: cinema2Ref(ids.cameraFloatSpeed), masterMotionAmount: cinema2Ref(ids.motionAmount), tempoSync: cinema2Ref(ids.bpmSync), fovDegrees: cinema2Ref(ids.cameraFov) },
    safety: { minPosition: [-0.65, -0.4, -0.65], maxPosition: [0.65, 0.4, 0.65], maxPositionOffset: [0.65, 0.4, 0.65], maxTargetOffset: [12, 2, 22], minFovDegrees: 60, maxFovDegrees: 100 }, smoothingMs: 160 }],
  environment: { backgroundColor: CINEMA2_BLOCKSHIFT_PALETTE.background, exposure: 1, controls: { backgroundColor: cinema2Ref(ids.background) } },
  effects: [{ id: atmosphereEffect, typeId: CINEMA2_VOLUMETRIC_ATMOSPHERE_EFFECT_TYPE_ID, version: 1, enabled: true, order: 0, scope: 'output',
    parameters: { mix: 1, density: 0.0045, beamIntensity: 0, ambientHaze: 0.25, hazeColor: [0.10, 0.13, 0.18, 1], mistAmount: 0.008, mistHeight: 20, mistFloor: -20,
      anisotropy: 0.3, occlusion: 0.2, noiseScale: 0.07, noiseStrength: 0.9, smokeTexture: CINEMA2_SMOKE_VOLUME_TEXTURE_ASSET_ID,
      smokeContrast: 1.6, smokeWarp: 0.6, smokeStrength: 1, drift: 0.04, maxDistance: 140, shafts: 0.28, shaftOriginX: 0.5, shaftOriginY: 0.5, shaftLength: 0.08, reactivity: 0 },
    parameterBindings: { enabled: cinema2Ref(ids.atmosphere), mix: cinema2Ref(ids.masterIntensity) },
  }, { id: bloomEffect, typeId: CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID, version: 1, enabled: true, order: 1, scope: 'output',
    parameters: { mix: 1, threshold: 0.18, knee: 0.12, intensity: 0.3, spread: 0.35, levels: 4, clampMax: 4 },
    parameterBindings: { intensity: cinema2Ref(ids.bloom) },
  }],
  render: {
    targets: [{ id: target, descriptor: { size: { kind: 'viewport' }, colorFormat: 'rgba16f', fallbackColorFormat: 'rgba8', depthFormat: 'depth24' }, ownership: 'transient' },
      { id: atmosphereTarget, descriptor: { size: { kind: 'viewport' }, colorFormat: 'rgba16f', fallbackColorFormat: 'rgba8' }, ownership: 'transient' }],
    passes: [{ id: pass, kind: 'scene', layers: [cinema2Ref(layer)], outputs: [
      { id: color, target: cinema2Ref(target), attachment: 'color' }, { id: depth, target: cinema2Ref(target), attachment: 'depth' },
    ] }, { id: atmospherePass, kind: 'fullscreen', dependsOn: [cinema2Ref(pass)], effect: cinema2Ref(atmosphereEffect), inputs: [
      { id: cinema2StableId<Cinema2RenderSlotId>('blockshift-atmosphere-input'), source: { pass: cinema2Ref(pass), output: color }, attachment: 'color' },
      { id: cinema2StableId<Cinema2RenderSlotId>('blockshift-atmosphere-depth'), source: { pass: cinema2Ref(pass), output: depth }, attachment: 'depth' },
    ], outputs: [{ id: atmosphereColor, target: cinema2Ref(atmosphereTarget), attachment: 'color' }] },
    { id: bloomPass, kind: 'fullscreen', dependsOn: [cinema2Ref(atmospherePass)], effect: cinema2Ref(bloomEffect), inputs: [
      { id: cinema2StableId<Cinema2RenderSlotId>('blockshift-bloom-input'), source: { pass: cinema2Ref(atmospherePass), output: atmosphereColor }, attachment: 'color' },
    ] }],
    outputPass: cinema2Ref(bloomPass),
  },
  defaults: { camera: cinema2Ref(camera) },
  output: { renderPass: cinema2Ref(bloomPass), colorSpace: 'srgb', alphaMode: 'opaque' },
}

import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID, CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  cinema2NamespacedId, cinema2Ref, cinema2StableId,
  type Cinema2CameraId, type Cinema2ChoreographyActionId, type Cinema2ChoreographyRuleId, type Cinema2EffectId, type Cinema2LayerId, type Cinema2LightId,
  type Cinema2ModuleId, type Cinema2ModuleTypeId, type Cinema2NativePresetManifest,
  type Cinema2ParameterId, type Cinema2ParameterManifest, type Cinema2PresetId,
  type Cinema2RenderPassId, type Cinema2RenderSlotId, type Cinema2RenderTargetId,
  type Cinema2SceneNodeId,
} from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID } from '../effects/Cinema2CinematicFinishEffect'
import { CINEMA2_STUDIO_NEUTRAL_ENVIRONMENT_ASSET_ID } from '../modules/three/Cinema2ThreeEnvironmentRegistry'
import { CINEMA2_QUALITY_MODE_PARAMETER } from '../parameters/Cinema2PerformanceParameters'
import { cinema2AutoTargets, withCinema2AutoPerformance } from './Cinema2AutoPerformanceAuthoring'

export const CINEMA2_OPEN_DECKS_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.open-decks')
export const openDecksParameterId = (name: string) => cinema2StableId<Cinema2ParameterId>(`open-decks-${name}`)
const moduleId = cinema2StableId<Cinema2ModuleId>('open-decks-scene')
const root = cinema2StableId<Cinema2SceneNodeId>('open-decks-root')
const lightTarget = cinema2StableId<Cinema2SceneNodeId>('open-decks-light-target')
const model = cinema2StableId<Cinema2SceneNodeId>('open-decks-model')
const layer = cinema2StableId<Cinema2LayerId>('open-decks-world')
const camera = cinema2StableId<Cinema2CameraId>('open-decks-camera')
const finish = cinema2StableId<Cinema2EffectId>('open-decks-finish')
const target = cinema2StableId<Cinema2RenderTargetId>('open-decks-scene-target')
const scenePass = cinema2StableId<Cinema2RenderPassId>('open-decks-scene-pass')
const finishPass = cinema2StableId<Cinema2RenderPassId>('open-decks-finish-pass')
const sceneColor = cinema2StableId<Cinema2RenderSlotId>('open-decks-scene-color')
const input = cinema2StableId<Cinema2RenderSlotId>('open-decks-finish-input')
const parameter = openDecksParameterId
const ref = (name: string) => cinema2Ref(parameter(name))
const base = { section: 'Design', exposure: 'primary', persistence: 'preset', reset: 'authored-default' } as const
function number(name: string, label: string, group: Cinema2ParameterManifest['designParentGroup'], value: number, min: number, max: number, order: number): Cinema2ParameterManifest {
  return { ...base, id: parameter(name), label, type: 'float', defaultValue: value, min, max, step: .01, designParentGroup: group, order }
}

/** A spot lighting the scene's centre; the flagged one casts shadows (medium and high quality only). */
function spot(name: string, position: readonly [number, number, number], intensity: number, color: readonly [number, number, number, number], coneAngleDegrees: number, shadow = false) {
  return {
    id: cinema2StableId<Cinema2LightId>(name), type: 'spot' as const, color, intensity, transform: { position },
    targetNode: cinema2Ref(lightTarget),
    config: { coneAngleDegrees, penumbra: .72, range: 24, ...(shadow ? { threeShadow: true } : {}) },
  }
}

/** Preview-only preset: the CDJ as a stepped 3D model textured with the supplied reference photograph, for framing and visual review. No invented musical behavior or material replacement. */
const CINEMA2_OPEN_DECKS_AUTHORED_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = {
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID, schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  // Revision 4. A saved parameter state only restores when its revision matches, so a workspace that saved an earlier framing (revision 1 opened at an
  // 18-24 degree heading; revision 2 at 3.3 distance; revision 3 at 2.9) restores these defaults instead: head on, 3.18 from the model, which fills
  // most of the width and lets the bottom of the device run just past the bottom of the Stage.
  id: CINEMA2_OPEN_DECKS_PRESET_ID, revision: 4,
  metadata: {
    name: 'Open Decks',
    description: 'A 3D model of the Open Decks CDJ, textured with the reference photograph: the raised screen housing with its glass set back, the hot-cue pads, rotary and knobs are real volumes, so they have depth when the camera orbits. Preview only, for framing and visual review.',
    author: 'DRMVYZ',
    tags: ['3d', 'cdj', 'dj', 'review'],
  },
  capabilities: [
    { id: 'render.webgl2', requirement: 'required', purpose: 'Render the textured CDJ model.' },
    { id: 'render.depth', requirement: 'required', purpose: 'Resolve the stacked parts of the model and the glass set back in its housing.' },
    { id: 'scene.3d', requirement: 'required', purpose: 'Place the model in a world-space scene.' },
    { id: 'camera.world', requirement: 'required', purpose: 'Frame and inspect the model using an adjustable static orbit camera.' },
    { id: 'lighting', requirement: 'required', purpose: 'Light the model so its raised parts, edges and shadows read as depth.' },
  ],
  parameters: [
    number('exposure', 'Exposure', 'master-controls', 1, .1, 3, 0),
    number('distance', 'Camera Distance', 'design', 3.18, 1.6, 6, 10),
    number('heading', 'Camera Heading', 'design', 0, -60, 60, 11),
    number('elevation', 'Camera Elevation', 'design', 0, -30, 30, 12),
    number('contrast', 'Contrast', 'effects', 1, .5, 1.5, 20),
    number('saturation', 'Saturation', 'effects', 1, 0, 2, 21),
    number('temperature', 'Color Temperature', 'palette', 0, -1, 1, 30),
    number('tint', 'Color Tint', 'palette', 0, -1, 1, 31),
    CINEMA2_QUALITY_MODE_PARAMETER,
  ],
  modules: [{
    id: moduleId, typeId: cinema2StableId<Cinema2ModuleTypeId>('three-scene'), version: 1, enabled: true,
    config: {
      instances: [{ asset: 'cinema2-open-decks', node: model }],
      // The raised parts shadow the plate and glass beneath them, and the device shadows the wall behind it, which is what lifts it off its background.
      shadows: { cast: ['cdj'], receive: ['cdj', 'screen', 'backdrop'] },
      environment: CINEMA2_STUDIO_NEUTRAL_ENVIRONMENT_ASSET_ID,
    },
  }],
  scene: { nodes: [
    { id: root, kind: 'group', coordinateSpace: 'world' },
    // The model is 2.5 wide and about 1.7 tall, centred in x and y, its back plane at z = 0 and the screen housing front 0.17 above it; the wall hangs 0.15 behind.
    { id: model, kind: 'module', parent: cinema2Ref(root), module: cinema2Ref(moduleId), transform: { scale: [1, 1, 1], position: [0, 0, -.04] } },
    { id: lightTarget, kind: 'group', parent: cinema2Ref(root), transform: { position: [0, -.05, 0] } },
  ], roots: [cinema2Ref(root)] },
  layers: [{ id: layer, label: 'Open Decks', source: cinema2Ref(root), role: 'world', depthPolicy: 'read-write', order: 0 }],
  cameras: [{
    // Composed for a Stage a little wider than square (the Stage this preview is judged in): the model fills most of the width, and the camera looks above
    // its centre so the model's bottom edge sits just below the bottom of the frame. Wider Stages keep that bottom edge (the vertical view holds); minAspectAnchor 1
    // pins it on narrower ones (the extra view goes above the device).
    id: camera, label: 'Scene Review', projection: 'perspective', fovDegrees: 40, minAspect: 1.15, minAspectAnchor: 1,
    near: .05, far: 100, target: [0, .335, 0],
    rig: { kind: 'orbit', radius: 3.18, azimuthDegrees: 0, elevationDegrees: 0, angularVelocityDegreesPerSecond: 0 },
    controls: { orbitRadius: ref('distance'), orbitAzimuthDegrees: ref('heading'), orbitElevationDegrees: ref('elevation') },
  }],
  environment: { backgroundColor: [.016, .02, .028, 1] },
  lighting: { lights: [
    // MAINFRAME's rig, brought in to this scene's size: a key from above left that casts the device's shadow across the wall, a cool rim from the right and a low fill.
    spot('open-decks-key', [-3.6, 3.4, 5.2], .7, [.97, .96, .92, 1], 40, true),
    spot('open-decks-rim', [4.4, 1.6, 4.4], .16, [.72, .84, 1, 1], 46),
    spot('open-decks-fill', [-.8, -3.4, 4.6], .07, [.86, .88, .9, 1], 56),
  ] },

  effects: [{
    id: finish, typeId: CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID, version: 1, enabled: true, order: 0, scope: 'output',
    // Neutral grade: keep the artwork's own colours for the initial review.
    parameters: { mix: 1, toneMap: 0, exposure: 1, contrast: 1, saturation: 1, temperature: 0, tint: 0, vignette: .3, grain: 0, aberration: 0 },
    parameterBindings: { exposure: ref('exposure'), contrast: ref('contrast'), saturation: ref('saturation'), temperature: ref('temperature'), tint: ref('tint') },
  }],
  render: {
    targets: [{ id: target, descriptor: { size: { kind: 'viewport' }, colorFormat: 'rgba8', depthFormat: 'depth24' }, ownership: 'transient' }],
    passes: [
      { id: scenePass, kind: 'scene', layers: [cinema2Ref(layer)], outputs: [{ id: sceneColor, target: cinema2Ref(target), attachment: 'color' }, { id: cinema2StableId<Cinema2RenderSlotId>('open-decks-scene-depth'), target: cinema2Ref(target), attachment: 'depth' }] },
      { id: finishPass, kind: 'fullscreen', effect: cinema2Ref(finish), dependsOn: [cinema2Ref(scenePass)], inputs: [{ id: input, source: { pass: cinema2Ref(scenePass), output: sceneColor }, attachment: 'color' }] },
    ], outputPass: cinema2Ref(finishPass),
  },
  defaults: { camera: cinema2Ref(camera) },
  output: { renderPass: cinema2Ref(finishPass), colorSpace: 'srgb', alphaMode: 'opaque' },
}

/**
 * Auto Performance (off by default). The scene is a static preview with no reactions of its own, so with it on the music directs only the camera's
 * slight sway left and right (below) and the exposure: a lift on the last downbeats before a drop and a flash on each drop. The camera never zooms.
 * The scene, its materials and your framing, exposure and colour controls are never changed.
 */
const CINEMA2_OPEN_DECKS_AUTO_MANIFEST = withCinema2AutoPerformance(CINEMA2_OPEN_DECKS_AUTHORED_PRESET_MANIFEST, {
  prefix: 'open-decks',
  group: 'Master',
  order: 1,
  description: 'Lets the music direct the camera and exposure: the camera sways slightly left and right with the music (it never zooms), the exposure lifts on the last downbeats before a drop, and flashes on each drop.',
  capabilities: [
    { id: 'music.downbeat', purpose: 'Downbeats before a drop drive the exposure lift, and the bars of a phrase drive the camera sway, when Auto Performance is on.' },
    { id: 'music.drop', purpose: 'Each drop flashes the exposure when Auto Performance is on.' },
  ],
  gestures: {
    // The camera never zooms: no push-in, no change of distance or lens. The only camera movement is the slight sway below.
    peak: [{ id: 'exposure', target: cinema2AutoTargets.effect('open-decks-finish', 'exposure'), operation: 'envelope', value: 0.12, hold: 0.1, release: 0.8 }],
    drop: [{ id: 'exposure', target: cinema2AutoTargets.effect('open-decks-finish', 'exposure'), operation: 'envelope', value: 0.35, hold: 0.1, release: 2 }],
  },
})

/**
 * The sway: with Auto Performance on the camera moves slightly left, then right, in time with the music. Every fourth bar starts a swing of four
 * degrees of heading (one bar out, one bar back), to the left on bars 1 and 5 of the phrase and to the right on bars 3 and 7. The camera orbits its
 * target, so the distance, the lens and the framing of the bottom edge are untouched.
 */
const swayTarget = cinema2AutoTargets.camera('open-decks-camera', 'control.orbitAzimuthDegrees')
const swayRule = (name: string, phase: number, degrees: number) => Object.freeze({
  id: cinema2StableId<Cinema2ChoreographyRuleId>(`open-decks-auto-sway-${name}`),
  priority: 62,
  enabledParameter: cinema2Ref(parameter('auto-performance')),
  source: Object.freeze({ signal: 'downbeat' as const, capability: 'music.downbeat' as const }),
  conditions: Object.freeze([{ kind: 'once-per-event' as const }, { kind: 'not-silent' as const }, { kind: 'beat-interval' as const, every: 2, phase, unit: 'bar' as const }]),
  actions: Object.freeze([Object.freeze({
    id: cinema2StableId<Cinema2ChoreographyActionId>(`open-decks-auto-sway-${name}-heading`), target: swayTarget, operation: 'envelope' as const, value: degrees,
    composition: 'add' as const, envelope: Object.freeze({ attack: 4, hold: 0, release: 4, unit: 'beats' as const }),
  })]),
})
export const CINEMA2_OPEN_DECKS_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = Object.freeze({
  ...CINEMA2_OPEN_DECKS_AUTO_MANIFEST,
  choreography: Object.freeze({ ...(CINEMA2_OPEN_DECKS_AUTO_MANIFEST.choreography ?? {}), rules: Object.freeze([...(CINEMA2_OPEN_DECKS_AUTO_MANIFEST.choreography?.rules ?? []), swayRule('left', 0, -4), swayRule('right', 1, 4)]) }),
})

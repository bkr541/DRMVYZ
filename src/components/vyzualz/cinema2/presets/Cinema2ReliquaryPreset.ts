import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  cinema2NamespacedId,
  cinema2Ref,
  cinema2StableId,
  type Cinema2CameraId,
  type Cinema2ChoreographyRuleManifest,
  type Cinema2Color,
  type Cinema2LayerId,
  type Cinema2LightGroupId,
  type Cinema2LightId,
  type Cinema2ModuleId,
  type Cinema2ModuleTypeId,
  type Cinema2NativePresetManifest,
  type Cinema2ParameterId,
  type Cinema2PresetId,
  type Cinema2RenderPassId,
  type Cinema2RenderSlotId,
  type Cinema2RenderTargetId,
  type Cinema2SceneNodeId,
  type Cinema2Vector3,
} from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_DVYDRM_LOGO_ASSET_ID, CINEMA2_GOLDEN_ROOTS_ASSET_ID } from '../modules/three/Cinema2ThreeAssetManifest'
import { CINEMA2_STUDIO_NEUTRAL_ENVIRONMENT_ASSET_ID } from '../modules/three/Cinema2ThreeEnvironmentRegistry'
import { CINEMA2_QUALITY_MODE_PARAMETER } from '../parameters/Cinema2PerformanceParameters'
import { cinema2LightRigAlternate } from './Cinema2LightRigAuthoring'

/**
 * RELIQUARY: the DVYDRM logo (rendered as one uniform silver crystal, no gold ring - the shared logo asset's `outline` part is tinted and
 * roughened to match its `crystal` part) held by a golden tree rising from open ground: a thick trunk of four twisting strands rises from a
 * wide flare of roots, splits just under the star into two limbs that pass in front of the logo's lower rim, wrap round the outside of its
 * lower outer lobes and curl over their tops, with thin vines looping round the lobes and gold teardrop leaves on curling stems. Nothing
 * reaches past the logo's sides (revision 3 of the `golden-roots` asset; revision 2's canopy branches that climbed out to the sides like
 * wings are gone). The asset also carries a gnarled bark surface and glowing "vein" strands; there is no dais (open ground).
 *
 * This revision is geometry and a minimal light rig only, by design: no haze, bloom, floor reflection or cinematic finish, and no
 * camera motion. The three lights (each aimed at a different part of the composition) alternate on the beat when BPM Sync is on, which is
 * enough to genuinely consume Master Intensity and BPM Sync without building the fuller, audio-synced per-facet choreography yet.
 */
export const CINEMA2_RELIQUARY_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.reliquary')
export const CINEMA2_RELIQUARY_MODULE_ID = cinema2StableId<Cinema2ModuleId>('reliquary-scene')
export const CINEMA2_RELIQUARY_LOGO_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('reliquary-logo-node')
export const CINEMA2_RELIQUARY_ROOTS_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('reliquary-roots-node')
export const CINEMA2_RELIQUARY_CAMERA_ID = cinema2StableId<Cinema2CameraId>('reliquary-camera')

export const CINEMA2_RELIQUARY_MASTER_INTENSITY_ID = cinema2StableId<Cinema2ParameterId>('reliquary-master-intensity')
export const CINEMA2_RELIQUARY_BPM_SYNC_ID = cinema2StableId<Cinema2ParameterId>('reliquary-bpm-sync')
export const CINEMA2_RELIQUARY_CRYSTAL_ROUGHNESS_ID = cinema2StableId<Cinema2ParameterId>('reliquary-crystal-roughness')
export const CINEMA2_RELIQUARY_ROOT_ROUGHNESS_ID = cinema2StableId<Cinema2ParameterId>('reliquary-root-roughness')
export const CINEMA2_RELIQUARY_REFLECTION_ID = cinema2StableId<Cinema2ParameterId>('reliquary-environment-reflection')
export const CINEMA2_RELIQUARY_BACKGROUND_ID = cinema2StableId<Cinema2ParameterId>('reliquary-background')
export const CINEMA2_RELIQUARY_CRYSTAL_TINT_ID = cinema2StableId<Cinema2ParameterId>('reliquary-crystal-tint')
export const CINEMA2_RELIQUARY_ROOT_TINT_ID = cinema2StableId<Cinema2ParameterId>('reliquary-root-tint')
export const CINEMA2_RELIQUARY_LEAF_TINT_ID = cinema2StableId<Cinema2ParameterId>('reliquary-leaf-tint')
export const CINEMA2_RELIQUARY_KEY_COLOR_ID = cinema2StableId<Cinema2ParameterId>('reliquary-key-light')
export const CINEMA2_RELIQUARY_RIM_COLOR_ID = cinema2StableId<Cinema2ParameterId>('reliquary-rim-light')
export const CINEMA2_RELIQUARY_ACCENT_COLOR_ID = cinema2StableId<Cinema2ParameterId>('reliquary-accent-light')

export const CINEMA2_RELIQUARY_KEY_LIGHT_ID = cinema2StableId<Cinema2LightId>('reliquary-key-spot')
export const CINEMA2_RELIQUARY_RIM_LIGHT_ID = cinema2StableId<Cinema2LightId>('reliquary-rim-spot')
export const CINEMA2_RELIQUARY_ACCENT_LIGHT_ID = cinema2StableId<Cinema2LightId>('reliquary-accent-spot')
const AMBIENT_LIGHT_ID = cinema2StableId<Cinema2LightId>('reliquary-ambient')
const KEY_GROUP_ID = cinema2StableId<Cinema2LightGroupId>('reliquary-key')
const SIDES_GROUP_ID = cinema2StableId<Cinema2LightGroupId>('reliquary-sides')

const ROOT_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('reliquary-root')
const WORLD_LAYER_ID = cinema2StableId<Cinema2LayerId>('reliquary-world-layer')
const THREE_SCENE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('three-scene')

/** The golden-roots asset's trunk starts at this floor Y (see `scripts/cinema2-assets/generate-golden-roots.mjs`); the logo floats above it. */
const LOGO_HEIGHT = 0.05

const vec3 = (x: number, y: number, z: number): Cinema2Vector3 => Object.freeze([x, y, z])
const color = (r: number, g: number, b: number, a = 1): Cinema2Color => Object.freeze([r, g, b, a])

const DEFAULT_BACKGROUND = color(0.004, 0.004, 0.006)
const DEFAULT_KEY = color(1, 0.94, 0.82)
const DEFAULT_RIM = color(0.92, 0.95, 1)
const DEFAULT_ACCENT = color(1, 0.86, 0.55)
const CRYSTAL_ROUGHNESS = 0.05
const ROOT_ROUGHNESS = 0.22
const RIG_BASE_INTENSITY = 1.1
const RIG_PEAK_INTENSITY = 2.8

const baseParameter = {
  section: 'Design',
  exposure: 'primary' as const,
  modulatable: false,
  choreographable: false,
  automatable: false,
  persistence: 'preset' as const,
  reset: 'authored-default' as const,
}

function floatParameter(
  id: Cinema2ParameterId, label: string, description: string, defaultValue: number, min: number, max: number, step: number,
  parent: 'master-controls' | 'design' | 'effects', order: number, group?: string,
) {
  return Object.freeze({ ...baseParameter, id, label, description, type: 'float' as const, defaultValue, min, max, step, designParentGroup: parent, order, ...(group ? { group } : {}) })
}

function colorParameter(id: Cinema2ParameterId, label: string, description: string, defaultValue: Cinema2Color, order: number, group: string) {
  return Object.freeze({ ...baseParameter, id, label, description, type: 'color' as const, defaultValue, designParentGroup: 'palette' as const, order, group })
}

const PARAMETERS = Object.freeze([
  CINEMA2_QUALITY_MODE_PARAMETER,
  Object.freeze({
    ...baseParameter,
    id: CINEMA2_RELIQUARY_MASTER_INTENSITY_ID,
    label: 'Master Intensity',
    description: 'One control for how strongly the light rig reacts to the music: the three spots trading the stage on the beat. At 0 the lighting stays at its resting level; at 1 it reacts fully.',
    type: 'float' as const,
    defaultValue: 0.75,
    min: 0,
    max: 1,
    step: 0.01,
    designParentGroup: 'master-controls' as const,
    order: 1,
  }),
  Object.freeze({
    ...baseParameter,
    id: CINEMA2_RELIQUARY_BPM_SYNC_ID,
    label: 'BPM Sync',
    description: 'On: the light rig trades between the key, rim and accent spots on the track\'s beat grid. Off: the lights hold their resting level.',
    type: 'boolean' as const,
    defaultValue: true,
    designParentGroup: 'master-controls' as const,
    order: 2,
  }),
  floatParameter(CINEMA2_RELIQUARY_CRYSTAL_ROUGHNESS_ID, 'Crystal Roughness', 'How sharp the reflections on the logo\'s crystal facets are (the outline and the body share this: the logo reads as one uniform crystal, no gold ring).', CRYSTAL_ROUGHNESS, 0, 1, 0.01, 'design', 1, 'Material'),
  floatParameter(CINEMA2_RELIQUARY_ROOT_ROUGHNESS_ID, 'Root Roughness', 'How sharp the reflections on the golden roots and branches are; the leaves keep their own softer, slightly more luminous finish.', ROOT_ROUGHNESS, 0, 1, 0.01, 'design', 2, 'Material'),
  floatParameter(CINEMA2_RELIQUARY_REFLECTION_ID, 'Environment Reflection', 'How strongly the studio environment reflects in the crystal and the gold.', 1, 0, 2, 0.01, 'design', 3, 'Material'),
  colorParameter(CINEMA2_RELIQUARY_BACKGROUND_ID, 'Background', 'The stage color behind the reliquary.', DEFAULT_BACKGROUND, 1, 'Stage Colors'),
  colorParameter(CINEMA2_RELIQUARY_CRYSTAL_TINT_ID, 'Crystal Color', 'Tints the logo\'s crystal (both the outline and the body). White leaves the production near-white crystal.', color(1, 1, 1), 2, 'Logo Colors'),
  colorParameter(CINEMA2_RELIQUARY_ROOT_TINT_ID, 'Root Gold', 'Tints the roots and branches. White leaves the production gold.', color(1, 1, 1), 3, 'Root Colors'),
  colorParameter(CINEMA2_RELIQUARY_LEAF_TINT_ID, 'Leaf Gold', 'Tints the leaves and tendrils. White leaves the production leaf gold.', color(1, 1, 1), 4, 'Root Colors'),
  colorParameter(CINEMA2_RELIQUARY_KEY_COLOR_ID, 'Key Light', 'The color of the main overhead spot, aimed at the logo.', DEFAULT_KEY, 5, 'Light Colors'),
  colorParameter(CINEMA2_RELIQUARY_RIM_COLOR_ID, 'Rim Light', 'The color of the overhead-back spot that edges the logo.', DEFAULT_RIM, 6, 'Light Colors'),
  colorParameter(CINEMA2_RELIQUARY_ACCENT_COLOR_ID, 'Accent Light', 'The color of the overhead spot aimed down at the roots.', DEFAULT_ACCENT, 7, 'Light Colors'),
])

function spotLight(id: Cinema2LightId, lightColor: Cinema2Color, position: Cinema2Vector3, colorParameterId: Cinema2ParameterId, cone: number, targetNode: Cinema2SceneNodeId) {
  return Object.freeze({
    id,
    type: 'spot' as const,
    color: lightColor,
    intensity: RIG_BASE_INTENSITY,
    transform: Object.freeze({ position }),
    node: cinema2Ref(ROOT_NODE_ID),
    targetNode: cinema2Ref(targetNode),
    controls: Object.freeze({ color: cinema2Ref(colorParameterId) }),
    config: Object.freeze({ coneAngleDegrees: cone, penumbra: 0.5, range: 26 }),
  })
}

const SCENE_TARGET_ID = cinema2StableId<Cinema2RenderTargetId>('reliquary-scene-target')
const SCENE_PASS_ID = cinema2StableId<Cinema2RenderPassId>('reliquary-scene-pass')
const SCENE_COLOR_ID = cinema2StableId<Cinema2RenderSlotId>('reliquary-scene-color')
const SCENE_DEPTH_ID = cinema2StableId<Cinema2RenderSlotId>('reliquary-scene-depth')

const master = cinema2Ref(CINEMA2_RELIQUARY_MASTER_INTENSITY_ID)
const bpmSync = cinema2Ref(CINEMA2_RELIQUARY_BPM_SYNC_ID)

/** The beat alternation, gated so it only runs while BPM Sync is on (resting at the rig's base intensity otherwise) - the only choreography
 * this first revision needs, but enough to genuinely consume both Master Intensity and BPM Sync per the shared control contract. */
const choreographyRules: readonly Cinema2ChoreographyRuleManifest[] = cinema2LightRigAlternate({
  id: 'reliquary-rig', groups: [KEY_GROUP_ID, SIDES_GROUP_ID], everyBeats: 2, peak: RIG_PEAK_INTENSITY, priority: 40, strengthParameter: master,
}).map(rule => Object.freeze({ ...rule, enabledParameter: bpmSync }))

export const CINEMA2_RELIQUARY_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = Object.freeze({
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_RELIQUARY_PRESET_ID,
  revision: 1,
  metadata: Object.freeze({
    name: 'RELIQUARY',
    description: 'The DVYDRM logo, one uniform silver crystal, held by a golden root and branch structure that rises from open ground, wraps its lower lobes, and curls round its lower lobes, with gold leaves on curling stems. Three overhead spots light the logo and the roots.',
    tags: Object.freeze(['reliquary', 'logo', 'native', '3d', 'crystal', 'gold', 'three', 'keeper']),
  }),
  capabilities: Object.freeze([
    Object.freeze({ id: 'render.webgl2' as const, requirement: 'required' as const, purpose: 'Native Cinema 2.0 Stage rendering and the 3D scene.' }),
    Object.freeze({ id: 'render.depth' as const, requirement: 'required' as const, purpose: 'Depth-tested logo and roots.' }),
    Object.freeze({ id: 'scene.3d' as const, requirement: 'required' as const, purpose: 'The logo and the roots are real 3D models placed in the Scene Graph.' }),
    Object.freeze({ id: 'camera.world' as const, requirement: 'required' as const, purpose: 'Shared world camera framing the whole composition.' }),
    Object.freeze({ id: 'lighting' as const, requirement: 'required' as const, purpose: 'Three overhead spot lights, each aimed at a different part of the composition.' }),
    Object.freeze({ id: 'music.beat' as const, requirement: 'optional' as const, purpose: 'The key and side lights trade the stage on the beat when BPM Sync is on.' }),
  ]),
  parameters: PARAMETERS,
  modules: Object.freeze([Object.freeze({
    id: CINEMA2_RELIQUARY_MODULE_ID,
    typeId: THREE_SCENE_TYPE_ID,
    version: 1,
    enabled: true,
    parameters: Object.freeze({
      // The logo's outline is tinted and roughened to match its crystal body (no gold ring): both read the same two controls.
      'outline.color': color(1, 1, 1),
      'outline.roughness': CRYSTAL_ROUGHNESS,
      'crystal.color': color(1, 1, 1),
      'crystal.roughness': CRYSTAL_ROUGHNESS,
      'roots.color': color(1, 1, 1),
      'roots.roughness': ROOT_ROUGHNESS,
      'leaves.color': color(1, 1, 1),
      environmentIntensity: 1,
    }),
    parameterBindings: Object.freeze({
      'outline.color': cinema2Ref(CINEMA2_RELIQUARY_CRYSTAL_TINT_ID),
      'outline.roughness': cinema2Ref(CINEMA2_RELIQUARY_CRYSTAL_ROUGHNESS_ID),
      'crystal.color': cinema2Ref(CINEMA2_RELIQUARY_CRYSTAL_TINT_ID),
      'crystal.roughness': cinema2Ref(CINEMA2_RELIQUARY_CRYSTAL_ROUGHNESS_ID),
      'roots.color': cinema2Ref(CINEMA2_RELIQUARY_ROOT_TINT_ID),
      'roots.roughness': cinema2Ref(CINEMA2_RELIQUARY_ROOT_ROUGHNESS_ID),
      'leaves.color': cinema2Ref(CINEMA2_RELIQUARY_LEAF_TINT_ID),
      environmentIntensity: cinema2Ref(CINEMA2_RELIQUARY_REFLECTION_ID),
    }),
    config: Object.freeze({
      instances: Object.freeze([
        Object.freeze({ asset: CINEMA2_DVYDRM_LOGO_ASSET_ID, node: CINEMA2_RELIQUARY_LOGO_NODE_ID }),
        Object.freeze({ asset: CINEMA2_GOLDEN_ROOTS_ASSET_ID, node: CINEMA2_RELIQUARY_ROOTS_NODE_ID }),
      ]),
      parts: Object.freeze(['outline', 'crystal', 'roots', 'leaves']),
      environment: CINEMA2_STUDIO_NEUTRAL_ENVIRONMENT_ASSET_ID,
      // Three panels so the facets and the braided gold both catch clean bands of light, without relying on the (deferred) haze/bloom passes.
      panels: Object.freeze([
        Object.freeze({ position: vec3(-3.6, 3.6, 3.4), target: vec3(0, -0.2, 0), size: Object.freeze([3, 2.2]), color: Object.freeze([0.92, 0.95, 1]), intensity: 6 }),
        Object.freeze({ position: vec3(3.8, 2.2, -2.6), target: vec3(0, -0.2, 0), size: Object.freeze([2.6, 2.2]), color: Object.freeze([1, 0.92, 0.78]), intensity: 5 }),
      ]),
    }),
  })]),
  scene: Object.freeze({
    nodes: Object.freeze([
      Object.freeze({ id: ROOT_NODE_ID, kind: 'group' as const, coordinateSpace: 'world' as const }),
      Object.freeze({
        id: CINEMA2_RELIQUARY_LOGO_NODE_ID,
        kind: 'module' as const,
        parent: cinema2Ref(ROOT_NODE_ID),
        module: cinema2Ref(CINEMA2_RELIQUARY_MODULE_ID),
        transform: Object.freeze({ position: vec3(0, LOGO_HEIGHT, 0) }),
      }),
      Object.freeze({
        id: CINEMA2_RELIQUARY_ROOTS_NODE_ID,
        kind: 'module' as const,
        parent: cinema2Ref(ROOT_NODE_ID),
        module: cinema2Ref(CINEMA2_RELIQUARY_MODULE_ID),
      }),
    ]),
    roots: Object.freeze([cinema2Ref(ROOT_NODE_ID)]),
  }),
  layers: Object.freeze([Object.freeze({
    id: WORLD_LAYER_ID,
    label: 'RELIQUARY World',
    source: cinema2Ref(ROOT_NODE_ID),
    role: 'world' as const,
    depthPolicy: 'read-write' as const,
    order: 0,
  })]),
  cameras: Object.freeze([Object.freeze({
    id: CINEMA2_RELIQUARY_CAMERA_ID,
    label: 'RELIQUARY Front',
    projection: 'perspective' as const,
    fovDegrees: 34,
    near: 0.1,
    far: 60,
    // Framed for revision 2's canopy branches (3.5 units above the floor, 3.3 either side). The revision 3 tree is only about as wide as the
    // logo, so this now leaves it small in frame; the owner kept framing out of the root-shape pass (2026-09-27).
    transform: Object.freeze({ position: vec3(0, 0.9, 10.6) }),
    target: vec3(0, -0.1, 0),
    rig: Object.freeze({ kind: 'static' as const }),
  })]),
  defaults: Object.freeze({ camera: cinema2Ref(CINEMA2_RELIQUARY_CAMERA_ID) }),
  lighting: Object.freeze({
    groups: Object.freeze([
      Object.freeze({ id: KEY_GROUP_ID, label: 'Key', lights: Object.freeze([cinema2Ref(CINEMA2_RELIQUARY_KEY_LIGHT_ID)]) }),
      Object.freeze({ id: SIDES_GROUP_ID, label: 'Sides', lights: Object.freeze([cinema2Ref(CINEMA2_RELIQUARY_RIM_LIGHT_ID), cinema2Ref(CINEMA2_RELIQUARY_ACCENT_LIGHT_ID)]) }),
    ]),
    lights: Object.freeze([
      // Key: high overhead-front, on the logo. Rim: overhead-back, edging the logo. Accent: overhead-left and lower, on the roots - three
      // different positions lighting three different parts of the composition, per the brief, ahead of the fuller per-facet choreography.
      spotLight(CINEMA2_RELIQUARY_KEY_LIGHT_ID, DEFAULT_KEY, vec3(-2.2, 3.8, 3.8), CINEMA2_RELIQUARY_KEY_COLOR_ID, 17, CINEMA2_RELIQUARY_LOGO_NODE_ID),
      spotLight(CINEMA2_RELIQUARY_RIM_LIGHT_ID, DEFAULT_RIM, vec3(3.6, 3.6, -2.6), CINEMA2_RELIQUARY_RIM_COLOR_ID, 15, CINEMA2_RELIQUARY_LOGO_NODE_ID),
      spotLight(CINEMA2_RELIQUARY_ACCENT_LIGHT_ID, DEFAULT_ACCENT, vec3(-3.6, 2.6, -0.6), CINEMA2_RELIQUARY_ACCENT_COLOR_ID, 20, CINEMA2_RELIQUARY_ROOTS_NODE_ID),
      Object.freeze({ id: AMBIENT_LIGHT_ID, type: 'ambient' as const, color: color(0.2, 0.2, 0.24), intensity: 0.28 }),
    ]),
  }),
  environment: Object.freeze({
    backgroundColor: DEFAULT_BACKGROUND,
    exposure: 1,
    controls: Object.freeze({ backgroundColor: cinema2Ref(CINEMA2_RELIQUARY_BACKGROUND_ID) }),
  }),
  choreography: Object.freeze({ rules: Object.freeze(choreographyRules) }),
  // No haze, bloom, floor reflection or cinematic finish yet (deferred with the rest of the Design-tab effects work): one scene pass,
  // depth-enabled so the three-scene module can draw, presented directly - the render graph compiler auto-detects the single pass as output.
  render: Object.freeze({
    targets: Object.freeze([Object.freeze({
      id: SCENE_TARGET_ID,
      descriptor: Object.freeze({ size: Object.freeze({ kind: 'viewport' as const }), colorFormat: 'rgba8' as const, depthFormat: 'depth24' as const }),
      ownership: 'transient' as const,
    })]),
    passes: Object.freeze([Object.freeze({
      id: SCENE_PASS_ID,
      kind: 'scene' as const,
      layers: Object.freeze([cinema2Ref(WORLD_LAYER_ID)]),
      outputs: Object.freeze([
        Object.freeze({ id: SCENE_COLOR_ID, target: cinema2Ref(SCENE_TARGET_ID), attachment: 'color' as const }),
        Object.freeze({ id: SCENE_DEPTH_ID, target: cinema2Ref(SCENE_TARGET_ID), attachment: 'depth' as const }),
      ]),
    })]),
  }),
}) as Readonly<Cinema2NativePresetManifest>

import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  cinema2NamespacedId,
  cinema2Ref,
  cinema2StableId,
  type Cinema2CameraId,
  type Cinema2Color,
  type Cinema2EffectId,
  type Cinema2EffectTypeId,
  type Cinema2LayerId,
  type Cinema2LightId,
  type Cinema2ModuleId,
  type Cinema2ModuleManifest,
  type Cinema2ModuleTypeId,
  type Cinema2NativePresetManifest,
  type Cinema2PresetId,
  type Cinema2RenderPassId,
  type Cinema2RenderSlotId,
  type Cinema2RenderTargetId,
  type Cinema2SceneNodeId,
  type Cinema2SceneNodeManifest,
  type Cinema2Vector3,
} from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_QUALITY_MODE_PARAMETER } from '../parameters/Cinema2PerformanceParameters'

export const CINEMA2_MONOLITH_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.monolith')

const OBJECT3D_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('object3d')
const BLOOM_EFFECT_TYPE_ID = cinema2StableId<Cinema2EffectTypeId>('bloom')

const WORLD_ROOT_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('monolith-world-root')
const FOCUS_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('monolith-focus')
const CAMERA_ID = cinema2StableId<Cinema2CameraId>('monolith-static-camera')
const WORLD_LAYER_ID = cinema2StableId<Cinema2LayerId>('monolith-world-layer')
const SCENE_TARGET_ID = cinema2StableId<Cinema2RenderTargetId>('monolith-scene-target')
const SCENE_PASS_ID = cinema2StableId<Cinema2RenderPassId>('monolith-scene-pass')
const BLOOM_PASS_ID = cinema2StableId<Cinema2RenderPassId>('monolith-bloom-pass')
const SCENE_COLOR_OUTPUT_ID = cinema2StableId<Cinema2RenderSlotId>('monolith-scene-color')
const SCENE_DEPTH_OUTPUT_ID = cinema2StableId<Cinema2RenderSlotId>('monolith-scene-depth')
const BLOOM_INPUT_ID = cinema2StableId<Cinema2RenderSlotId>('monolith-bloom-input')
const BLOOM_EFFECT_ID = cinema2StableId<Cinema2EffectId>('monolith-bloom')

const STONE_MODULE_ID = cinema2StableId<Cinema2ModuleId>('monolith-stone')
const STONE_ACCENT_MODULE_ID = cinema2StableId<Cinema2ModuleId>('monolith-stone-accent')
const CYAN_MODULE_ID = cinema2StableId<Cinema2ModuleId>('monolith-cyan-emissive')
const AMBER_MODULE_ID = cinema2StableId<Cinema2ModuleId>('monolith-amber-emissive')
const RING_MODULE_ID = cinema2StableId<Cinema2ModuleId>('monolith-ring')
const DIAMOND_MODULE_ID = cinema2StableId<Cinema2ModuleId>('monolith-diamond')
const DIAMOND_CORE_MODULE_ID = cinema2StableId<Cinema2ModuleId>('monolith-diamond-core')

const KEY_LIGHT_ID = cinema2StableId<Cinema2LightId>('monolith-key-light')
const CYAN_FILL_LIGHT_ID = cinema2StableId<Cinema2LightId>('monolith-cyan-fill-light')
const AMBER_FOCUS_LIGHT_ID = cinema2StableId<Cinema2LightId>('monolith-amber-focus-light')
const VIOLET_DEPTH_LIGHT_ID = cinema2StableId<Cinema2LightId>('monolith-violet-depth-light')
const AMBIENT_LIGHT_ID = cinema2StableId<Cinema2LightId>('monolith-ambient-light')

function vec3(x: number, y: number, z: number): Cinema2Vector3 { return Object.freeze([x, y, z]) }
function color(r: number, g: number, b: number, a = 1): Cinema2Color { return Object.freeze([r, g, b, a]) }
function nodeId(name: string): Cinema2SceneNodeId { return cinema2StableId<Cinema2SceneNodeId>(`monolith-${name}`) }

const BOX_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="0" y="0" width="100" height="100"/></svg>'
const DIAMOND_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 160"><polygon points="50,0 100,80 50,160 0,80"/></svg>'

function createRingSvg(segments = 64): string {
  const path = (radius: number, reverse: boolean) => {
    const indices = Array.from({ length: segments }, (_, index) => reverse ? segments - 1 - index : index)
    return indices.map((index, order) => {
      const angle = (index / segments) * Math.PI * 2 - Math.PI / 2
      const x = 50 + Math.cos(angle) * radius
      const y = 50 + Math.sin(angle) * radius
      return `${order === 0 ? 'M' : 'L'}${x.toFixed(4)},${y.toFixed(4)}`
    }).join(' ') + ' Z'
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill-rule="evenodd" d="${path(50, false)} ${path(41, true)}"/></svg>`
}

const RING_SVG = createRingSvg()

function objectModule(
  id: Cinema2ModuleId,
  sourceId: string,
  rawSvg: string,
  materialColor: Cinema2Color,
  emissiveIntensity = 0,
): Readonly<Cinema2ModuleManifest> {
  return Object.freeze({
    id,
    typeId: OBJECT3D_TYPE_ID,
    version: 1,
    enabled: true,
    config: Object.freeze({
      source: Object.freeze({ kind: 'svg', sourceId, revision: 1, rawSvg }),
      material: Object.freeze({ color: materialColor, emissiveIntensity }),
    }),
  })
}

function moduleNode(
  name: string,
  module: Cinema2ModuleId,
  position: Cinema2Vector3,
  scale: Cinema2Vector3,
  rotation: Cinema2Vector3 = vec3(0, 0, 0),
): Readonly<Cinema2SceneNodeManifest> {
  return Object.freeze({
    id: nodeId(name),
    kind: 'module' as const,
    parent: cinema2Ref(WORLD_ROOT_NODE_ID),
    module: cinema2Ref(module),
    transform: Object.freeze({ position, rotation, scale }),
  })
}

const sceneNodes: Cinema2SceneNodeManifest[] = [
  Object.freeze({ id: WORLD_ROOT_NODE_ID, kind: 'group' as const, coordinateSpace: 'world' as const }),
  Object.freeze({
    id: FOCUS_NODE_ID,
    kind: 'primitive' as const,
    parent: cinema2Ref(WORLD_ROOT_NODE_ID),
    transform: Object.freeze({ position: vec3(0, 0.6, -13.4) }),
  }),

  // Ground plane and long axial approach. These are true depth-tested prisms,
  // not a screen-space floor treatment.
  moduleNode('floor', STONE_MODULE_ID, vec3(0, -2.22, -15), vec3(13.5, 0.12, 32)),
  moduleNode('approach-left-edge', STONE_ACCENT_MODULE_ID, vec3(-6.7, -1.96, -5.0), vec3(0.16, 0.18, 12.5)),
  moduleNode('approach-right-edge', STONE_ACCENT_MODULE_ID, vec3(6.7, -1.96, -5.0), vec3(0.16, 0.18, 12.5)),
  moduleNode('approach-gold-left', AMBER_MODULE_ID, vec3(-5.25, -1.87, -2.2), vec3(2.5, 0.025, 0.10)),
  moduleNode('approach-gold-right', AMBER_MODULE_ID, vec3(5.25, -1.87, -2.2), vec3(2.5, 0.025, 0.10)),
  moduleNode('approach-cyan-left', CYAN_MODULE_ID, vec3(-3.7, -1.86, -7.8), vec3(0.035, 0.025, 4.2)),
  moduleNode('approach-cyan-right', CYAN_MODULE_ID, vec3(3.7, -1.86, -7.8), vec3(0.035, 0.025, 4.2)),
]

// Broad staircase into the altar. Reusing one Object3D mesh keeps the scene
// efficient while still producing actual stepped occlusion and perspective.
for (let step = 0; step < 8; step += 1) {
  const t = step / 7
  sceneNodes.push(moduleNode(
    `altar-step-${step}`,
    STONE_ACCENT_MODULE_ID,
    vec3(0, -1.82 + step * 0.22, -9.0 - step * 0.64),
    vec3(6.7 - t * 1.9, 0.20, 1.15),
  ))
}
sceneNodes.push(
  moduleNode('altar-deck', STONE_MODULE_ID, vec3(0, 0.04, -14.15), vec3(4.5, 0.35, 2.7)),
  moduleNode('altar-throne', STONE_ACCENT_MODULE_ID, vec3(0, 0.65, -14.5), vec3(1.8, 0.55, 1.25)),
  moduleNode('altar-throne-light', AMBER_MODULE_ID, vec3(0, 1.23, -14.0), vec3(1.25, 0.055, 0.22)),
)

// Giant circular architectural frame and the suspended centerpiece.
sceneNodes.push(
  moduleNode('great-ring', RING_MODULE_ID, vec3(0, 3.45, -16.0), vec3(7.25, 7.25, 0.62)),
  moduleNode('central-diamond', DIAMOND_MODULE_ID, vec3(0, 3.25, -13.85), vec3(1.65, 2.45, 1.15)),
  moduleNode('central-diamond-core', DIAMOND_CORE_MODULE_ID, vec3(0, 3.25, -13.22), vec3(0.34, 0.55, 0.22)),
  moduleNode('central-cyan-beam', CYAN_MODULE_ID, vec3(0, 6.35, -14.1), vec3(0.035, 4.25, 0.18)),
  moduleNode('central-amber-axis', AMBER_MODULE_ID, vec3(0, 3.25, -13.15), vec3(0.045, 1.65, 0.18)),
  moduleNode('central-amber-crossbar', AMBER_MODULE_ID, vec3(0, 3.25, -13.08), vec3(0.58, 0.04, 0.16)),
)

// Two dominant framing monoliths.
for (const side of [-1, 1] as const) {
  const prefix = side < 0 ? 'left' : 'right'
  sceneNodes.push(
    moduleNode(`${prefix}-hero-monolith`, STONE_MODULE_ID, vec3(side * 3.8, 4.7, -14.7), vec3(1.05, 6.8, 1.55)),
    moduleNode(`${prefix}-hero-cyan`, CYAN_MODULE_ID, vec3(side * 3.8, 5.1, -13.08), vec3(0.035, 2.15, 0.14)),
    moduleNode(`${prefix}-altar-marker`, STONE_ACCENT_MODULE_ID, vec3(side * 3.15, -0.5, -11.5), vec3(0.35, 1.3, 0.65)),
    moduleNode(`${prefix}-altar-marker-light`, AMBER_MODULE_ID, vec3(side * 3.15, -0.25, -10.83), vec3(0.045, 0.72, 0.12)),
  )
}

// Foreground pylons crop the frame and prove near/far occlusion.
for (const side of [-1, 1] as const) {
  const prefix = side < 0 ? 'left' : 'right'
  sceneNodes.push(
    moduleNode(`${prefix}-foreground-pylon`, STONE_MODULE_ID, vec3(side * 8.05, -0.25, 1.0), vec3(1.05, 2.55, 1.9), vec3(0, side * 0.08, 0)),
    moduleNode(`${prefix}-foreground-pylon-light`, AMBER_MODULE_ID, vec3(side * 8.05, -0.15, 2.95), vec3(0.045, 1.05, 0.10)),
  )
}

// Receding colonnades. The placements are deliberately mirrored rather than
// random so the temple retains the reference image's ceremonial symmetry.
const depthRows = [
  { z: -7.0, x: 8.8, y: 3.9, h: 6.2, w: 0.85 },
  { z: -11.0, x: 7.2, y: 4.8, h: 7.1, w: 0.78 },
  { z: -18.0, x: 8.6, y: 5.7, h: 8.2, w: 0.92 },
  { z: -24.0, x: 6.9, y: 5.4, h: 7.7, w: 0.82 },
  { z: -30.0, x: 9.2, y: 6.2, h: 8.8, w: 0.95 },
]
for (const [rowIndex, row] of depthRows.entries()) {
  for (const side of [-1, 1] as const) {
    const prefix = side < 0 ? 'left' : 'right'
    sceneNodes.push(
      moduleNode(`${prefix}-depth-monolith-${rowIndex}`, STONE_MODULE_ID, vec3(side * row.x, row.y, row.z), vec3(row.w, row.h, 1.15)),
      moduleNode(`${prefix}-depth-cyan-${rowIndex}`, CYAN_MODULE_ID, vec3(side * row.x, row.y + 0.8, row.z + 1.18), vec3(0.025, 1.1 + rowIndex * 0.18, 0.10)),
    )
  }
}

// Secondary inner towers and horizontal bridges give the chamber more of the
// reference image's layered architectural density without requiring new engine primitives.
for (const [index, x] of [-5.8, -4.9, 4.9, 5.8].entries()) {
  const z = index < 2 ? -20.5 - index * 3.4 : -23.9 + (index - 2) * 3.4
  sceneNodes.push(moduleNode(`inner-tower-${index}`, STONE_ACCENT_MODULE_ID, vec3(x, 3.1 + (index % 2) * 0.8, z), vec3(0.62, 4.75, 0.95)))
}
sceneNodes.push(
  moduleNode('left-mid-bridge', STONE_MODULE_ID, vec3(-7.0, 2.0, -18.8), vec3(2.4, 0.30, 0.62)),
  moduleNode('right-mid-bridge', STONE_MODULE_ID, vec3(7.0, 2.0, -18.8), vec3(2.4, 0.30, 0.62)),
  moduleNode('left-far-bridge', STONE_MODULE_ID, vec3(-7.7, 3.0, -27.0), vec3(2.9, 0.26, 0.52)),
  moduleNode('right-far-bridge', STONE_MODULE_ID, vec3(7.7, 3.0, -27.0), vec3(2.9, 0.26, 0.52)),
)

const modules = Object.freeze([
  objectModule(STONE_MODULE_ID, 'monolith-box', BOX_SVG, color(0.055, 0.07, 0.085), 0.005),
  objectModule(STONE_ACCENT_MODULE_ID, 'monolith-box', BOX_SVG, color(0.085, 0.105, 0.125), 0.01),
  objectModule(CYAN_MODULE_ID, 'monolith-box', BOX_SVG, color(0.16, 0.82, 1.0), 2.6),
  objectModule(AMBER_MODULE_ID, 'monolith-box', BOX_SVG, color(1.0, 0.60, 0.20), 2.4),
  objectModule(RING_MODULE_ID, 'monolith-ring', RING_SVG, color(0.075, 0.09, 0.11), 0.015),
  objectModule(DIAMOND_MODULE_ID, 'monolith-diamond', DIAMOND_SVG, color(0.075, 0.09, 0.105), 0.02),
  objectModule(DIAMOND_CORE_MODULE_ID, 'monolith-diamond', DIAMOND_SVG, color(1.0, 0.55, 0.14), 2.0),
])

export const CINEMA2_MONOLITH_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = Object.freeze({
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_MONOLITH_PRESET_ID,
  revision: 1,
  metadata: Object.freeze({
    name: 'Monolith',
    description: 'Static native Cinema 2.0 monolith-temple capability scene built from depth-tested Object3D geometry, shared camera, lighting, fog and bloom.',
    tags: Object.freeze(['keeper', '3d', 'architecture', 'temple', 'monolith']),
  }),
  capabilities: Object.freeze([
    Object.freeze({ id: 'render.webgl2' as const, requirement: 'required' as const, purpose: 'Native Cinema 2.0 WebGL2 rendering.' }),
    Object.freeze({ id: 'render.depth' as const, requirement: 'required' as const, purpose: 'Depth-tested architectural occlusion and perspective.' }),
    Object.freeze({ id: 'scene.3d' as const, requirement: 'required' as const, purpose: 'World-space temple geometry.' }),
    Object.freeze({ id: 'camera.world' as const, requirement: 'required' as const, purpose: 'Static perspective composition through the shared Camera Runtime.' }),
    Object.freeze({ id: 'lighting' as const, requirement: 'required' as const, purpose: 'Shared Cinema 2.0 lighting and environment runtime.' }),
  ]),
  parameters: Object.freeze([CINEMA2_QUALITY_MODE_PARAMETER]),
  modules,
  scene: Object.freeze({
    nodes: Object.freeze(sceneNodes),
    roots: Object.freeze([cinema2Ref(WORLD_ROOT_NODE_ID)]),
  }),
  layers: Object.freeze([
    Object.freeze({
      id: WORLD_LAYER_ID,
      label: 'Monolith Temple',
      source: cinema2Ref(WORLD_ROOT_NODE_ID),
      role: 'world',
      depthPolicy: 'read-write' as const,
      order: 0,
    }),
  ]),
  cameras: Object.freeze([
    Object.freeze({
      id: CAMERA_ID,
      label: 'Monolith Static',
      projection: 'perspective' as const,
      transform: Object.freeze({ position: vec3(0, 1.45, 12.5) }),
      targetNode: cinema2Ref(FOCUS_NODE_ID),
      fovDegrees: 58,
      near: 0.1,
      far: 120,
      rig: Object.freeze({ kind: 'static' as const }),
      safety: Object.freeze({
        minFovDegrees: 40,
        maxFovDegrees: 76,
        minNear: 0.05,
        maxFar: 160,
        maxPositionOffset: vec3(0, 0, 0),
        maxTargetOffset: vec3(0, 0, 0),
      }),
    }),
  ]),
  lighting: Object.freeze({
    lights: Object.freeze([
      Object.freeze({
        id: KEY_LIGHT_ID,
        type: 'directional' as const,
        color: color(0.50, 0.72, 0.90),
        intensity: 1.18,
        transform: Object.freeze({ position: vec3(-4, 10, 7), rotation: vec3(-0.55, -0.30, 0) }),
        targetNode: cinema2Ref(FOCUS_NODE_ID),
      }),
      Object.freeze({
        id: CYAN_FILL_LIGHT_ID,
        type: 'point' as const,
        color: color(0.12, 0.67, 1.0),
        intensity: 4.0,
        transform: Object.freeze({ position: vec3(0, 3.8, -10.5) }),
      }),
      Object.freeze({
        id: AMBER_FOCUS_LIGHT_ID,
        type: 'point' as const,
        color: color(1.0, 0.49, 0.12),
        intensity: 5.2,
        transform: Object.freeze({ position: vec3(0, 2.7, -12.2) }),
      }),
      Object.freeze({
        id: VIOLET_DEPTH_LIGHT_ID,
        type: 'point' as const,
        color: color(0.48, 0.20, 0.82),
        intensity: 4.2,
        transform: Object.freeze({ position: vec3(0, 0.5, -28) }),
      }),
      Object.freeze({
        id: AMBIENT_LIGHT_ID,
        type: 'ambient' as const,
        color: color(0.24, 0.31, 0.39),
        intensity: 0.25,
      }),
    ]),
  }),
  environment: Object.freeze({
    backgroundColor: color(0.012, 0.020, 0.033),
    exposure: 1.0,
    fog: Object.freeze({
      mode: 'exponential' as const,
      color: color(0.075, 0.065, 0.14),
      density: 0.020,
    }),
  }),
  effects: Object.freeze([
    Object.freeze({
      id: BLOOM_EFFECT_ID,
      typeId: BLOOM_EFFECT_TYPE_ID,
      version: 1,
      enabled: true,
      order: 0,
      scope: 'output' as const,
      parameters: Object.freeze({ mix: 0.42, threshold: 0.60, radius: 2.4, intensity: 0.92 }),
    }),
  ]),
  render: Object.freeze({
    targets: Object.freeze([
      Object.freeze({
        id: SCENE_TARGET_ID,
        descriptor: Object.freeze({
          size: Object.freeze({ kind: 'viewport' as const }),
          colorFormat: 'rgba8' as const,
          depthFormat: 'depth24' as const,
        }),
        ownership: 'transient' as const,
      }),
    ]),
    passes: Object.freeze([
      Object.freeze({
        id: SCENE_PASS_ID,
        kind: 'scene' as const,
        layers: Object.freeze([cinema2Ref(WORLD_LAYER_ID)]),
        outputs: Object.freeze([
          Object.freeze({ id: SCENE_COLOR_OUTPUT_ID, target: cinema2Ref(SCENE_TARGET_ID), attachment: 'color' as const }),
          Object.freeze({ id: SCENE_DEPTH_OUTPUT_ID, target: cinema2Ref(SCENE_TARGET_ID), attachment: 'depth' as const }),
        ]),
      }),
      Object.freeze({
        id: BLOOM_PASS_ID,
        kind: 'fullscreen' as const,
        dependsOn: Object.freeze([cinema2Ref(SCENE_PASS_ID)]),
        inputs: Object.freeze([
          Object.freeze({
            id: BLOOM_INPUT_ID,
            source: Object.freeze({ pass: cinema2Ref(SCENE_PASS_ID), output: SCENE_COLOR_OUTPUT_ID }),
            attachment: 'color' as const,
          }),
        ]),
        effect: cinema2Ref(BLOOM_EFFECT_ID),
      }),
    ]),
    outputPass: cinema2Ref(BLOOM_PASS_ID),
  }),
  defaults: Object.freeze({ camera: cinema2Ref(CAMERA_ID) }),
  output: Object.freeze({ renderPass: cinema2Ref(BLOOM_PASS_ID), colorSpace: 'srgb' as const, alphaMode: 'opaque' as const }),
})

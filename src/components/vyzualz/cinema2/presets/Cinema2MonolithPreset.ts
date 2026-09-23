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

const STONE_DARK_MODULE_ID = cinema2StableId<Cinema2ModuleId>('monolith-stone-dark')
const STONE_MODULE_ID = cinema2StableId<Cinema2ModuleId>('monolith-stone')
const STONE_LIGHT_MODULE_ID = cinema2StableId<Cinema2ModuleId>('monolith-stone-light')
const TOWER_DARK_MODULE_ID = cinema2StableId<Cinema2ModuleId>('monolith-tower-dark')
const TOWER_MODULE_ID = cinema2StableId<Cinema2ModuleId>('monolith-tower')
const TOWER_LIGHT_MODULE_ID = cinema2StableId<Cinema2ModuleId>('monolith-tower-light')
const VIOLET_DEPTH_MODULE_ID = cinema2StableId<Cinema2ModuleId>('monolith-violet-depth')
const CYAN_HALO_MODULE_ID = cinema2StableId<Cinema2ModuleId>('monolith-cyan-halo')
const CYAN_CORE_MODULE_ID = cinema2StableId<Cinema2ModuleId>('monolith-cyan-core')
const AMBER_HALO_MODULE_ID = cinema2StableId<Cinema2ModuleId>('monolith-amber-halo')
const AMBER_CORE_MODULE_ID = cinema2StableId<Cinema2ModuleId>('monolith-amber-core')
const AMBER_RING_HALO_MODULE_ID = cinema2StableId<Cinema2ModuleId>('monolith-amber-ring-halo')
const AMBER_RING_CORE_MODULE_ID = cinema2StableId<Cinema2ModuleId>('monolith-amber-ring-core')
const RING_DARK_MODULE_ID = cinema2StableId<Cinema2ModuleId>('monolith-ring-dark')
const RING_LIGHT_MODULE_ID = cinema2StableId<Cinema2ModuleId>('monolith-ring-light')
const GLYPH_CYAN_MODULE_ID = cinema2StableId<Cinema2ModuleId>('monolith-glyph-cyan')
const DIAMOND_LEFT_MODULE_ID = cinema2StableId<Cinema2ModuleId>('monolith-diamond-left')
const DIAMOND_RIGHT_MODULE_ID = cinema2StableId<Cinema2ModuleId>('monolith-diamond-right')
const DIAMOND_CENTER_MODULE_ID = cinema2StableId<Cinema2ModuleId>('monolith-diamond-center')

const AMBIENT_LIGHT_ID = cinema2StableId<Cinema2LightId>('monolith-ambient-light')
const KEY_LIGHT_ID = cinema2StableId<Cinema2LightId>('monolith-key-light')
const WARM_RIM_LIGHT_ID = cinema2StableId<Cinema2LightId>('monolith-warm-rim-light')
const CYAN_FILL_LIGHT_ID = cinema2StableId<Cinema2LightId>('monolith-cyan-fill-light')
const AMBER_FOCUS_LIGHT_ID = cinema2StableId<Cinema2LightId>('monolith-amber-focus-light')
const VIOLET_DEPTH_LIGHT_ID = cinema2StableId<Cinema2LightId>('monolith-violet-depth-light')
const LEFT_CYAN_LIGHT_ID = cinema2StableId<Cinema2LightId>('monolith-left-cyan-light')
const RIGHT_CYAN_LIGHT_ID = cinema2StableId<Cinema2LightId>('monolith-right-cyan-light')

function vec3(x: number, y: number, z: number): Cinema2Vector3 { return Object.freeze([x, y, z]) }
function color(r: number, g: number, b: number, a = 1): Cinema2Color { return Object.freeze([r, g, b, a]) }
function nodeId(name: string): Cinema2SceneNodeId { return cinema2StableId<Cinema2SceneNodeId>(`monolith-${name}`) }

const BOX_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="0" y="0" width="100" height="100"/></svg>'
const TOWER_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 160"><polygon points="18,0 82,0 94,13 94,160 72,160 72,151 28,151 28,160 6,160 6,13"/></svg>'
const DIAMOND_LEFT_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 180"><polygon points="50,0 50,180 0,90"/></svg>'
const DIAMOND_RIGHT_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 180"><polygon points="50,0 100,90 50,180"/></svg>'
const DIAMOND_CENTER_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 180"><polygon points="50,0 72,90 50,180 28,90"/></svg>'

function createRingSvg(innerRadius: number, segments = 48): string {
  const path = (radius: number, reverse: boolean) => {
    const indices = Array.from({ length: segments }, (_, index) => reverse ? segments - 1 - index : index)
    return indices.map((index, order) => {
      const angle = (index / segments) * Math.PI * 2 - Math.PI / 2
      const x = 50 + Math.cos(angle) * radius
      const y = 50 + Math.sin(angle) * radius
      return `${order === 0 ? 'M' : 'L'}${x.toFixed(4)},${y.toFixed(4)}`
    }).join(' ') + ' Z'
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill-rule="evenodd" d="${path(50, false)} ${path(innerRadius, true)}"/></svg>`
}

function createSegmentedRingSvg(segments = 28, innerRadius = 40.8, gapRadians = 0.028): string {
  const polygons: string[] = []
  const outerRadius = 50
  for (let index = 0; index < segments; index += 1) {
    const start = (index / segments) * Math.PI * 2 - Math.PI / 2 + gapRadians
    const end = ((index + 1) / segments) * Math.PI * 2 - Math.PI / 2 - gapRadians
    const point = (radius: number, angle: number) => `${(50 + Math.cos(angle) * radius).toFixed(4)},${(50 + Math.sin(angle) * radius).toFixed(4)}`
    polygons.push(`<polygon points="${point(outerRadius, start)} ${point(outerRadius, end)} ${point(innerRadius, end)} ${point(innerRadius, start)}"/>`)
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${polygons.join('')}</svg>`
}

const RING_SOLID_SVG = createRingSvg(42.5)
const RING_SEGMENTED_SVG = createSegmentedRingSvg()
const GLYPH_RING_SVG = createRingSvg(37, 40)

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
      source: Object.freeze({ kind: 'svg', sourceId, revision: 2, rawSvg, curveTolerance: 0.45 }),
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

function addLightStrip(
  nodes: Cinema2SceneNodeManifest[],
  name: string,
  axis: 'vertical' | 'horizontal' | 'depth',
  position: Cinema2Vector3,
  length: number,
  family: 'cyan' | 'amber',
  thickness = 0.055,
): void {
  const halo = family === 'cyan' ? CYAN_HALO_MODULE_ID : AMBER_HALO_MODULE_ID
  const core = family === 'cyan' ? CYAN_CORE_MODULE_ID : AMBER_CORE_MODULE_ID
  const haloThickness = thickness * 2.8
  const coreScale = axis === 'vertical'
    ? vec3(thickness, length, 0.11)
    : axis === 'horizontal'
      ? vec3(length, thickness, 0.11)
      : vec3(thickness, thickness, length)
  const haloScale = axis === 'vertical'
    ? vec3(haloThickness, length * 1.035, 0.13)
    : axis === 'horizontal'
      ? vec3(length * 1.035, haloThickness, 0.13)
      : vec3(haloThickness, haloThickness, length * 1.035)
  nodes.push(
    moduleNode(`${name}-halo`, halo, position, haloScale),
    moduleNode(`${name}-core`, core, vec3(position[0], position[1], position[2] + 0.055), coreScale),
  )
}

const sceneNodes: Cinema2SceneNodeManifest[] = [
  Object.freeze({ id: WORLD_ROOT_NODE_ID, kind: 'group' as const, coordinateSpace: 'world' as const }),
  Object.freeze({
    id: FOCUS_NODE_ID,
    kind: 'primitive' as const,
    parent: cinema2Ref(WORLD_ROOT_NODE_ID),
    transform: Object.freeze({ position: vec3(0, 2.3, -16.0) }),
  }),
]

// FAR TEMPLE / ATMOSPHERIC BACKSTOP.
// Cinema 2.0 fog is distance fog, not volumetric fog. A distant real world-space
// backstop gives that fog something to attenuate so the chamber does not collapse
// into an empty black void.
sceneNodes.push(
  moduleNode('far-violet-backstop', VIOLET_DEPTH_MODULE_ID, vec3(0, 4.0, -43), vec3(22, 10.5, 0.42)),
  moduleNode('far-horizon-plinth', STONE_DARK_MODULE_ID, vec3(0, -0.7, -38.5), vec3(18, 1.2, 3.8)),
)

// FLOOR / APPROACH. Multiple real slabs create strong perspective and a readable
// foreground without pretending to provide ray-traced reflection.
sceneNodes.push(
  moduleNode('floor-foundation', STONE_DARK_MODULE_ID, vec3(0, -2.42, -14), vec3(15.4, 0.30, 36)),
  moduleNode('approach-center-slab', STONE_MODULE_ID, vec3(0, -2.10, -6.0), vec3(5.2, 0.16, 15.0)),
  moduleNode('approach-left-slab', STONE_DARK_MODULE_ID, vec3(-8.3, -2.08, -7.0), vec3(3.0, 0.14, 17.5)),
  moduleNode('approach-right-slab', STONE_DARK_MODULE_ID, vec3(8.3, -2.08, -7.0), vec3(3.0, 0.14, 17.5)),
  moduleNode('approach-left-curb', STONE_LIGHT_MODULE_ID, vec3(-5.55, -1.94, -5.0), vec3(0.28, 0.22, 13.5)),
  moduleNode('approach-right-curb', STONE_LIGHT_MODULE_ID, vec3(5.55, -1.94, -5.0), vec3(0.28, 0.22, 13.5)),
)
for (const z of [3.0, -1.5, -6.0, -10.5]) {
  sceneNodes.push(moduleNode(`floor-cross-seam-${z}`, STONE_LIGHT_MODULE_ID, vec3(0, -1.91, z), vec3(5.0, 0.025, 0.06)))
}
addLightStrip(sceneNodes, 'floor-left-cyan-rail', 'depth', vec3(-4.45, -1.84, -4.0), 8.0, 'cyan', 0.042)
addLightStrip(sceneNodes, 'floor-right-cyan-rail', 'depth', vec3(4.45, -1.84, -4.0), 8.0, 'cyan', 0.042)
addLightStrip(sceneNodes, 'floor-left-gold-rail', 'depth', vec3(-6.25, -1.82, -1.0), 5.5, 'amber', 0.045)
addLightStrip(sceneNodes, 'floor-right-gold-rail', 'depth', vec3(6.25, -1.82, -1.0), 5.5, 'amber', 0.045)

// BROAD STAIR / ALTAR TIERING.
for (let step = 0; step < 10; step += 1) {
  const t = step / 9
  sceneNodes.push(moduleNode(
    `altar-step-${step}`,
    step % 2 === 0 ? STONE_MODULE_ID : STONE_LIGHT_MODULE_ID,
    vec3(0, -1.74 + step * 0.205, -9.1 - step * 0.62),
    vec3(7.2 - t * 2.15, 0.20, 1.10),
  ))
}
sceneNodes.push(
  moduleNode('altar-lower-deck', STONE_DARK_MODULE_ID, vec3(0, 0.45, -15.2), vec3(5.15, 0.45, 3.25)),
  moduleNode('altar-upper-deck', STONE_MODULE_ID, vec3(0, 1.05, -15.25), vec3(3.65, 0.40, 2.3)),
  moduleNode('altar-throne', STONE_LIGHT_MODULE_ID, vec3(0, 1.62, -15.5), vec3(1.85, 0.65, 1.42)),
  moduleNode('altar-throne-cap', STONE_MODULE_ID, vec3(0, 2.12, -15.45), vec3(1.20, 0.18, 1.05)),
  moduleNode('altar-left-shoulder', STONE_DARK_MODULE_ID, vec3(-3.5, 0.65, -15.1), vec3(1.35, 0.75, 2.15)),
  moduleNode('altar-right-shoulder', STONE_DARK_MODULE_ID, vec3(3.5, 0.65, -15.1), vec3(1.35, 0.75, 2.15)),
)
addLightStrip(sceneNodes, 'altar-throne-gold', 'horizontal', vec3(0, 2.34, -14.87), 1.45, 'amber', 0.05)
addLightStrip(sceneNodes, 'altar-left-gold', 'vertical', vec3(-3.5, 1.0, -13.98), 0.95, 'amber', 0.05)
addLightStrip(sceneNodes, 'altar-right-gold', 'vertical', vec3(3.5, 1.0, -13.98), 0.95, 'amber', 0.05)

// GIANT ARCHITECTURAL RING. Three depth-separated structures create a thick,
// segmented assembly rather than a single flat icon.
sceneNodes.push(
  moduleNode('great-ring-rear', RING_DARK_MODULE_ID, vec3(0, 5.0, -18.5), vec3(8.65, 8.65, 1.15), vec3(0.03, 0, 0)),
  moduleNode('great-ring-segmented', RING_LIGHT_MODULE_ID, vec3(0, 5.0, -17.75), vec3(8.25, 8.25, 0.72), vec3(-0.02, 0, 0)),
  moduleNode('great-ring-inner-shadow', RING_DARK_MODULE_ID, vec3(0, 5.0, -17.15), vec3(7.65, 7.65, 0.38)),
)
for (const [index, angle] of [-90, -45, 0, 45, 90, 135, 180, 225].entries()) {
  const radians = angle * Math.PI / 180
  const x = Math.cos(radians) * 7.85
  const y = 5.0 + Math.sin(radians) * 7.85
  sceneNodes.push(moduleNode(`ring-rib-${index}`, STONE_LIGHT_MODULE_ID, vec3(x, y, -16.70), vec3(0.26, 0.78, 0.50), vec3(0, 0, radians)))
}

// CENTRAL SUSPENDED FACET. Separate left/right/front pieces have distinct material
// response and slight Y rotation so the silhouette reads as a physical faceted object.
sceneNodes.push(
  moduleNode('diamond-left-face', DIAMOND_LEFT_MODULE_ID, vec3(-0.07, 4.55, -14.55), vec3(1.85, 2.85, 1.05), vec3(0, -0.24, 0)),
  moduleNode('diamond-right-face', DIAMOND_RIGHT_MODULE_ID, vec3(0.07, 4.55, -14.55), vec3(1.85, 2.85, 1.05), vec3(0, 0.24, 0)),
  moduleNode('diamond-center-face', DIAMOND_CENTER_MODULE_ID, vec3(0, 4.55, -13.88), vec3(1.35, 2.58, 0.36)),
)
addLightStrip(sceneNodes, 'central-cyan-axis-upper', 'vertical', vec3(0, 8.5, -13.72), 3.0, 'cyan', 0.046)
addLightStrip(sceneNodes, 'central-gold-axis', 'vertical', vec3(0, 4.55, -13.55), 1.75, 'amber', 0.055)
addLightStrip(sceneNodes, 'central-gold-cross', 'horizontal', vec3(0, 4.55, -13.50), 0.72, 'amber', 0.055)

// HERO TOWERS. Nested hulls, buttresses and slightly opposed yaw angles reveal side
// faces to the basic Lambert renderer, which is essential for dimensionality.
for (const side of [-1, 1] as const) {
  const prefix = side < 0 ? 'left' : 'right'
  const yaw = side * -0.055
  sceneNodes.push(
    moduleNode(`${prefix}-hero-rear`, TOWER_DARK_MODULE_ID, vec3(side * 4.40, 5.2, -16.4), vec3(1.34, 8.0, 2.25), vec3(0, yaw, 0)),
    moduleNode(`${prefix}-hero-main`, TOWER_MODULE_ID, vec3(side * 4.25, 5.35, -15.55), vec3(1.12, 7.65, 1.52), vec3(0, yaw, 0)),
    moduleNode(`${prefix}-hero-front-spine`, TOWER_LIGHT_MODULE_ID, vec3(side * 4.12, 4.7, -14.68), vec3(0.22, 5.8, 0.42), vec3(0, yaw, 0)),
    moduleNode(`${prefix}-hero-lower-buttress`, STONE_DARK_MODULE_ID, vec3(side * 5.22, 0.35, -14.85), vec3(0.95, 1.85, 1.65), vec3(0, side * 0.08, 0)),
  )
  addLightStrip(sceneNodes, `${prefix}-hero-cyan`, 'vertical', vec3(side * 4.05, 6.10, -13.82), 2.55, 'cyan', 0.048)
  addLightStrip(sceneNodes, `${prefix}-hero-gold`, 'vertical', vec3(side * 4.05, 2.00, -13.82), 0.82, 'amber', 0.043)
}

// MIDGROUND TEMPLE WALLS / COLONNADES.
const midRows = [
  { z: -11.5, x: 8.0, y: 4.8, h: 7.3, w: 1.10, d: 1.8, yaw: 0.09 },
  { z: -17.8, x: 9.0, y: 5.7, h: 8.5, w: 1.05, d: 1.65, yaw: 0.06 },
  { z: -24.8, x: 7.3, y: 6.15, h: 9.0, w: 0.95, d: 1.45, yaw: 0.04 },
]
for (const [rowIndex, row] of midRows.entries()) {
  for (const side of [-1, 1] as const) {
    const prefix = side < 0 ? 'left' : 'right'
    sceneNodes.push(
      moduleNode(`${prefix}-mid-rear-${rowIndex}`, TOWER_DARK_MODULE_ID, vec3(side * row.x, row.y, row.z - 0.65), vec3(row.w * 1.18, row.h * 1.03, row.d * 1.20), vec3(0, side * -row.yaw, 0)),
      moduleNode(`${prefix}-mid-main-${rowIndex}`, TOWER_MODULE_ID, vec3(side * row.x, row.y, row.z), vec3(row.w, row.h, row.d), vec3(0, side * -row.yaw, 0)),
    )
    addLightStrip(sceneNodes, `${prefix}-mid-cyan-${rowIndex}`, 'vertical', vec3(side * row.x, row.y + 0.6, row.z + row.d * 0.54), 1.35 + rowIndex * 0.22, 'cyan', 0.040)
  }
}

// Cyan circular glyphs on the inner colonnade echo the reference language using
// real extruded ring geometry, not a screen-space overlay.
for (const side of [-1, 1] as const) {
  const x = side * 8.0
  sceneNodes.push(
    moduleNode(`${side < 0 ? 'left' : 'right'}-glyph-ring`, GLYPH_CYAN_MODULE_ID, vec3(x, 6.0, -10.48), vec3(0.58, 0.58, 0.14)),
  )
  addLightStrip(sceneNodes, `${side < 0 ? 'left' : 'right'}-glyph-axis`, 'vertical', vec3(x, 6.0, -10.36), 1.22, 'cyan', 0.035)
}

// HORIZONTAL CROSS STRUCTURES add overlap and scale cues.
sceneNodes.push(
  moduleNode('left-mid-bridge', STONE_DARK_MODULE_ID, vec3(-7.0, 2.3, -20.0), vec3(2.7, 0.36, 0.72)),
  moduleNode('right-mid-bridge', STONE_DARK_MODULE_ID, vec3(7.0, 2.3, -20.0), vec3(2.7, 0.36, 0.72)),
  moduleNode('left-high-bridge', STONE_MODULE_ID, vec3(-7.9, 4.0, -28.0), vec3(3.15, 0.28, 0.62)),
  moduleNode('right-high-bridge', STONE_MODULE_ID, vec3(7.9, 4.0, -28.0), vec3(3.15, 0.28, 0.62)),
  moduleNode('rear-crossbeam', STONE_DARK_MODULE_ID, vec3(0, 0.2, -31.5), vec3(12.5, 0.42, 0.75)),
)

// DISTANT TEMPLE. Repetition plus fog establishes the fourth depth zone without
// brute-force object counts.
const farRows = [
  { z: -29.5, x: 10.6, y: 5.8, h: 8.7, w: 0.82, d: 1.15 },
  { z: -34.8, x: 8.4, y: 6.2, h: 9.0, w: 0.72, d: 1.05 },
  { z: -39.2, x: 11.6, y: 6.8, h: 9.8, w: 0.78, d: 1.00 },
]
for (const [rowIndex, row] of farRows.entries()) {
  for (const side of [-1, 1] as const) {
    const prefix = side < 0 ? 'left' : 'right'
    sceneNodes.push(moduleNode(
      `${prefix}-far-tower-${rowIndex}`,
      rowIndex === 2 ? TOWER_DARK_MODULE_ID : TOWER_MODULE_ID,
      vec3(side * row.x, row.y, row.z),
      vec3(row.w, row.h, row.d),
      vec3(0, side * -0.035, 0),
    ))
    if (rowIndex < 2) addLightStrip(sceneNodes, `${prefix}-far-cyan-${rowIndex}`, 'vertical', vec3(side * row.x, row.y + 0.8, row.z + row.d * 0.55), 1.1, 'cyan', 0.032)
  }
}

// FOREGROUND FRAMING. These near-camera masses intentionally crop the edges and
// visibly occlude farther geometry, reinforcing genuine world-space scale.
for (const side of [-1, 1] as const) {
  const prefix = side < 0 ? 'left' : 'right'
  sceneNodes.push(
    moduleNode(`${prefix}-foreground-outer`, TOWER_DARK_MODULE_ID, vec3(side * 10.7, 4.5, 1.5), vec3(1.8, 8.6, 2.8), vec3(0, side * -0.11, 0)),
    moduleNode(`${prefix}-foreground-inner`, TOWER_MODULE_ID, vec3(side * 9.1, 3.5, -2.2), vec3(1.12, 6.7, 2.15), vec3(0, side * -0.08, 0)),
    moduleNode(`${prefix}-foreground-plinth`, STONE_DARK_MODULE_ID, vec3(side * 8.5, -0.5, 2.2), vec3(1.55, 2.2, 2.5), vec3(0, side * 0.10, 0)),
  )
  addLightStrip(sceneNodes, `${prefix}-foreground-gold`, 'vertical', vec3(side * 8.45, -0.10, 3.52), 1.15, 'amber', 0.055)
  addLightStrip(sceneNodes, `${prefix}-foreground-cyan`, 'vertical', vec3(side * 9.1, 4.2, -1.02), 1.95, 'cyan', 0.045)
}

// Cropped overhead halo gives the chamber vertical continuation above the frame.
sceneNodes.push(
  moduleNode('overhead-gold-halo', AMBER_RING_HALO_MODULE_ID, vec3(0, 12.2, -24.0), vec3(5.1, 5.1, 0.28)),
  moduleNode('overhead-gold-ring', AMBER_RING_CORE_MODULE_ID, vec3(0, 12.2, -23.82), vec3(4.92, 4.92, 0.16)),
)

const modules = Object.freeze([
  objectModule(STONE_DARK_MODULE_ID, 'monolith-box', BOX_SVG, color(0.050, 0.060, 0.078), 0.0),
  objectModule(STONE_MODULE_ID, 'monolith-box', BOX_SVG, color(0.105, 0.125, 0.155), 0.0),
  objectModule(STONE_LIGHT_MODULE_ID, 'monolith-box', BOX_SVG, color(0.165, 0.185, 0.220), 0.0),
  objectModule(TOWER_DARK_MODULE_ID, 'monolith-tower', TOWER_SVG, color(0.055, 0.065, 0.085), 0.0),
  objectModule(TOWER_MODULE_ID, 'monolith-tower', TOWER_SVG, color(0.110, 0.130, 0.165), 0.0),
  objectModule(TOWER_LIGHT_MODULE_ID, 'monolith-tower', TOWER_SVG, color(0.175, 0.195, 0.230), 0.0),
  objectModule(VIOLET_DEPTH_MODULE_ID, 'monolith-box', BOX_SVG, color(0.105, 0.070, 0.150), 0.03),
  objectModule(CYAN_HALO_MODULE_ID, 'monolith-box', BOX_SVG, color(0.055, 0.32, 0.42), 0.82),
  objectModule(CYAN_CORE_MODULE_ID, 'monolith-box', BOX_SVG, color(0.30, 0.92, 1.0), 3.4),
  objectModule(AMBER_HALO_MODULE_ID, 'monolith-box', BOX_SVG, color(0.34, 0.20, 0.065), 0.82),
  objectModule(AMBER_CORE_MODULE_ID, 'monolith-box', BOX_SVG, color(1.0, 0.69, 0.30), 3.0),
  objectModule(AMBER_RING_HALO_MODULE_ID, 'monolith-overhead-ring', RING_SOLID_SVG, color(0.34, 0.20, 0.065), 0.82),
  objectModule(AMBER_RING_CORE_MODULE_ID, 'monolith-overhead-ring', RING_SOLID_SVG, color(1.0, 0.69, 0.30), 2.8),
  objectModule(RING_DARK_MODULE_ID, 'monolith-ring-solid', RING_SOLID_SVG, color(0.070, 0.082, 0.105), 0.0),
  objectModule(RING_LIGHT_MODULE_ID, 'monolith-ring-segmented', RING_SEGMENTED_SVG, color(0.145, 0.165, 0.195), 0.0),
  objectModule(GLYPH_CYAN_MODULE_ID, 'monolith-glyph-ring', GLYPH_RING_SVG, color(0.24, 0.86, 1.0), 2.6),
  objectModule(DIAMOND_LEFT_MODULE_ID, 'monolith-diamond-left', DIAMOND_LEFT_SVG, color(0.095, 0.115, 0.145), 0.02),
  objectModule(DIAMOND_RIGHT_MODULE_ID, 'monolith-diamond-right', DIAMOND_RIGHT_SVG, color(0.155, 0.170, 0.205), 0.02),
  objectModule(DIAMOND_CENTER_MODULE_ID, 'monolith-diamond-center', DIAMOND_CENTER_SVG, color(0.24, 0.26, 0.30), 0.05),
])

export const CINEMA2_MONOLITH_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = Object.freeze({
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_MONOLITH_PRESET_ID,
  revision: 2,
  metadata: Object.freeze({
    name: 'Monolith',
    description: 'Static native Cinema 2.0 monumental temple scene using depth-tested Object3D geometry, perspective camera, shared lighting, distance fog and bloom.',
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
      transform: Object.freeze({ position: vec3(0, 0.25, 12.3) }),
      targetNode: cinema2Ref(FOCUS_NODE_ID),
      fovDegrees: 55,
      near: 0.1,
      far: 140,
      rig: Object.freeze({ kind: 'static' as const }),
      safety: Object.freeze({
        minFovDegrees: 40,
        maxFovDegrees: 76,
        minNear: 0.05,
        maxFar: 180,
        maxPositionOffset: vec3(0, 0, 0),
        maxTargetOffset: vec3(0, 0, 0),
      }),
    }),
  ]),
  lighting: Object.freeze({
    // Light ordering is deliberate. Cinema 2.0 quality modes keep only the first
    // 2 / 4 / 8 lights at low / medium / high, so ambient and primary shaping
    // lights must survive before decorative depth lights are considered.
    lights: Object.freeze([
      Object.freeze({
        id: AMBIENT_LIGHT_ID,
        type: 'ambient' as const,
        color: color(0.38, 0.46, 0.58),
        intensity: 0.40,
      }),
      Object.freeze({
        id: KEY_LIGHT_ID,
        type: 'directional' as const,
        color: color(0.62, 0.80, 1.0),
        intensity: 1.20,
        transform: Object.freeze({ position: vec3(-8.5, 11.5, 7.0) }),
        targetNode: cinema2Ref(FOCUS_NODE_ID),
      }),
      Object.freeze({
        id: WARM_RIM_LIGHT_ID,
        type: 'directional' as const,
        color: color(1.0, 0.55, 0.25),
        intensity: 0.58,
        transform: Object.freeze({ position: vec3(9.0, 8.0, 3.0) }),
        targetNode: cinema2Ref(FOCUS_NODE_ID),
      }),
      Object.freeze({
        id: CYAN_FILL_LIGHT_ID,
        type: 'point' as const,
        color: color(0.16, 0.72, 1.0),
        intensity: 7.5,
        transform: Object.freeze({ position: vec3(0, 4.8, -7.5) }),
      }),
      Object.freeze({
        id: AMBER_FOCUS_LIGHT_ID,
        type: 'point' as const,
        color: color(1.0, 0.50, 0.16),
        intensity: 8.5,
        transform: Object.freeze({ position: vec3(0, 4.3, -11.5) }),
      }),
      Object.freeze({
        id: VIOLET_DEPTH_LIGHT_ID,
        type: 'point' as const,
        color: color(0.54, 0.25, 0.90),
        intensity: 9.0,
        transform: Object.freeze({ position: vec3(0, 1.8, -31.0) }),
      }),
      Object.freeze({
        id: LEFT_CYAN_LIGHT_ID,
        type: 'point' as const,
        color: color(0.10, 0.58, 0.95),
        intensity: 6.0,
        transform: Object.freeze({ position: vec3(-8.0, 5.5, -6.0) }),
      }),
      Object.freeze({
        id: RIGHT_CYAN_LIGHT_ID,
        type: 'point' as const,
        color: color(0.10, 0.58, 0.95),
        intensity: 6.0,
        transform: Object.freeze({ position: vec3(8.0, 5.5, -6.0) }),
      }),
    ]),
  }),
  environment: Object.freeze({
    backgroundColor: color(0.018, 0.028, 0.045),
    exposure: 1.08,
    fog: Object.freeze({
      mode: 'exponential' as const,
      color: color(0.105, 0.080, 0.165),
      density: 0.017,
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
      parameters: Object.freeze({ mix: 0.78, threshold: 0.42, radius: 4.8, intensity: 1.65 }),
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

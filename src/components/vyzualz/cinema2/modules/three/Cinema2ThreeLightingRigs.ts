import type * as ThreeNamespace from 'three'
import type { Cinema2RenderQualityLevel } from '../../contracts/Cinema2NativePresetManifest'
import type { Cinema2ThreeLibrary } from './Cinema2ThreeLibrary'
import { applyCinema2ShadowToLight, disposeCinema2LightShadow, resolveCinema2ShadowProfile, type Cinema2ShadowProfile } from './Cinema2ThreeShadowProfiles'

/**
 * Reusable studio lighting rigs: three-point, softbox, product display, dramatic directional, industrial overhead and colored accent.
 *
 * A rig is plain data (`Cinema2LightingRigDefinition`) plus a builder that turns it into a `THREE.Group` of real lights. Nothing here is a preset
 * and nothing applies a rig automatically: a future scene picks a rig, builds it, adds the group to its scene, and removes and disposes it when
 * it is done. All lights use Three's physical units (directional in lux, spot/point in candela with inverse-square decay, rect-area in nits), so a
 * rig behaves the same under the engine's non-tone-mapped output as any other lit Three scene.
 *
 * Positions are for a subject about 2 world units tall centered on `center`. `scale` multiplies distances and, so illumination at the subject
 * stays the same, point and spot intensity by `scale²`.
 */
export type Cinema2LightingRigId = 'three-point' | 'softbox' | 'product-display' | 'dramatic-directional' | 'industrial-overhead' | 'colored-accent'
export type Cinema2Vec3 = readonly [x: number, y: number, z: number]

export type Cinema2RigLightKind = 'directional' | 'spot' | 'point' | 'rect-area' | 'hemisphere' | 'ambient'

export interface Cinema2RigLightSpec {
  /** Unique within the rig; also the light's `name` and the key of `RigInstance.lights`. */
  role: string
  kind: Cinema2RigLightKind
  /** Position relative to the rig center (ignored by hemisphere and ambient lights). */
  position?: Cinema2Vec3
  /** Aim point relative to the rig center. Defaults to the center. */
  target?: Cinema2Vec3
  color: number
  /** Second color: the ground color of a hemisphere light. */
  groundColor?: number
  intensity: number
  /** Spot cone half-angle in radians. */
  angle?: number
  penumbra?: number
  /** Point and spot range (0 = unlimited) and decay exponent. */
  distance?: number
  decay?: number
  /** Rect-area light size in world units. */
  width?: number
  height?: number
  /** This light may cast shadows when the rig is built with shadows. */
  shadow?: boolean
}

export interface Cinema2LightingRigDefinition {
  id: Cinema2LightingRigId
  label: string
  description: string
  lights: readonly Readonly<Cinema2RigLightSpec>[]
  /** `scene.environmentIntensity` that suits the rig (they are designed to sit on top of a dim studio environment). */
  recommendedEnvironmentIntensity: number
}

const D = (degrees: number): number => (degrees * Math.PI) / 180
const light = (spec: Cinema2RigLightSpec): Readonly<Cinema2RigLightSpec> => Object.freeze(spec)

export const CINEMA2_LIGHTING_RIGS: Readonly<Record<Cinema2LightingRigId, Readonly<Cinema2LightingRigDefinition>>> = Object.freeze({
  'three-point': Object.freeze({
    id: 'three-point',
    label: 'Three-Point Studio',
    description: 'Key from the front-left, softer fill from the right, rim from behind. The default for showing a subject clearly.',
    recommendedEnvironmentIntensity: 0.35,
    lights: Object.freeze([
      light({ role: 'key', kind: 'directional', position: [-4, 5, 5], color: 0xfff2e0, intensity: 3.2, shadow: true }),
      light({ role: 'fill', kind: 'directional', position: [5, 2, 4], color: 0xdbe8ff, intensity: 1.0 }),
      light({ role: 'rim', kind: 'directional', position: [1, 4, -6], color: 0xffffff, intensity: 2.4 }),
    ]),
  }),
  'softbox': Object.freeze({
    id: 'softbox',
    label: 'Softbox',
    description: 'Large rectangular area lights above and to the side: soft wrapped light and long, smooth highlights on glossy surfaces.',
    recommendedEnvironmentIntensity: 0.25,
    lights: Object.freeze([
      light({ role: 'top-box', kind: 'rect-area', position: [0, 5, 1.5], target: [0, 0, 0], color: 0xffffff, intensity: 9, width: 5, height: 3 }),
      light({ role: 'side-box', kind: 'rect-area', position: [-5, 2, 2.5], target: [0, 0.5, 0], color: 0xfff4e6, intensity: 6, width: 2, height: 4 }),
      light({ role: 'kicker', kind: 'rect-area', position: [4.5, 1.5, -3], target: [0, 0.5, 0], color: 0xe8f0ff, intensity: 5, width: 1.2, height: 4 }),
      light({ role: 'bounce', kind: 'hemisphere', color: 0xe6eeff, groundColor: 0x1a1a22, intensity: 0.35 }),
    ]),
  }),
  'product-display': Object.freeze({
    id: 'product-display',
    label: 'Product Display',
    description: 'A soft overhead dome, two edge strips that define the silhouette on metal and glass, and a low front fill that keeps shadow detail.',
    recommendedEnvironmentIntensity: 0.45,
    lights: Object.freeze([
      light({ role: 'dome', kind: 'rect-area', position: [0, 6, 0], target: [0, 0, 0], color: 0xffffff, intensity: 8, width: 6, height: 6 }),
      light({ role: 'edge-left', kind: 'rect-area', position: [-4, 1.5, -1], target: [0, 0.8, 0], color: 0xffffff, intensity: 7, width: 0.9, height: 4.5 }),
      light({ role: 'edge-right', kind: 'rect-area', position: [4, 1.5, -1], target: [0, 0.8, 0], color: 0xffffff, intensity: 7, width: 0.9, height: 4.5 }),
      light({ role: 'front-fill', kind: 'directional', position: [0, 1.2, 6], color: 0xf2f6ff, intensity: 0.9 }),
    ]),
  }),
  'dramatic-directional': Object.freeze({
    id: 'dramatic-directional',
    label: 'Dramatic Directional',
    description: 'One hard side light with a cold sliver of rim and almost no fill: deep shadows and strong form.',
    recommendedEnvironmentIntensity: 0.12,
    lights: Object.freeze([
      light({ role: 'key', kind: 'spot', position: [-5, 4.5, 3], color: 0xffe2b8, intensity: 260, angle: D(24), penumbra: 0.35, distance: 0, decay: 2, shadow: true }),
      light({ role: 'rim', kind: 'directional', position: [3, 3, -5], color: 0x9dc4ff, intensity: 1.6 }),
      light({ role: 'ambient', kind: 'ambient', color: 0x0c1020, intensity: 0.25 }),
    ]),
  }),
  'industrial-overhead': Object.freeze({
    id: 'industrial-overhead',
    label: 'Industrial Overhead',
    description: 'A row of hanging cone lights over the subject with cool, flat bounce from below: a workshop or warehouse feel.',
    recommendedEnvironmentIntensity: 0.18,
    lights: Object.freeze([
      light({ role: 'lamp-left', kind: 'spot', position: [-3, 6, 0], color: 0xf4f1e6, intensity: 180, angle: D(38), penumbra: 0.5, decay: 2, shadow: true }),
      light({ role: 'lamp-center', kind: 'spot', position: [0, 6, 0], color: 0xf4f1e6, intensity: 200, angle: D(38), penumbra: 0.5, decay: 2 }),
      light({ role: 'lamp-right', kind: 'spot', position: [3, 6, 0], color: 0xf4f1e6, intensity: 180, angle: D(38), penumbra: 0.5, decay: 2 }),
      light({ role: 'floor-bounce', kind: 'hemisphere', color: 0x6f7c8c, groundColor: 0x222831, intensity: 0.5 }),
    ]),
  }),
  'colored-accent': Object.freeze({
    id: 'colored-accent',
    label: 'Colored Accent',
    description: 'Neutral key with a warm and a cool colored accent from opposite sides. Override the accent colors per build.',
    recommendedEnvironmentIntensity: 0.2,
    lights: Object.freeze([
      light({ role: 'key', kind: 'directional', position: [-1, 5, 6], color: 0xffffff, intensity: 2.0, shadow: true }),
      light({ role: 'accent-warm', kind: 'point', position: [-4, 1.5, 1.5], color: 0xff6a3d, intensity: 70, distance: 0, decay: 2 }),
      light({ role: 'accent-cool', kind: 'point', position: [4, 1.5, 1.5], color: 0x3d8bff, intensity: 70, distance: 0, decay: 2 }),
      light({ role: 'under-glow', kind: 'point', position: [0, -2, 1], color: 0x7a3dff, intensity: 25, distance: 0, decay: 2 }),
    ]),
  }),
})

export function listCinema2LightingRigs(): readonly Readonly<Cinema2LightingRigDefinition>[] {
  return Object.freeze(Object.values(CINEMA2_LIGHTING_RIGS))
}

export interface Cinema2LightingRigOptions {
  /** World-space center the rig is arranged around. */
  center?: Cinema2Vec3
  /** Distance multiplier (intensities of point and spot lights follow `scale²`). */
  scale?: number
  /** Multiplies every light's intensity. */
  intensityScale?: number
  /** Replaces the color of a light by role. */
  colors?: Readonly<Record<string, number>>
  /** Lights flagged `shadow` cast with this tier's shadow settings (or an explicit profile). `false` or omitted: no shadows. */
  shadows?: false | Readonly<{ tier: Cinema2RenderQualityLevel; overrides?: Partial<Cinema2ShadowProfile> }>
}

export interface Cinema2LightingRigInstance {
  readonly id: Cinema2LightingRigId
  readonly group: ThreeNamespace.Group
  readonly lights: Readonly<Record<string, ThreeNamespace.Light>>
  /** Rect-area lights need Three's look-up tables initialized once before the first draw (`prepareCinema2LightingRig` does it). */
  readonly requiresAreaLightTables: boolean
  readonly recommendedEnvironmentIntensity: number
  /** Removes the group from its parent and disposes shadow maps and light helpers. */
  dispose(): void
}

export function buildCinema2LightingRig(
  THREE: typeof ThreeNamespace,
  rig: Cinema2LightingRigId | Readonly<Cinema2LightingRigDefinition>,
  options: Readonly<Cinema2LightingRigOptions> = {},
): Cinema2LightingRigInstance {
  const definition = typeof rig === 'string' ? CINEMA2_LIGHTING_RIGS[rig] : rig
  if (!definition) throw new Error(`Cinema 2.0 has no lighting rig "${String(rig)}".`)
  const center = options.center ?? [0, 0, 0]
  const scale = options.scale ?? 1
  const intensityScale = options.intensityScale ?? 1
  const group = new THREE.Group()
  group.name = `cinema2-rig-${definition.id}`
  const lights: Record<string, ThreeNamespace.Light> = {}
  const targets: ThreeNamespace.Object3D[] = []
  const shadowProfile = options.shadows ? resolveCinema2ShadowProfile(options.shadows.tier, options.shadows.overrides) : null
  let areaLights = false

  for (const spec of definition.lights) {
    if (lights[spec.role]) throw new Error(`Cinema 2.0 lighting rig "${definition.id}" has two lights with the role "${spec.role}".`)
    const color = options.colors?.[spec.role] ?? spec.color
    const base = spec.intensity * intensityScale
    const distanceScaled = base * scale * scale
    let light: ThreeNamespace.Light
    switch (spec.kind) {
      case 'directional':
        light = new THREE.DirectionalLight(color, base)
        break
      case 'spot': {
        const spot = new THREE.SpotLight(color, distanceScaled, (spec.distance ?? 0) * scale, spec.angle ?? D(30), spec.penumbra ?? 0.3, spec.decay ?? 2)
        light = spot
        break
      }
      case 'point':
        light = new THREE.PointLight(color, distanceScaled, (spec.distance ?? 0) * scale, spec.decay ?? 2)
        break
      case 'rect-area':
        light = new THREE.RectAreaLight(color, base, (spec.width ?? 1) * scale, (spec.height ?? 1) * scale)
        areaLights = true
        break
      case 'hemisphere':
        light = new THREE.HemisphereLight(color, spec.groundColor ?? 0x000000, base)
        break
      case 'ambient':
        light = new THREE.AmbientLight(color, base)
        break
    }
    light.name = spec.role
    if (spec.position && spec.kind !== 'hemisphere' && spec.kind !== 'ambient') {
      light.position.set(center[0] + spec.position[0] * scale, center[1] + spec.position[1] * scale, center[2] + spec.position[2] * scale)
    }
    if (spec.kind === 'directional' || spec.kind === 'spot') {
      const aimed = light as ThreeNamespace.DirectionalLight | ThreeNamespace.SpotLight
      const aim = spec.target ?? [0, 0, 0]
      aimed.target.position.set(center[0] + aim[0] * scale, center[1] + aim[1] * scale, center[2] + aim[2] * scale)
      group.add(aimed.target)
      targets.push(aimed.target)
    }
    if (spec.kind === 'rect-area') {
      const aim = spec.target ?? [0, 0, 0]
      light.lookAt(center[0] + aim[0] * scale, center[1] + aim[1] * scale, center[2] + aim[2] * scale)
    }
    if (spec.shadow && shadowProfile && (spec.kind === 'directional' || spec.kind === 'spot' || spec.kind === 'point')) {
      applyCinema2ShadowToLight(light as ThreeNamespace.DirectionalLight, shadowProfile)
    }
    lights[spec.role] = light
    group.add(light)
  }

  return {
    id: definition.id,
    group,
    lights: Object.freeze(lights),
    requiresAreaLightTables: areaLights,
    recommendedEnvironmentIntensity: definition.recommendedEnvironmentIntensity,
    dispose() {
      group.removeFromParent()
      for (const light of Object.values(lights)) {
        disposeCinema2LightShadow(light)
        light.dispose()
      }
      for (const target of targets) target.removeFromParent()
      group.clear()
    },
  }
}

let areaTablesReady: WeakSet<object> | null = null

/** Loads and initializes the rect-area look-up tables once per library. A no-op for rigs without area lights. */
export async function prepareCinema2LightingRig(library: Cinema2ThreeLibrary, rig: Cinema2LightingRigInstance): Promise<void> {
  if (!rig.requiresAreaLightTables) return
  areaTablesReady ??= new WeakSet()
  if (areaTablesReady.has(library)) return
  const tables = await library.loadAreaLightTables()
  tables.init()
  areaTablesReady.add(library)
}

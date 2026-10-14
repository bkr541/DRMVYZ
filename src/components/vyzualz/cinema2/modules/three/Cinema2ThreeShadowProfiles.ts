import type * as ThreeNamespace from 'three'
import type { Cinema2RenderQualityLevel } from '../../contracts/Cinema2NativePresetManifest'
import { cinema2RenderQualityProfile, type Cinema2ShadowFilter } from '../../render/Cinema2RenderQualityProfiles'

/**
 * Shared shadow configuration for future Cinema 2.0 scenes: map resolution, filtering, bias, a tight shadow camera, and per-mesh cast/receive
 * control, all resolved from the quality tier so shadows look consistent across tiers and cost what the tier allows.
 *
 * Existing presets configure their own shadows (`Cinema2ThreeSceneBridge`: flagged spot lights, `PCFShadowMap`, per-part cast/receive lists) and do
 * not use this module. A new scene calls `resolveCinema2ShadowProfile` once, `configureCinema2ShadowMap` before each draw (the renderer is shared
 * per context, so its shadow settings must be set by whoever draws), and `applyCinema2ShadowToLight` per shadow-casting light.
 */
export type Cinema2ThreeNamespace = typeof ThreeNamespace

export interface Cinema2ShadowProfile {
  /** Shadow map edge in texels (power of two recommended). */
  mapSize: number
  /** `basic`: hard edges, cheapest. `pcf`: soft percentage-closer filtering. `vsm`: variance maps with a blur. */
  filter: Cinema2ShadowFilter
  /** Softness radius for `pcf` and `vsm`. */
  radius: number
  /** VSM blur samples (0 for other filters). */
  blurSamples: number
  /** Depth bias; negative pulls the shadow toward the light. Scaled automatically by `mapSize` when left to the default. */
  bias: number
  /** Offset along the surface normal; cures acne on curved surfaces without detaching the shadow. */
  normalBias: number
  cameraNear: number
  cameraFar: number
}

const REFERENCE_MAP_SIZE = 2048

export function resolveCinema2ShadowProfile(tier: Cinema2RenderQualityLevel, overrides: Partial<Cinema2ShadowProfile> = {}): Readonly<Cinema2ShadowProfile> {
  const base = cinema2RenderQualityProfile(tier).shadows
  const mapSize = overrides.mapSize ?? base.mapSize
  // Smaller maps have coarser texels, so they need more bias to stay free of acne; larger maps need less so contact shadows stay attached.
  const scaledBias = -0.0004 * (REFERENCE_MAP_SIZE / mapSize)
  return Object.freeze({
    mapSize,
    filter: overrides.filter ?? base.filter,
    radius: overrides.radius ?? base.radius,
    blurSamples: overrides.blurSamples ?? base.blurSamples,
    bias: overrides.bias ?? scaledBias,
    normalBias: overrides.normalBias ?? 0.02,
    cameraNear: overrides.cameraNear ?? 0.1,
    cameraFar: overrides.cameraFar ?? 60,
  })
}

/** The renderer shadow-map type for a filter. (`PCFSoftShadowMap` was removed in Three r186; `PCFShadowMap` is soft and takes a radius.) */
export function cinema2ShadowMapType(THREE: Cinema2ThreeNamespace, filter: Cinema2ShadowFilter): ThreeNamespace.ShadowMapType {
  return filter === 'basic' ? THREE.BasicShadowMap : filter === 'vsm' ? THREE.VSMShadowMap : THREE.PCFShadowMap
}

/** Sets the shared renderer's shadow map. Call before each draw by whoever draws: the renderer is shared across presets. */
export function configureCinema2ShadowMap(THREE: Cinema2ThreeNamespace, renderer: ThreeNamespace.WebGLRenderer, profile: Readonly<Cinema2ShadowProfile>, enabled: boolean): void {
  renderer.shadowMap.enabled = enabled
  const type = cinema2ShadowMapType(THREE, profile.filter)
  if (renderer.shadowMap.type !== type) renderer.shadowMap.type = type
}

type ShadowLight = ThreeNamespace.DirectionalLight | ThreeNamespace.SpotLight | ThreeNamespace.PointLight

/**
 * Configures one light's shadow from a profile and turns casting on. Changing the map size releases the old map so the next draw allocates the
 * new one. Rect-area, hemisphere and ambient lights cannot cast shadows in Three; passing one is a programming error and throws.
 */
export function applyCinema2ShadowToLight(light: ShadowLight, profile: Readonly<Cinema2ShadowProfile>): void {
  if (!light.shadow) throw new Error(`Cinema 2.0 shadows: ${light.type} cannot cast shadows.`)
  const shadow = light.shadow
  if (shadow.mapSize.x !== profile.mapSize || shadow.mapSize.y !== profile.mapSize) {
    shadow.mapSize.set(profile.mapSize, profile.mapSize)
    shadow.map?.dispose()
    shadow.map = null
  }
  shadow.bias = profile.bias
  shadow.normalBias = profile.normalBias
  shadow.radius = profile.radius
  shadow.blurSamples = profile.blurSamples
  shadow.camera.near = profile.cameraNear
  shadow.camera.far = profile.cameraFar
  shadow.camera.updateProjectionMatrix()
  light.castShadow = true
}

/**
 * Fits a directional light's shadow frustum around a world-space box, so the whole map is spent on what can actually be shadowed. The light's
 * position and target must already be set. With `snap`, the frustum center snaps to whole shadow texels so the shadow does not crawl when the
 * box moves by sub-texel amounts.
 */
export function fitCinema2DirectionalShadow(THREE: Cinema2ThreeNamespace, light: ThreeNamespace.DirectionalLight, bounds: ThreeNamespace.Box3, snap = true): void {
  light.updateMatrixWorld(true)
  light.target.updateMatrixWorld(true)
  const camera = light.shadow.camera
  camera.position.copy(light.getWorldPosition(new THREE.Vector3()))
  camera.lookAt(light.target.getWorldPosition(new THREE.Vector3()))
  camera.updateMatrixWorld(true)
  const inverse = camera.matrixWorldInverse.copy(camera.matrixWorld).invert()
  const corner = new THREE.Vector3()
  const lightSpace = new THREE.Box3()
  for (let index = 0; index < 8; index += 1) {
    corner.set(index & 1 ? bounds.max.x : bounds.min.x, index & 2 ? bounds.max.y : bounds.min.y, index & 4 ? bounds.max.z : bounds.min.z)
    lightSpace.expandByPoint(corner.applyMatrix4(inverse))
  }
  let { x: minX, y: minY } = lightSpace.min
  let { x: maxX, y: maxY } = lightSpace.max
  if (snap) {
    const texel = Math.max(maxX - minX, maxY - minY) / light.shadow.mapSize.x
    if (texel > 0) {
      minX = Math.floor(minX / texel) * texel
      minY = Math.floor(minY / texel) * texel
      maxX = Math.ceil(maxX / texel) * texel
      maxY = Math.ceil(maxY / texel) * texel
    }
  }
  camera.left = minX
  camera.right = maxX
  camera.bottom = minY
  camera.top = maxY
  // Light space looks down -z: the nearest box point has the largest z.
  camera.near = Math.max(0.01, -lightSpace.max.z - 0.5)
  camera.far = -lightSpace.min.z + 0.5
  camera.updateProjectionMatrix()
}

export interface Cinema2ShadowParticipation {
  /** Mesh names (exact string, or regular expression) that cast shadows. `true` means every mesh. */
  cast?: boolean | string | RegExp | readonly (string | RegExp)[]
  receive?: boolean | string | RegExp | readonly (string | RegExp)[]
}

function matcher(rule: Cinema2ShadowParticipation['cast']): (name: string) => boolean {
  if (rule === undefined || rule === false) return () => false
  if (rule === true) return () => true
  const rules = Array.isArray(rule) ? rule : [rule]
  return name => rules.some(entry => (typeof entry === 'string' ? entry === name : entry.test(name)))
}

/** Sets `castShadow` / `receiveShadow` on meshes by name. Meshes the rule does not match are left as they are. */
export function setCinema2ShadowParticipation(root: ThreeNamespace.Object3D, participation: Readonly<Cinema2ShadowParticipation>): { cast: number; receive: number } {
  const cast = matcher(participation.cast)
  const receive = matcher(participation.receive)
  let casting = 0
  let receiving = 0
  root.traverse(object => {
    const mesh = object as ThreeNamespace.Mesh
    if (!mesh.isMesh) return
    if (participation.cast !== undefined && cast(mesh.name)) { mesh.castShadow = true; casting += 1 }
    if (participation.receive !== undefined && receive(mesh.name)) { mesh.receiveShadow = true; receiving += 1 }
  })
  return { cast: casting, receive: receiving }
}

/** Releases a light's shadow map and render targets. Safe to call repeatedly. */
export function disposeCinema2LightShadow(light: ThreeNamespace.Light): void {
  const shadow = (light as ShadowLight).shadow
  if (!shadow) return
  shadow.map?.dispose()
  shadow.map = null
  shadow.dispose()
  light.castShadow = false
}

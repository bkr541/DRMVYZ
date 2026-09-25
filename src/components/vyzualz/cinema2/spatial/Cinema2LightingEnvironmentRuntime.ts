import type {
  Cinema2Color,
  Cinema2LightId,
  Cinema2LightManifest,
  Cinema2LightType,
  Cinema2RenderQualityLevel,
  Cinema2Vector3,
} from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2FinalValueResolver, Cinema2TargetHandle, Cinema2TargetId } from '../parameters/Cinema2TargetRuntime'
import type { Cinema2CompiledPresetPlan } from '../presets/Cinema2PresetCompiler'
import type { Cinema2Matrix4 } from '../scene/Cinema2SceneGraph'
import type { Cinema2SpatialRuntime } from './Cinema2SpatialRuntime'

export interface Cinema2ResolvedLightFrame {
  id: Cinema2LightId
  type: Cinema2LightType
  color: Cinema2Color
  intensity: number
  /** Final world-space light origin after optional Scene Graph anchoring. */
  position: Cinema2Vector3
  targetPosition: Cinema2Vector3 | null
  /** Unit vector pointing from the light toward its authored/derived target. */
  direction: Cinema2Vector3
  /**
   * Spot cone, resolved from `config.coneAngleDegrees` (outer half-angle) and `config.penumbra`
   * (0 = hard edge, 1 = fully soft). Null for every other light type.
   */
  spot: Readonly<{ outerAngleDegrees: number; innerAngleDegrees: number }> | null
  /** Distance at which the light stops scattering into volumetric atmosphere (`config.range`). */
  range: number
  /** Shadow settings when the light is a directional or spot light authored with `config.castShadow`; null otherwise. */
  shadow?: Readonly<Cinema2LightShadowSettings> | null
}

/**
 * Authoring of the (single) shadow-casting light, all from `light.config`:
 * `castShadow` (boolean), `shadowExtent` (directional: half-size in world units of the square region the map covers, default 40),
 * `shadowDepth` (directional: length of the light's depth range, default 160), `shadowFocusAhead` (directional: the covered region is
 * centred this far ahead of the camera, default 0.5 * extent), `shadowBias` (world units of depth bias, default 0.15) and
 * `shadowSoftness` (filter radius in shadow-map texels, default 1). Spot lights use their cone and `range` instead.
 */
export interface Cinema2LightShadowSettings {
  extent: number
  depth: number
  focusAhead: number
  bias: number
  softness: number
}

export interface Cinema2ResolvedFogFrame {
  mode: 'linear' | 'exponential'
  color: Cinema2Color
  density: number
  near: number
  far: number
}

export interface Cinema2ResolvedEnvironmentFrame {
  authored: boolean
  backgroundColor: Cinema2Color
  exposure: number
  fog: Readonly<Cinema2ResolvedFogFrame> | null
}

export interface Cinema2LightingEnvironmentFrame {
  quality: Cinema2RenderQualityLevel
  lights: readonly Readonly<Cinema2ResolvedLightFrame>[]
  omittedLightCount: number
  environment: Readonly<Cinema2ResolvedEnvironmentFrame>
}

export interface Cinema2LightingEnvironmentRuntimeSnapshot {
  disposed: boolean
  frameCount: number
  authoredLightCount: number
  activeLightCount: number
  omittedLightCount: number
  hasAuthoredEnvironment: boolean
  quality: Cinema2RenderQualityLevel
}

interface LightTargetSet {
  color: Cinema2TargetId | null
  intensity: Cinema2TargetId | null
  position: Cinema2TargetId | null
  rotation: Cinema2TargetId | null
}

interface EnvironmentTargetSet {
  backgroundColor: Cinema2TargetId | null
  exposure: Cinema2TargetId | null
  fogColor: Cinema2TargetId | null
  fogDensity: Cinema2TargetId | null
  fogNear: Cinema2TargetId | null
  fogFar: Cinema2TargetId | null
}

const DEFAULT_COLOR = Object.freeze([1, 1, 1, 1]) as Cinema2Color
const DEFAULT_BACKGROUND = Object.freeze([0, 0, 0, 1]) as Cinema2Color
const DEFAULT_POSITION = Object.freeze([0, 0, 0]) as Cinema2Vector3
const DEFAULT_ROTATION = Object.freeze([0, 0, 0]) as Cinema2Vector3
const DEFAULT_DIRECTION = Object.freeze([0, 0, -1]) as Cinema2Vector3
const DEFAULT_SPOT_OUTER_DEGREES = 30
const DEFAULT_SPOT_PENUMBRA = 0.3
const DEFAULT_LIGHT_RANGE = 30
const QUALITY_LIGHT_LIMIT = Object.freeze({ low: 2, medium: 4, high: 8 } as const)

/**
 * Canonical shared spatial Lighting/Environment service for Cinema 2.0.
 *
 * Authored state stays in the immutable preset plan, persistent user values
 * stay in Parameter State, transient modulation stays in the shared target
 * resolver, and Scene Graph identity resolves light target positions. This
 * service only materializes the final read-only render frame.
 */
export class Cinema2LightingEnvironmentRuntime {
  private readonly lightTargets = new Map<Cinema2LightId, LightTargetSet>()
  private readonly environmentTargets: EnvironmentTargetSet
  private currentFrame: Readonly<Cinema2LightingEnvironmentFrame>
  private frameCount = 0
  private disposed = false

  constructor(
    private readonly plan: Readonly<Cinema2CompiledPresetPlan>,
    private readonly resolver: Cinema2FinalValueResolver,
    private readonly spatial: Cinema2SpatialRuntime,
    private quality: Cinema2RenderQualityLevel = 'high',
  ) {
    for (const light of plan.manifest.lighting?.lights ?? []) {
      this.lightTargets.set(light.id, {
        color: findTarget(plan.targets.targets, 'light', light.id, 'color'),
        intensity: findTarget(plan.targets.targets, 'light', light.id, 'intensity'),
        position: findTarget(plan.targets.targets, 'light', light.id, 'transform.position'),
        rotation: findTarget(plan.targets.targets, 'light', light.id, 'transform.rotation'),
      })
    }
    this.environmentTargets = {
      backgroundColor: findTarget(plan.targets.targets, 'environment', 'root', 'backgroundColor'),
      exposure: findTarget(plan.targets.targets, 'environment', 'root', 'exposure'),
      fogColor: findTarget(plan.targets.targets, 'environment', 'root', 'fog.color'),
      fogDensity: findTarget(plan.targets.targets, 'environment', 'root', 'fog.density'),
      fogNear: findTarget(plan.targets.targets, 'environment', 'root', 'fog.near'),
      fogFar: findTarget(plan.targets.targets, 'environment', 'root', 'fog.far'),
    }
    this.currentFrame = freezeFrame({
      quality: this.quality,
      lights: [],
      omittedLightCount: 0,
      environment: resolveEnvironment(plan, resolver, this.environmentTargets),
    })
    this.update()
  }

  setQuality(quality: Cinema2RenderQualityLevel): void {
    this.quality = quality
  }

  update(): Readonly<Cinema2LightingEnvironmentFrame> {
    if (this.disposed) return this.currentFrame
    const authored = this.plan.manifest.lighting?.lights ?? []
    const maximum = QUALITY_LIGHT_LIMIT[this.quality]
    const active = authored.slice(0, maximum).map(light => {
      const targets = this.lightTargets.get(light.id)
      const localPosition = resolveVec3(this.resolver, targets?.position, light.transform?.position ?? DEFAULT_POSITION)
      const localRotation = resolveVec3(this.resolver, targets?.rotation, light.transform?.rotation ?? DEFAULT_ROTATION)
      const anchor = light.node ? this.spatial.resolveNode(light.node.$ref) : null
      const position = anchor ? transformPoint(anchor.worldMatrix, localPosition) : localPosition
      const authoredDirection = anchor
        ? transformDirection(anchor.worldMatrix, forwardFromEuler(localRotation))
        : forwardFromEuler(localRotation)
      const targetPosition = light.targetNode
        ? this.spatial.resolveNode(light.targetNode.$ref)?.worldPosition ?? null
        : null
      const direction = targetPosition
        ? normalize(subtract(targetPosition, position), authoredDirection)
        : authoredDirection
      return Object.freeze({
        id: light.id,
        type: light.type,
        color: resolveColor(this.resolver, targets?.color, light.color ?? DEFAULT_COLOR),
        intensity: Math.max(0, resolveNumber(this.resolver, targets?.intensity, light.intensity ?? 1)),
        position,
        targetPosition: targetPosition ? freezeVec3(targetPosition) : null,
        direction,
        spot: light.type === 'spot' ? resolveSpot(light.config) : null,
        range: resolveRange(light.config),
        shadow: resolveShadow(light.type, light.config),
      })
    })
    this.currentFrame = freezeFrame({
      quality: this.quality,
      lights: active,
      omittedLightCount: Math.max(0, authored.length - active.length),
      environment: resolveEnvironment(this.plan, this.resolver, this.environmentTargets),
    })
    this.frameCount += 1
    return this.currentFrame
  }

  getFrame(): Readonly<Cinema2LightingEnvironmentFrame> {
    return this.currentFrame
  }

  getSnapshot(): Readonly<Cinema2LightingEnvironmentRuntimeSnapshot> {
    return Object.freeze({
      disposed: this.disposed,
      frameCount: this.frameCount,
      authoredLightCount: this.plan.manifest.lighting?.lights.length ?? 0,
      activeLightCount: this.currentFrame.lights.length,
      omittedLightCount: this.currentFrame.omittedLightCount,
      hasAuthoredEnvironment: this.plan.manifest.environment != null,
      quality: this.quality,
    })
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.lightTargets.clear()
  }
}

function resolveEnvironment(
  plan: Readonly<Cinema2CompiledPresetPlan>,
  resolver: Cinema2FinalValueResolver,
  targets: EnvironmentTargetSet,
): Readonly<Cinema2ResolvedEnvironmentFrame> {
  const authored = plan.manifest.environment
  const backgroundColor = resolveColor(resolver, targets.backgroundColor, authored?.backgroundColor ?? DEFAULT_BACKGROUND)
  const exposure = Math.max(0, resolveNumber(resolver, targets.exposure, authored?.exposure ?? 1))
  const fog = authored?.fog
  if (!fog) return Object.freeze({ authored: authored != null, backgroundColor, exposure, fog: null })
  const near = Math.max(0, resolveNumber(resolver, targets.fogNear, fog.near ?? 0))
  const resolvedFar = Math.max(0, resolveNumber(resolver, targets.fogFar, fog.far ?? 1000))
  const far = fog.mode === 'linear' ? Math.max(near + 0.0001, resolvedFar) : resolvedFar
  return Object.freeze({
    authored: true,
    backgroundColor,
    exposure,
    fog: Object.freeze({
      mode: fog.mode,
      color: resolveColor(resolver, targets.fogColor, fog.color ?? DEFAULT_BACKGROUND),
      density: Math.max(0, resolveNumber(resolver, targets.fogDensity, fog.density ?? 0)),
      near,
      far,
    }),
  })
}

function resolveSpot(config: Cinema2LightManifest['config']): NonNullable<Cinema2ResolvedLightFrame['spot']> {
  const outer = Math.min(89, Math.max(1, finite(config?.coneAngleDegrees as number | undefined, DEFAULT_SPOT_OUTER_DEGREES)))
  const penumbra = clamp01(finite(config?.penumbra as number | undefined, DEFAULT_SPOT_PENUMBRA))
  return Object.freeze({ outerAngleDegrees: outer, innerAngleDegrees: outer * (1 - penumbra) })
}

function resolveShadow(type: Cinema2LightType, config: Cinema2LightManifest['config']): Readonly<Cinema2LightShadowSettings> | null {
  if (config?.castShadow !== true || (type !== 'directional' && type !== 'spot')) return null
  const extent = Math.min(400, Math.max(2, finite(config.shadowExtent as number | undefined, 40)))
  return Object.freeze({
    extent,
    depth: Math.min(2000, Math.max(10, finite(config.shadowDepth as number | undefined, 160))),
    focusAhead: Math.min(400, Math.max(0, finite(config.shadowFocusAhead as number | undefined, extent * 0.5))),
    bias: Math.min(5, Math.max(0, finite(config.shadowBias as number | undefined, 0.15))),
    softness: Math.min(4, Math.max(0, finite(config.shadowSoftness as number | undefined, 1))),
  })
}

function resolveRange(config: Cinema2LightManifest['config']): number {
  return Math.max(0.1, finite(config?.range as number | undefined, DEFAULT_LIGHT_RANGE))
}

function findTarget(
  targets: readonly Readonly<Cinema2TargetHandle>[],
  kind: 'light' | 'environment',
  ownerId: string,
  property: string,
): Cinema2TargetId | null {
  return targets.find(target => target.kind === kind && target.ownerId === ownerId && target.property === property)?.id ?? null
}

function resolveColor(
  resolver: Cinema2FinalValueResolver,
  targetId: Cinema2TargetId | null | undefined,
  fallback: Cinema2Color,
): Cinema2Color {
  if (!targetId) return normalizeColor(fallback)
  const result = resolver.resolve(targetId)
  const value = result.ok ? result.value : undefined
  return isColor(value) ? normalizeColor(value) : normalizeColor(fallback)
}

function resolveVec3(
  resolver: Cinema2FinalValueResolver,
  targetId: Cinema2TargetId | null | undefined,
  fallback: Cinema2Vector3,
): Cinema2Vector3 {
  if (!targetId) return freezeVec3(fallback)
  const result = resolver.resolve(targetId)
  const value = result.ok ? result.value : undefined
  return isVec3(value) ? freezeVec3(value) : freezeVec3(fallback)
}

function resolveNumber(
  resolver: Cinema2FinalValueResolver,
  targetId: Cinema2TargetId | null | undefined,
  fallback: number,
): number {
  if (!targetId) return finite(fallback, 0)
  const result = resolver.resolve(targetId)
  return result.ok && typeof result.value === 'number' && Number.isFinite(result.value) ? result.value : finite(fallback, 0)
}

function forwardFromEuler(rotation: Cinema2Vector3): Cinema2Vector3 {
  const pitch = finite(rotation[0], 0)
  const yaw = finite(rotation[1], 0)
  const cosinePitch = Math.cos(pitch)
  return normalize([
    -Math.sin(yaw) * cosinePitch,
    Math.sin(pitch),
    -Math.cos(yaw) * cosinePitch,
  ], DEFAULT_DIRECTION)
}

function transformPoint(matrix: Cinema2Matrix4, point: Cinema2Vector3): Cinema2Vector3 {
  return freezeVec3([
    matrix[0] * point[0] + matrix[4] * point[1] + matrix[8] * point[2] + matrix[12],
    matrix[1] * point[0] + matrix[5] * point[1] + matrix[9] * point[2] + matrix[13],
    matrix[2] * point[0] + matrix[6] * point[1] + matrix[10] * point[2] + matrix[14],
  ])
}

function transformDirection(matrix: Cinema2Matrix4, direction: Cinema2Vector3): Cinema2Vector3 {
  return normalize([
    matrix[0] * direction[0] + matrix[4] * direction[1] + matrix[8] * direction[2],
    matrix[1] * direction[0] + matrix[5] * direction[1] + matrix[9] * direction[2],
    matrix[2] * direction[0] + matrix[6] * direction[1] + matrix[10] * direction[2],
  ], DEFAULT_DIRECTION)
}

function subtract(left: Cinema2Vector3, right: Cinema2Vector3): Cinema2Vector3 {
  return [left[0] - right[0], left[1] - right[1], left[2] - right[2]]
}

function normalize(value: Cinema2Vector3, fallback: Cinema2Vector3): Cinema2Vector3 {
  const length = Math.hypot(value[0], value[1], value[2])
  if (!Number.isFinite(length) || length < 1e-9) return freezeVec3(fallback)
  return freezeVec3([value[0] / length, value[1] / length, value[2] / length])
}

function normalizeColor(value: Cinema2Color): Cinema2Color {
  return Object.freeze([
    clamp01(finite(value[0], 1)),
    clamp01(finite(value[1], 1)),
    clamp01(finite(value[2], 1)),
    clamp01(finite(value[3], 1)),
  ]) as Cinema2Color
}

function isColor(value: unknown): value is Cinema2Color {
  return Array.isArray(value)
    && value.length === 4
    && value.every(component => typeof component === 'number' && Number.isFinite(component))
}

function isVec3(value: unknown): value is Cinema2Vector3 {
  return Array.isArray(value)
    && value.length === 3
    && value.every(component => typeof component === 'number' && Number.isFinite(component))
}

function freezeVec3(value: Cinema2Vector3): Cinema2Vector3 {
  return Object.freeze([value[0], value[1], value[2]]) as Cinema2Vector3
}

function freezeFrame(value: Cinema2LightingEnvironmentFrame): Readonly<Cinema2LightingEnvironmentFrame> {
  return Object.freeze({
    quality: value.quality,
    lights: Object.freeze([...value.lights]),
    omittedLightCount: value.omittedLightCount,
    environment: value.environment,
  })
}

function finite(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

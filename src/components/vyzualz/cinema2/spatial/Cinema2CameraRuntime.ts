import type {
  Cinema2CameraControlBindingsManifest,
  Cinema2CameraId,
  Cinema2CameraManifest,
  Cinema2CameraPathPointManifest,
  Cinema2CameraProjection,
  Cinema2CameraRigManifest,
  Cinema2ParameterId,
  Cinema2Vector3,
} from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'
import type { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import type {
  Cinema2FinalValueResolver,
  Cinema2TargetHandle,
  Cinema2TargetId,
} from '../parameters/Cinema2TargetRuntime'
import type { Cinema2CompiledPresetPlan } from '../presets/Cinema2PresetCompiler'
import {
  multiplyCinema2Matrix4,
  type Cinema2Matrix4,
} from '../scene/Cinema2SceneGraph'
import type { Cinema2SpatialRuntime } from './Cinema2SpatialRuntime'

export const CINEMA2_CAMERA_RUNTIME_VERSION = 1 as const

export type Cinema2CameraRuntimeSource = 'authored' | 'implicit-safe'
export type Cinema2CameraRigKind = 'static' | 'orbit' | 'path' | 'fly'

export interface Cinema2CameraFrame {
  version: typeof CINEMA2_CAMERA_RUNTIME_VERSION
  cameraId: Cinema2CameraId | null
  source: Cinema2CameraRuntimeSource
  projection: Cinema2CameraProjection
  rig: Cinema2CameraRigKind
  position: Cinema2Vector3
  target: Cinema2Vector3
  fovDegrees: number
  orthographicHeight: number
  near: number
  far: number
  aspect: number
  viewMatrix: Cinema2Matrix4
  projectionMatrix: Cinema2Matrix4
  viewProjectionMatrix: Cinema2Matrix4
  corrected: boolean
}

export interface Cinema2CameraRuntimeSnapshot {
  disposed: boolean
  frameCount: number
  resetCount: number
  activeCameraId: Cinema2CameraId | null
  camera: Readonly<Cinema2CameraFrame>
}

interface CameraTargetSet {
  position: Cinema2TargetId | null
  target: Cinema2TargetId | null
  fovDegrees: Cinema2TargetId | null
  orthographicHeight: Cinema2TargetId | null
  near: Cinema2TargetId | null
  far: Cinema2TargetId | null
}

interface CameraPose {
  position: Cinema2Vector3
  target: Cinema2Vector3
  fovDegrees: number
  orthographicHeight: number
  near: number
  far: number
}

interface CameraSafety {
  minPosition: Cinema2Vector3
  maxPosition: Cinema2Vector3
  maxPositionOffset: Cinema2Vector3
  maxTargetOffset: Cinema2Vector3
  minFovDegrees: number
  maxFovDegrees: number
  minNear: number
  maxFar: number
}

const DEFAULT_POSITION = Object.freeze([0, 0, 5]) as Cinema2Vector3
const DEFAULT_TARGET = Object.freeze([0, 0, 0]) as Cinema2Vector3
const DEFAULT_ORTHOGRAPHIC_HEIGHT = 5
const DEFAULT_FOV_DEGREES = 50
const DEFAULT_NEAR = 0.1
const DEFAULT_FAR = 1000
const DEFAULT_SAFETY: Readonly<CameraSafety> = Object.freeze({
  minPosition: Object.freeze([-1000, -1000, -1000]) as Cinema2Vector3,
  maxPosition: Object.freeze([1000, 1000, 1000]) as Cinema2Vector3,
  maxPositionOffset: Object.freeze([20, 20, 20]) as Cinema2Vector3,
  maxTargetOffset: Object.freeze([20, 20, 20]) as Cinema2Vector3,
  minFovDegrees: 1,
  maxFovDegrees: 179,
  minNear: 0.0001,
  maxFar: 10000,
})
const EPSILON = 1e-5

/**
 * Final semantic world-camera authority for Cinema 2.0.
 *
 * Resolution order is intentionally fixed: authored base rig -> authored
 * transition -> bounded user controls/offsets -> shared target/choreography
 * contributions -> safety clamp -> smoothing -> final view/projection matrices.
 * Screen-space effects never participate in this service.
 */
export class Cinema2CameraRuntime {
  private readonly authoredCamera: Readonly<Cinema2CameraManifest> | null
  private readonly targets: CameraTargetSet
  private previousPose: CameraPose | null = null
  private currentFrame: Readonly<Cinema2CameraFrame>
  private frameCount = 0
  private resetCount = 0
  private disposed = false

  constructor(
    plan: Readonly<Cinema2CompiledPresetPlan>,
    private readonly parameters: Cinema2ParameterState,
    private readonly resolver: Cinema2FinalValueResolver,
    private readonly spatial: Cinema2SpatialRuntime,
  ) {
    this.authoredCamera = selectAuthoredCamera(plan)
    this.targets = indexCameraTargets(plan.targets.targets, this.authoredCamera?.id ?? null)
    this.currentFrame = createImplicitSafeFrame(1)
  }

  update(frame: Readonly<Cinema2ModuleFrameReadContext>): Readonly<Cinema2CameraFrame> {
    if (this.disposed) return this.currentFrame
    if (frame.audio?.discontinuity.occurred && frame.audio.discontinuity.reason !== 'activation') {
      this.previousPose = null
      this.resetCount += 1
    }

    const aspect = safeAspect(frame.viewport.width, frame.viewport.height)
    if (!this.authoredCamera) {
      this.currentFrame = createImplicitSafeFrame(aspect)
      this.frameCount += 1
      return this.currentFrame
    }

    const camera = this.authoredCamera
    const safety = resolveSafety(camera)
    let pose = this.resolveBaseRig(camera, frame)
    pose = applyAuthoredTransition(camera, pose, frame.elapsedTimeSec)
    const safetyReference = clonePose(pose)
    pose = this.applyUserControls(camera, pose, safety)
    pose = this.applyTargetContributions(pose)
    const safe = clampPose(pose, safety, safetyReference)
    const smoothingMs = resolveSmoothingMs(camera, this.parameters)
    const smoothed = this.previousPose && smoothingMs > 0
      ? smoothPose(this.previousPose, safe.pose, frame.deltaTimeSec, smoothingMs)
      : safe.pose
    const finalSafety = clampPose(smoothed, safety, safetyReference)
    this.previousPose = clonePose(finalSafety.pose)

    const viewMatrix = createLookAtMatrix(finalSafety.pose.position, finalSafety.pose.target)
    const projectionMatrix = camera.projection === 'perspective'
      ? createPerspectiveMatrix(finalSafety.pose.fovDegrees, aspect, finalSafety.pose.near, finalSafety.pose.far)
      : createOrthographicMatrix(finalSafety.pose.orthographicHeight, aspect, finalSafety.pose.near, finalSafety.pose.far)

    this.currentFrame = Object.freeze({
      version: CINEMA2_CAMERA_RUNTIME_VERSION,
      cameraId: camera.id,
      source: 'authored' as const,
      projection: camera.projection,
      rig: camera.rig?.kind ?? 'static',
      position: finalSafety.pose.position,
      target: finalSafety.pose.target,
      fovDegrees: finalSafety.pose.fovDegrees,
      orthographicHeight: finalSafety.pose.orthographicHeight,
      near: finalSafety.pose.near,
      far: finalSafety.pose.far,
      aspect,
      viewMatrix,
      projectionMatrix,
      viewProjectionMatrix: multiplyCinema2Matrix4(projectionMatrix, viewMatrix),
      corrected: safe.corrected || finalSafety.corrected,
    })
    this.frameCount += 1
    return this.currentFrame
  }

  reset(): void {
    if (this.disposed) return
    this.previousPose = null
    this.resetCount += 1
  }

  getFrame(): Readonly<Cinema2CameraFrame> {
    return this.currentFrame
  }

  getSnapshot(): Readonly<Cinema2CameraRuntimeSnapshot> {
    return Object.freeze({
      disposed: this.disposed,
      frameCount: this.frameCount,
      resetCount: this.resetCount,
      activeCameraId: this.authoredCamera?.id ?? null,
      camera: this.currentFrame,
    })
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.previousPose = null
  }

  private resolveBaseRig(
    camera: Readonly<Cinema2CameraManifest>,
    frame: Readonly<Cinema2ModuleFrameReadContext>,
  ): CameraPose {
    const authoredPosition = freezeVec3(camera.transform?.position ?? DEFAULT_POSITION)
    const authoredTarget = resolveAuthoredTarget(camera, authoredPosition, this.spatial)
    const rig = camera.rig ?? ({ kind: 'static' } satisfies Cinema2CameraRigManifest)
    const fovDegrees = finite(camera.fovDegrees, DEFAULT_FOV_DEGREES)
    const orthographicHeight = positive(camera.orthographicHeight, DEFAULT_ORTHOGRAPHIC_HEIGHT)
    const near = positive(camera.near, DEFAULT_NEAR)
    const far = Math.max(near + EPSILON, positive(camera.far, DEFAULT_FAR))

    if (rig.kind === 'orbit') {
      const radius = positive(readNumberControl(camera.controls, 'orbitRadius', this.parameters), positive(rig.radius, distance(authoredPosition, authoredTarget) || 5))
      const azimuth = finite(readNumberControl(camera.controls, 'orbitAzimuthDegrees', this.parameters), finite(rig.azimuthDegrees, 0))
        + finite(rig.angularVelocityDegreesPerSecond, 0) * Math.max(0, frame.elapsedTimeSec)
      const elevation = clamp(finite(readNumberControl(camera.controls, 'orbitElevationDegrees', this.parameters), finite(rig.elevationDegrees, 15)), -89.9, 89.9)
      const azimuthRad = degreesToRadians(azimuth)
      const elevationRad = degreesToRadians(elevation)
      const horizontal = radius * Math.cos(elevationRad)
      return {
        position: freezeVec3([
          authoredTarget[0] + Math.sin(azimuthRad) * horizontal,
          authoredTarget[1] + Math.sin(elevationRad) * radius,
          authoredTarget[2] + Math.cos(azimuthRad) * horizontal,
        ]),
        target: authoredTarget,
        fovDegrees,
        orthographicHeight,
        near,
        far,
      }
    }

    if (rig.kind === 'path' || rig.kind === 'fly') {
      const progressControl = readNumberControl(camera.controls, 'pathProgress', this.parameters)
      const progress = progressControl == null
        ? pathProgress(rig, frame.elapsedTimeSec)
        : clamp(progressControl, 0, 1)
      const sampled = samplePath(rig.points, progress, authoredTarget, fovDegrees)
      return {
        position: sampled.position,
        target: sampled.target,
        fovDegrees: sampled.fovDegrees,
        orthographicHeight,
        near,
        far,
      }
    }

    return { position: authoredPosition, target: authoredTarget, fovDegrees, orthographicHeight, near, far }
  }

  private applyUserControls(
    camera: Readonly<Cinema2CameraManifest>,
    pose: CameraPose,
    safety: Readonly<CameraSafety>,
  ): CameraPose {
    const positionOffset = clampOffset(readVec3Control(camera.controls, 'positionOffset', this.parameters), safety.maxPositionOffset)
    const targetOffset = clampOffset(readVec3Control(camera.controls, 'targetOffset', this.parameters), safety.maxTargetOffset)
    const fovControl = readNumberControl(camera.controls, 'fovDegrees', this.parameters)
    return {
      ...pose,
      position: addVec3(pose.position, positionOffset),
      target: addVec3(pose.target, targetOffset),
      fovDegrees: fovControl == null ? pose.fovDegrees : fovControl,
    }
  }

  private applyTargetContributions(pose: CameraPose): CameraPose {
    return {
      position: resolveVec3FromBase(this.resolver, this.targets.position, pose.position),
      target: resolveVec3FromBase(this.resolver, this.targets.target, pose.target),
      fovDegrees: resolveNumberFromBase(this.resolver, this.targets.fovDegrees, pose.fovDegrees),
      orthographicHeight: resolveNumberFromBase(this.resolver, this.targets.orthographicHeight, pose.orthographicHeight),
      near: resolveNumberFromBase(this.resolver, this.targets.near, pose.near),
      far: resolveNumberFromBase(this.resolver, this.targets.far, pose.far),
    }
  }
}

function selectAuthoredCamera(plan: Readonly<Cinema2CompiledPresetPlan>): Readonly<Cinema2CameraManifest> | null {
  const cameras = plan.manifest.cameras ?? []
  if (cameras.length === 0) return null
  const requested = plan.manifest.defaults?.camera?.$ref
  return cameras.find(camera => camera.id === requested) ?? cameras[0] ?? null
}

function indexCameraTargets(
  targets: readonly Readonly<Cinema2TargetHandle>[],
  cameraId: Cinema2CameraId | null,
): CameraTargetSet {
  const find = (property: string): Cinema2TargetId | null => cameraId == null
    ? null
    : targets.find(target => target.kind === 'camera' && target.ownerId === cameraId && target.property === property)?.id ?? null
  return {
    position: find('transform.position'),
    target: find('target'),
    fovDegrees: find('fovDegrees'),
    orthographicHeight: find('orthographicHeight'),
    near: find('near'),
    far: find('far'),
  }
}

function resolveAuthoredTarget(
  camera: Readonly<Cinema2CameraManifest>,
  position: Cinema2Vector3,
  spatial: Cinema2SpatialRuntime,
): Cinema2Vector3 {
  if (camera.targetNode) {
    const node = spatial.resolveNode(camera.targetNode.$ref)
    if (node) return freezeVec3(node.worldPosition)
  }
  if (camera.target) return freezeVec3(camera.target)
  const rotation = camera.transform?.rotation ?? [0, 0, 0]
  const forward = forwardFromEuler(rotation)
  return freezeVec3([position[0] + forward[0], position[1] + forward[1], position[2] + forward[2]])
}

function forwardFromEuler(rotation: Cinema2Vector3): Cinema2Vector3 {
  const pitch = finite(rotation[0], 0)
  const yaw = finite(rotation[1], 0)
  const cp = Math.cos(pitch)
  return freezeVec3([
    -Math.sin(yaw) * cp,
    Math.sin(pitch),
    -Math.cos(yaw) * cp,
  ])
}

function applyAuthoredTransition(
  camera: Readonly<Cinema2CameraManifest>,
  pose: CameraPose,
  elapsedTimeSec: number,
): CameraPose {
  const transition = camera.transition
  if (!transition) return pose
  let progress = clamp(Math.max(0, elapsedTimeSec) / Math.max(EPSILON, transition.durationSeconds), 0, 1)
  if ((transition.easing ?? 'smoothstep') === 'smoothstep') progress = progress * progress * (3 - 2 * progress)
  return {
    position: lerpVec3(transition.fromPosition ?? pose.position, pose.position, progress),
    target: lerpVec3(transition.fromTarget ?? pose.target, pose.target, progress),
    fovDegrees: lerp(finite(transition.fromFovDegrees, pose.fovDegrees), pose.fovDegrees, progress),
    orthographicHeight: pose.orthographicHeight,
    near: pose.near,
    far: pose.far,
  }
}

function pathProgress(rig: Extract<Cinema2CameraRigManifest, { kind: 'path' | 'fly' }>, elapsedTimeSec: number): number {
  const duration = rig.durationSeconds ?? pathLength(rig.points) / Math.max(EPSILON, positive(rig.speed, 1))
  const raw = Math.max(0, elapsedTimeSec) / Math.max(EPSILON, duration)
  if (rig.loop) return raw - Math.floor(raw)
  return clamp(raw, 0, 1)
}

function pathLength(points: readonly Cinema2CameraPathPointManifest[]): number {
  let total = 0
  for (let index = 1; index < points.length; index += 1) total += distance(points[index - 1].position, points[index].position)
  return Math.max(EPSILON, total)
}

function samplePath(
  points: readonly Cinema2CameraPathPointManifest[],
  progress: number,
  fallbackTarget: Cinema2Vector3,
  fallbackFov: number,
): Pick<CameraPose, 'position' | 'target' | 'fovDegrees'> {
  if (points.length === 0) return { position: DEFAULT_POSITION, target: fallbackTarget, fovDegrees: fallbackFov }
  if (points.length === 1) {
    const only = points[0]
    return { position: freezeVec3(only.position), target: freezeVec3(only.target ?? fallbackTarget), fovDegrees: finite(only.fovDegrees, fallbackFov) }
  }
  const scaled = clamp(progress, 0, 1) * (points.length - 1)
  const leftIndex = Math.min(points.length - 2, Math.floor(scaled))
  const local = clamp(scaled - leftIndex, 0, 1)
  const left = points[leftIndex]
  const right = points[leftIndex + 1]
  return {
    position: lerpVec3(left.position, right.position, local),
    target: lerpVec3(left.target ?? fallbackTarget, right.target ?? fallbackTarget, local),
    fovDegrees: lerp(finite(left.fovDegrees, fallbackFov), finite(right.fovDegrees, fallbackFov), local),
  }
}

function resolveSafety(camera: Readonly<Cinema2CameraManifest>): Readonly<CameraSafety> {
  const authored = camera.safety
  return Object.freeze({
    minPosition: freezeVec3(authored?.minPosition ?? DEFAULT_SAFETY.minPosition),
    maxPosition: freezeVec3(authored?.maxPosition ?? DEFAULT_SAFETY.maxPosition),
    maxPositionOffset: freezeVec3(authored?.maxPositionOffset ?? DEFAULT_SAFETY.maxPositionOffset),
    maxTargetOffset: freezeVec3(authored?.maxTargetOffset ?? DEFAULT_SAFETY.maxTargetOffset),
    minFovDegrees: positive(authored?.minFovDegrees, DEFAULT_SAFETY.minFovDegrees),
    maxFovDegrees: positive(authored?.maxFovDegrees, DEFAULT_SAFETY.maxFovDegrees),
    minNear: positive(authored?.minNear, DEFAULT_SAFETY.minNear),
    maxFar: positive(authored?.maxFar, DEFAULT_SAFETY.maxFar),
  })
}

function clampPose(
  pose: CameraPose,
  safety: Readonly<CameraSafety>,
  referencePose: Readonly<CameraPose>,
): { pose: CameraPose; corrected: boolean } {
  const position = freezeVec3([
    clampAroundReference(pose.position[0], referencePose.position[0], safety.maxPositionOffset[0], safety.minPosition[0], safety.maxPosition[0]),
    clampAroundReference(pose.position[1], referencePose.position[1], safety.maxPositionOffset[1], safety.minPosition[1], safety.maxPosition[1]),
    clampAroundReference(pose.position[2], referencePose.position[2], safety.maxPositionOffset[2], safety.minPosition[2], safety.maxPosition[2]),
  ])
  let target = freezeVec3([
    clampAroundReference(pose.target[0], referencePose.target[0], safety.maxTargetOffset[0]),
    clampAroundReference(pose.target[1], referencePose.target[1], safety.maxTargetOffset[1]),
    clampAroundReference(pose.target[2], referencePose.target[2], safety.maxTargetOffset[2]),
  ])
  const fovDegrees = clamp(finite(pose.fovDegrees, DEFAULT_FOV_DEGREES), safety.minFovDegrees, safety.maxFovDegrees)
  const orthographicHeight = Math.max(EPSILON, positive(pose.orthographicHeight, DEFAULT_ORTHOGRAPHIC_HEIGHT))
  const near = Math.max(safety.minNear, positive(pose.near, DEFAULT_NEAR))
  const far = Math.max(near + EPSILON, Math.min(safety.maxFar, positive(pose.far, DEFAULT_FAR)))
  if (distance(position, target) < EPSILON) target = freezeVec3([target[0], target[1], target[2] - 1])
  const corrected = !vecEqual(position, pose.position)
    || !vecEqual(target, pose.target)
    || fovDegrees !== pose.fovDegrees
    || orthographicHeight !== pose.orthographicHeight
    || near !== pose.near
    || far !== pose.far
  return { pose: { position, target, fovDegrees, orthographicHeight, near, far }, corrected }
}

function clampAroundReference(
  value: number,
  reference: number,
  maxOffset: number,
  absoluteMin = Number.NEGATIVE_INFINITY,
  absoluteMax = Number.POSITIVE_INFINITY,
): number {
  const limit = Math.abs(finite(maxOffset, 0))
  const relativeMin = reference - limit
  const relativeMax = reference + limit
  const minimum = Math.max(absoluteMin, relativeMin)
  const maximum = Math.min(absoluteMax, relativeMax)
  if (minimum <= maximum) return clamp(value, minimum, maximum)
  return clamp(value, absoluteMin, absoluteMax)
}

function resolveSmoothingMs(camera: Readonly<Cinema2CameraManifest>, parameters: Cinema2ParameterState): number {
  const control = readNumberControl(camera.controls, 'smoothingMs', parameters)
  return clamp(control ?? finite(camera.smoothingMs, 0), 0, 5000)
}

function smoothPose(previous: CameraPose, next: CameraPose, deltaTimeSec: number, smoothingMs: number): CameraPose {
  if (deltaTimeSec <= 0 || smoothingMs <= 0) return next
  const alpha = 1 - Math.exp(-(Math.max(0, deltaTimeSec) * 1000) / smoothingMs)
  return {
    position: lerpVec3(previous.position, next.position, alpha),
    target: lerpVec3(previous.target, next.target, alpha),
    fovDegrees: lerp(previous.fovDegrees, next.fovDegrees, alpha),
    orthographicHeight: lerp(previous.orthographicHeight, next.orthographicHeight, alpha),
    near: lerp(previous.near, next.near, alpha),
    far: lerp(previous.far, next.far, alpha),
  }
}

function readNumberControl(
  controls: Readonly<Cinema2CameraControlBindingsManifest> | undefined,
  name: keyof Cinema2CameraControlBindingsManifest,
  parameters: Cinema2ParameterState,
): number | null {
  const ref = controls?.[name]
  if (!ref) return null
  const value = parameters.getValue(ref.$ref as Cinema2ParameterId)
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function readVec3Control(
  controls: Readonly<Cinema2CameraControlBindingsManifest> | undefined,
  name: keyof Cinema2CameraControlBindingsManifest,
  parameters: Cinema2ParameterState,
): Cinema2Vector3 {
  const ref = controls?.[name]
  if (!ref) return freezeVec3([0, 0, 0])
  const value = parameters.getValue(ref.$ref as Cinema2ParameterId)
  return isVec3(value) ? freezeVec3(value) : freezeVec3([0, 0, 0])
}

function clampOffset(value: Cinema2Vector3, limits: Cinema2Vector3): Cinema2Vector3 {
  return freezeVec3([
    clamp(value[0], -Math.abs(limits[0]), Math.abs(limits[0])),
    clamp(value[1], -Math.abs(limits[1]), Math.abs(limits[1])),
    clamp(value[2], -Math.abs(limits[2]), Math.abs(limits[2])),
  ])
}

function resolveVec3FromBase(
  resolver: Cinema2FinalValueResolver,
  targetId: Cinema2TargetId | null,
  base: Cinema2Vector3,
): Cinema2Vector3 {
  if (!targetId) return base
  const resolved = resolver.resolveFromBase(targetId, base)
  return resolved.ok && isVec3(resolved.value) ? freezeVec3(resolved.value) : base
}

function resolveNumberFromBase(
  resolver: Cinema2FinalValueResolver,
  targetId: Cinema2TargetId | null,
  base: number,
): number {
  if (!targetId) return base
  const resolved = resolver.resolveFromBase(targetId, base)
  return resolved.ok && typeof resolved.value === 'number' && Number.isFinite(resolved.value) ? resolved.value : base
}

export function createCinema2PerspectiveProjection(
  fovDegrees: number,
  aspect: number,
  near: number,
  far: number,
): Cinema2Matrix4 {
  return createPerspectiveMatrix(fovDegrees, aspect, near, far)
}

export function createCinema2OrthographicProjection(
  verticalHeight: number,
  aspect: number,
  near: number,
  far: number,
): Cinema2Matrix4 {
  return createOrthographicMatrix(verticalHeight, aspect, near, far)
}

function createPerspectiveMatrix(fovDegrees: number, aspect: number, near: number, far: number): Cinema2Matrix4 {
  const safeNear = Math.max(EPSILON, near)
  const safeFar = Math.max(safeNear + EPSILON, far)
  const f = 1 / Math.tan(degreesToRadians(clamp(fovDegrees, 1, 179)) / 2)
  return Object.freeze([
    f / safeAspect(aspect, 1), 0, 0, 0,
    0, f, 0, 0,
    0, 0, (safeFar + safeNear) / (safeNear - safeFar), -1,
    0, 0, (2 * safeFar * safeNear) / (safeNear - safeFar), 0,
  ]) as Cinema2Matrix4
}

function createOrthographicMatrix(verticalHeight: number, aspect: number, near: number, far: number): Cinema2Matrix4 {
  const halfHeight = Math.max(EPSILON, verticalHeight) / 2
  const halfWidth = halfHeight * safeAspect(aspect, 1)
  const safeNear = Math.max(EPSILON, near)
  const safeFar = Math.max(safeNear + EPSILON, far)
  return Object.freeze([
    1 / halfWidth, 0, 0, 0,
    0, 1 / halfHeight, 0, 0,
    0, 0, -2 / (safeFar - safeNear), 0,
    0, 0, -(safeFar + safeNear) / (safeFar - safeNear), 1,
  ]) as Cinema2Matrix4
}

function createLookAtMatrix(position: Cinema2Vector3, target: Cinema2Vector3): Cinema2Matrix4 {
  const forward = normalizeVec3(subVec3(position, target), [0, 0, 1])
  let right = normalizeVec3(crossVec3([0, 1, 0], forward), [1, 0, 0])
  if (lengthVec3(right) < EPSILON) right = normalizeVec3(crossVec3([0, 0, 1], forward), [1, 0, 0])
  const up = crossVec3(forward, right)
  return Object.freeze([
    right[0], up[0], forward[0], 0,
    right[1], up[1], forward[1], 0,
    right[2], up[2], forward[2], 0,
    -dotVec3(right, position), -dotVec3(up, position), -dotVec3(forward, position), 1,
  ]) as Cinema2Matrix4
}

function createImplicitSafeFrame(aspect: number): Readonly<Cinema2CameraFrame> {
  const position = freezeVec3([0, 0, 50])
  const target = freezeVec3(DEFAULT_TARGET)
  const viewMatrix = createLookAtMatrix(position, target)
  const projectionMatrix = createOrthographicMatrix(DEFAULT_ORTHOGRAPHIC_HEIGHT, aspect, DEFAULT_NEAR, 100)
  return Object.freeze({
    version: CINEMA2_CAMERA_RUNTIME_VERSION,
    cameraId: null,
    source: 'implicit-safe' as const,
    projection: 'orthographic' as const,
    rig: 'static' as const,
    position,
    target,
    fovDegrees: DEFAULT_FOV_DEGREES,
    orthographicHeight: DEFAULT_ORTHOGRAPHIC_HEIGHT,
    near: DEFAULT_NEAR,
    far: 100,
    aspect,
    viewMatrix,
    projectionMatrix,
    viewProjectionMatrix: multiplyCinema2Matrix4(projectionMatrix, viewMatrix),
    corrected: false,
  })
}

function addVec3(left: Cinema2Vector3, right: Cinema2Vector3): Cinema2Vector3 {
  return freezeVec3([left[0] + right[0], left[1] + right[1], left[2] + right[2]])
}

function subVec3(left: Cinema2Vector3, right: Cinema2Vector3): Cinema2Vector3 {
  return freezeVec3([left[0] - right[0], left[1] - right[1], left[2] - right[2]])
}

function crossVec3(left: Cinema2Vector3, right: Cinema2Vector3): Cinema2Vector3 {
  return freezeVec3([
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0],
  ])
}

function dotVec3(left: Cinema2Vector3, right: Cinema2Vector3): number {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2]
}

function lengthVec3(value: Cinema2Vector3): number {
  return Math.hypot(value[0], value[1], value[2])
}

function normalizeVec3(value: Cinema2Vector3, fallback: Cinema2Vector3): Cinema2Vector3 {
  const length = lengthVec3(value)
  if (!Number.isFinite(length) || length < EPSILON) return freezeVec3(fallback)
  return freezeVec3([value[0] / length, value[1] / length, value[2] / length])
}

function distance(left: Cinema2Vector3, right: Cinema2Vector3): number {
  return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2])
}

function lerpVec3(left: Cinema2Vector3, right: Cinema2Vector3, amount: number): Cinema2Vector3 {
  return freezeVec3([
    lerp(left[0], right[0], amount),
    lerp(left[1], right[1], amount),
    lerp(left[2], right[2], amount),
  ])
}

function lerp(left: number, right: number, amount: number): number {
  return left + (right - left) * clamp(amount, 0, 1)
}

function freezeVec3(value: readonly number[]): Cinema2Vector3 {
  return Object.freeze([finite(value[0], 0), finite(value[1], 0), finite(value[2], 0)]) as Cinema2Vector3
}

function clonePose(pose: CameraPose): CameraPose {
  return {
    position: freezeVec3(pose.position),
    target: freezeVec3(pose.target),
    fovDegrees: pose.fovDegrees,
    orthographicHeight: pose.orthographicHeight,
    near: pose.near,
    far: pose.far,
  }
}

function isVec3(value: unknown): value is Cinema2Vector3 {
  return Array.isArray(value) && value.length === 3 && value.every(component => typeof component === 'number' && Number.isFinite(component))
}

function vecEqual(left: Cinema2Vector3, right: Cinema2Vector3): boolean {
  return left.every((value, index) => Math.abs(value - right[index]) < 1e-9)
}

function safeAspect(width: number, height: number): number {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return 1
  return Math.max(EPSILON, width / height)
}

function degreesToRadians(value: number): number {
  return value * Math.PI / 180
}

function positive(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
}

function finite(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

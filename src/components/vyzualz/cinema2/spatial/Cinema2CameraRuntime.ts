import type {
  Cinema2CameraControlBindingsManifest,
  Cinema2CameraId,
  Cinema2CameraManifest,
  Cinema2CameraMotionManifest,
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
  /** Final camera roll in degrees (fixed roll + drift + choreography + bank). 0 for cameras without `motion`. */
  rollDegrees: number
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
  roll: Cinema2TargetId | null
}

interface CameraPose {
  position: Cinema2Vector3
  target: Cinema2Vector3
  fovDegrees: number
  orthographicHeight: number
  near: number
  far: number
  rollDegrees: number
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
const MAX_ROLL_DEGREES = 45
/** Position bound on axes an endless path travels along (about a day at 10 units per second). */
const REPEAT_TRAVEL_LIMIT = 1e9
/** Below this horizontal speed (units/s) heading is meaningless, so bank relaxes toward level. */
const MIN_BANK_SPEED = 0.02
const SPLINE_SAMPLES_PER_SEGMENT = 200

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
  /** Pre-drift position last frame: bank follows the rig's own heading, not the handheld wander. */
  private previousBasePosition: Cinema2Vector3 | null = null
  private previousHeadingDegrees: number | null = null
  private bankDegrees = 0
  private splinePath: Readonly<SplinePath> | null = null
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
      this.resetMotionState()
      this.resetCount += 1
    }

    const aspect = safeAspect(frame.viewport.width, frame.viewport.height)
    if (!this.authoredCamera) {
      this.currentFrame = createImplicitSafeFrame(aspect)
      this.frameCount += 1
      return this.currentFrame
    }

    const camera = this.authoredCamera
    const motion = camera.motion
    const safety = resolveSafety(camera)
    let pose = this.resolveBaseRig(camera, frame)
    pose = applyAuthoredTransition(camera, pose, frame.elapsedTimeSec)
    const safetyReference = clonePose(pose)
    pose = this.applyUserControls(camera, pose, safety)
    pose = this.applyTargetContributions(pose)
    const basePosition = pose.position
    const motionAmount = clamp(finite(readNumberControl(camera.controls, 'motionAmount', this.parameters) ?? undefined, 1), 0, 2)
    if (motion?.drift) pose = applyDrift(pose, motion.drift, frame.elapsedTimeSec, motionAmount)
    const safe = clampPose(pose, safety, safetyReference)
    const smoothingMs = resolveSmoothingMs(camera, this.parameters)
    let smoothed = this.previousPose && smoothingMs > 0
      ? smoothPose(this.previousPose, safe.pose, frame.deltaTimeSec, smoothingMs)
      : safe.pose
    if (motion?.fovRateLimitDegreesPerSecond != null && this.previousPose) {
      smoothed = { ...smoothed, fovDegrees: limitRate(this.previousPose.fovDegrees, smoothed.fovDegrees, motion.fovRateLimitDegreesPerSecond, frame.deltaTimeSec) }
    }
    const finalSafety = clampPose(smoothed, safety, safetyReference)
    this.previousPose = clonePose(finalSafety.pose)
    const bank = motion?.bank ? this.updateBank(motion.bank, basePosition, frame.deltaTimeSec, motionAmount) : 0
    const rollDegrees = clamp(finalSafety.pose.rollDegrees + bank, -MAX_ROLL_DEGREES, MAX_ROLL_DEGREES)

    const viewMatrix = createLookAtMatrix(finalSafety.pose.position, finalSafety.pose.target, rollDegrees)
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
      rollDegrees,
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
    this.resetMotionState()
    this.resetCount += 1
  }

  private resetMotionState(): void {
    this.previousPose = null
    this.previousBasePosition = null
    this.previousHeadingDegrees = null
    this.bankDegrees = 0
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
    this.resetMotionState()
  }

  /**
   * Bank follows the rig's own heading change: the horizontal direction of travel is differentiated,
   * scaled into a target bank angle and smoothed. A camera moving in a straight line (or standing
   * still) relaxes back to level. Positive bank leans the camera to its right, into a right turn.
   */
  private updateBank(
    bank: Readonly<NonNullable<Cinema2CameraMotionManifest['bank']>>,
    basePosition: Cinema2Vector3,
    deltaTimeSec: number,
    amount: number,
  ): number {
    const previous = this.previousBasePosition
    this.previousBasePosition = basePosition
    let headingRate = 0
    if (previous && deltaTimeSec > 0 && deltaTimeSec < 0.5) {
      const vx = basePosition[0] - previous[0]
      const vz = basePosition[2] - previous[2]
      if (Math.hypot(vx, vz) / deltaTimeSec > MIN_BANK_SPEED) {
        const heading = radiansToDegrees(Math.atan2(vx, -vz))
        if (this.previousHeadingDegrees != null) headingRate = wrapDegrees(heading - this.previousHeadingDegrees) / deltaTimeSec
        this.previousHeadingDegrees = heading
      }
    }
    const limit = Math.abs(finite(bank.maxDegrees, 0)) * amount
    const target = clamp(finite(bank.gain, 0.6) * headingRate, -limit, limit)
    const smoothingMs = clamp(finite(bank.smoothingMs, 500), 0, 5000)
    if (deltaTimeSec <= 0) return this.bankDegrees
    this.bankDegrees = smoothingMs <= 0
      ? target
      : this.bankDegrees + (target - this.bankDegrees) * (1 - Math.exp(-(deltaTimeSec * 1000) / smoothingMs))
    return this.bankDegrees
  }

  private getSplinePath(camera: Readonly<Cinema2CameraManifest>, fallbackTarget: Cinema2Vector3, fallbackFov: number): Readonly<SplinePath> | null {
    const rig = camera.rig
    if (!rig || (rig.kind !== 'path' && rig.kind !== 'fly') || camera.motion?.interpolation !== 'spline' || rig.points.length < 2) return null
    if (!this.splinePath) this.splinePath = buildSplinePath(rig, fallbackTarget, fallbackFov)
    return this.splinePath
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
    const rollDegrees = finite(camera.motion?.rollDegrees, 0)

    if (rig.kind === 'orbit') {
      const radius = positive(readNumberControl(camera.controls, 'orbitRadius', this.parameters) ?? undefined, positive(rig.radius, distance(authoredPosition, authoredTarget) || 5))
      const azimuth = finite(readNumberControl(camera.controls, 'orbitAzimuthDegrees', this.parameters) ?? undefined, finite(rig.azimuthDegrees, 0))
        + finite(rig.angularVelocityDegreesPerSecond, 0) * Math.max(0, frame.elapsedTimeSec)
      const elevation = clamp(finite(readNumberControl(camera.controls, 'orbitElevationDegrees', this.parameters) ?? undefined, finite(rig.elevationDegrees, 15)), -89.9, 89.9)
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
        rollDegrees,
      }
    }

    if (rig.kind === 'path' || rig.kind === 'fly') {
      const spline = this.getSplinePath(camera, authoredTarget, fovDegrees)
      const constantSpeed = camera.motion?.constantSpeed ?? true
      const progressControl = readNumberControl(camera.controls, 'pathProgress', this.parameters)
      const progress = progressControl == null
        ? pathProgress(rig, frame.elapsedTimeSec, spline?.totalLength)
        : clamp(progressControl, 0, 1)
      const lap = spline?.repeatOffset && progressControl == null ? pathLap(rig, frame.elapsedTimeSec, spline.totalLength) : 0
      const sampled = spline
        ? sampleSplinePath(spline, progress, constantSpeed, lap)
        : samplePath(rig.points, progress, authoredTarget, fovDegrees)
      return {
        position: sampled.position,
        target: sampled.target,
        fovDegrees: sampled.fovDegrees,
        orthographicHeight,
        near,
        far,
        rollDegrees,
      }
    }

    return { position: authoredPosition, target: authoredTarget, fovDegrees, orthographicHeight, near, far, rollDegrees }
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
      rollDegrees: resolveNumberFromBase(this.resolver, this.targets.roll, pose.rollDegrees),
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
    roll: find('roll'),
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
    rollDegrees: pose.rollDegrees,
  }
}

function pathProgress(rig: Extract<Cinema2CameraRigManifest, { kind: 'path' | 'fly' }>, elapsedTimeSec: number, splineLength?: number): number {
  const duration = rig.durationSeconds ?? (splineLength ?? pathLength(rig.points)) / Math.max(EPSILON, positive(rig.speed, 1))
  const raw = Math.max(0, elapsedTimeSec) / Math.max(EPSILON, duration)
  if (rig.loop) return raw - Math.floor(raw)
  return clamp(raw, 0, 1)
}

/** Completed laps of a looping path, so a `repeatOffset` can translate each one. */
function pathLap(rig: Extract<Cinema2CameraRigManifest, { kind: 'path' | 'fly' }>, elapsedTimeSec: number, splineLength: number): number {
  const duration = rig.durationSeconds ?? splineLength / Math.max(EPSILON, positive(rig.speed, 1))
  return Math.floor(Math.max(0, elapsedTimeSec) / Math.max(EPSILON, duration))
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
  const minPosition = freezeVec3(authored?.minPosition ?? DEFAULT_SAFETY.minPosition)
  const maxPosition = freezeVec3(authored?.maxPosition ?? DEFAULT_SAFETY.maxPosition)
  // Endless travel would otherwise walk into the absolute position clamp: lift it on the axes the lap offset moves along.
  const repeat = camera.rig && (camera.rig.kind === 'path' || camera.rig.kind === 'fly') ? camera.rig.repeatOffset : undefined
  const lift = (bound: Cinema2Vector3, sign: 1 | -1): Cinema2Vector3 => repeat
    ? freezeVec3(bound.map((value, axis) => repeat[axis] !== 0 ? sign * REPEAT_TRAVEL_LIMIT : value))
    : bound
  return Object.freeze({
    minPosition: lift(minPosition, -1),
    maxPosition: lift(maxPosition, 1),
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
  const rollDegrees = clamp(finite(pose.rollDegrees, 0), -MAX_ROLL_DEGREES, MAX_ROLL_DEGREES)
  if (distance(position, target) < EPSILON) target = freezeVec3([target[0], target[1], target[2] - 1])
  const corrected = !vecEqual(position, pose.position)
    || !vecEqual(target, pose.target)
    || fovDegrees !== pose.fovDegrees
    || orthographicHeight !== pose.orthographicHeight
    || near !== pose.near
    || far !== pose.far
    || rollDegrees !== pose.rollDegrees
  return { pose: { position, target, fovDegrees, orthographicHeight, near, far, rollDegrees }, corrected }
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
    rollDegrees: lerp(previous.rollDegrees, next.rollDegrees, alpha),
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

function createLookAtMatrix(position: Cinema2Vector3, target: Cinema2Vector3, rollDegrees = 0): Cinema2Matrix4 {
  const forward = normalizeVec3(subVec3(position, target), [0, 0, 1])
  let level = normalizeVec3(crossVec3([0, 1, 0], forward), [1, 0, 0])
  if (lengthVec3(level) < EPSILON) level = normalizeVec3(crossVec3([0, 0, 1], forward), [1, 0, 0])
  const levelUp = crossVec3(forward, level)
  // Positive roll leans the camera's up toward its right (a right bank).
  const roll = degreesToRadians(rollDegrees)
  const cosine = Math.cos(roll)
  const sine = Math.sin(roll)
  const right = freezeVec3([level[0] * cosine - levelUp[0] * sine, level[1] * cosine - levelUp[1] * sine, level[2] * cosine - levelUp[2] * sine])
  const up = freezeVec3([levelUp[0] * cosine + level[0] * sine, levelUp[1] * cosine + level[1] * sine, levelUp[2] * cosine + level[2] * sine])
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
    rollDegrees: 0,
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
    rollDegrees: pose.rollDegrees,
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

function radiansToDegrees(value: number): number {
  return value * 180 / Math.PI
}

function wrapDegrees(value: number): number {
  return ((((value + 180) % 360) + 360) % 360) - 180
}

/** Moves `previous` toward `next` by at most `ratePerSecond * deltaTimeSec`. */
function limitRate(previous: number, next: number, ratePerSecond: number, deltaTimeSec: number): number {
  if (!(deltaTimeSec > 0) || deltaTimeSec >= 1) return next
  const limit = Math.max(0, ratePerSecond) * deltaTimeSec
  return previous + clamp(next - previous, -limit, limit)
}

// ── Drift ─────────────────────────────────────────────────────────────────────────────────────
const DRIFT_RATIOS = Object.freeze([1, 1.618, 2.414])

function hash01(value: number): number {
  const x = Math.sin(value * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}

/**
 * Smooth, deterministic wander in [-1, 1]: three incommensurate sine waves with phases derived from
 * the seed and channel. A pure function of time, so exports and scrubbing reproduce the same motion.
 */
export function cinema2CameraDriftNoise(timeSec: number, speed: number, seed: number, channel: number): number {
  const base = 2 * Math.PI * speed * timeSec
  let sum = 0
  let weightTotal = 0
  DRIFT_RATIOS.forEach((ratio, index) => {
    const weight = 1 / (1 + index * 0.7)
    sum += weight * Math.sin(base * ratio + hash01(seed * 7.13 + channel * 3.71 + index * 1.91) * 2 * Math.PI)
    weightTotal += weight
  })
  return sum / weightTotal
}

function applyDrift(
  pose: CameraPose,
  drift: Readonly<NonNullable<Cinema2CameraMotionManifest['drift']>>,
  elapsedTimeSec: number,
  amount: number,
): CameraPose {
  const speed = positive(drift.speed, 0.08)
  const seed = finite(drift.seed, 0)
  const time = Math.max(0, elapsedTimeSec)
  const noise = (channel: number) => cinema2CameraDriftNoise(time, speed, seed, channel)
  const positionAmplitude = Math.max(0, finite(drift.position, 0)) * amount
  const targetAmplitude = Math.max(0, finite(drift.target, 0)) * amount
  return {
    ...pose,
    position: addVec3(pose.position, freezeVec3([noise(0) * positionAmplitude, noise(1) * positionAmplitude * 0.6, noise(2) * positionAmplitude])),
    target: addVec3(pose.target, freezeVec3([noise(3) * targetAmplitude, noise(4) * targetAmplitude * 0.6, noise(5) * targetAmplitude])),
    rollDegrees: pose.rollDegrees + noise(6) * Math.max(0, finite(drift.rollDegrees, 0)) * amount,
    fovDegrees: pose.fovDegrees + noise(7) * Math.max(0, finite(drift.fovDegrees, 0)) * amount,
  }
}

// ── Spline paths ──────────────────────────────────────────────────────────────────────────────
interface SplinePath {
  positions: readonly Cinema2Vector3[]
  targets: readonly Cinema2Vector3[]
  fovs: readonly number[]
  loop: boolean
  /** Per-lap translation of positions and targets; null for ordinary loops. */
  repeatOffset: Cinema2Vector3 | null
  segments: number
  /** Cumulative arc length of the position curve at `u = index / SPLINE_SAMPLES_PER_SEGMENT`. */
  arcLengths: Float64Array
  totalLength: number
}

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t
  const t3 = t2 * t
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
}

function splineIndex(index: number, count: number, loop: boolean): number {
  return loop ? ((index % count) + count) % count : clamp(index, 0, count - 1)
}

/**
 * Catmull-Rom sample of a point list. With a `repeatOffset`, control points read past either end of a
 * lap are the wrapped point translated by the offset once per wrap, so tangents stay continuous across laps.
 */
function evaluateSpline<T extends number | Cinema2Vector3>(
  values: readonly T[],
  loop: boolean,
  segments: number,
  u: number,
  repeatOffset: Cinema2Vector3 | null = null,
): T {
  const count = values.length
  const clampedU = clamp(u, 0, segments)
  const segment = Math.min(segments - 1, Math.floor(clampedU))
  const t = clampedU - segment
  const at = (offset: number): T => {
    const index = segment + offset
    const value = values[splineIndex(index, count, loop)]
    if (!repeatOffset || typeof value === 'number') return value
    const wraps = Math.floor(index / count)
    return wraps === 0 ? value : (freezeVec3([
      (value as Cinema2Vector3)[0] + repeatOffset[0] * wraps,
      (value as Cinema2Vector3)[1] + repeatOffset[1] * wraps,
      (value as Cinema2Vector3)[2] + repeatOffset[2] * wraps,
    ]) as T)
  }
  const [a, b, c, d] = [at(-1), at(0), at(1), at(2)]
  if (typeof b === 'number') return catmullRom(a as number, b, c as number, d as number, t) as T
  const v = (i: number) => catmullRom((a as Cinema2Vector3)[i], (b as Cinema2Vector3)[i], (c as Cinema2Vector3)[i], (d as Cinema2Vector3)[i], t)
  return freezeVec3([v(0), v(1), v(2)]) as T
}

function buildSplinePath(
  rig: Extract<Cinema2CameraRigManifest, { kind: 'path' | 'fly' }>,
  fallbackTarget: Cinema2Vector3,
  fallbackFov: number,
): Readonly<SplinePath> {
  const loop = rig.loop === true
  const repeatOffset = loop && rig.repeatOffset ? freezeVec3(rig.repeatOffset) : null
  const positions = rig.points.map(point => freezeVec3(point.position))
  const targets = rig.points.map(point => freezeVec3(point.target ?? fallbackTarget))
  const fovs = rig.points.map(point => finite(point.fovDegrees, fallbackFov))
  const segments = loop ? positions.length : positions.length - 1
  const samples = segments * SPLINE_SAMPLES_PER_SEGMENT
  const arcLengths = new Float64Array(samples + 1)
  let previous = evaluateSpline(positions, loop, segments, 0, repeatOffset)
  for (let index = 1; index <= samples; index += 1) {
    const point = evaluateSpline(positions, loop, segments, index / SPLINE_SAMPLES_PER_SEGMENT, repeatOffset)
    arcLengths[index] = arcLengths[index - 1] + distance(previous, point)
    previous = point
  }
  return Object.freeze({ positions, targets, fovs, loop, repeatOffset, segments, arcLengths, totalLength: Math.max(EPSILON, arcLengths[samples]) })
}

/** Inverse of the arc-length table: the spline parameter `u` at a given travelled distance. */
function splineParameterAtLength(path: Readonly<SplinePath>, length: number): number {
  const table = path.arcLengths
  const clamped = clamp(length, 0, path.totalLength)
  let low = 0
  let high = table.length - 1
  while (high - low > 1) {
    const mid = (low + high) >> 1
    if (table[mid] <= clamped) low = mid
    else high = mid
  }
  const span = table[high] - table[low]
  const fraction = span > EPSILON ? (clamped - table[low]) / span : 0
  return (low + fraction) / SPLINE_SAMPLES_PER_SEGMENT
}

function sampleSplinePath(
  path: Readonly<SplinePath>,
  progress: number,
  constantSpeed: boolean,
  lap = 0,
): Pick<CameraPose, 'position' | 'target' | 'fovDegrees'> {
  const p = clamp(progress, 0, 1)
  const u = constantSpeed ? splineParameterAtLength(path, p * path.totalLength) : p * path.segments
  if (path.repeatOffset && lap > 0) {
    const shift = freezeVec3([path.repeatOffset[0] * lap, path.repeatOffset[1] * lap, path.repeatOffset[2] * lap])
    return {
      position: addVec3(evaluateSpline(path.positions, path.loop, path.segments, u, path.repeatOffset), shift),
      target: addVec3(evaluateSpline(path.targets, path.loop, path.segments, u, path.repeatOffset), shift),
      fovDegrees: evaluateSpline(path.fovs, path.loop, path.segments, u),
    }
  }
  return {
    position: evaluateSpline(path.positions, path.loop, path.segments, u, path.repeatOffset),
    target: evaluateSpline(path.targets, path.loop, path.segments, u, path.repeatOffset),
    fovDegrees: evaluateSpline(path.fovs, path.loop, path.segments, u),
  }
}

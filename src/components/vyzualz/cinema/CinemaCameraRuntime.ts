import type {
  CinemaCameraAuthoredShotDefinition,
  CinemaCameraInvalidRegionDefinition,
  CinemaCameraMode,
  CinemaCameraPoseDefinition,
  CinemaCameraResourceDefinition,
  CinemaCameraSafeRangeDefinition,
  CinemaCompositionDefinition,
  CinemaCompositionInstance,
  CinemaParameterDefinition,
  CinemaParameterValue,
  CinemaVector3,
} from './CinemaDomain'
import {
  createCinemaDiagnostic,
  createCinemaDiagnosticSnapshot,
  type CinemaDiagnostic,
  type CinemaDiagnosticSnapshot,
} from './CinemaDiagnostics'
import {
  createCinemaParameterPath,
  cinemaStableId,
  type CinemaCameraId,
  type CinemaParameterId,
} from './CinemaIdentifiers'
import type {
  CinemaCameraCapability,
  CinemaCameraUniformSnapshot,
  CinemaFrameContext,
} from './CinemaRendererContracts'

export const CINEMA_CAMERA_RUNTIME_VERSION = 1 as const

export const CINEMA_CAMERA_PARAMETER_IDS = Object.freeze({
  position: cinemaStableId<CinemaParameterId>('position', 'camera parameter'),
  rotation: cinemaStableId<CinemaParameterId>('rotation', 'camera parameter'),
  target: cinemaStableId<CinemaParameterId>('target', 'camera parameter'),
  fovDegrees: cinemaStableId<CinemaParameterId>('fov-degrees', 'camera parameter'),
  rollRadians: cinemaStableId<CinemaParameterId>('roll-radians', 'camera parameter'),
  near: cinemaStableId<CinemaParameterId>('near', 'camera parameter'),
  far: cinemaStableId<CinemaParameterId>('far', 'camera parameter'),
  orbitRadius: cinemaStableId<CinemaParameterId>('orbit-radius', 'camera parameter'),
  orbitSpeed: cinemaStableId<CinemaParameterId>('orbit-speed', 'camera parameter'),
  orbitElevation: cinemaStableId<CinemaParameterId>('orbit-elevation', 'camera parameter'),
  dollyRange: cinemaStableId<CinemaParameterId>('dolly-range', 'camera parameter'),
  dollySpeed: cinemaStableId<CinemaParameterId>('dolly-speed', 'camera parameter'),
  flySpeed: cinemaStableId<CinemaParameterId>('fly-speed', 'camera parameter'),
  banking: cinemaStableId<CinemaParameterId>('banking', 'camera parameter'),
  shake: cinemaStableId<CinemaParameterId>('shake', 'camera parameter'),
  beatPunch: cinemaStableId<CinemaParameterId>('beat-punch', 'camera parameter'),
  handheld: cinemaStableId<CinemaParameterId>('handheld', 'camera parameter'),
  focusDistance: cinemaStableId<CinemaParameterId>('focus-distance', 'camera parameter'),
  aperture: cinemaStableId<CinemaParameterId>('aperture', 'camera parameter'),
} as const)

export const CINEMA_DEFAULT_CAMERA_SAFE_RANGE: Readonly<CinemaCameraSafeRangeDefinition> = Object.freeze({
  minPosition: Object.freeze([-20, -20, 0.05] as const),
  maxPosition: Object.freeze([20, 20, 100] as const),
  minFovDegrees: 10,
  maxFovDegrees: 140,
  minNear: 0.001,
  maxFar: 10000,
})

export interface CinemaCameraResolveInput {
  composition: Readonly<CinemaCompositionDefinition>
  instance?: Readonly<CinemaCompositionInstance> | null
  frame: Readonly<CinemaFrameContext>
  requestedCameraId?: CinemaCameraId | null
  resolvedParameterValues?: Readonly<Record<string, CinemaParameterValue>>
}

export interface CinemaCameraResolveResult {
  cameraId: CinemaCameraId | null
  camera: Readonly<CinemaCameraUniformSnapshot> | null
  selectedShotId: string | null
  corrected: boolean
  diagnostics: CinemaDiagnosticSnapshot
}

export function resolveCinemaCameraFrame(input: CinemaCameraResolveInput): CinemaCameraResolveResult {
  const diagnostics: CinemaDiagnostic[] = []
  const requestedCameraId = input.requestedCameraId ?? input.frame.activeCameraId
  if (requestedCameraId != null && !input.composition.cameras.some(camera => camera.id === requestedCameraId)) {
    diagnostics.push(createCinemaDiagnostic({
      code: 'CINEMA_CAMERA_INVALID',
      severity: 'warning',
      message: `Cinema requested camera "${requestedCameraId}" is unavailable; the first valid camera is used.`,
      attribution: { cameraId: String(requestedCameraId), compositionId: String(input.composition.id), stage: 'camera-runtime' },
    }))
  }
  const resource = selectCameraResource(input.composition.cameras, requestedCameraId)
  if (!resource) {
    return {
      cameraId: null,
      camera: null,
      selectedShotId: null,
      corrected: false,
      diagnostics: createCinemaDiagnosticSnapshot(diagnostics),
    }
  }

  const values = resolveCameraValues(
    resource,
    input.instance,
    input.composition.id,
    input.resolvedParameterValues,
  )
  const safeRange = normalizeSafeRange(resource.safeRange)
  const base = readPose(values)
  const selectedShot = resource.mode === 'auto-director'
    ? selectAuthoredShot(resource, input.frame)
    : null
  if (resource.mode === 'auto-director' && !selectedShot) {
    diagnostics.push(createCinemaDiagnostic({
      code: 'CINEMA_CAMERA_SHOT_UNAVAILABLE',
      severity: 'warning',
      message: `Cinema camera "${resource.id}" has no compatible authored shot; its locked pose is used.`,
      attribution: { cameraId: String(resource.id), compositionId: String(input.composition.id), stage: 'camera-runtime' },
    }))
  }

  const resolvedMode = selectedShot?.mode ?? (resource.mode === 'auto-director' ? 'locked' : resource.mode)
  if (resolvedMode === 'path' && (selectedShot?.path ?? resource.path ?? []).length === 0) {
    diagnostics.push(createCinemaDiagnostic({
      code: 'CINEMA_CAMERA_SHOT_UNAVAILABLE',
      severity: 'warning',
      message: `Cinema camera "${resource.id}" requested path mode without path points; its base pose is used.`,
      attribution: { cameraId: String(resource.id), compositionId: String(input.composition.id), stage: 'camera-runtime' },
    }))
  }
  const animated = applyMode(base, selectedShot, resource.path, resolvedMode, values, input.frame, resource.id)
  const safe = enforceCameraSafety(animated, safeRange, resource.invalidRegions ?? [], diagnostics, resource.id, input.composition.id)

  return {
    cameraId: resource.id,
    camera: Object.freeze({
      cameraId: resource.id,
      mode: resource.mode,
      resolvedMode,
      shotId: selectedShot?.id ?? null,
      position: safe.pose.position,
      rotation: safe.pose.rotation,
      target: safe.pose.target,
      fovDegrees: safe.pose.fovDegrees,
      rollRadians: safe.pose.rollRadians,
      near: safe.pose.near,
      far: safe.pose.far,
      orbitProgress: safe.pose.orbitProgress,
      dollyProgress: safe.pose.dollyProgress,
      banking: clamp(numberValue(values[CINEMA_CAMERA_PARAMETER_IDS.banking], 0), -2, 2),
      shake: clamp(numberValue(values[CINEMA_CAMERA_PARAMETER_IDS.shake], 0), 0, 4),
      beatPunch: clamp(numberValue(values[CINEMA_CAMERA_PARAMETER_IDS.beatPunch], 0), 0, maximumSafeTravel(safeRange)),
      handheld: clamp(numberValue(values[CINEMA_CAMERA_PARAMETER_IDS.handheld], 0), 0, 4),
      focusDistance: clamp(numberValue(values[CINEMA_CAMERA_PARAMETER_IDS.focusDistance], 4), 0, safeRange.maxFar),
      aperture: clamp(numberValue(values[CINEMA_CAMERA_PARAMETER_IDS.aperture], 0), 0, 64),
    }),
    selectedShotId: selectedShot?.id ?? null,
    corrected: safe.corrected,
    diagnostics: createCinemaDiagnosticSnapshot(diagnostics),
  }
}

/**
 * Returns the stable, UI-neutral schemas used by parameter resolution,
 * modulation, performance overrides, and future schema-generated controls.
 */
export function createCinemaCameraParameterSchemas(
  resource: Readonly<CinemaCameraResourceDefinition>,
): readonly Readonly<CinemaParameterDefinition>[] {
  const safeRange = normalizeSafeRange(resource.safeRange)
  const values = resource.parameterValues
  const maximumSpan = Math.max(
    safeRange.maxPosition[0] - safeRange.minPosition[0],
    safeRange.maxPosition[1] - safeRange.minPosition[1],
    safeRange.maxPosition[2] - safeRange.minPosition[2],
    1,
  )
  const maximumFar = Math.max(safeRange.maxFar, safeRange.minNear + 0.001)
  const schemas: CinemaParameterDefinition[] = [
    vectorSchema('position', 'Position', vector3Value(values[CINEMA_CAMERA_PARAMETER_IDS.position], [0, 0, 2]), safeRange.minPosition, safeRange.maxPosition),
    vectorSchema('rotation', 'Rotation', vector3Value(values[CINEMA_CAMERA_PARAMETER_IDS.rotation], [0, 0, 0]), [-Math.PI * 4, -Math.PI * 4, -Math.PI * 4], [Math.PI * 4, Math.PI * 4, Math.PI * 4]),
    vectorSchema('target', 'Target', vector3Value(values[CINEMA_CAMERA_PARAMETER_IDS.target], [0, 0, 0]), safeRange.minPosition, safeRange.maxPosition),
    floatSchema('fovDegrees', 'Field of View', numberValue(values[CINEMA_CAMERA_PARAMETER_IDS.fovDegrees], 58), safeRange.minFovDegrees, safeRange.maxFovDegrees, 0.1, 'degrees'),
    floatSchema('rollRadians', 'Roll', numberValue(values[CINEMA_CAMERA_PARAMETER_IDS.rollRadians], 0), -Math.PI * 4, Math.PI * 4, 0.001, 'radians'),
    floatSchema('near', 'Near Plane', numberValue(values[CINEMA_CAMERA_PARAMETER_IDS.near], 0.1), safeRange.minNear, Math.max(safeRange.minNear, maximumFar - 0.001), 0.001),
    floatSchema('far', 'Far Plane', numberValue(values[CINEMA_CAMERA_PARAMETER_IDS.far], maximumFar), safeRange.minNear + 0.001, maximumFar, 0.01),
    floatSchema('orbitRadius', 'Orbit Radius', numberValue(values[CINEMA_CAMERA_PARAMETER_IDS.orbitRadius], 2), 0.01, maximumSpan * 2, 0.01),
    floatSchema('orbitSpeed', 'Orbit Speed', numberValue(values[CINEMA_CAMERA_PARAMETER_IDS.orbitSpeed], 0.04), -8, 8, 0.001),
    floatSchema('orbitElevation', 'Orbit Elevation', numberValue(values[CINEMA_CAMERA_PARAMETER_IDS.orbitElevation], 0), safeRange.minPosition[1], safeRange.maxPosition[1], 0.01),
    floatSchema('dollyRange', 'Dolly Range', numberValue(values[CINEMA_CAMERA_PARAMETER_IDS.dollyRange], 1), 0, maximumSpan * 2, 0.01),
    floatSchema('dollySpeed', 'Dolly Speed', numberValue(values[CINEMA_CAMERA_PARAMETER_IDS.dollySpeed], 0.08), 0, 8, 0.001),
    floatSchema('flySpeed', 'Fly Speed', numberValue(values[CINEMA_CAMERA_PARAMETER_IDS.flySpeed], 0.04), 0, 8, 0.001),
    floatSchema('banking', 'Banking', numberValue(values[CINEMA_CAMERA_PARAMETER_IDS.banking], 0), -2, 2, 0.001),
    floatSchema('shake', 'Shake', numberValue(values[CINEMA_CAMERA_PARAMETER_IDS.shake], 0), 0, 4, 0.001),
    floatSchema('beatPunch', 'Beat Punch', numberValue(values[CINEMA_CAMERA_PARAMETER_IDS.beatPunch], 0), 0, maximumSpan, 0.001),
    floatSchema('handheld', 'Handheld', numberValue(values[CINEMA_CAMERA_PARAMETER_IDS.handheld], 0), 0, 4, 0.001),
    floatSchema('focusDistance', 'Focus Distance', numberValue(values[CINEMA_CAMERA_PARAMETER_IDS.focusDistance], 4), 0, maximumFar, 0.01),
    floatSchema('aperture', 'Aperture', numberValue(values[CINEMA_CAMERA_PARAMETER_IDS.aperture], 0), 0, 64, 0.01),
  ]
  return Object.freeze(schemas.map(schema => Object.freeze(schema)))
}

export function createCinemaCameraParameterSchemaMap(
  composition: Readonly<CinemaCompositionDefinition>,
): Readonly<Record<string, readonly Readonly<CinemaParameterDefinition>[]>> {
  const schemas: Record<string, readonly Readonly<CinemaParameterDefinition>[]> = {}
  for (const camera of composition.cameras) schemas[camera.id] = createCinemaCameraParameterSchemas(camera)
  return Object.freeze(schemas)
}

export function cameraFrameForCapability(
  frame: Readonly<CinemaFrameContext>,
  capability: CinemaCameraCapability,
): Readonly<CinemaFrameContext> {
  const compatible = capability === 'uniform'
    || capability === 'world'
    || capability === 'uniformCamera'
    || capability === 'worldCamera'
  if (compatible) return frame
  if (frame.camera == null && frame.activeCameraId == null) return frame
  return Object.freeze({ ...frame, activeCameraId: null, camera: null })
}

function selectCameraResource(
  cameras: readonly CinemaCameraResourceDefinition[],
  requestedCameraId: CinemaCameraId | null | undefined,
): Readonly<CinemaCameraResourceDefinition> | null {
  if (requestedCameraId != null) {
    const requested = cameras.find(camera => camera.id === requestedCameraId)
    if (requested) return requested
  }
  return cameras[0] ?? null
}

function resolveCameraValues(
  resource: Readonly<CinemaCameraResourceDefinition>,
  instance: Readonly<CinemaCompositionInstance> | null | undefined,
  compositionId: CinemaCompositionDefinition['id'],
  resolvedParameterValues: Readonly<Record<string, CinemaParameterValue>> | undefined,
): Readonly<Partial<Record<CinemaParameterId, CinemaParameterValue>>> {
  const override = instance?.compositionId === compositionId
    ? instance.cameraOverrides.find(candidate => candidate.cameraId === resource.id)?.values
    : undefined
  const values: Partial<Record<CinemaParameterId, CinemaParameterValue>> = {
    ...resource.parameterValues,
    ...(override ?? {}),
  }
  if (resolvedParameterValues) {
    for (const parameterId of Object.values(CINEMA_CAMERA_PARAMETER_IDS)) {
      const path = createCinemaParameterPath('cameras', parameterId, resource.id)
      if (Object.prototype.hasOwnProperty.call(resolvedParameterValues, path)) {
        values[parameterId] = resolvedParameterValues[path]
      }
    }
  }
  return Object.freeze(values)
}

function vectorSchema(
  key: 'position' | 'rotation' | 'target',
  label: string,
  defaultValue: CinemaVector3,
  min: CinemaVector3,
  max: CinemaVector3,
): CinemaParameterDefinition {
  return {
    id: CINEMA_CAMERA_PARAMETER_IDS[key],
    label,
    group: 'Camera',
    type: 'vector3',
    default: freezeVector(defaultValue),
    min: freezeVector(min),
    max: freezeVector(max),
    step: Object.freeze([0.01, 0.01, 0.01] as const),
    modulatable: true,
    ui: { control: 'vector' },
  }
}

function floatSchema(
  key: Exclude<keyof typeof CINEMA_CAMERA_PARAMETER_IDS, 'position' | 'rotation' | 'target'>,
  label: string,
  defaultValue: number,
  min: number,
  max: number,
  step: number,
  unit?: string,
): CinemaParameterDefinition {
  return {
    id: CINEMA_CAMERA_PARAMETER_IDS[key],
    label,
    group: 'Camera',
    type: 'float',
    default: clamp(defaultValue, min, max),
    min,
    max,
    step,
    ...(unit ? { unit } : {}),
    modulatable: true,
    ui: { control: 'slider' },
  }
}

interface RuntimePose {
  position: CinemaVector3
  rotation: CinemaVector3
  target: CinemaVector3
  fovDegrees: number
  rollRadians: number
  near: number
  far: number
  orbitProgress?: number
  dollyProgress?: number
}

function readPose(values: Readonly<Partial<Record<CinemaParameterId, CinemaParameterValue>>>): RuntimePose {
  return {
    position: vector3Value(values[CINEMA_CAMERA_PARAMETER_IDS.position], [0, 0, 2]),
    rotation: vector3Value(values[CINEMA_CAMERA_PARAMETER_IDS.rotation], [0, 0, 0]),
    target: vector3Value(values[CINEMA_CAMERA_PARAMETER_IDS.target], [0, 0, 0]),
    fovDegrees: numberValue(values[CINEMA_CAMERA_PARAMETER_IDS.fovDegrees], 58),
    rollRadians: numberValue(values[CINEMA_CAMERA_PARAMETER_IDS.rollRadians], 0),
    near: numberValue(values[CINEMA_CAMERA_PARAMETER_IDS.near], 0.1),
    far: numberValue(values[CINEMA_CAMERA_PARAMETER_IDS.far], 100),
  }
}

function applyMode(
  base: RuntimePose,
  shot: Readonly<CinemaCameraAuthoredShotDefinition> | null,
  resourcePath: readonly CinemaCameraPoseDefinition[] | undefined,
  mode: Exclude<CinemaCameraMode, 'auto-director'>,
  values: Readonly<Partial<Record<CinemaParameterId, CinemaParameterValue>>>,
  frame: Readonly<CinemaFrameContext>,
  cameraId: CinemaCameraId,
): RuntimePose {
  let pose = applyPoseDefinition(base, shot)
  const time = Math.max(0, frame.transport.audioTimeSec)
  const beatPunch = numberValue(values[CINEMA_CAMERA_PARAMETER_IDS.beatPunch], 0) * (frame.impulses.beat ? 1 : 0)
  const shake = numberValue(values[CINEMA_CAMERA_PARAMETER_IDS.shake], 0)
  const handheld = numberValue(values[CINEMA_CAMERA_PARAMETER_IDS.handheld], 0)
  const banking = numberValue(values[CINEMA_CAMERA_PARAMETER_IDS.banking], 0)
  const phase = deterministicPhase(frame.timing.seeds.musicalPosition, String(cameraId))

  switch (mode) {
    case 'dolly': {
      const speed = Math.max(0, numberValue(values[CINEMA_CAMERA_PARAMETER_IDS.dollySpeed], 0.08))
      const range = Math.max(0, numberValue(values[CINEMA_CAMERA_PARAMETER_IDS.dollyRange], 1))
      const progress = (Math.sin(time * speed * Math.PI * 2 + phase) + 1) * 0.5
      pose = { ...pose, position: freezeVector([pose.position[0], pose.position[1], pose.position[2] - (progress * 2 - 1) * range - beatPunch]), dollyProgress: progress }
      break
    }
    case 'orbit': {
      const speed = numberValue(values[CINEMA_CAMERA_PARAMETER_IDS.orbitSpeed], 0.04)
      const radius = Math.max(0.01, numberValue(values[CINEMA_CAMERA_PARAMETER_IDS.orbitRadius], 2))
      const elevation = numberValue(values[CINEMA_CAMERA_PARAMETER_IDS.orbitElevation], 0)
      const angle = time * speed * Math.PI * 2 + phase
      const progress = positiveModulo(angle / (Math.PI * 2), 1)
      pose = {
        ...pose,
        position: freezeVector([
          pose.target[0] + Math.sin(angle) * radius,
          pose.target[1] + elevation,
          pose.target[2] + Math.cos(angle) * radius,
        ]),
        rollRadians: pose.rollRadians + Math.sin(angle) * banking,
        orbitProgress: progress,
      }
      break
    }
    case 'fly':
    case 'path': {
      const path = shot?.path ?? resourcePath ?? []
      const speed = Math.max(0, numberValue(values[CINEMA_CAMERA_PARAMETER_IDS.flySpeed], 0.04))
      const progress = positiveModulo(time * speed, 1)
      if (path.length > 0) {
        pose = interpolatePath(pose, path, progress)
      } else if (mode === 'fly') {
        const travel = Math.max(0.01, numberValue(values[CINEMA_CAMERA_PARAMETER_IDS.dollyRange], 1))
        pose = {
          ...pose,
          position: freezeVector([
            pose.position[0] + Math.sin(progress * Math.PI * 2 + phase) * travel * 0.2,
            pose.position[1] + Math.sin(progress * Math.PI * 4 + phase) * travel * 0.06,
            pose.position[2] - progress * travel,
          ]),
          rollRadians: pose.rollRadians + Math.sin(progress * Math.PI * 2 + phase) * banking,
        }
      }
      break
    }
    case 'handheld': {
      const amount = Math.max(handheld, shake)
      pose = {
        ...pose,
        position: freezeVector([
          pose.position[0] + Math.sin(time * 7.1 + phase) * amount * 0.03,
          pose.position[1] + Math.sin(time * 5.3 + phase * 0.7) * amount * 0.02,
          pose.position[2] - beatPunch,
        ]),
        rollRadians: pose.rollRadians + Math.sin(time * 6.2 + phase) * amount * 0.015,
      }
      break
    }
    case 'locked': {
      pose = { ...pose, position: freezeVector([pose.position[0], pose.position[1], pose.position[2] - beatPunch]) }
      break
    }
  }
  return pose
}

function applyPoseDefinition(base: RuntimePose, patch: CinemaCameraPoseDefinition | null | undefined): RuntimePose {
  if (!patch) return base
  return {
    ...base,
    position: patch.position ? freezeVector(patch.position) : base.position,
    rotation: patch.rotation ? freezeVector(patch.rotation) : base.rotation,
    target: patch.target ? freezeVector(patch.target) : base.target,
    fovDegrees: finiteOr(patch.fovDegrees, base.fovDegrees),
    rollRadians: finiteOr(patch.rollRadians, base.rollRadians),
    near: finiteOr(patch.near, base.near),
    far: finiteOr(patch.far, base.far),
  }
}

function selectAuthoredShot(
  resource: Readonly<CinemaCameraResourceDefinition>,
  frame: Readonly<CinemaFrameContext>,
): Readonly<CinemaCameraAuthoredShotDefinition> | null {
  const shots = resource.authoredShots ?? []
  if (shots.length === 0) return null
  const section = frame.music.sectionType ?? 'unknown'
  const matching = shots.filter(shot => !shot.sections || shot.sections.length === 0 || shot.sections.includes(section))
  const selectable = matching.length > 0 ? matching : shots
  const total = selectable.reduce((sum, shot) => sum + Math.max(0.001, shot.weight ?? 1), 0)
  const selectionWindowSec = Math.max(1, ...selectable.map(shot => Math.max(0, shot.minimumDurationSec ?? 0)))
  const bpm = finiteOr(frame.music.bpm ?? undefined, 0)
  const secondsPerBar = bpm > 0 ? 240 / bpm : selectionWindowSec
  const barsPerWindow = Math.max(1, Math.ceil(selectionWindowSec / secondsPerBar))
  const selectionIndex = frame.music.barIndex != null && frame.music.barIndex >= 0
    ? Math.floor(frame.music.barIndex / barsPerWindow)
    : Math.floor(Math.max(0, frame.transport.audioTimeSec) / selectionWindowSec)
  const eventIdentity = [
    resource.id,
    frame.transport.trackId ?? 'no-track',
    frame.music.sectionId ?? 'no-section',
    section,
    selectionIndex,
    frame.timing.seeds.composition,
    frame.timing.seeds.track,
  ].join(':')
  let cursor = seededUnit(hashString(eventIdentity)) * total
  for (const shot of selectable) {
    cursor -= Math.max(0.001, shot.weight ?? 1)
    if (cursor <= 0) return shot
  }
  return selectable[selectable.length - 1] ?? null
}

function enforceCameraSafety(
  pose: RuntimePose,
  range: Readonly<CinemaCameraSafeRangeDefinition>,
  invalidRegions: readonly CinemaCameraInvalidRegionDefinition[],
  diagnostics: CinemaDiagnostic[],
  cameraId: CinemaCameraId,
  compositionId: CinemaCompositionDefinition['id'],
): { pose: RuntimePose; corrected: boolean } {
  let corrected = false
  let position = freezeVector([
    clamp(pose.position[0], range.minPosition[0], range.maxPosition[0]),
    clamp(pose.position[1], range.minPosition[1], range.maxPosition[1]),
    clamp(pose.position[2], range.minPosition[2], range.maxPosition[2]),
  ])
  const fovDegrees = clamp(pose.fovDegrees, range.minFovDegrees, range.maxFovDegrees)
  const near = clamp(pose.near, range.minNear, Math.max(range.minNear, range.maxFar - 0.001))
  const far = clamp(pose.far, near + 0.001, range.maxFar)
  const rotation = freezeVector([
    clamp(pose.rotation[0], -Math.PI * 4, Math.PI * 4),
    clamp(pose.rotation[1], -Math.PI * 4, Math.PI * 4),
    clamp(pose.rotation[2], -Math.PI * 4, Math.PI * 4),
  ])
  const rollRadians = clamp(pose.rollRadians, -Math.PI * 4, Math.PI * 4)
  corrected = !vectorsEqual(position, pose.position)
    || !vectorsEqual(rotation, pose.rotation)
    || fovDegrees !== pose.fovDegrees
    || rollRadians !== pose.rollRadians
    || near !== pose.near
    || far !== pose.far

  const maximumCorrectionPasses = Math.max(1, invalidRegions.length * 2 + 1)
  for (let pass = 0; pass < maximumCorrectionPasses; pass += 1) {
    let correctedThisPass = false
    for (const region of invalidRegions) {
      if (!insideRegion(position, region)) continue
      corrected = true
      correctedThisPass = true
      const declaredFallback = region.fallbackPosition
        ? clampPosition(region.fallbackPosition, range)
        : null
      position = declaredFallback && !insideRegion(declaredFallback, region)
        ? declaredFallback
        : nearestOutsidePosition(position, region, range)
    }
    if (!correctedThisPass) break
  }

  const unresolvedRegion = invalidRegions.find(region => insideRegion(position, region))
  if (unresolvedRegion) {
    diagnostics.push(createCinemaDiagnostic({
      code: 'CINEMA_CAMERA_INVALID',
      severity: 'error',
      message: `Cinema camera "${cameraId}" could not find a viewpoint outside invalid region "${unresolvedRegion.id}" within its safe range.`,
      attribution: { cameraId: String(cameraId), compositionId: String(compositionId), stage: 'camera-runtime' },
    }))
  }

  if (corrected) {
    diagnostics.push(createCinemaDiagnostic({
      code: 'CINEMA_CAMERA_SAFE_RANGE_CORRECTED',
      severity: 'warning',
      message: `Cinema camera "${cameraId}" was corrected to a safe viewpoint.`,
      attribution: { cameraId: String(cameraId), compositionId: String(compositionId), stage: 'camera-runtime' },
    }))
  }
  return { pose: { ...pose, position, rotation, fovDegrees, rollRadians, near, far }, corrected }
}

function normalizeSafeRange(input: CinemaCameraSafeRangeDefinition | undefined): CinemaCameraSafeRangeDefinition {
  if (!input) return CINEMA_DEFAULT_CAMERA_SAFE_RANGE
  const minPosition = freezeVector([
    Math.min(input.minPosition[0], input.maxPosition[0]),
    Math.min(input.minPosition[1], input.maxPosition[1]),
    Math.min(input.minPosition[2], input.maxPosition[2]),
  ])
  const maxPosition = freezeVector([
    Math.max(input.minPosition[0], input.maxPosition[0]),
    Math.max(input.minPosition[1], input.maxPosition[1]),
    Math.max(input.minPosition[2], input.maxPosition[2]),
  ])
  return {
    minPosition,
    maxPosition,
    minFovDegrees: Math.min(input.minFovDegrees, input.maxFovDegrees),
    maxFovDegrees: Math.max(input.minFovDegrees, input.maxFovDegrees),
    minNear: Math.max(0.0001, input.minNear),
    maxFar: Math.max(input.minNear + 0.001, input.maxFar),
  }
}

function insideRegion(position: CinemaVector3, region: CinemaCameraInvalidRegionDefinition): boolean {
  if (region.shape === 'sphere') {
    const radius = Math.max(0, region.radius ?? 0)
    const dx = position[0] - region.center[0]
    const dy = position[1] - region.center[1]
    const dz = position[2] - region.center[2]
    return dx * dx + dy * dy + dz * dz < radius * radius
  }
  const size = region.size ?? [0, 0, 0]
  return Math.abs(position[0] - region.center[0]) < Math.abs(size[0]) * 0.5
    && Math.abs(position[1] - region.center[1]) < Math.abs(size[1]) * 0.5
    && Math.abs(position[2] - region.center[2]) < Math.abs(size[2]) * 0.5
}

function nearestOutsidePosition(
  position: CinemaVector3,
  region: CinemaCameraInvalidRegionDefinition,
  range: Readonly<CinemaCameraSafeRangeDefinition>,
): CinemaVector3 {
  const epsilon = 0.001
  const candidates: CinemaVector3[] = []
  if (region.shape === 'sphere') {
    const radius = Math.max(epsilon, region.radius ?? epsilon)
    const dx = position[0] - region.center[0]
    const dy = position[1] - region.center[1]
    const dz = position[2] - region.center[2]
    const length = Math.hypot(dx, dy, dz)
    if (length > epsilon) {
      candidates.push(freezeVector([
        region.center[0] + dx / length * (radius + epsilon),
        region.center[1] + dy / length * (radius + epsilon),
        region.center[2] + dz / length * (radius + epsilon),
      ]))
    }
    candidates.push(
      freezeVector([region.center[0] + radius + epsilon, region.center[1], region.center[2]]),
      freezeVector([region.center[0] - radius - epsilon, region.center[1], region.center[2]]),
      freezeVector([region.center[0], region.center[1] + radius + epsilon, region.center[2]]),
      freezeVector([region.center[0], region.center[1] - radius - epsilon, region.center[2]]),
      freezeVector([region.center[0], region.center[1], region.center[2] + radius + epsilon]),
      freezeVector([region.center[0], region.center[1], region.center[2] - radius - epsilon]),
    )
  } else {
    const size = region.size ?? [0, 0, 0]
    const halfX = Math.abs(size[0]) * 0.5
    const halfY = Math.abs(size[1]) * 0.5
    const halfZ = Math.abs(size[2]) * 0.5
    candidates.push(
      freezeVector([region.center[0] + halfX + epsilon, position[1], position[2]]),
      freezeVector([region.center[0] - halfX - epsilon, position[1], position[2]]),
      freezeVector([position[0], region.center[1] + halfY + epsilon, position[2]]),
      freezeVector([position[0], region.center[1] - halfY - epsilon, position[2]]),
      freezeVector([position[0], position[1], region.center[2] + halfZ + epsilon]),
      freezeVector([position[0], position[1], region.center[2] - halfZ - epsilon]),
    )
  }

  for (const x of [range.minPosition[0], range.maxPosition[0]]) {
    for (const y of [range.minPosition[1], range.maxPosition[1]]) {
      for (const z of [range.minPosition[2], range.maxPosition[2]]) candidates.push(freezeVector([x, y, z]))
    }
  }
  const safeCandidates = candidates
    .map(candidate => clampPosition(candidate, range))
    .filter(candidate => !insideRegion(candidate, region))
    .sort((left, right) => squaredDistance(left, position) - squaredDistance(right, position))
  return safeCandidates[0] ?? clampPosition(range.maxPosition, range)
}

function clampPosition(
  position: CinemaVector3,
  range: Readonly<CinemaCameraSafeRangeDefinition>,
): CinemaVector3 {
  return freezeVector([
    clamp(position[0], range.minPosition[0], range.maxPosition[0]),
    clamp(position[1], range.minPosition[1], range.maxPosition[1]),
    clamp(position[2], range.minPosition[2], range.maxPosition[2]),
  ])
}

function squaredDistance(left: CinemaVector3, right: CinemaVector3): number {
  const dx = left[0] - right[0]
  const dy = left[1] - right[1]
  const dz = left[2] - right[2]
  return dx * dx + dy * dy + dz * dz
}

function interpolatePath(base: RuntimePose, path: readonly CinemaCameraPoseDefinition[], progress: number): RuntimePose {
  if (path.length === 0) return base
  if (path.length === 1) return applyPoseDefinition(base, path[0])
  const scaled = clamp(progress, 0, 1) * (path.length - 1)
  const index = Math.min(path.length - 2, Math.floor(scaled))
  const local = scaled - index
  const left = applyPoseDefinition(base, path[index])
  const right = applyPoseDefinition(base, path[index + 1])
  return {
    ...base,
    position: lerpVector(left.position, right.position, local),
    rotation: lerpVector(left.rotation, right.rotation, local),
    target: lerpVector(left.target, right.target, local),
    fovDegrees: lerp(left.fovDegrees, right.fovDegrees, local),
    rollRadians: lerp(left.rollRadians, right.rollRadians, local),
    near: lerp(left.near, right.near, local),
    far: lerp(left.far, right.far, local),
  }
}

function vector3Value(value: CinemaParameterValue | undefined, fallback: CinemaVector3): CinemaVector3 {
  if (Array.isArray(value) && value.length === 3 && value.every(entry => typeof entry === 'number' && Number.isFinite(entry))) {
    return freezeVector(value as unknown as CinemaVector3)
  }
  return freezeVector(fallback)
}

function freezeVector(value: CinemaVector3): CinemaVector3 {
  return Object.freeze([finiteOr(value[0], 0), finiteOr(value[1], 0), finiteOr(value[2], 0)] as const)
}

function numberValue(value: CinemaParameterValue | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function finiteOr(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return value < min ? min : value > max ? max : value
}

function lerp(left: number, right: number, progress: number): number {
  return left + (right - left) * progress
}

function lerpVector(left: CinemaVector3, right: CinemaVector3, progress: number): CinemaVector3 {
  return freezeVector([
    lerp(left[0], right[0], progress),
    lerp(left[1], right[1], progress),
    lerp(left[2], right[2], progress),
  ])
}

function vectorsEqual(left: CinemaVector3, right: CinemaVector3): boolean {
  return left[0] === right[0] && left[1] === right[1] && left[2] === right[2]
}

function hashString(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function seededUnit(seed: number): number {
  let value = seed >>> 0
  value += 0x6d2b79f5
  value = Math.imul(value ^ (value >>> 15), value | 1)
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296
}

function deterministicPhase(seed: number, salt: string): number {
  return seededUnit((seed ^ hashString(salt)) >>> 0) * Math.PI * 2
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor
}

function maximumSafeTravel(range: Readonly<CinemaCameraSafeRangeDefinition>): number {
  return Math.max(
    range.maxPosition[0] - range.minPosition[0],
    range.maxPosition[1] - range.minPosition[1],
    range.maxPosition[2] - range.minPosition[2],
    0,
  )
}

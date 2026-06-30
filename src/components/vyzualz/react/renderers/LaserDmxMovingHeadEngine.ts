import type { LaserDmxFixture } from '../ReactTypes'
import {
  normalizeProductionGroupMovement,
  normalizeProductionMovingHeadSettings,
  resolveLaserDmxFixtureCapabilities,
  type ProductionFixtureGroup,
  type ProductionGroupMovementConfig,
  type ProductionMovingHeadEasing,
  type ProductionPanTiltCapability,
  type ProductionRig,
  type ProductionStageVector3,
  type ProductionTarget,
} from '../LaserDmxProductionRig'

const FIXED_STEP_SEC = 1 / 120
const SEEK_THRESHOLD_SEC = 2
const ANGLE_EPSILON_DEG = 0.05

interface MovingHeadRuntimeState {
  panDeg: number
  tiltDeg: number
  lastTimeSec: number
  movementComplete: boolean
  lastSnapRequestId: number
}

export interface MovingHeadPanTiltSolution {
  panDeg: number
  tiltDeg: number
  distance: number
}

export interface ProductionGroupMovementSample {
  panOffsetDeg: number
  tiltOffsetDeg: number
  phase: number
}

export interface MovingHeadFrameState {
  panDeg: number
  tiltDeg: number
  movementComplete: boolean
  targetAvailable: boolean
  worldTarget: ProductionStageVector3
  movementGroupId: string | null
}

export interface EvaluateMovingHeadInput {
  fixture: LaserDmxFixture
  rig: ProductionRig
  timeSec: number
  bpm: number
  shutterOpen: boolean
  /** Additive offsets from the shared LaserDMX modulation system. */
  panModulationDeg?: number
  tiltModulationDeg?: number
}

function finite(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function fract(value: number): number {
  return ((value % 1) + 1) % 1
}


function targetCenter(target: ProductionTarget | undefined): ProductionStageVector3 | null {
  if (!target) return null
  return target.kind === 'point' ? target.position : target.center
}

function applyEasing(value: number, easing: ProductionMovingHeadEasing): number {
  const t = clamp(value, 0, 1)
  switch (easing) {
    case 'easeIn': return t * t
    case 'easeOut': return 1 - (1 - t) * (1 - t)
    case 'easeInOut': return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
    default: return t
  }
}

function wrapSigned180(value: number): number {
  return ((value + 180) % 360 + 360) % 360 - 180
}

/** Chooses the nearest equivalent angle that remains inside the profile range. */
export function resolveProfileAwareAngle(
  currentDeg: number,
  targetDeg: number,
  rangeDeg: number,
  continuous = false,
): number {
  const halfRange = Math.max(0.5, rangeDeg / 2)
  if (continuous) return currentDeg + wrapSigned180(targetDeg - currentDeg)

  const candidates = [targetDeg - 720, targetDeg - 360, targetDeg, targetDeg + 360, targetDeg + 720]
    .filter(candidate => candidate >= -halfRange && candidate <= halfRange)
  if (candidates.length === 0) return clamp(targetDeg, -halfRange, halfRange)
  return candidates.reduce((best, candidate) => (
    Math.abs(candidate - currentDeg) < Math.abs(best - currentDeg) ? candidate : best
  ), candidates[0])
}

export function solveMovingHeadPanTilt(
  origin: ProductionStageVector3,
  target: ProductionStageVector3,
  mountOrientation: { yawDeg: number; pitchDeg: number },
  capability: ProductionPanTiltCapability,
  current: { panDeg: number; tiltDeg: number } = { panDeg: 0, tiltDeg: 0 },
): MovingHeadPanTiltSolution {
  const dx = finite(target.x - origin.x)
  const dy = finite(target.y - origin.y)
  const dz = finite(target.z - origin.z)
  const horizontal = Math.hypot(dx, dz)
  const yawWorld = Math.atan2(dx, dz) * 180 / Math.PI
  const pitchWorld = Math.atan2(dy, Math.max(1e-9, horizontal)) * 180 / Math.PI
  const panTarget = yawWorld - finite(mountOrientation.yawDeg)
  const tiltTarget = pitchWorld - finite(mountOrientation.pitchDeg)
  return {
    panDeg: resolveProfileAwareAngle(current.panDeg, panTarget, capability.panRangeDeg, capability.continuousPan),
    tiltDeg: resolveProfileAwareAngle(current.tiltDeg, tiltTarget, capability.tiltRangeDeg, capability.continuousTilt),
    distance: Math.hypot(dx, dy, dz),
  }
}

function directionFromPose(
  panDeg: number,
  tiltDeg: number,
  mountOrientation: { yawDeg: number; pitchDeg: number },
): ProductionStageVector3 {
  const yaw = (panDeg + mountOrientation.yawDeg) * Math.PI / 180
  const pitch = (tiltDeg + mountOrientation.pitchDeg) * Math.PI / 180
  const cosPitch = Math.cos(pitch)
  return {
    x: Math.sin(yaw) * cosPitch,
    y: Math.sin(pitch),
    z: Math.cos(yaw) * cosPitch,
  }
}

function pointAlongRay(origin: ProductionStageVector3, direction: ProductionStageVector3, distance: number): ProductionStageVector3 {
  return {
    x: origin.x + direction.x * distance,
    y: origin.y + direction.y * distance,
    z: origin.z + direction.z * distance,
  }
}

function quantizedDurationBeats(config: ProductionGroupMovementConfig): number {
  switch (config.quantize) {
    case 'beat': return 1
    case 'bar': return 4
    case 'phrase': return 16
    default: return Math.max(0.25, config.durationBeats)
  }
}

export function resolveMovementFixturePhase(
  configInput: ProductionGroupMovementConfig,
  fixtureIndex: number,
  fixtureCount: number,
  timeSec: number,
  bpm: number,
): number {
  const config = normalizeProductionGroupMovement(configInput)
  const count = Math.max(1, fixtureCount)
  const index = clamp(Math.round(fixtureIndex), 0, count - 1)
  const mirroredIndex = Math.min(index, count - 1 - index)
  const phaseIndex = config.symmetry === 'mirrorPairs' || config.symmetry === 'centerMirror'
    ? mirroredIndex
    : index
  const bankOffset = config.symmetry === 'alternatingBanks' && index % 2 === 1 ? 0.5 : 0
  const directionSign = config.direction === 'reverse' || (config.direction === 'alternate' && index % 2 === 1) ? -1 : 1
  const beats = Math.max(0, timeSec) * Math.max(1, finite(bpm, 120)) / 60
  const cycle = beats / quantizedDurationBeats(config) * Math.max(0, config.speed)
  return fract(config.phaseOffset + bankOffset + directionSign * (cycle + phaseIndex * config.phaseSpread))
}

export function evaluateProductionGroupMovement(
  configInput: ProductionGroupMovementConfig,
  fixtureIndex: number,
  fixtureCount: number,
  timeSec: number,
  bpm: number,
): ProductionGroupMovementSample {
  const config = normalizeProductionGroupMovement(configInput)
  const count = Math.max(1, fixtureCount)
  const index = clamp(Math.round(fixtureIndex), 0, count - 1)
  const u = count === 1 ? 0 : index / (count - 1) * 2 - 1
  const side = u < 0 ? -1 : u > 0 ? 1 : (index % 2 === 0 ? -1 : 1)
  const phase = resolveMovementFixturePhase(config, index, count, timeSec, bpm)
  const radians = phase * Math.PI * 2
  const sine = Math.sin(radians)
  const cosine = Math.cos(radians)
  const sine2 = Math.sin(radians * 2)
  const ramp = applyEasing(phase, config.easing)
  const amplitude = config.enabled ? config.amplitude : 0
  const panAmplitude = config.panAmplitudeDeg * amplitude
  const tiltAmplitude = config.tiltAmplitudeDeg * amplitude
  const spread = config.spreadDeg * amplitude
  let panOffsetDeg = 0
  let tiltOffsetDeg = 0

  switch (config.generator) {
    case 'mirroredFan':
      panOffsetDeg = u * spread * (0.72 + 0.28 * (sine + 1) * 0.5)
      tiltOffsetDeg = -Math.abs(u) * tiltAmplitude * 0.2
      break
    case 'fanOpen':
      panOffsetDeg = u * spread * ramp
      tiltOffsetDeg = -Math.abs(u) * tiltAmplitude * ramp * 0.25
      break
    case 'fanClose':
      panOffsetDeg = u * spread * (1 - ramp)
      tiltOffsetDeg = -Math.abs(u) * tiltAmplitude * (1 - ramp) * 0.25
      break
    case 'centerOutSpread':
      panOffsetDeg = side * Math.abs(u) * spread * ramp
      tiltOffsetDeg = -Math.abs(u) * tiltAmplitude * ramp
      break
    case 'outsideInCollapse':
      panOffsetDeg = side * Math.abs(u) * spread * (1 - ramp)
      tiltOffsetDeg = -Math.abs(u) * tiltAmplitude * (1 - ramp)
      break
    case 'crossfire':
      panOffsetDeg = -u * spread + sine * panAmplitude * 0.15
      tiltOffsetDeg = cosine * tiltAmplitude * 0.2
      break
    case 'tunnel':
      panOffsetDeg = cosine * panAmplitude + u * spread * 0.2
      tiltOffsetDeg = sine * tiltAmplitude
      break
    case 'ceilingCanopy':
      panOffsetDeg = u * spread
      tiltOffsetDeg = tiltAmplitude * (0.65 + 0.35 * Math.abs(sine))
      break
    case 'crowdScan':
      panOffsetDeg = (phase * 2 - 1) * panAmplitude + u * spread * 0.2
      tiltOffsetDeg = -tiltAmplitude * (0.7 + 0.3 * cosine)
      break
    case 'pendulum':
      panOffsetDeg = sine * panAmplitude
      tiltOffsetDeg = cosine * tiltAmplitude * 0.12
      break
    case 'figureEight':
      panOffsetDeg = sine * panAmplitude
      tiltOffsetDeg = sine2 * tiltAmplitude
      break
    case 'panWave':
      panOffsetDeg = sine * panAmplitude
      tiltOffsetDeg = u * tiltAmplitude * 0.15
      break
    case 'tiltWave':
      panOffsetDeg = u * spread * 0.25
      tiltOffsetDeg = sine * tiltAmplitude
      break
    case 'alternatingBanks': {
      const bank = index % 2 === 0 ? -1 : 1
      panOffsetDeg = bank * panAmplitude * sine
      tiltOffsetDeg = -bank * tiltAmplitude * cosine * 0.55
      break
    }
    case 'staticAerialHold':
      panOffsetDeg = u * spread
      tiltOffsetDeg = -tiltAmplitude
      break
  }

  return { panOffsetDeg, tiltOffsetDeg, phase }
}

function orderedGroupFixtures(group: ProductionFixtureGroup, rig: ProductionRig): string[] {
  const byId = new Map(rig.fixtures.map(fixture => [fixture.id, fixture]))
  return group.fixtureIds
    .filter(id => byId.has(id))
    .sort((a, b) => {
      const fixtureA = byId.get(a)!
      const fixtureB = byId.get(b)!
      return fixtureA.transform.position.x - fixtureB.transform.position.x || a.localeCompare(b)
    })
}

function activeMovementGroup(fixtureId: string, rig: ProductionRig): ProductionFixtureGroup | null {
  return rig.groups.find(group => group.fixtureIds.includes(fixtureId) && group.movement?.enabled) ?? null
}

function resolveDesiredPose(input: EvaluateMovingHeadInput, sampleTimeSec: number, current: { panDeg: number; tiltDeg: number }) {
  const { fixture, rig } = input
  const movingHead = normalizeProductionMovingHeadSettings(fixture.movingHead)
  const rigFixture = rig.fixtures.find(candidate => candidate.id === fixture.id)
  const capabilities = resolveLaserDmxFixtureCapabilities(fixture)
  const panTilt = capabilities?.panTilt
  const origin = rigFixture?.transform.position ?? { x: 0, y: 0, z: 0 }
  const orientation = rigFixture?.transform.orientation ?? { yawDeg: 0, pitchDeg: 0 }
  const movementGroup = activeMovementGroup(fixture.id, rig)
  const movement = movementGroup?.movement
    ? normalizeProductionGroupMovement(movementGroup.movement)
    : null
  const effectiveTargetId = fixture.targetId ?? rigFixture?.targetId ?? null
  const explicitTarget = targetCenter(rig.targets.find(target => target.id === effectiveTargetId))
  const targetAvailable = !movingHead.targetTracking || explicitTarget !== null
  const baseTarget = movement?.enabled ? movement.centerPoint : explicitTarget

  let panDeg = movingHead.panDeg
  let tiltDeg = movingHead.tiltDeg
  let targetDistance = Math.max(4, rig.stage.dimensions.depth)
  if (panTilt && baseTarget) {
    const solved = solveMovingHeadPanTilt(origin, baseTarget, orientation, panTilt, current)
    panDeg = solved.panDeg
    tiltDeg = solved.tiltDeg
    targetDistance = solved.distance
  }

  if (movement?.enabled && movementGroup && panTilt) {
    const ordered = orderedGroupFixtures(movementGroup, rig)
    const fixtureIndex = Math.max(0, ordered.indexOf(fixture.id))
    const sample = evaluateProductionGroupMovement(movement, fixtureIndex, ordered.length, sampleTimeSec, input.bpm)
    panDeg = resolveProfileAwareAngle(current.panDeg, panDeg + sample.panOffsetDeg, panTilt.panRangeDeg, panTilt.continuousPan)
    tiltDeg = resolveProfileAwareAngle(current.tiltDeg, tiltDeg + sample.tiltOffsetDeg, panTilt.tiltRangeDeg, panTilt.continuousTilt)
  }

  if (panTilt) {
    panDeg = resolveProfileAwareAngle(
      current.panDeg,
      panDeg + finite(input.panModulationDeg ?? 0),
      panTilt.panRangeDeg,
      panTilt.continuousPan,
    )
    tiltDeg = resolveProfileAwareAngle(
      current.tiltDeg,
      tiltDeg + finite(input.tiltModulationDeg ?? 0),
      panTilt.tiltRangeDeg,
      panTilt.continuousTilt,
    )
  }

  return {
    panDeg,
    tiltDeg,
    targetDistance: clamp(targetDistance, 2, Math.max(20, rig.stage.dimensions.depth * 5)),
    targetAvailable,
    movementGroup,
    movement,
    origin,
    orientation,
  }
}

function advanceAxis(current: number, target: number, speedDegPerSec: number, dt: number, easing: ProductionMovingHeadEasing): number {
  const delta = target - current
  if (Math.abs(delta) <= ANGLE_EPSILON_DEG) return target
  const distanceFactor = clamp(Math.abs(delta) / 90, 0.12, 1)
  const easedFactor = 0.2 + 0.8 * applyEasing(distanceFactor, easing)
  const maxStep = Math.max(0.001, speedDegPerSec) * dt * easedFactor
  return current + clamp(delta, -maxStep, maxStep)
}

class MovingHeadRuntime {
  private states = new Map<string, MovingHeadRuntimeState>()

  reset(): void {
    this.states.clear()
  }

  evaluate(input: EvaluateMovingHeadInput): MovingHeadFrameState {
    const movingHead = normalizeProductionMovingHeadSettings(input.fixture.movingHead)
    const timeSec = Math.max(0, finite(input.timeSec))
    let state = this.states.get(input.fixture.id)
    if (!state) {
      state = {
        panDeg: movingHead.panDeg,
        tiltDeg: movingHead.tiltDeg,
        lastTimeSec: timeSec,
        movementComplete: false,
        lastSnapRequestId: movingHead.snapRequestId,
      }
      this.states.set(input.fixture.id, state)
    }

    const initialDesired = resolveDesiredPose(input, timeSec, state)
    const movement = initialDesired.movement
    const shouldSnap = movingHead.snapRequestId !== state.lastSnapRequestId || movement?.snap === true
    const canPrePosition = input.shutterOpen || movingHead.prePositionWhileShuttered || movement?.prePositionWhileShuttered === true
    const deltaSec = timeSec - state.lastTimeSec
    const isSeek = deltaSec < -1e-6 || deltaSec > SEEK_THRESHOLD_SEC

    if (shouldSnap || isSeek) {
      state.panDeg = initialDesired.panDeg
      state.tiltDeg = initialDesired.tiltDeg
      state.movementComplete = true
      state.lastTimeSec = timeSec
      state.lastSnapRequestId = movingHead.snapRequestId
    } else if (canPrePosition && deltaSec > 0) {
      let simulatedTime = state.lastTimeSec
      const maxSteps = Math.ceil(SEEK_THRESHOLD_SEC / FIXED_STEP_SEC) + 2
      let steps = 0
      while (simulatedTime + 1e-9 < timeSec && steps < maxSteps) {
        const dt = Math.min(FIXED_STEP_SEC, timeSec - simulatedTime)
        const sampleTime = simulatedTime + dt
        const desired = resolveDesiredPose(input, sampleTime, state)
        state.panDeg = advanceAxis(state.panDeg, desired.panDeg, movingHead.panSpeedDegPerSec, dt, movingHead.easing)
        state.tiltDeg = advanceAxis(state.tiltDeg, desired.tiltDeg, movingHead.tiltSpeedDegPerSec, dt, movingHead.easing)
        simulatedTime = sampleTime
        steps += 1
      }
      const desiredAtEnd = resolveDesiredPose(input, timeSec, state)
      state.movementComplete = Math.abs(desiredAtEnd.panDeg - state.panDeg) <= ANGLE_EPSILON_DEG && Math.abs(desiredAtEnd.tiltDeg - state.tiltDeg) <= ANGLE_EPSILON_DEG
      state.lastTimeSec = timeSec
    } else {
      state.lastTimeSec = timeSec
    }

    const desired = resolveDesiredPose(input, timeSec, state)
    const direction = directionFromPose(state.panDeg, state.tiltDeg, desired.orientation)
    return {
      panDeg: state.panDeg,
      tiltDeg: state.tiltDeg,
      movementComplete: state.movementComplete,
      targetAvailable: desired.targetAvailable,
      worldTarget: pointAlongRay(desired.origin, direction, desired.targetDistance),
      movementGroupId: desired.movementGroup?.id ?? null,
    }
  }
}

const runtime = new MovingHeadRuntime()

export function evaluateMovingHeadFixture(input: EvaluateMovingHeadInput): MovingHeadFrameState {
  return runtime.evaluate(input)
}

export function resetMovingHeadRuntime(): void {
  runtime.reset()
}

import type { Cinema2Vector3 } from '../../contracts/Cinema2NativePresetManifest'
import {
  CINEMA2_AFTERHOURS_RANDOM_MODULE_ID,
  CINEMA2_AFTERHOURS_STAGE_VOLUME,
  type Cinema2AfterhoursBeamDescriptor,
  type Cinema2AfterhoursBeamGenerationInput,
  type Cinema2AfterhoursFixture,
  type Cinema2AfterhoursMirrorSide,
  type Cinema2AfterhoursRandomSource,
  type Cinema2AfterhoursTopologyDefinition,
} from './Cinema2AfterhoursDomain'
import { allocateCinema2AfterhoursFixtures, getCinema2AfterhoursMirrorFixture } from './Cinema2AfterhoursRig'
import { getCinema2AfterhoursTopologyDefinition } from './Cinema2AfterhoursTopologyCatalog'

function vector(x: number, y: number, z: number): Cinema2Vector3 {
  return Object.freeze([x, y, z]) as Cinema2Vector3
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
}

function normalize(value: Cinema2Vector3, fallback: Cinema2Vector3): Cinema2Vector3 {
  const length = Math.hypot(value[0], value[1], value[2])
  if (!Number.isFinite(length) || length <= 1e-8) return fallback
  return vector(value[0] / length, value[1] / length, value[2] / length)
}

function subtract(a: Cinema2Vector3, b: Cinema2Vector3): Cinema2Vector3 {
  return vector(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

function length(value: Cinema2Vector3): number {
  return Math.hypot(value[0], value[1], value[2])
}

function sideOf(fixture: Cinema2AfterhoursFixture): Cinema2AfterhoursMirrorSide {
  return fixture.positionWorld[0] < 0 ? 'left' : 'right'
}

function sample(
  random: Cinema2AfterhoursRandomSource,
  variationKey: string,
  purpose: string,
  index: number,
): number {
  return random.sample({
    moduleId: CINEMA2_AFTERHOURS_RANDOM_MODULE_ID,
    eventId: `domain:${variationKey}`,
    purpose,
  }, index)
}

function centeredSample(
  random: Cinema2AfterhoursRandomSource,
  variationKey: string,
  purpose: string,
  index: number,
): number {
  return sample(random, variationKey, purpose, index) * 2 - 1
}

function boundTarget(target: Cinema2Vector3): Cinema2Vector3 {
  const min = CINEMA2_AFTERHOURS_STAGE_VOLUME.min
  const max = CINEMA2_AFTERHOURS_STAGE_VOLUME.max
  return vector(
    clamp(target[0], min[0] + 0.2, max[0] - 0.2),
    clamp(target[1], min[1] + 0.6, max[1] - 0.2),
    clamp(target[2], 5.8, max[2] - 0.2),
  )
}

function topologyTarget(
  topology: Cinema2AfterhoursTopologyDefinition,
  fixture: Cinema2AfterhoursFixture,
  ordinal: number,
  total: number,
  jitterX: number,
  jitterY: number,
  jitterZ: number,
): Cinema2Vector3 {
  const side = fixture.positionWorld[0] < 0 ? -1 : 1
  const t = total <= 1 ? 0.5 : ordinal / (total - 1)
  const bankT = fixture.emitterIndex / Math.max(1, fixture.bank === 'left' || fixture.bank === 'right' ? 5 : 9)

  switch (topology.id) {
    case 'wideFan':
      return boundTarget(vector(
        side * (3.4 + 3.5 * t) + jitterX * 0.25,
        1.4 + (1 - bankT) * 4.7 + jitterY * 0.2,
        10.4 + jitterZ * 0.35,
      ))
    case 'splitWings':
      return boundTarget(vector(
        side * (5.2 + 1.9 * (0.25 + t)) + jitterX * 0.18,
        1.5 + 4.6 * ((ordinal % 4) / 3) + jitterY * 0.18,
        9.8 + jitterZ * 0.3,
      ))
    case 'crossCanopy':
      return boundTarget(vector(
        -side * (2.6 + 3.3 * (0.2 + t)) + jitterX * 0.2,
        3.5 + 2.2 * ((ordinal % 3) / 2) + jitterY * 0.16,
        9.0 + jitterZ * 0.28,
      ))
    case 'diamondStar': {
      const high = ordinal % 2 === 0
      return boundTarget(vector(
        side * (2.5 + (ordinal % 4 >= 2 ? 0.9 : 0)) + jitterX * 0.12,
        (high ? 5.7 : 2.1) + jitterY * 0.12,
        8.7 + jitterZ * 0.22,
      ))
    }
    case 'chevronRoof':
      return boundTarget(vector(
        side * (0.8 + 3.2 * t) + jitterX * 0.14,
        5.85 - 1.25 * t + jitterY * 0.12,
        8.8 + jitterZ * 0.24,
      ))
    case 'radialCrown': {
      const angle = 0.22 * Math.PI + 0.56 * Math.PI * t
      return boundTarget(vector(
        side * (2.2 + Math.cos(angle) * 4.7) + jitterX * 0.22,
        3.8 + Math.sin(angle) * 2.35 + jitterY * 0.18,
        9.6 + Math.cos(angle * 1.4) * 0.8 + jitterZ * 0.24,
      ))
    }
    case 'sparseArchitecture':
      return boundTarget(vector(
        side * (ordinal % 2 === 0 ? 2.8 : 5.7) + jitterX * 0.08,
        ordinal % 2 === 0 ? 5.9 + jitterY * 0.08 : 2.0 + jitterY * 0.08,
        10.8 + jitterZ * 0.15,
      ))
    case 'fullRig':
    default: {
      if (fixture.bank === 'left' || fixture.bank === 'right') {
        return boundTarget(vector(
          -side * (1.5 + 4.2 * t) + jitterX * 0.3,
          1.2 + 4.9 * bankT + jitterY * 0.22,
          9.5 + jitterZ * 0.4,
        ))
      }
      if (fixture.bank === 'overhead') {
        return boundTarget(vector(
          side * (2.1 + 3.8 * t) + jitterX * 0.3,
          1.1 + 2.6 * (ordinal % 3) / 2 + jitterY * 0.2,
          10.2 + jitterZ * 0.35,
        ))
      }
      return boundTarget(vector(
        side * (1.4 + 4.8 * t) + jitterX * 0.3,
        4.0 + 2.0 * (ordinal % 3) / 2 + jitterY * 0.2,
        10.5 + jitterZ * 0.35,
      ))
    }
  }
}

function mirrorTarget(target: Cinema2Vector3): Cinema2Vector3 {
  return vector(-target[0], target[1], target[2])
}

function applyTopologySpread(target: Cinema2Vector3, spreadValue: number | undefined): Cinema2Vector3 {
  const spread = clamp(spreadValue ?? 1, 0, 1)
  // Keep every topology recognizable at zero while letting the control widen
  // deterministically to the fully authored Stage 1 geometry at one.
  const lateralScale = 0.45 + spread * 0.55
  return boundTarget(vector(target[0] * lateralScale, target[1], target[2]))
}

function beam(
  slot: number,
  fixture: Cinema2AfterhoursFixture,
  targetWorld: Cinema2Vector3,
  topology: Cinema2AfterhoursTopologyDefinition,
  phase: number,
  intensityWeight: number,
  symmetry: Cinema2AfterhoursBeamDescriptor['symmetry'],
): Cinema2AfterhoursBeamDescriptor {
  const delta = subtract(targetWorld, fixture.positionWorld)
  const lengthWorld = length(delta)
  const directionWorld = normalize(delta, fixture.mountDirectionWorld)
  return Object.freeze({
    id: `afterhours2-beam-${String(slot).padStart(2, '0')}`,
    slot,
    fixtureId: fixture.id,
    bank: fixture.bank,
    fixtureRole: fixture.role,
    originWorld: fixture.positionWorld,
    targetWorld,
    directionWorld,
    lengthWorld,
    topologyId: topology.id,
    topologyRole: topology.role,
    symmetry,
    intensityWeight,
    scanner: Object.freeze({
      homeDirectionWorld: fixture.mountDirectionWorld,
      yawAuthorityDeg: topology.scanner.yawAuthorityDeg,
      pitchAuthorityDeg: topology.scanner.pitchAuthorityDeg,
      phase,
    }),
  })
}

/**
 * Produces one immutable frame of camera-ready 3D beam descriptors. It owns no
 * renderer, clock, audio analysis, camera choreography or history resources.
 */
export function generateCinema2AfterhoursBeamFrame(
  input: Cinema2AfterhoursBeamGenerationInput,
): readonly Cinema2AfterhoursBeamDescriptor[] {
  const topology = getCinema2AfterhoursTopologyDefinition(input.topologyId)
  const allocation = allocateCinema2AfterhoursFixtures(input)
  const variationKey = input.variationKey?.trim() || 'default'
  const beams: Cinema2AfterhoursBeamDescriptor[] = []

  if (input.symmetry) {
    for (let index = 0; index < allocation.fixtures.length; index += 2) {
      const first = allocation.fixtures[index]!
      const second = allocation.fixtures[index + 1]!
      const left = sideOf(first) === 'left' ? first : second
      const right = left === first ? second : first
      const mirror = getCinema2AfterhoursMirrorFixture(left)
      if (mirror.id !== right.id) throw new Error(`Afterhours 2.0 symmetric allocation broke pair ${left.pairId}.`)

      const pairOrdinal = Math.floor(index / 2)
      const jitterX = centeredSample(input.random, variationKey, `${topology.id}:pair-x`, pairOrdinal)
      const jitterY = centeredSample(input.random, variationKey, `${topology.id}:pair-y`, pairOrdinal)
      const jitterZ = centeredSample(input.random, variationKey, `${topology.id}:pair-z`, pairOrdinal)
      const phase = sample(input.random, variationKey, `${topology.id}:pair-phase`, pairOrdinal)
      const intensity = 0.88 + sample(input.random, variationKey, `${topology.id}:pair-intensity`, pairOrdinal) * 0.12
      const leftTarget = applyTopologySpread(
        topologyTarget(topology, left, pairOrdinal, Math.max(1, allocation.fixtures.length / 2), jitterX, jitterY, jitterZ),
        input.spread,
      )
      const rightTarget = mirrorTarget(leftTarget)
      const leftSlot = left === first ? index : index + 1
      const rightSlot = left === first ? index + 1 : index
      const leftBeam = beam(leftSlot, left, leftTarget, topology, phase, intensity, Object.freeze({ pairId: left.pairId, side: 'left' }))
      const rightBeam = beam(rightSlot, right, rightTarget, topology, phase, intensity, Object.freeze({ pairId: right.pairId, side: 'right' }))
      if (leftSlot === index) beams.push(leftBeam, rightBeam)
      else beams.push(rightBeam, leftBeam)
    }
  } else {
    for (const [index, fixture] of allocation.fixtures.entries()) {
      const jitterX = centeredSample(input.random, variationKey, `${topology.id}:beam-x`, index)
      const jitterY = centeredSample(input.random, variationKey, `${topology.id}:beam-y`, index)
      const jitterZ = centeredSample(input.random, variationKey, `${topology.id}:beam-z`, index)
      const phase = sample(input.random, variationKey, `${topology.id}:beam-phase`, index)
      const intensity = 0.82 + sample(input.random, variationKey, `${topology.id}:beam-intensity`, index) * 0.18
      beams.push(beam(
        index,
        fixture,
        applyTopologySpread(
          topologyTarget(topology, fixture, index, allocation.fixtures.length, jitterX, jitterY, jitterZ),
          input.spread,
        ),
        topology,
        phase,
        intensity,
        null,
      ))
    }
  }

  return Object.freeze(beams)
}

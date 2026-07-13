import type {
  LaserDmxShowDirectorPerformanceAddress,
  LaserDmxShowDirectorPerformanceBeatMutation,
  LaserDmxShowDirectorPerformanceMutationBase,
} from './LaserDmxShowDirectorPerformanceProgram'

/**
 * Tunable lower bounds used by the built-in Performance Shows. They intentionally
 * avoid strobe-rate changes and keep all impact work inside bounded fixture output.
 */
export const LASER_DMX_SHOW_DIRECTOR_BEAT_PERCEPTIBILITY = Object.freeze({
  minimumLeadingBrightnessDelta: 0.28,
  minimumFanSpreadDeltaDeg: 12,
  minimumEndpointMovementGridUnits: 1.5,
  minimumAngularTargetDeltaDeg: 7,
  minimumBeamMembershipDelta: 1,
  minimumColorEmphasisDistance: 0.22,
  heroBrightness: 1,
  restingBrightness: 0.46,
  duckedBrightness: 0.4,
  hatBrightness: 0.78,
  impactGlow: 1,
  impactWidth: 2.25,
} as const)

export const LASER_DMX_SHOW_DIRECTOR_BEAT_ACTION_VOCABULARY = Object.freeze({
  bankBrightnessHit: ['brightness', 'beamAppearance.glow'],
  fanSpreadSnap: ['fanSpread'],
  endpointSetSnap: ['targetPoints'],
  targetCenterStep: ['targetPosition'],
  beamTravelRestart: ['beamTravel.retrigger', 'beamTravel.phaseOffset'],
  lineToConeEmphasis: ['beamAppearance.geometry'],
  rotationStep: ['rotation'],
  alternatingRaySubset: ['enabled', 'targetPoints'],
  colorEmphasisPulse: ['color', 'beamAppearance.glow'],
  innerOuterBankSwap: ['address.bankRoles', 'brightness'],
  leftRightResponse: ['address.bankRoles', 'brightness', 'fanSpread'],
  topBottomResponse: ['address.bankRoles', 'brightness', 'fanSpread'],
  impactAccent: ['color', 'brightness', 'beamAppearance.width', 'beamAppearance.glow'],
} as const)

export const LASER_DMX_SHOW_DIRECTOR_BEAT_RECOVERY_ENVELOPE = Object.freeze({
  holdUntil: 0.18,
  releaseUntil: 0.82,
  curve: 'easeOut' as const,
})

export type LaserDmxShowDirectorBeatActionName = keyof typeof LASER_DMX_SHOW_DIRECTOR_BEAT_ACTION_VOCABULARY

type ThresholdMutation = LaserDmxShowDirectorPerformanceMutationBase & { threshold?: number }

export function createBankHitMutation(
  id: string,
  address: LaserDmxShowDirectorPerformanceAddress,
  options: {
    threshold?: number
    brightness?: number
    fanSpread?: number
    rotation?: number
    color?: string
    width?: number
    glow?: number
    geometry?: 'line' | 'volumetricCone'
    travelMode?: 'static' | 'grow' | 'projectile' | 'scanner' | 'pulseTrain'
    visualRole?: 'hero' | 'impact' | 'primary' | 'secondary' | 'texture'
  } = {},
): ThresholdMutation {
  return {
    id,
    threshold: options.threshold ?? 0.42,
    address,
    fixture: {
      brightness: options.brightness ?? LASER_DMX_SHOW_DIRECTOR_BEAT_PERCEPTIBILITY.heroBrightness,
      ...(options.fanSpread != null ? { fanSpread: options.fanSpread } : {}),
      ...(options.rotation != null ? { rotation: options.rotation } : {}),
      ...(options.color ? { color: options.color } : {}),
      beamAppearance: {
        width: options.width ?? LASER_DMX_SHOW_DIRECTOR_BEAT_PERCEPTIBILITY.impactWidth,
        glow: options.glow ?? LASER_DMX_SHOW_DIRECTOR_BEAT_PERCEPTIBILITY.impactGlow,
        ...(options.geometry ? { geometry: options.geometry } : {}),
      },
      beamTravel: {
        mode: options.travelMode ?? 'grow',
        beatsPerTravel: 1,
        phaseOffset: 0,
        retrigger: 'restart',
      },
      beamPriorityRole: 'heroImpact',
      beamVisualRole: options.visualRole ?? 'hero',
    },
  }
}

export function createBankDuckMutation(
  id: string,
  address: LaserDmxShowDirectorPerformanceAddress,
  options: { threshold?: number; brightness?: number; glow?: number } = {},
): ThresholdMutation {
  return {
    id,
    threshold: options.threshold ?? 0.42,
    address,
    fixture: {
      brightness: options.brightness ?? LASER_DMX_SHOW_DIRECTOR_BEAT_PERCEPTIBILITY.duckedBrightness,
      beamAppearance: { glow: options.glow ?? 0.54, width: 0.9 },
      beamPriorityRole: 'decorativeAccent',
      beamVisualRole: 'texture',
    },
  }
}

export function createDownbeatImpactMutations(
  prefix: string,
  heroAddress: LaserDmxShowDirectorPerformanceAddress,
  duckAddress: LaserDmxShowDirectorPerformanceAddress,
  options: { color: string; fanSpread?: number; geometry?: 'line' | 'volumetricCone' },
): LaserDmxShowDirectorPerformanceBeatMutation[] {
  return [
    {
      ...createBankHitMutation(`${prefix}-downbeat-impact`, heroAddress, {
        threshold: 0,
        color: options.color,
        fanSpread: options.fanSpread,
        width: 2.7,
        geometry: options.geometry ?? 'volumetricCone',
        travelMode: 'projectile',
        visualRole: 'impact',
      }),
      beatDivision: 1,
      beatOffsets: [0],
      beatCycleLength: 4,
      responseEnvelope: LASER_DMX_SHOW_DIRECTOR_BEAT_RECOVERY_ENVELOPE,
    },
    {
      ...createBankDuckMutation(`${prefix}-downbeat-duck`, duckAddress, { threshold: 0, brightness: 0.34 }),
      beatDivision: 1,
      beatOffsets: [0],
      beatCycleLength: 4,
      responseEnvelope: LASER_DMX_SHOW_DIRECTOR_BEAT_RECOVERY_ENVELOPE,
    },
  ]
}

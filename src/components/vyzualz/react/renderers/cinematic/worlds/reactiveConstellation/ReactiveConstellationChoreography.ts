import type { CinematicAudioTarget } from '../../../../CinematicWorldConfig'
import {
  REACTIVE_CONSTELLATION_BOUNDS,
  type ReactiveConstellationSettings,
} from '../../../../CinematicWorldSettings'
import type {
  CinematicModulationSnapshot,
  CinematicNormalizedAudioFrame,
} from '../../CinematicAudioModulation'
import { cinematicModulationValue } from '../../CinematicAudioModulation'
import type { ReactSectionType } from '../../../../ReactTypes'

export interface ReactiveConstellationRuntimeValues {
  networkSpread: number
  nodeScale: number
  nodeSpin: number
  edgeBrightness: number
  edgeWidth: number
  trailLength: number
  topologyMorph: number
  collapseForce: number
  burstImpulse: number
  facetOpacity: number
  springStrength: number
  motionScale: number
}

export type ReactiveConstellationRuntimeOffsets = Partial<ReactiveConstellationRuntimeValues>

export interface ReactiveConstellationCompositionInput {
  settings: ReactiveConstellationSettings
  audio: CinematicNormalizedAudioFrame | null | undefined
  modulation: CinematicModulationSnapshot | null | undefined
  manualMacroOffsets?: ReactiveConstellationRuntimeOffsets
  performanceActionEnvelopes?: ReactiveConstellationRuntimeOffsets
  motionScale?: number
}

export interface ReactiveConstellationCompositionResult {
  values: ReactiveConstellationRuntimeValues
  sectionType: ReactSectionType
  compositionOrder: readonly ['preset', 'section', 'audio', 'manualMacros', 'performanceActions', 'safetyClamps']
}

export const REACTIVE_CONSTELLATION_COMPOSITION_ORDER = [
  'preset',
  'section',
  'audio',
  'manualMacros',
  'performanceActions',
  'safetyClamps',
] as const

const TARGET_SCALE: Partial<Record<CinematicAudioTarget, number>> = {
  networkSpread: 0.62,
  nodeScale: 0.065,
  nodeSpin: 1.15,
  edgeBrightness: 2.6,
  edgeWidth: 3.2,
  trailLength: 14,
  topologyMorph: 1,
  collapseForce: 1.35,
  burstImpulse: 2.4,
  facetOpacity: 0.28,
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return value < min ? min : value > max ? max : value
}

function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

function smoothstep(value: number): number {
  const x = clamp01(value)
  return x * x * (3 - 2 * x)
}

export function resolveReactiveConstellationSection(audio: CinematicNormalizedAudioFrame | null | undefined): ReactSectionType {
  if (audio?.capabilities.sectionTiming && audio.section.type) return audio.section.type
  if (!audio) return 'unknown'
  if (audio.transportTimeSec < 12 || (audio.timing.barIndex >= 0 && audio.timing.barIndex < 4)) return 'intro'
  if (audio.values.dropState > 0.5 || (audio.values.overallEnergy > 0.82 && audio.values.transientIntensity > 0.55)) return 'drop'
  if (audio.values.buildProgress > 0.82) return 'preDrop'
  if (audio.values.buildProgress > 0.38) return 'build'
  if (audio.values.overallEnergy < 0.24 && audio.transportTimeSec > 24) return 'breakdown'
  return 'verse'
}

export function resolveReactiveConstellationChoreography(
  audio: CinematicNormalizedAudioFrame | null | undefined,
): ReactiveConstellationRuntimeOffsets {
  const section = resolveReactiveConstellationSection(audio)
  const progress = clamp01(audio?.section.progress ?? 0)
  const buildProgress = clamp01(audio?.values.buildProgress ?? 0)
  const eased = smoothstep(Math.max(progress, buildProgress))
  switch (section) {
    case 'intro':
      return { networkSpread: -0.28, nodeScale: -0.018, nodeSpin: -0.16, edgeBrightness: -0.58, edgeWidth: -0.55, trailLength: -7, topologyMorph: -0.18, collapseForce: 0.08, facetOpacity: -0.12, springStrength: 0.16, motionScale: -0.24 }
    case 'verse':
      return { networkSpread: -0.04, nodeSpin: -0.03, edgeBrightness: -0.12, trailLength: -2, topologyMorph: 0.06, springStrength: 0.08, motionScale: -0.04 }
    case 'build':
      return { networkSpread: 0.12 + eased * 0.32, nodeScale: eased * 0.018, nodeSpin: eased * 0.24, edgeBrightness: eased * 0.8, edgeWidth: eased * 0.65, trailLength: 2 + eased * 8, topologyMorph: 0.15 + eased * 0.52, collapseForce: eased * 0.12, facetOpacity: eased * 0.06, springStrength: 0.22 + eased * 0.48, motionScale: 0.08 + eased * 0.26 }
    case 'preDrop':
      return { networkSpread: -0.22 - eased * 0.16, nodeScale: -0.012, nodeSpin: -0.14, edgeBrightness: -0.18, edgeWidth: -0.35, trailLength: 2, topologyMorph: 0.42, collapseForce: 0.34 + eased * 0.34, facetOpacity: -0.05, springStrength: 0.62, motionScale: -0.12 }
    case 'drop':
      return { networkSpread: 0.38, nodeScale: 0.028, nodeSpin: 0.26, edgeBrightness: 1.05, edgeWidth: 0.85, trailLength: 7, topologyMorph: 0.32, collapseForce: -0.04, facetOpacity: 0.08, springStrength: 0.34, motionScale: 0.28 }
    case 'breakdown':
      return { networkSpread: -0.2, nodeScale: -0.014, nodeSpin: -0.18, edgeBrightness: -0.62, edgeWidth: -0.5, trailLength: -6, topologyMorph: -0.08, collapseForce: 0.04, facetOpacity: -0.16, springStrength: 0.04, motionScale: -0.3 }
    case 'bridge':
      return { networkSpread: -0.06 + eased * 0.12, nodeSpin: -0.08, edgeBrightness: -0.28, trailLength: -3, topologyMorph: 0.14 + eased * 0.16, springStrength: 0.12, motionScale: -0.12 }
    case 'outro':
      return { networkSpread: -0.18 - eased * 0.2, nodeScale: -0.018 - eased * 0.012, nodeSpin: -0.16, edgeBrightness: -0.45 - eased * 0.48, edgeWidth: -0.4, trailLength: -5 - eased * 5, topologyMorph: -0.1, collapseForce: 0.08 + eased * 0.18, facetOpacity: -0.1 - eased * 0.18, springStrength: 0.08, motionScale: -0.24 - eased * 0.2 }
    default:
      return { networkSpread: -0.02, edgeBrightness: -0.08, topologyMorph: 0.04 }
  }
}

function addOffsets(values: ReactiveConstellationRuntimeValues, offsets: ReactiveConstellationRuntimeOffsets | undefined): void {
  if (!offsets) return
  for (const key of Object.keys(offsets) as Array<keyof ReactiveConstellationRuntimeValues>) {
    const offset = offsets[key]
    if (typeof offset === 'number' && Number.isFinite(offset)) values[key] += offset
  }
}

function audioOffsets(modulation: CinematicModulationSnapshot | null | undefined): ReactiveConstellationRuntimeOffsets {
  const offsets: ReactiveConstellationRuntimeOffsets = {}
  for (const target of Object.keys(TARGET_SCALE) as CinematicAudioTarget[]) {
    const scale = TARGET_SCALE[target]
    if (scale == null) continue
    const value = cinematicModulationValue(modulation, target)
    const runtimeKey = target as keyof ReactiveConstellationRuntimeValues
    offsets[runtimeKey] = value * scale
  }
  // Existing projects that used generic cinematic targets remain musically valid.
  offsets.edgeBrightness = (offsets.edgeBrightness ?? 0) + cinematicModulationValue(modulation, 'environmentBrightness') * 1.8
  offsets.burstImpulse = (offsets.burstImpulse ?? 0) + Math.max(0, cinematicModulationValue(modulation, 'impact')) * 1.8
  return offsets
}

export function resolveReactiveConstellationComposition(
  input: ReactiveConstellationCompositionInput,
): ReactiveConstellationCompositionResult {
  const settings = input.settings
  const values: ReactiveConstellationRuntimeValues = {
    networkSpread: settings.networkSpread,
    nodeScale: settings.nodeScale,
    nodeSpin: settings.nodeSpin,
    edgeBrightness: settings.beamCoreBrightness,
    edgeWidth: settings.beamWidth,
    trailLength: settings.trailSamples,
    topologyMorph: 0,
    collapseForce: settings.collapseAmount,
    burstImpulse: 0,
    facetOpacity: settings.faceOpacity,
    springStrength: settings.springStrength,
    motionScale: clamp(input.motionScale ?? 1, 0, 2),
  }

  addOffsets(values, resolveReactiveConstellationChoreography(input.audio))
  addOffsets(values, audioOffsets(input.modulation))
  addOffsets(values, input.manualMacroOffsets)
  addOffsets(values, input.performanceActionEnvelopes)

  values.networkSpread = clamp(values.networkSpread, REACTIVE_CONSTELLATION_BOUNDS.networkSpread[0], REACTIVE_CONSTELLATION_BOUNDS.networkSpread[1])
  values.nodeScale = clamp(values.nodeScale, REACTIVE_CONSTELLATION_BOUNDS.nodeScale[0], REACTIVE_CONSTELLATION_BOUNDS.nodeScale[1])
  values.nodeSpin = clamp(values.nodeSpin, REACTIVE_CONSTELLATION_BOUNDS.nodeSpin[0], REACTIVE_CONSTELLATION_BOUNDS.nodeSpin[1])
  values.edgeBrightness = clamp(values.edgeBrightness, REACTIVE_CONSTELLATION_BOUNDS.beamCoreBrightness[0], REACTIVE_CONSTELLATION_BOUNDS.beamCoreBrightness[1])
  values.edgeWidth = clamp(values.edgeWidth, REACTIVE_CONSTELLATION_BOUNDS.beamWidth[0], REACTIVE_CONSTELLATION_BOUNDS.beamWidth[1])
  values.trailLength = Math.round(clamp(values.trailLength, REACTIVE_CONSTELLATION_BOUNDS.trailSamples[0], REACTIVE_CONSTELLATION_BOUNDS.trailSamples[1]))
  values.topologyMorph = clamp(values.topologyMorph, -1, 1)
  values.collapseForce = clamp(values.collapseForce, 0, REACTIVE_CONSTELLATION_BOUNDS.collapseAmount[1])
  values.burstImpulse = clamp(values.burstImpulse, 0, 2.5)
  values.facetOpacity = clamp(values.facetOpacity, REACTIVE_CONSTELLATION_BOUNDS.faceOpacity[0], REACTIVE_CONSTELLATION_BOUNDS.faceOpacity[1])
  values.springStrength = clamp(values.springStrength, REACTIVE_CONSTELLATION_BOUNDS.springStrength[0], REACTIVE_CONSTELLATION_BOUNDS.springStrength[1])
  values.motionScale = clamp(values.motionScale, 0, 2)

  return {
    values,
    sectionType: resolveReactiveConstellationSection(input.audio),
    compositionOrder: REACTIVE_CONSTELLATION_COMPOSITION_ORDER,
  }
}

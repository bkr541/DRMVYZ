import type { AfterhoursAudioIntelligenceState } from './AfterhoursAudioIntelligenceDirector'
import type { AfterhoursBeamDescriptor } from './AfterhoursBeamGeometry'
import { AFTERHOURS_VIRTUAL_STAGE_RIG } from './AfterhoursVirtualStageRig'

export const AFTERHOURS_VISUAL_ACCEPTANCE_METADATA_VERSION = 1 as const

export interface AfterhoursVisualAcceptanceSymmetryPair {
  readonly pairId: string
  readonly leftFixtureId: string | null
  readonly rightFixtureId: string | null
}

export interface AfterhoursVisualAcceptanceMetadata {
  readonly version: typeof AFTERHOURS_VISUAL_ACCEPTANCE_METADATA_VERSION
  readonly sceneId: string
  readonly previousSceneId: string
  readonly variation: number
  readonly previousVariation: number
  readonly transition: number
  readonly activeFixtureIds: readonly string[]
  readonly activeBanks: readonly string[]
  readonly requestedBeamCount: number
  readonly resolvedBeamCount: number
  readonly visibleBeamCount: number
  readonly symmetryPairs: readonly AfterhoursVisualAcceptanceSymmetryPair[]
  readonly centerAperture: Readonly<{ minX: number; maxX: number }>
  readonly endpointBounds: Readonly<{ minX: number; maxX: number; minY: number; maxY: number }>
  readonly motion: Readonly<{
    phase: number
    authority: number
    angularSpanDeg: number
    modes: readonly string[]
  }>
  readonly blackout: Readonly<{
    amount: number
    multiplier: number
  }>
  readonly masterIntensity: number
  readonly resolvedIntensity: number
  readonly bankWeights: Readonly<{ bottom: number; left: number; right: number; top: number }>
  readonly cue: Readonly<{
    sceneScale: string
    densityTier: string
    structuralOrdinal: number
    majorOrdinal: number
    sectionId: string | null
    sectionType: string | null
    beat: boolean
    downbeat: boolean
    kick: boolean
    snare: boolean
    sectionStart: boolean
    dropStart: boolean
  }>
}

export interface AfterhoursVisualAcceptancePublishInput {
  readonly direction: Readonly<AfterhoursAudioIntelligenceState>
  readonly beams: readonly AfterhoursBeamDescriptor[]
  readonly requestedBeamCount: number
  readonly masterIntensity: number
  readonly sectionId: string | null
  readonly sectionType: string | null
  readonly impulses: Readonly<{
    beat: boolean
    downbeat: boolean
    kick: boolean
    snare: boolean
    sectionStart: boolean
    dropStart: boolean
  }>
}

export type AfterhoursVisualAcceptanceObserver = (metadata: Readonly<AfterhoursVisualAcceptanceMetadata>) => void

let observer: AfterhoursVisualAcceptanceObserver | null = null

/**
 * Developer/test-only observation hook. The production renderer remains the
 * sole source of truth; normal Cinema UI never installs this observer.
 */
export function setAfterhoursVisualAcceptanceObserver(
  next: AfterhoursVisualAcceptanceObserver | null,
): () => void {
  observer = next
  return () => {
    if (observer === next) observer = null
  }
}

function rounded(value: number, places = 6): number {
  const scale = 10 ** places
  return Math.round(value * scale) / scale
}

function angularSpanDeg(beams: readonly AfterhoursBeamDescriptor[]): number {
  const angles = beams
    .filter(beam => beam.active && !beam.blanked)
    .map(beam => Math.atan2(beam.direction.y, beam.direction.x) * 180 / Math.PI)
  if (angles.length <= 1) return 0
  // Circular span: remove the largest empty gap and report the occupied arc.
  const sorted = [...angles].sort((a, b) => a - b)
  let largestGap = 0
  for (let index = 0; index < sorted.length; index += 1) {
    const current = sorted[index]!
    const next = index === sorted.length - 1 ? sorted[0]! + 360 : sorted[index + 1]!
    largestGap = Math.max(largestGap, next - current)
  }
  return rounded(360 - largestGap, 4)
}

function symmetryPairs(beams: readonly AfterhoursBeamDescriptor[]): readonly AfterhoursVisualAcceptanceSymmetryPair[] {
  const pairs = new Map<string, { leftFixtureId: string | null; rightFixtureId: string | null }>()
  for (const beam of beams) {
    if (!beam.active || !beam.symmetry) continue
    const current = pairs.get(beam.symmetry.pairId) ?? { leftFixtureId: null, rightFixtureId: null }
    if (beam.symmetry.side === 'left') current.leftFixtureId = beam.fixtureId
    if (beam.symmetry.side === 'right') current.rightFixtureId = beam.fixtureId
    pairs.set(beam.symmetry.pairId, current)
  }
  return Object.freeze([...pairs.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([pairId, pair]) => Object.freeze({ pairId, ...pair })))
}

export function createAfterhoursVisualAcceptanceMetadata(
  input: AfterhoursVisualAcceptancePublishInput,
): Readonly<AfterhoursVisualAcceptanceMetadata> {
  const active = input.beams.filter(beam => beam.active)
  const visible = active.filter(beam => !beam.blanked)
  const endpointBounds = visible.length > 0
    ? {
        minX: rounded(Math.min(...visible.map(beam => beam.endpoint.x))),
        maxX: rounded(Math.max(...visible.map(beam => beam.endpoint.x))),
        minY: rounded(Math.min(...visible.map(beam => beam.endpoint.y))),
        maxY: rounded(Math.max(...visible.map(beam => beam.endpoint.y))),
      }
    : { minX: 0, maxX: 0, minY: 0, maxY: 0 }
  const modes = Object.freeze([...new Set(visible.map(beam => beam.motion?.mode).filter((mode): mode is string => typeof mode === 'string'))].sort())
  const d = input.direction
  return Object.freeze({
    version: AFTERHOURS_VISUAL_ACCEPTANCE_METADATA_VERSION,
    sceneId: d.pattern,
    previousSceneId: d.previousPattern,
    variation: d.variation,
    previousVariation: d.previousVariation,
    transition: rounded(d.transition),
    activeFixtureIds: Object.freeze(active.map(beam => beam.fixtureId)),
    activeBanks: Object.freeze([...new Set(active.map(beam => beam.bank))].sort()),
    requestedBeamCount: input.requestedBeamCount,
    resolvedBeamCount: d.beamCount,
    visibleBeamCount: visible.length,
    symmetryPairs: symmetryPairs(active),
    centerAperture: AFTERHOURS_VIRTUAL_STAGE_RIG.centerAperture,
    endpointBounds: Object.freeze(endpointBounds),
    motion: Object.freeze({
      phase: rounded(d.motionPhase),
      authority: rounded(d.motionAuthority),
      angularSpanDeg: angularSpanDeg(visible),
      modes,
    }),
    blackout: Object.freeze({ amount: rounded(d.blackout), multiplier: rounded(1 - d.blackout) }),
    masterIntensity: rounded(input.masterIntensity),
    resolvedIntensity: rounded(d.intensity),
    bankWeights: Object.freeze({
      bottom: rounded(d.bankWeights.bottom),
      left: rounded(d.bankWeights.left),
      right: rounded(d.bankWeights.right),
      top: rounded(d.bankWeights.top),
    }),
    cue: Object.freeze({
      sceneScale: d.sceneScale,
      densityTier: d.densityTier,
      structuralOrdinal: d.structuralOrdinal,
      majorOrdinal: d.majorOrdinal,
      sectionId: input.sectionId,
      sectionType: input.sectionType,
      ...input.impulses,
    }),
  })
}

export function publishAfterhoursVisualAcceptanceMetadata(
  input: AfterhoursVisualAcceptancePublishInput,
): void {
  if (!observer) return
  observer(createAfterhoursVisualAcceptanceMetadata(input))
}

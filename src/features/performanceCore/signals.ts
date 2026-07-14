import type { SemanticMomentMarker } from '../musicIntelligence/types'
import type { SharedPerformanceContext } from './context'

export type SharedPerformanceDiscreteEventKind =
  | 'beat'
  | 'downbeat'
  | 'kick'
  | 'snare'
  | 'hat'
  | 'transient'
  | 'barEntry'
  | 'fourBarBoundary'
  | 'eightBarBoundary'
  | 'sixteenBarBoundary'
  | 'sectionEntry'
  | 'sectionExit'
  | 'dropImpact'
  | 'semanticMoment'

export interface SharedPerformanceDiscreteEvent {
  active: boolean
  strength: number
}

export interface SharedPerformanceDiscreteSignals {
  beat: SharedPerformanceDiscreteEvent
  downbeat: SharedPerformanceDiscreteEvent
  kick: SharedPerformanceDiscreteEvent
  snare: SharedPerformanceDiscreteEvent
  hat: SharedPerformanceDiscreteEvent
  transient: SharedPerformanceDiscreteEvent
  barEntry: SharedPerformanceDiscreteEvent
  fourBarBoundary: SharedPerformanceDiscreteEvent
  eightBarBoundary: SharedPerformanceDiscreteEvent
  sixteenBarBoundary: SharedPerformanceDiscreteEvent
  sectionEntry: SharedPerformanceDiscreteEvent
  sectionExit: SharedPerformanceDiscreteEvent
  dropImpact: SharedPerformanceDiscreteEvent
  semanticMoment: SharedPerformanceDiscreteEvent & { moment: SemanticMomentMarker | null }
}

export interface SharedPerformanceContinuousSignals {
  bass: number
  mid: number
  high: number
  energy: number
  trackRelativeEnergy: number
  spectralFlux: number
  tension: number
  complexity: number
  buildProgress: number
  sectionProgress: number
  macroSectionProgress: number
  phraseProgress: number
  vocalEnergy: number
}

export interface SharedPerformanceSignalFrame {
  discrete: SharedPerformanceDiscreteSignals
  continuous: SharedPerformanceContinuousSignals
}

function event(active: boolean, strength = active ? 1 : 0): SharedPerformanceDiscreteEvent {
  return { active, strength: Math.max(0, Math.min(1, Number.isFinite(strength) ? strength : 0)) }
}

/**
 * Converts the authoritative context into an engine-neutral signal frame. This
 * is the only bridge future adapters need for discrete-event versus continuous
 * modulation semantics.
 */
export function resolveSharedPerformanceSignals(context: SharedPerformanceContext): SharedPerformanceSignalFrame {
  const secondsPerBeat = context.bpm > 0 ? 60 / context.bpm : 0.5
  const nextMoment = context.upcomingSemanticMoments[0] ?? null
  const semanticMomentActive = Boolean(nextMoment && (
    nextMoment.timeSec <= context.audioTimeSec + Math.max(0.02, secondsPerBeat * 0.125)
    && nextMoment.timeSec + Math.max(0.02, nextMoment.durationSec ?? 0) >= context.audioTimeSec
  ))
  return {
    discrete: {
      beat: event(context.boundaries.beatBoundary || context.intelligence.rhythm.beatHit),
      downbeat: event(context.downbeat && (context.boundaries.beatBoundary || context.intelligence.rhythm.downbeatHit)),
      kick: event(context.kick, context.kickStrength),
      snare: event(context.snare, context.snareStrength),
      hat: event(context.hat, context.hatStrength),
      transient: event(context.transient > 0, context.transient),
      barEntry: event(context.boundaries.barBoundary),
      fourBarBoundary: event(context.boundaries.performanceFourBarBoundary),
      eightBarBoundary: event(context.boundaries.performanceEightBarBoundary),
      sixteenBarBoundary: event(context.boundaries.performanceSixteenBarBoundary),
      sectionEntry: event(context.boundaries.sectionEntry),
      sectionExit: event(context.boundaries.sectionExit),
      dropImpact: event(context.dropImpact > 0, context.dropImpact),
      semanticMoment: { ...event(semanticMomentActive, nextMoment?.confidence ?? 0), moment: semanticMomentActive ? nextMoment : null },
    },
    continuous: {
      bass: context.bass,
      mid: context.mid,
      high: context.high,
      energy: context.energy,
      trackRelativeEnergy: context.trackRelativeEnergy,
      spectralFlux: context.spectralFlux,
      tension: context.tension,
      complexity: context.complexity,
      buildProgress: context.buildProgress,
      sectionProgress: context.sectionProgress,
      macroSectionProgress: context.macroSectionProgress,
      phraseProgress: context.phraseProgress,
      vocalEnergy: context.vocalEnergy,
    },
  }
}

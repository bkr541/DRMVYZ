import type { SharedPerformanceContext } from '../../../../../features/performanceCore'

export interface ShiftgridAudioFrame {
  runtimeIdentity: string
  absoluteBeat: number
  absoluteBar: number
  phraseIndex: number
  sectionIdentity: string
  beatBoundary: boolean
  barBoundary: boolean
  fourBarBoundary: boolean
  eightBarBoundary: boolean
  sectionBoundary: boolean
  drop: boolean
  bass: number
  transient: number
  energy: number
}

/** Reads the Shared Performance frame; SHIFTGRID never creates a second audio-analysis path. */
export function resolveShiftgridAudioFrame(context: SharedPerformanceContext): ShiftgridAudioFrame {
  return Object.freeze({
    runtimeIdentity: context.runtimeIdentity,
    absoluteBeat: context.absoluteBeat,
    absoluteBar: context.absoluteBar,
    phraseIndex: context.phraseIndex,
    sectionIdentity: context.sectionIdentity,
    beatBoundary: context.boundaries.beatBoundary,
    barBoundary: context.boundaries.barBoundary,
    fourBarBoundary: context.boundaries.fourBarBoundary,
    eightBarBoundary: context.boundaries.eightBarBoundary,
    sectionBoundary: context.boundaries.sectionEntry,
    drop: context.dropImpact > 0.55 && (context.boundaries.sectionEntry || context.boundaries.beatBoundary),
    bass: context.bass,
    transient: context.transient,
    energy: context.trackRelativeEnergy,
  })
}

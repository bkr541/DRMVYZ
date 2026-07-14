import type { SharedPerformanceContext } from './context'

export type SharedPerformanceDiagnosticsEngine = 'laserDmx' | 'soundDrawing' | 'canvas'

export interface SharedPerformanceDiagnosticsSnapshot {
  engine: SharedPerformanceDiagnosticsEngine
  active: boolean
  performanceShow: string | null
  scene: string | null
  section: string
  sectionFamily: string | null
  sectionOccurrence: number
  dropOccurrence: number
  barWithinSection: number
  fourBarStage: number
  eightBarStage: number
  sixteenBarStage: number
  motifOrComposition: string | null
  activeLayers: readonly string[]
  activeEventEnvelopes: readonly string[]
  recentActions: readonly string[]
  continuousRoutes: readonly string[]
  upcomingSemanticMoment: string | null
  lockedParameters: readonly string[]
  fallbackState: string | null
  capabilityLimitations: readonly string[]
  confidenceLimitations: readonly string[]
  resourceLimitDecisions: readonly string[]
  runtimeIdentity: string
}

export interface CreateSharedPerformanceDiagnosticsInput {
  engine: SharedPerformanceDiagnosticsEngine
  active?: boolean
  performanceShow?: string | null
  scene?: string | null
  motifOrComposition?: string | null
  activeLayers?: readonly string[]
  activeEventEnvelopes?: readonly string[]
  recentActions?: readonly string[]
  continuousRoutes?: readonly string[]
  lockedParameters?: readonly string[]
  fallbackState?: string | null
  resourceLimitDecisions?: readonly string[]
}

const CAPABILITY_LABELS: Record<keyof SharedPerformanceContext['capabilities'], string> = {
  liveBands: 'Live bands unavailable',
  rhythmEvents: 'Transient events unavailable',
  beatGrid: 'Beat grid unavailable',
  sections: 'Resolved sections unavailable',
  trackEnergyCurve: 'Track energy curve unavailable',
  stemCurves: 'Stem curves unavailable',
  lyrics: 'Timed lyrics unavailable',
}

export function createSharedPerformanceDiagnostics(
  context: SharedPerformanceContext,
  input: CreateSharedPerformanceDiagnosticsInput,
): SharedPerformanceDiagnosticsSnapshot {
  const capabilityLimitations = (Object.keys(context.capabilities) as Array<keyof typeof context.capabilities>)
    .filter(key => !context.capabilities[key])
    .map(key => CAPABILITY_LABELS[key])
  const confidenceLimitations: string[] = []
  if (context.confidence.overall < 0.35) confidenceLimitations.push('Overall analysis confidence is low')
  if (context.confidence.section < 0.35) confidenceLimitations.push('Section choreography is using safe fallback')
  if (context.confidence.grid < 0.35) confidenceLimitations.push('Grid confidence is low')
  if (context.confidence.semantics < 0.4) confidenceLimitations.push('Anticipatory semantic choreography is limited')
  const nextMoment = context.upcomingSemanticMoments[0]
  return {
    engine: input.engine,
    active: input.active ?? true,
    performanceShow: input.performanceShow ?? null,
    scene: input.scene ?? null,
    section: context.macroSectionType ?? context.sectionType ?? 'unknown',
    sectionFamily: context.sectionFamily,
    sectionOccurrence: context.sectionOccurrence,
    dropOccurrence: context.dropOccurrence,
    barWithinSection: context.barWithinMacroSection,
    fourBarStage: context.performanceFourBarBlockIndex + 1,
    eightBarStage: context.performanceEightBarBlockIndex + 1,
    sixteenBarStage: context.performanceSixteenBarBlockIndex + 1,
    motifOrComposition: input.motifOrComposition ?? null,
    activeLayers: [...(input.activeLayers ?? [])],
    activeEventEnvelopes: [...(input.activeEventEnvelopes ?? [])],
    recentActions: [...(input.recentActions ?? [])].slice(-8),
    continuousRoutes: [...(input.continuousRoutes ?? [])],
    upcomingSemanticMoment: nextMoment ? `${nextMoment.label ?? nextMoment.type} @ ${nextMoment.timeSec.toFixed(2)}s` : null,
    lockedParameters: [...(input.lockedParameters ?? [])],
    fallbackState: input.fallbackState ?? null,
    capabilityLimitations,
    confidenceLimitations,
    resourceLimitDecisions: [...(input.resourceLimitDecisions ?? [])],
    runtimeIdentity: context.runtimeIdentity,
  }
}

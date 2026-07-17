import { useSyncExternalStore } from 'react'
import { createSharedPerformanceDiagnostics } from '../../../features/performanceCore'
import type { LaserDmxShowDirectorPerformanceSectionType } from './LaserDmxShowDirectorPerformanceProgram'
import type { LaserDmxShowDirectorPerformanceTimingContext } from './LaserDmxShowDirectorPerformanceContext'
import { clearSharedPerformanceDiagnostics, publishSharedPerformanceDiagnostics } from './SharedPerformanceDiagnosticsStore'
import {
  createRigBackedPerformanceEffectCountReport,
  type LaserDmxShowDirectorRigPerformanceEffectCountReport,
} from './LaserDmxShowDirectorRigPerformanceInspection'
import type {
  LaserDmxShowDirectorPerformanceAnalysisStatus,
  LaserDmxShowDirectorPerformanceResolution,
} from './LaserDmxShowDirectorPerformanceResolver'

export interface LaserDmxShowDirectorPerformanceRuntimeStatusSnapshot {
  active: boolean
  performanceShowName: string | null
  section: LaserDmxShowDirectorPerformanceSectionType
  sectionOccurrence: number
  scene: string | null
  variation: string | null
  fourBarVariation: string | null
  eightBarRecruitmentStage: number
  activeFixtureGroupCount: number
  estimatedBeamDemand: number
  boundedBeamDemand: number
  effectCountReport: LaserDmxShowDirectorRigPerformanceEffectCountReport | null
  analysisReady: boolean
  analysisStatus: LaserDmxShowDirectorPerformanceAnalysisStatus
  missingCapabilities: string[]
  fallbackOrSuppressionReason: string | null
  beamBudgetWarning: string | null
  activePrimaryCueId: string | null
  activeAccentCueIds: string[]
  cueStartBeat: number
  cueRemainingBeats: number
  activeMacroId: string | null
  activeMacroName: string | null
  fixtureGroupRelationships: string[]
  stablePatternFrameId: string | null
  patternFrameRevisionCount: number
  macroTransitionState: string
  audioModulationValues: Record<string, number>
  geometryRebuildCount: number
  patternFrameCacheHits: number
  patternFrameCacheMisses: number
  raySlotCount: number
  topologyChangesPerCue: number
  fixtureGroupSynchronizationStatus: string
  conflictingOverrides: string[]
  audioModulationBoundaries: string[]
  unexpectedTopologyChanges: number
  suppressedAudioGeometryMappings: string[]
  programmingWarnings: string[]
  programmingCompatibilitySource: string
  boundaryIdentity: string
}

const EMPTY_SNAPSHOT: LaserDmxShowDirectorPerformanceRuntimeStatusSnapshot = Object.freeze({
  active: false,
  performanceShowName: null,
  section: 'unknown',
  sectionOccurrence: 0,
  scene: null,
  variation: null,
  fourBarVariation: null,
  eightBarRecruitmentStage: 0,
  activeFixtureGroupCount: 0,
  estimatedBeamDemand: 0,
  boundedBeamDemand: 0,
  effectCountReport: null,
  analysisReady: false,
  analysisStatus: 'fallback',
  missingCapabilities: [],
  fallbackOrSuppressionReason: null,
  beamBudgetWarning: null,
  activePrimaryCueId: null,
  activeAccentCueIds: [],
  cueStartBeat: 0,
  cueRemainingBeats: 0,
  activeMacroId: null,
  activeMacroName: null,
  fixtureGroupRelationships: [],
  stablePatternFrameId: null,
  patternFrameRevisionCount: 0,
  macroTransitionState: 'inactive',
  audioModulationValues: {},
  geometryRebuildCount: 0,
  patternFrameCacheHits: 0,
  patternFrameCacheMisses: 0,
  raySlotCount: 0,
  topologyChangesPerCue: 0,
  fixtureGroupSynchronizationStatus: 'inactive',
  conflictingOverrides: [],
  audioModulationBoundaries: [],
  unexpectedTopologyChanges: 0,
  suppressedAudioGeometryMappings: [],
  programmingWarnings: [],
  programmingCompatibilitySource: 'inactive',
  boundaryIdentity: 'inactive',
})

let snapshot = EMPTY_SNAPSHOT
const listeners = new Set<() => void>()

function statusFingerprint(value: LaserDmxShowDirectorPerformanceRuntimeStatusSnapshot): string {
  return [
    value.active,
    value.performanceShowName,
    value.section,
    value.sectionOccurrence,
    value.scene,
    value.variation,
    value.fourBarVariation,
    value.eightBarRecruitmentStage,
    value.activeFixtureGroupCount,
    value.estimatedBeamDemand,
    value.boundedBeamDemand,
    value.effectCountReport ? JSON.stringify(value.effectCountReport) : '',
    value.analysisReady,
    value.analysisStatus,
    value.missingCapabilities.join(','),
    value.fallbackOrSuppressionReason,
    value.beamBudgetWarning,
    value.activePrimaryCueId,
    value.activeAccentCueIds.join(','),
    value.cueStartBeat,
    value.cueRemainingBeats,
    value.activeMacroId,
    value.activeMacroName,
    value.fixtureGroupRelationships.join(','),
    value.stablePatternFrameId,
    value.patternFrameRevisionCount,
    value.macroTransitionState,
    JSON.stringify(value.audioModulationValues),
    value.geometryRebuildCount,
    value.patternFrameCacheHits,
    value.patternFrameCacheMisses,
    value.raySlotCount,
    value.topologyChangesPerCue,
    value.fixtureGroupSynchronizationStatus,
    value.conflictingOverrides.join(','),
    value.audioModulationBoundaries.join(','),
    value.unexpectedTopologyChanges,
    value.suppressedAudioGeometryMappings.join(','),
    value.programmingWarnings.join(','),
    value.programmingCompatibilitySource,
    value.boundaryIdentity,
  ].join('|')
}

export function publishLaserDmxShowDirectorPerformanceRuntimeStatus(
  performanceShowName: string,
  resolution: LaserDmxShowDirectorPerformanceResolution,
  performanceShowId?: string | null,
  context?: LaserDmxShowDirectorPerformanceTimingContext | null,
): void {
  const next: LaserDmxShowDirectorPerformanceRuntimeStatusSnapshot = {
    active: resolution.activeSceneId !== null,
    performanceShowName,
    section: resolution.currentSection,
    sectionOccurrence: resolution.currentSectionOccurrence,
    scene: resolution.activeSceneLabel ?? resolution.activeSceneId,
    variation: resolution.activeVariation,
    fourBarVariation: resolution.fourBarVariation,
    eightBarRecruitmentStage: resolution.eightBarRecruitmentStage,
    activeFixtureGroupCount: resolution.activeGroupKeys.length,
    estimatedBeamDemand: resolution.estimatedBeamDemand,
    boundedBeamDemand: resolution.boundedBeamDemand,
    effectCountReport: performanceShowId
      ? createRigBackedPerformanceEffectCountReport(performanceShowId, resolution.showDirector)
      : null,
    analysisReady: resolution.diagnostics.analysisReady,
    analysisStatus: resolution.diagnostics.analysisStatus,
    missingCapabilities: [...resolution.diagnostics.missingCapabilities],
    fallbackOrSuppressionReason: resolution.diagnostics.suppressionReason ?? resolution.diagnostics.fallbackReason,
    beamBudgetWarning: resolution.diagnostics.beamBudgetWarning,
    activePrimaryCueId: resolution.activePrimaryCueId ?? null,
    activeAccentCueIds: [...(resolution.activeAccentCueIds ?? [])],
    cueStartBeat: resolution.programmingDiagnostics?.cueStartBeat ?? 0,
    cueRemainingBeats: resolution.programmingDiagnostics?.cueRemainingBeats ?? 0,
    activeMacroId: resolution.activeMacroId ?? null,
    activeMacroName: resolution.activeMacroName ?? null,
    fixtureGroupRelationships: [...(resolution.programmingDiagnostics?.fixtureGroupRelationships ?? [])],
    stablePatternFrameId: resolution.stablePatternFrame?.id ?? resolution.programmingDiagnostics?.stablePatternFrameId ?? null,
    patternFrameRevisionCount: resolution.programmingDiagnostics?.patternFrameRevisionCount ?? 0,
    macroTransitionState: resolution.programmingDiagnostics?.transitionState ?? 'inactive',
    audioModulationValues: { ...(resolution.programmingDiagnostics?.audioModulationValues ?? {}) },
    geometryRebuildCount: resolution.programmingDiagnostics?.geometryRebuildCount ?? 0,
    patternFrameCacheHits: resolution.programmingDiagnostics?.patternFrameCacheHits ?? 0,
    patternFrameCacheMisses: resolution.programmingDiagnostics?.patternFrameCacheMisses ?? 0,
    raySlotCount: resolution.programmingDiagnostics?.raySlotCount ?? 0,
    topologyChangesPerCue: resolution.programmingDiagnostics?.topologyChangesPerCue ?? 0,
    fixtureGroupSynchronizationStatus: resolution.programmingDiagnostics?.fixtureGroupSynchronizationStatus ?? 'inactive',
    conflictingOverrides: [...(resolution.programmingDiagnostics?.conflictingOverrides ?? [])],
    audioModulationBoundaries: [...(resolution.programmingDiagnostics?.audioModulationBoundaries ?? [])],
    unexpectedTopologyChanges: resolution.programmingDiagnostics?.unexpectedTopologyChanges ?? 0,
    suppressedAudioGeometryMappings: [...(resolution.diagnostics.suppressedAudioGeometryMappings ?? [])],
    programmingWarnings: (resolution.programmingDiagnostics?.warnings ?? []).map(warning => warning.message),
    programmingCompatibilitySource: resolution.programmingDiagnostics?.compatibilitySource ?? 'inactive',
    boundaryIdentity: [
      resolution.currentSection,
      resolution.currentSectionOccurrence,
      resolution.activeSceneId,
      resolution.activeVariation,
      resolution.fourBarVariation,
      resolution.eightBarRecruitmentStage,
      resolution.activeGroupKeys.join(','),
      resolution.estimatedBeamDemand,
      performanceShowId ?? '',
      resolution.diagnostics.analysisReady,
      resolution.diagnostics.analysisStatus,
      resolution.diagnostics.missingCapabilities.join(','),
      resolution.diagnostics.fallbackReason,
      resolution.diagnostics.suppressionReason,
      resolution.activePrimaryCueId,
      resolution.activeAccentCueIds?.join(','),
      resolution.activeMacroId,
      resolution.stablePatternFrame?.id,
      resolution.programmingDiagnostics?.patternFrameRevisionCount,
      resolution.programmingDiagnostics?.transitionState,
      resolution.programmingDiagnostics?.unexpectedTopologyChanges,
      resolution.diagnostics.suppressedAudioGeometryMappings?.join(','),
    ].join('|'),
  }
  if (context) {
    publishSharedPerformanceDiagnostics(createSharedPerformanceDiagnostics(context, {
      engine: 'laserDmx',
      performanceShow: performanceShowName,
      scene: resolution.activeSceneLabel ?? resolution.activeSceneId,
      motifOrComposition: resolution.fourBarVariation ?? resolution.activeVariation ?? resolution.activeMotifFamily ?? null,
      activeLayers: resolution.activeGroupKeys,
      activeEventEnvelopes: [
        context.kick ? 'kick' : null,
        context.snare ? 'snare' : null,
        context.hat ? 'hat' : null,
        context.downbeat && context.boundaries.beatBoundary ? 'downbeat' : null,
      ].filter((value): value is string => Boolean(value)),
      recentActions: [resolution.fourBarVariation, resolution.activeVariation, resolution.energyEnvelopeKey].filter((value): value is string => Boolean(value)),
      continuousRoutes: resolution.energyEnvelopeKey ? [resolution.energyEnvelopeKey] : [],
      fallbackState: resolution.diagnostics.suppressionReason ?? resolution.diagnostics.fallbackReason,
      resourceLimitDecisions: [
        resolution.estimatedBeamDemand > resolution.boundedBeamDemand ? `Beam demand clamped ${resolution.estimatedBeamDemand} → ${resolution.boundedBeamDemand}` : null,
        resolution.diagnostics.beamBudgetWarning,
      ].filter((value): value is string => Boolean(value)),
    }))
  }
  if (statusFingerprint(next) === statusFingerprint(snapshot)) return
  snapshot = Object.freeze(next)
  listeners.forEach(listener => listener())
}

export function clearLaserDmxShowDirectorPerformanceRuntimeStatus(): void {
  clearSharedPerformanceDiagnostics('laserDmx')
  if (snapshot === EMPTY_SNAPSHOT || statusFingerprint(snapshot) === statusFingerprint(EMPTY_SNAPSHOT)) return
  snapshot = EMPTY_SNAPSHOT
  listeners.forEach(listener => listener())
}

export function getLaserDmxShowDirectorPerformanceRuntimeStatus(): LaserDmxShowDirectorPerformanceRuntimeStatusSnapshot {
  return snapshot
}

export function subscribeLaserDmxShowDirectorPerformanceRuntimeStatus(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useLaserDmxShowDirectorPerformanceRuntimeStatus(): LaserDmxShowDirectorPerformanceRuntimeStatusSnapshot {
  return useSyncExternalStore(
    subscribeLaserDmxShowDirectorPerformanceRuntimeStatus,
    getLaserDmxShowDirectorPerformanceRuntimeStatus,
    () => EMPTY_SNAPSHOT,
  )
}

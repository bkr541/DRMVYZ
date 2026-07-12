import { useSyncExternalStore } from 'react'
import type { LaserDmxShowDirectorPerformanceSectionType } from './LaserDmxShowDirectorPerformanceProgram'
import type { LaserDmxShowDirectorPerformanceResolution } from './LaserDmxShowDirectorPerformanceResolver'

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
  analysisReady: boolean
  fallbackOrSuppressionReason: string | null
  beamBudgetWarning: string | null
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
  analysisReady: false,
  fallbackOrSuppressionReason: null,
  beamBudgetWarning: null,
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
    value.analysisReady,
    value.fallbackOrSuppressionReason,
    value.beamBudgetWarning,
    value.boundaryIdentity,
  ].join('|')
}

export function publishLaserDmxShowDirectorPerformanceRuntimeStatus(
  performanceShowName: string,
  resolution: LaserDmxShowDirectorPerformanceResolution,
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
    analysisReady: resolution.diagnostics.analysisReady,
    fallbackOrSuppressionReason: resolution.diagnostics.suppressionReason ?? resolution.diagnostics.fallbackReason,
    beamBudgetWarning: resolution.diagnostics.beamBudgetWarning,
    boundaryIdentity: [
      resolution.currentSection,
      resolution.currentSectionOccurrence,
      resolution.activeSceneId,
      resolution.activeVariation,
      resolution.fourBarVariation,
      resolution.eightBarRecruitmentStage,
      resolution.activeGroupKeys.join(','),
      resolution.estimatedBeamDemand,
      resolution.diagnostics.analysisReady,
      resolution.diagnostics.fallbackReason,
      resolution.diagnostics.suppressionReason,
    ].join('|'),
  }
  if (statusFingerprint(next) === statusFingerprint(snapshot)) return
  snapshot = Object.freeze(next)
  listeners.forEach(listener => listener())
}

export function clearLaserDmxShowDirectorPerformanceRuntimeStatus(): void {
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

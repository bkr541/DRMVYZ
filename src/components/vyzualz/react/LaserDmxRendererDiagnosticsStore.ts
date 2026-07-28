import { useSyncExternalStore } from 'react'
import type { LaserDmxRendererFallbackCode } from './renderers/laserDmx/LaserDmxRendererBackend'
import type { LaserDmxWebGLFailureClassification } from './renderers/laserDmx/LaserDmxWebGLRecovery'
import type { LaserDmxScannerCompatibilityMode } from './renderers/laserDmx/LaserDmxScannerDomain'
import type {
  LaserDmxShowDirectorPresentationMode,
  LaserDmxShowDirectorScannerPatternType,
  LaserDmxShowDirectorRendererMode,
  LaserDmxShowDirectorWebGLQuality,
} from './ReactTypes'

export type LaserDmxActiveRenderer = 'inactive' | 'webgl' | 'canvas2d'

export interface LaserDmxRendererDiagnosticsSnapshot {
  activeRenderer: LaserDmxActiveRenderer
  requestedRenderer: LaserDmxShowDirectorRendererMode
  presentationMode: LaserDmxShowDirectorPresentationMode
  authoredShowDimmer: number
  previewOutputTrim: number
  safetyClamp: number
  resolvedPreviewIntensity: number
  resolvedHardwareIntensity: number
  authoredShowGlow: number
  previewGlowTrim: number
  resolvedPreviewGlow: number
  resolvedHardwareGlow: number
  webgl2Available: boolean | null
  floatTargetsAvailable: boolean
  requestedQuality: LaserDmxShowDirectorWebGLQuality
  effectiveQuality: Exclude<LaserDmxShowDirectorWebGLQuality, 'auto'> | null
  atmosphereQuality: Exclude<LaserDmxShowDirectorWebGLQuality, 'auto'> | null
  renderWidth: number
  renderHeight: number
  atmosphereWidth: number
  atmosphereHeight: number
  atmosphereSampleCount: number
  activeBeamCount: number
  requestedBeamCount: number
  activeFixtureCount: number
  scannerHeadCount: number
  selectedScannerHeadId: string | null
  activeScannerPattern: LaserDmxShowDirectorScannerPatternType | null
  scannerPointCount: number
  visibleScannerSegmentCount: number
  blankedScannerSegmentCount: number
  orderedPathCount: number
  exposureSampleCount: number
  rawExposureSampleCount: number
  aggregatedRayCount: number
  scannerEnergyBeforeAggregation: number
  scannerEnergyAfterAggregation: number
  macroControlledPathCount: number
  duplicateRenderingFixtureIds: string[]
  legacyConvertedPathCount: number
  explicitOpticalCopyCount: number
  scannerApertureCount: number
  scannerDwellTotalMicros: number
  currentScanRatePps: number
  blankedScannerSampleCount: number
  scannerValidationErrorCount: number
  scannerCompatibilityMode: LaserDmxScannerCompatibilityMode
  scannerMigrationStatus: 'native' | 'legacy' | 'migrated' | 'mixed' | 'inactive'
  retraceScannerSegmentCount: number
  averageScannerVelocity: number
  averageScannerDwellWeight: number
  averageScannerExposureWeight: number
  averageScannerHistoryWeight: number
  normalizedScannerFixtureEnergy: number
  currentScannerCueOwner: string | null
  stableScannerPathCount: number
  animatedScannerPathCount: number
  cpuFrameMs: number | null
  gpuFrameMs: number | null
  hdrMode: 'rgba16f' | 'rgba8' | 'none'
  bloomLevels: number
  temporalHistoryActive: boolean
  laserHistoryInputCount: number
  laserHistorySliceCount: number
  depthMode: 'continuous-slices' | 'binary-fallback' | 'none'
  depthSliceCount: number
  depthBufferStatus: 'slice-accumulation' | 'binary-fallback' | 'inactive'
  fallbackCode: LaserDmxRendererFallbackCode | null
  fallbackReason: string | null
  qualityAdjustmentReason: string | null
  contextLossCount: number
  postProcessingStatus: 'inactive' | 'hdr' | 'ldr-fallback'
  lastWebGLFailure: string | null
  failureClassification: LaserDmxWebGLFailureClassification | null
  retryCount: number
  nextAutomaticRetryMs: number | null
  lastSuccessfulInitializationMs: number | null
  manualRetryAvailable: boolean
  manualRetryAvailableAtMs: number | null
  finalFallbackReason: string | null
}

const EMPTY_SNAPSHOT: LaserDmxRendererDiagnosticsSnapshot = Object.freeze({
  activeRenderer: 'inactive',
  requestedRenderer: 'auto',
  presentationMode: 'edit',
  authoredShowDimmer: 1,
  previewOutputTrim: 1,
  safetyClamp: 1,
  resolvedPreviewIntensity: 1,
  resolvedHardwareIntensity: 1,
  authoredShowGlow: 0,
  previewGlowTrim: 1,
  resolvedPreviewGlow: 0,
  resolvedHardwareGlow: 0,
  webgl2Available: null,
  floatTargetsAvailable: false,
  requestedQuality: 'high',
  effectiveQuality: null,
  atmosphereQuality: null,
  renderWidth: 0,
  renderHeight: 0,
  atmosphereWidth: 0,
  atmosphereHeight: 0,
  atmosphereSampleCount: 0,
  activeBeamCount: 0,
  requestedBeamCount: 0,
  activeFixtureCount: 0,
  scannerHeadCount: 0,
  selectedScannerHeadId: null,
  activeScannerPattern: null,
  scannerPointCount: 0,
  visibleScannerSegmentCount: 0,
  blankedScannerSegmentCount: 0,
  orderedPathCount: 0,
  exposureSampleCount: 0,
  rawExposureSampleCount: 0,
  aggregatedRayCount: 0,
  scannerEnergyBeforeAggregation: 0,
  scannerEnergyAfterAggregation: 0,
  macroControlledPathCount: 0,
  duplicateRenderingFixtureIds: [],
  legacyConvertedPathCount: 0,
  explicitOpticalCopyCount: 0,
  scannerApertureCount: 0,
  scannerDwellTotalMicros: 0,
  currentScanRatePps: 0,
  blankedScannerSampleCount: 0,
  scannerValidationErrorCount: 0,
  scannerCompatibilityMode: 'inactive',
  scannerMigrationStatus: 'inactive',
  retraceScannerSegmentCount: 0,
  averageScannerVelocity: 0,
  averageScannerDwellWeight: 0,
  averageScannerExposureWeight: 0,
  averageScannerHistoryWeight: 0,
  normalizedScannerFixtureEnergy: 0,
  currentScannerCueOwner: null,
  stableScannerPathCount: 0,
  animatedScannerPathCount: 0,
  cpuFrameMs: null,
  gpuFrameMs: null,
  hdrMode: 'none',
  bloomLevels: 0,
  temporalHistoryActive: false,
  laserHistoryInputCount: 0,
  laserHistorySliceCount: 0,
  depthMode: 'none',
  depthSliceCount: 0,
  depthBufferStatus: 'inactive',
  fallbackCode: null,
  fallbackReason: null,
  qualityAdjustmentReason: null,
  contextLossCount: 0,
  postProcessingStatus: 'inactive',
  lastWebGLFailure: null,
  failureClassification: null,
  retryCount: 0,
  nextAutomaticRetryMs: null,
  lastSuccessfulInitializationMs: null,
  manualRetryAvailable: false,
  manualRetryAvailableAtMs: null,
  finalFallbackReason: null,
})

let snapshot = EMPTY_SNAPSHOT
let manualRetryRequestSequence = 0
let lastPublishMs = Number.NEGATIVE_INFINITY
const listeners = new Set<() => void>()

function roundedTiming(value: number | null): number | null {
  return value == null || !Number.isFinite(value) ? null : Math.round(value * 2) / 2
}

function structuralFingerprint(value: LaserDmxRendererDiagnosticsSnapshot): string {
  return [
    value.activeRenderer,
    value.requestedRenderer,
    value.presentationMode,
    value.authoredShowDimmer,
    value.previewOutputTrim,
    value.safetyClamp,
    value.resolvedPreviewIntensity,
    value.resolvedHardwareIntensity,
    value.authoredShowGlow,
    value.previewGlowTrim,
    value.resolvedPreviewGlow,
    value.resolvedHardwareGlow,
    value.webgl2Available,
    value.floatTargetsAvailable,
    value.requestedQuality,
    value.effectiveQuality,
    value.atmosphereQuality,
    value.renderWidth,
    value.renderHeight,
    value.atmosphereWidth,
    value.atmosphereHeight,
    value.atmosphereSampleCount,
    value.activeBeamCount,
    value.requestedBeamCount,
    value.activeFixtureCount,
    value.scannerHeadCount,
    value.selectedScannerHeadId,
    value.activeScannerPattern,
    value.scannerPointCount,
    value.visibleScannerSegmentCount,
    value.blankedScannerSegmentCount,
    value.orderedPathCount,
    value.exposureSampleCount,
    value.rawExposureSampleCount,
    value.aggregatedRayCount,
    value.scannerEnergyBeforeAggregation,
    value.scannerEnergyAfterAggregation,
    value.macroControlledPathCount,
    value.duplicateRenderingFixtureIds.join(','),
    value.legacyConvertedPathCount,
    value.explicitOpticalCopyCount,
    value.scannerApertureCount,
    value.scannerDwellTotalMicros,
    value.currentScanRatePps,
    value.blankedScannerSampleCount,
    value.scannerValidationErrorCount,
    value.scannerCompatibilityMode,
    value.scannerMigrationStatus,
    value.retraceScannerSegmentCount,
    value.averageScannerVelocity,
    value.averageScannerDwellWeight,
    value.averageScannerExposureWeight,
    value.averageScannerHistoryWeight,
    value.normalizedScannerFixtureEnergy,
    value.currentScannerCueOwner,
    value.stableScannerPathCount,
    value.animatedScannerPathCount,
    value.hdrMode,
    value.bloomLevels,
    value.temporalHistoryActive,
    value.laserHistoryInputCount,
    value.laserHistorySliceCount,
    value.depthMode,
    value.depthSliceCount,
    value.depthBufferStatus,
    value.fallbackCode,
    value.fallbackReason,
    value.qualityAdjustmentReason,
    value.contextLossCount,
    value.postProcessingStatus,
    value.lastWebGLFailure,
    value.failureClassification,
    value.retryCount,
    value.nextAutomaticRetryMs,
    value.lastSuccessfulInitializationMs,
    value.manualRetryAvailable,
    value.manualRetryAvailableAtMs,
    value.finalFallbackReason,
  ].join('|')
}

export function publishLaserDmxRendererDiagnostics(
  next: LaserDmxRendererDiagnosticsSnapshot,
  nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now(),
): void {
  const normalized = Object.freeze({
    ...EMPTY_SNAPSHOT,
    ...next,
    duplicateRenderingFixtureIds: [...(next.duplicateRenderingFixtureIds ?? [])],
    cpuFrameMs: roundedTiming(next.cpuFrameMs),
    gpuFrameMs: roundedTiming(next.gpuFrameMs),
  })
  const structureChanged = structuralFingerprint(normalized) !== structuralFingerprint(snapshot)
  const timingChanged = normalized.cpuFrameMs !== snapshot.cpuFrameMs || normalized.gpuFrameMs !== snapshot.gpuFrameMs
  if (!structureChanged && (!timingChanged || nowMs - lastPublishMs < 750)) return
  snapshot = normalized
  lastPublishMs = nowMs
  listeners.forEach(listener => listener())
}

export function clearLaserDmxRendererDiagnostics(): void {
  if (snapshot === EMPTY_SNAPSHOT) return
  snapshot = EMPTY_SNAPSHOT
  lastPublishMs = Number.NEGATIVE_INFINITY
  listeners.forEach(listener => listener())
}

export function getLaserDmxRendererDiagnostics(): LaserDmxRendererDiagnosticsSnapshot {
  return snapshot
}

export function subscribeLaserDmxRendererDiagnostics(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useLaserDmxRendererDiagnostics(): LaserDmxRendererDiagnosticsSnapshot {
  return useSyncExternalStore(
    subscribeLaserDmxRendererDiagnostics,
    getLaserDmxRendererDiagnostics,
    () => EMPTY_SNAPSHOT,
  )
}


export function requestLaserDmxWebGLRetry(): number {
  manualRetryRequestSequence += 1
  return manualRetryRequestSequence
}

export function getLaserDmxWebGLRetryRequestSequence(): number {
  return manualRetryRequestSequence
}

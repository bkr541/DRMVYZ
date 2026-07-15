import { useSyncExternalStore } from 'react'
import type { LaserDmxWebGLFailureClassification } from './renderers/laserDmx/LaserDmxWebGLRecovery'
import type {
  LaserDmxShowDirectorPresentationMode,
  LaserDmxShowDirectorRendererMode,
  LaserDmxShowDirectorWebGLQuality,
} from './ReactTypes'

export type LaserDmxActiveRenderer = 'inactive' | 'webgl' | 'canvas2d'

export interface LaserDmxRendererDiagnosticsSnapshot {
  activeRenderer: LaserDmxActiveRenderer
  requestedRenderer: LaserDmxShowDirectorRendererMode
  presentationMode: LaserDmxShowDirectorPresentationMode
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
  fallbackReason: string | null
  contextLossCount: number
  postProcessingStatus: 'inactive' | 'hdr' | 'ldr-fallback'
  lastWebGLFailure: string | null
  failureClassification: LaserDmxWebGLFailureClassification | null
  retryCount: number
  nextAutomaticRetryMs: number | null
  lastSuccessfulInitializationMs: number | null
  manualRetryAvailable: boolean
  finalFallbackReason: string | null
}

const EMPTY_SNAPSHOT: LaserDmxRendererDiagnosticsSnapshot = Object.freeze({
  activeRenderer: 'inactive',
  requestedRenderer: 'auto',
  presentationMode: 'edit',
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
  fallbackReason: null,
  contextLossCount: 0,
  postProcessingStatus: 'inactive',
  lastWebGLFailure: null,
  failureClassification: null,
  retryCount: 0,
  nextAutomaticRetryMs: null,
  lastSuccessfulInitializationMs: null,
  manualRetryAvailable: false,
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
    value.hdrMode,
    value.bloomLevels,
    value.temporalHistoryActive,
    value.laserHistoryInputCount,
    value.laserHistorySliceCount,
    value.depthMode,
    value.depthSliceCount,
    value.depthBufferStatus,
    value.fallbackReason,
    value.contextLossCount,
    value.postProcessingStatus,
    value.lastWebGLFailure,
    value.failureClassification,
    value.retryCount,
    value.nextAutomaticRetryMs,
    value.lastSuccessfulInitializationMs,
    value.manualRetryAvailable,
    value.finalFallbackReason,
  ].join('|')
}

export function publishLaserDmxRendererDiagnostics(
  next: LaserDmxRendererDiagnosticsSnapshot,
  nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now(),
): void {
  const normalized = Object.freeze({
    ...next,
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

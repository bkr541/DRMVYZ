import type { PixGridDeckTransitionMode } from './PixGridDeckDomain'
import type { PixGridProgramTransitionOverride } from './PixGridTypes'

export const PIX_GRID_DECK_COMPILER_SCHEMA_VERSION = 1 as const
export const PIX_GRID_DECK_COMPILE_CONCURRENCY = 3
export const PIX_GRID_DECK_TRANSITION_ALGORITHM_VERSION = 1 as const

export const PIX_GRID_DECK_GENERATED_MASK_NAMES = [
  'foreground',
  'border',
  'highlights',
  'shadows',
  'center',
  'background',
] as const

export type PixGridDeckGeneratedMaskName = typeof PIX_GRID_DECK_GENERATED_MASK_NAMES[number]
export type PixGridDeckCompilePhase = 'queued' | 'decoding' | 'compiling' | 'ready' | 'failed' | 'cancelled'

export type PixGridDeckCompileErrorCode =
  | 'worker-unavailable'
  | 'worker-startup-failed'
  | 'source-unavailable'
  | 'source-load-failed'
  | 'source-too-large'
  | 'decode-unavailable'
  | 'decode-failed'
  | 'canvas-unavailable'
  | 'compile-failed'
  | 'transition-failed'
  | 'invalid-result'
  | 'cancelled'

export interface PixGridDeckCompileError {
  code: PixGridDeckCompileErrorCode
  message: string
  retryable: boolean
}

export interface PixGridPreparedFrameMetrics {
  cellCount: number
  foregroundCellCount: number
  backgroundCellCount: number
  borderCellCount: number
  highlightCellCount: number
  shadowCellCount: number
  centerCellCount: number
  averageLuminance: number
  luminanceDeviation: number
  averageAlpha: number
  bounds: Readonly<{
    minX: number
    minY: number
    maxX: number
    maxY: number
  }> | null
}

export type PixGridPreparedFrameMasks = Readonly<Record<PixGridDeckGeneratedMaskName, Uint8Array>>

export interface PixGridPreparedFrame {
  schemaVersion: typeof PIX_GRID_DECK_COMPILER_SCHEMA_VERSION
  cacheKey: string
  mediaId: string
  sourceFingerprint: string
  sourceRevision: number
  width: number
  height: number
  pixels: Uint8Array
  masks: PixGridPreparedFrameMasks
  metrics: PixGridPreparedFrameMetrics
  approximateBytes: number
}

export interface PixGridPreparedFrameSet {
  schemaVersion: typeof PIX_GRID_DECK_COMPILER_SCHEMA_VERSION
  deckId: string
  deckRevision: number
  width: number
  height: number
  frameCacheKeys: readonly string[]
  frames: readonly PixGridPreparedFrame[]
}

export type PixGridDeckCellTransitionMode = Extract<
  PixGridProgramTransitionOverride,
  'pixelDissolve' | 'crossfade' | 'rowWipe' | 'columnWipe' | 'checkerWipe' | 'radialReveal'
>
export type PixGridDeckConcreteTransitionMode = 'pixelTransport' | 'hardCut' | PixGridDeckCellTransitionMode

export interface PixGridDeckTransitionDiagnostics {
  sourceForegroundCount: number
  targetForegroundCount: number
  matchedCount: number
  birthCount: number
  deathCount: number
  sourceComponentCount: number
  targetComponentCount: number
  sourceColorEntropy: number
  targetColorEntropy: number
  candidateComparisons: number
  maxCandidatesPerSource: number
}

/** Renderer-independent Stage 5 contract. Stage 6 consumes these buffers. */
export interface PixGridDeckTransitionPlan {
  schemaVersion: typeof PIX_GRID_DECK_COMPILER_SCHEMA_VERSION
  algorithmVersion: typeof PIX_GRID_DECK_TRANSITION_ALGORITHM_VERSION
  cacheKey: string
  requestedMode: PixGridDeckTransitionMode
  mode: PixGridDeckConcreteTransitionMode
  automaticReason: string | null
  fallbackReason: string | null
  sourceFrameCacheKey: string
  targetFrameCacheKey: string
  width: number
  height: number
  matchedSourceIndices: Uint32Array
  matchedTargetIndices: Uint32Array
  deathSourceIndices: Uint32Array
  birthTargetIndices: Uint32Array
  diagnostics: PixGridDeckTransitionDiagnostics
  approximateBytes: number
}

export interface PixGridDeckTransitionCompileSettings {
  requestedMode: PixGridDeckTransitionMode
  sourceItemId: string
  targetItemId: string
  durationFraction: number
}

export interface PixGridDeckItemCompileStatus {
  itemId: string
  mediaId: string
  enabled: boolean
  cacheKey: string | null
  phase: PixGridDeckCompilePhase
  progress: number
  error: PixGridDeckCompileError | null
}

export interface PixGridDeckCompileStatus {
  deckId: string
  deckRevision: number
  width: number
  height: number
  phase: PixGridDeckCompilePhase
  progress: number
  ready: boolean
  enabledItemCount: number
  readyItemCount: number
  failedItemCount: number
  items: readonly PixGridDeckItemCompileStatus[]
}

export interface PixGridDeckWorkerCompileRequestBase {
  type: 'compile'
  jobId: string
  cacheKey: string
  mediaId: string
  sourceFingerprint: string
  sourceRevision: number
  width: number
  height: number
  mimeType: string | null
  hasAlpha: boolean
  transparentBackground: string
}

export interface PixGridDeckWorkerBlobCompileRequest extends PixGridDeckWorkerCompileRequestBase {
  sourceKind: 'blob'
  source: Blob
}

export interface PixGridDeckWorkerRasterCompileRequest extends PixGridDeckWorkerCompileRequestBase {
  sourceKind: 'raster'
  rasterPixels: ArrayBuffer
}

export type PixGridDeckWorkerCompileRequest =
  | PixGridDeckWorkerBlobCompileRequest
  | PixGridDeckWorkerRasterCompileRequest

export interface PixGridDeckWorkerCancelRequest {
  type: 'cancel'
  jobId: string
}

export interface PixGridDeckWorkerTransitionRequest {
  type: 'compile-transition'
  jobId: string
  cacheKey: string
  sourceFrameCacheKey: string
  targetFrameCacheKey: string
  width: number
  height: number
  settings: PixGridDeckTransitionCompileSettings
  sourcePixels: ArrayBuffer
  targetPixels: ArrayBuffer
  sourceForeground: ArrayBuffer
  targetForeground: ArrayBuffer
  sourceMetrics: PixGridPreparedFrameMetrics
  targetMetrics: PixGridPreparedFrameMetrics
}

export type PixGridDeckWorkerRequest =
  | PixGridDeckWorkerCompileRequest
  | PixGridDeckWorkerTransitionRequest
  | PixGridDeckWorkerCancelRequest

export interface PixGridDeckWorkerProgressMessage {
  type: 'progress'
  jobId: string
  phase: 'decoding' | 'compiling'
  progress: number
}

export interface PixGridDeckWorkerResultMessage {
  type: 'result'
  jobId: string
  cacheKey: string
  mediaId: string
  sourceFingerprint: string
  sourceRevision: number
  width: number
  height: number
  pixels: ArrayBuffer
  masks: Record<PixGridDeckGeneratedMaskName, ArrayBuffer>
  metrics: PixGridPreparedFrameMetrics
}

export interface PixGridDeckWorkerTransitionResultMessage {
  type: 'transition-result'
  jobId: string
  cacheKey: string
  requestedMode: PixGridDeckTransitionMode
  mode: PixGridDeckConcreteTransitionMode
  automaticReason: string | null
  fallbackReason: string | null
  sourceFrameCacheKey: string
  targetFrameCacheKey: string
  width: number
  height: number
  matchedSourceIndices: ArrayBuffer
  matchedTargetIndices: ArrayBuffer
  deathSourceIndices: ArrayBuffer
  birthTargetIndices: ArrayBuffer
  diagnostics: PixGridDeckTransitionDiagnostics
}

export interface PixGridDeckWorkerErrorMessage {
  type: 'error'
  jobId: string
  error: PixGridDeckCompileError
}

export type PixGridDeckWorkerMessage =
  | PixGridDeckWorkerProgressMessage
  | PixGridDeckWorkerResultMessage
  | PixGridDeckWorkerTransitionResultMessage
  | PixGridDeckWorkerErrorMessage

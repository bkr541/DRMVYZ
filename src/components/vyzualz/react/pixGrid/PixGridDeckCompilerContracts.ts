export const PIX_GRID_DECK_COMPILER_SCHEMA_VERSION = 1 as const
export const PIX_GRID_DECK_COMPILE_CONCURRENCY = 3

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

export type PixGridDeckWorkerRequest = PixGridDeckWorkerCompileRequest | PixGridDeckWorkerCancelRequest

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

export interface PixGridDeckWorkerErrorMessage {
  type: 'error'
  jobId: string
  error: PixGridDeckCompileError
}

export type PixGridDeckWorkerMessage =
  | PixGridDeckWorkerProgressMessage
  | PixGridDeckWorkerResultMessage
  | PixGridDeckWorkerErrorMessage

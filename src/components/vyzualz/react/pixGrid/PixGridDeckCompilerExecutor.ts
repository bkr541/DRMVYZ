import {
  PIX_GRID_DECK_COMPILER_SCHEMA_VERSION,
  PIX_GRID_DECK_GENERATED_MASK_NAMES,
  type PixGridDeckCompileError,
  type PixGridDeckCompilePhase,
  type PixGridDeckWorkerCompileRequest,
  type PixGridDeckWorkerMessage,
  type PixGridDeckWorkerRequest,
  type PixGridPreparedFrame,
} from './PixGridDeckCompilerContracts'
import { createPixGridDeckConversionSettings } from './PixGridDeckCompilerCore'
import { resolvePixGridFitRect } from './PixGridPixelPreparation'

export interface PixGridDeckCompilerWorkerPort {
  postMessage(message: PixGridDeckWorkerRequest, transfer?: Transferable[]): void
  addEventListener(type: 'message', listener: (event: MessageEvent<PixGridDeckWorkerMessage>) => void): void
  addEventListener(type: 'error', listener: (event: ErrorEvent) => void): void
  removeEventListener(type: 'message', listener: (event: MessageEvent<PixGridDeckWorkerMessage>) => void): void
  removeEventListener(type: 'error', listener: (event: ErrorEvent) => void): void
  terminate(): void
}

export type PixGridDeckCompilerWorkerFactory = () => PixGridDeckCompilerWorkerPort

export interface PixGridDeckBlobCompileRequest {
  jobId: string
  cacheKey: string
  mediaId: string
  sourceFingerprint: string
  sourceRevision: number
  width: number
  height: number
  mimeType: string | null
  hasAlpha: boolean
  source: Blob
  transparentBackground: string
  signal?: AbortSignal
  onProgress?: (phase: Extract<PixGridDeckCompilePhase, 'decoding' | 'compiling'>, progress: number) => void
}

export function createPixGridDeckCompilerWorker(): PixGridDeckCompilerWorkerPort {
  if (typeof Worker === 'undefined') {
    throw Object.assign(new Error('PixGrid Deck compilation requires Web Worker support.'), {
      code: 'worker-unavailable' satisfies PixGridDeckCompileError['code'],
    })
  }
  return new Worker(new URL('./PixGridDeckCompiler.worker.ts', import.meta.url), { type: 'module' })
}

function abortError(): PixGridDeckCompileError {
  return { code: 'cancelled', message: 'PixGrid Deck compilation was cancelled.', retryable: true }
}

function normalizeExecutorError(error: unknown): PixGridDeckCompileError {
  if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
    return {
      code: (error as { code: PixGridDeckCompileError['code'] }).code,
      message: String((error as { message: unknown }).message),
      retryable: 'retryable' in error ? Boolean((error as { retryable: unknown }).retryable) : false,
    }
  }
  return {
    code: 'worker-startup-failed',
    message: error instanceof Error ? error.message : 'PixGrid Deck compiler worker could not start.',
    retryable: true,
  }
}

async function decodeSvgImage(image: HTMLImageElement, signal?: AbortSignal): Promise<void> {
  if (!signal) {
    await image.decode()
    return
  }
  if (signal.aborted) throw abortError()
  await new Promise<void>((resolve, reject) => {
    let settled = false
    const finish = (callback: () => void) => {
      if (settled) return
      settled = true
      signal.removeEventListener('abort', handleAbort)
      callback()
    }
    const handleAbort = () => finish(() => reject(abortError()))
    signal.addEventListener('abort', handleAbort, { once: true })
    void image.decode().then(
      () => finish(() => resolve()),
      error => finish(() => reject(error)),
    )
  })
}

function isSvgRequest(request: PixGridDeckBlobCompileRequest): boolean {
  return (request.mimeType ?? request.source.type).toLowerCase().split(';', 1)[0].trim() === 'image/svg+xml'
}

async function rasterizeSvgOnMainThread(request: PixGridDeckBlobCompileRequest): Promise<ArrayBuffer> {
  if (request.signal?.aborted) throw abortError()
  if (
    typeof document === 'undefined'
    || typeof Image === 'undefined'
    || typeof URL === 'undefined'
    || typeof URL.createObjectURL !== 'function'
    || typeof URL.revokeObjectURL !== 'function'
  ) {
    throw {
      code: 'decode-unavailable',
      message: 'SVG rasterization is unavailable in this runtime.',
      retryable: false,
    } satisfies PixGridDeckCompileError
  }
  const objectUrl = URL.createObjectURL(request.source)
  const image = new Image()
  image.decoding = 'async'
  image.src = objectUrl
  try {
    request.onProgress?.('decoding', 0.08)
    await decodeSvgImage(image, request.signal)
    if (request.signal?.aborted) throw abortError()
    const canvas = document.createElement('canvas')
    canvas.width = request.width
    canvas.height = request.height
    const context = canvas.getContext('2d', { alpha: true, willReadFrequently: true })
    if (!context) {
      throw {
        code: 'canvas-unavailable',
        message: 'The SVG pre-rasterization canvas could not be allocated.',
        retryable: false,
      } satisfies PixGridDeckCompileError
    }
    const settings = createPixGridDeckConversionSettings(request.transparentBackground, request.hasAlpha)
    context.clearRect(0, 0, request.width, request.height)
    context.imageSmoothingEnabled = settings.sampling === 'smooth'
    const rect = resolvePixGridFitRect({
      sourceWidth: image.naturalWidth || request.width,
      sourceHeight: image.naturalHeight || request.height,
      targetWidth: request.width,
      targetHeight: request.height,
      fitMode: settings.fitMode,
      positionX: settings.positionX,
      positionY: settings.positionY,
      scale: settings.scale,
    })
    context.drawImage(
      image,
      rect.sourceX, rect.sourceY, rect.sourceWidth, rect.sourceHeight,
      rect.destinationX, rect.destinationY, rect.destinationWidth, rect.destinationHeight,
    )
    const pixels = context.getImageData(0, 0, request.width, request.height).data
    return pixels.buffer.slice(pixels.byteOffset, pixels.byteOffset + pixels.byteLength) as ArrayBuffer
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error) throw error
    throw {
      code: 'decode-failed',
      message: 'The SVG Deck image could not be rasterized.',
      retryable: false,
    } satisfies PixGridDeckCompileError
  } finally {
    image.src = ''
    URL.revokeObjectURL(objectUrl)
  }
}

async function buildWorkerRequest(request: PixGridDeckBlobCompileRequest): Promise<{
  message: PixGridDeckWorkerCompileRequest
  transfer: Transferable[]
}> {
  const base = {
    type: 'compile' as const,
    jobId: request.jobId,
    cacheKey: request.cacheKey,
    mediaId: request.mediaId,
    sourceFingerprint: request.sourceFingerprint,
    sourceRevision: request.sourceRevision,
    width: request.width,
    height: request.height,
    mimeType: request.mimeType,
    hasAlpha: request.hasAlpha,
    transparentBackground: request.transparentBackground,
  }
  if (isSvgRequest(request)) {
    const rasterPixels = await rasterizeSvgOnMainThread(request)
    return { message: { ...base, sourceKind: 'raster', rasterPixels }, transfer: [rasterPixels] }
  }
  return { message: { ...base, sourceKind: 'blob', source: request.source }, transfer: [] }
}

export async function compilePixGridDeckBlob(
  request: PixGridDeckBlobCompileRequest,
  workerFactory: PixGridDeckCompilerWorkerFactory = createPixGridDeckCompilerWorker,
): Promise<PixGridPreparedFrame> {
  if (request.signal?.aborted) throw abortError()
  const workerRequest = await buildWorkerRequest(request)
  if (request.signal?.aborted) throw abortError()
  let worker: PixGridDeckCompilerWorkerPort
  try {
    worker = workerFactory()
  } catch (error) {
    throw normalizeExecutorError(error)
  }

  return new Promise<PixGridPreparedFrame>((resolve, reject) => {
    let settled = false
    const finish = (callback: () => void) => {
      if (settled) return
      settled = true
      request.signal?.removeEventListener('abort', handleAbort)
      worker.removeEventListener('message', handleMessage)
      worker.removeEventListener('error', handleWorkerError)
      worker.terminate()
      callback()
    }
    const handleAbort = () => {
      try { worker.postMessage({ type: 'cancel', jobId: request.jobId }) } catch { /* worker is already unavailable */ }
      finish(() => reject(abortError()))
    }
    const handleWorkerError = (event: ErrorEvent) => finish(() => reject({
      code: 'worker-startup-failed',
      message: event.message || 'PixGrid Deck compiler worker failed.',
      retryable: true,
    } satisfies PixGridDeckCompileError))
    const handleMessage = (event: MessageEvent<PixGridDeckWorkerMessage>) => {
      const message = event.data
      if (message.jobId !== request.jobId) return
      if (message.type === 'progress') {
        request.onProgress?.(message.phase, Math.max(0, Math.min(1, message.progress)))
        return
      }
      if (message.type === 'error') {
        finish(() => reject(message.error))
        return
      }
      const expectedPixelBytes = request.width * request.height * 4
      const expectedMaskBytes = request.width * request.height
      if (
        message.cacheKey !== request.cacheKey
        || message.width !== request.width
        || message.height !== request.height
        || message.pixels.byteLength !== expectedPixelBytes
        || PIX_GRID_DECK_GENERATED_MASK_NAMES.some(name => message.masks[name]?.byteLength !== expectedMaskBytes)
      ) {
        finish(() => reject({
          code: 'invalid-result',
          message: 'The PixGrid Deck compiler worker returned an invalid frame shape.',
          retryable: true,
        } satisfies PixGridDeckCompileError))
        return
      }
      const masks = Object.fromEntries(
        PIX_GRID_DECK_GENERATED_MASK_NAMES.map(name => [name, new Uint8Array(message.masks[name])]),
      ) as PixGridPreparedFrame['masks']
      const pixels = new Uint8Array(message.pixels)
      const maskBytes = PIX_GRID_DECK_GENERATED_MASK_NAMES.reduce((sum, name) => sum + masks[name].byteLength, 0)
      finish(() => resolve({
        schemaVersion: PIX_GRID_DECK_COMPILER_SCHEMA_VERSION,
        cacheKey: message.cacheKey,
        mediaId: message.mediaId,
        sourceFingerprint: message.sourceFingerprint,
        sourceRevision: message.sourceRevision,
        width: message.width,
        height: message.height,
        pixels,
        masks,
        metrics: message.metrics,
        approximateBytes: pixels.byteLength + maskBytes + 256,
      }))
    }

    request.signal?.addEventListener('abort', handleAbort, { once: true })
    worker.addEventListener('message', handleMessage)
    worker.addEventListener('error', handleWorkerError)
    try {
      worker.postMessage(workerRequest.message, workerRequest.transfer)
    } catch (error) {
      finish(() => reject(normalizeExecutorError(error)))
    }
  })
}

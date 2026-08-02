import { compilePixGridDeckRasterFrame, createPixGridDeckConversionSettings } from './PixGridDeckCompilerCore'
import {
  PIX_GRID_DECK_GENERATED_MASK_NAMES,
  type PixGridDeckCompileError,
  type PixGridDeckWorkerCompileRequest,
  type PixGridDeckWorkerMessage,
  type PixGridDeckWorkerRequest,
} from './PixGridDeckCompilerContracts'
import { resolvePixGridFitRect } from './PixGridPixelPreparation'

interface PixGridDeckWorkerScope {
  onmessage: ((event: MessageEvent<PixGridDeckWorkerRequest>) => void) | null
  postMessage(message: PixGridDeckWorkerMessage, transfer?: Transferable[]): void
}

const workerScope = self as unknown as PixGridDeckWorkerScope
const cancelledJobs = new Set<string>()

function workerError(
  code: PixGridDeckCompileError['code'],
  message: string,
  retryable = false,
): PixGridDeckCompileError {
  return { code, message, retryable }
}

function postProgress(jobId: string, phase: 'decoding' | 'compiling', progress: number): void {
  if (cancelledJobs.has(jobId)) return
  workerScope.postMessage({ type: 'progress', jobId, phase, progress })
}

function compileRaster(message: PixGridDeckWorkerCompileRequest, rasterPixels: Uint8ClampedArray): void {
  const { jobId } = message
  if (rasterPixels.byteLength !== message.width * message.height * 4) {
    throw workerError('invalid-result', 'The compiler worker received an invalid raster frame.', false)
  }
  postProgress(jobId, 'compiling', 0.42)
  const sourceAlpha = new Uint8Array(message.width * message.height)
  for (let cell = 0; cell < sourceAlpha.length; cell += 1) sourceAlpha[cell] = rasterPixels[cell * 4 + 3]
  const frame = compilePixGridDeckRasterFrame({
    cacheKey: message.cacheKey,
    mediaId: message.mediaId,
    sourceFingerprint: message.sourceFingerprint,
    sourceRevision: message.sourceRevision,
    rasterPixels,
    sourceAlpha,
    width: message.width,
    height: message.height,
    transparentBackground: message.transparentBackground,
    hasAlpha: message.hasAlpha,
  })
  if (cancelledJobs.has(jobId)) return
  postProgress(jobId, 'compiling', 0.92)
  const masks = Object.fromEntries(
    PIX_GRID_DECK_GENERATED_MASK_NAMES.map(name => [name, frame.masks[name].buffer as ArrayBuffer]),
  ) as Record<(typeof PIX_GRID_DECK_GENERATED_MASK_NAMES)[number], ArrayBuffer>
  const pixels = frame.pixels.buffer as ArrayBuffer
  const transfer: Transferable[] = [pixels, ...PIX_GRID_DECK_GENERATED_MASK_NAMES.map(name => masks[name])]
  workerScope.postMessage({
    type: 'result',
    jobId,
    cacheKey: frame.cacheKey,
    mediaId: frame.mediaId,
    sourceFingerprint: frame.sourceFingerprint,
    sourceRevision: frame.sourceRevision,
    width: frame.width,
    height: frame.height,
    pixels,
    masks,
    metrics: frame.metrics,
  }, transfer)
}

async function decodeBlob(message: Extract<PixGridDeckWorkerCompileRequest, { sourceKind: 'blob' }>): Promise<void> {
  const { jobId } = message
  if (typeof createImageBitmap !== 'function') {
    throw workerError('decode-unavailable', 'PixGrid Deck image decoding is unavailable in this worker runtime.')
  }
  if (typeof OffscreenCanvas === 'undefined') {
    throw workerError('canvas-unavailable', 'PixGrid Deck compilation requires OffscreenCanvas support.')
  }
  postProgress(jobId, 'decoding', 0.08)
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(message.source)
  } catch {
    throw workerError('decode-failed', 'The Deck image could not be decoded in the compiler worker.')
  }
  if (cancelledJobs.has(jobId)) {
    bitmap.close()
    return
  }
  try {
    const canvas = new OffscreenCanvas(message.width, message.height)
    const context = canvas.getContext('2d', { alpha: true, willReadFrequently: true })
    if (!context) throw workerError('canvas-unavailable', 'The compiler worker could not allocate a 2D canvas.')
    const settings = createPixGridDeckConversionSettings(message.transparentBackground, message.hasAlpha)
    context.clearRect(0, 0, message.width, message.height)
    context.imageSmoothingEnabled = settings.sampling === 'smooth'
    const rect = resolvePixGridFitRect({
      sourceWidth: bitmap.width || message.width,
      sourceHeight: bitmap.height || message.height,
      targetWidth: message.width,
      targetHeight: message.height,
      fitMode: settings.fitMode,
      positionX: settings.positionX,
      positionY: settings.positionY,
      scale: settings.scale,
    })
    context.drawImage(
      bitmap,
      rect.sourceX, rect.sourceY, rect.sourceWidth, rect.sourceHeight,
      rect.destinationX, rect.destinationY, rect.destinationWidth, rect.destinationHeight,
    )
    compileRaster(message, context.getImageData(0, 0, message.width, message.height).data)
  } finally {
    bitmap.close()
  }
}

workerScope.onmessage = event => {
  const message = event.data
  if (message.type === 'cancel') {
    cancelledJobs.add(message.jobId)
    return
  }

  const run = async () => {
    if (message.sourceKind === 'raster') {
      compileRaster(message, new Uint8ClampedArray(message.rasterPixels))
    } else {
      await decodeBlob(message)
    }
    cancelledJobs.delete(message.jobId)
  }

  void run().catch(error => {
    if (cancelledJobs.has(message.jobId)) return
    const compileError = error && typeof error === 'object' && 'code' in error && 'message' in error
      ? error as PixGridDeckCompileError
      : workerError('compile-failed', error instanceof Error ? error.message : 'PixGrid Deck compilation failed.')
    workerScope.postMessage({ type: 'error', jobId: message.jobId, error: compileError })
    cancelledJobs.delete(message.jobId)
  })
}

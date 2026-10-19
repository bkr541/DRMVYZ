import type { InferenceSession } from 'onnxruntime-web'
import ortWasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url'
import { loadImageElement, MAX_IMAGE_EXPORT_EDGE, MediaEditAbortError } from '../edit/mediaEditImageExport'

const MODEL_SIZE = 320
const MODEL_URL = '/models/background-removal/u2netp.onnx'
const CHANNEL_MEAN = [0.485, 0.456, 0.406] as const
const CHANNEL_STD = [0.229, 0.224, 0.225] as const

let sessionPromise: Promise<InferenceSession> | null = null

/** Resolves Vite's emitted ONNX runtime binary for both HTTP dev and Electron's app protocol. */
export function resolveBackgroundRemovalWasmUrl(baseUrl?: string): string {
  if (/^[a-z][a-z\d+.-]*:/i.test(ortWasmUrl)) return ortWasmUrl
  const runtimeBaseUrl = baseUrl ?? globalThis.location?.href
  return runtimeBaseUrl ? new URL(ortWasmUrl, runtimeBaseUrl).href : ortWasmUrl
}

export interface RemovedImageBackground {
  blob: Blob
  width: number
  height: number
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new MediaEditAbortError('Background removal was cancelled.')
}

function require2dContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas rendering is unavailable, so the background cannot be removed.')
  return context
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob?.type === 'image/png') resolve(blob)
      else reject(new Error('The transparent image could not be encoded.'))
    }, 'image/png')
  })
}

async function getSession(): Promise<InferenceSession> {
  if (!sessionPromise) {
    sessionPromise = import('onnxruntime-web/wasm').then(async ort => {
      // Keep the CPU-heavy inference work out of the renderer's UI thread.
      // Without an explicit URL, the proxied worker infers a nonexistent path
      // from Vite's optimized dependency and receives the SPA HTML fallback.
      ort.env.wasm.wasmPaths = { wasm: resolveBackgroundRemovalWasmUrl() }
      ort.env.wasm.proxy = true
      return ort.InferenceSession.create(MODEL_URL, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      })
    }).catch(error => {
      sessionPromise = null
      throw error
    })
  }
  return sessionPromise
}

/** Converts 320x320 RGBA pixels to the planar, ImageNet-normalized U²-Net input tensor. */
export function createU2NetInput(pixels: Uint8ClampedArray): Float32Array {
  const pixelCount = MODEL_SIZE * MODEL_SIZE
  if (pixels.length !== pixelCount * 4) throw new Error('Unexpected background-removal input size.')

  let maxRgb = 0
  for (let index = 0; index < pixels.length; index += 4) {
    maxRgb = Math.max(maxRgb, pixels[index]!, pixels[index + 1]!, pixels[index + 2]!)
  }
  const scale = maxRgb > 0 ? maxRgb : 255
  const input = new Float32Array(pixelCount * 3)
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const rgbaIndex = pixel * 4
    for (let channel = 0; channel < 3; channel += 1) {
      input[channel * pixelCount + pixel] = ((pixels[rgbaIndex + channel]! / scale) - CHANNEL_MEAN[channel]!) / CHANNEL_STD[channel]!
    }
  }
  return input
}

/** Normalizes the model's foreground prediction and gently suppresses faint edge haze. */
export function normalizeU2NetMask(values: ArrayLike<number>): Uint8ClampedArray {
  let minimum = Number.POSITIVE_INFINITY
  let maximum = Number.NEGATIVE_INFINITY
  for (let index = 0; index < values.length; index += 1) {
    const value = Number(values[index])
    minimum = Math.min(minimum, value)
    maximum = Math.max(maximum, value)
  }
  const range = maximum - minimum
  const alpha = new Uint8ClampedArray(values.length)
  if (!Number.isFinite(range) || range <= Number.EPSILON) return alpha

  for (let index = 0; index < values.length; index += 1) {
    const normalized = Math.max(0, Math.min(1, (Number(values[index]) - minimum) / range))
    const edgeCleaned = Math.max(0, Math.min(1, (normalized - 0.03) / 0.94))
    const smooth = edgeCleaned * edgeCleaned * (3 - 2 * edgeCleaned)
    alpha[index] = Math.round(smooth * 255)
  }
  return alpha
}

/** Runs the bundled U²-Net model locally and returns the original image as a transparent PNG. */
export async function removeImageBackground(url: string, signal?: AbortSignal): Promise<RemovedImageBackground> {
  throwIfAborted(signal)
  const image = await loadImageElement(url, signal)
  throwIfAborted(signal)

  const sourceWidth = image.naturalWidth
  const sourceHeight = image.naturalHeight
  if (!sourceWidth || !sourceHeight) throw new Error('The selected image has no usable dimensions.')
  const outputScale = Math.min(1, MAX_IMAGE_EXPORT_EDGE / Math.max(sourceWidth, sourceHeight))
  const outputWidth = Math.max(1, Math.round(sourceWidth * outputScale))
  const outputHeight = Math.max(1, Math.round(sourceHeight * outputScale))

  const modelCanvas = document.createElement('canvas')
  modelCanvas.width = MODEL_SIZE
  modelCanvas.height = MODEL_SIZE
  const modelContext = require2dContext(modelCanvas)
  modelContext.drawImage(image, 0, 0, MODEL_SIZE, MODEL_SIZE)
  const pixels = modelContext.getImageData(0, 0, MODEL_SIZE, MODEL_SIZE).data

  const ort = await import('onnxruntime-web/wasm')
  const session = await getSession()
  throwIfAborted(signal)
  const inputName = session.inputNames[0]
  const outputName = session.outputNames[0]
  if (!inputName || !outputName) throw new Error('The background-removal model is invalid.')
  const outputs = await session.run(
    { [inputName]: new ort.Tensor('float32', createU2NetInput(pixels), [1, 3, MODEL_SIZE, MODEL_SIZE]) },
    [outputName],
  )
  throwIfAborted(signal)
  const prediction = outputs[outputName]
  if (!prediction || prediction.data.length !== MODEL_SIZE * MODEL_SIZE) {
    throw new Error('The background-removal model returned an unexpected result.')
  }
  const alpha = normalizeU2NetMask(prediction.data as ArrayLike<number>)

  const maskCanvas = document.createElement('canvas')
  maskCanvas.width = MODEL_SIZE
  maskCanvas.height = MODEL_SIZE
  const maskContext = require2dContext(maskCanvas)
  const maskPixels = maskContext.createImageData(MODEL_SIZE, MODEL_SIZE)
  for (let index = 0; index < alpha.length; index += 1) {
    const rgbaIndex = index * 4
    maskPixels.data[rgbaIndex] = 255
    maskPixels.data[rgbaIndex + 1] = 255
    maskPixels.data[rgbaIndex + 2] = 255
    maskPixels.data[rgbaIndex + 3] = alpha[index]!
  }
  maskContext.putImageData(maskPixels, 0, 0)

  const outputCanvas = document.createElement('canvas')
  outputCanvas.width = outputWidth
  outputCanvas.height = outputHeight
  const outputContext = require2dContext(outputCanvas)
  outputContext.imageSmoothingEnabled = true
  outputContext.imageSmoothingQuality = 'high'
  outputContext.drawImage(image, 0, 0, outputWidth, outputHeight)
  outputContext.globalCompositeOperation = 'destination-in'
  outputContext.drawImage(maskCanvas, 0, 0, outputWidth, outputHeight)
  outputContext.globalCompositeOperation = 'source-over'
  throwIfAborted(signal)

  try {
    return { blob: await canvasToPng(outputCanvas), width: outputWidth, height: outputHeight }
  } finally {
    modelCanvas.width = 0
    modelCanvas.height = 0
    maskCanvas.width = 0
    maskCanvas.height = 0
    outputCanvas.width = 0
    outputCanvas.height = 0
    image.src = ''
  }
}

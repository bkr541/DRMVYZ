import type { CanvasMediaItem } from './ReactTypes'

export type CanvasBackgroundMode = 'stage' | 'transparent'
export type CanvasImageTransparencyDetector = (image: HTMLImageElement) => boolean | null

interface CanvasCaptureBackgroundContext {
  clearRect: (x: number, y: number, width: number, height: number) => void
  fillRect: (x: number, y: number, width: number, height: number) => void
  fillStyle: string | CanvasGradient | CanvasPattern
}

const CANVAS_ALPHA_SAMPLE_MAX_SIZE = 128
const CANVAS_BACKGROUND_CACHE_LIMIT = 256
const canvasBackgroundModeCache = new Map<string, Promise<CanvasBackgroundMode>>()

export function getCanvasMediaTransparencyKey(item: Pick<CanvasMediaItem, 'id' | 'objectUrl'>): string {
  return `${item.id}\u0000${item.objectUrl}`
}

export function resolveCanvasBackgroundModeWithoutInspection(
  item: Pick<CanvasMediaItem, 'type'>,
): CanvasBackgroundMode | null {
  // Media-library hasAlpha is currently a role-derived authoring hint, not a
  // decoded-pixel guarantee. Inspect still media once instead of trusting it.
  return item.type === 'video' ? 'stage' : null
}

export function hasTransparentCanvasPixels(pixels: Uint8ClampedArray): boolean {
  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index] < 255) return true
  }
  return false
}

export function detectCanvasImageTransparency(image: HTMLImageElement): boolean | null {
  const sourceWidth = image.naturalWidth || image.width
  const sourceHeight = image.naturalHeight || image.height
  if (!sourceWidth || !sourceHeight || typeof document === 'undefined') return null

  const scale = Math.min(1, CANVAS_ALPHA_SAMPLE_MAX_SIZE / Math.max(sourceWidth, sourceHeight))
  const width = Math.max(1, Math.round(sourceWidth * scale))
  const height = Math.max(1, Math.round(sourceHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  try {
    const context = canvas.getContext('2d', { alpha: true, willReadFrequently: true })
    if (!context) return null
    context.clearRect(0, 0, width, height)
    context.drawImage(image, 0, 0, width, height)
    return hasTransparentCanvasPixels(context.getImageData(0, 0, width, height).data)
  } catch {
    // Cross-origin or browser decoding restrictions should fail closed to the stage background.
    return null
  }
}

export function resolveCanvasMediaBackgroundMode(
  item: CanvasMediaItem,
  image: HTMLImageElement,
  detector: CanvasImageTransparencyDetector = detectCanvasImageTransparency,
): Promise<CanvasBackgroundMode> {
  const immediateMode = resolveCanvasBackgroundModeWithoutInspection(item)
  if (immediateMode) return Promise.resolve(immediateMode)

  const cacheKey = getCanvasMediaTransparencyKey(item)
  const cached = canvasBackgroundModeCache.get(cacheKey)
  if (cached) return cached

  const pending = Promise.resolve()
    .then(() => detector(image))
    .then((hasAlpha): CanvasBackgroundMode => hasAlpha === true ? 'transparent' : 'stage')
    .catch((): CanvasBackgroundMode => 'stage')
  if (canvasBackgroundModeCache.size >= CANVAS_BACKGROUND_CACHE_LIMIT) {
    const oldestKey = canvasBackgroundModeCache.keys().next().value
    if (oldestKey) canvasBackgroundModeCache.delete(oldestKey)
  }
  canvasBackgroundModeCache.set(cacheKey, pending)
  return pending
}

export function prepareCanvasCaptureBackground(
  context: CanvasCaptureBackgroundContext,
  width: number,
  height: number,
  mode: CanvasBackgroundMode,
): void {
  context.clearRect(0, 0, width, height)
  if (mode === 'transparent') return
  context.fillStyle = '#02070a'
  context.fillRect(0, 0, width, height)
}

export function clearCanvasMediaTransparencyCacheForTests(): void {
  canvasBackgroundModeCache.clear()
}

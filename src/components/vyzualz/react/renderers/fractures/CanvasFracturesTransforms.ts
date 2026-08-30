import type { CanvasFitMode, CanvasMediaItemType } from '../../ReactTypes'
import type {
  CanvasFracturePoint,
  CanvasFracturesSourceElement,
  CanvasFracturesSourcePath,
} from './CanvasFracturesTypes'

export interface CanvasFracturesFitRect {
  x: number
  y: number
  width: number
  height: number
}

export function clampFracturesUnit(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

export function roundFractures(value: number, precision = 6): number {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

export function resolveCanvasFracturesSourcePath(mediaType: CanvasMediaItemType): CanvasFracturesSourcePath {
  if (mediaType === 'video') return 'video-frame'
  if (mediaType === 'svg') return 'svg-raster-image'
  return 'raster-image'
}

export function isCanvasFracturesSourceReady(source: CanvasFracturesSourceElement | null): source is CanvasFracturesSourceElement {
  if (!source) return false
  if (source instanceof HTMLVideoElement) {
    return source.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && source.videoWidth > 0 && source.videoHeight > 0
  }
  if (source instanceof HTMLCanvasElement) return source.width > 0 && source.height > 0
  return source.complete && source.naturalWidth > 0 && source.naturalHeight > 0
}

export function getCanvasFracturesSourceSize(source: CanvasFracturesSourceElement): { width: number; height: number } {
  if (source instanceof HTMLVideoElement) {
    return { width: Math.max(1, source.videoWidth), height: Math.max(1, source.videoHeight) }
  }
  if (source instanceof HTMLCanvasElement) {
    return { width: Math.max(1, source.width), height: Math.max(1, source.height) }
  }
  return { width: Math.max(1, source.naturalWidth), height: Math.max(1, source.naturalHeight) }
}

export function resolveCanvasFracturesFitRect(input: {
  outputWidth: number
  outputHeight: number
  sourceWidth: number
  sourceHeight: number
  fitMode: CanvasFitMode
}): CanvasFracturesFitRect {
  const outputWidth = Math.max(1, input.outputWidth)
  const outputHeight = Math.max(1, input.outputHeight)
  const sourceAspect = Math.max(1, input.sourceWidth) / Math.max(1, input.sourceHeight)
  const outputAspect = outputWidth / outputHeight
  let width = outputWidth
  let height = outputHeight

  if (input.fitMode === 'contain') {
    if (sourceAspect > outputAspect) height = outputWidth / sourceAspect
    else width = outputHeight * sourceAspect
  } else if (input.fitMode === 'cover') {
    if (sourceAspect > outputAspect) width = outputHeight * sourceAspect
    else height = outputWidth / sourceAspect
  }

  return {
    x: (outputWidth - width) * 0.5,
    y: (outputHeight - height) * 0.5,
    width,
    height,
  }
}

export function isConvexCanvasFractureQuad(
  corners: readonly [CanvasFracturePoint, CanvasFracturePoint, CanvasFracturePoint, CanvasFracturePoint],
): boolean {
  let sign = 0
  for (let index = 0; index < corners.length; index += 1) {
    const a = corners[index]
    const b = corners[(index + 1) % corners.length]
    const c = corners[(index + 2) % corners.length]
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)
    if (Math.abs(cross) < 1e-8) continue
    const nextSign = Math.sign(cross)
    if (sign !== 0 && nextSign !== sign) return false
    sign = nextSign
  }
  return sign !== 0
}

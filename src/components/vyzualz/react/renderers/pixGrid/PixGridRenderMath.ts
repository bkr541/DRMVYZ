import type { PixGridQualityTier } from '../../pixGrid/PixGridTypes'
import { resolvePixGridMatrixDimensions } from '../../pixGrid/PixGridDefaults'

export interface PixGridPresentationViewport {
  x: number
  y: number
  width: number
  height: number
}

export interface PixGridLogicalCoordinate {
  cellX: number
  cellY: number
  localX: number
  localY: number
}

export interface PixGridCellShapeSample {
  signedDistance: number
  inside: boolean
  centerLight: number
}

export function resolvePixGridLogicalResolution(quality: PixGridQualityTier): Readonly<{ width: number; height: number }> {
  return resolvePixGridMatrixDimensions(quality)
}

/** Canvas fallback never drops below Low so cell artwork remains readable. */
export function resolvePixGridFallbackResolution(quality: PixGridQualityTier): Readonly<{ width: number; height: number }> {
  return resolvePixGridMatrixDimensions(quality === 'draft' ? 'low' : quality)
}

export function resolvePixGridPresentationViewport(
  outputWidth: number,
  outputHeight: number,
  logicalWidth: number,
  logicalHeight: number,
): PixGridPresentationViewport {
  const safeOutputWidth = Math.max(1, outputWidth)
  const safeOutputHeight = Math.max(1, outputHeight)
  const safeLogicalWidth = Math.max(1, logicalWidth)
  const safeLogicalHeight = Math.max(1, logicalHeight)
  const logicalAspect = safeLogicalWidth / safeLogicalHeight
  const outputAspect = safeOutputWidth / safeOutputHeight
  const width = outputAspect > logicalAspect ? safeOutputHeight * logicalAspect : safeOutputWidth
  const height = outputAspect > logicalAspect ? safeOutputHeight : safeOutputWidth / logicalAspect
  return {
    x: (safeOutputWidth - width) * 0.5,
    y: (safeOutputHeight - height) * 0.5,
    width,
    height,
  }
}

export function mapPixGridOutputToLogicalCell(
  outputX: number,
  outputY: number,
  outputWidth: number,
  outputHeight: number,
  logicalWidth: number,
  logicalHeight: number,
): PixGridLogicalCoordinate | null {
  const viewport = resolvePixGridPresentationViewport(
    outputWidth,
    outputHeight,
    logicalWidth,
    logicalHeight,
  )
  if (
    outputX < viewport.x || outputY < viewport.y
    || outputX >= viewport.x + viewport.width || outputY >= viewport.y + viewport.height
  ) return null

  const gridX = (outputX - viewport.x) / viewport.width * logicalWidth
  const gridY = (outputY - viewport.y) / viewport.height * logicalHeight
  return {
    cellX: Math.max(0, Math.min(logicalWidth - 1, Math.floor(gridX))),
    cellY: Math.max(0, Math.min(logicalHeight - 1, Math.floor(gridY))),
    localX: gridX - Math.floor(gridX) - 0.5,
    localY: gridY - Math.floor(gridY) - 0.5,
  }
}

/** Mirrors the rounded-rectangle SDF used by the LED presentation shader. */
export function samplePixGridCellShape(
  localX: number,
  localY: number,
  gap: number,
  roundness: number,
): PixGridCellShapeSample {
  const safeGap = Math.max(0, Math.min(0.45, Number.isFinite(gap) ? gap : 0))
  const safeRoundness = Math.max(0, Math.min(0.5, Number.isFinite(roundness) ? roundness : 0))
  const halfSize = Math.max(0.05, 0.5 - safeGap)
  const radius = halfSize * safeRoundness * 2
  const qx = Math.abs(localX) - halfSize + radius
  const qy = Math.abs(localY) - halfSize + radius
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0))
  const inside = Math.min(Math.max(qx, qy), 0)
  const signedDistance = outside + inside - radius
  const normalizedRadius = Math.hypot(localX / halfSize, localY / halfSize)
  return {
    signedDistance,
    inside: signedDistance <= 0,
    centerLight: Math.max(0, Math.min(1, 1 - normalizedRadius * 0.62)),
  }
}

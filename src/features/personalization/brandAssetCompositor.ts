import type { BrandAssetPresentation, BrandPalette } from './BrandKitTypes'
import { normalizeBrandAssetPresentation } from './brandKitNormalization'

export interface BrandAssetPlacementRect {
  x: number
  y: number
  width: number
  height: number
}

export interface BrandAssetCompositeFrame {
  width: number
  height: number
  audioTime: number
  durationSec: number
  audioEnergy: number
  sectionType?: string | null
}

export interface ActiveBrandOverlay {
  assetId: string
  mediaItemId: string
  image: CanvasImageSource
  naturalWidth: number
  naturalHeight: number
  presentation: BrandAssetPresentation
  palette: BrandPalette
}


interface ScratchCanvas {
  canvas: CanvasImageSource & { width: number; height: number }
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
}

let scratchCanvas: ScratchCanvas | null = null

function createScratchCanvas(): ScratchCanvas | null {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(1, 1)
    const context = canvas.getContext('2d')
    return context ? { canvas, context } : null
  }
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    return context ? { canvas, context } : null
  }
  return null
}

function tintedAssetSource(
  image: CanvasImageSource,
  width: number,
  height: number,
  color: string,
): CanvasImageSource | null {
  scratchCanvas ??= createScratchCanvas()
  if (!scratchCanvas) return null
  const pixelWidth = Math.max(1, Math.ceil(width))
  const pixelHeight = Math.max(1, Math.ceil(height))
  const { canvas, context } = scratchCanvas
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight
  context.clearRect(0, 0, pixelWidth, pixelHeight)
  context.globalAlpha = 1
  context.globalCompositeOperation = 'source-over'
  context.shadowBlur = 0
  context.drawImage(image, 0, 0, pixelWidth, pixelHeight)
  // Tint inside the artwork alpha mask. Doing this on the output canvas with
  // source-atop would color the full bounding rectangle because the engine frame
  // is already opaque beneath the logo.
  context.globalCompositeOperation = 'source-in'
  context.fillStyle = color
  context.fillRect(0, 0, pixelWidth, pixelHeight)
  context.globalCompositeOperation = 'source-over'
  return canvas
}

/** Test-only seam for releasing module-level compositor resources. */
export function resetBrandAssetCompositorForTests(): void {
  scratchCanvas = null
}

function sourceDimensions(source: CanvasImageSource): { width: number; height: number } {
  const value = source as unknown as { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number }
  return {
    width: Math.max(1, value.naturalWidth ?? value.width ?? 1),
    height: Math.max(1, value.naturalHeight ?? value.height ?? 1),
  }
}

export function resolveBrandAssetPlacement(
  frameWidth: number,
  frameHeight: number,
  sourceWidth: number,
  sourceHeight: number,
  rawPresentation: BrandAssetPresentation,
): BrandAssetPlacementRect {
  const p = normalizeBrandAssetPresentation(rawPresentation)!
  const inset = Math.min(frameWidth, frameHeight) * p.margin
  const maxWidth = Math.max(1, frameWidth - inset * 2)
  const maxHeight = Math.max(1, frameHeight - inset * 2)
  const targetWidth = Math.min(maxWidth, frameWidth * p.scale)
  const targetHeight = Math.min(maxHeight, targetWidth * sourceHeight / Math.max(1, sourceWidth))
  const width = targetHeight >= maxHeight ? maxHeight * sourceWidth / Math.max(1, sourceHeight) : targetWidth
  const height = Math.min(maxHeight, width * sourceHeight / Math.max(1, sourceWidth))

  const left = inset
  const centerX = (frameWidth - width) / 2
  const right = frameWidth - inset - width
  const top = inset
  const centerY = (frameHeight - height) / 2
  const bottom = frameHeight - inset - height

  const x = p.placement.endsWith('left') ? left : p.placement.endsWith('right') ? right : centerX
  const y = p.placement.startsWith('top') ? top : p.placement.startsWith('bottom') ? bottom : centerY
  return { x, y, width, height }
}

export function isBrandAssetVisible(
  presentation: BrandAssetPresentation,
  frame: BrandAssetCompositeFrame,
): boolean {
  if (!presentation.enabled) return false
  if (presentation.visibility === 'always') return true
  const introBySection = frame.sectionType === 'intro'
  const outroBySection = frame.sectionType === 'outro'
  const introByTime = frame.audioTime <= Math.min(15, Math.max(5, frame.durationSec * 0.08))
  const outroByTime = frame.durationSec > 0 && frame.audioTime >= Math.max(0, frame.durationSec - Math.min(15, Math.max(5, frame.durationSec * 0.08)))
  return presentation.visibility === 'introOnly'
    ? introBySection || introByTime
    : outroBySection || outroByTime
}

/** Draw after the engine frame so capture, recording, export, and fullscreen agree. */
export function compositeBrandAsset(
  ctx: CanvasRenderingContext2D,
  overlay: ActiveBrandOverlay | null | undefined,
  frame: BrandAssetCompositeFrame,
): boolean {
  if (!overlay || !isBrandAssetVisible(overlay.presentation, frame)) return false
  const dimensions = sourceDimensions(overlay.image)
  const rect = resolveBrandAssetPlacement(frame.width, frame.height, dimensions.width, dimensions.height, overlay.presentation)
  const p = normalizeBrandAssetPresentation(overlay.presentation)!
  ctx.save()
  ctx.globalCompositeOperation = p.blendMode
  ctx.globalAlpha = p.opacity
  if (p.glowMode !== 'none') {
    const audioBoost = p.glowMode === 'audioReactive' ? Math.max(0, Math.min(1, frame.audioEnergy)) : 0.45
    ctx.shadowColor = overlay.palette.highlight
    ctx.shadowBlur = Math.min(frame.width, frame.height) * (0.008 + audioBoost * 0.018)
  }
  const source = p.preserveOriginalColors
    ? overlay.image
    : tintedAssetSource(overlay.image, rect.width, rect.height, overlay.palette.primary) ?? overlay.image
  ctx.drawImage(source, rect.x, rect.y, rect.width, rect.height)
  ctx.restore()
  return true
}

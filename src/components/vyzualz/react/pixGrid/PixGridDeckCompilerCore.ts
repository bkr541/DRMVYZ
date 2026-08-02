import type { ReactPalette } from '../ReactTypes'
import { DEFAULT_PIX_GRID_CONVERSION_SETTINGS } from './PixGridDefaults'
import type { PixGridDeckItemDefinition } from './PixGridDeckDomain'
import {
  PIX_GRID_DECK_COMPILER_SCHEMA_VERSION,
  PIX_GRID_DECK_GENERATED_MASK_NAMES,
  type PixGridDeckGeneratedMaskName,
  type PixGridPreparedFrame,
  type PixGridPreparedFrameMasks,
  type PixGridPreparedFrameMetrics,
} from './PixGridDeckCompilerContracts'
import { preparePixGridPixelData } from './PixGridPixelPreparation'
import type { PixGridConversionSettings } from './PixGridTypes'

export const PIX_GRID_DECK_MASK_THRESHOLDS = Object.freeze({
  foregroundAlpha: 24,
  highlightLuminance: 0.72,
  shadowLuminance: 0.28,
  centerMinX: 0.25,
  centerMaxX: 0.75,
  centerMinY: 0.25,
  centerMaxY: 0.75,
})

export const PIX_GRID_DECK_COMPILER_PALETTE: Readonly<ReactPalette> = Object.freeze({
  primary: '#00D9FF',
  secondary: '#00D982',
  accent: '#FF3ED1',
  background: '#000000',
  highlight: '#FFFFFF',
  text: '#FFFFFF',
})

function stableNumber(value: number): string {
  return Number.isFinite(value) ? Number(value.toFixed(5)).toString() : '0'
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function normalizeBackground(value: string): string {
  return /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : '#000000'
}

export function createPixGridDeckConversionSettings(
  transparentBackground: string,
  hasAlpha: boolean,
): PixGridConversionSettings {
  return {
    ...DEFAULT_PIX_GRID_CONVERSION_SETTINGS,
    selectedMediaId: null,
    fitMode: 'contain',
    sampling: 'crisp',
    colorMode: 'original',
    paletteSize: 64,
    ditherMode: 'none',
    edgeEnhancement: 0,
    backgroundHandling: hasAlpha ? 'solid' : 'transparent',
    backgroundColor: normalizeBackground(transparentBackground),
  }
}

function conversionSignature(settings: PixGridConversionSettings): string {
  return [
    settings.fitMode,
    stableNumber(settings.positionX),
    stableNumber(settings.positionY),
    stableNumber(settings.scale),
    settings.sampling,
    settings.colorMode,
    settings.paletteSize,
    settings.ditherMode,
    stableNumber(settings.alphaThreshold),
    settings.preserveAlpha ? 1 : 0,
    stableNumber(settings.contrast),
    stableNumber(settings.brightness),
    stableNumber(settings.saturation),
    stableNumber(settings.edgeEnhancement),
    settings.backgroundHandling,
    settings.backgroundColor,
    settings.preserveBlack ? 1 : 0,
    settings.preserveWhite ? 1 : 0,
  ].join('|')
}

export function createPixGridDeckCompilerCacheKey(input: {
  sourceFingerprint: string
  sourceRevision: number
  mimeType: string | null
  width: number
  height: number
  transparentBackground: string
  hasAlpha: boolean
}): string {
  const settings = createPixGridDeckConversionSettings(input.transparentBackground, input.hasAlpha)
  const signature = [
    `pix-grid-deck-compiler-v${PIX_GRID_DECK_COMPILER_SCHEMA_VERSION}`,
    input.sourceFingerprint,
    Math.max(0, Math.floor(input.sourceRevision)),
    input.mimeType ?? 'unknown',
    `${Math.max(1, Math.floor(input.width))}x${Math.max(1, Math.floor(input.height))}`,
    conversionSignature(settings),
  ].join('|')
  return `pix-grid-deck-frame:${fnv1a(signature)}:${signature}`
}

export function createPixGridDeckItemCompilerCacheKey(
  item: PixGridDeckItemDefinition,
  width: number,
  height: number,
): string {
  return createPixGridDeckCompilerCacheKey({
    sourceFingerprint: item.source.fingerprint,
    sourceRevision: item.source.mediaRevision,
    mimeType: item.source.mimeType,
    width,
    height,
    transparentBackground: item.source.transparentBackground,
    hasAlpha: item.source.hasAlpha,
  })
}

function luminanceAt(pixels: Uint8Array, offset: number): number {
  return (pixels[offset] * 0.2126 + pixels[offset + 1] * 0.7152 + pixels[offset + 2] * 0.0722) / 255
}

function maskCount(mask: Uint8Array): number {
  let count = 0
  for (const value of mask) if (value > 0) count += 1
  return count
}

export function derivePixGridDeckFrameAnalysis(input: {
  pixels: Uint8Array
  sourceAlpha: Uint8Array
  width: number
  height: number
}): { masks: PixGridPreparedFrameMasks; metrics: PixGridPreparedFrameMetrics } {
  const { pixels, sourceAlpha } = input
  const width = Math.max(1, Math.floor(input.width))
  const height = Math.max(1, Math.floor(input.height))
  const cellCount = width * height
  if (pixels.length !== cellCount * 4 || sourceAlpha.length !== cellCount) {
    throw new Error('PixGrid Deck analysis received an invalid logical frame shape.')
  }

  const masks = Object.fromEntries(
    PIX_GRID_DECK_GENERATED_MASK_NAMES.map(name => [name, new Uint8Array(cellCount)]),
  ) as Record<PixGridDeckGeneratedMaskName, Uint8Array>
  let luminanceSum = 0
  let luminanceSquaredSum = 0
  let alphaSum = 0
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1

  for (let cell = 0; cell < cellCount; cell += 1) {
    const alpha = sourceAlpha[cell]
    const foreground = alpha >= PIX_GRID_DECK_MASK_THRESHOLDS.foregroundAlpha
    masks.foreground[cell] = foreground ? 255 : 0
    masks.background[cell] = foreground ? 0 : 255
    const offset = cell * 4
    const luminance = luminanceAt(pixels, offset)
    luminanceSum += luminance
    luminanceSquaredSum += luminance * luminance
    alphaSum += alpha / 255
    if (!foreground) continue

    const x = cell % width
    const y = Math.floor(cell / width)
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
    if (luminance >= PIX_GRID_DECK_MASK_THRESHOLDS.highlightLuminance) masks.highlights[cell] = 255
    if (luminance <= PIX_GRID_DECK_MASK_THRESHOLDS.shadowLuminance) masks.shadows[cell] = 255
    const normalizedX = (x + 0.5) / width
    const normalizedY = (y + 0.5) / height
    if (
      normalizedX >= PIX_GRID_DECK_MASK_THRESHOLDS.centerMinX
      && normalizedX <= PIX_GRID_DECK_MASK_THRESHOLDS.centerMaxX
      && normalizedY >= PIX_GRID_DECK_MASK_THRESHOLDS.centerMinY
      && normalizedY <= PIX_GRID_DECK_MASK_THRESHOLDS.centerMaxY
    ) masks.center[cell] = 255
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const cell = y * width + x
      if (!masks.foreground[cell]) continue
      if (
        x === 0 || y === 0 || x === width - 1 || y === height - 1
        || !masks.foreground[cell - 1]
        || !masks.foreground[cell + 1]
        || !masks.foreground[cell - width]
        || !masks.foreground[cell + width]
      ) masks.border[cell] = 255
    }
  }

  const averageLuminance = luminanceSum / cellCount
  const variance = Math.max(0, luminanceSquaredSum / cellCount - averageLuminance * averageLuminance)
  const foregroundCellCount = maskCount(masks.foreground)
  const metrics: PixGridPreparedFrameMetrics = {
    cellCount,
    foregroundCellCount,
    backgroundCellCount: cellCount - foregroundCellCount,
    borderCellCount: maskCount(masks.border),
    highlightCellCount: maskCount(masks.highlights),
    shadowCellCount: maskCount(masks.shadows),
    centerCellCount: maskCount(masks.center),
    averageLuminance,
    luminanceDeviation: Math.sqrt(variance),
    averageAlpha: alphaSum / cellCount,
    bounds: maxX >= minX && maxY >= minY ? { minX, minY, maxX, maxY } : null,
  }
  return { masks, metrics }
}

export function compilePixGridDeckRasterFrame(input: {
  cacheKey: string
  mediaId: string
  sourceFingerprint: string
  sourceRevision: number
  rasterPixels: Uint8ClampedArray | Uint8Array
  sourceAlpha: Uint8Array
  width: number
  height: number
  transparentBackground: string
  hasAlpha: boolean
}): PixGridPreparedFrame {
  const settings = createPixGridDeckConversionSettings(input.transparentBackground, input.hasAlpha)
  const pixels = preparePixGridPixelData({
    pixels: input.rasterPixels,
    width: input.width,
    height: input.height,
    settings,
    palette: PIX_GRID_DECK_COMPILER_PALETTE,
  })
  const analysis = derivePixGridDeckFrameAnalysis({
    pixels,
    sourceAlpha: input.sourceAlpha,
    width: input.width,
    height: input.height,
  })
  const maskBytes = PIX_GRID_DECK_GENERATED_MASK_NAMES.reduce(
    (sum, name) => sum + analysis.masks[name].byteLength,
    0,
  )
  return {
    schemaVersion: PIX_GRID_DECK_COMPILER_SCHEMA_VERSION,
    cacheKey: input.cacheKey,
    mediaId: input.mediaId,
    sourceFingerprint: input.sourceFingerprint,
    sourceRevision: input.sourceRevision,
    width: input.width,
    height: input.height,
    pixels,
    masks: analysis.masks,
    metrics: analysis.metrics,
    approximateBytes: pixels.byteLength + maskBytes + 256,
  }
}

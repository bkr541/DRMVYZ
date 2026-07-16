import type { ReactPalette } from '../ReactTypes'
import type { UploadedMedia } from '../../../../stores/mediaStore'
import type { PixGridConversionSettings } from './PixGridTypes'
import { extractPixGridSvgGroupCandidates, type PixGridSvgGroupCandidate } from './PixGridGroups'
import {
  inspectPixGridMediaCapability,
  resolvePixGridMediaRevision,
  resolvePixGridMediaSourceUrl,
} from './PixGridMediaCapabilities'
import {
  MAX_PIX_GRID_MEDIA_SOURCE_BYTES,
  MAX_PIX_GRID_SVG_SOURCE_CHARACTERS,
} from './PixGridLimits'

export interface PixGridPreparedAsset {
  key: string
  mediaId: string
  mediaRevision: number
  width: number
  height: number
  pixels: Uint8Array
  approximateBytes: number
  svgGroupCandidates?: readonly PixGridSvgGroupCandidate[]
}

export interface PixGridFitRect {
  sourceX: number
  sourceY: number
  sourceWidth: number
  sourceHeight: number
  destinationX: number
  destinationY: number
  destinationWidth: number
  destinationHeight: number
}

export interface PixGridPreparationInput {
  media: UploadedMedia
  width: number
  height: number
  settings: PixGridConversionSettings
  palette: ReactPalette
  signal?: AbortSignal
}

export interface PixGridPixelPreparationInput {
  pixels: Uint8ClampedArray | Uint8Array
  width: number
  height: number
  settings: PixGridConversionSettings
  palette: ReactPalette
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function stableNumber(value: number): string {
  return Number.isFinite(value) ? Number(value.toFixed(5)).toString() : '0'
}

function hexToRgb(hex: string): [number, number, number] {
  const safe = /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#000000'
  return [
    Number.parseInt(safe.slice(1, 3), 16),
    Number.parseInt(safe.slice(3, 5), 16),
    Number.parseInt(safe.slice(5, 7), 16),
  ]
}

function rgbDistance(a: readonly number[], b: readonly number[]): number {
  const dr = a[0] - b[0]
  const dg = a[1] - b[1]
  const db = a[2] - b[2]
  return dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11
}

function mixRgb(a: readonly number[], b: readonly number[], amount: number): [number, number, number] {
  const t = clamp(amount, 0, 1)
  return [
    clampByte(a[0] + (b[0] - a[0]) * t),
    clampByte(a[1] + (b[1] - a[1]) * t),
    clampByte(a[2] + (b[2] - a[2]) * t),
  ]
}

function paletteSignature(palette: ReactPalette): string {
  return [palette.background, palette.primary, palette.secondary, palette.accent, palette.highlight, palette.text].join(',')
}

export function createPixGridConversionCacheKey(input: {
  mediaId: string
  mediaRevision: number
  width: number
  height: number
  settings: PixGridConversionSettings
  palette: ReactPalette
}): string {
  const s = input.settings
  return [
    'pixgrid-prepared-v1', input.mediaId, input.mediaRevision, `${input.width}x${input.height}`,
    s.fitMode, stableNumber(s.positionX), stableNumber(s.positionY), stableNumber(s.scale), s.sampling,
    s.colorMode, s.paletteSize, s.ditherMode, stableNumber(s.alphaThreshold), s.preserveAlpha ? 1 : 0,
    stableNumber(s.contrast), stableNumber(s.brightness), stableNumber(s.saturation), stableNumber(s.edgeEnhancement),
    s.backgroundHandling, s.backgroundColor, stableNumber(s.brandStrength), s.preserveBlack ? 1 : 0,
    s.preserveWhite ? 1 : 0, s.colorMode === 'original' ? 'original-colors' : paletteSignature(input.palette),
  ].join('|')
}

export function resolvePixGridFitRect(input: {
  sourceWidth: number
  sourceHeight: number
  targetWidth: number
  targetHeight: number
  fitMode: PixGridConversionSettings['fitMode']
  positionX: number
  positionY: number
  scale: number
}): PixGridFitRect {
  const sw = Math.max(1, input.sourceWidth)
  const sh = Math.max(1, input.sourceHeight)
  const tw = Math.max(1, input.targetWidth)
  const th = Math.max(1, input.targetHeight)
  const px = clamp(input.positionX, 0, 1)
  const py = clamp(input.positionY, 0, 1)
  const scale = clamp(input.scale, 0.1, 4)

  if (input.fitMode === 'stretch') {
    const dw = tw * scale
    const dh = th * scale
    return {
      sourceX: 0, sourceY: 0, sourceWidth: sw, sourceHeight: sh,
      destinationX: (tw - dw) * px,
      destinationY: (th - dh) * py,
      destinationWidth: dw,
      destinationHeight: dh,
    }
  }

  const baseScale = input.fitMode === 'cover' ? Math.max(tw / sw, th / sh) : Math.min(tw / sw, th / sh)
  const drawScale = baseScale * scale
  const dw = sw * drawScale
  const dh = sh * drawScale
  if (input.fitMode === 'cover' && scale === 1) {
    const visibleSourceWidth = tw / baseScale
    const visibleSourceHeight = th / baseScale
    return {
      sourceX: (sw - visibleSourceWidth) * px,
      sourceY: (sh - visibleSourceHeight) * py,
      sourceWidth: visibleSourceWidth,
      sourceHeight: visibleSourceHeight,
      destinationX: 0,
      destinationY: 0,
      destinationWidth: tw,
      destinationHeight: th,
    }
  }
  return {
    sourceX: 0, sourceY: 0, sourceWidth: sw, sourceHeight: sh,
    destinationX: (tw - dw) * px,
    destinationY: (th - dh) * py,
    destinationWidth: dw,
    destinationHeight: dh,
  }
}

export function buildPixGridPaletteColors(
  palette: ReactPalette,
  preserveBlack: boolean,
  preserveWhite: boolean,
): Array<[number, number, number]> {
  const background = hexToRgb(palette.background)
  const dark: [number, number, number] = mixRgb(background, [0, 0, 0], 0.7)
  const colors: Array<[number, number, number]> = [
    background,
    dark,
    hexToRgb(palette.primary),
    hexToRgb(palette.secondary),
    hexToRgb(palette.accent),
    hexToRgb(palette.highlight),
    hexToRgb(palette.text),
  ]
  if (preserveBlack) colors.unshift([0, 0, 0])
  if (preserveWhite) colors.push([255, 255, 255])
  return colors
}

function nearestPaletteColor(rgb: readonly number[], palette: readonly (readonly number[])[]): readonly number[] {
  let best = palette[0] ?? [0, 0, 0]
  let bestDistance = Number.POSITIVE_INFINITY
  for (const candidate of palette) {
    const distance = rgbDistance(rgb, candidate)
    if (distance < bestDistance) {
      bestDistance = distance
      best = candidate
    }
  }
  return best
}

function posterize(rgb: readonly number[], paletteSize: number): [number, number, number] {
  const levels = Math.max(2, Math.ceil(Math.cbrt(clamp(paletteSize, 2, 64))))
  const step = 255 / (levels - 1)
  return [
    clampByte(Math.round(rgb[0] / step) * step),
    clampByte(Math.round(rgb[1] / step) * step),
    clampByte(Math.round(rgb[2] / step) * step),
  ]
}

function transformColor(
  rgb: readonly number[],
  settings: PixGridConversionSettings,
  paletteColors: readonly (readonly number[])[],
): [number, number, number] {
  const blackLike = Math.max(rgb[0], rgb[1], rgb[2]) <= 14
  const whiteLike = Math.min(rgb[0], rgb[1], rgb[2]) >= 241
  if (settings.preserveBlack && blackLike) return [0, 0, 0]
  if (settings.preserveWhite && whiteLike) return [255, 255, 255]
  const posterized = posterize(rgb, settings.paletteSize)
  if (settings.colorMode === 'original') return posterized
  const limitedPalette = paletteColors.slice(0, Math.max(2, Math.min(settings.paletteSize, paletteColors.length)))
  const mapped = nearestPaletteColor(posterized, limitedPalette)
  const strength = settings.colorMode === 'brand'
    ? settings.brandStrength
    : settings.colorMode === 'preset'
      ? Math.max(0.72, settings.brandStrength)
      : settings.brandStrength * 0.62
  return mixRgb(posterized, mapped, strength)
}

function adjustedRgb(r: number, g: number, b: number, settings: PixGridConversionSettings): [number, number, number] {
  const brightness = settings.brightness
  const contrast = settings.contrast
  let rr = (r * brightness - 128) * contrast + 128
  let gg = (g * brightness - 128) * contrast + 128
  let bb = (b * brightness - 128) * contrast + 128
  const luminance = rr * 0.2126 + gg * 0.7152 + bb * 0.0722
  rr = luminance + (rr - luminance) * settings.saturation
  gg = luminance + (gg - luminance) * settings.saturation
  bb = luminance + (bb - luminance) * settings.saturation
  return [clampByte(rr), clampByte(gg), clampByte(bb)]
}

function applyEdgeEnhancement(
  pixels: Float32Array,
  width: number,
  height: number,
  amount: number,
): void {
  if (amount <= 0) return
  const original = new Float32Array(pixels)
  const factor = clamp(amount, 0, 1) * 0.45
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const offset = (y * width + x) * 4
      const neighbors = [offset - 4, offset + 4, offset - width * 4, offset + width * 4]
      for (let channel = 0; channel < 3; channel += 1) {
        const average = neighbors.reduce((sum, neighbor) => sum + original[neighbor + channel], 0) / 4
        pixels[offset + channel] = clamp(original[offset + channel] + (original[offset + channel] - average) * factor, 0, 255)
      }
    }
  }
}

const BAYER_4X4 = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
] as const

export function preparePixGridPixelData(input: PixGridPixelPreparationInput): Uint8Array {
  const { width, height, settings } = input
  const working = new Float32Array(input.pixels.length)
  for (let offset = 0; offset < input.pixels.length; offset += 4) {
    const [r, g, b] = adjustedRgb(input.pixels[offset], input.pixels[offset + 1], input.pixels[offset + 2], settings)
    working[offset] = r
    working[offset + 1] = g
    working[offset + 2] = b
    working[offset + 3] = input.pixels[offset + 3]
  }
  applyEdgeEnhancement(working, width, height, settings.edgeEnhancement)
  const paletteColors = buildPixGridPaletteColors(input.palette, settings.preserveBlack, settings.preserveWhite)
  const output = new Uint8Array(input.pixels.length)
  const errors = settings.ditherMode === 'atkinson' ? new Float32Array(input.pixels.length) : null

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4
      let alpha = clampByte(working[offset + 3])
      if (settings.backgroundHandling === 'remove-dark' && Math.max(working[offset], working[offset + 1], working[offset + 2]) < 24) alpha = 0
      if (alpha / 255 < settings.alphaThreshold) alpha = 0
      else if (!settings.preserveAlpha) alpha = 255

      let source: [number, number, number] = [working[offset], working[offset + 1], working[offset + 2]]
      if (errors) {
        source = [
          clampByte(source[0] + errors[offset]),
          clampByte(source[1] + errors[offset + 1]),
          clampByte(source[2] + errors[offset + 2]),
        ]
      } else if (settings.ditherMode === 'ordered-bayer') {
        const threshold = (BAYER_4X4[(y % 4) * 4 + (x % 4)] / 15 - 0.5) * 32
        source = [clampByte(source[0] + threshold), clampByte(source[1] + threshold), clampByte(source[2] + threshold)]
      }
      const transformed = transformColor(source, settings, paletteColors)
      output[offset] = transformed[0]
      output[offset + 1] = transformed[1]
      output[offset + 2] = transformed[2]
      output[offset + 3] = alpha

      if (errors && alpha > 0) {
        const error = [source[0] - transformed[0], source[1] - transformed[1], source[2] - transformed[2]]
        const spread = (targetOffset: number) => {
          if (targetOffset < 0 || targetOffset >= errors.length) return
          for (let channel = 0; channel < 3; channel += 1) errors[targetOffset + channel] += error[channel] / 8
        }
        if (x + 1 < width) spread(offset + 4)
        if (x + 2 < width) spread(offset + 8)
        if (y + 1 < height) {
          if (x > 0) spread(offset + width * 4 - 4)
          spread(offset + width * 4)
          if (x + 1 < width) spread(offset + width * 4 + 4)
        }
        if (y + 2 < height) spread(offset + width * 8)
      }
    }
  }

  if (settings.backgroundHandling === 'solid') {
    const background = hexToRgb(settings.backgroundColor)
    for (let offset = 0; offset < output.length; offset += 4) {
      const alpha = output[offset + 3] / 255
      if (alpha >= 1) continue
      output[offset] = clampByte(output[offset] * alpha + background[0] * (1 - alpha))
      output[offset + 1] = clampByte(output[offset + 1] * alpha + background[1] * (1 - alpha))
      output[offset + 2] = clampByte(output[offset + 2] * alpha + background[2] * (1 - alpha))
      output[offset + 3] = 255
    }
  }
  return output
}


function fourCc(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3])
}

export async function isAnimatedPixGridWebP(blob: Blob): Promise<boolean> {
  const scanLength = Math.min(blob.size, 256 * 1024)
  if (scanLength < 16) return false
  const bytes = new Uint8Array(await blob.slice(0, scanLength).arrayBuffer())
  if (fourCc(bytes, 0) !== 'RIFF' || fourCc(bytes, 8) !== 'WEBP') return false
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const chunk = fourCc(bytes, offset)
    const size = bytes[offset + 4]
      | (bytes[offset + 5] << 8)
      | (bytes[offset + 6] << 16)
      | (bytes[offset + 7] << 24)
    const payloadOffset = offset + 8
    if (chunk === 'ANIM' || chunk === 'ANMF') return true
    if (chunk === 'VP8X' && payloadOffset < bytes.length && (bytes[payloadOffset] & 0x02) !== 0) return true
    const safeSize = Math.max(0, size >>> 0)
    const next = payloadOffset + safeSize + (safeSize & 1)
    if (next <= offset || next > bytes.length) break
    offset = next
  }
  return false
}

interface DecodedPixGridImage {
  source: ImageBitmap | HTMLImageElement
  dispose: () => void
}

async function decodeBitmap(blob: Blob): Promise<DecodedPixGridImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob)
      return { source: bitmap, dispose: () => bitmap.close() }
    } catch {
      // Some browsers do not rasterize SVG through createImageBitmap. Fall back to a safely loaded image URL.
    }
  }
  if (typeof Image === 'undefined') throw new Error('Image decoding is unavailable in this environment.')
  const objectUrl = URL.createObjectURL(blob)
  const image = new Image()
  image.decoding = 'async'
  image.src = objectUrl
  try {
    await image.decode()
    return { source: image, dispose: () => URL.revokeObjectURL(objectUrl) }
  } catch (error) {
    URL.revokeObjectURL(objectUrl)
    throw error
  }
}

export async function preparePixGridMediaAsset(input: PixGridPreparationInput): Promise<PixGridPreparedAsset> {
  const capability = inspectPixGridMediaCapability(input.media)
  if (!capability.supported) throw new Error(capability.reason ?? 'Unsupported PixGrid media.')
  const sourceUrl = resolvePixGridMediaSourceUrl(input.media)
  if (!sourceUrl) throw new Error('The original media URL is temporarily unavailable.')
  const mediaRevision = resolvePixGridMediaRevision(input.media)
  const key = createPixGridConversionCacheKey({
    mediaId: input.media.id,
    mediaRevision,
    width: input.width,
    height: input.height,
    settings: input.settings,
    palette: input.palette,
  })
  const cached = pixGridPreparedAssetCache.get(key)
  if (cached) return cached

  const response = await fetch(sourceUrl, { signal: input.signal, cache: 'force-cache' })
  if (!response.ok) throw new Error(`PixGrid could not load the media asset (${response.status}).`)
  const blob = await response.blob()
  if (blob.size > MAX_PIX_GRID_MEDIA_SOURCE_BYTES) {
    throw new Error('This media asset is too large for bounded PixGrid preparation.')
  }
  if (capability.kind === 'webp' && await isAnimatedPixGridWebP(blob)) {
    throw new Error('Animated WebP is not supported by PixGrid.')
  }
  const svgGroupCandidates = capability.kind === 'svg' && blob.size <= MAX_PIX_GRID_SVG_SOURCE_CHARACTERS
    ? extractPixGridSvgGroupCandidates(await blob.text())
    : []
  const decoded = await decodeBitmap(blob)
  const bitmap = decoded.source
  try {
    const canvas = document.createElement('canvas')
    canvas.width = input.width
    canvas.height = input.height
    const context = canvas.getContext('2d', { alpha: true, willReadFrequently: true })
    if (!context) throw new Error('PixGrid could not allocate an image preparation canvas.')
    context.clearRect(0, 0, input.width, input.height)
    context.imageSmoothingEnabled = input.settings.sampling === 'smooth'
    const sourceWidth = 'naturalWidth' in bitmap ? bitmap.naturalWidth : bitmap.width
    const sourceHeight = 'naturalHeight' in bitmap ? bitmap.naturalHeight : bitmap.height
    const rect = resolvePixGridFitRect({
      sourceWidth: sourceWidth || input.width,
      sourceHeight: sourceHeight || input.height,
      targetWidth: input.width,
      targetHeight: input.height,
      fitMode: input.settings.fitMode,
      positionX: input.settings.positionX,
      positionY: input.settings.positionY,
      scale: input.settings.scale,
    })
    context.drawImage(
      bitmap,
      rect.sourceX, rect.sourceY, rect.sourceWidth, rect.sourceHeight,
      rect.destinationX, rect.destinationY, rect.destinationWidth, rect.destinationHeight,
    )
    const imageData = context.getImageData(0, 0, input.width, input.height)
    const pixels = preparePixGridPixelData({
      pixels: imageData.data,
      width: input.width,
      height: input.height,
      settings: input.settings,
      palette: input.palette,
    })
    const prepared: PixGridPreparedAsset = {
      key,
      mediaId: input.media.id,
      mediaRevision,
      width: input.width,
      height: input.height,
      pixels,
      approximateBytes: pixels.byteLength + svgGroupCandidates.length * 160,
      ...(svgGroupCandidates.length > 0 ? { svgGroupCandidates } : {}),
    }
    pixGridPreparedAssetCache.set(prepared)
    return prepared
  } finally {
    decoded.dispose()
  }
}

export class PixGridPreparedAssetCache {
  private readonly entries = new Map<string, PixGridPreparedAsset>()
  private bytes = 0

  constructor(
    readonly maxEntries = 24,
    readonly maxBytes = 16 * 1024 * 1024,
  ) {}

  get size(): number { return this.entries.size }
  get approximateBytes(): number { return this.bytes }

  get(key: string): PixGridPreparedAsset | null {
    const entry = this.entries.get(key)
    if (!entry) return null
    this.entries.delete(key)
    this.entries.set(key, entry)
    return entry
  }


  findLatestMedia(mediaId: string, width?: number, height?: number): PixGridPreparedAsset | null {
    const matches = [...this.entries.values()].filter(entry => (
      entry.mediaId === mediaId
      && (width == null || entry.width === width)
      && (height == null || entry.height === height)
    ))
    const entry = matches[matches.length - 1] ?? null
    if (!entry) return null
    this.entries.delete(entry.key)
    this.entries.set(entry.key, entry)
    return entry
  }

  set(entry: PixGridPreparedAsset): void {
    const previous = this.entries.get(entry.key)
    if (previous) this.bytes -= previous.approximateBytes
    this.entries.delete(entry.key)
    this.entries.set(entry.key, entry)
    this.bytes += entry.approximateBytes
    while (this.entries.size > this.maxEntries || this.bytes > this.maxBytes) {
      const oldestKey = this.entries.keys().next().value as string | undefined
      if (!oldestKey) break
      const oldest = this.entries.get(oldestKey)
      this.entries.delete(oldestKey)
      this.bytes -= oldest?.approximateBytes ?? 0
    }
  }

  invalidateMedia(mediaId: string, keepRevision?: number): void {
    for (const [key, entry] of this.entries) {
      if (entry.mediaId === mediaId && (keepRevision == null || entry.mediaRevision !== keepRevision)) {
        this.entries.delete(key)
        this.bytes -= entry.approximateBytes
      }
    }
  }

  clear(): void {
    this.entries.clear()
    this.bytes = 0
  }
}

export const pixGridPreparedAssetCache = new PixGridPreparedAssetCache()

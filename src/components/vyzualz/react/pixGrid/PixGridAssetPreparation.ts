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
import { isAnimatedPixGridWebP } from './PixGridWebP'
import {
  createPixGridConversionCacheKey,
  preparePixGridPixelData,
  resolvePixGridFitRect,
} from './PixGridPixelPreparation'

export { isAnimatedPixGridWebP } from './PixGridWebP'

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

export interface PixGridPreparationInput {
  media: UploadedMedia
  width: number
  height: number
  settings: PixGridConversionSettings
  palette: ReactPalette
  signal?: AbortSignal
}

export {
  buildPixGridPaletteColors,
  createPixGridConversionCacheKey,
  preparePixGridPixelData,
  resolvePixGridFitRect,
} from './PixGridPixelPreparation'
export type {
  PixGridFitRect,
  PixGridPixelPreparationInput,
} from './PixGridPixelPreparation'

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

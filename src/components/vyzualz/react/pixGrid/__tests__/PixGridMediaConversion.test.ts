import { describe, expect, it } from 'vitest'
import type { UploadedMedia } from '../../../../../stores/mediaStore'
import { DEFAULT_PIX_GRID_CONVERSION_SETTINGS } from '../PixGridDefaults'
import {
  PixGridPreparedAssetCache,
  buildPixGridPaletteColors,
  createPixGridConversionCacheKey,
  isAnimatedPixGridWebP,
  preparePixGridPixelData,
  resolvePixGridFitRect,
  type PixGridPreparedAsset,
} from '../PixGridAssetPreparation'
import {
  getPixGridMediaDisabledReason,
  inspectPixGridMediaCapability,
} from '../PixGridMediaCapabilities'
import type { ReactPalette } from '../../ReactTypes'

const palette: ReactPalette = {
  primary: '#00d9ff',
  secondary: '#00d982',
  accent: '#ff3ed1',
  background: '#020508',
  highlight: '#ffffff',
  text: '#dce8ee',
}

function media(overrides: Partial<UploadedMedia>): UploadedMedia {
  return {
    id: 'media-1',
    name: 'art.png',
    type: 'image',
    url: 'blob:test',
    thumbnailUrl: null,
    meta: 'PNG',
    favorite: false,
    mediaRole: 'other',
    tags: [],
    collectionIds: [],
    metadata: {},
    mimeType: 'image/png',
    revision: 1,
    ...overrides,
  }
}

describe('PixGrid media capability filtering', () => {
  it.each([
    ['image/png', 'art.png', 'png'],
    ['image/jpeg', 'art.jpg', 'jpeg'],
    ['image/jpeg', 'art.jpeg', 'jpeg'],
    ['image/webp', 'art.webp', 'webp'],
    ['image/svg+xml', 'art.svg', 'svg'],
  ] as const)('accepts %s', (mimeType, name, kind) => {
    expect(inspectPixGridMediaCapability(media({ mimeType, name }))).toMatchObject({ supported: true, kind })
  })

  it('rejects unsupported and animated media with a useful reason', () => {
    expect(getPixGridMediaDisabledReason(media({ type: 'video', mimeType: 'video/mp4', name: 'clip.mp4' }))).toMatch(/not video/i)
    expect(getPixGridMediaDisabledReason(media({ mimeType: 'image/gif', name: 'loop.gif' }))).toMatch(/GIF/i)
    expect(getPixGridMediaDisabledReason(media({ mimeType: 'image/webp', name: 'loop.webp', metadata: { animated: true } as UploadedMedia['metadata'] }))).toMatch(/Animated WebP/i)
    expect(getPixGridMediaDisabledReason(media({ uploading: true }))).toMatch(/uploading|syncing/i)
  })
})

describe('PixGrid conversion cache and fit math', () => {
  it('includes media revision, logical resolution, palette, crop, color, and alpha settings in cache keys', () => {
    const base = {
      mediaId: 'media-1',
      mediaRevision: 4,
      width: 160,
      height: 90,
      settings: { ...DEFAULT_PIX_GRID_CONVERSION_SETTINGS, selectedMediaId: 'media-1', colorMode: 'brand' as const },
      palette,
    }
    const key = createPixGridConversionCacheKey(base)
    expect(createPixGridConversionCacheKey({ ...base, mediaRevision: 5 })).not.toBe(key)
    expect(createPixGridConversionCacheKey({ ...base, width: 96, height: 54 })).not.toBe(key)
    expect(createPixGridConversionCacheKey({ ...base, settings: { ...base.settings, positionX: 0.2 } })).not.toBe(key)
    expect(createPixGridConversionCacheKey({ ...base, settings: { ...base.settings, alphaThreshold: 0.5 } })).not.toBe(key)
    expect(createPixGridConversionCacheKey({ ...base, palette: { ...palette, primary: '#ff0000' } })).not.toBe(key)
  })

  it('calculates contain and cover crop rectangles deterministically', () => {
    expect(resolvePixGridFitRect({
      sourceWidth: 100,
      sourceHeight: 100,
      targetWidth: 160,
      targetHeight: 90,
      fitMode: 'contain',
      positionX: 0.5,
      positionY: 0.5,
      scale: 1,
    })).toMatchObject({ destinationX: 35, destinationY: 0, destinationWidth: 90, destinationHeight: 90 })

    const cover = resolvePixGridFitRect({
      sourceWidth: 100,
      sourceHeight: 100,
      targetWidth: 160,
      targetHeight: 90,
      fitMode: 'cover',
      positionX: 0.5,
      positionY: 0.5,
      scale: 1,
    })
    expect(cover.sourceWidth).toBeCloseTo(100)
    expect(cover.sourceHeight).toBeCloseTo(56.25)
    expect(cover.sourceY).toBeCloseTo(21.875)
    expect(cover.destinationWidth).toBe(160)
  })

  it('detects animated WebP containers before decoding a first frame', async () => {
    const bytes = new Uint8Array(30)
    bytes.set([...'RIFF'].map(char => char.charCodeAt(0)), 0)
    bytes.set([...'WEBP'].map(char => char.charCodeAt(0)), 8)
    bytes.set([...'VP8X'].map(char => char.charCodeAt(0)), 12)
    bytes[16] = 10
    bytes[20] = 0x02
    expect(await isAnimatedPixGridWebP(new Blob([bytes], { type: 'image/webp' }))).toBe(true)
    bytes[20] = 0
    expect(await isAnimatedPixGridWebP(new Blob([bytes], { type: 'image/webp' }))).toBe(false)
  })

  it('bounds entries and approximate bytes while invalidating only stale media revisions', () => {
    const cache = new PixGridPreparedAssetCache(2, 16)
    const entry = (key: string, mediaId: string, revision: number): PixGridPreparedAsset => ({
      key,
      mediaId,
      mediaRevision: revision,
      width: 1,
      height: 1,
      pixels: new Uint8Array(8),
      approximateBytes: 8,
    })
    cache.set(entry('a', 'one', 1))
    cache.set(entry('b', 'one', 2))
    cache.set(entry('c', 'two', 1))
    expect(cache.size).toBe(2)
    expect(cache.approximateBytes).toBeLessThanOrEqual(16)
    cache.invalidateMedia('one', 2)
    expect(cache.get('b')).not.toBeNull()
    cache.invalidateMedia('one')
    expect(cache.get('b')).toBeNull()
  })
})

describe('PixGrid quantization, dithering, alpha, and palette mapping', () => {
  it('is deterministic for ordered and error-diffusion dithering', () => {
    const source = new Uint8ClampedArray(8 * 8 * 4)
    for (let i = 0; i < source.length; i += 4) {
      source[i] = (i * 7) % 255
      source[i + 1] = (i * 11) % 255
      source[i + 2] = (i * 13) % 255
      source[i + 3] = 255
    }
    for (const ditherMode of ['ordered-bayer', 'atkinson'] as const) {
      const settings = { ...DEFAULT_PIX_GRID_CONVERSION_SETTINGS, ditherMode, paletteSize: 8 }
      expect(preparePixGridPixelData({ pixels: source, width: 8, height: 8, settings, palette }))
        .toEqual(preparePixGridPixelData({ pixels: source, width: 8, height: 8, settings, palette }))
    }
  })

  it('preserves or thresholds alpha without mutating the source', () => {
    const source = new Uint8ClampedArray([200, 100, 50, 80, 10, 20, 30, 220])
    const original = new Uint8ClampedArray(source)
    const preserved = preparePixGridPixelData({
      pixels: source,
      width: 2,
      height: 1,
      settings: { ...DEFAULT_PIX_GRID_CONVERSION_SETTINGS, alphaThreshold: 0.5, preserveAlpha: true },
      palette,
    })
    expect(preserved[3]).toBe(0)
    expect(preserved[7]).toBe(220)
    expect(source).toEqual(original)
  })

  it('maps background, dark, primary, secondary, accent, highlight, and text roles', () => {
    const colors = buildPixGridPaletteColors(palette, true, true)
    expect(colors).toContainEqual([0, 0, 0])
    expect(colors).toContainEqual([255, 255, 255])
    expect(colors).toContainEqual([0, 217, 255])
    expect(colors.length).toBeGreaterThanOrEqual(9)
  })

  it('keeps a simple high-resolution symbol readable at High 160 × 90', () => {
    const width = 160
    const height = 90
    const source = new Uint8ClampedArray(width * height * 4)
    for (let y = 20; y < 70; y += 1) {
      for (let x = 55; x < 105; x += 1) {
        const offset = (y * width + x) * 4
        source[offset] = 230
        source[offset + 1] = 245
        source[offset + 2] = 255
        source[offset + 3] = 255
      }
    }
    const output = preparePixGridPixelData({
      pixels: source,
      width,
      height,
      settings: {
        ...DEFAULT_PIX_GRID_CONVERSION_SETTINGS,
        colorMode: 'brand',
        ditherMode: 'ordered-bayer',
        paletteSize: 8,
        alphaThreshold: 0.1,
      },
      palette,
    })
    let opaque = 0
    for (let offset = 3; offset < output.length; offset += 4) if (output[offset] > 0) opaque += 1
    expect(opaque).toBe(50 * 50)
  })
})

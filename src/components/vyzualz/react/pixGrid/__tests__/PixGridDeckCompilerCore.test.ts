import { describe, expect, it } from 'vitest'
import { DEFAULT_PIX_GRID_CONVERSION_SETTINGS } from '../PixGridDefaults'
import {
  PIX_GRID_DECK_GENERATED_MASK_NAMES,
  PIX_GRID_DECK_COMPILER_SCHEMA_VERSION,
} from '../PixGridDeckCompilerContracts'
import {
  PIX_GRID_DECK_COMPILER_PALETTE,
  compilePixGridDeckRasterFrame,
  createPixGridDeckCompilerCacheKey,
  createPixGridDeckConversionSettings,
  derivePixGridDeckFrameAnalysis,
} from '../PixGridDeckCompilerCore'
import { preparePixGridPixelData } from '../PixGridPixelPreparation'

const raster = new Uint8ClampedArray([
  255, 255, 255, 255, 255, 0, 0, 255, 0, 0, 0, 0,
  0, 255, 0, 255, 0, 0, 64, 255, 0, 0, 0, 0,
  0, 0, 255, 255, 128, 128, 128, 255, 0, 0, 0, 0,
])
const sourceAlpha = new Uint8Array([255, 255, 0, 255, 255, 0, 255, 255, 0])

describe('PixGrid Deck worker-safe compiler core', () => {
  it('keeps the existing PixGrid preparation math canonical', () => {
    const settings = createPixGridDeckConversionSettings('#123456', true)
    expect(settings).toMatchObject({
      ...DEFAULT_PIX_GRID_CONVERSION_SETTINGS,
      fitMode: 'contain',
      sampling: 'crisp',
      colorMode: 'original',
      ditherMode: 'none',
      backgroundHandling: 'solid',
      backgroundColor: '#123456',
    })
    const expected = preparePixGridPixelData({
      pixels: raster,
      width: 3,
      height: 3,
      settings,
      palette: PIX_GRID_DECK_COMPILER_PALETTE,
    })
    const prepared = compilePixGridDeckRasterFrame({
      cacheKey: 'frame-key',
      mediaId: 'media-a',
      sourceFingerprint: 'sha256:a',
      sourceRevision: 1,
      rasterPixels: raster,
      sourceAlpha,
      width: 3,
      height: 3,
      transparentBackground: '#123456',
      hasAlpha: true,
    })
    expect(prepared.schemaVersion).toBe(PIX_GRID_DECK_COMPILER_SCHEMA_VERSION)
    expect(prepared.pixels).toEqual(expected)
  })

  it('derives every canonical mask and deterministic metrics', () => {
    const first = derivePixGridDeckFrameAnalysis({ pixels: new Uint8Array(raster), sourceAlpha, width: 3, height: 3 })
    const second = derivePixGridDeckFrameAnalysis({ pixels: new Uint8Array(raster), sourceAlpha, width: 3, height: 3 })
    expect(first).toEqual(second)
    expect(Object.keys(first.masks).sort()).toEqual([...PIX_GRID_DECK_GENERATED_MASK_NAMES].sort())
    expect(first.metrics).toMatchObject({
      cellCount: 9,
      foregroundCellCount: 6,
      backgroundCellCount: 3,
      bounds: { minX: 0, minY: 0, maxX: 1, maxY: 2 },
    })
    expect(first.metrics.borderCellCount).toBeGreaterThan(0)
    expect(first.metrics.centerCellCount).toBeGreaterThan(0)
  })

  it('invalidates keys for every pixel-affecting input', () => {
    const base = {
      sourceFingerprint: 'sha256:source',
      sourceRevision: 1,
      mimeType: 'image/png',
      width: 160,
      height: 90,
      transparentBackground: '#000000',
      hasAlpha: true,
    }
    const key = createPixGridDeckCompilerCacheKey(base)
    expect(createPixGridDeckCompilerCacheKey({ ...base })).toBe(key)
    expect(createPixGridDeckCompilerCacheKey({ ...base, sourceRevision: 2 })).not.toBe(key)
    expect(createPixGridDeckCompilerCacheKey({ ...base, sourceFingerprint: 'sha256:changed' })).not.toBe(key)
    expect(createPixGridDeckCompilerCacheKey({ ...base, width: 96, height: 54 })).not.toBe(key)
    expect(createPixGridDeckCompilerCacheKey({ ...base, transparentBackground: '#102030' })).not.toBe(key)
    expect(createPixGridDeckCompilerCacheKey({ ...base, hasAlpha: false })).not.toBe(key)
  })
})

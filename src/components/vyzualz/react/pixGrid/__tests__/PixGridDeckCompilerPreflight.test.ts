import { describe, expect, it, vi } from 'vitest'
import {
  PIX_GRID_DECK_COMPILER_SCHEMA_VERSION,
  PIX_GRID_DECK_GENERATED_MASK_NAMES,
  type PixGridPreparedFrame,
} from '../PixGridDeckCompilerContracts'
import type { PixGridDeckBlobCompileRequest } from '../PixGridDeckCompilerExecutor'
import { preflightPixGridDeckSources } from '../PixGridDeckCompilerPreflight'
import type { PixGridDeckItemDefinition } from '../PixGridDeckDomain'
import { PixGridDeckPreparedFrameCache } from '../PixGridDeckPreparedFrameCache'

function item(index: number): PixGridDeckItemDefinition {
  return {
    id: `item-${index}`,
    mediaId: `media-${index}`,
    enabled: true,
    order: index,
    revision: 1,
    timingOverrideBeats: null,
    source: {
      mediaRevision: 1,
      fingerprint: `sha256:item-${index}`,
      fileName: `item-${index}.png`,
      mimeType: 'image/png',
      width: 2,
      height: 2,
      hasAlpha: index % 2 === 0,
      transparentBackground: '#112233',
    },
  }
}

function frame(request: PixGridDeckBlobCompileRequest): PixGridPreparedFrame {
  const cells = request.width * request.height
  const masks = Object.fromEntries(
    PIX_GRID_DECK_GENERATED_MASK_NAMES.map(name => [name, new Uint8Array(cells)]),
  ) as PixGridPreparedFrame['masks']
  return {
    schemaVersion: PIX_GRID_DECK_COMPILER_SCHEMA_VERSION,
    cacheKey: request.cacheKey,
    mediaId: request.mediaId,
    sourceFingerprint: request.sourceFingerprint,
    sourceRevision: request.sourceRevision,
    width: request.width,
    height: request.height,
    pixels: new Uint8Array(cells * 4),
    masks,
    metrics: {
      cellCount: cells,
      foregroundCellCount: 0,
      backgroundCellCount: cells,
      borderCellCount: 0,
      highlightCellCount: 0,
      shadowCellCount: 0,
      centerCellCount: 0,
      averageLuminance: 0,
      luminanceDeviation: 0,
      averageAlpha: 0,
      bounds: null,
    },
    approximateBytes: cells * 10 + 256,
  }
}

describe('PixGrid Deck source preflight', () => {
  it('keeps successful frames cached while rejecting only the failed new item', async () => {
    const cache = new PixGridDeckPreparedFrameCache()
    const compile = vi.fn(async (request: PixGridDeckBlobCompileRequest) => {
      if (request.mediaId === 'media-1') {
        throw { code: 'decode-failed', message: 'The image is corrupt.', retryable: false }
      }
      return frame(request)
    })
    const entries = [0, 1, 2].map(index => ({ item: item(index), source: new Blob([String(index)]) }))
    const result = await preflightPixGridDeckSources(entries, 16, 9, { cache, compile, concurrency: 2 })
    expect(result.acceptedItemIds).toEqual(['item-0', 'item-2'])
    expect(result.rejected).toEqual([
      expect.objectContaining({ itemId: 'item-1', error: expect.objectContaining({ code: 'decode-failed' }) }),
    ])
    expect(cache.size).toBe(2)
  })

  it('deduplicates a second preflight through the shared cache key', async () => {
    const cache = new PixGridDeckPreparedFrameCache()
    const compile = vi.fn(async (request: PixGridDeckBlobCompileRequest) => frame(request))
    const entry = { item: item(0), source: new Blob(['source']) }
    await preflightPixGridDeckSources([entry], 16, 9, { cache, compile })
    await preflightPixGridDeckSources([entry], 16, 9, { cache, compile })
    expect(compile).toHaveBeenCalledTimes(1)
  })

  it('does not cache or accept a late result after cancellation', async () => {
    const cache = new PixGridDeckPreparedFrameCache()
    const controller = new AbortController()
    const compile = vi.fn(async (request: PixGridDeckBlobCompileRequest) => {
      controller.abort()
      return frame(request)
    })
    const entry = { item: item(0), source: new Blob(['source']) }
    const result = await preflightPixGridDeckSources([entry], 16, 9, {
      cache,
      compile,
      signal: controller.signal,
    })
    expect(result.acceptedItemIds).toEqual([])
    expect(result.rejected).toEqual([
      expect.objectContaining({ itemId: 'item-0', error: expect.objectContaining({ code: 'cancelled' }) }),
    ])
    expect(cache.size).toBe(0)
  })
})

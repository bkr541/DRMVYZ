import { describe, expect, it } from 'vitest'
import {
  PIX_GRID_DECK_COMPILER_SCHEMA_VERSION,
  PIX_GRID_DECK_GENERATED_MASK_NAMES,
  type PixGridPreparedFrame,
} from '../PixGridDeckCompilerContracts'
import { PixGridDeckPreparedFrameCache } from '../PixGridDeckPreparedFrameCache'

function frame(key: string, fingerprint: string, revision = 1, approximateBytes = 100): PixGridPreparedFrame {
  const masks = Object.fromEntries(
    PIX_GRID_DECK_GENERATED_MASK_NAMES.map(name => [name, new Uint8Array(1)]),
  ) as PixGridPreparedFrame['masks']
  return {
    schemaVersion: PIX_GRID_DECK_COMPILER_SCHEMA_VERSION,
    cacheKey: key,
    mediaId: key,
    sourceFingerprint: fingerprint,
    sourceRevision: revision,
    width: 1,
    height: 1,
    pixels: new Uint8Array(4),
    masks,
    metrics: {
      cellCount: 1,
      foregroundCellCount: 0,
      backgroundCellCount: 1,
      borderCellCount: 0,
      highlightCellCount: 0,
      shadowCellCount: 0,
      centerCellCount: 0,
      averageLuminance: 0,
      luminanceDeviation: 0,
      averageAlpha: 0,
      bounds: null,
    },
    approximateBytes,
  }
}

describe('PixGrid Deck prepared frame cache', () => {
  it('evicts least-recently-used entries without mutating frame contents', () => {
    const cache = new PixGridDeckPreparedFrameCache(2, 1_000)
    const first = frame('first', 'source-a')
    cache.set(first)
    cache.set(frame('second', 'source-b'))
    expect(cache.get('first')).toBe(first)
    expect(cache.set(frame('third', 'source-c'))).toEqual(['second'])
    expect(cache.keys).toEqual(['first', 'third'])
    expect(first.pixels).toEqual(new Uint8Array(4))
  })

  it('invalidates only stale revisions for a source fingerprint', () => {
    const cache = new PixGridDeckPreparedFrameCache()
    cache.set(frame('old', 'shared', 1))
    cache.set(frame('current', 'shared', 2))
    cache.set(frame('other', 'other', 1))
    cache.invalidateSource('shared', 2)
    expect(cache.keys).toEqual(['current', 'other'])
  })

  it('reports and removes an entry that alone exceeds the hard byte bound', () => {
    const cache = new PixGridDeckPreparedFrameCache(4, 50)
    expect(cache.set(frame('oversized', 'source', 1, 100))).toEqual(['oversized'])
    expect(cache.size).toBe(0)
    expect(cache.approximateBytes).toBe(0)
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../stores/mediaStore', () => ({
  useMediaStore: { getState: () => ({ items: [], ensureMediaSigned: vi.fn(), retryMediaAsset: vi.fn() }) },
}))

import {
  PixGridDeckCompileCoordinator,
  type PixGridDeckCompileFunction,
} from '../PixGridDeckCompileCoordinator'
import {
  PIX_GRID_DECK_COMPILER_SCHEMA_VERSION,
  PIX_GRID_DECK_GENERATED_MASK_NAMES,
  type PixGridPreparedFrame,
} from '../PixGridDeckCompilerContracts'
import type { PixGridDeckBlobCompileRequest } from '../PixGridDeckCompilerExecutor'
import { createPixGridDeckItemCompilerCacheKey } from '../PixGridDeckCompilerCore'
import {
  DEFAULT_PIX_GRID_DECK_CONFIGURATION,
  type PixGridDeckDefinition,
  type PixGridDeckItemDefinition,
} from '../PixGridDeckDomain'
import { PixGridDeckPreparedFrameCache } from '../PixGridDeckPreparedFrameCache'

function item(index: number, source = `source-${index}`): PixGridDeckItemDefinition {
  return {
    id: `item-${index}`,
    mediaId: `media-${source}`,
    enabled: true,
    order: index,
    revision: 1,
    timingOverrideBeats: null,
    source: {
      mediaRevision: 1,
      fingerprint: `sha256:${source}`,
      fileName: `${source}.png`,
      mimeType: 'image/png',
      width: 2,
      height: 2,
      hasAlpha: true,
      transparentBackground: '#000000',
    },
  }
}

function deck(id: string, items: PixGridDeckItemDefinition[], revision = 1): PixGridDeckDefinition {
  return {
    schemaVersion: 1,
    id,
    name: id,
    revision,
    generatedPresetId: `pix-grid-deck:${id}`,
    items,
    configuration: { ...DEFAULT_PIX_GRID_DECK_CONFIGURATION, transitionPolicy: { ...DEFAULT_PIX_GRID_DECK_CONFIGURATION.transitionPolicy } },
  }
}

function frame(request: PixGridDeckBlobCompileRequest): PixGridPreparedFrame {
  const cells = request.width * request.height
  const pixels = new Uint8Array(cells * 4).fill(127)
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
    pixels,
    masks,
    metrics: {
      cellCount: cells,
      foregroundCellCount: 0,
      backgroundCellCount: cells,
      borderCellCount: 0,
      highlightCellCount: 0,
      shadowCellCount: 0,
      centerCellCount: 0,
      averageLuminance: 0.5,
      luminanceDeviation: 0,
      averageAlpha: 1,
      bounds: null,
    },
    approximateBytes: pixels.byteLength + cells * PIX_GRID_DECK_GENERATED_MASK_NAMES.length + 256,
  }
}

async function waitUntil(predicate: () => boolean, timeoutMs = 2_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for Deck compiler state.')
    await new Promise(resolve => setTimeout(resolve, 5))
  }
}

const sourceResolver = vi.fn(async () => new Blob(['image'], { type: 'image/png' }))

describe('PixGrid Deck compile coordinator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('bounds twelve incremental jobs at the canonical concurrency of three', async () => {
    let active = 0
    let peak = 0
    const compile: PixGridDeckCompileFunction = async request => {
      active += 1
      peak = Math.max(peak, active)
      await new Promise(resolve => setTimeout(resolve, 8))
      active -= 1
      return frame(request)
    }
    const coordinator = new PixGridDeckCompileCoordinator({
      cache: new PixGridDeckPreparedFrameCache(),
      sourceResolver,
      compile,
    })
    coordinator.synchronize([deck('deck-12', Array.from({ length: 12 }, (_, index) => item(index)))], 16, 9)
    await waitUntil(() => coordinator.getStatus('deck-12')?.ready === true)
    expect(peak).toBe(3)
    expect(sourceResolver).toHaveBeenCalledTimes(12)
    expect(coordinator.getStatus('deck-12')).toMatchObject({
      phase: 'ready', enabledItemCount: 12, readyItemCount: 12, progress: 1,
    })
    coordinator.dispose()
  })

  it('deduplicates shared source keys across Decks and projects both as ready', async () => {
    const compile = vi.fn(async (request: PixGridDeckBlobCompileRequest) => frame(request))
    const sharedA = item(0, 'shared-a')
    const sharedB = item(1, 'shared-b')
    const coordinator = new PixGridDeckCompileCoordinator({
      cache: new PixGridDeckPreparedFrameCache(),
      sourceResolver,
      compile,
    })
    coordinator.synchronize([
      deck('deck-a', [sharedA, sharedB]),
      deck('deck-b', [{ ...sharedA, id: 'item-a2' }, { ...sharedB, id: 'item-b2' }]),
    ], 16, 9)
    await waitUntil(() => coordinator.getStatus('deck-a')?.ready === true && coordinator.getStatus('deck-b')?.ready === true)
    expect(compile).toHaveBeenCalledTimes(2)
    expect(coordinator.getDiagnostics().deduplicatedJobCount).toBeGreaterThanOrEqual(2)
    expect(coordinator.getPreparedFrameSet('deck-b')?.frames).toHaveLength(2)
    coordinator.dispose()
  })

  it('reuses in-flight pixel work across a non-pixel Deck revision and reorder', async () => {
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    const compile = vi.fn(async (request: PixGridDeckBlobCompileRequest) => {
      await gate
      return frame(request)
    })
    const first = item(0)
    const second = item(1)
    const coordinator = new PixGridDeckCompileCoordinator({
      cache: new PixGridDeckPreparedFrameCache(),
      sourceResolver,
      compile,
    })
    coordinator.synchronize([deck('deck-reorder', [first, second], 1)], 16, 9)
    await waitUntil(() => coordinator.getDiagnostics().runningJobCount === 2)
    coordinator.synchronize([deck('deck-reorder', [
      { ...second, order: 0 },
      { ...first, order: 1 },
    ], 2)], 16, 9)
    release()

    await waitUntil(() => coordinator.getStatus('deck-reorder')?.ready === true)
    expect(compile).toHaveBeenCalledTimes(2)
    expect(coordinator.getStatus('deck-reorder')?.deckRevision).toBe(2)
    expect(coordinator.getPreparedFrameSet('deck-reorder')?.frames.map(value => value.mediaId))
      .toEqual([second.mediaId, first.mediaId])
    coordinator.dispose()
  })

  it('recompiles only a changed image and keeps reorder-only edits cache-hot', async () => {
    const compile = vi.fn(async (request: PixGridDeckBlobCompileRequest) => frame(request))
    const first = item(0)
    const second = item(1)
    const coordinator = new PixGridDeckCompileCoordinator({
      cache: new PixGridDeckPreparedFrameCache(),
      sourceResolver,
      compile,
    })
    coordinator.synchronize([deck('deck-incremental', [first, second], 1)], 16, 9)
    await waitUntil(() => coordinator.getStatus('deck-incremental')?.ready === true)
    expect(compile).toHaveBeenCalledTimes(2)

    const changedSecond: PixGridDeckItemDefinition = {
      ...second,
      revision: 2,
      source: {
        ...second.source,
        mediaRevision: 2,
        fingerprint: 'sha256:source-1-revised',
      },
    }
    coordinator.synchronize([deck('deck-incremental', [first, changedSecond], 2)], 16, 9)
    await waitUntil(() => coordinator.getStatus('deck-incremental')?.ready === true)
    expect(compile).toHaveBeenCalledTimes(3)

    coordinator.synchronize([deck('deck-incremental', [
      { ...changedSecond, order: 0 },
      { ...first, order: 1 },
    ], 3)], 16, 9)
    await waitUntil(() => coordinator.getStatus('deck-incremental')?.deckRevision === 3)
    expect(compile).toHaveBeenCalledTimes(3)
    coordinator.dispose()
  })

  it('rejects out-of-order results after a quality change and recompiles current dimensions', async () => {
    const cache = new PixGridDeckPreparedFrameCache()
    const compile: PixGridDeckCompileFunction = async request => {
      await new Promise(resolve => setTimeout(resolve, request.width === 160 ? 25 : 2))
      return frame(request)
    }
    const currentDeck = deck('deck-quality', [item(0), item(1)])
    const coordinator = new PixGridDeckCompileCoordinator({ cache, sourceResolver, compile, concurrency: 3 })
    coordinator.synchronize([currentDeck], 160, 90)
    coordinator.synchronize([currentDeck], 96, 54)
    await waitUntil(() => coordinator.getStatus('deck-quality')?.ready === true)
    expect(coordinator.getStatus('deck-quality')).toMatchObject({ width: 96, height: 54 })
    expect(coordinator.getPreparedFrameSet('deck-quality')).toMatchObject({ width: 96, height: 54 })
    expect(cache.keys.every(key => key.includes('|96x54|'))).toBe(true)
    expect(cache.peek(createPixGridDeckItemCompilerCacheKey(currentDeck.items[0], 160, 90))).toBeNull()
    coordinator.dispose()
  })

  it('survives rapid quality flips without an aborted-key queue deadlock', async () => {
    const compile: PixGridDeckCompileFunction = async request => {
      await new Promise(resolve => setTimeout(resolve, 10))
      return frame(request)
    }
    const currentDeck = deck('deck-quality-flip', [item(0), item(1)])
    const coordinator = new PixGridDeckCompileCoordinator({
      cache: new PixGridDeckPreparedFrameCache(),
      sourceResolver,
      compile,
    })
    coordinator.synchronize([currentDeck], 160, 90)
    await waitUntil(() => coordinator.getDiagnostics().runningJobCount > 0)
    coordinator.synchronize([currentDeck], 96, 54)
    coordinator.synchronize([currentDeck], 160, 90)

    await waitUntil(() => coordinator.getStatus('deck-quality-flip')?.ready === true)
    expect(coordinator.getStatus('deck-quality-flip')).toMatchObject({ width: 160, height: 90 })
    expect(coordinator.getPreparedFrameSet('deck-quality-flip')).toMatchObject({ width: 160, height: 90 })
    coordinator.dispose()
  })

  it('keeps successful frames cached but refuses readiness after a current item failure', async () => {
    const cache = new PixGridDeckPreparedFrameCache()
    const compile: PixGridDeckCompileFunction = async request => {
      if (request.mediaId.includes('source-1')) {
        throw { code: 'decode-failed', message: 'Fixture decode failed.', retryable: false }
      }
      return frame(request)
    }
    const failedDeck = deck('deck-failed', [item(0), item(1)])
    const coordinator = new PixGridDeckCompileCoordinator({ cache, sourceResolver, compile })
    coordinator.synchronize([failedDeck], 16, 9)
    await waitUntil(() => coordinator.getStatus('deck-failed')?.phase === 'failed')
    expect(coordinator.getStatus('deck-failed')).toMatchObject({ ready: false, failedItemCount: 1, readyItemCount: 1 })
    expect(coordinator.getPreparedFrameSet('deck-failed')).toBeNull()
    expect(cache.size).toBe(1)
    coordinator.dispose()
  })

  it('returns prepared-frame diagnostics to baseline after a compiled Deck is removed', async () => {
    const cache = new PixGridDeckPreparedFrameCache()
    const coordinator = new PixGridDeckCompileCoordinator({
      cache,
      sourceResolver,
      compile: async request => frame(request),
    })
    coordinator.synchronize([deck('deck-cleanup', [item(0), item(1)])], 16, 9)
    await waitUntil(() => coordinator.getStatus('deck-cleanup')?.ready === true)
    expect(coordinator.getDiagnostics()).toMatchObject({
      trackedDeckCount: 1,
      cacheEntryCount: 2,
    })

    coordinator.synchronize([], 16, 9)
    expect(coordinator.getDiagnostics()).toMatchObject({
      trackedDeckCount: 0,
      cacheEntryCount: 0,
      cacheBytes: 0,
    })
    coordinator.dispose()
  })

  it('keeps the prepared-frame cache bounded across twenty create-delete cycles', async () => {
    const cache = new PixGridDeckPreparedFrameCache()
    const coordinator = new PixGridDeckCompileCoordinator({
      cache,
      sourceResolver,
      compile: async request => frame(request),
    })

    for (let cycle = 0; cycle < 20; cycle += 1) {
      const deckId = `deck-cycle-${cycle}`
      coordinator.synchronize([deck(deckId, [item(0, `${deckId}-a`), item(1, `${deckId}-b`)])], 16, 9)
      await waitUntil(() => coordinator.getStatus(deckId)?.ready === true)
      expect(coordinator.getDiagnostics().cacheEntryCount).toBe(2)
      coordinator.synchronize([], 16, 9)
      expect(coordinator.getDiagnostics()).toMatchObject({ cacheEntryCount: 0, cacheBytes: 0 })
    }

    coordinator.dispose()
  })

  it('aborts orphaned jobs when a Deck is deleted', async () => {
    let aborted = false
    const resolvingSource = (_item: PixGridDeckItemDefinition, signal: AbortSignal) => new Promise<Blob>((_resolve, reject) => {
      signal.addEventListener('abort', () => {
        aborted = true
        reject({ code: 'cancelled', message: 'cancelled', retryable: true })
      }, { once: true })
    })
    const coordinator = new PixGridDeckCompileCoordinator({
      cache: new PixGridDeckPreparedFrameCache(),
      sourceResolver: resolvingSource,
      compile: async request => frame(request),
    })
    coordinator.synchronize([deck('deck-delete', [item(0), item(1)])], 16, 9)
    await waitUntil(() => coordinator.getDiagnostics().runningJobCount > 0)
    coordinator.synchronize([], 16, 9)
    await waitUntil(() => aborted && coordinator.getDiagnostics().runningJobCount === 0)
    expect(coordinator.getStatus('deck-delete')).toBeNull()
    coordinator.dispose()
  })
})

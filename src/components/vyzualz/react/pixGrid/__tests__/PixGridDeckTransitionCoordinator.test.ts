import { describe, expect, it, vi } from 'vitest'
import { compilePixGridDeckRasterFrame } from '../PixGridDeckCompilerCore'
import type {
  PixGridDeckTransitionPlan,
  PixGridPreparedFrame,
  PixGridPreparedFrameSet,
} from '../PixGridDeckCompilerContracts'
import {
  DEFAULT_PIX_GRID_DECK_CONFIGURATION,
  type PixGridDeckDefinition,
  type PixGridDeckItemDefinition,
} from '../PixGridDeckDomain'
import {
  PixGridDeckTransitionCoordinator,
  resolveReachablePixGridDeckTransitionPairs,
  type PixGridDeckTransitionCompileFunction,
} from '../PixGridDeckTransitionCoordinator'
import {
  compilePixGridDeckPreparedFrameTransition,
} from '../PixGridDeckTransitionPlanner'
import { PixGridDeckTransitionPlanCache } from '../PixGridDeckTransitionPlanCache'

function item(id: string, order: number): PixGridDeckItemDefinition {
  return {
    id,
    mediaId: `media-${id}`,
    enabled: true,
    order,
    revision: 1,
    timingOverrideBeats: null,
    source: {
      mediaRevision: 1,
      fingerprint: `sha256:${id}`,
      fileName: `${id}.png`,
      mimeType: 'image/png',
      width: 16,
      height: 9,
      hasAlpha: true,
      transparentBackground: '#000000',
    },
  }
}

function deck(revision = 1, playbackOrder: PixGridDeckDefinition['configuration']['playbackOrder'] = 'forward'): PixGridDeckDefinition {
  return {
    schemaVersion: 1,
    id: 'deck-transition',
    name: 'Transition Deck',
    revision,
    generatedPresetId: 'pix-grid-deck:deck-transition',
    items: [item('a', 0), item('b', 1), item('c', 2)],
    configuration: {
      ...DEFAULT_PIX_GRID_DECK_CONFIGURATION,
      playbackOrder,
      loop: true,
      transitionPolicy: { ...DEFAULT_PIX_GRID_DECK_CONFIGURATION.transitionPolicy },
    },
  }
}

function frame(id: string, offset = 0): PixGridPreparedFrame {
  const width = 16
  const height = 9
  const raster = new Uint8Array(width * height * 4)
  const alpha = new Uint8Array(width * height)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const cell = y * width + x
      const lit = (x + y + offset) % 5 === 0
      const pixel = cell * 4
      raster[pixel] = (x * 17 + offset) % 256
      raster[pixel + 1] = (y * 31 + offset) % 256
      raster[pixel + 2] = 220
      raster[pixel + 3] = lit ? 255 : 0
      alpha[cell] = raster[pixel + 3]!
    }
  }
  return compilePixGridDeckRasterFrame({
    cacheKey: `frame:${id}:${offset}`,
    mediaId: `media:${id}`,
    sourceFingerprint: `sha256:${id}:${offset}`,
    sourceRevision: offset + 1,
    rasterPixels: raster,
    sourceAlpha: alpha,
    width,
    height,
    transparentBackground: '#000000',
    hasAlpha: true,
  })
}

function frameSet(targetDeck: PixGridDeckDefinition, frames: readonly PixGridPreparedFrame[]): PixGridPreparedFrameSet {
  return {
    schemaVersion: 1,
    deckId: targetDeck.id,
    deckRevision: targetDeck.revision,
    width: frames[0]!.width,
    height: frames[0]!.height,
    frameCacheKeys: frames.map(candidate => candidate.cacheKey),
    frames,
  }
}

async function waitFor(predicate: () => boolean, timeoutMs = 2_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for PixGrid Deck transition coordinator.')
    await new Promise(resolve => setTimeout(resolve, 5))
  }
}

const directCompile: PixGridDeckTransitionCompileFunction = async request => compilePixGridDeckPreparedFrameTransition({
  cacheKey: request.cacheKey,
  source: request.source,
  target: request.target,
  settings: request.settings,
})

describe('PixGrid Deck Stage 5 transition coordinator', () => {
  it('enumerates only reachable directed pairs for deterministic orders', () => {
    expect(resolveReachablePixGridDeckTransitionPairs(deck(1, 'forward')).map(([a, b]) => `${a.id}>${b.id}`))
      .toEqual(['a>b', 'b>c', 'c>a'])
    expect(resolveReachablePixGridDeckTransitionPairs(deck(1, 'reverse')).map(([a, b]) => `${a.id}>${b.id}`))
      .toEqual(['c>b', 'b>a', 'a>c'])
    expect(resolveReachablePixGridDeckTransitionPairs(deck(1, 'pingPong')).map(([a, b]) => `${a.id}>${b.id}`))
      .toEqual(['a>b', 'b>c', 'b>a', 'c>b'])
    expect(resolveReachablePixGridDeckTransitionPairs(deck(1, 'shuffle'))).toHaveLength(6)
  })

  it('compiles real Stage 3 prepared frames and exposes cached pair plans', async () => {
    const targetDeck = deck()
    const cache = new PixGridDeckTransitionPlanCache()
    const coordinator = new PixGridDeckTransitionCoordinator({ cache, compile: directCompile, concurrency: 2 })
    coordinator.synchronize([targetDeck], new Map([[targetDeck.id, frameSet(targetDeck, [frame('a'), frame('b', 1), frame('c', 2)])]]))
    await waitFor(() => coordinator.getStatus(targetDeck.id)?.ready === true)
    const plan = coordinator.getPlan(targetDeck.id, 'a', 'b')
    expect(plan).toMatchObject({ sourceFrameCacheKey: 'frame:a:0', targetFrameCacheKey: 'frame:b:1' })
    expect(plan?.diagnostics.sourceForegroundCount).toBeGreaterThan(0)
    expect(coordinator.getDiagnostics()).toMatchObject({ expectedPairCount: 3, cacheEntryCount: 3, runningJobCount: 0 })
    coordinator.dispose()
  })

  it('invalidates only plans involving a changed frame', async () => {
    const targetDeck = deck()
    const cache = new PixGridDeckTransitionPlanCache()
    const compileSpy = vi.fn(directCompile)
    const coordinator = new PixGridDeckTransitionCoordinator({ cache, compile: compileSpy, concurrency: 3 })
    const originalFrames = [frame('a'), frame('b'), frame('c')]
    coordinator.synchronize([targetDeck], new Map([[targetDeck.id, frameSet(targetDeck, originalFrames)]]))
    await waitFor(() => coordinator.getStatus(targetDeck.id)?.ready === true)
    const stablePlanKey = coordinator.getPlan(targetDeck.id, 'c', 'a')?.cacheKey
    expect(compileSpy).toHaveBeenCalledTimes(3)

    const revisedDeck = { ...targetDeck, revision: 2 }
    coordinator.synchronize([revisedDeck], new Map())
    expect(coordinator.getStatus(revisedDeck.id)).toMatchObject({ ready: false, progress: 0 })
    expect(coordinator.getPlan(revisedDeck.id, 'c', 'a')).toBeNull()
    expect(cache.size).toBe(3)

    const revisedFrames = [originalFrames[0]!, frame('b', 9), originalFrames[2]!]
    coordinator.synchronize([revisedDeck], new Map([[revisedDeck.id, frameSet(revisedDeck, revisedFrames)]]))
    await waitFor(() => coordinator.getStatus(revisedDeck.id)?.ready === true)
    expect(compileSpy).toHaveBeenCalledTimes(5)
    expect(coordinator.getPlan(revisedDeck.id, 'c', 'a')?.cacheKey).toBe(stablePlanKey)
    expect(cache.size).toBe(3)
    coordinator.dispose()
  })

  it('recompiles only the directed pair whose override changed', async () => {
    const targetDeck = deck()
    const frames = [frame('a'), frame('b'), frame('c')]
    const cache = new PixGridDeckTransitionPlanCache()
    const compileSpy = vi.fn(directCompile)
    const coordinator = new PixGridDeckTransitionCoordinator({ cache, compile: compileSpy, concurrency: 3 })
    coordinator.synchronize([targetDeck], new Map([[targetDeck.id, frameSet(targetDeck, frames)]]))
    await waitFor(() => coordinator.getStatus(targetDeck.id)?.ready === true)
    const stableReverseKey = coordinator.getPlan(targetDeck.id, 'c', 'a')?.cacheKey

    const revisedDeck: PixGridDeckDefinition = {
      ...targetDeck,
      revision: 2,
      configuration: {
        ...targetDeck.configuration,
        transitionPolicy: {
          ...targetDeck.configuration.transitionPolicy,
          pairOverrides: [{ sourceItemId: 'a', targetItemId: 'b', mode: 'hardCut' }],
        },
      },
    }
    coordinator.synchronize([revisedDeck], new Map([[revisedDeck.id, frameSet(revisedDeck, frames)]]))
    await waitFor(() => coordinator.getStatus(revisedDeck.id)?.ready === true)
    expect(compileSpy).toHaveBeenCalledTimes(4)
    expect(coordinator.getPlan(revisedDeck.id, 'a', 'b')).toMatchObject({
      requestedMode: 'hardCut',
      mode: 'hardCut',
    })
    expect(coordinator.getPlan(revisedDeck.id, 'c', 'a')?.cacheKey).toBe(stableReverseKey)
    coordinator.dispose()
  })

  it('surfaces active cache eviction as a retryable failure instead of stalling', async () => {
    const targetDeck = deck()
    const cache = new PixGridDeckTransitionPlanCache(1, Number.MAX_SAFE_INTEGER)
    const coordinator = new PixGridDeckTransitionCoordinator({ cache, compile: directCompile, concurrency: 3 })
    coordinator.synchronize([targetDeck], new Map([[targetDeck.id, frameSet(targetDeck, [frame('a'), frame('b'), frame('c')])]]))
    await waitFor(() => (coordinator.getStatus(targetDeck.id)?.failedPairCount ?? 0) > 0)
    expect(coordinator.getStatus(targetDeck.id)).toMatchObject({ ready: false })
    expect(coordinator.getStatus(targetDeck.id)?.pairs.some(pair => (
      pair.phase === 'failed'
      && pair.error?.retryable === true
      && pair.error.message.includes('could not retain')
    ))).toBe(true)
    coordinator.dispose()
  })

  it('treats a current single-frame prepared Deck as ready with no transition jobs', () => {
    const targetDeck = {
      ...deck(),
      items: deck().items.map((entry, index) => ({ ...entry, enabled: index === 0 })),
    }
    const cache = new PixGridDeckTransitionPlanCache()
    const compileSpy = vi.fn(directCompile)
    const coordinator = new PixGridDeckTransitionCoordinator({ cache, compile: compileSpy })
    const onlyFrame = frame('a')
    coordinator.synchronize([targetDeck], new Map([[targetDeck.id, frameSet(targetDeck, [onlyFrame])]]))
    expect(coordinator.getStatus(targetDeck.id)).toMatchObject({
      ready: true,
      progress: 1,
      pairCount: 0,
      readyPairCount: 0,
    })
    expect(compileSpy).not.toHaveBeenCalled()
    coordinator.dispose()
  })

  it('cancels stale work and rejects late plans after rapid revision changes', async () => {
    const firstDeck = deck(1)
    const secondDeck = deck(2)
    const cache = new PixGridDeckTransitionPlanCache()
    const pending: Array<{
      request: Parameters<PixGridDeckTransitionCompileFunction>[0]
      resolve: (plan: PixGridDeckTransitionPlan) => void
    }> = []
    const deferredCompile: PixGridDeckTransitionCompileFunction = request => new Promise(resolve => {
      pending.push({ request, resolve })
    })
    const coordinator = new PixGridDeckTransitionCoordinator({ cache, compile: deferredCompile, concurrency: 1 })
    coordinator.synchronize([firstDeck], new Map([[firstDeck.id, frameSet(firstDeck, [frame('a'), frame('b'), frame('c')])]]))
    await waitFor(() => pending.length === 1)
    const stale = pending[0]!
    expect(stale.request.signal?.aborted).toBe(false)

    coordinator.synchronize([secondDeck], new Map([[secondDeck.id, frameSet(secondDeck, [frame('a', 7), frame('b'), frame('c')])]]))
    expect(stale.request.signal?.aborted).toBe(true)
    stale.resolve(compilePixGridDeckPreparedFrameTransition({
      cacheKey: stale.request.cacheKey,
      source: stale.request.source,
      target: stale.request.target,
      settings: stale.request.settings,
    }))
    let resolvedCount = 1
    const deadline = Date.now() + 2_000
    while (coordinator.getStatus(secondDeck.id)?.ready !== true && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 5))
      for (const current of pending.slice(resolvedCount)) {
        current.resolve(compilePixGridDeckPreparedFrameTransition({
          cacheKey: current.request.cacheKey,
          source: current.request.source,
          target: current.request.target,
          settings: current.request.settings,
        }))
      }
      resolvedCount = pending.length
    }
    await waitFor(() => coordinator.getStatus(secondDeck.id)?.ready === true)
    expect(cache.keys.some(key => key === stale.request.cacheKey)).toBe(false)
    expect(coordinator.getPlan(secondDeck.id, 'a', 'b')?.sourceFrameCacheKey).toBe('frame:a:7')
    coordinator.dispose()
  })
})

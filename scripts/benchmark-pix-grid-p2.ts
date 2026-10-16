import { performance } from 'node:perf_hooks'
import { compilePixGridDeckRasterFrame } from '../src/components/vyzualz/react/pixGrid/PixGridDeckCompilerCore'
import { composePixGridDeckRuntimeFrame, createPixGridDeckCompositorScratch } from '../src/components/vyzualz/react/pixGrid/PixGridDeckCompositor'
import { DEFAULT_PIX_GRID_DECK_CONFIGURATION, type PixGridDeckDefinition } from '../src/components/vyzualz/react/pixGrid/PixGridDeckDomain'
import { resolveReachablePixGridDeckTransitionPairs } from '../src/components/vyzualz/react/pixGrid/PixGridDeckTransitionCoordinator'
import { compilePixGridDeckPreparedFrameTransition, createPixGridDeckTransitionCacheKey } from '../src/components/vyzualz/react/pixGrid/PixGridDeckTransitionPlanner'

const width = 160
const height = 90

function prepared(id: string, offset: number) {
  const pixels = new Uint8Array(width * height * 4)
  const alpha = new Uint8Array(width * height)
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const lit = ((x + offset) % 11 < 4 && (y * 2 + offset) % 13 < 5)
    const cell = y * width + x
    pixels.set([offset ? 255 : 20, offset ? 70 : 220, offset ? 150 : 255, lit ? 255 : 0], cell * 4)
    alpha[cell] = lit ? 255 : 0
  }
  return compilePixGridDeckRasterFrame({ cacheKey: `bench:${id}`, mediaId: id, sourceFingerprint: id, sourceRevision: 1, rasterPixels: pixels, sourceAlpha: alpha, width, height, transparentBackground: '#000000', hasAlpha: true })
}

function stats(samples: readonly number[]) {
  const ordered = [...samples].sort((a, b) => a - b)
  return {
    meanMs: samples.reduce((sum, value) => sum + value, 0) / samples.length,
    p95Ms: ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * 0.95))]!,
    worstMs: ordered[ordered.length - 1]!,
  }
}

const source = prepared('source', 0)
const target = prepared('target', 5)
const settings = { requestedMode: 'pixelTransport' as const, sourceItemId: 'source', targetItemId: 'target', durationFraction: 0.5, preferredStrategy: 'directionalFlow' as const }
const compileSamples: number[] = []
let plan = compilePixGridDeckPreparedFrameTransition({ cacheKey: 'warmup', source, target, settings })
for (let index = 0; index < 12; index += 1) {
  const started = performance.now()
  plan = compilePixGridDeckPreparedFrameTransition({ cacheKey: createPixGridDeckTransitionCacheKey({ sourceFrameCacheKey: source.cacheKey, targetFrameCacheKey: target.cacheKey, settings }) + `:${index}`, source, target, settings })
  compileSamples.push(performance.now() - started)
}

const scratch = createPixGridDeckCompositorScratch()
const renderSamples: number[] = []
for (let index = 0; index < 240; index += 1) {
  const started = performance.now()
  composePixGridDeckRuntimeFrame({
    kind: 'deck', deckId: 'benchmark', deckRevision: 1, width, height,
    sourceItemId: 'source', targetItemId: 'target', sourceFrame: source, targetFrame: target,
    transitionPlan: plan, transitionMode: plan.mode, transitionProgress: (index % 120) / 119,
    transitionActive: true, boundaryIdentity: 'benchmark', frameEpoch: 1, identity: `benchmark:${index}`,
    fallbackReason: null,
  }, scratch)
  renderSamples.push(performance.now() - started)
}

const items = Array.from({ length: 64 }, (_, index) => ({
  id: `item-${index}`, mediaId: `media-${index % 16}`, enabled: true, order: index, revision: 1,
  timingOverrideBeats: null, source: { mediaRevision: 1, fingerprint: `fingerprint-${index % 16}`, fileName: `${index % 16}.png`, mimeType: 'image/png', width, height, hasAlpha: true, transparentBackground: '#000000' },
}))
const deck: PixGridDeckDefinition = { id: 'benchmark', name: 'Benchmark', revision: 1, createdAt: 1, updatedAt: 1, items, configuration: { ...DEFAULT_PIX_GRID_DECK_CONFIGURATION, playbackOrder: 'shuffle', loop: true } }

console.log(JSON.stringify({
  environment: { runtime: process.version, platform: process.platform, arch: process.arch, logicalResolution: `${width}x${height}` },
  renderFrame: stats(renderSamples),
  transitionCompile: stats(compileSamples),
  transitionPlanBytes: plan.approximateBytes,
  sequence: { occurrences: items.length, uniqueMedia: 16, initiallyReachablePairs: resolveReachablePixGridDeckTransitionPairs(deck).length, allDirectedPairsAvoided: items.length * (items.length - 1) },
  configuredBounds: { workerConcurrency: 2, preparedFrameCacheBytes: 64 * 1024 * 1024, transitionCacheBytes: 32 * 1024 * 1024 },
}, null, 2))

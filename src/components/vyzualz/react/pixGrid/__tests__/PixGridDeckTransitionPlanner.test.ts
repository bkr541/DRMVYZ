import { describe, expect, it } from 'vitest'
import {
  compilePixGridDeckRasterFrame,
} from '../PixGridDeckCompilerCore'
import type { PixGridPreparedFrame } from '../PixGridDeckCompilerContracts'
import {
  normalizePixGridDeckConfiguration,
  resolvePixGridDeckTransitionPairPolicy,
  type PixGridDeckTransitionMode,
} from '../PixGridDeckDomain'
import {
  PIX_GRID_DECK_TRANSITION_MAX_CANDIDATES_PER_SOURCE,
  compilePixGridDeckPreparedFrameTransition,
  createPixGridDeckTransitionCacheKey,
  quantizePixGridDeckTransitionDuration,
  reconstructPixGridDeckTransitionEndpoint,
  selectAutomaticPixGridDeckTransition,
} from '../PixGridDeckTransitionPlanner'
import { PixGridDeckTransitionPlanCache } from '../PixGridDeckTransitionPlanCache'

function preparedFrame(input: {
  id: string
  width: number
  height: number
  lit: (x: number, y: number) => boolean
  color?: (x: number, y: number) => readonly [number, number, number, number]
}): PixGridPreparedFrame {
  const raster = new Uint8Array(input.width * input.height * 4)
  const alpha = new Uint8Array(input.width * input.height)
  for (let y = 0; y < input.height; y += 1) {
    for (let x = 0; x < input.width; x += 1) {
      const cell = y * input.width + x
      const offset = cell * 4
      const lit = input.lit(x, y)
      const color = input.color?.(x, y) ?? [x * 17 % 256, y * 23 % 256, (x + y) * 13 % 256, lit ? 255 : 0]
      raster[offset] = color[0]
      raster[offset + 1] = color[1]
      raster[offset + 2] = color[2]
      raster[offset + 3] = lit ? color[3] : 0
      alpha[cell] = raster[offset + 3]!
    }
  }
  return compilePixGridDeckRasterFrame({
    cacheKey: `frame:${input.id}`,
    mediaId: `media:${input.id}`,
    sourceFingerprint: `sha256:${input.id}`,
    sourceRevision: 1,
    rasterPixels: raster,
    sourceAlpha: alpha,
    width: input.width,
    height: input.height,
    transparentBackground: '#000000',
    hasAlpha: true,
  })
}

function settings(mode: PixGridDeckTransitionMode = 'auto') {
  return {
    requestedMode: mode,
    sourceItemId: 'item-a',
    targetItemId: 'item-b',
    durationFraction: 0.25,
  }
}

function compile(source: PixGridPreparedFrame, target: PixGridPreparedFrame, mode: PixGridDeckTransitionMode = 'auto') {
  const transitionSettings = settings(mode)
  return compilePixGridDeckPreparedFrameTransition({
    cacheKey: createPixGridDeckTransitionCacheKey({
      sourceFrameCacheKey: source.cacheKey,
      targetFrameCacheKey: target.cacheKey,
      settings: transitionSettings,
    }),
    source,
    target,
    settings: transitionSettings,
  })
}

const sparseA = () => preparedFrame({
  id: 'sparse-a', width: 32, height: 18,
  lit: (x, y) => (x >= 4 && x <= 10 && (y === 4 || y === 13)) || (y >= 4 && y <= 13 && (x === 4 || x === 10)),
  color: () => [0, 217, 255, 255],
})
const sparseB = () => preparedFrame({
  id: 'sparse-b', width: 32, height: 18,
  lit: (x, y) => Math.abs(x - 22) + Math.abs(y - 9) <= 6,
  color: () => [0, 217, 130, 255],
})

describe('PixGrid Deck Stage 5 transition planner', () => {
  it('normalizes legacy policy, canonical automatic mode, and directed pair overrides', () => {
    const normalized = normalizePixGridDeckConfiguration({
      defaultItemDurationBeats: 8,
      transitionPolicy: {
        style: 'crossfade',
        durationBeats: 2,
        pairOverrides: [
          { sourceItemId: 'item-a', targetItemId: 'item-b', mode: 'pixelTransport', durationFraction: 0.5 },
          { sourceItemId: 'missing', targetItemId: 'item-b', mode: 'hardCut' },
        ],
      },
    }, new Set(['item-a', 'item-b']))
    expect(normalized.transitionPolicy).toMatchObject({
      mode: 'crossfade',
      durationFraction: 0.25,
      style: 'crossfade',
      durationBeats: 2,
    })
    expect(normalized.transitionPolicy.pairOverrides).toEqual([
      { sourceItemId: 'item-a', targetItemId: 'item-b', mode: 'pixelTransport', durationFraction: 0.5 },
    ])
    expect(resolvePixGridDeckTransitionPairPolicy(normalized.transitionPolicy, 'item-a', 'item-b'))
      .toEqual({ mode: 'pixelTransport', durationFraction: 0.5, overridden: true })
    expect(resolvePixGridDeckTransitionPairPolicy(normalized.transitionPolicy, 'item-b', 'item-a'))
      .toEqual({ mode: 'crossfade', durationFraction: 0.25, overridden: false })
  })

  it('selects transport for sparse graphics and avoids it for dense photographs', () => {
    const source = sparseA()
    const target = sparseB()
    const sparseSelection = selectAutomaticPixGridDeckTransition({
      source: { cacheKey: source.cacheKey, width: source.width, height: source.height, pixels: source.pixels, foreground: source.masks.foreground, metrics: source.metrics },
      target: { cacheKey: target.cacheKey, width: target.width, height: target.height, pixels: target.pixels, foreground: target.masks.foreground, metrics: target.metrics },
    })
    expect(sparseSelection.mode).toBe('pixelTransport')

    const denseA = preparedFrame({
      id: 'dense-a', width: 32, height: 18, lit: () => true,
      color: (x, y) => [(x * 71 + y * 17) % 256, (x * 13 + y * 97) % 256, (x * 43 + y * 31) % 256, 255],
    })
    const denseB = preparedFrame({
      id: 'dense-b', width: 32, height: 18, lit: () => true,
      color: (x, y) => [(x * 29 + y * 83) % 256, (x * 101 + y * 7) % 256, (x * 11 + y * 59) % 256, 255],
    })
    expect(compile(denseA, denseB).mode).not.toBe('pixelTransport')
  })

  it('produces a valid normalized plan for all automatic and explicit modes', () => {
    const source = sparseA()
    const target = sparseB()
    const modes: PixGridDeckTransitionMode[] = [
      'auto', 'pixelTransport', 'pixelDissolve', 'crossfade', 'rowWipe', 'columnWipe',
      'checkerWipe', 'radialReveal', 'hardCut',
    ]
    for (const mode of modes) {
      const plan = compile(source, target, mode)
      expect(plan.requestedMode).toBe(mode)
      expect(plan.width).toBe(32)
      expect(plan.height).toBe(18)
      expect(plan.mode).not.toBe('auto')
      expect(plan.matchedSourceIndices.length + plan.deathSourceIndices.length)
        .toBe(plan.diagnostics.sourceForegroundCount)
      expect(plan.matchedTargetIndices.length + plan.birthTargetIndices.length)
        .toBe(plan.diagnostics.targetForegroundCount)
    }
  })

  it('maps transport deterministically without collisions and represents births and deaths', () => {
    const source = sparseA()
    const target = preparedFrame({
      id: 'many-targets', width: 32, height: 18,
      lit: (x, y) => Math.abs(x - 22) <= 6 && Math.abs(y - 9) <= 4,
      color: () => [255, 62, 209, 255],
    })
    const first = compile(source, target, 'pixelTransport')
    const second = compile(source, target, 'pixelTransport')
    expect([...first.matchedSourceIndices]).toEqual([...second.matchedSourceIndices])
    expect([...first.matchedTargetIndices]).toEqual([...second.matchedTargetIndices])
    expect([...first.deathSourceIndices]).toEqual([...second.deathSourceIndices])
    expect([...first.birthTargetIndices]).toEqual([...second.birthTargetIndices])
    expect(new Set(first.matchedTargetIndices).size).toBe(first.matchedTargetIndices.length)
    expect(first.diagnostics.birthCount).toBeGreaterThan(0)
    expect(first.diagnostics.candidateComparisons)
      .toBeLessThanOrEqual(first.diagnostics.sourceForegroundCount * PIX_GRID_DECK_TRANSITION_MAX_CANDIDATES_PER_SOURCE)
  })

  it('preserves source and target buffers and reconstructs exact endpoints', () => {
    const source = sparseA()
    const target = sparseB()
    const sourceBefore = source.pixels.slice()
    const targetBefore = target.pixels.slice()
    const sourceMaskBefore = source.masks.foreground.slice()
    const targetMaskBefore = target.masks.foreground.slice()
    const plan = compile(source, target)
    expect(source.pixels).toEqual(sourceBefore)
    expect(target.pixels).toEqual(targetBefore)
    expect(source.masks.foreground).toEqual(sourceMaskBefore)
    expect(target.masks.foreground).toEqual(targetMaskBefore)
    expect(reconstructPixGridDeckTransitionEndpoint(plan, source.pixels, target.pixels, 0)).toEqual(source.pixels)
    expect(reconstructPixGridDeckTransitionEndpoint(plan, source.pixels, target.pixels, 1)).toEqual(target.pixels)
  })

  it('handles reverse, empty, all-foreground, and incompatible inputs deterministically', () => {
    const source = sparseA()
    const target = sparseB()
    const forward = compile(source, target)
    const reverse = compile(target, source)
    expect(forward.sourceFrameCacheKey).toBe(source.cacheKey)
    expect(reverse.sourceFrameCacheKey).toBe(target.cacheKey)

    const empty = preparedFrame({ id: 'empty', width: 32, height: 18, lit: () => false })
    expect(compile(empty, empty).mode).toBe('hardCut')
    expect(compile(empty, source).mode).toBe('crossfade')

    const full = preparedFrame({ id: 'full', width: 32, height: 18, lit: () => true })
    const forcedMorph = compile(full, source, 'pixelTransport')
    expect(forcedMorph.mode).not.toBe('pixelTransport')
    expect(forcedMorph.fallbackReason).toBeTruthy()
  })

  it('invalidates only cached plans involving a changed frame', () => {
    const a = sparseA()
    const b = sparseB()
    const c = preparedFrame({
      id: 'sparse-c', width: 32, height: 18,
      lit: (x, y) => x >= 12 && x <= 18 && y >= 5 && y <= 12,
      color: () => [255, 62, 209, 255],
    })
    const cache = new PixGridDeckTransitionPlanCache()
    const aToB = compile(a, b)
    const bToC = compile(b, c)
    const cToA = compile(c, a)
    cache.set(aToB)
    cache.set(bToC)
    cache.set(cToA)
    cache.invalidateFrame(b.cacheKey)
    expect(cache.keys).toEqual([cToA.cacheKey])
    expect(cache.peek(cToA.cacheKey)).toBe(cToA)
  })

  it('uses directional cache identity and quantizes percentage duration to the beat grid', () => {
    const source = sparseA()
    const target = sparseB()
    const forwardSettings = settings('auto')
    const reverseSettings = { ...forwardSettings, sourceItemId: 'item-b', targetItemId: 'item-a' }
    const forward = createPixGridDeckTransitionCacheKey({
      sourceFrameCacheKey: source.cacheKey,
      targetFrameCacheKey: target.cacheKey,
      settings: forwardSettings,
    })
    const reverse = createPixGridDeckTransitionCacheKey({
      sourceFrameCacheKey: target.cacheKey,
      targetFrameCacheKey: source.cacheKey,
      settings: reverseSettings,
    })
    expect(reverse).not.toBe(forward)
    expect(quantizePixGridDeckTransitionDuration({
      itemDurationBeats: 7,
      durationFraction: 0.25,
      beatGridBeats: 0.25,
      mode: 'crossfade',
    })).toBe(1.75)
    expect(quantizePixGridDeckTransitionDuration({
      itemDurationBeats: 7,
      durationFraction: 1,
      beatGridBeats: 0.25,
      mode: 'crossfade',
    })).toBe(5.25)
    expect(quantizePixGridDeckTransitionDuration({
      itemDurationBeats: 4,
      durationFraction: Number.NaN,
      mode: 'crossfade',
    })).toBe(1)
    expect(quantizePixGridDeckTransitionDuration({
      itemDurationBeats: 4,
      durationFraction: 0,
      mode: 'crossfade',
    })).toBe(0)
    expect(quantizePixGridDeckTransitionDuration({
      itemDurationBeats: 0.25,
      durationFraction: 0.75,
      mode: 'crossfade',
    })).toBe(0)
    expect(quantizePixGridDeckTransitionDuration({
      itemDurationBeats: 7,
      durationFraction: Number.NaN,
      mode: 'hardCut',
    })).toBe(0)
  })

  it.each([[160, 90], [256, 144]])('keeps maximum-matrix planning bounded at %sx%s', (width: number, height: number) => {
    const source = preparedFrame({
      id: `bounded-source-${width}`, width, height,
      lit: (x, y) => x % 8 === 0 && y % 8 === 0,
      color: () => [0, 217, 255, 255],
    })
    const target = preparedFrame({
      id: `bounded-target-${width}`, width, height,
      lit: (x, y) => (x + 3) % 8 === 0 && (y + 2) % 8 === 0,
      color: () => [0, 217, 130, 255],
    })
    const started = performance.now()
    const plan = compile(source, target, 'pixelTransport')
    const elapsedMs = performance.now() - started
    expect(plan.mode).toBe('pixelTransport')
    expect(plan.diagnostics.candidateComparisons)
      .toBeLessThanOrEqual(plan.diagnostics.sourceForegroundCount * PIX_GRID_DECK_TRANSITION_MAX_CANDIDATES_PER_SOURCE)
    expect(elapsedMs).toBeLessThan(width === 160 ? 2_000 : 5_000)
  })
})

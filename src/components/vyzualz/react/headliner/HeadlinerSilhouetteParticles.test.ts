// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveHeadlinerParameters } from './HeadlinerEffectCatalog'
import { createHeadlinerEffectProcessor, type HeadlinerEffectRenderArgs } from './HeadlinerEffects'
import { HEADLINER_IDLE_TIMING, type HeadlinerEffectTiming } from './HeadlinerTiming'
import {
  HeadlinerSegmenter,
  HeadlinerSilhouetteSource,
  confidenceToAlpha,
  pickPersonMask,
  writeSegmentMask,
  type HeadlinerSegmentSample,
  type HeadlinerSegmentSource,
} from './HeadlinerSegmentation'
import { hslToRgb, resolveGlowColor, ringOffsets } from './HeadlinerSilhouetteShapes'
import {
  createAuraProcessor,
  createEnergyOutlineProcessor,
  createOutlineEchoProcessor,
  glowNoise,
  resolveAuraRadius,
  resolveFlickerGain,
  resolveOutlineThickness,
} from './HeadlinerSilhouetteEffects'
import {
  createParticleBodyProcessor,
  createParticleShedProcessor,
  resolveParticleBodyCycle,
  resolveParticleColor,
  resolveShedEmission,
} from './HeadlinerParticleEffects'

let drawn = 0
let allDraws = 0
let pixels = new Uint8ClampedArray(0)
const contexts = new WeakMap<HTMLCanvasElement, CanvasRenderingContext2D>()

beforeEach(() => {
  drawn = 0
  allDraws = 0
  pixels = new Uint8ClampedArray(512 * 512 * 4).fill(255)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function getContext(this: HTMLCanvasElement) {
    const existing = contexts.get(this)
    if (existing) return existing as never
    const context = {
      canvas: this,
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      filter: 'none',
      fillStyle: '',
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      putImageData: vi.fn(),
      createImageData: (width: number, height: number) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }),
      getImageData: (_x: number, _y: number, width: number, height: number) => ({ width, height, data: pixels.slice(0, width * height * 4) }),
      createLinearGradient: () => ({ addColorStop: vi.fn() }),
      drawImage: vi.fn(function drawImage(this: CanvasRenderingContext2D) {
        allDraws += 1
        if (this.canvas.width === 1280) drawn += 1
      }),
    } as unknown as CanvasRenderingContext2D
    contexts.set(this, context)
    return context as never
  })
})

afterEach(() => vi.restoreAllMocks())

function fakeSegmenter(withMask = true) {
  const mask = document.createElement('canvas')
  mask.width = 64
  mask.height = 36
  return {
    acquire: vi.fn(),
    release: vi.fn(),
    sample: vi.fn((): HeadlinerSegmentSample => ({ status: 'ready', mask: withMask ? mask : null, sequence: 1 })),
  } satisfies HeadlinerSegmentSource
}

function makeOutput() {
  const canvas = document.createElement('canvas')
  canvas.width = 1280
  canvas.height = 720
  return { canvas, context: canvas.getContext('2d') as CanvasRenderingContext2D }
}

function renderArgs(
  output: ReturnType<typeof makeOutput>,
  presetId: Parameters<typeof resolveHeadlinerParameters>[0],
  overrides: Record<string, number | boolean | string> = {},
  timing: Partial<HeadlinerEffectTiming> = {},
): HeadlinerEffectRenderArgs {
  return {
    context: output.context,
    canvas: output.canvas,
    video: document.createElement('video'),
    sourceRect: { sx: 0, sy: 0, sw: 1280, sh: 720 },
    parameters: resolveHeadlinerParameters(presetId, overrides),
    timing: { ...HEADLINER_IDLE_TIMING, ...timing },
  }
}

describe('segmentation helpers', () => {
  it('sharpens confidence into alpha with a smooth edge', () => {
    expect(confidenceToAlpha(0)).toBe(0)
    expect(confidenceToAlpha(1)).toBe(255)
    expect(confidenceToAlpha(0.5)).toBe(128)
    expect(confidenceToAlpha(0.4)).toBeLessThan(confidenceToAlpha(0.6))
  })

  it('writes white pixels and blends with the previous mask when smoothing', () => {
    const rgba = new Uint8ClampedArray(8)
    writeSegmentMask([1, 0], rgba, 0)
    expect(Array.from(rgba)).toEqual([255, 255, 255, 255, 255, 255, 255, 0])
    writeSegmentMask([0, 0], rgba, 0.5)
    expect(rgba[3]).toBe(128)
  })

  it('takes the only mask of a one-class model, or the last mask of a background-first model', () => {
    expect(pickPersonMask(['person'])).toBe('person')
    expect(pickPersonMask(['background', 'person'])).toBe('person')
    expect(pickPersonMask(undefined)).toBeNull()
  })
})

describe('HeadlinerSegmenter', () => {
  const rect = { sx: 0, sy: 0, sw: 1280, sh: 720 }
  const video = () => {
    const element = document.createElement('video')
    Object.defineProperty(element, 'videoWidth', { value: 1280 })
    Object.defineProperty(element, 'videoHeight', { value: 720 })
    Object.defineProperty(element, 'readyState', { value: 4 })
    return element
  }

  it('loads on first use, produces a mask, and closes when the last user lets go', async () => {
    const close = vi.fn()
    const confidence = new Float32Array(16 * 9).fill(1)
    const segmenter = new HeadlinerSegmenter(async () => ({
      segmentForVideo: () => ({ confidenceMasks: [{ width: 16, height: 9, getAsFloat32Array: () => confidence }] }),
      close,
    }))
    segmenter.acquire()
    const element = video()
    expect(segmenter.sample(element, rect, 0).status).toBe('loading')
    await vi.waitFor(() => expect(segmenter.sample(element, rect, 1).status).toBe('ready'))
    const sample = segmenter.sample(element, rect, 2)
    expect(sample.mask).not.toBeNull()
    expect(sample.sequence).toBeGreaterThan(0)
    segmenter.release()
    expect(close).toHaveBeenCalledTimes(1)
    expect(segmenter.sample(element, rect, 3).mask).toBeNull()
  })

  it('reports unavailable when the model cannot load', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const segmenter = new HeadlinerSegmenter(async () => { throw new Error('no model') })
    segmenter.acquire()
    segmenter.sample(video(), rect, 0)
    await vi.waitFor(() => expect(segmenter.sample(video(), rect, 1).status).toBe('unavailable'))
  })
})

describe('HeadlinerSilhouetteSource', () => {
  it('uses the model mask, shows nothing while it loads, and falls back to the learned background when unavailable', () => {
    const element = document.createElement('video')
    const rect = { sx: 0, sy: 0, sw: 1280, sh: 720 }
    const ready = fakeSegmenter()
    const source = new HeadlinerSilhouetteSource(() => ready)
    expect(source.update(element, rect, 0).source).toBe('person')
    source.release()
    expect(ready.release).toHaveBeenCalledTimes(1)

    const loading: HeadlinerSegmentSource = { acquire: vi.fn(), release: vi.fn(), sample: () => ({ status: 'loading', mask: null, sequence: 0 }) }
    expect(new HeadlinerSilhouetteSource(() => loading).update(element, rect, 0)).toEqual({ mask: null, source: 'none' })

    const unavailable: HeadlinerSegmentSource = { acquire: vi.fn(), release: vi.fn(), sample: () => ({ status: 'unavailable', mask: null, sequence: 0 }) }
    const fallback = new HeadlinerSilhouetteSource(() => unavailable)
    expect(fallback.update(element, rect, 0).source).toBe('background')
    fallback.dispose()
  })
})

describe('shape and effect helpers', () => {
  it('builds rings of shifted copies, adding an inner ring for large radii', () => {
    expect(ringOffsets(0)).toEqual([])
    expect(ringOffsets(2)).toHaveLength(12)
    expect(ringOffsets(10)).toHaveLength(32)
    for (const [x, y] of ringOffsets(2)) expect(Math.hypot(x, y)).toBeCloseTo(2)
  })

  it('converts hue to colour and picks a glow colour by mode', () => {
    expect(hslToRgb(0, 1, 0.5).map(Math.round)).toEqual([255, 0, 0])
    const palette = { mode: 'gradient' as const, primary: [0, 0, 0] as [number, number, number], secondary: [200, 100, 50] as [number, number, number] }
    expect(resolveGlowColor(palette, 0.5, 0)).toEqual([100, 50, 25])
    expect(resolveGlowColor({ ...palette, mode: 'tint' }, 1, 0)).toEqual([0, 0, 0])
  })

  it('swells the aura and the outline on the beat, flickers within bounds, and keeps noise in 0..1', () => {
    expect(resolveAuraRadius(0.5, 1, 0)).toBeGreaterThan(resolveAuraRadius(0.5, 0, 0))
    expect(resolveAuraRadius(1, 0, 0)).toBeGreaterThan(resolveAuraRadius(0, 0, 0))
    expect(resolveOutlineThickness(0.5, 1)).toBeGreaterThan(resolveOutlineThickness(0.5, 0))
    expect(resolveFlickerGain(0, 3.3)).toBe(1)
    for (let t = 0; t < 5; t += 0.37) {
      expect(resolveFlickerGain(1, t)).toBeGreaterThanOrEqual(0.25)
      expect(glowNoise(t)).toBeGreaterThanOrEqual(0)
      expect(glowNoise(t)).toBeLessThan(1)
    }
  })

  it('cycles the particle body from video to full particles and back, and sheds more from faster movement', () => {
    expect(resolveParticleBodyCycle('off', 3)).toBe(1)
    expect(resolveParticleBodyCycle('bar', 0)).toBe(0)
    expect(resolveParticleBodyCycle('bar', 0.5)).toBeCloseTo(0.5)
    expect(resolveParticleBodyCycle('bar', 2)).toBe(1)
    expect(resolveParticleBodyCycle('bar', 3.5)).toBeCloseTo(0.5)
    expect(resolveParticleBodyCycle('two', 8)).toBe(0)
    expect(resolveShedEmission(2, 1, 1, 1, 0)).toBe(2)
    expect(resolveShedEmission(0.4, 1, 1, 1, 0)).toBe(0)
    expect(resolveShedEmission(0.4, 1, 1, 1, 0.7)).toBe(1)
  })

  it('keeps camera colours in Original and blends toward the palette otherwise', () => {
    const base = { primary: [255, 0, 0] as [number, number, number], secondary: [0, 0, 255] as [number, number, number], amount: 1 }
    expect(resolveParticleColor({ ...base, mode: 'original' }, [10, 20, 30], 0)).toEqual([10, 20, 30])
    expect(resolveParticleColor({ ...base, mode: 'tint' }, [10, 20, 30], 0)).toEqual([255, 0, 0])
    expect(resolveParticleColor({ ...base, mode: 'gradient' }, [10, 20, 30], 1)).toEqual([0, 0, 255])
  })
})

describe('silhouette and particle processors', () => {
  const silhouetteFactories = {
    aura: createAuraProcessor,
    'energy-outline': createEnergyOutlineProcessor,
    'outline-echo': createOutlineEchoProcessor,
    'particle-body': createParticleBodyProcessor,
  } as const

  it.each(Object.keys(silhouetteFactories) as (keyof typeof silhouetteFactories)[])('%s is the clean camera at Master Intensity 0 and holds no segmenter then', presetId => {
    const source = fakeSegmenter()
    const processor = silhouetteFactories[presetId]({ segmenter: () => source })
    const output = makeOutput()
    processor.render(renderArgs(output, presetId, { masterIntensity: 0 }))
    expect(drawn).toBe(1)
    expect(source.acquire).not.toHaveBeenCalled()
    processor.dispose()
  })

  it.each(Object.keys(silhouetteFactories) as (keyof typeof silhouetteFactories)[])('%s shows the plain camera until a silhouette exists, then layers its effect and lets go when turned off', presetId => {
    const none = fakeSegmenter(false)
    const quiet = silhouetteFactories[presetId]({ segmenter: () => none })
    const output = makeOutput()
    quiet.render(renderArgs(output, presetId))
    expect(drawn).toBe(1)
    quiet.dispose()

    const source = fakeSegmenter()
    const processor = silhouetteFactories[presetId]({ segmenter: () => source })
    drawn = 0
    processor.render(renderArgs(output, presetId, {}, { beat: 1, timeSec: 0.5, dtSec: 1 / 30 }))
    expect(drawn).toBeGreaterThan(1)
    expect(source.acquire).toHaveBeenCalledTimes(1)
    processor.render(renderArgs(output, presetId, { masterIntensity: 0 }, { beat: 2, timeSec: 1 }))
    expect(source.release).toHaveBeenCalledTimes(1)
    processor.dispose()
  })

  it('Outline Echo stores one outline per beat division and draws the live one on top only when asked', () => {
    const source = fakeSegmenter()
    const processor = createOutlineEchoProcessor({ segmenter: () => source })
    const output = makeOutput()
    const overrides = { echoCount: 3, echoSpacingBeats: '0.25', glow: 0, cameraDim: 0 }
    const render = (frame: number, extra = {}) => {
      allDraws = 0
      processor.render(renderArgs(output, 'outline-echo', { ...overrides, ...extra }, { beat: frame * 0.25, timeSec: frame * 0.1 }))
      return allDraws
    }
    for (let frame = 0; frame < 4; frame += 1) render(frame)
    const withLive = render(4)
    const withoutLive = render(5, { showLive: false })
    expect(withLive).toBeGreaterThan(withoutLive)
    processor.dispose()
  })

  it('Particle Body fades the real body only while particles replace it', () => {
    const source = fakeSegmenter()
    const processor = createParticleBodyProcessor({ segmenter: () => source })
    const output = makeOutput()
    drawn = 0
    processor.render(renderArgs(output, 'particle-body', { cycle: 'off', particleAmount: 1, glow: 0 }, { beat: 1, timeSec: 1, dtSec: 1 / 30 }))
    const full = drawn
    drawn = 0
    processor.render(renderArgs(output, 'particle-body', { cycle: 'off', particleAmount: 0, glow: 0 }, { beat: 2, timeSec: 2, dtSec: 1 / 30 }))
    expect(full).toBeGreaterThan(drawn)
    processor.dispose()
  })

  it('Particle Shed keeps the live picture and is the clean camera at Master Intensity 0', () => {
    const processor = createParticleShedProcessor()
    const output = makeOutput()
    processor.render(renderArgs(output, 'particle-shed', { masterIntensity: 0 }))
    expect(drawn).toBe(1)
    drawn = 0
    processor.render(renderArgs(output, 'particle-shed', {}, { timeSec: 1, dtSec: 1 / 30 }))
    expect(drawn).toBeGreaterThanOrEqual(2)
    processor.dispose()
  })

  it('creates the new processors from the factory', () => {
    for (const id of ['aura', 'energy-outline', 'outline-echo', 'particle-body', 'particle-shed'] as const) {
      const processor = createHeadlinerEffectProcessor(id)
      expect(processor.presetId).toBe(id)
      processor.dispose()
    }
  })
})

// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveHeadlinerParameters } from './HeadlinerEffectCatalog'
import { createHeadlinerEffectProcessor, type HeadlinerEffectRenderArgs } from './HeadlinerEffects'
import { HEADLINER_IDLE_TIMING, type HeadlinerEffectTiming } from './HeadlinerTiming'
import {
  HEADLINER_POSE_BONES,
  HEADLINER_POSE_POINT_COUNT,
  HeadlinerPoseFilter,
  HeadlinerPoseTracker,
  mapHeadlinerPoseToCanvas,
  readHeadlinerPosePoints,
  type HeadlinerPosePoint,
  type HeadlinerPoseSample,
  type HeadlinerPoseSource,
} from './HeadlinerPoseTracking'
import { createSparkSkeletonProcessor, jaggedBonePoints, resolvePoseFollowSmoothing } from './HeadlinerSkeletonEffect'
import { applyEnvironment, createDigitalSilhouetteProcessor, createPortalBodyProcessor } from './HeadlinerSilhouetteFillEffects'
import type { HeadlinerSegmentSample, HeadlinerSegmentSource } from './HeadlinerSegmentation'
import {
  applyXRay,
  buildPosterizeTable,
  buildRampTable,
  resolveToneWorkSize,
  resolveXRayTrigger,
  sampleRamp,
  sobelEdges,
  stepPosterizeLevels,
} from './HeadlinerToneEffects'

let drawn = 0
let pixels = new Uint8ClampedArray(0)
const contexts = new WeakMap<HTMLCanvasElement, CanvasRenderingContext2D>()

beforeEach(() => {
  drawn = 0
  pixels = new Uint8ClampedArray(1280 * 720 * 4)
  for (let index = 0; index < pixels.length; index += 4) {
    const value = (index / 4) % 256
    pixels[index] = value
    pixels[index + 1] = 255 - value
    pixels[index + 2] = 128
    pixels[index + 3] = 255
  }
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function getContext(this: HTMLCanvasElement) {
    const existing = contexts.get(this)
    if (existing) return existing as never
    const noop = () => undefined
    const context = {
      canvas: this,
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      filter: 'none',
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      lineCap: 'butt',
      lineJoin: 'miter',
      imageSmoothingEnabled: true,
      save: noop, restore: noop, translate: noop, rotate: noop, scale: noop, clearRect: noop, fillRect: noop,
      beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, stroke: noop, fill: noop, arc: noop,
      putImageData: noop,
      createImageData: (width: number, height: number) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }),
      getImageData: (_x: number, _y: number, width: number, height: number) => ({ width, height, data: pixels.slice(0, width * height * 4) }),
      createLinearGradient: () => ({ addColorStop: noop }),
      createRadialGradient: () => ({ addColorStop: noop }),
      drawImage: vi.fn(function drawImage(this: CanvasRenderingContext2D) {
        if (this.canvas.width === 1280) drawn += 1
      }),
    } as unknown as CanvasRenderingContext2D
    contexts.set(this, context)
    return context as never
  })
})

afterEach(() => vi.restoreAllMocks())

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
  const video = document.createElement('video')
  Object.defineProperty(video, 'videoWidth', { value: 1280 })
  Object.defineProperty(video, 'videoHeight', { value: 720 })
  return {
    context: output.context,
    canvas: output.canvas,
    video,
    sourceRect: { sx: 0, sy: 0, sw: 1280, sh: 720 },
    parameters: resolveHeadlinerParameters(presetId, overrides),
    timing: { ...HEADLINER_IDLE_TIMING, ...timing },
  }
}

const POINTS: HeadlinerPosePoint[] = Array.from({ length: HEADLINER_POSE_POINT_COUNT }, (_, index) => ({
  x: 0.3 + (index % 6) * 0.08,
  y: 0.2 + Math.floor(index / 6) * 0.1,
  visibility: 0.95,
}))

function fakePose(points: readonly HeadlinerPosePoint[] | null = POINTS) {
  let sequence = 1
  let current = points
  return {
    acquire: vi.fn(),
    release: vi.fn(),
    sample: vi.fn((): HeadlinerPoseSample => ({ status: 'ready', points: current, sequence })),
    set(next: readonly HeadlinerPosePoint[] | null) {
      current = next
      sequence += 1
    },
  } satisfies HeadlinerPoseSource & { set(next: readonly HeadlinerPosePoint[] | null): void }
}

function fakeSegmenter() {
  const mask = document.createElement('canvas')
  mask.width = 64
  mask.height = 36
  return {
    acquire: vi.fn(),
    release: vi.fn(),
    sample: vi.fn((): HeadlinerSegmentSample => ({ status: 'ready', mask, sequence: 1 })),
  } satisfies HeadlinerSegmentSource
}

describe('pose tracking', () => {
  it('reads 33 landmarks into points, clamps visibility and zeroes non-finite ones', () => {
    expect(readHeadlinerPosePoints([])).toBeNull()
    const landmarks = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 2 }))
    landmarks[3] = { x: Number.NaN, y: 0.5, visibility: 1 }
    const points = readHeadlinerPosePoints(landmarks)!
    expect(points).toHaveLength(33)
    expect(points[0].visibility).toBe(1)
    expect(points[3].visibility).toBe(0)
    expect(HEADLINER_POSE_BONES.every(([a, b]) => a < 33 && b < 33)).toBe(true)
  })

  it('maps a point through the crop into canvas pixels', () => {
    expect(mapHeadlinerPoseToCanvas({ x: 0.5, y: 0.5 }, 1280, 720, { sx: 320, sy: 0, sw: 640, sh: 720 }, 1280, 720)).toEqual({ x: 640, y: 360 })
  })

  it('glides toward new points, holds a lost body briefly, then fades it out', () => {
    const filter = new HeadlinerPoseFilter()
    const sample = (points: readonly HeadlinerPosePoint[] | null, sequence: number): HeadlinerPoseSample => ({ status: 'ready', points, sequence })
    expect(filter.update(sample(POINTS, 1), 0, 0.1).presence).toBe(1)
    const moved = POINTS.map(point => ({ ...point, x: point.x + 0.2 }))
    const follow = filter.update(sample(moved, 2), 0.05, 0.1)
    expect(follow.points![0].x).toBeGreaterThan(POINTS[0].x)
    expect(follow.points![0].x).toBeLessThan(moved[0].x)
    expect(filter.update(sample(null, 3), 0.1, 0.1).presence).toBe(1)
    expect(filter.update(sample(null, 3), 0.25, 0.1).presence).toBe(1)
    expect(filter.update(sample(null, 3), 0.55, 0.1).presence).toBeLessThan(1)
    expect(filter.update(sample(null, 3), 1.2, 0.1).presence).toBe(0)
  })

  it('loads on first use, detects, and closes with the last user', async () => {
    const close = vi.fn()
    const tracker = new HeadlinerPoseTracker(async () => ({
      detectForVideo: () => ({ landmarks: [Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 1 }))] }),
      close,
    }))
    const video = document.createElement('video')
    Object.defineProperty(video, 'videoWidth', { value: 640 })
    Object.defineProperty(video, 'videoHeight', { value: 480 })
    Object.defineProperty(video, 'readyState', { value: 4 })
    tracker.acquire()
    expect(tracker.sample(video, 0).status).toBe('loading')
    await vi.waitFor(() => expect(tracker.sample(video, 1).status).toBe('ready'))
    expect(tracker.sample(video, 2).points).toHaveLength(33)
    tracker.release()
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('maps the smoothing setting onto a time constant and draws jagged bones with pinned ends', () => {
    expect(resolvePoseFollowSmoothing(0)).toBeCloseTo(0.02)
    expect(resolvePoseFollowSmoothing(1)).toBeCloseTo(0.25)
    const jagged = jaggedBonePoints(0, 0, 200, 0, 8, 3, 1)
    expect(jagged[0]).toEqual([0, 0])
    expect(jagged[jagged.length - 1]).toEqual([200, 0])
    expect(jagged.length).toBeGreaterThan(2)
    expect(jagged.some(([, y]) => y !== 0)).toBe(true)
    expect(jaggedBonePoints(0, 0, 200, 0, 0, 3, 1)).toEqual([[0, 0], [200, 0]])
  })
})

describe('tone helpers', () => {
  it('samples colour ramps and builds tables', () => {
    expect(sampleRamp([[0, 0, 0], [100, 200, 50]], 0.5)).toEqual([50, 100, 25])
    const table = buildRampTable([[0, 0, 0], [255, 255, 255]])
    expect(table[0]).toBe(0)
    expect(table[255 * 3]).toBe(255)
  })

  it('sizes the pixel work to at most 640 px wide', () => {
    expect(resolveToneWorkSize(1920, 1080)).toEqual({ width: 640, height: 360 })
    expect(resolveToneWorkSize(320, 200)).toEqual({ width: 320, height: 200 })
  })

  it('finds the edge of a step and nothing in a flat area', () => {
    const width = 8
    const height = 8
    const luma = new Uint8ClampedArray(width * height)
    for (let y = 0; y < height; y += 1) for (let x = 4; x < width; x += 1) luma[y * width + x] = 255
    const out = new Uint8ClampedArray(width * height)
    sobelEdges(luma, width, height, 1, out)
    expect(out[3 * width + 3]).toBeGreaterThan(100)
    expect(out[3 * width + 1]).toBe(0)
    expect(out[3 * width + 6]).toBe(0)
  })

  it('negates, inverts and thermal-maps pixels', () => {
    const options = { contrast: 0, edgeGain: 0.5, scanPosition: 0, bands: 5, table: buildRampTable([[0, 0, 0], [255, 255, 255]]) }
    const luma = new Uint8ClampedArray(1)
    const edges = new Uint8ClampedArray(1)
    const negative = new Uint8ClampedArray([10, 200, 30, 255])
    applyXRay(negative, 1, 1, { ...options, mode: 'negative' }, luma, edges)
    expect(Array.from(negative)).toEqual([245, 55, 225, 255])
    const dark = new Uint8ClampedArray([0, 0, 0, 255])
    applyXRay(dark, 1, 1, { ...options, mode: 'invert' }, luma, edges)
    expect(dark[0]).toBe(255)
    const bright = new Uint8ClampedArray([255, 255, 255, 255])
    applyXRay(bright, 1, 1, { ...options, mode: 'thermal' }, luma, edges)
    expect(bright[0]).toBe(255)
  })

  it('shows the X-Ray on beats and builds, never otherwise', () => {
    expect(resolveXRayTrigger('always', { beat: 0.7, build: 0 })).toBe(1)
    expect(resolveXRayTrigger('beat', { beat: 2, build: 0 })).toBe(1)
    expect(resolveXRayTrigger('beat', { beat: 2.8, build: 0 })).toBeLessThan(0.2)
    expect(resolveXRayTrigger('build', { beat: 0, build: 0.6 })).toBe(0.6)
    expect(resolveXRayTrigger('hit', { beat: 0, build: 1 })).toBe(0)
  })

  it('quantises into the requested number of bands, blending between whole counts', () => {
    expect(new Set(buildPosterizeTable(2)).size).toBe(2)
    expect(new Set(buildPosterizeTable(4)).size).toBe(4)
    expect(new Set(buildPosterizeTable(3.5)).size).toBeGreaterThan(3)
  })

  it('snaps levels down on an event, never up, and recovers toward normal (or a lower level during a build)', () => {
    expect(stepPosterizeLevels(16, 16, 4, 0, 0, 0.5, 2)).toBeCloseTo(4)
    expect(stepPosterizeLevels(4, 16, 8, 0, 0, 0.5, 2)).toBeCloseTo(4)
    let levels = 2
    for (let frame = 0; frame < 60; frame += 1) levels = stepPosterizeLevels(levels, 16, null, 0, 1 / 30, 0.45, 2)
    expect(levels).toBeGreaterThan(15)
    expect(levels).toBeLessThanOrEqual(16)
    let building = 16
    for (let frame = 0; frame < 120; frame += 1) building = stepPosterizeLevels(building, 16, null, 1, 1 / 30, 0.2, 2)
    expect(building).toBeLessThan(6)
  })
})

describe('body, silhouette-fill and tone processors', () => {
  const ids = ['spark-skeleton', 'digital-silhouette', 'portal-body', 'x-ray', 'posterize-pulse'] as const
  const make = {
    'spark-skeleton': (pose: ReturnType<typeof fakePose>) => createSparkSkeletonProcessor({ tracker: () => pose }),
    'digital-silhouette': (_pose: ReturnType<typeof fakePose>, seg: ReturnType<typeof fakeSegmenter>) => createDigitalSilhouetteProcessor({ segmenter: () => seg }),
    'portal-body': (_pose: ReturnType<typeof fakePose>, seg: ReturnType<typeof fakeSegmenter>) => createPortalBodyProcessor({ segmenter: () => seg }),
    'x-ray': () => createHeadlinerEffectProcessor('x-ray'),
    'posterize-pulse': () => createHeadlinerEffectProcessor('posterize-pulse'),
  } as const

  it.each(ids)('%s is the clean camera at Master Intensity 0 and holds no tracker or segmenter then', id => {
    const pose = fakePose()
    const seg = fakeSegmenter()
    const processor = make[id](pose, seg)
    processor.render(renderArgs(makeOutput(), id, { masterIntensity: 0 }))
    expect(drawn).toBe(1)
    expect(pose.acquire).not.toHaveBeenCalled()
    expect(seg.acquire).not.toHaveBeenCalled()
    processor.dispose()
  })

  it.each(ids)('%s layers its effect over the live picture', id => {
    const processor = make[id](fakePose(), fakeSegmenter())
    drawn = 0
    processor.render(renderArgs(makeOutput(), id, {}, { beat: 1, timeSec: 0.5, dtSec: 1 / 30 }))
    expect(drawn).toBeGreaterThan(1)
    processor.dispose()
  })

  it('Spark Skeleton shows the plain camera with nobody found, and releases the tracker when turned off', () => {
    const pose = fakePose(null)
    const processor = createSparkSkeletonProcessor({ tracker: () => pose })
    const output = makeOutput()
    processor.render(renderArgs(output, 'spark-skeleton', {}, { timeSec: 0.1 }))
    expect(drawn).toBe(1)
    pose.set(POINTS)
    processor.render(renderArgs(output, 'spark-skeleton', {}, { timeSec: 0.2, dtSec: 0.1 }))
    processor.render(renderArgs(output, 'spark-skeleton', { masterIntensity: 0 }, { timeSec: 0.4 }))
    expect(pose.acquire).toHaveBeenCalledTimes(1)
    expect(pose.release).toHaveBeenCalledTimes(1)
    processor.dispose()
  })

  it('Digital Silhouette treats the surroundings only when asked to', () => {
    const output = makeOutput()
    drawn = 0
    applyEnvironment(renderArgs(output, 'digital-silhouette'), 'keep', 1, 1)
    applyEnvironment(renderArgs(output, 'digital-silhouette'), 'dim', 0, 1)
    expect(drawn).toBe(0)
    applyEnvironment(renderArgs(output, 'digital-silhouette'), 'blur', 1, 1)
    expect(drawn).toBe(1)
  })

  it('X-Ray does no pixel work while its transition is at 0, and works when a beat pulse is up', () => {
    const processor = createHeadlinerEffectProcessor('x-ray')
    const output = makeOutput()
    drawn = 0
    processor.render(renderArgs(output, 'x-ray', { trigger: 'hit' }, { beat: 1, dtSec: 1 / 30 }))
    expect(drawn).toBe(1)
    drawn = 0
    processor.render(renderArgs(output, 'x-ray', { trigger: 'hit' }, { beat: 1, dtSec: 1 / 30, kickHit: true }))
    expect(drawn).toBeGreaterThan(1)
    drawn = 0
    processor.render(renderArgs(output, 'x-ray', { trigger: 'beat' }, { beat: 3, dtSec: 1 / 30 }))
    expect(drawn).toBeGreaterThan(1)
    processor.dispose()
  })

  it('Posterize Pulse crushes on a kick and recovers afterwards', () => {
    const processor = createHeadlinerEffectProcessor('posterize-pulse')
    const output = makeOutput()
    for (let frame = 0; frame < 3; frame += 1) processor.render(renderArgs(output, 'posterize-pulse', {}, { beat: 0.1 + frame * 0.01, timeSec: frame / 30 }))
    drawn = 0
    processor.render(renderArgs(output, 'posterize-pulse', {}, { beat: 0.2, timeSec: 0.2, kickHit: true, dtSec: 1 / 30 }))
    expect(drawn).toBeGreaterThan(1)
    processor.dispose()
  })
})

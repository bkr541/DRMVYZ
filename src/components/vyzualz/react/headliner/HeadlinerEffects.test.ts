// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveHeadlinerParameters } from './HeadlinerEffectCatalog'
import {
  createHeadlinerEffectProcessor,
  resolveHeadlinerWorkSize,
  type HeadlinerEffectRenderArgs,
} from './HeadlinerEffects'
import { HEADLINER_IDLE_TIMING, type HeadlinerEffectTiming } from './HeadlinerTiming'
import { placeCloneSpreadCopies } from './HeadlinerCloneEffects'
import { stepMeltField } from './HeadlinerEffects'
import { fireHeadlinerTrigger } from './HeadlinerTriggers'
import {
  beatPulseEnvelope,
  createFaceEchoProcessor,
  createFaceWarpProcessor,
  faceEchoSpreadOffset,
  resolveFaceFollowSmoothing,
  resolveHeadCrop,
  scaleFaceBox,
} from './HeadlinerFaceEffects'
import type { HeadlinerFaceSample, HeadlinerFaceSource } from './HeadlinerFaceTracking'
import type { HeadlinerFaceWarpFrame, HeadlinerFaceWarpRenderer } from './HeadlinerFaceWarpGL'
import { pickRgbGhostFrame, resolveRgbGhostDelays, resolveRgbGhostOrder } from './HeadlinerTemporalEffects'

interface Draw {
  canvas: HTMLCanvasElement
  operation: string
  alpha: number
  filter: string
}

let draws: Draw[] = []
let pixels = new Uint8ClampedArray(128 * 72 * 4)
const contexts = new WeakMap<HTMLCanvasElement, CanvasRenderingContext2D>()

function setSquare(x0: number) {
  pixels = new Uint8ClampedArray(128 * 72 * 4)
  for (let y = 20; y < 44; y += 1) {
    for (let x = x0; x < x0 + 24; x += 1) {
      const value = 40 + ((((x - x0) * 73856093) ^ ((y - 20) * 19349663)) >>> 0) % 200
      const index = (y * 128 + x) * 4
      pixels[index] = value
      pixels[index + 1] = value
      pixels[index + 2] = value
      pixels[index + 3] = 255
    }
  }
}

beforeEach(() => {
  draws = []
  pixels = new Uint8ClampedArray(128 * 72 * 4)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function getContext(this: HTMLCanvasElement) {
    const existing = contexts.get(this)
    if (existing) return existing as never
    const context = {
      canvas: this,
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      filter: 'none',
      fillStyle: '',
      imageSmoothingEnabled: true,
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      createRadialGradient: () => ({ addColorStop: vi.fn() }),
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      putImageData: vi.fn(),
      createImageData: (width: number, height: number) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }),
      getImageData: (_x: number, _y: number, width: number, height: number) => ({ width, height, data: pixels.slice(0, width * height * 4) }),
      createLinearGradient: () => ({ addColorStop: vi.fn() }),
      drawImage: vi.fn(function drawImage(this: CanvasRenderingContext2D) {
        draws.push({ canvas: this.canvas, operation: this.globalCompositeOperation, alpha: this.globalAlpha, filter: this.filter })
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
  overrides: Record<string, number | boolean | string>,
  presetId: Parameters<typeof resolveHeadlinerParameters>[0],
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

const drawsOnto = (canvas: HTMLCanvasElement) => draws.filter(draw => draw.canvas === canvas)

describe('Headliner effect processors', () => {
  it('sizes work surfaces to at most 720 px wide, keeping the aspect ratio', () => {
    expect(resolveHeadlinerWorkSize(1920, 1080)).toEqual({ width: 720, height: 405 })
    expect(resolveHeadlinerWorkSize(400, 300)).toEqual({ width: 400, height: 300 })
  })

  it.each(['motion-echo', 'ghost-trails', 'velocity-smear', 'motion-melt', 'freeze-ghost', 'strobe-clone', 'clone-spread', 'rgb-ghost', 'face-warp', 'face-echo'] as const)('%s at Master Intensity 0 is the clean camera', presetId => {
    const processor = createHeadlinerEffectProcessor(presetId)
    const output = makeOutput()
    setSquare(30)
    processor.render(renderArgs(output, { masterIntensity: 0 }, presetId))
    setSquare(36)
    processor.render(renderArgs(output, { masterIntensity: 0 }, presetId, { beat: 1, timeSec: 1 }))
    expect(drawsOnto(output.canvas)).toHaveLength(2)
    processor.dispose()
  })

  it('Motion Echo captures a clone on each beat division with BPM Sync on and layers them with the chosen blend', () => {
    const processor = createHeadlinerEffectProcessor('motion-echo')
    const output = makeOutput()
    const overrides = { echoCount: 3, echoSpacingBeats: '0.25', blendMode: 'screen' }
    for (let frame = 0; frame < 4; frame += 1) {
      draws = []
      processor.render(renderArgs(output, overrides, 'motion-echo', { beat: frame * 0.25, timeSec: frame * 0.1 }))
    }
    const onOutput = drawsOnto(output.canvas)
    expect(onOutput).toHaveLength(2)
    expect(onOutput[1]).toMatchObject({ operation: 'screen' })
    // Three clones were drawn into the echo layer on the last frame.
    const layerDraws = draws.filter(draw => draw.canvas !== output.canvas).filter(draw => draw.canvas.width === 720)
    expect(layerDraws.length).toBeGreaterThanOrEqual(3)
    processor.dispose()
  })

  it('Motion Echo follows the beat grid with BPM Sync on and the clock with it off', () => {
    const cloneCount = (overrides: Record<string, number | boolean | string>) => {
      const processor = createHeadlinerEffectProcessor('motion-echo')
      const output = makeOutput()
      for (let frame = 0; frame < 6; frame += 1) {
        draws = []
        // The beat never advances, but time does.
        processor.render(renderArgs(output, { echoCount: 6, ...overrides }, 'motion-echo', { beat: 2, timeSec: frame * 0.2 }))
      }
      const clones = draws.filter(draw => draw.canvas !== output.canvas && draw.canvas.width === 720).length
      processor.dispose()
      return clones
    }
    const onGrid = cloneCount({ bpmSync: true, echoSpacingBeats: '0.25' })
    const onClock = cloneCount({ bpmSync: false, echoDelayMs: 100 })
    expect(onGrid).toBeLessThan(onClock)
  })

  it('Ghost Trails ages its trail, deposits the moving picture and composites with the chosen blend', () => {
    const processor = createHeadlinerEffectProcessor('ghost-trails')
    const output = makeOutput()
    setSquare(30)
    processor.render(renderArgs(output, {}, 'ghost-trails', { timeSec: 0 }))
    draws = []
    setSquare(38)
    processor.render(renderArgs(output, {}, 'ghost-trails', { timeSec: 0.016 }))
    // Live frame, then the trail layer on top.
    const onOutput = drawsOnto(output.canvas)
    expect(onOutput).toHaveLength(2)
    expect(onOutput[1]).toMatchObject({ operation: 'screen' })
    // The existing trail was redrawn (aged) and the moving picture was deposited into it.
    expect(draws.filter(draw => draw.canvas !== output.canvas).length).toBeGreaterThanOrEqual(3)
    processor.dispose()
  })

  it('Velocity Smear stretches only moving cells, and does nothing while the picture is still', () => {
    const processor = createHeadlinerEffectProcessor('velocity-smear')
    const output = makeOutput()
    setSquare(30)
    processor.render(renderArgs(output, {}, 'velocity-smear', { timeSec: 0 }))
    draws = []
    processor.render(renderArgs(output, {}, 'velocity-smear', { timeSec: 0.016 }))
    expect(drawsOnto(output.canvas)).toHaveLength(1)

    draws = []
    setSquare(34)
    processor.render(renderArgs(output, {}, 'velocity-smear', { timeSec: 0.032 }))
    const composite = drawsOnto(output.canvas)
    expect(composite).toHaveLength(2)
    expect(composite[1].filter).toContain('blur')
    expect(draws.filter(draw => draw.canvas !== output.canvas).length).toBeGreaterThan(10)
    processor.dispose()
  })
})

describe('Motion Melt', () => {
  it('melts only moving cells and leaves a still picture untouched', () => {
    const processor = createHeadlinerEffectProcessor('motion-melt')
    const output = makeOutput()
    setSquare(30)
    processor.render(renderArgs(output, {}, 'motion-melt', { timeSec: 0, dtSec: 0.016 }))
    draws = []
    processor.render(renderArgs(output, {}, 'motion-melt', { timeSec: 0.016, dtSec: 0.016 }))
    expect(drawsOnto(output.canvas)).toHaveLength(1)

    draws = []
    for (const x of [34, 38, 42]) {
      setSquare(x)
      processor.render(renderArgs(output, {}, 'motion-melt', { timeSec: 0.05, dtSec: 0.016 }))
    }
    const composite = drawsOnto(output.canvas)
    expect(composite.length).toBeGreaterThan(3)
    expect(composite[composite.length - 1].filter).toContain('blur')
    processor.dispose()
  })

  it('accumulates movement into the field, drips it down, spreads it to neighbours and settles it back', () => {
    const cols = 4
    const rows = 3
    const field = new Float32Array(cols * rows * 2)
    const scratch = new Float32Array(field.length)
    const flow = new Float32Array(field.length)
    flow[(1 * cols + 1) * 2] = 4
    const options = { pixelsPerFlow: 5, threshold: 0.3, gain: 1, drip: 0.5, settle: 0.9, limit: 200 }
    stepMeltField(field, scratch, flow, cols, rows, options)
    const centre = (1 * cols + 1) * 2
    expect(field[centre]).toBeGreaterThan(5)
    expect(field[centre + 1]).toBeGreaterThan(0)
    // The neighbour picked some of it up.
    expect(field[(1 * cols + 2) * 2]).toBeGreaterThan(0)
    const afterOne = field[centre]
    flow.fill(0)
    for (let step = 0; step < 60; step += 1) stepMeltField(field, scratch, flow, cols, rows, options)
    expect(field[centre]).toBeLessThan(afterOne * 0.05)
    // Limited to the cap.
    flow[centre] = 4000
    stepMeltField(field, scratch, flow, cols, rows, options)
    expect(Math.max(...field)).toBeLessThanOrEqual(200)
  })
})

describe('Freeze Ghost', () => {
  it('shows nothing until a pose is captured, keeps it while you move, and clears on demand', () => {
    const processor = createHeadlinerEffectProcessor('freeze-ghost')
    const output = makeOutput()
    setSquare(30)
    draws = []
    processor.render(renderArgs(output, {}, 'freeze-ghost', { beat: 0 }))
    expect(drawsOnto(output.canvas)).toHaveLength(1)

    fireHeadlinerTrigger('capture-pose')
    draws = []
    processor.render(renderArgs(output, {}, 'freeze-ghost', { beat: 0.1 }))
    expect(drawsOnto(output.canvas)).toHaveLength(2)

    // The ghost stays on later frames without another press.
    draws = []
    setSquare(60)
    processor.render(renderArgs(output, {}, 'freeze-ghost', { beat: 0.2 }))
    expect(drawsOnto(output.canvas)).toHaveLength(2)

    fireHeadlinerTrigger('clear-ghosts')
    draws = []
    processor.render(renderArgs(output, {}, 'freeze-ghost', { beat: 0.3 }))
    expect(drawsOnto(output.canvas)).toHaveLength(1)
    processor.dispose()
  })

  it('captures on the chosen beat interval and drops the oldest ghost beyond Max Ghosts', () => {
    const processor = createHeadlinerEffectProcessor('freeze-ghost')
    const output = makeOutput()
    const layerDrawsAt = (beat: number) => {
      draws = []
      processor.render(renderArgs(output, { autoCapture: '1', maxGhosts: 2 }, 'freeze-ghost', { beat }))
      return draws.filter(draw => draw.canvas !== output.canvas && draw.canvas.width === 720 && draw.alpha < 1).length
    }
    layerDrawsAt(0.2)
    expect(layerDrawsAt(1.1)).toBe(1)
    expect(layerDrawsAt(2.1)).toBe(2)
    // A third capture still shows only two ghosts.
    expect(layerDrawsAt(3.1)).toBe(2)
    processor.dispose()
  })
})

describe('Strobe Clone', () => {
  const layerClones = (output: ReturnType<typeof makeOutput>) => draws.filter(draw => draw.canvas !== output.canvas && draw.canvas.width === 720 && draw.alpha < 1).length

  it('captures a clone only on a kick, not between kicks', () => {
    const processor = createHeadlinerEffectProcessor('strobe-clone')
    const output = makeOutput()
    draws = []
    processor.render(renderArgs(output, {}, 'strobe-clone', { beat: 0.1 }))
    expect(drawsOnto(output.canvas)).toHaveLength(1)
    draws = []
    processor.render(renderArgs(output, {}, 'strobe-clone', { beat: 0.2, kickHit: true }))
    expect(drawsOnto(output.canvas)).toHaveLength(2)
    processor.render(renderArgs(output, {}, 'strobe-clone', { beat: 0.3 }))
    draws = []
    processor.render(renderArgs(output, {}, 'strobe-clone', { beat: 0.4 }))
    expect(layerClones(output)).toBe(1)
    processor.dispose()
  })

  it('adds an alternate-style clone on a snare, and ignores snares when Snare Clones is off', () => {
    const count = (overrides: Record<string, number | boolean | string>) => {
      const processor = createHeadlinerEffectProcessor('strobe-clone')
      const output = makeOutput()
      processor.render(renderArgs(output, overrides, 'strobe-clone', { beat: 0.1 }))
      draws = []
      processor.render(renderArgs(output, overrides, 'strobe-clone', { beat: 0.2, snareHit: true }))
      const clones = layerClones(output)
      processor.dispose()
      return clones
    }
    expect(count({ altStyle: 'mirror' })).toBe(1)
    expect(count({ snareClones: false })).toBe(0)
  })

  it('clears every clone on the downbeat of the chosen bar', () => {
    const processor = createHeadlinerEffectProcessor('strobe-clone')
    const output = makeOutput()
    const overrides = { resetEvery: '2' }
    processor.render(renderArgs(output, overrides, 'strobe-clone', { beat: 0.1, kickHit: true }))
    processor.render(renderArgs(output, overrides, 'strobe-clone', { beat: 1, downbeatHit: true }))
    draws = []
    processor.render(renderArgs(output, overrides, 'strobe-clone', { beat: 1.1 }))
    expect(layerClones(output)).toBe(1)
    // The second downbeat is the 2-bar mark.
    processor.render(renderArgs(output, overrides, 'strobe-clone', { beat: 5, downbeatHit: true }))
    draws = []
    processor.render(renderArgs(output, overrides, 'strobe-clone', { beat: 5.1 }))
    expect(layerClones(output)).toBe(0)
    processor.dispose()
  })

  it('captures faster as a build-up progresses', () => {
    const captures = (build: number) => {
      const processor = createHeadlinerEffectProcessor('strobe-clone')
      const output = makeOutput()
      for (let step = 0; step <= 8; step += 1) {
        processor.render(renderArgs(output, { maxClones: 10, cloneLife: '0', buildAcceleration: 1 }, 'strobe-clone', { beat: step * 0.25, build }))
      }
      draws = []
      processor.render(renderArgs(output, { maxClones: 10, cloneLife: '0', buildAcceleration: 1 }, 'strobe-clone', { beat: 2.1, build }))
      const clones = layerClones(output)
      processor.dispose()
      return clones
    }
    expect(captures(0)).toBe(0)
    expect(captures(1)).toBeGreaterThan(captures(0))
  })
})

describe('Clone Spread', () => {
  it('places copies alternately left and right, above and below, around a ring, or mirrored', () => {
    const horizontal = placeCloneSpreadCopies('horizontal', 4, 100, 0, 0.6)
    expect(horizontal.map(placement => placement.x)).toEqual([100, -100, 200, -200])
    expect(horizontal.every(placement => placement.y === 0 && !placement.flip)).toBe(true)

    const vertical = placeCloneSpreadCopies('vertical', 2, 100, 0, 0.5)
    expect(vertical.map(placement => placement.y)).toEqual([50, -50])

    const ring = placeCloneSpreadCopies('radial', 4, 100, 0, 1)
    expect(ring.every(placement => Math.abs(Math.hypot(placement.x, placement.y) - 100) < 1e-6)).toBe(true)
    // One shift turns the ring by one place.
    const shifted = placeCloneSpreadCopies('radial', 4, 100, 1, 1)
    expect(shifted[0].x).toBeCloseTo(ring[1].x)
    expect(shifted[0].y).toBeCloseTo(ring[1].y)

    expect(placeCloneSpreadCopies('mirror', 2, 100, 0, 1).map(placement => placement.flip)).toEqual([false, true])
    // A shift swaps the linear layouts to the other side.
    expect(placeCloneSpreadCopies('horizontal', 1, 100, 1, 1)[0].x).toBeCloseTo(-100)
  })

  it('draws one copy per Copies setting over the live picture', () => {
    const processor = createHeadlinerEffectProcessor('clone-spread')
    const output = makeOutput()
    draws = []
    processor.render(renderArgs(output, { copies: 5, spreadMotion: 'static' }, 'clone-spread', { beat: 1 }))
    expect(drawsOnto(output.canvas)).toHaveLength(2)
    const copies = draws.filter(draw => draw.canvas !== output.canvas && draw.canvas.width === 720 && draw.alpha < 1)
    expect(copies).toHaveLength(5)
    processor.dispose()
  })
})

describe('RGB Ghost', () => {
  it('lags the channels in the chosen order: live first, then one step, then two', () => {
    expect(resolveRgbGhostDelays('rgb', 0.1)).toEqual({ r: 0, g: 0.1, b: 0.2 })
    expect(resolveRgbGhostDelays('bgr', 0.1)).toEqual({ b: 0, g: 0.1, r: 0.2 })
    expect(resolveRgbGhostDelays('rgb', 0)).toEqual({ r: 0, g: 0, b: 0 })
    // The oldest channel never lags more than a second, however large the step.
    expect(resolveRgbGhostDelays('rgb', 5).b).toBe(1)
    expect(resolveRgbGhostOrder('nonsense')).toEqual(['r', 'g', 'b'])
    expect(resolveRgbGhostOrder('rrg')).toEqual(['r', 'g', 'b'])
  })

  it('picks the stored picture whose age is closest to the wanted delay', () => {
    const ages = [0, 0.033, 0.066, 0.1, 0.133]
    expect(pickRgbGhostFrame(ages, 0.1)).toBe(3)
    expect(pickRgbGhostFrame(ages, 0.08)).toBe(2)
    expect(pickRgbGhostFrame(ages, 9)).toBe(4)
    expect(pickRgbGhostFrame([], 0.1)).toBe(-1)
  })

  it('rebuilds the picture channel by channel and adds the three together over the live picture', () => {
    const processor = createHeadlinerEffectProcessor('rgb-ghost')
    const output = makeOutput()
    for (let frame = 0; frame < 6; frame += 1) {
      draws = []
      processor.render(renderArgs(output, { delayMs: 30 }, 'rgb-ghost', { beat: frame, timeSec: frame * 0.05 }))
    }
    expect(drawsOnto(output.canvas)).toHaveLength(2)
    const added = draws.filter(draw => draw.canvas.width === 720 && draw.operation === 'lighter')
    expect(added).toHaveLength(3)
    processor.dispose()
  })
})

// ── Face effects ───────────────────────────────────────────────────────────────

const FACE_POSE = { cx: 0.5, cy: 0.4, width: 0.2, height: 0.3, roll: 0 }

function fakeFaceSource(pose: HeadlinerFaceSample['pose'] = FACE_POSE) {
  let sequence = 1
  const source = {
    acquire: vi.fn(),
    release: vi.fn(),
    sample: vi.fn((): HeadlinerFaceSample => ({ status: 'ready', pose, sequence })),
    setPose(next: HeadlinerFaceSample['pose']) {
      pose = next
      sequence += 1
    },
  }
  return source satisfies HeadlinerFaceSource & { setPose(next: HeadlinerFaceSample['pose']): void }
}

function faceArgs(
  output: ReturnType<typeof makeOutput>,
  overrides: Record<string, number | boolean | string>,
  presetId: 'face-warp' | 'face-echo',
  timing: Partial<HeadlinerEffectTiming> = {},
): HeadlinerEffectRenderArgs {
  const args = renderArgs(output, overrides, presetId, timing)
  Object.defineProperty(args.video, 'videoWidth', { value: 1280 })
  Object.defineProperty(args.video, 'videoHeight', { value: 720 })
  return args
}

describe('Face effect helpers', () => {
  it('maps the follow-smoothing setting onto a time constant, tightest at 0 and slowest at 1', () => {
    expect(resolveFaceFollowSmoothing(0)).toBeCloseTo(0.02)
    expect(resolveFaceFollowSmoothing(1)).toBeCloseTo(0.3)
    expect(resolveFaceFollowSmoothing(9)).toBeCloseTo(0.3)
  })

  it('swells on the beat and fades through it, and fans echoes right then left, each a head further out', () => {
    expect(beatPulseEnvelope(2)).toBe(1)
    expect(beatPulseEnvelope(2.5)).toBeLessThan(beatPulseEnvelope(2.1))
    expect([0, 1, 2, 3].map(index => Math.round(faceEchoSpreadOffset(index, 100) / 1.1))).toEqual([100, -100, 200, -200])
  })

  it('sizes the warp region from the face and boxes a tilted head by its extent', () => {
    expect(scaleFaceBox({ cx: 10, cy: 20, width: 100, height: 150, roll: 0.3 }, 1.5)).toEqual({ cx: 10, cy: 20, width: 150, height: 225, roll: 0.3 })
    const upright = resolveHeadCrop({ cx: 0, cy: 0, width: 100, height: 200, roll: 0 })
    expect(upright.halfWidth).toBeCloseTo(50)
    expect(upright.halfHeight).toBeCloseTo(100)
    const turned = resolveHeadCrop({ cx: 0, cy: 0, width: 100, height: 200, roll: Math.PI / 2 })
    expect(turned.halfWidth).toBeCloseTo(100)
    expect(turned.halfHeight).toBeCloseTo(50)
  })
})

describe('Face Warp', () => {
  function warpRig(source: ReturnType<typeof fakeFaceSource>) {
    const patch = document.createElement('canvas')
    const frames: HeadlinerFaceWarpFrame[] = []
    const renderer: HeadlinerFaceWarpRenderer = {
      render: vi.fn(frame => {
        frames.push(frame)
        return { canvas: patch, x: 400, y: 100 }
      }),
      dispose: vi.fn(),
    }
    return { patch, frames, renderer, processor: createFaceWarpProcessor({ tracker: () => source, createWarpRenderer: () => renderer }) }
  }

  it('warps a region around the tracked face and draws the patch over the live picture', () => {
    const source = fakeFaceSource()
    const { processor, frames, renderer } = warpRig(source)
    const output = makeOutput()
    draws = []
    processor.render(faceArgs(output, { warpStyle: 'twist', warpAmount: 0.5, regionSize: 2, beatPulse: 0 }, 'face-warp'))

    expect(frames).toHaveLength(1)
    // The face is 0.2 x 0.3 of the picture, i.e. 256 x 216 px on a 1280 x 720 canvas; the region doubles it.
    expect(frames[0].face).toMatchObject({ cx: 640, cy: 288, width: 512, height: 432 })
    expect(frames[0].params).toMatchObject({ style: 'twist' })
    expect(frames[0].params.amount).toBeGreaterThan(0)
    // The live camera, then the warped patch.
    expect(drawsOnto(output.canvas)).toHaveLength(2)
    processor.dispose()
    expect(renderer.dispose).toHaveBeenCalled()
  })

  it('shows the plain camera while no face is found, and pulses the warp on the beat', () => {
    const source = fakeFaceSource(null)
    const { processor, frames, renderer } = warpRig(source)
    const output = makeOutput()
    processor.render(faceArgs(output, {}, 'face-warp'))
    expect(renderer.render).not.toHaveBeenCalled()

    source.setPose(FACE_POSE)
    processor.render(faceArgs(output, { beatPulse: 1, kickReactivity: 0, musicReactivity: 0 }, 'face-warp', { beat: 4 }))
    processor.render(faceArgs(output, { beatPulse: 1, kickReactivity: 0, musicReactivity: 0 }, 'face-warp', { beat: 4.5 }))
    expect(frames[0].params.amount).toBeGreaterThan(frames[1].params.amount)
    processor.dispose()
  })

  it('holds the tracker only while the effect is on', () => {
    const source = fakeFaceSource()
    const { processor } = warpRig(source)
    const output = makeOutput()
    processor.render(faceArgs(output, { masterIntensity: 0 }, 'face-warp'))
    expect(source.acquire).not.toHaveBeenCalled()
    processor.render(faceArgs(output, {}, 'face-warp'))
    processor.render(faceArgs(output, {}, 'face-warp'))
    expect(source.acquire).toHaveBeenCalledTimes(1)
    processor.render(faceArgs(output, { masterIntensity: 0 }, 'face-warp'))
    expect(source.release).toHaveBeenCalledTimes(1)
    processor.dispose()
    expect(source.release).toHaveBeenCalledTimes(1)
  })

  it('falls back to the live picture when the warp renderer cannot start', () => {
    const processor = createFaceWarpProcessor({ tracker: () => fakeFaceSource(), createWarpRenderer: () => null })
    const output = makeOutput()
    draws = []
    processor.render(faceArgs(output, {}, 'face-warp'))
    expect(drawsOnto(output.canvas)).toHaveLength(1)
    processor.dispose()
  })
})

describe('Face Echo', () => {
  it('captures a head per beat division and layers the echoes, with the live head back on top', () => {
    const source = fakeFaceSource()
    const processor = createFaceEchoProcessor({ tracker: () => source })
    const output = makeOutput()
    const overrides = { echoCount: 3, echoSpacingBeats: '0.25' }
    for (let frame = 0; frame < 5; frame += 1) {
      draws = []
      processor.render(faceArgs(output, overrides, 'face-echo', { beat: frame * 0.25, timeSec: frame * 0.1 }))
    }
    // The live camera, three echoes, then the live head again.
    expect(drawsOnto(output.canvas)).toHaveLength(1 + 3 + 1)
    const echoes = drawsOnto(output.canvas).slice(1, 4)
    expect(echoes[0].alpha).toBeLessThan(echoes[2].alpha)

    draws = []
    processor.render(faceArgs(output, { ...overrides, liveHeadOnTop: false }, 'face-echo', { beat: 1.25, timeSec: 0.6 }))
    expect(drawsOnto(output.canvas)).toHaveLength(1 + 3)
    processor.dispose()
  })

  it('keeps the camera clean with no face, hides echoes when the face is gone, and releases the tracker', () => {
    const source = fakeFaceSource(null)
    const processor = createFaceEchoProcessor({ tracker: () => source })
    const output = makeOutput()
    draws = []
    processor.render(faceArgs(output, {}, 'face-echo', { beat: 1 }))
    expect(drawsOnto(output.canvas)).toHaveLength(1)
    expect(source.acquire).toHaveBeenCalledTimes(1)

    source.setPose(FACE_POSE)
    processor.render(faceArgs(output, {}, 'face-echo', { beat: 2, timeSec: 0.5 }))
    processor.render(faceArgs(output, { masterIntensity: 0 }, 'face-echo', { beat: 3, timeSec: 1 }))
    expect(source.release).toHaveBeenCalledTimes(1)
    processor.dispose()
  })
})

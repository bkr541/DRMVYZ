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
      scale: vi.fn(),
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

  it.each(['motion-echo', 'ghost-trails', 'velocity-smear', 'motion-melt', 'freeze-ghost', 'strobe-clone', 'clone-spread'] as const)('%s at Master Intensity 0 is the clean camera', presetId => {
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

